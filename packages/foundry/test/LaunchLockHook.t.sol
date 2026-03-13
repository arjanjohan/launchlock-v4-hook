// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager, ModifyLiquidityParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";

import {EasyPosm} from "./utils/libraries/EasyPosm.sol";

import {LaunchLockHook} from "../contracts/LaunchLockHook.sol";
import {BaseTest} from "./utils/BaseTest.sol";

contract LaunchLockHookTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    Currency currency0;
    Currency currency1;

    PoolKey poolKey;
    PoolKey poolKey2;

    LaunchLockHook hook;
    PoolId poolId;
    PoolId poolId2;

    uint256 tokenId;
    int24 tickLower;
    int24 tickUpper;

    function setUp() public {
        deployArtifactsAndLabel();

        (currency0, currency1) = deployCurrencyPair();

        address flags = address(uint160(Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG) ^ (0x4444 << 144));
        bytes memory constructorArgs = abi.encode(poolManager);
        deployCodeTo("LaunchLockHook.sol:LaunchLockHook", constructorArgs, flags);
        hook = LaunchLockHook(flags);

        poolKey = PoolKey(currency0, currency1, 3000, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        poolKey2 = PoolKey(currency0, currency1, 500, 60, IHooks(hook));
        poolId2 = poolKey2.toId();
        poolManager.initialize(poolKey2, Constants.SQRT_PRICE_1_1);

        tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);

        uint128 liquidityAmount = 100e18;

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );

        (tokenId,) = positionManager.mint(
            poolKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            amount0Expected + 1,
            amount1Expected + 1,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );
    }

    function test_InitializeLaunchLock() public {
        uint64 lockEnd = uint64(block.timestamp + 1 days);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd);

        (bool initialized, address poolOwner, uint64 lockEndTime) = hook.launchConfigs(poolId);
        assertTrue(initialized);
        assertEq(poolOwner, address(this));
        assertEq(lockEndTime, lockEnd);
    }

    function test_RevertIf_InitializeCalledByNonPoolOwner() public {
        uint64 lockEnd = uint64(block.timestamp + 1 days);

        vm.prank(address(0xBEEF));
        vm.expectRevert(LaunchLockHook.LaunchLockHook__NotPoolOwner.selector);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd);
    }

    function test_RevertIf_ReinitializePoolLock() public {
        uint64 lockEnd = uint64(block.timestamp + 1 days);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd);

        vm.expectRevert(LaunchLockHook.LaunchLockHook__AlreadyInitialized.selector);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd + 1 days);
    }

    function test_RevertIf_InvalidLockEndTime() public {
        vm.expectRevert(LaunchLockHook.LaunchLockHook__InvalidLockEndTime.selector);
        hook.initializeLaunchLock(poolKey, address(this), uint64(block.timestamp));
    }

    function test_RevertIf_BeforeRemoveLiquidityBeforeLockEnd() public {
        uint64 lockEnd = uint64(block.timestamp + 1 days);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd);

        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -int256(1e18), salt: bytes32(0)});

        vm.prank(address(poolManager));
        vm.expectRevert(abi.encodeWithSelector(LaunchLockHook.LaunchLockHook__LiquidityLocked.selector, uint256(lockEnd)));
        hook.beforeRemoveLiquidity(address(this), poolKey, params, Constants.ZERO_BYTES);
    }

    function test_RemoveLiquidityAfterLockEnd() public {
        hook.initializeLaunchLock(poolKey, address(this), uint64(block.timestamp + 1 days));

        vm.warp(block.timestamp + 1 days);

        positionManager.decreaseLiquidity(
            tokenId,
            1e18,
            0,
            0,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );
    }

    function test_RemoveLiquidityWithoutLockConfig() public {
        positionManager.decreaseLiquidity(
            tokenId,
            1e18,
            0,
            0,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );
    }

    function test_RevertIf_InvalidPoolOwner() public {
        vm.expectRevert(LaunchLockHook.LaunchLockHook__InvalidPoolOwner.selector);
        hook.initializeLaunchLock(poolKey, address(0), uint64(block.timestamp + 1 days));
    }

    function test_RemoveAllowedAtExactLockEndTimestamp() public {
        uint64 lockEnd = uint64(block.timestamp + 1 days);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd);

        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -int256(1e18), salt: bytes32(0)});

        vm.warp(lockEnd);
        vm.prank(address(poolManager));
        hook.beforeRemoveLiquidity(address(this), poolKey, params, Constants.ZERO_BYTES);
    }

    function test_RevertIf_BeforeRemoveLiquidityCalledByNonPoolManager() public {
        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -int256(1e18), salt: bytes32(0)});

        vm.prank(address(0xBEEF));
        vm.expectRevert();
        hook.beforeRemoveLiquidity(address(this), poolKey, params, Constants.ZERO_BYTES);
    }

    function test_LockIsPoolSpecific() public {
        uint64 lockEnd = uint64(block.timestamp + 1 days);
        hook.initializeLaunchLock(poolKey, address(this), lockEnd);

        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -int256(1e18), salt: bytes32(0)});

        vm.prank(address(poolManager));
        vm.expectRevert(abi.encodeWithSelector(LaunchLockHook.LaunchLockHook__LiquidityLocked.selector, uint256(lockEnd)));
        hook.beforeRemoveLiquidity(address(this), poolKey, params, Constants.ZERO_BYTES);

        vm.prank(address(poolManager));
        hook.beforeRemoveLiquidity(address(this), poolKey2, params, Constants.ZERO_BYTES);
    }

    function test_RevertIf_SetGroupBeforePoolInit() public {
        vm.expectRevert(LaunchLockHook.LaunchLockHook__PoolNotInitialized.selector);
        hook.setGroupConfig(poolKey2, keccak256("team"), true, uint64(block.timestamp + 2 days));
    }

    function test_RevertIf_GroupLockShorterThanPoolLock() public {
        uint64 poolLockEnd = uint64(block.timestamp + 2 days);
        hook.initializeLaunchLock(poolKey, address(this), poolLockEnd);

        vm.expectRevert(LaunchLockHook.LaunchLockHook__InvalidGroupLockEndTime.selector);
        hook.setGroupConfig(poolKey, keccak256("team"), true, uint64(block.timestamp + 1 days));
    }

    function test_GroupOverrideExtendsEffectiveLock() public {
        uint64 poolLockEnd = uint64(block.timestamp + 1 days);
        uint64 groupLockEnd = uint64(block.timestamp + 3 days);
        bytes32 groupId = keccak256("team");

        hook.initializeLaunchLock(poolKey, address(this), poolLockEnd);
        hook.setGroupConfig(poolKey, groupId, true, groupLockEnd);

        bytes32 pKey = hook.positionKey(tickLower, tickUpper, bytes32(0));
        hook.assignPositionToGroup(poolKey, pKey, groupId);

        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -int256(1e18), salt: bytes32(0)});

        vm.warp(poolLockEnd + 1);
        vm.prank(address(poolManager));
        vm.expectRevert(abi.encodeWithSelector(LaunchLockHook.LaunchLockHook__LiquidityLocked.selector, uint256(groupLockEnd)));
        hook.beforeRemoveLiquidity(address(this), poolKey, params, Constants.ZERO_BYTES);

        vm.warp(groupLockEnd);
        vm.prank(address(poolManager));
        hook.beforeRemoveLiquidity(address(this), poolKey, params, Constants.ZERO_BYTES);
    }

    function test_RevertIf_AssignToUnknownGroup() public {
        hook.initializeLaunchLock(poolKey, address(this), uint64(block.timestamp + 1 days));

        bytes32 pKey = hook.positionKey(tickLower, tickUpper, bytes32(0));
        vm.expectRevert(LaunchLockHook.LaunchLockHook__GroupNotFound.selector);
        hook.assignPositionToGroup(poolKey, pKey, keccak256("unknown"));
    }
}
