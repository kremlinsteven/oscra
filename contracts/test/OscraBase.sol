// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OscraRunbook} from "../src/OscraRunbook.sol";
import {OscraKeel} from "../src/OscraKeel.sol";
import {OscraMockCoin, OscraMockFeed, OscraMockRouter} from "./OscraMocks.sol";

abstract contract OscraBase is Test {
    OscraMockCoin internal usd;
    OscraMockCoin internal weth;
    OscraMockCoin internal nvda;
    OscraMockCoin internal oscra;
    OscraMockFeed internal ethFeed;
    OscraMockFeed internal nvdaFeed;
    OscraMockRouter internal router;
    OscraRunbook internal book;
    OscraKeel internal keel;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal desk = address(0xDE5C);
    address internal keeper = address(0xBEEF);

    uint256 internal constant ETH_PX = 2_000e8;
    uint256 internal constant NVDA_PX = 200e8;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        usd = new OscraMockCoin("USDG", 6);
        weth = new OscraMockCoin("WETH", 18);
        nvda = new OscraMockCoin("NVDA", 18);
        oscra = new OscraMockCoin("OSCRA", 18);
        ethFeed = new OscraMockFeed();
        nvdaFeed = new OscraMockFeed();
        ethFeed.set(int256(ETH_PX), block.timestamp);
        nvdaFeed.set(int256(NVDA_PX), block.timestamp);
        router = new OscraMockRouter(address(usd));
        router.setPrice(address(weth), ETH_PX);
        router.setPrice(address(nvda), NVDA_PX);

        OscraRunbook.LaneInput[] memory lanes = new OscraRunbook.LaneInput[](2);
        lanes[0] = OscraRunbook.LaneInput({asset: address(weth), poolFee: 100, feed: address(ethFeed), maxAge: 1 days});
        lanes[1] = OscraRunbook.LaneInput({asset: address(nvda), poolFee: 500, feed: address(nvdaFeed), maxAge: 4 days});
        book = new OscraRunbook(address(usd), address(router), lanes, 20, 10, 1_000e18);
        keel = new OscraKeel(address(oscra), address(usd), 100e18);

        for (uint256 i; i < 3; ++i) {
            address who = [alice, bob, desk][i];
            usd.mint(who, 1_000_000e6);
            vm.prank(who);
            usd.approve(address(book), type(uint256).max);
        }
    }

    function terms(uint8 lane, uint128 perBuy, uint32 interval, uint128 budget) internal pure returns (OscraRunbook.PlanTerms memory t) {
        t.lane = lane;
        t.perBuy = perBuy;
        t.interval = interval;
        t.budget = budget;
        t.slipBps = 100;
    }

    function followTerms(uint128 perSignal, uint128 dayCap) internal pure returns (OscraRunbook.FollowTerms memory t) {
        t.perSignal = perSignal;
        t.dayCap = dayCap;
        t.laneMask = 3;
        t.reviewDelay = 1 hours;
        t.slipBps = 100;
        t.chaseBps = 200;
    }

    function setPrices(uint256 eth, uint256 nv) internal {
        ethFeed.set(int256(eth), block.timestamp);
        nvdaFeed.set(int256(nv), block.timestamp);
        router.setPrice(address(weth), eth);
        router.setPrice(address(nvda), nv);
    }

    struct Kit {
        OscraRunbook book;
        OscraKeel keel;
        OscraMockCoin usd;
        OscraMockCoin nvda;
        OscraMockCoin oscra;
        OscraMockFeed ethFeed;
        OscraMockFeed nvdaFeed;
        OscraMockRouter router;
    }

    function kit() internal view returns (Kit memory) {
        return Kit(book, keel, usd, nvda, oscra, ethFeed, nvdaFeed, router);
    }

    function bindKeel() internal {
        book.bind(address(keel));
    }
}
