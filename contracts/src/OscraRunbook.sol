// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOscraCoin, IOscraPriceFeed, IOscraSwapRouter, IOscraFeeSink, OscraWire} from "./OscraWire.sol";

/**
 * @title OscraRunbook
 * @notice Rule-bound buying for wallets on Robinhood Chain: recurring buys (DCA plans) and copied trades
 *         (follows of a signal desk), both with limits the wallet owner writes and can change at any time.
 *
 * Custody: the contract never keeps a balance between calls. Each buy pulls exactly one order's worth of
 * dollars from the owner's wallet (through the allowance the owner chose), swaps it on a fixed Uniswap v3 pool
 * and sends the asset straight back to the owner, all in one transaction. Revoking the allowance stops
 * everything. There is no owner, no admin key, no pause switch and no upgrade path; every market (lane), the
 * fee rates and the swap router are fixed in the constructor.
 *
 * Prices: every order is checked against a Chainlink feed. The swap must return at least the feed-implied
 * amount minus the owner's slippage limit, so a buy at a bad pool price reverts instead of filling.
 *
 * Fees: zero until the one-time `bind` links the $OSCRA staking contract (done once by the deployer, after
 * the token exists). After that a fixed fee goes to that contract for stakers, and wallets that hold or stake
 * at least `holderMin` $OSCRA pay the lower `holderFeeBps`.
 */
contract OscraRunbook {
    using OscraWire for IOscraCoin;

    // ------------------------------------------------------------------ constants

    uint256 internal constant BPS = 10_000;
    uint32 public constant MIN_INTERVAL = 1 hours;
    uint32 public constant MAX_INTERVAL = 90 days;
    uint16 public constant MIN_SLIP_BPS = 50;
    uint16 public constant MAX_SLIP_BPS = 500;
    uint16 public constant MAX_GUARD_BPS = 9_000;
    uint16 public constant MAX_TARGET_BPS = 50_000;
    uint16 public constant MAX_CHASE_BPS = 2_000;
    uint32 public constant MAX_REVIEW_DELAY = 2 days;
    uint32 public constant MIRROR_WINDOW = 6 hours;
    uint256 public constant MAX_LANES = 16;
    uint256 public constant MAX_FEE_BPS = 100;
    /// A caller who is not the wallet owner may take at most one tenth of an order as its tip.
    uint256 internal constant TIP_SHARE = 10;

    // ------------------------------------------------------------------ types

    /// A market the Runbook can buy: an asset, its USDG pool fee tier and its Chainlink USD feed.
    struct Lane {
        address asset;
        uint24 poolFee;
        address feed;
        uint32 maxAge;
        uint256 assetUnit;
        uint256 feedUnit;
    }

    struct LaneInput {
        address asset;
        uint24 poolFee;
        address feed;
        uint32 maxAge;
    }

    enum PlanState {
        Active,
        Held,
        Guarded,
        Targeted,
        Spent,
        Closed
    }

    struct Plan {
        address owner;
        uint8 lane;
        PlanState state;
        uint16 slipBps;
        uint16 guardBps;
        uint16 targetBps;
        uint32 interval;
        uint32 buys;
        uint64 nextAt;
        uint128 perBuy;
        uint128 budget;
        uint128 spent;
        uint128 netIn;
        uint128 bought;
        uint128 ceiling;
        uint128 tip;
    }

    /// What the owner writes when opening or tuning a plan.
    struct PlanTerms {
        uint8 lane;
        uint128 perBuy;
        uint32 interval;
        uint128 budget;
        uint128 ceiling;
        uint16 slipBps;
        uint16 guardBps;
        uint16 targetBps;
        uint128 tip;
        uint64 startAt;
    }

    struct Signal {
        address leader;
        uint8 lane;
        bool sell;
        uint16 weightBps;
        uint64 at;
        uint128 price;
    }

    struct Follow {
        bool active;
        uint16 slipBps;
        uint16 chaseBps;
        uint16 stopBps;
        uint32 laneMask;
        uint32 reviewDelay;
        uint64 since;
        uint64 dayStart;
        uint128 perSignal;
        uint128 dayCap;
        uint128 daySpent;
        uint128 maxCost;
        uint128 tip;
    }

    /// What the follower writes when following a desk or changing the limits.
    struct FollowTerms {
        uint128 perSignal;
        uint128 dayCap;
        uint128 maxCost;
        uint32 laneMask;
        uint32 reviewDelay;
        uint16 slipBps;
        uint16 chaseBps;
        uint16 stopBps;
        uint128 tip;
    }

    /// Asset a follower bought by copying one desk on one lane, and the dollars that went into it.
    struct Holding {
        uint128 qty;
        uint128 cost;
    }

    /// Result of one buy: asset received, dollars swapped, fee and tip taken.
    struct Fill {
        uint256 out;
        uint256 netIn;
        uint256 fee;
        uint256 tip;
    }

    enum Outcome {
        None,
        Filled,
        Guarded,
        Targeted,
        Stopped
    }

    // ------------------------------------------------------------------ immutables

    IOscraCoin public immutable dollar;
    IOscraSwapRouter public immutable router;
    uint256 public immutable dollarUnit;
    uint256 public immutable minSpend;
    uint256 public immutable feeBps;
    uint256 public immutable holderFeeBps;
    uint256 public immutable holderMin;
    /// The only address that may call `bind`, once.
    address public immutable binder;

    // ------------------------------------------------------------------ storage

    Lane[] internal _lanes;

    IOscraFeeSink public sink;
    address public sinkToken;

    Plan[] internal _plans;
    mapping(address => uint256[]) internal _plansOf;

    Signal[] internal _signals;
    mapping(address => uint256[]) internal _signalsOf;

    mapping(address => mapping(address => Follow)) internal follows;
    mapping(address => address[]) internal _desksOf;
    mapping(address => mapping(address => bool)) internal _listed;
    mapping(address => mapping(address => mapping(uint8 => Holding))) public holdings;
    mapping(address => mapping(uint256 => bool)) public handled;

    uint256 private _lock = 1;

    // ------------------------------------------------------------------ events

    event Bound(address indexed sink, address indexed token);
    event PlanOpened(uint256 indexed id, address indexed owner, uint8 lane, uint256 perBuy, uint256 interval, uint256 budget);
    event PlanTuned(uint256 indexed id, uint256 perBuy, uint256 interval, uint256 budget, uint256 ceiling);
    event PlanStateChanged(uint256 indexed id, PlanState state);
    event Bought(
        uint256 indexed id,
        address indexed owner,
        address indexed caller,
        uint256 price,
        uint256 gross,
        uint256 netIn,
        uint256 out,
        uint256 fee,
        uint256 tip
    );
    event Posted(uint256 indexed id, address indexed leader, uint8 lane, bool sell, uint16 weightBps, uint256 price);
    event Followed(address indexed follower, address indexed leader, uint256 perSignal, uint256 dayCap, uint32 laneMask, uint32 reviewDelay);
    event Unfollowed(address indexed follower, address indexed leader);
    event FollowStopped(address indexed follower, address indexed leader, uint256 indexed signalId);
    event Skipped(address indexed follower, uint256 indexed signalId);
    event Mirrored(
        uint256 indexed signalId,
        address indexed follower,
        address indexed caller,
        bool sell,
        uint256 price,
        uint256 dollars,
        uint256 assetAmount,
        uint256 fee,
        uint256 tip
    );

    // ------------------------------------------------------------------ errors

    error BadConfig();
    error BadLane();
    error BadTerms();
    error NotOwner();
    error NotDue();
    error NotActive();
    error AboveCeiling();
    error StalePrice();
    error AlreadyBound();
    error NotBinder();
    error UnknownSignal();
    error NotFollowing();
    error AlreadyHandled();
    error OutsideWindow();
    error PriceMoved();
    error DayCapReached();
    error PositionCapReached();
    error NothingToSell();
    error AmountTooSmall();
    error IncomingMismatch();
    error Reentered();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentered();
        _lock = 2;
        _;
        _lock = 1;
    }

    // ------------------------------------------------------------------ setup

    constructor(
        address dollar_,
        address router_,
        LaneInput[] memory lanes_,
        uint256 feeBps_,
        uint256 holderFeeBps_,
        uint256 holderMin_
    ) {
        if (dollar_.code.length == 0 || router_.code.length == 0) revert BadConfig();
        if (lanes_.length == 0 || lanes_.length > MAX_LANES) revert BadConfig();
        if (feeBps_ > MAX_FEE_BPS || holderFeeBps_ > feeBps_) revert BadConfig();
        dollar = IOscraCoin(dollar_);
        router = IOscraSwapRouter(router_);
        uint256 unit = 10 ** IOscraCoin(dollar_).decimals();
        dollarUnit = unit;
        minSpend = unit;
        feeBps = feeBps_;
        holderFeeBps = holderFeeBps_;
        holderMin = holderMin_;
        binder = msg.sender;
        for (uint256 i; i < lanes_.length; ++i) {
            LaneInput memory l = lanes_[i];
            if (l.asset.code.length == 0 || l.feed.code.length == 0 || l.asset == dollar_) revert BadConfig();
            if (l.maxAge == 0 || l.poolFee == 0) revert BadConfig();
            for (uint256 k; k < i; ++k) {
                if (_lanes[k].asset == l.asset) revert BadConfig();
            }
            _lanes.push(
                Lane({
                    asset: l.asset,
                    poolFee: l.poolFee,
                    feed: l.feed,
                    maxAge: l.maxAge,
                    assetUnit: 10 ** IOscraCoin(l.asset).decimals(),
                    feedUnit: 10 ** IOscraPriceFeed(l.feed).decimals()
                })
            );
        }
    }

    /// One-time link to the $OSCRA staking contract. Until then the Runbook charges no fee.
    function bind(address sink_) external {
        if (msg.sender != binder) revert NotBinder();
        if (address(sink) != address(0)) revert AlreadyBound();
        if (sink_.code.length == 0) revert BadConfig();
        address token_ = IOscraFeeSink(sink_).token();
        if (token_.code.length == 0 || token_ == address(dollar)) revert BadConfig();
        sink = IOscraFeeSink(sink_);
        sinkToken = token_;
        emit Bound(sink_, token_);
    }

    // ------------------------------------------------------------------ plans (recurring buys)

    function openPlan(PlanTerms calldata t) external returns (uint256 id) {
        _checkPlan(t);
        id = _plans.length;
        Plan storage p = _plans.push();
        p.owner = msg.sender;
        _writePlan(p, t);
        p.nextAt = t.startAt > block.timestamp ? t.startAt : uint64(block.timestamp);
        _plansOf[msg.sender].push(id);
        emit PlanOpened(id, msg.sender, t.lane, t.perBuy, t.interval, t.budget);
    }

    /// Changes any limit of a plan. The lane cannot change; a plan that used its budget runs again if the budget grows.
    function tunePlan(uint256 id, PlanTerms calldata t) external {
        Plan storage p = _own(id);
        if (p.state == PlanState.Closed || t.lane != p.lane) revert BadTerms();
        _checkPlan(t);
        if (t.budget < p.spent) revert BadTerms();
        _writePlan(p, t);
        if (t.startAt > block.timestamp) p.nextAt = t.startAt;
        emit PlanTuned(id, t.perBuy, t.interval, t.budget, t.ceiling);
        if (p.state == PlanState.Spent && p.spent < p.budget) _setState(id, p, PlanState.Active);
    }

    function holdPlan(uint256 id) external {
        Plan storage p = _own(id);
        if (p.state != PlanState.Active) revert NotActive();
        _setState(id, p, PlanState.Held);
    }

    /// Resumes a plan the owner held, or one a guard or target paused (the owner has reviewed it).
    function resumePlan(uint256 id) external {
        Plan storage p = _own(id);
        if (p.state != PlanState.Held && p.state != PlanState.Guarded && p.state != PlanState.Targeted) revert NotActive();
        if (p.nextAt < block.timestamp) p.nextAt = uint64(block.timestamp);
        _setState(id, p, PlanState.Active);
    }

    function closePlan(uint256 id) external {
        Plan storage p = _own(id);
        if (p.state == PlanState.Closed) revert NotActive();
        _setState(id, p, PlanState.Closed);
    }

    /**
     * Runs the plan's due buy. Anyone may call: the owner (no tip) or any keeper (paid the plan's tip, at most
     * a tenth of the order). Before buying, the price must be under the ceiling; the drawdown guard and the
     * target pause the plan instead of buying when the price has moved past them.
     */
    function runPlan(uint256 id) external nonReentrant returns (Outcome outcome) {
        if (id >= _plans.length) revert NotActive();
        Plan storage p = _plans[id];
        if (p.state != PlanState.Active) revert NotActive();
        if (block.timestamp < p.nextAt) revert NotDue();
        Lane memory lane = _lanes[p.lane];
        uint256 price = _price(lane);
        if (p.ceiling != 0 && price > p.ceiling) revert AboveCeiling();
        if (p.bought != 0) {
            uint256 avg = _avg(lane, p.netIn, p.bought);
            if (p.guardBps != 0 && price * BPS < avg * (BPS - p.guardBps)) {
                _setState(id, p, PlanState.Guarded);
                return Outcome.Guarded;
            }
            if (p.targetBps != 0 && price * BPS >= avg * (BPS + p.targetBps)) {
                _setState(id, p, PlanState.Targeted);
                return Outcome.Targeted;
            }
        }
        uint256 gross = p.perBuy;
        uint256 left = p.budget - p.spent;
        if (gross > left) gross = left;
        if (gross < minSpend) revert AmountTooSmall();

        p.spent += uint128(gross);
        p.buys += 1;
        p.nextAt = uint64(block.timestamp) + p.interval;
        Fill memory fill = _buy(p.owner, lane, gross, p.tip, p.slipBps, price);
        p.netIn += uint128(fill.netIn);
        p.bought += uint128(fill.out);
        emit Bought(id, p.owner, msg.sender, price, gross, fill.netIn, fill.out, fill.fee, fill.tip);
        if (p.budget - p.spent < minSpend) _setState(id, p, PlanState.Spent);
        return Outcome.Filled;
    }

    // ------------------------------------------------------------------ desks and follows (copied trades)

    /// A desk (any wallet) publishes a trade idea. The feed price at this moment is stored with it.
    function post(uint8 laneId, bool sell, uint16 weightBps) external returns (uint256 id) {
        if (laneId >= _lanes.length) revert BadLane();
        if (weightBps == 0 || weightBps > BPS) revert BadTerms();
        uint256 price = _price(_lanes[laneId]);
        id = _signals.length;
        _signals.push(Signal({leader: msg.sender, lane: laneId, sell: sell, weightBps: weightBps, at: uint64(block.timestamp), price: uint128(price)}));
        _signalsOf[msg.sender].push(id);
        emit Posted(id, msg.sender, laneId, sell, weightBps, price);
    }

    /// Follows a desk with the follower's own limits, or changes them. Only ideas posted after the first follow count.
    function follow(address leader, FollowTerms calldata t) external {
        if (leader == address(0) || leader == msg.sender) revert BadTerms();
        if (t.perSignal < minSpend || t.dayCap < t.perSignal) revert BadTerms();
        if (t.laneMask == 0 || t.laneMask >> _lanes.length != 0) revert BadTerms();
        if (t.reviewDelay > MAX_REVIEW_DELAY) revert BadTerms();
        if (t.slipBps < MIN_SLIP_BPS || t.slipBps > MAX_SLIP_BPS) revert BadTerms();
        if (t.chaseBps > MAX_CHASE_BPS || t.stopBps > MAX_GUARD_BPS) revert BadTerms();
        if (t.tip > t.perSignal / TIP_SHARE) revert BadTerms();
        if (t.maxCost != 0 && t.maxCost < t.perSignal) revert BadTerms();
        Follow storage f = follows[msg.sender][leader];
        if (!f.active) {
            f.active = true;
            f.since = uint64(block.timestamp);
        }
        f.perSignal = t.perSignal;
        f.dayCap = t.dayCap;
        f.maxCost = t.maxCost;
        f.laneMask = t.laneMask;
        f.reviewDelay = t.reviewDelay;
        f.slipBps = t.slipBps;
        f.chaseBps = t.chaseBps;
        f.stopBps = t.stopBps;
        f.tip = t.tip;
        if (!_listed[msg.sender][leader]) {
            _listed[msg.sender][leader] = true;
            _desksOf[msg.sender].push(leader);
        }
        emit Followed(msg.sender, leader, t.perSignal, t.dayCap, t.laneMask, t.reviewDelay);
    }

    function unfollow(address leader) external {
        Follow storage f = follows[msg.sender][leader];
        if (!f.active) revert NotFollowing();
        f.active = false;
        emit Unfollowed(msg.sender, leader);
    }

    /// The follower declines one idea. It can no longer be copied into this wallet.
    function skip(uint256 signalId) external {
        if (signalId >= _signals.length) revert UnknownSignal();
        if (handled[msg.sender][signalId]) revert AlreadyHandled();
        handled[msg.sender][signalId] = true;
        emit Skipped(msg.sender, signalId);
    }

    /**
     * Copies one idea into one follower's wallet, inside the follower's limits: after the review delay, within the
     * window, only if the price has not run away from the desk's price, under the daily cap and the position cap.
     * A buy spends `perSignal × weight`; a sell sells that share of what this follow bought on the lane.
     */
    function mirror(address follower, uint256 signalId) external nonReentrant returns (Outcome) {
        if (signalId >= _signals.length) revert UnknownSignal();
        Signal memory s = _signals[signalId];
        Follow storage f = follows[follower][s.leader];
        if (!f.active || s.at < f.since) revert NotFollowing();
        if (f.laneMask & (uint32(1) << s.lane) == 0) revert NotFollowing();
        if (handled[follower][signalId]) revert AlreadyHandled();
        uint256 opens = uint256(s.at) + f.reviewDelay;
        if (block.timestamp < opens || block.timestamp > opens + MIRROR_WINDOW) revert OutsideWindow();
        handled[follower][signalId] = true;

        Lane memory lane = _lanes[s.lane];
        uint256 price = _price(lane);
        Holding storage h = holdings[follower][s.leader][s.lane];
        if (s.sell) {
            if (price * BPS < uint256(s.price) * (BPS - f.chaseBps)) revert PriceMoved();
            _mirrorSell(signalId, follower, s, f, h, lane, price);
            return Outcome.Filled;
        }
        if (price * BPS > uint256(s.price) * (BPS + f.chaseBps)) revert PriceMoved();
        if (f.stopBps != 0 && h.qty != 0 && _value(lane, h.qty, price) * BPS < uint256(h.cost) * (BPS - f.stopBps)) {
            f.active = false;
            emit FollowStopped(follower, s.leader, signalId);
            return Outcome.Stopped;
        }
        uint256 gross = (uint256(f.perSignal) * s.weightBps) / BPS;
        if (gross < minSpend) revert AmountTooSmall();
        if (block.timestamp >= uint256(f.dayStart) + 1 days) {
            f.dayStart = uint64(block.timestamp);
            f.daySpent = 0;
        }
        if (uint256(f.daySpent) + gross > f.dayCap) revert DayCapReached();
        if (f.maxCost != 0 && uint256(h.cost) + gross > f.maxCost) revert PositionCapReached();
        f.daySpent += uint128(gross);
        Fill memory fill = _buy(follower, lane, gross, f.tip, f.slipBps, price);
        h.qty += uint128(fill.out);
        h.cost += uint128(fill.netIn);
        emit Mirrored(signalId, follower, msg.sender, false, price, fill.netIn, fill.out, fill.fee, fill.tip);
        return Outcome.Filled;
    }

    function _mirrorSell(
        uint256 signalId,
        address follower,
        Signal memory s,
        Follow storage f,
        Holding storage h,
        Lane memory lane,
        uint256 price
    ) internal {
        uint256 got = _pullAsset(follower, lane.asset, (uint256(h.qty) * s.weightBps) / BPS);
        uint256 costOff = (uint256(h.cost) * got) / h.qty;
        h.qty -= uint128(got);
        h.cost -= uint128(costOff);
        uint256 out = _swapToDollar(lane, got, (_value(lane, got, price) * (BPS - f.slipBps)) / BPS);
        Fill memory fill = _payOut(follower, out, f.tip);
        fill.out = got;
        emit Mirrored(signalId, follower, msg.sender, true, price, out, got, fill.fee, fill.tip);
    }

    /// Pulls up to `want` of an asset from `from` (capped by its balance) and checks the exact amount arrived.
    function _pullAsset(address from, address asset, uint256 want) internal returns (uint256 got) {
        uint256 bal = IOscraCoin(asset).balanceOf(from);
        if (want > bal) want = bal;
        if (want == 0) revert NothingToSell();
        uint256 before = IOscraCoin(asset).balanceOf(address(this));
        IOscraCoin(asset).pull(from, address(this), want);
        got = IOscraCoin(asset).balanceOf(address(this)) - before;
        if (got != want) revert IncomingMismatch();
    }

    function _swapToDollar(Lane memory lane, uint256 amount, uint256 minOut) internal returns (uint256 out) {
        if (minOut == 0) revert AmountTooSmall();
        uint256 before = dollar.balanceOf(address(this));
        IOscraCoin(lane.asset).allow(address(router), amount);
        router.exactInputSingle(
            IOscraSwapRouter.ExactInputSingleParams({
                tokenIn: lane.asset,
                tokenOut: address(dollar),
                fee: lane.poolFee,
                recipient: address(this),
                amountIn: amount,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        out = dollar.balanceOf(address(this)) - before;
        if (out < minOut) revert IncomingMismatch();
    }

    /// Sends sale proceeds to the follower after the fee and the caller's tip.
    function _payOut(address follower, uint256 amount, uint256 tipCap) internal returns (Fill memory fill) {
        fill.fee = _feeOf(follower, amount);
        fill.tip = msg.sender == follower ? 0 : _min(tipCap, amount / TIP_SHARE);
        fill.netIn = amount - fill.fee - fill.tip;
        dollar.send(follower, fill.netIn);
        _payFee(fill.fee);
        if (fill.tip != 0) dollar.send(msg.sender, fill.tip);
    }

    // ------------------------------------------------------------------ views

    function laneCount() external view returns (uint256) {
        return _lanes.length;
    }

    function laneAt(uint256 id) external view returns (Lane memory) {
        return _lanes[id];
    }

    /// The feed price of a lane (feed decimals). Reverts when the feed is stale.
    function priceOf(uint8 laneId) external view returns (uint256) {
        if (laneId >= _lanes.length) revert BadLane();
        return _price(_lanes[laneId]);
    }

    function planCount() external view returns (uint256) {
        return _plans.length;
    }

    function planAt(uint256 id) external view returns (Plan memory) {
        return _plans[id];
    }

    function plansOf(address owner) external view returns (uint256[] memory) {
        return _plansOf[owner];
    }

    /// Average entry price of a plan in feed units (0 before the first buy).
    function averageEntry(uint256 id) external view returns (uint256) {
        Plan storage p = _plans[id];
        return p.bought == 0 ? 0 : _avg(_lanes[p.lane], p.netIn, p.bought);
    }

    function signalCount() external view returns (uint256) {
        return _signals.length;
    }

    function signalAt(uint256 id) external view returns (Signal memory) {
        return _signals[id];
    }

    function signalsOf(address leader) external view returns (uint256[] memory) {
        return _signalsOf[leader];
    }

    function followOf(address follower, address leader) external view returns (Follow memory) {
        return follows[follower][leader];
    }

    function desksOf(address follower) external view returns (address[] memory) {
        return _desksOf[follower];
    }

    /// The fee rate a wallet pays right now, in basis points.
    function feeRateOf(address account) public view returns (uint256) {
        if (address(sink) == address(0)) return 0;
        return _isHolder(account) ? holderFeeBps : feeBps;
    }

    // ------------------------------------------------------------------ internals

    function _own(uint256 id) internal view returns (Plan storage p) {
        if (id >= _plans.length) revert NotOwner();
        p = _plans[id];
        if (p.owner != msg.sender) revert NotOwner();
    }

    function _checkPlan(PlanTerms calldata t) internal view {
        if (t.lane >= _lanes.length) revert BadLane();
        if (t.perBuy < minSpend || t.budget < t.perBuy) revert BadTerms();
        if (t.interval < MIN_INTERVAL || t.interval > MAX_INTERVAL) revert BadTerms();
        if (t.slipBps < MIN_SLIP_BPS || t.slipBps > MAX_SLIP_BPS) revert BadTerms();
        if (t.guardBps > MAX_GUARD_BPS || t.targetBps > MAX_TARGET_BPS) revert BadTerms();
        if (t.tip > t.perBuy / TIP_SHARE) revert BadTerms();
        if (t.startAt > block.timestamp + MAX_INTERVAL) revert BadTerms();
    }

    function _writePlan(Plan storage p, PlanTerms calldata t) internal {
        p.lane = t.lane;
        p.perBuy = t.perBuy;
        p.interval = t.interval;
        p.budget = t.budget;
        p.ceiling = t.ceiling;
        p.slipBps = t.slipBps;
        p.guardBps = t.guardBps;
        p.targetBps = t.targetBps;
        p.tip = t.tip;
    }

    function _setState(uint256 id, Plan storage p, PlanState s) internal {
        p.state = s;
        emit PlanStateChanged(id, s);
    }

    /// Pulls `gross` dollars from `payer`, takes the fee and the caller's tip, swaps the rest into the lane asset
    /// with the feed-based minimum, and has the router deliver the asset to `payer`.
    function _buy(address payer, Lane memory l, uint256 gross, uint256 tipCap, uint16 slipBps, uint256 price)
        internal
        returns (Fill memory f)
    {
        _pullExact(payer, gross);
        f.fee = _feeOf(payer, gross);
        f.tip = msg.sender == payer ? 0 : _min(tipCap, gross / TIP_SHARE);
        f.netIn = gross - f.fee - f.tip;
        f.out = _swapToAsset(payer, l, f.netIn, (_units(l, f.netIn, price) * (BPS - slipBps)) / BPS);
        _payFee(f.fee);
        if (f.tip != 0) dollar.send(msg.sender, f.tip);
    }

    function _pullExact(address payer, uint256 amount) internal {
        uint256 before = dollar.balanceOf(address(this));
        dollar.pull(payer, address(this), amount);
        if (dollar.balanceOf(address(this)) - before != amount) revert IncomingMismatch();
    }

    /// Swaps `netIn` dollars into the lane asset, delivered to `payer`; checks what actually arrived.
    function _swapToAsset(address payer, Lane memory l, uint256 netIn, uint256 minOut) internal returns (uint256 out) {
        if (minOut == 0) revert AmountTooSmall();
        dollar.allow(address(router), netIn);
        uint256 had = IOscraCoin(l.asset).balanceOf(payer);
        router.exactInputSingle(
            IOscraSwapRouter.ExactInputSingleParams({
                tokenIn: address(dollar),
                tokenOut: l.asset,
                fee: l.poolFee,
                recipient: payer,
                amountIn: netIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        out = IOscraCoin(l.asset).balanceOf(payer) - had;
        if (out < minOut) revert IncomingMismatch();
    }

    function _payFee(uint256 fee) internal {
        if (fee == 0) return;
        dollar.send(address(sink), fee);
        sink.pour();
    }

    function _feeOf(address account, uint256 amount) internal view returns (uint256) {
        return (amount * feeRateOf(account)) / BPS;
    }

    function _isHolder(address account) internal view returns (bool) {
        if (holderMin == 0) return true;
        uint256 held = IOscraCoin(sinkToken).balanceOf(account) + sink.stakedOf(account);
        return held >= holderMin;
    }

    function _price(Lane memory l) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = IOscraPriceFeed(l.feed).latestRoundData();
        if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > l.maxAge) {
            revert StalePrice();
        }
        return uint256(answer);
    }

    /// Asset units worth `dollars` at `price`.
    function _units(Lane memory l, uint256 dollars, uint256 price) internal view returns (uint256) {
        return (dollars * l.assetUnit * l.feedUnit) / (price * dollarUnit);
    }

    /// Dollars worth `qty` asset units at `price`.
    function _value(Lane memory l, uint256 qty, uint256 price) internal view returns (uint256) {
        return (qty * price * dollarUnit) / (l.assetUnit * l.feedUnit);
    }

    /// Average price paid, in feed units.
    function _avg(Lane memory l, uint256 dollars, uint256 qty) internal view returns (uint256) {
        return (dollars * l.assetUnit * l.feedUnit) / (qty * dollarUnit);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
