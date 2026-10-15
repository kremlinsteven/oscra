// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// ERC-20 surface the OSCRA contracts touch.
interface IOscraCoin {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// Chainlink aggregator proxy (read only).
interface IOscraPriceFeed {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// Uniswap v3 SwapRouter02 single-pool swap (the 02 router has no deadline field).
interface IOscraSwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// What the Runbook needs from the staking contract once it is bound.
interface IOscraFeeSink {
    function token() external view returns (address);
    function stakedOf(address account) external view returns (uint256);
    function pour() external returns (uint256 added);
}

/// Token moves that accept `bool`-returning and silent ERC-20s, and revert on anything else.
library OscraWire {
    error OscraWireFailed();

    function send(IOscraCoin token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IOscraCoin.transfer, (to, amount)));
    }

    function pull(IOscraCoin token, address from, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IOscraCoin.transferFrom, (from, to, amount)));
    }

    function allow(IOscraCoin token, address spender, uint256 amount) internal {
        _call(token, abi.encodeCall(IOscraCoin.approve, (spender, amount)));
    }

    function _call(IOscraCoin token, bytes memory data) private {
        if (address(token).code.length == 0) revert OscraWireFailed();
        (bool ok, bytes memory ret) = address(token).call(data);
        if (!ok || (ret.length != 0 && (ret.length < 32 || !abi.decode(ret, (bool))))) revert OscraWireFailed();
    }
}
