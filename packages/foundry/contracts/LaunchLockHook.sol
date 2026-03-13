// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, ModifyLiquidityParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

contract LaunchLockHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    struct LaunchConfig {
        bool initialized;
        address poolOwner;
        uint64 lockEndTime;
    }

    struct GroupConfig {
        bool exists;
        bool enabled;
        uint64 lockEndTime;
    }

    error LaunchLockHook__AlreadyInitialized();
    error LaunchLockHook__PoolNotInitialized();
    error LaunchLockHook__NotPoolOwner();
    error LaunchLockHook__InvalidPoolOwner();
    error LaunchLockHook__InvalidLockEndTime();
    error LaunchLockHook__InvalidGroupLockEndTime();
    error LaunchLockHook__GroupNotFound();
    error LaunchLockHook__LiquidityLocked(uint256 lockEndTime);

    event LaunchLockInitialized(PoolId indexed poolId, address indexed poolOwner, uint64 lockEndTime);
    event GroupConfigured(PoolId indexed poolId, bytes32 indexed groupId, bool enabled, uint64 lockEndTime);
    event PositionGroupAssigned(PoolId indexed poolId, bytes32 indexed positionKey, bytes32 indexed groupId);

    mapping(PoolId => LaunchConfig) public launchConfigs;
    mapping(PoolId => mapping(bytes32 => GroupConfig)) public groupConfigs;
    mapping(PoolId => mapping(bytes32 => bytes32)) public positionGroup;

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function initializeLaunchLock(PoolKey calldata key, address poolOwner, uint64 lockEndTime) external {
        if (poolOwner == address(0)) revert LaunchLockHook__InvalidPoolOwner();
        if (msg.sender != poolOwner) revert LaunchLockHook__NotPoolOwner();
        if (lockEndTime <= block.timestamp) revert LaunchLockHook__InvalidLockEndTime();

        PoolId poolId = key.toId();
        if (launchConfigs[poolId].initialized) revert LaunchLockHook__AlreadyInitialized();

        launchConfigs[poolId] = LaunchConfig({initialized: true, poolOwner: poolOwner, lockEndTime: lockEndTime});

        emit LaunchLockInitialized(poolId, poolOwner, lockEndTime);
    }

    function setGroupConfig(PoolKey calldata key, bytes32 groupId, bool enabled, uint64 lockEndTime) external {
        PoolId poolId = key.toId();
        LaunchConfig memory cfg = launchConfigs[poolId];

        if (!cfg.initialized) revert LaunchLockHook__PoolNotInitialized();
        if (msg.sender != cfg.poolOwner) revert LaunchLockHook__NotPoolOwner();
        if (lockEndTime < cfg.lockEndTime) revert LaunchLockHook__InvalidGroupLockEndTime();

        groupConfigs[poolId][groupId] = GroupConfig({exists: true, enabled: enabled, lockEndTime: lockEndTime});

        emit GroupConfigured(poolId, groupId, enabled, lockEndTime);
    }

    function assignPositionToGroup(PoolKey calldata key, bytes32 positionKey, bytes32 groupId) external {
        PoolId poolId = key.toId();
        LaunchConfig memory cfg = launchConfigs[poolId];

        if (!cfg.initialized) revert LaunchLockHook__PoolNotInitialized();
        if (msg.sender != cfg.poolOwner) revert LaunchLockHook__NotPoolOwner();
        if (!groupConfigs[poolId][groupId].exists) revert LaunchLockHook__GroupNotFound();

        positionGroup[poolId][positionKey] = groupId;

        emit PositionGroupAssigned(poolId, positionKey, groupId);
    }

    function positionKey(int24 tickLower, int24 tickUpper, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tickLower, tickUpper, salt));
    }

    function _beforeAddLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, bytes calldata)
        internal
        view
        override
        returns (bytes4)
    {
        PoolId poolId = key.toId();
        if (!launchConfigs[poolId].initialized) revert LaunchLockHook__PoolNotInitialized();
        return BaseHook.beforeAddLiquidity.selector;
    }

    function _beforeRemoveLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata)
        internal
        view
        override
        returns (bytes4)
    {
        PoolId poolId = key.toId();
        LaunchConfig memory cfg = launchConfigs[poolId];

        if (!cfg.initialized) {
            return BaseHook.beforeRemoveLiquidity.selector;
        }

        bytes32 pKey = positionKey(params.tickLower, params.tickUpper, params.salt);
        bytes32 gId = positionGroup[poolId][pKey];
        GroupConfig memory group = groupConfigs[poolId][gId];

        uint256 effectiveLockEnd = cfg.lockEndTime;
        if (group.exists && group.enabled) {
            effectiveLockEnd = group.lockEndTime;
        }

        if (block.timestamp < effectiveLockEnd) {
            revert LaunchLockHook__LiquidityLocked(effectiveLockEnd);
        }

        return BaseHook.beforeRemoveLiquidity.selector;
    }
}
