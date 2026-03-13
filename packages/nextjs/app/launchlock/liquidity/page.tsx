"use client";

import { useMemo, useState } from "react";
import { encodeAbiParameters } from "viem";
import { useAccount } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const MAX_UINT160 = (2n ** 160n - 1n).toString();

const HOOK_DEPLOY_BLOCK = 46575788n;

const tokenOptions = [
  { symbol: "UNI", contractName: "DemoUNI" as const, address: "0x98E4D8B01561228Be089b04378adAECd39884016" },
  { symbol: "USDC", contractName: "DemoUSDC" as const, address: "0x81fC41ffA0B48462fa280e154bB288a245a7A263" },
  { symbol: "PEPE", contractName: "DemoPEPE" as const, address: "0x15B13dEF61E1AcCb4Ac356a2d13e0608f1643b9d" },
] as const;

const fullRangeTicks = (tickSpacing: number) => {
  const min = Math.ceil(-887272 / tickSpacing) * tickSpacing;
  const max = Math.floor(887272 / tickSpacing) * tickSpacing;
  return { tickLower: min, tickUpper: max };
};

const LiquidityPage = () => {
  const { address } = useAccount();
  const { data: hook } = useDeployedContractInfo({ contractName: "LaunchLockHook" });
  const { data: posm } = useDeployedContractInfo({ contractName: "PositionManager" });

  const [selectedPoolId, setSelectedPoolId] = useState<`0x${string}` | "">("");
  const [tokenId, setTokenId] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("1000000000000000000");
  const [amount0Max, setAmount0Max] = useState("1000000000000000000");
  const [amount1Max, setAmount1Max] = useState("1000000000000000000");

  const { writeContractAsync: writePosm, isMining: isPosmPending } = useScaffoldWriteContract({
    contractName: "PositionManager",
  });
  const { writeContractAsync: writePermit2 } = useScaffoldWriteContract({ contractName: "Permit2" });
  const { writeContractAsync: writeDemoUNI } = useScaffoldWriteContract({ contractName: "DemoUNI" });
  const { writeContractAsync: writeDemoUSDC } = useScaffoldWriteContract({ contractName: "DemoUSDC" });
  const { writeContractAsync: writeDemoPEPE } = useScaffoldWriteContract({ contractName: "DemoPEPE" });

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
      .map((e: any) => ({
        id: e.args?.id as `0x${string}`,
        currency0: e.args?.currency0 as `0x${string}`,
        currency1: e.args?.currency1 as `0x${string}`,
        fee: Number(e.args?.fee),
        tickSpacing: Number(e.args?.tickSpacing),
      }));
  }, [initializeEvents, hook?.address]);

  const selectedPool = pools.find(p => p.id === selectedPoolId);
  const { tickLower, tickUpper } = fullRangeTicks(selectedPool?.tickSpacing || 60);

  const { data: currentLiquidity } = useScaffoldReadContract({
    contractName: "PositionManager",
    functionName: "getPositionLiquidity",
    args: [tokenId ? BigInt(tokenId) : undefined],
    query: { enabled: !!tokenId },
  });

  const { data: transferEvents } = useScaffoldEventHistory({
    contractName: "PositionManager",
    eventName: "Transfer",
    fromBlock: HOOK_DEPLOY_BLOCK,
    watch: true,
    enabled: !!address,
  });

  const myTokenIds = useMemo(() => {
    if (!address) return [] as string[];
    const mine = new Set<string>();
    for (const ev of transferEvents || []) {
      const from = String(ev.args?.from || "").toLowerCase();
      const to = String(ev.args?.to || "").toLowerCase();
      const id = BigInt(ev.args?.tokenId || 0n).toString();
      if (to === address.toLowerCase()) mine.add(id);
      if (from === address.toLowerCase()) mine.delete(id);
    }
    return Array.from(mine).sort((a, b) => Number(b) - Number(a));
  }, [transferEvents, address]);

  const mintToken = async (symbol: string) => {
    const amount = 100000n * 10n ** 18n;
    const fn = symbol === "UNI" ? writeDemoUNI : symbol === "USDC" ? writeDemoUSDC : writeDemoPEPE;
    await fn({ functionName: "mint", args: [address as `0x${string}`, amount] });
    notification.success(`Minted ${symbol}`);
  };

  const approveToken = async (tokenAddress: `0x${string}`) => {
    await writePermit2({
      functionName: "approve",
      args: [tokenAddress, posm?.address as `0x${string}`, BigInt(MAX_UINT160), 281474976710655],
    });
    notification.success("Permit2 approval set");
  };

  const addFullRange = async () => {
    if (!selectedPool || !address) return;

    const key = {
      currency0: selectedPool.currency0,
      currency1: selectedPool.currency1,
      fee: selectedPool.fee,
      tickSpacing: selectedPool.tickSpacing,
      hooks: hook?.address as `0x${string}`,
    };

    const p0 = encodeAbiParameters(
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
        { type: "int24" },
        { type: "int24" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes" },
      ],
      [
        key,
        tickLower,
        tickUpper,
        BigInt(liquidityAmount),
        BigInt(amount0Max),
        BigInt(amount1Max),
        address as `0x${string}`,
        "0x",
      ],
    );

    const p1 = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }],
      [selectedPool.currency0, selectedPool.currency1],
    );
    const p2 = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }],
      [selectedPool.currency0, address as `0x${string}`],
    );
    const p3 = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }],
      [selectedPool.currency1, address as `0x${string}`],
    );

    const unlockData = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], ["0x020d1414", [p0, p1, p2, p3]]);

    await writePosm({
      functionName: "modifyLiquidities",
      args: [unlockData, BigInt(Math.floor(Date.now() / 1000) + 1200)],
    });
    notification.success("Add liquidity tx sent");
  };

  const removeFullRange = async () => {
    if (!selectedPool || !address || !tokenId || !currentLiquidity) return;

    const p0 = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }],
      [BigInt(tokenId), BigInt(currentLiquidity as bigint), 0n, 0n, "0x"],
    );
    const p1 = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "address" }],
      [selectedPool.currency0, selectedPool.currency1, address as `0x${string}`],
    );

    const unlockData = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], ["0x0111", [p0, p1]]);

    await writePosm({
      functionName: "modifyLiquidities",
      args: [unlockData, BigInt(Math.floor(Date.now() / 1000) + 1200)],
    });
    notification.success("Remove liquidity tx sent");
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Liquidity (Full Range Only)</h1>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-2">
          <h2 className="card-title">Pool</h2>
          <select
            className="select select-bordered w-full"
            value={selectedPoolId}
            onChange={e => setSelectedPoolId(e.target.value as `0x${string}`)}
          >
            <option value="">Choose pool…</option>
            {pools.map(p => (
              <option key={p.id} value={p.id}>
                {p.id} | fee {p.fee} | spacing {p.tickSpacing}
              </option>
            ))}
          </select>
          <div className="text-xs opacity-70">
            Ticks used: {tickLower} to {tickUpper} (full range)
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-2">
          <h2 className="card-title">Prep (Demo)</h2>
          <div className="flex gap-2 flex-wrap">
            {tokenOptions.map(t => (
              <button key={t.symbol} className="btn btn-sm" onClick={() => mintToken(t.symbol)}>
                Mint {t.symbol}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {tokenOptions.map(t => (
              <button
                key={t.symbol}
                className="btn btn-sm btn-outline"
                onClick={() => approveToken(t.address as `0x${string}`)}
              >
                Permit2 approve {t.symbol}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-2">
          <h2 className="card-title">Add Liquidity</h2>
          <input
            className="input input-bordered"
            value={liquidityAmount}
            onChange={e => setLiquidityAmount(e.target.value)}
            placeholder="liquidity (uint256)"
          />
          <input
            className="input input-bordered"
            value={amount0Max}
            onChange={e => setAmount0Max(e.target.value)}
            placeholder="amount0Max"
          />
          <input
            className="input input-bordered"
            value={amount1Max}
            onChange={e => setAmount1Max(e.target.value)}
            placeholder="amount1Max"
          />
          <button
            className="btn btn-primary"
            disabled={!selectedPool || isPosmPending}
            onClick={() => addFullRange().catch(e => notification.error(getParsedError(e)))}
          >
            Add Full Range Liquidity
          </button>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body space-y-2">
          <h2 className="card-title">Remove Liquidity</h2>
          <select className="select select-bordered w-full" value={tokenId} onChange={e => setTokenId(e.target.value)}>
            <option value="">Choose your position tokenId…</option>
            {myTokenIds.map(id => (
              <option key={id} value={id}>
                #{id}
              </option>
            ))}
          </select>
          <details className="collapse collapse-arrow bg-base-200">
            <summary className="collapse-title text-sm">Manual tokenId input</summary>
            <div className="collapse-content">
              <input
                className="input input-bordered w-full"
                value={tokenId}
                onChange={e => setTokenId(e.target.value)}
                placeholder="Position tokenId"
              />
            </div>
          </details>
          <div className="text-xs opacity-70">
            Current liquidity: {currentLiquidity ? (currentLiquidity as bigint).toString() : "-"}
          </div>
          <button
            className="btn btn-secondary"
            disabled={!selectedPool || !tokenId || !currentLiquidity || isPosmPending}
            onClick={() => removeFullRange().catch(e => notification.error(getParsedError(e)))}
          >
            Remove Full Liquidity
          </button>
        </div>
      </div>

      <div className="text-xs opacity-70">If add tx fails, run mint + Permit2 approve first for both pool tokens.</div>
    </div>
  );
};

export default LiquidityPage;
