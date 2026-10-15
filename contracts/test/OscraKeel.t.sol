// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OscraBase} from "./OscraBase.sol";
import {OscraKeel} from "../src/OscraKeel.sol";

contract OscraKeelTest is OscraBase {
    address internal carol = address(0xCA201);

    function setUp() public override {
        super.setUp();
        for (uint256 i; i < 3; ++i) {
            address who = [alice, bob, carol][i];
            oscra.mint(who, 10_000e18);
            vm.prank(who);
            oscra.approve(address(keel), type(uint256).max);
        }
    }

    function _fee(uint256 amount) internal {
        usd.mint(address(keel), amount);
        keel.pour();
    }

    function test_constructorChecks() public {
        vm.expectRevert(OscraKeel.BadConfig.selector);
        new OscraKeel(address(usd), address(usd), 1);
        vm.expectRevert(OscraKeel.BadConfig.selector);
        new OscraKeel(address(oscra), address(usd), 0);
    }

    function test_feesSplitByStake() public {
        vm.prank(alice);
        keel.stake(300e18);
        vm.prank(bob);
        keel.stake(100e18);
        _fee(40e6);
        assertEq(keel.claimable(alice), 30e6);
        assertEq(keel.claimable(bob), 10e6);
        vm.prank(alice);
        assertEq(keel.claim(), 30e6);
        assertEq(usd.balanceOf(alice), 1_000_030e6);
    }

    function test_lateStakerGetsNoPastFees() public {
        vm.prank(alice);
        keel.stake(100e18);
        _fee(10e6);
        vm.prank(bob);
        keel.stake(100e18);
        assertEq(keel.claimable(bob), 0);
        _fee(10e6);
        assertEq(keel.claimable(alice), 15e6);
        assertEq(keel.claimable(bob), 5e6);
    }

    function test_feesBeforeAnyStakeWaitForFirstStaker() public {
        _fee(7e6);
        assertEq(keel.queued(), 7e6);
        vm.prank(carol);
        keel.stake(1e18);
        assertEq(keel.queued(), 0);
        assertEq(keel.claimable(carol), 7e6);
    }

    function test_unpouredFeesShowInClaimable() public {
        vm.prank(alice);
        keel.stake(100e18);
        usd.mint(address(keel), 5e6); // not poured yet
        assertEq(keel.claimable(alice), 5e6);
        vm.prank(alice);
        assertEq(keel.claim(), 5e6);
    }

    function test_unstakeReturnsTokensAndKeepsOwed() public {
        vm.prank(alice);
        keel.stake(100e18);
        _fee(10e6);
        vm.prank(alice);
        keel.unstake(100e18);
        assertEq(oscra.balanceOf(alice), 10_000e18);
        assertEq(keel.claimable(alice), 10e6);
        vm.prank(alice);
        keel.claim();
        assertEq(keel.claimable(alice), 0);
    }

    function test_pollRulesAndLock() public {
        vm.prank(alice);
        keel.stake(50e18);
        string[] memory choices = new string[](2);
        choices[0] = "Add AMD lane";
        choices[1] = "Keep the list";
        vm.prank(alice);
        vm.expectRevert(OscraKeel.TooLittleStake.selector);
        keel.openPoll("Next lane", choices, 3 days);

        vm.prank(bob);
        keel.stake(200e18);
        vm.prank(bob);
        uint256 id = keel.openPoll("Next lane", choices, 3 days);
        vm.prank(bob);
        vm.expectRevert(OscraKeel.AuthorBusy.selector);
        keel.openPoll("Another", choices, 3 days);

        vm.prank(alice);
        keel.vote(id, 0);
        vm.prank(bob);
        keel.vote(id, 1);
        uint256[] memory t = keel.tallies(id);
        assertEq(t[0], 50e18);
        assertEq(t[1], 200e18);
        vm.prank(alice);
        vm.expectRevert(OscraKeel.AlreadyVoted.selector);
        keel.vote(id, 1);

        vm.prank(alice);
        vm.expectRevert(OscraKeel.Locked.selector);
        keel.unstake(50e18);
        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        keel.unstake(50e18);
        vm.prank(carol);
        vm.expectRevert(OscraKeel.PollClosed.selector);
        keel.vote(id, 0);
    }

    function test_pollShapeChecks() public {
        vm.prank(bob);
        keel.stake(200e18);
        string[] memory one = new string[](1);
        one[0] = "Only";
        vm.startPrank(bob);
        vm.expectRevert(OscraKeel.BadPoll.selector);
        keel.openPoll("x", one, 3 days);
        string[] memory two = new string[](2);
        two[0] = "a";
        two[1] = "b";
        vm.expectRevert(OscraKeel.BadPoll.selector);
        keel.openPoll("x", two, 1 hours);
        vm.expectRevert(OscraKeel.BadPoll.selector);
        keel.openPoll("", two, 2 days);
        vm.stopPrank();
    }

    function testFuzz_sharesNeverExceedPool(uint96 a, uint96 b, uint64 f1, uint64 f2) public {
        a = uint96(bound(a, 1, 10_000e18));
        b = uint96(bound(b, 1, 10_000e18));
        f1 = uint64(bound(f1, 0, 1_000_000e6));
        f2 = uint64(bound(f2, 0, 1_000_000e6));
        vm.prank(alice);
        keel.stake(a);
        _fee(f1);
        vm.prank(bob);
        keel.stake(b);
        _fee(f2);
        uint256 total = keel.claimable(alice) + keel.claimable(bob);
        assertLe(total, uint256(f1) + f2);
        assertApproxEqAbs(total, uint256(f1) + f2, 2);
        vm.prank(alice);
        keel.claim();
        vm.prank(bob);
        keel.claim();
        assertLe(usd.balanceOf(address(keel)), 2);
    }
}
