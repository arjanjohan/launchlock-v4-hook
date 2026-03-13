// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DeployHelpers.s.sol";
import "../contracts/LaunchLockHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

contract DeployYourContract is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // TODO: replace with canonical PoolManager per target network.
        new LaunchLockHook(IPoolManager(address(0x0000000000000000000000000000000000000001)));
    }
}
