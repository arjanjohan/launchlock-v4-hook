"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PoolSelect } from "~~/components/launchlock/PoolSelect";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

const formatRemaining = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (s >= 86400) return `${d}d${h}h`;
  if (s >= 3600) return `${h}h${m}m`;
  if (s >= 60) return `${m}m${sec}s`;
  return `${sec}s`;
};

const SchemaPage = () => {
  const { address } = useAccount();

  const [selectedPoolId, setSelectedPoolId] = useState<`0x${string}` | "">("");

  const poolId = (selectedPoolId || ZERO_BYTES32) as `0x${string}`;

  const { data: launchCfg } = useScaffoldReadContract({
    contractName: "LaunchLockHook",
    functionName: "launchConfigs",
    args: [poolId],
    query: { enabled: poolId !== ZERO_BYTES32 },
  });

  const now = Math.floor(Date.now() / 1000);
  const poolLockEnd = Number((launchCfg as any)?.[2] || 0);
  const remainingSeconds = Math.max(0, poolLockEnd - now);
  const remainingHuman = formatRemaining(remainingSeconds);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pool Unlock Schema</h1>
        <p className="opacity-70">Select a created pool and inspect its lock status.</p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-3">
          <h2 className="card-title">Select Pool</h2>
          <PoolSelect value={selectedPoolId} onChange={v => setSelectedPoolId(v)} includeManual={false} />

          <div className="text-xs bg-base-200 p-3 rounded break-all">Selected poolId: {poolId}</div>
        </div>
      </div>

      {poolId !== ZERO_BYTES32 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Pool Lock Summary</h2>
            <div className="stats stats-vertical lg:stats-horizontal shadow">
              <div className="stat">
                <div className="stat-title">Initialized</div>
                <div className="stat-value text-lg">{(launchCfg as any)?.[0] ? "Yes" : "No"}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Pool Owner</div>
                <div className="stat-value text-sm break-all">{(launchCfg as any)?.[1] || address || "-"}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Pool Lock Remaining</div>
                <div className="stat-value text-lg">{remainingHuman}</div>
                <div className="stat-desc">{remainingSeconds}s remaining</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaPage;
