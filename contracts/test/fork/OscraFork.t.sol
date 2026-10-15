// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OscraRunbook} from "../../src/OscraRunbook.sol";
import {OscraKeel} from "../../src/OscraKeel.sol";
import {IOscraCoin, IOscraSwapRouter} from "../../src/OscraWire.sol";
import {OscraMockCoin} from "../OscraMocks.sol";

interface IOscraWeth {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
}

/**
 * Runs against Robinhood Chain mainnet state:
 *   forge test --match-path 'test/fork/*' --fork-url https://rpc.mainnet.chain.robinhood.com --evm-version cancun
 * Real USDG, WETH, official stock tokens (beacon proxies), Uniswap v3 SwapRouter02 and Chainlink feeds.
 */
contract OscraForkTest is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant ETH_FEED = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant NVDA_FEED = 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant TSLA_FEED = 0x4A1166a659A55625345e9515b32adECea5547C38;

    OscraRunbook book;
    address alice = makeAddr("alice");
    address desk = makeAddr("desk");
    address keeper = makeAddr("keeper");

    function setUp() public {
        if (block.chainid != 4663) return;
        OscraRunbook.LaneInput[] memory lanes = new OscraRunbook.LaneInput[](3);
        lanes[0] = OscraRunbook.LaneInput({asset: WETH, poolFee: 100, feed: ETH_FEED, maxAge: 93_600});
        lanes[1] = OscraRunbook.LaneInput({asset: NVDA, poolFee: 500, feed: NVDA_FEED, maxAge: 345_600});
        lanes[2] = OscraRunbook.LaneInput({asset: TSLA, poolFee: 3000, feed: TSLA_FEED, maxAge: 345_600});
        book = new OscraRunbook(USDG, ROUTER, lanes, 20, 10, 250_000e18);
        _fundUsdg(alice, 5 ether);
        vm.prank(alice);
        IOscraCoin(USDG).approve(address(book), type(uint256).max);
    }

    /// Wraps ETH and sells it for USDG on the real WETH/USDG pool.
    function _fundUsdg(address who, uint256 eth) internal {
        vm.deal(who, eth);
        vm.startPrank(who);
        IOscraWeth(WETH).deposit{value: eth}();
        IOscraWeth(WETH).approve(ROUTER, eth);
        IOscraSwapRouter(ROUTER).exactInputSingle(
            IOscraSwapRouter.ExactInputSingleParams({tokenIn: WETH, tokenOut: USDG, fee: 100, recipient: who, amountIn: eth, amountOutMinimum: 1, sqrtPriceLimitX96: 0})
        );
        vm.stopPrank();
    }

    function _skipOffChain() internal view returns (bool) {
        return block.chainid != 4663;
    }

    function test_fork_lanesReadRealFeeds() public view {
        if (_skipOffChain()) return;
        assertEq(book.laneCount(), 3);
        assertEq(book.dollarUnit(), 1e6);
        uint256 eth = book.priceOf(0);
        assertGt(eth, 100e8);
        assertLt(eth, 100_000e8);
        assertGt(book.priceOf(1), 1e8);
        assertEq(book.laneAt(1).assetUnit, 1e18);
    }

    function test_fork_planBuysRealNvdaAndEth() public {
        if (_skipOffChain()) return;
        OscraRunbook.PlanTerms memory t;
        t.lane = 1;
        t.perBuy = 100e6;
        t.interval = 1 days;
        t.budget = 300e6;
        t.slipBps = 150;
        t.tip = 1e6;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        uint256 before = IOscraCoin(NVDA).balanceOf(alice);
        vm.prank(keeper);
        book.runPlan(id);
        uint256 got = IOscraCoin(NVDA).balanceOf(alice) - before;
        assertGt(got, 0);
        assertEq(IOscraCoin(USDG).balanceOf(keeper), 1e6);
        assertEq(IOscraCoin(USDG).balanceOf(address(book)), 0);
        assertEq(IOscraCoin(NVDA).balanceOf(address(book)), 0);
        // Average entry within the slippage band of the feed.
        uint256 avg = book.averageEntry(id);
        uint256 px = book.priceOf(1);
        assertLe(avg, (px * 10_150) / 10_000);
        assertGe(avg, (px * 9_000) / 10_000);

        t.lane = 0;
        vm.prank(alice);
        uint256 e = book.openPlan(t);
        uint256 w = IOscraCoin(WETH).balanceOf(alice);
        vm.prank(alice);
        book.runPlan(e);
        assertGt(IOscraCoin(WETH).balanceOf(alice), w);
    }

    function test_fork_copyBuyThenSellOnTsla() public {
        if (_skipOffChain()) return;
        OscraRunbook.FollowTerms memory f;
        f.perSignal = 200e6;
        f.dayCap = 1_000e6;
        f.laneMask = 7;
        f.reviewDelay = 0;
        f.slipBps = 200;
        f.chaseBps = 500;
        vm.prank(alice);
        book.follow(desk, f);
        vm.warp(block.timestamp + 1);
        vm.prank(desk);
        uint256 buy = book.post(2, false, 10_000);
        book.mirror(alice, buy);
        (uint128 qty, uint128 cost) = book.holdings(alice, desk, 2);
        assertGt(qty, 0);
        assertEq(cost, 200e6);
        assertEq(IOscraCoin(TSLA).balanceOf(alice), qty);

        vm.prank(alice);
        IOscraCoin(TSLA).approve(address(book), type(uint256).max);
        vm.prank(desk);
        uint256 sell = book.post(2, true, 10_000);
        uint256 usdBefore = IOscraCoin(USDG).balanceOf(alice);
        book.mirror(alice, sell);
        uint256 back = IOscraCoin(USDG).balanceOf(alice) - usdBefore;
        assertGt(back, 190e6); // round trip through a 0.3% pool twice, inside the 2% limit
        (qty,) = book.holdings(alice, desk, 2);
        assertEq(qty, 0);
        assertEq(IOscraCoin(TSLA).balanceOf(address(book)), 0);
        assertEq(IOscraCoin(USDG).balanceOf(address(book)), 0);
    }

    function test_fork_feesReachStakersAfterBind() public {
        if (_skipOffChain()) return;
        OscraMockCoin token = new OscraMockCoin("OSCRA", 18);
        OscraKeel keel = new OscraKeel(address(token), USDG, 100_000e18);
        book.bind(address(keel));
        token.mint(desk, 1_000_000e18);
        vm.startPrank(desk);
        token.approve(address(keel), type(uint256).max);
        keel.stake(500_000e18);
        vm.stopPrank();
        OscraRunbook.PlanTerms memory t;
        t.lane = 0;
        t.perBuy = 500e6;
        t.interval = 1 days;
        t.budget = 500e6;
        t.slipBps = 100;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        vm.prank(alice);
        book.runPlan(id);
        assertEq(keel.claimable(desk), 1e6); // 0.20% of 500
        vm.prank(desk);
        keel.claim();
        assertEq(IOscraCoin(USDG).balanceOf(desk), 1e6);
    }
}
