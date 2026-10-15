// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOscraCoin, OscraWire} from "./OscraWire.sol";

/**
 * @title OscraKeel
 * @notice $OSCRA staking with two jobs:
 *   1. Revenue share. Every USDG fee the OscraRunbook collects is sent here and split across stakers in
 *      proportion to their stake at the moment it arrives. Fees that arrive while nobody stakes wait for the
 *      first staker. Anyone may call `pour()`; it only counts USDG that is not already owed.
 *   2. Polls. A staker with at least `proposerMin` staked may open a poll (2 to 6 choices, 1 to 14 days).
 *      A vote weighs the voter's stake and locks that stake until the poll ends, so one stake cannot vote twice.
 *      Polls are advisory: the OSCRA contracts have no admin, so a result cannot change a live contract; it
 *      sets the brief for the next version.
 * No owner, no admin key, no pause, no upgrade. Token, USDG and `proposerMin` are fixed in the constructor.
 */
contract OscraKeel {
    using OscraWire for IOscraCoin;

    uint256 internal constant ACC = 1e30;
    uint32 public constant MIN_POLL = 1 days;
    uint32 public constant MAX_POLL = 14 days;
    uint256 public constant MAX_TITLE = 200;
    uint256 public constant MAX_CHOICE = 64;

    IOscraCoin public immutable token;
    IOscraCoin public immutable dollar;
    uint256 public immutable proposerMin;

    uint256 public totalStaked;
    /// USDG per staked token unit, scaled by 1e30.
    uint256 public accPerShare;
    /// USDG this contract already knows about (owed to stakers, waiting, or rounding dust).
    uint256 public tracked;
    /// USDG that arrived while nothing was staked.
    uint256 public queued;
    uint256 public totalPoured;

    mapping(address => uint256) public stakedOf;
    /// Per-staker accounting kept at full precision (scaled by 1e30) so rounding can never pay out more than arrived.
    mapping(address => uint256) internal _debt;
    mapping(address => uint256) internal _owed;
    mapping(address => uint64) public lockedUntil;

    struct Poll {
        address author;
        uint64 start;
        uint64 end;
        uint8 choices;
        bytes32 topic;
    }

    Poll[] internal _polls;
    mapping(uint256 => mapping(uint8 => uint256)) public tally;
    /// Choice index + 1, or 0 for not voted.
    mapping(uint256 => mapping(address => uint8)) public ballot;
    mapping(address => uint64) public authorBusyUntil;

    uint256 private _lock = 1;

    event Staked(address indexed account, uint256 amount);
    event Unstaked(address indexed account, uint256 amount);
    event Poured(uint256 fresh, uint256 distributed);
    event Claimed(address indexed account, uint256 amount);
    event PollOpened(uint256 indexed id, address indexed author, uint64 end, string title, string[] choices);
    event Voted(uint256 indexed id, address indexed voter, uint8 choice, uint256 weight);

    error BadConfig();
    error ZeroAmount();
    error IncomingMismatch();
    error Locked();
    error TooLittleStake();
    error BadPoll();
    error PollClosed();
    error AlreadyVoted();
    error AuthorBusy();
    error Reentered();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentered();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address token_, address dollar_, uint256 proposerMin_) {
        if (token_.code.length == 0 || dollar_.code.length == 0 || token_ == dollar_ || proposerMin_ == 0) revert BadConfig();
        token = IOscraCoin(token_);
        dollar = IOscraCoin(dollar_);
        proposerMin = proposerMin_;
    }

    // ------------------------------------------------------------------ revenue share

    /// Counts USDG that arrived since the last call and shares it across current stakers.
    function pour() public returns (uint256 fresh) {
        uint256 bal = dollar.balanceOf(address(this));
        if (bal <= tracked) return 0;
        fresh = bal - tracked;
        tracked = bal;
        totalPoured += fresh;
        if (totalStaked == 0) {
            queued += fresh;
            emit Poured(fresh, 0);
            return fresh;
        }
        uint256 amount = fresh + queued;
        queued = 0;
        accPerShare += (amount * ACC) / totalStaked;
        emit Poured(fresh, amount);
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        pour();
        _settle(msg.sender);
        uint256 before = token.balanceOf(address(this));
        token.pull(msg.sender, address(this), amount);
        uint256 got = token.balanceOf(address(this)) - before;
        if (got != amount) revert IncomingMismatch();
        bool first = totalStaked == 0;
        stakedOf[msg.sender] += got;
        totalStaked += got;
        _debt[msg.sender] = stakedOf[msg.sender] * accPerShare;
        // Fees that waited for a staker go to the stake that just arrived.
        if (first && queued != 0) {
            uint256 q = queued;
            queued = 0;
            accPerShare += (q * ACC) / totalStaked;
            emit Poured(0, q);
        }
        emit Staked(msg.sender, got);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0 || amount > stakedOf[msg.sender]) revert ZeroAmount();
        if (block.timestamp < lockedUntil[msg.sender]) revert Locked();
        pour();
        _settle(msg.sender);
        stakedOf[msg.sender] -= amount;
        totalStaked -= amount;
        _debt[msg.sender] = stakedOf[msg.sender] * accPerShare;
        token.send(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() external nonReentrant returns (uint256 amount) {
        pour();
        _settle(msg.sender);
        amount = _owed[msg.sender] / ACC;
        if (amount == 0) return 0;
        _owed[msg.sender] -= amount * ACC;
        tracked -= amount;
        dollar.send(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// USDG a staker can claim now (including fees that arrived but were not yet poured).
    function claimable(address account) external view returns (uint256) {
        uint256 acc = accPerShare;
        uint256 bal = dollar.balanceOf(address(this));
        if (bal > tracked && totalStaked != 0) acc += ((bal - tracked + queued) * ACC) / totalStaked;
        return (_owed[account] + stakedOf[account] * acc - _debt[account]) / ACC;
    }

    function _settle(address account) internal {
        uint256 due = stakedOf[account] * accPerShare;
        _owed[account] += due - _debt[account];
        _debt[account] = due;
    }

    // ------------------------------------------------------------------ polls

    function openPoll(string calldata title, string[] calldata choices, uint32 duration) external returns (uint256 id) {
        if (stakedOf[msg.sender] < proposerMin) revert TooLittleStake();
        if (block.timestamp < authorBusyUntil[msg.sender]) revert AuthorBusy();
        if (bytes(title).length == 0 || bytes(title).length > MAX_TITLE) revert BadPoll();
        if (choices.length < 2 || choices.length > 6) revert BadPoll();
        if (duration < MIN_POLL || duration > MAX_POLL) revert BadPoll();
        for (uint256 i; i < choices.length; ++i) {
            uint256 n = bytes(choices[i]).length;
            if (n == 0 || n > MAX_CHOICE) revert BadPoll();
        }
        uint64 end = uint64(block.timestamp) + duration;
        id = _polls.length;
        _polls.push(Poll({author: msg.sender, start: uint64(block.timestamp), end: end, choices: uint8(choices.length), topic: keccak256(abi.encode(title, choices))}));
        authorBusyUntil[msg.sender] = end;
        emit PollOpened(id, msg.sender, end, title, choices);
    }

    function vote(uint256 id, uint8 choice) external {
        if (id >= _polls.length) revert BadPoll();
        Poll memory p = _polls[id];
        if (block.timestamp >= p.end) revert PollClosed();
        if (choice >= p.choices) revert BadPoll();
        if (ballot[id][msg.sender] != 0) revert AlreadyVoted();
        uint256 weight = stakedOf[msg.sender];
        if (weight == 0) revert TooLittleStake();
        ballot[id][msg.sender] = choice + 1;
        tally[id][choice] += weight;
        if (lockedUntil[msg.sender] < p.end) lockedUntil[msg.sender] = p.end;
        emit Voted(id, msg.sender, choice, weight);
    }

    function pollCount() external view returns (uint256) {
        return _polls.length;
    }

    function pollAt(uint256 id) external view returns (Poll memory) {
        return _polls[id];
    }

    function tallies(uint256 id) external view returns (uint256[] memory out) {
        Poll memory p = _polls[id];
        out = new uint256[](p.choices);
        for (uint8 i; i < p.choices; ++i) out[i] = tally[id][i];
    }
}
