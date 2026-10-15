// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OscraBase} from "./OscraBase.sol";
import {OscraRunbook} from "../src/OscraRunbook.sol";
import {OscraWire} from "../src/OscraWire.sol";
import {OscraMockFeed} from "./OscraMocks.sol";

contract OscraRunbookTest is OscraBase {
    // ---------------------------------------------------------------- construction

    function test_constructorRejectsBadConfig() public {
        OscraRunbook.LaneInput[] memory none = new OscraRunbook.LaneInput[](0);
        vm.expectRevert(OscraRunbook.BadConfig.selector);
        new OscraRunbook(address(usd), address(router), none, 20, 10, 0);

        OscraRunbook.LaneInput[] memory one = new OscraRunbook.LaneInput[](1);
        one[0] = OscraRunbook.LaneInput({asset: address(weth), poolFee: 100, feed: address(ethFeed), maxAge: 1 days});
        vm.expectRevert(OscraRunbook.BadConfig.selector);
        new OscraRunbook(address(usd), address(router), one, 101, 10, 0); // fee above 1%
        vm.expectRevert(OscraRunbook.BadConfig.selector);
        new OscraRunbook(address(usd), address(router), one, 20, 30, 0); // holder fee above fee

        OscraRunbook.LaneInput[] memory twice = new OscraRunbook.LaneInput[](2);
        twice[0] = one[0];
        twice[1] = one[0];
        vm.expectRevert(OscraRunbook.BadConfig.selector);
        new OscraRunbook(address(usd), address(router), twice, 20, 10, 0);

        one[0].asset = address(usd);
        vm.expectRevert(OscraRunbook.BadConfig.selector);
        new OscraRunbook(address(usd), address(router), one, 20, 10, 0);
    }

    function test_lanesAreReadable() public view {
        assertEq(book.laneCount(), 2);
        OscraRunbook.Lane memory l = book.laneAt(1);
        assertEq(l.asset, address(nvda));
        assertEq(l.poolFee, 500);
        assertEq(l.assetUnit, 1e18);
        assertEq(l.feedUnit, 1e8);
        assertEq(book.priceOf(0), ETH_PX);
        assertEq(book.minSpend(), 1e6);
    }

    // ---------------------------------------------------------------- plans

    function test_openPlanValidates() public {
        vm.startPrank(alice);
        OscraRunbook.PlanTerms memory t = terms(0, 50e6, 1 days, 500e6);
        t.lane = 2;
        vm.expectRevert(OscraRunbook.BadLane.selector);
        book.openPlan(t);
        t = terms(0, 0.5e6, 1 days, 500e6);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.openPlan(t);
        t = terms(0, 50e6, 30 minutes, 500e6);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.openPlan(t);
        t = terms(0, 50e6, 1 days, 40e6);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.openPlan(t);
        t = terms(0, 50e6, 1 days, 500e6);
        t.slipBps = 10;
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.openPlan(t);
        t.slipBps = 100;
        t.tip = 6e6; // more than a tenth of 50
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.openPlan(t);
        vm.stopPrank();
    }

    function test_runPlanBuysAndDeliversToOwner() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 days, 300e6));
        uint256 usdBefore = usd.balanceOf(alice);
        vm.prank(alice);
        OscraRunbook.Outcome o = book.runPlan(id);
        assertEq(uint256(o), uint256(OscraRunbook.Outcome.Filled));
        assertEq(usdBefore - usd.balanceOf(alice), 100e6);
        assertEq(weth.balanceOf(alice), 0.05e18); // $100 at $2,000
        assertEq(usd.balanceOf(address(book)), 0);
        assertEq(weth.balanceOf(address(book)), 0);
        OscraRunbook.Plan memory p = book.planAt(id);
        assertEq(p.spent, 100e6);
        assertEq(p.bought, 0.05e18);
        assertEq(p.buys, 1);
        assertEq(p.nextAt, block.timestamp + 1 days);
        assertEq(book.averageEntry(id), ETH_PX);
    }

    function test_runPlanRespectsInterval() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 days, 300e6));
        book.runPlan(id);
        vm.expectRevert(OscraRunbook.NotDue.selector);
        book.runPlan(id);
        vm.warp(block.timestamp + 1 days);
        setPrices(ETH_PX, NVDA_PX);
        book.runPlan(id);
    }

    function test_startAtDelaysFirstBuy() public {
        OscraRunbook.PlanTerms memory t = terms(0, 100e6, 1 days, 300e6);
        t.startAt = uint64(block.timestamp + 3 hours);
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        vm.expectRevert(OscraRunbook.NotDue.selector);
        book.runPlan(id);
        vm.warp(block.timestamp + 3 hours);
        book.runPlan(id);
    }

    function test_keeperEarnsTipOwnerDoesNot() public {
        OscraRunbook.PlanTerms memory t = terms(0, 100e6, 1 days, 300e6);
        t.tip = 0.5e6;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        vm.prank(keeper);
        book.runPlan(id);
        assertEq(usd.balanceOf(keeper), 0.5e6);
        OscraRunbook.Plan memory p = book.planAt(id);
        assertEq(p.netIn, 99.5e6);
        vm.warp(block.timestamp + 1 days);
        setPrices(ETH_PX, NVDA_PX);
        vm.prank(alice);
        book.runPlan(id);
        assertEq(usd.balanceOf(keeper), 0.5e6);
    }

    function test_ceilingBlocksBuy() public {
        OscraRunbook.PlanTerms memory t = terms(0, 100e6, 1 days, 300e6);
        t.ceiling = 1_900e8;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        vm.expectRevert(OscraRunbook.AboveCeiling.selector);
        book.runPlan(id);
        setPrices(1_850e8, NVDA_PX);
        book.runPlan(id);
    }

    function test_guardPausesAfterDrawdown() public {
        OscraRunbook.PlanTerms memory t = terms(0, 100e6, 1 days, 500e6);
        t.guardBps = 1_500; // pause 15% under the average entry
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        book.runPlan(id);
        vm.warp(block.timestamp + 1 days);
        setPrices(1_600e8, NVDA_PX); // -20%
        OscraRunbook.Outcome o = book.runPlan(id);
        assertEq(uint256(o), uint256(OscraRunbook.Outcome.Guarded));
        assertEq(uint256(book.planAt(id).state), uint256(OscraRunbook.PlanState.Guarded));
        assertEq(book.planAt(id).buys, 1);
        vm.expectRevert(OscraRunbook.NotActive.selector);
        book.runPlan(id);
        vm.prank(alice);
        book.resumePlan(id);
        book.runPlan(id); // owner reviewed: the guard checks the new average next time
    }

    function test_targetPausesAfterGain() public {
        OscraRunbook.PlanTerms memory t = terms(0, 100e6, 1 days, 500e6);
        t.targetBps = 2_500;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        book.runPlan(id);
        vm.warp(block.timestamp + 1 days);
        setPrices(2_500e8, NVDA_PX);
        assertEq(uint256(book.runPlan(id)), uint256(OscraRunbook.Outcome.Targeted));
        assertEq(uint256(book.planAt(id).state), uint256(OscraRunbook.PlanState.Targeted));
    }

    function test_budgetRunsOutThenTuneRevives() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 250e6));
        book.runPlan(id);
        vm.warp(block.timestamp + 1 hours);
        book.runPlan(id);
        vm.warp(block.timestamp + 1 hours);
        book.runPlan(id); // last 50
        OscraRunbook.Plan memory p = book.planAt(id);
        assertEq(p.spent, 250e6);
        assertEq(uint256(p.state), uint256(OscraRunbook.PlanState.Spent));
        vm.prank(alice);
        book.tunePlan(id, terms(0, 100e6, 1 hours, 400e6));
        assertEq(uint256(book.planAt(id).state), uint256(OscraRunbook.PlanState.Active));
        vm.warp(block.timestamp + 1 hours);
        book.runPlan(id);
        assertEq(book.planAt(id).spent, 350e6);
    }

    function test_tuneCannotChangeLaneOrCutBelowSpent() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        book.runPlan(id);
        vm.startPrank(alice);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.tunePlan(id, terms(1, 100e6, 1 hours, 500e6));
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.tunePlan(id, terms(0, 50e6, 1 hours, 60e6));
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(OscraRunbook.NotOwner.selector);
        book.tunePlan(id, terms(0, 100e6, 1 hours, 500e6));
    }

    function test_holdResumeClose() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        vm.prank(bob);
        vm.expectRevert(OscraRunbook.NotOwner.selector);
        book.holdPlan(id);
        vm.prank(alice);
        book.holdPlan(id);
        vm.expectRevert(OscraRunbook.NotActive.selector);
        book.runPlan(id);
        vm.prank(alice);
        book.resumePlan(id);
        book.runPlan(id);
        vm.prank(alice);
        book.closePlan(id);
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(OscraRunbook.NotActive.selector);
        book.runPlan(id);
        vm.prank(alice);
        vm.expectRevert(OscraRunbook.NotActive.selector);
        book.resumePlan(id);
    }

    function test_revokedAllowanceStopsEverything() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        vm.prank(alice);
        usd.approve(address(book), 0);
        vm.expectRevert(OscraWire.OscraWireFailed.selector);
        book.runPlan(id);
    }

    function test_stalePriceReverts() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(OscraRunbook.StalePrice.selector);
        book.runPlan(id);
        ethFeed.set(0, block.timestamp);
        vm.expectRevert(OscraRunbook.StalePrice.selector);
        book.runPlan(id);
    }

    function test_badPoolPriceReverts() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        router.setHaircut(150); // pool pays 1.5% less than the feed implies; plan allows 1%
        vm.expectRevert(bytes("Too little received"));
        book.runPlan(id);
        router.setHaircut(50);
        book.runPlan(id);
    }

    function test_feeOnTransferDollarRejected() public {
        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        usd.setSkim(10);
        vm.expectRevert(OscraRunbook.IncomingMismatch.selector);
        book.runPlan(id);
    }

    // ---------------------------------------------------------------- fees and binding

    function test_noFeeBeforeBind() public view {
        assertEq(book.feeRateOf(alice), 0);
    }

    function test_bindOnlyOnceOnlyBinder() public {
        vm.prank(alice);
        vm.expectRevert(OscraRunbook.NotBinder.selector);
        book.bind(address(keel));
        bindKeel();
        vm.expectRevert(OscraRunbook.AlreadyBound.selector);
        book.bind(address(keel));
        assertEq(book.sinkToken(), address(oscra));
    }

    function test_feeGoesToStakersAndHoldersPayLess() public {
        bindKeel();
        oscra.mint(bob, 1_000e18);
        vm.startPrank(bob);
        oscra.approve(address(keel), type(uint256).max);
        keel.stake(400e18);
        vm.stopPrank();
        assertEq(book.feeRateOf(alice), 20);
        assertEq(book.feeRateOf(bob), 10); // 600 held + 400 staked = holderMin

        vm.prank(alice);
        uint256 id = book.openPlan(terms(0, 100e6, 1 hours, 500e6));
        book.runPlan(id);
        assertEq(usd.balanceOf(address(keel)), 0.2e6);
        assertEq(keel.claimable(bob), 0.2e6);
        vm.prank(bob);
        assertEq(keel.claim(), 0.2e6);

        vm.prank(bob);
        uint256 id2 = book.openPlan(terms(1, 100e6, 1 hours, 500e6));
        book.runPlan(id2);
        assertEq(book.planAt(id2).netIn, 99.9e6);
    }

    // ---------------------------------------------------------------- desks and follows

    function test_postStoresFeedPrice() public {
        vm.prank(desk);
        uint256 id = book.post(1, false, 5_000);
        OscraRunbook.Signal memory s = book.signalAt(id);
        assertEq(s.leader, desk);
        assertEq(s.price, NVDA_PX);
        assertEq(s.weightBps, 5_000);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.post(1, false, 0);
        vm.expectRevert(OscraRunbook.BadLane.selector);
        book.post(5, false, 100);
    }

    function test_followValidates() public {
        vm.startPrank(alice);
        OscraRunbook.FollowTerms memory t = followTerms(100e6, 50e6);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.follow(desk, t);
        t = followTerms(100e6, 300e6);
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.follow(alice, t);
        t.laneMask = 4;
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.follow(desk, t);
        t = followTerms(100e6, 300e6);
        t.reviewDelay = 3 days;
        vm.expectRevert(OscraRunbook.BadTerms.selector);
        book.follow(desk, t);
        vm.stopPrank();
    }

    function _followAndPost(bool sell, uint16 weight) internal returns (uint256 id) {
        vm.prank(alice);
        book.follow(desk, followTerms(100e6, 300e6));
        vm.warp(block.timestamp + 1);
        setPrices(ETH_PX, NVDA_PX);
        vm.prank(desk);
        id = book.post(1, sell, weight);
    }

    function test_mirrorWaitsForReviewDelayAndWindow() public {
        uint256 id = _followAndPost(false, 10_000);
        vm.expectRevert(OscraRunbook.OutsideWindow.selector);
        book.mirror(alice, id);
        vm.warp(block.timestamp + 1 hours);
        book.mirror(alice, id);
        assertEq(nvda.balanceOf(alice), 0.5e18); // $100 at $200
        (uint128 qty, uint128 cost) = book.holdings(alice, desk, 1);
        assertEq(qty, 0.5e18);
        assertEq(cost, 100e6);
        vm.expectRevert(OscraRunbook.AlreadyHandled.selector);
        book.mirror(alice, id);
    }

    function test_mirrorWindowCloses() public {
        uint256 id = _followAndPost(false, 10_000);
        vm.warp(block.timestamp + 1 hours + 6 hours + 1);
        setPrices(ETH_PX, NVDA_PX);
        vm.expectRevert(OscraRunbook.OutsideWindow.selector);
        book.mirror(alice, id);
    }

    function test_skipVetoesIdea() public {
        uint256 id = _followAndPost(false, 10_000);
        vm.prank(alice);
        book.skip(id);
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(OscraRunbook.AlreadyHandled.selector);
        book.mirror(alice, id);
    }

    function test_priorIdeasAreNotCopied() public {
        vm.prank(desk);
        uint256 old = book.post(1, false, 10_000);
        vm.warp(block.timestamp + 1);
        vm.prank(alice);
        book.follow(desk, followTerms(100e6, 300e6));
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        vm.expectRevert(OscraRunbook.NotFollowing.selector);
        book.mirror(alice, old);
    }

    function test_chaseLimitSkipsRunaway() public {
        uint256 id = _followAndPost(false, 10_000);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, 205e8); // +2.5% vs desk price, limit 2%
        vm.expectRevert(OscraRunbook.PriceMoved.selector);
        book.mirror(alice, id);
    }

    function test_dayCapAndPositionCap() public {
        OscraRunbook.FollowTerms memory t = followTerms(100e6, 150e6);
        t.maxCost = 250e6;
        vm.prank(alice);
        book.follow(desk, t);
        vm.warp(block.timestamp + 1);
        setPrices(ETH_PX, NVDA_PX);
        vm.startPrank(desk);
        uint256 a = book.post(1, false, 10_000);
        uint256 b = book.post(1, false, 10_000);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        book.mirror(alice, a);
        vm.expectRevert(OscraRunbook.DayCapReached.selector);
        book.mirror(alice, b);
        // next day: day cap resets, position cap still holds
        vm.warp(block.timestamp + 1 days);
        setPrices(ETH_PX, NVDA_PX);
        vm.startPrank(desk);
        uint256 c = book.post(1, false, 10_000);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        book.mirror(alice, c);
        vm.warp(block.timestamp + 1 days);
        setPrices(ETH_PX, NVDA_PX);
        vm.prank(desk);
        uint256 d = book.post(1, false, 10_000);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        vm.expectRevert(OscraRunbook.PositionCapReached.selector);
        book.mirror(alice, d);
    }

    function test_laneMaskFilters() public {
        OscraRunbook.FollowTerms memory t = followTerms(100e6, 300e6);
        t.laneMask = 1; // WETH only
        vm.prank(alice);
        book.follow(desk, t);
        vm.warp(block.timestamp + 1);
        vm.prank(desk);
        uint256 id = book.post(1, false, 10_000);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        vm.expectRevert(OscraRunbook.NotFollowing.selector);
        book.mirror(alice, id);
    }

    function test_sellMirrorSellsShareOfCopiedPosition() public {
        uint256 buy = _followAndPost(false, 10_000);
        vm.warp(block.timestamp + 1 hours);
        book.mirror(alice, buy);
        vm.prank(alice);
        nvda.approve(address(book), type(uint256).max);
        setPrices(ETH_PX, 220e8);
        vm.prank(desk);
        uint256 sell = book.post(1, true, 5_000);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, 220e8);
        uint256 usdBefore = usd.balanceOf(alice);
        vm.prank(keeper);
        book.mirror(alice, sell);
        assertEq(nvda.balanceOf(alice), 0.25e18);
        assertEq(usd.balanceOf(alice) - usdBefore, 55e6); // 0.25 x $220, no tip set, no fee before bind
        (uint128 qty, uint128 cost) = book.holdings(alice, desk, 1);
        assertEq(qty, 0.25e18);
        assertEq(cost, 50e6);
        assertEq(usd.balanceOf(address(book)), 0);
        assertEq(nvda.balanceOf(address(book)), 0);
    }

    function test_sellWithoutPositionReverts() public {
        uint256 id = _followAndPost(true, 5_000);
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(OscraRunbook.NothingToSell.selector);
        book.mirror(alice, id);
    }

    function test_stopHaltsFollowAfterDrawdown() public {
        OscraRunbook.FollowTerms memory t = followTerms(100e6, 300e6);
        t.stopBps = 1_000;
        vm.prank(alice);
        book.follow(desk, t);
        vm.warp(block.timestamp + 1);
        vm.prank(desk);
        uint256 a = book.post(1, false, 10_000);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        book.mirror(alice, a);
        setPrices(ETH_PX, 170e8); // copied position down 15%
        vm.prank(desk);
        uint256 b = book.post(1, false, 10_000);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, 170e8);
        assertEq(uint256(book.mirror(alice, b)), uint256(OscraRunbook.Outcome.Stopped));
        assertFalse(book.followOf(alice, desk).active);
    }

    function test_unfollowStopsCopies() public {
        uint256 id = _followAndPost(false, 10_000);
        vm.prank(alice);
        book.unfollow(desk);
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(OscraRunbook.NotFollowing.selector);
        book.mirror(alice, id);
        address[] memory d = book.desksOf(alice);
        assertEq(d.length, 1);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_planNeverOverspendsOrHolds(uint128 perBuy, uint128 budget, uint64 px, uint8 runs) public {
        perBuy = uint128(bound(perBuy, 1e6, 50_000e6));
        budget = uint128(bound(budget, perBuy, 200_000e6));
        px = uint64(bound(px, 1e8, 100_000e8));
        runs = uint8(bound(runs, 1, 12));
        setPrices(px, NVDA_PX);
        OscraRunbook.PlanTerms memory t = terms(0, perBuy, 1 hours, budget);
        t.tip = perBuy / 20;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        uint256 start = usd.balanceOf(alice);
        for (uint256 i; i < runs; ++i) {
            if (book.planAt(id).state != OscraRunbook.PlanState.Active) break;
            vm.prank(keeper);
            book.runPlan(id);
            vm.warp(block.timestamp + 1 hours);
            setPrices(px, NVDA_PX);
        }
        OscraRunbook.Plan memory p = book.planAt(id);
        assertLe(p.spent, p.budget);
        assertEq(start - usd.balanceOf(alice), p.spent);
        assertEq(usd.balanceOf(address(book)), 0);
        assertEq(weth.balanceOf(address(book)), 0);
        assertEq(weth.balanceOf(alice), p.bought);
        assertEq(p.netIn + usd.balanceOf(keeper), p.spent);
    }

    function testFuzz_minOutHolds(uint64 px, uint16 haircut, uint16 slip) public {
        px = uint64(bound(px, 1e8, 100_000e8));
        haircut = uint16(bound(haircut, 0, 900));
        slip = uint16(bound(slip, 50, 500));
        setPrices(px, NVDA_PX);
        router.setHaircut(haircut);
        OscraRunbook.PlanTerms memory t = terms(0, 1_000e6, 1 hours, 1_000e6);
        t.slipBps = slip;
        vm.prank(alice);
        uint256 id = book.openPlan(t);
        uint256 fair = (uint256(1_000e6) * 1e18 * 1e8) / (uint256(px) * 1e6);
        if (haircut > slip) {
            vm.expectRevert();
            book.runPlan(id);
        } else {
            book.runPlan(id);
            assertGe(weth.balanceOf(alice), (fair * (10_000 - slip)) / 10_000);
        }
    }

    function testFuzz_mirrorBuyRespectsCaps(uint128 perSignal, uint16 weight, uint128 dayCap) public {
        perSignal = uint128(bound(perSignal, 1e6, 10_000e6));
        weight = uint16(bound(weight, 1, 10_000));
        dayCap = uint128(bound(dayCap, perSignal, 30_000e6));
        OscraRunbook.FollowTerms memory t = followTerms(perSignal, dayCap);
        vm.prank(alice);
        book.follow(desk, t);
        vm.warp(block.timestamp + 1);
        vm.prank(desk);
        uint256 id = book.post(1, false, weight);
        vm.warp(block.timestamp + 1 hours);
        setPrices(ETH_PX, NVDA_PX);
        uint256 gross = (uint256(perSignal) * weight) / 10_000;
        uint256 before = usd.balanceOf(alice);
        if (gross < 1e6) {
            vm.expectRevert(OscraRunbook.AmountTooSmall.selector);
            book.mirror(alice, id);
        } else {
            book.mirror(alice, id);
            assertEq(before - usd.balanceOf(alice), gross);
            assertLe(gross, dayCap);
        }
        assertEq(usd.balanceOf(address(book)), 0);
    }
}

/// A feed that always reverts, to check the Runbook refuses a lane it cannot price.
contract OscraBrokenFeedTest is OscraBase {
    function test_postRevertsOnStaleFeed() public {
        vm.warp(block.timestamp + 5 days);
        vm.prank(desk);
        vm.expectRevert(OscraRunbook.StalePrice.selector);
        book.post(1, false, 100);
        OscraMockFeed f = nvdaFeed;
        f.set(int256(NVDA_PX), block.timestamp + 10); // future timestamp
        vm.expectRevert(OscraRunbook.StalePrice.selector);
        book.priceOf(1);
    }
}
