"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const HOOK_DEPLOY_BLOCK = 46563894n;

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

  const [selectedPoolId, setSelectedPoolId] = useState<`0x${string}`>(ZERO_BYTES32 as `0x${string}`);
  const [isManualPoolInput, setIsManualPoolInput] = useState(false);
  const [manualPoolId, setManualPoolId] = useState<`0x${string}`>(ZERO_BYTES32 as `0x${string}`);
  const [groupIdsRaw, setGroupIdsRaw] = useState(ZERO_BYTES32);

  const { data: poolCreatedEvents } = useScaffoldEventHistory({
    contractName: "LaunchLockHook",
    eventName: "LaunchLockInitialized",
    fromBlock: HOOK_DEPLOY_BLOCK,
    watch: true,
  });

  const poolOptions = useMemo(() => {
    const seen = new Set<string>();
    const rows: { poolId: `0x${string}`; poolOwner: string; lockEndTime: number }[] = [];

    for (const ev of poolCreatedEvents || []) {
      const poolId = ev.args?.poolId as `0x${string}` | undefined;
      const poolOwner = (ev.args?.poolOwner as string | undefined) || "";
      const lockEndTime = Number(ev.args?.lockEndTime || 0);
      if (!poolId) continue;
      if (seen.has(poolId.toLowerCase())) continue;
      seen.add(poolId.toLowerCase());
      rows.push({ poolId, poolOwner, lockEndTime });
    }

    return rows;
  }, [poolCreatedEvents]);

  const poolId = isManualPoolInput ? manualPoolId : selectedPoolId;

  const groupIds = useMemo(
    () =>
      groupIdsRaw
        .split(",")
        .map(s => s.trim())
        .filter(Boolean) as `0x${string}`[],
    [groupIdsRaw],
  );

  const { data: launchCfg } = useScaffoldReadContract({
    contractName: "LaunchLockHook",
    functionName: "launchConfigs",
    args: [poolId],
    query: { enabled: poolId !== ZERO_BYTES32 },
  });

  const { data: groupConfiguredEvents } = useScaffoldEventHistory({
    contractName: "LaunchLockHook",
    eventName: "GroupConfigured",
    fromBlock: 0n,
    watch: true,
    enabled: poolId !== ZERO_BYTES32,
  });

  const { data: positionAssignedEvents } = useScaffoldEventHistory({
    contractName: "LaunchLockHook",
    eventName: "PositionGroupAssigned",
    fromBlock: 0n,
    watch: true,
    enabled: poolId !== ZERO_BYTES32,
  });

  const eventGroups = useMemo(() => {
    const filteredGroups = (groupConfiguredEvents || []).filter(
      (e: any) => e.args?.poolId?.toLowerCase() === poolId.toLowerCase(),
    );
    const filteredAssignments = (positionAssignedEvents || []).filter(
      (e: any) => e.args?.poolId?.toLowerCase() === poolId.toLowerCase(),
    );

    const assignmentByGroup = new Map<string, number>();
    for (const ev of filteredAssignments) {
      const gid = (ev.args?.groupId || "").toLowerCase();
      assignmentByGroup.set(gid, (assignmentByGroup.get(gid) || 0) + 1);
    }

    return {
      groupEvents: filteredGroups,
      assignmentByGroup,
      totalAssigned: filteredAssignments.length,
    };
  }, [groupConfiguredEvents, positionAssignedEvents, poolId]);

  const now = Math.floor(Date.now() / 1000);
  const poolLockEnd = Number((launchCfg as any)?.[2] || 0);
  const remainingSeconds = Math.max(0, poolLockEnd - now);
  const remainingHuman = formatRemaining(remainingSeconds);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pool Unlock Schema</h1>
        <p className="opacity-70">Select a created pool and inspect lock/group structure.</p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-3">
          <h2 className="card-title">Select Pool</h2>
          <select
            className="select select-bordered w-full"
            value={isManualPoolInput ? "manual" : selectedPoolId}
            onChange={e => {
              if (e.target.value === "manual") {
                setIsManualPoolInput(true);
                return;
              }
              setIsManualPoolInput(false);
              setSelectedPoolId(e.target.value as `0x${string}`);
            }}
          >
            <option value={ZERO_BYTES32}>Choose a pool…</option>
            {poolOptions.map(pool => (
              <option key={pool.poolId} value={pool.poolId}>
                {pool.poolId} | owner {pool.poolOwner.slice(0, 8)}...
              </option>
            ))}
            <option value="manual">Manual input…</option>
          </select>

          {isManualPoolInput && (
            <input
              className="input input-bordered w-full"
              placeholder="Paste poolId manually (0x...)"
              value={manualPoolId}
              onChange={e => setManualPoolId(e.target.value as `0x${string}`)}
            />
          )}

          <div className="text-xs bg-base-200 p-3 rounded break-all">Selected poolId: {poolId}</div>

          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">Advanced: manual group IDs</div>
            <div className="collapse-content">
              <textarea
                className="textarea textarea-bordered w-full"
                value={groupIdsRaw}
                onChange={e => setGroupIdsRaw(e.target.value)}
                placeholder="group ids csv (0x...,0x...)"
              />
            </div>
          </div>
        </div>
      </div>

      {poolId !== ZERO_BYTES32 && (
        <>
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
                <div className="stat">
                  <div className="stat-title">Assigned Positions</div>
                  <div className="stat-value text-lg">{eventGroups.totalAssigned}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Group Visualization</h2>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Group ID</th>
                      <th>Exists</th>
                      <th>Enabled</th>
                      <th>Lock End</th>
                      <th>Assigned Positions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupIds.map(groupId => (
                      <GroupRow
                        key={groupId}
                        poolId={poolId as `0x${string}`}
                        groupId={groupId}
                        assigned={eventGroups.assignmentByGroup.get(groupId.toLowerCase()) || 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const GroupRow = ({
  poolId,
  groupId,
  assigned,
}: {
  poolId: `0x${string}`;
  groupId: `0x${string}`;
  assigned: number;
}) => {
  const { data } = useScaffoldReadContract({
    contractName: "LaunchLockHook",
    functionName: "groupConfigs",
    args: [poolId, groupId],
  });

  const lockEnd = Number((data as any)?.[2] || 0);

  return (
    <tr>
      <td className="text-xs break-all">{groupId}</td>
      <td>{(data as any)?.[0] ? "Yes" : "No"}</td>
      <td>{(data as any)?.[1] ? "Yes" : "No"}</td>
      <td>{lockEnd ? new Date(lockEnd * 1000).toLocaleString() : "-"}</td>
      <td>{assigned}</td>
    </tr>
  );
};

export default SchemaPage;
