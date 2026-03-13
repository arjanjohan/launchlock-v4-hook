"use client";

import { useMemo, useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { encodeAbiParameters, keccak256 } from "viem";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

const SchemaPage = () => {
  const [currency0, setCurrency0] = useState(EMPTY_ADDRESS);
  const [currency1, setCurrency1] = useState(EMPTY_ADDRESS);
  const [hooks, setHooks] = useState(EMPTY_ADDRESS);
  const [fee, setFee] = useState("3000");
  const [tickSpacing, setTickSpacing] = useState("60");
  const [groupIdsRaw, setGroupIdsRaw] = useState(ZERO_BYTES32);

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

  const poolId = useMemo(() => {
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
      return ZERO_BYTES32;
    }
  }, [keyArgs]);

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
    args: [poolId as `0x${string}`],
  });

  const { data: groupConfiguredEvents } = useScaffoldEventHistory({
    contractName: "LaunchLockHook",
    eventName: "GroupConfigured",
    fromBlock: 0n,
    watch: true,
    enabled: !!poolId,
  });

  const { data: positionAssignedEvents } = useScaffoldEventHistory({
    contractName: "LaunchLockHook",
    eventName: "PositionGroupAssigned",
    fromBlock: 0n,
    watch: true,
    enabled: !!poolId,
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
    };
  }, [groupConfiguredEvents, positionAssignedEvents, poolId]);

  const now = Math.floor(Date.now() / 1000);
  const poolLockEnd = Number((launchCfg as any)?.[2] || 0);
  const remainingSeconds = Math.max(0, poolLockEnd - now);
  const lockDays = Math.floor(remainingSeconds / 86400);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pool Unlock Schema</h1>
        <p className="opacity-70">Visual overview of pool lock, group locks, and assigned positions.</p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-2">
          <h2 className="card-title">PoolKey Input</h2>
          <AddressInput value={currency0} onChange={setCurrency0} placeholder="currency0" />
          <AddressInput value={currency1} onChange={setCurrency1} placeholder="currency1" />
          <AddressInput value={hooks} onChange={setHooks} placeholder="hooks" />
          <input
            className="input input-bordered"
            value={fee}
            onChange={e => setFee(e.target.value)}
            placeholder="fee"
          />
          <input
            className="input input-bordered"
            value={tickSpacing}
            onChange={e => setTickSpacing(e.target.value)}
            placeholder="tickSpacing"
          />
          <textarea
            className="textarea textarea-bordered"
            value={groupIdsRaw}
            onChange={e => setGroupIdsRaw(e.target.value)}
            placeholder="group ids csv (0x...,0x...)"
          />
          <div className="text-xs bg-base-200 p-3 rounded break-all">poolId: {poolId}</div>
        </div>
      </div>

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
              <div className="stat-value text-sm break-all">{(launchCfg as any)?.[1] || "-"}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Pool Lock Remaining</div>
              <div className="stat-value text-lg">{lockDays}d</div>
              <div className="stat-desc">{remainingSeconds}s remaining</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Group Visualization</h2>
          <p className="text-sm opacity-70">
            Token amount locked is not directly tracked by the hook state. This page visualizes lock timings and
            assigned positions.
          </p>
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
