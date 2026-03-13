"use client";

import { useMemo, useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { encodeAbiParameters, keccak256 } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

const CreatePoolPage = () => {
  const { address } = useAccount();
  const { data: deployedHook } = useDeployedContractInfo({ contractName: "LaunchLockHook" });

  const [currency0, setCurrency0] = useState(EMPTY_ADDRESS);
  const [currency1, setCurrency1] = useState(EMPTY_ADDRESS);
  const [hooks, setHooks] = useState(EMPTY_ADDRESS);
  const [fee, setFee] = useState(3000n);
  const [tickSpacing, setTickSpacing] = useState(60n);
  const [sqrtPriceX96, setSqrtPriceX96] = useState(79228162514264337593543950336n); // 1.0
  const [poolOwner, setPoolOwner] = useState(EMPTY_ADDRESS);
  const [lockEndTime, setLockEndTime] = useState(BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600));

  const { writeContractAsync: writePoolManager, isMining: isCreatingPool } = useScaffoldWriteContract({
    contractName: "PoolManager",
  });
  const { writeContractAsync: writeLaunchLock, isMining: isInitializingLock } = useScaffoldWriteContract({
    contractName: "LaunchLockHook",
  });

  const keyArgs = useMemo(
    () => ({
      currency0: currency0 as `0x${string}`,
      currency1: currency1 as `0x${string}`,
      fee: Number(fee),
      tickSpacing: Number(tickSpacing),
      hooks: hooks as `0x${string}`,
    }),
    [currency0, currency1, fee, tickSpacing, hooks],
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

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Pool + Initialize Launch Lock</h1>
        <p className="opacity-70">
          Creates a v4 pool (PoolManager.initialize) with your lock hook, then initializes lock.
        </p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-3">
          <h2 className="card-title">PoolKey</h2>
          <AddressInput value={currency0} onChange={setCurrency0} placeholder="currency0" />
          <AddressInput value={currency1} onChange={setCurrency1} placeholder="currency1" />
          <AddressInput
            value={hooks}
            onChange={setHooks}
            placeholder={deployedHook?.address ? `hooks (suggested: ${deployedHook.address})` : "hooks"}
          />
          <input
            className="input input-bordered"
            value={fee.toString()}
            onChange={e => setFee(BigInt(e.target.value || "0"))}
            placeholder="fee (uint24)"
          />
          <input
            className="input input-bordered"
            value={tickSpacing.toString()}
            onChange={e => setTickSpacing(BigInt(e.target.value || "0"))}
            placeholder="tickSpacing (int24)"
          />
          <input
            className="input input-bordered"
            value={sqrtPriceX96.toString()}
            onChange={e => setSqrtPriceX96(BigInt(e.target.value || "0"))}
            placeholder="sqrtPriceX96 (uint160)"
          />

          <div className="bg-base-200 rounded p-3 text-xs break-all">
            <div className="font-semibold">Computed PoolId</div>
            <div>{computedPoolId || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-3">
          <h2 className="card-title">Launch Lock Config</h2>
          <AddressInput
            value={poolOwner}
            onChange={setPoolOwner}
            placeholder={address ? `poolOwner (suggested: ${address})` : "poolOwner"}
          />
          <input
            className="input input-bordered"
            value={lockEndTime.toString()}
            onChange={e => setLockEndTime(BigInt(e.target.value || "0"))}
            placeholder="lockEndTime (unix)"
          />

          <div className="flex gap-2 flex-wrap">
            <button
              className="btn btn-primary"
              disabled={isCreatingPool}
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
              disabled={isInitializingLock}
              onClick={async () => {
                try {
                  await writeLaunchLock({
                    functionName: "initializeLaunchLock",
                    args: [keyArgs, (poolOwner || address || EMPTY_ADDRESS) as `0x${string}`, lockEndTime],
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
