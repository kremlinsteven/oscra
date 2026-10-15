// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OscraBase} from "./OscraBase.sol";
import {OscraRunbook} from "../src/OscraRunbook.sol";
import {OscraKeel} from "../src/OscraKeel.sol";
import {OscraMockCoin, OscraMockFeed, OscraMockRouter} from "./OscraMocks.sol";

/// Random plans, runs, follows, posts, mirrors, stakes and claims.
contract OscraHandler is Test {
    OscraRunbook internal book;
    OscraKeel internal keel;
    OscraMockCoin internal usd;
    OscraMockCoin internal nvda;
    OscraMockCoin internal oscra;
    OscraMockFeed internal ethFeed;
    OscraMockFeed internal nvdaFeed;
    OscraMockRouter internal router;
    address[] internal actors;
    uint256 public pulledFromWallets;
    uint256 public tipsPaid;

    constructor(OscraBase.Kit memory k, address[] memory actors_) {
        book = k.book;
        keel = k.keel;
        usd = k.usd;
        nvda = k.nvda;
        oscra = k.oscra;
        ethFeed = k.ethFeed;
        nvdaFeed = k.nvdaFeed;
        router = k.router;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _fresh() internal {
        ethFeed.set(ethFeed.answer(), block.timestamp);
        nvdaFeed.set(nvdaFeed.answer(), block.timestamp);
    }

    function open(uint256 seed, uint128 perBuy, uint128 budget, uint8 laneId) external {
        perBuy = uint128(bound(perBuy, 1e6, 5_000e6));
        budget = uint128(bound(budget, perBuy, 20_000e6));
        OscraRunbook.PlanTerms memory t;
        t.lane = laneId % 2;
        t.perBuy = perBuy;
        t.budget = budget;
        t.interval = 1 hours;
        t.slipBps = 200;
        t.tip = perBuy / 20;
        vm.prank(_actor(seed));
        book.openPlan(t);
    }

    function run(uint256 id, uint256 callerSeed) external {
        uint256 n = book.planCount();
        if (n == 0) return;
        id = id % n;
        _fresh();
        address caller = _actor(callerSeed);
        uint256 before = usd.balanceOf(caller);
        uint256 spentBefore = book.planAt(id).spent;
        vm.prank(caller);
        try book.runPlan(id) {
            uint256 spent = book.planAt(id).spent - spentBefore;
            pulledFromWallets += spent;
            if (caller != book.planAt(id).owner) tipsPaid += usd.balanceOf(caller) - before;
        } catch {}
    }

    function move(int64 ethMove, int64 nvdaMove, uint32 dt) external {
        dt = uint32(bound(dt, 0, 3 days));
        vm.warp(block.timestamp + dt);
        int256 e = ethFeed.answer() + int256(bound(ethMove, -200e8, 200e8));
        int256 v = nvdaFeed.answer() + int256(bound(nvdaMove, -20e8, 20e8));
        if (e < 100e8) e = 100e8;
        if (v < 10e8) v = 10e8;
        ethFeed.set(e, block.timestamp);
        nvdaFeed.set(v, block.timestamp);
        router.setPrice(address(nvda), uint256(v));
        router.setPrice(_wethOf(), uint256(e));
    }

    function _wethOf() internal view returns (address) {
        return book.laneAt(0).asset;
    }

    function follow(uint256 seed, uint256 leaderSeed, uint128 perSignal) external {
        address f = _actor(seed);
        address l = _actor(leaderSeed);
        if (f == l) return;
        perSignal = uint128(bound(perSignal, 1e6, 2_000e6));
        OscraRunbook.FollowTerms memory t;
        t.perSignal = perSignal;
        t.dayCap = perSignal * 3;
        t.laneMask = 3;
        t.slipBps = 200;
        t.chaseBps = 2_000;
        t.tip = perSignal / 20;
        vm.prank(f);
        book.follow(l, t);
    }

    function post(uint256 seed, bool sell, uint16 weight, uint8 laneId) external {
        _fresh();
        weight = uint16(bound(weight, 1, 10_000));
        vm.prank(_actor(seed));
        book.post(laneId % 2, sell, weight);
    }

    function mirror(uint256 followerSeed, uint256 signalId, uint256 callerSeed) external {
        uint256 n = book.signalCount();
        if (n == 0) return;
        _fresh();
        vm.prank(_actor(callerSeed));
        try book.mirror(_actor(followerSeed), signalId % n) {} catch {}
    }

    function stake(uint256 seed, uint96 amount) external {
        amount = uint96(bound(amount, 1, 1_000e18));
        vm.prank(_actor(seed));
        keel.stake(amount);
    }

    function claim(uint256 seed) external {
        vm.prank(_actor(seed));
        keel.claim();
    }
}

contract OscraInvariantTest is OscraBase {
    OscraHandler internal handler;

    function setUp() public override {
        super.setUp();
        bindKeel();
        address[] memory actors = new address[](3);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = desk;
        for (uint256 i; i < 3; ++i) {
            oscra.mint(actors[i], 100_000e18);
            vm.startPrank(actors[i]);
            oscra.approve(address(keel), type(uint256).max);
            weth.approve(address(book), type(uint256).max);
            nvda.approve(address(book), type(uint256).max);
            vm.stopPrank();
        }
        handler = new OscraHandler(kit(), actors);
        targetContract(address(handler));
    }

    /// The Runbook never keeps dollars or assets between calls.
    function invariant_runbookHoldsNothing() public view {
        assertEq(usd.balanceOf(address(book)), 0);
        assertEq(weth.balanceOf(address(book)), 0);
        assertEq(nvda.balanceOf(address(book)), 0);
    }

    /// Every plan stays within its budget.
    function invariant_plansWithinBudget() public view {
        uint256 n = book.planCount();
        for (uint256 i; i < n; ++i) {
            OscraRunbook.Plan memory p = book.planAt(i);
            assertLe(p.spent, p.budget);
            assertLe(p.netIn, p.spent);
        }
    }

    /// The Keel can always pay every staker what it shows as claimable.
    function invariant_keelSolvent() public view {
        uint256 owed = keel.claimable(alice) + keel.claimable(bob) + keel.claimable(desk);
        assertLe(owed, usd.balanceOf(address(keel)));
        assertEq(oscra.balanceOf(address(keel)), keel.totalStaked());
    }
}
