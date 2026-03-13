"use client";

import { useMemo, useState } from "react";
import { encodeAbiParameters, keccak256 } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const DEMO_TOKENS = [
  { symbol: "UNI", label: "Uniswap Demo (UNI)", address: "0x98E4D8B01561228Be089b04378adAECd39884016" },
  { symbol: "USDC", label: "USD Coin Demo (USDC)", address: "0x81fC41ffA0B48462fa280e154bB288a245a7A263" },
  { symbol: "PEPE", label: "Pepe Demo (PEPE)", address: "0x15B13dEF61E1AcCb4Ac356a2d13e0608f1643b9d" },
] as const;

const FEE_PRESETS = [
  { label: "0.01% (stable-like)", fee: 100, tickSpacing: 1 },
  { label: "0.05%", fee: 500, tickSpacing: 10 },
  { label: "0.30% (standard)", fee: 3000, tickSpacing: 60 },
  { label: "1.00% (volatile)", fee: 10000, tickSpacing: 200 },
] as const;

const Q96 = 2 ** 96;

const CreatePoolPage = () => {
  const { address } = useAccount();
  const { data: deployedHook } = useDeployedContractInfo({ contractName: "LaunchLockHook" });

  const [currency0, setCurrency0] = useState<string>(DEMO_TOKENS[0].address);
  const [currency1, setCurrency1] = useState<string>(DEMO_TOKENS[1].address);
  const [feePreset, setFeePreset] = useState<number>(2);
  const [initialPrice, setInitialPrice] = useState<string>("1"); // 1 token0 = X token1

  const [lockAmount, setLockAmount] = useState<number>(7);
  const [lockUnit, setLockUnit] = useState<"days" | "hours">("days");

  const { writeContractAsync: writePoolManager, isMining: isCreatingPool } = useScaffoldWriteContract({
    contractName: "PoolManager",
  });
  const { writeContractAsync: writeLaunchLock, isMining: isInitializingLock } = useScaffoldWriteContract({
    contractName: "LaunchLockHook",
  });

  const selectedPreset = FEE_PRESETS[feePreset];

  const hooksAddress = deployedHook?.address;

  const sqrtPriceX96 = useMemo(() => {
    const p = Number(initialPrice);
    if (!Number.isFinite(p) || p <= 0) return 0n;
    return BigInt(Math.floor(Math.sqrt(p) * Q96));
  }, [initialPrice]);

  const keyArgs = useMemo(
    () => ({
      currency0: currency0 as `0x${string}`,
      currency1: currency1 as `0x${string}`,
      fee: selectedPreset.fee,
      tickSpacing: selectedPreset.tickSpacing,
      hooks: (hooksAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    }),
    [currency0, currency1, selectedPreset, hooksAddress],
  );

  const computedPoolId = useMemo(() => {
    try {
      return keccak256(
        encodeAbiParameters(
          [
            {
              type: "tuple",
              components: [
                { name: "currency0", type: "address" },
                { name: "currency1", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "tickSpacing", type: "int24" },
                { name: "hooks", type: "address" },
              ],
            },
          ],
          [keyArgs],
        ),
      );
    } catch {
      return "";
    }
  }, [keyArgs]);

  const lockEndTime = useMemo(() => {
    const amount = Number(lockAmount || 0);
    const secs = lockUnit === "days" ? amount * 24 * 3600 : amount * 3600;
    return BigInt(Math.floor(Date.now() / 1000) + Math.max(0, secs));
  }, [lockAmount, lockUnit]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Pool + Initialize Launch Lock</h1>
        <p className="opacity-70">Simple demo flow: choose tokens, set fee tier + price, create pool, lock it.</p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-3">
          <h2 className="card-title">Pool Configuration</h2>

          <label className="text-sm font-semibold">Currency 0</label>
          <select
            className="select select-bordered w-full"
            value={currency0}
            onChange={e => setCurrency0(e.target.value)}
          >
            {DEMO_TOKENS.map(token => (
              <option key={token.address} value={token.address}>
                {token.label}
              </option>
            ))}
          </select>

          <label className="text-sm font-semibold">Currency 1</label>
          <select
            className="select select-bordered w-full"
            value={currency1}
            onChange={e => setCurrency1(e.target.value)}
          >
            {DEMO_TOKENS.map(token => (
              <option key={token.address} value={token.address}>
                {token.label}
              </option>
            ))}
          </select>

          <label className="text-sm font-semibold">Fee Tier</label>
          <select
            className="select select-bordered w-full"
            value={feePreset}
            onChange={e => setFeePreset(Number(e.target.value))}
          >
            {FEE_PRESETS.map((preset, idx) => (
              <option key={preset.label} value={idx}>
                {preset.label} — fee {preset.fee}, tickSpacing {preset.tickSpacing}
              </option>
            ))}
          </select>

          <label className="text-sm font-semibold">Initial Price</label>
          <input
            className="input input-bordered"
            value={initialPrice}
            onChange={e => setInitialPrice(e.target.value)}
            placeholder="1 TOKEN0 = X TOKEN1"
          />
          <div className="text-xs opacity-70">Interpreted as: 1 currency0 = {initialPrice || "?"} currency1</div>

          <label className="text-sm font-semibold">Hook (auto)</label>
          <div className="input input-bordered flex items-center text-sm">
            {hooksAddress || "LaunchLockHook not found on this chain"}
          </div>

          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">Advanced details</div>
            <div className="collapse-content text-xs space-y-2">
              <div>sqrtPriceX96: {sqrtPriceX96.toString()}</div>
              <div className="break-all">poolId: {computedPoolId || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-3">
          <h2 className="card-title">Launch Lock Setup</h2>

          <label className="text-sm font-semibold">Pool Owner (auto)</label>
          <div className="input input-bordered flex items-center text-sm">{address || "Connect wallet"}</div>

          <label className="text-sm font-semibold">Lock Duration</label>
          <div className="flex gap-2">
            <input
              className="input input-bordered w-40"
              type="number"
              min={1}
              value={lockAmount}
              onChange={e => setLockAmount(Number(e.target.value || 0))}
            />
            <select
              className="select select-bordered"
              value={lockUnit}
              onChange={e => setLockUnit(e.target.value as "days" | "hours")}
            >
              <option value="days">days</option>
              <option value="hours">hours</option>
            </select>
          </div>
          <div className="text-xs opacity-70">Computed lockEndTime (unix): {lockEndTime.toString()}</div>

          <div className="flex gap-2 flex-wrap">
            <button
              className="btn btn-primary"
              disabled={isCreatingPool || !hooksAddress || sqrtPriceX96 <= 0n}
              onClick={async () => {
                try {
                  await writePoolManager({ functionName: "initialize", args: [keyArgs, sqrtPriceX96] });
                  notification.success("Pool created (initialize tx sent)");
                } catch (e) {
                  notification.error(getParsedError(e));
                }
              }}
            >
              {isCreatingPool ? "Creating..." : "1) Create Pool"}
            </button>

            <button
              className="btn btn-secondary"
              disabled={isInitializingLock || !address || !hooksAddress}
              onClick={async () => {
                try {
                  await writeLaunchLock({
                    functionName: "initializeLaunchLock",
                    args: [keyArgs, address as `0x${string}`, lockEndTime],
                  });
                  notification.success("Launch lock initialized");
                } catch (e) {
                  notification.error(getParsedError(e));
                }
              }}
            >
              {isInitializingLock ? "Initializing..." : "2) Initialize Launch Lock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePoolPage;
