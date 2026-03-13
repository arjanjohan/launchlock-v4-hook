// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DeployHelpers.s.sol";
import {LaunchLockHook} from "../contracts/LaunchLockHook.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {AddressConstants} from "hookmate/constants/AddressConstants.sol";

contract DeployYourContract is ScaffoldETHDeploy {
    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);

    function run() external ScaffoldEthDeployerRunner {
        IPoolManager poolManager = IPoolManager(AddressConstants.getPoolManagerAddress(block.chainid));

        // Only beforeRemoveLiquidity is enabled in LaunchLockHook permissions.
        uint160 flags = uint160(Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG);

        bytes memory constructorArgs = abi.encode(poolManager);
        (address expectedHookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(LaunchLockHook).creationCode, constructorArgs);

        LaunchLockHook hook = new LaunchLockHook{salt: salt}(poolManager);
        require(address(hook) == expectedHookAddress, "LaunchLock: hook address mismatch");

        deployments.push(Deployment({name: "LaunchLockHook", addr: address(hook)}));
    }
}
