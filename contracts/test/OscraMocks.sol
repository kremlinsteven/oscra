// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOscraSwapRouter} from "../src/OscraWire.sol";

contract OscraMockCoin {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    /// Basis points burned on every transfer (to test fee-on-transfer rejection).
    uint256 public skimBps;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n, uint8 d) {
        name = n;
        symbol = n;
        decimals = d;
    }

    function setSkim(uint256 bps) external {
        skimBps = bps;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        uint256 skim = (amount * skimBps) / 10_000;
        balanceOf[to] += amount - skim;
        totalSupply -= skim;
    }
}

contract OscraMockFeed {
    uint8 public constant decimals = 8;
    int256 public answer;
    uint256 public updatedAt;

    function set(int256 a, uint256 at) external {
        answer = a;
        updatedAt = at;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

/// Swaps at a set USD price per asset (8 decimals) against a 6-decimal dollar, minus a haircut.
contract OscraMockRouter {
    address public immutable dollar;
    mapping(address => uint256) public priceOf;
    uint256 public haircutBps;

    constructor(address dollar_) {
        dollar = dollar_;
    }

    function setPrice(address asset, uint256 p) external {
        priceOf[asset] = p;
    }

    function setHaircut(uint256 bps) external {
        haircutBps = bps;
    }

    function exactInputSingle(IOscraSwapRouter.ExactInputSingleParams calldata p) external returns (uint256 out) {
        OscraMockCoin(p.tokenIn).transferFrom(msg.sender, address(this), p.amountIn);
        if (p.tokenIn == dollar) {
            out = (p.amountIn * 1e18 * 1e8) / (priceOf[p.tokenOut] * 1e6);
        } else {
            out = (p.amountIn * priceOf[p.tokenIn] * 1e6) / (1e18 * 1e8);
        }
        out = (out * (10_000 - haircutBps)) / 10_000;
        require(out >= p.amountOutMinimum, "Too little received");
        OscraMockCoin(p.tokenOut).mint(p.recipient, out);
    }
}
