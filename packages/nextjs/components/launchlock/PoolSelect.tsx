"use client";

import { useMemo } from "react";
import { useDeployedContractInfo, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { HOOK_DEPLOY_BLOCK } from "~~/utils/launchlock/constants";

const symbolByAddress: Record<string, string> = {
  "0x98e4d8b01561228be089b04378adaecd39884016": "UNI",
  "0x81fc41ffa0b48462fa280e154bb288a245a7a263": "USDC",
  "0x15b13def61e1accb4ac356a2d13e0608f1643b9d": "PEPE",
};

type PoolSelectProps = {
  value: string;
  onChange: (value: `0x${string}` | "") => void;
  includeManual?: boolean;
};

export const PoolSelect = ({ value, onChange, includeManual = false }: PoolSelectProps) => {
  const { data: hook } = useDeployedContractInfo({ contractName: "LaunchLockHook" });

  const { data: initializeEvents } = useScaffoldEventHistory({
    contractName: "PoolManager",
    eventName: "Initialize",
    fromBlock: HOOK_DEPLOY_BLOCK,
    watch: true,
    enabled: !!hook?.address,
  });

  const pools = useMemo(() => {
    return (initializeEvents || [])
      .filter((e: any) => e.args?.hooks?.toLowerCase() === hook?.address?.toLowerCase())
      .map((e: any) => {
        const currency0 = String(e.args?.currency0 || "").toLowerCase();
        const currency1 = String(e.args?.currency1 || "").toLowerCase();
        return {
          id: e.args?.id as `0x${string}`,
          fee: Number(e.args?.fee),
          tickSpacing: Number(e.args?.tickSpacing),
          pairLabel: `${symbolByAddress[currency0] || currency0.slice(0, 6)} / ${symbolByAddress[currency1] || currency1.slice(0, 6)}`,
        };
      });
  }, [initializeEvents, hook?.address]);

  return (
    <select
      className="select select-bordered w-full"
      value={value}
      onChange={e => onChange(e.target.value as `0x${string}` | "")}
    >
      <option value="">Choose a pool…</option>
      {pools.map(p => (
        <option key={p.id} value={p.id}>
          {p.pairLabel} | fee {p.fee} | ts {p.tickSpacing}
        </option>
      ))}
      {includeManual && <option value="manual">Manual input…</option>}
    </select>
  );
};
