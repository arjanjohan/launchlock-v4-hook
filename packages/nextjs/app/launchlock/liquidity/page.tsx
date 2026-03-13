"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeAbiParameters, formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const MAX_UINT160 = 2n ** 160n - 1n;
const MAX_UINT256 = 2n ** 256n - 1n;
const HOOK_DEPLOY_BLOCK = 46575788n;

const tokenOptions = [
  { symbol: "UNI", contractName: "DemoUNI" as const, address: "0x98E4D8B01561228Be089b04378adAECd39884016" },
  { symbol: "USDC", contractName: "DemoUSDC" as const, address: "0x81fC41ffA0B48462fa280e154bB288a245a7A263" },
  { symbol: "PEPE", contractName: "DemoPEPE" as const, address: "0x15B13dEF61E1AcCb4Ac356a2d13e0608f1643b9d" },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

const permit2ViewAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

const fullRangeTicks = (tickSpacing: number) => {
  const min = Math.ceil(-887272 / tickSpacing) * tickSpacing;
  const max = Math.floor(887272 / tickSpacing) * tickSpacing;
  return { tickLower: min, tickUpper: max };
};

const LiquidityPage = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: hook } = useDeployedContractInfo({ contractName: "LaunchLockHook" });
  const { data: posm } = useDeployedContractInfo({ contractName: "PositionManager" });
  const { data: permit2 } = useDeployedContractInfo({ contractName: "Permit2" });

  const [selectedPoolId, setSelectedPoolId] = useState<`0x${string}` | "">("");
  const [tokenId, setTokenId] = useState("");

  const [amount0Human, setAmount0Human] = useState("1");
  const [amount1Human, setAmount1Human] = useState("1");

  const [dec0, setDec0] = useState(18);
  const [dec1, setDec1] = useState(18);
  const [bal0, setBal0] = useState<bigint>(0n);
  const [bal1, setBal1] = useState<bigint>(0n);
  const [token0Ready, setToken0Ready] = useState(false);
  const [token1Ready, setToken1Ready] = useState(false);

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
    watch: false,
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

  const selectedPool = useMemo(() => pools.find(p => p.id === selectedPoolId), [pools, selectedPoolId]);
  const selectedPoolKey = selectedPool
    ? `${selectedPool.currency0}-${selectedPool.currency1}-${selectedPool.fee}-${selectedPool.tickSpacing}`
    : "";
  const { tickLower, tickUpper } = fullRangeTicks(selectedPool?.tickSpacing || 60);

  const tokenMeta0 = tokenOptions.find(t => t.address.toLowerCase() === selectedPool?.currency0?.toLowerCase());
  const tokenMeta1 = tokenOptions.find(t => t.address.toLowerCase() === selectedPool?.currency1?.toLowerCase());

  const amount0MaxRaw = useMemo(() => {
    try {
      return parseUnits(amount0Human || "0", dec0);
    } catch {
      return 0n;
    }
  }, [amount0Human, dec0]);

  const amount1MaxRaw = useMemo(() => {
    try {
      return parseUnits(amount1Human || "0", dec1);
    } catch {
      return 0n;
    }
  }, [amount1Human, dec1]);

  const liquidityAmountRaw = useMemo(() => {
    // Simple demo heuristic: use the smaller side as liquidity cap.
    // Keeps UX simple and avoids manual liquidity-unit entry.
    return amount0MaxRaw < amount1MaxRaw ? amount0MaxRaw : amount1MaxRaw;
  }, [amount0MaxRaw, amount1MaxRaw]);

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
    watch: false,
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

  const [filteredTokenIds, setFilteredTokenIds] = useState<string[]>([]);
  const myTokenIdsKey = myTokenIds.join(",");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!publicClient || !posm?.address || !selectedPool) {
        if (!cancelled) setFilteredTokenIds(prev => (prev.length ? [] : prev));
        return;
      }

      const next: string[] = [];
      for (const id of myTokenIds) {
        try {
          const res = (await publicClient.readContract({
            address: posm.address,
            abi: posm.abi,
            functionName: "getPoolAndPositionInfo",
            args: [BigInt(id)],
          })) as any;

          const key = res?.[0];
          if (!key) continue;

          const samePool =
            String(key.currency0).toLowerCase() === selectedPool.currency0.toLowerCase() &&
            String(key.currency1).toLowerCase() === selectedPool.currency1.toLowerCase() &&
            Number(key.fee) === selectedPool.fee &&
            Number(key.tickSpacing) === selectedPool.tickSpacing &&
            String(key.hooks).toLowerCase() === (hook?.address || "").toLowerCase();

          if (samePool) next.push(id);
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setFilteredTokenIds(prev => (prev.join(",") === next.join(",") ? prev : next));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [myTokenIdsKey, myTokenIds, selectedPoolKey, selectedPool, publicClient, posm?.address, posm?.abi, hook?.address]);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      if (!publicClient || !address || !selectedPool) {
        if (!cancelled) {
          setDec0(18);
          setDec1(18);
          setBal0(0n);
          setBal1(0n);
          setToken0Ready(false);
          setToken1Ready(false);
        }
        return;
      }

      try {
        const [d0, d1, b0, b1, a0, a1, p0, p1] = await Promise.all([
          publicClient.readContract({ address: selectedPool.currency0, abi: erc20Abi, functionName: "decimals" }),
          publicClient.readContract({ address: selectedPool.currency1, abi: erc20Abi, functionName: "decimals" }),
          publicClient.readContract({
            address: selectedPool.currency0,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }),
          publicClient.readContract({
            address: selectedPool.currency1,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }),
          publicClient.readContract({
            address: selectedPool.currency0,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address as `0x${string}`, permit2?.address as `0x${string}`],
          }),
          publicClient.readContract({
            address: selectedPool.currency1,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address as `0x${string}`, permit2?.address as `0x${string}`],
          }),
          publicClient.readContract({
            address: permit2?.address as `0x${string}`,
            abi: permit2ViewAbi,
            functionName: "allowance",
            args: [address as `0x${string}`, selectedPool.currency0, posm?.address as `0x${string}`],
          }),
          publicClient.readContract({
            address: permit2?.address as `0x${string}`,
            abi: permit2ViewAbi,
            functionName: "allowance",
            args: [address as `0x${string}`, selectedPool.currency1, posm?.address as `0x${string}`],
          }),
        ]);

        if (!cancelled) {
          setDec0(Number(d0));
          setDec1(Number(d1));
          setBal0(b0 as bigint);
          setBal1(b1 as bigint);
          const token0ReadyNow = (a0 as bigint) > 0n && ((p0 as readonly [bigint, number, number])?.[0] || 0n) > 0n;
          const token1ReadyNow = (a1 as bigint) > 0n && ((p1 as readonly [bigint, number, number])?.[0] || 0n) > 0n;
          setToken0Ready(token0ReadyNow);
          setToken1Ready(token1ReadyNow);
        }
      } catch {
        if (!cancelled) {
          setDec0(18);
          setDec1(18);
          setToken0Ready(false);
          setToken1Ready(false);
        }
      }
    };

    read();
    return () => {
      cancelled = true;
    };
  }, [publicClient, address, selectedPoolKey, selectedPool, permit2?.address, posm?.address]);

  const mintToken = async (symbol: string) => {
    const amount = 100000n * 10n ** 18n;
    const fn = symbol === "UNI" ? writeDemoUNI : symbol === "USDC" ? writeDemoUSDC : writeDemoPEPE;
    await fn({ functionName: "mint", args: [address as `0x${string}`, amount] });
    notification.success(`Minted ${symbol}`);
  };

  const approveTokenViaPermit2 = async (tokenAddress: `0x${string}`) => {
    await writePermit2({
      functionName: "approve",
      args: [tokenAddress, posm?.address as `0x${string}`, MAX_UINT160, 281474976710655],
    });
  };

  const approveErc20ToPermit2 = async (symbol: string) => {
    const fn = symbol === "UNI" ? writeDemoUNI : symbol === "USDC" ? writeDemoUSDC : writeDemoPEPE;
    await fn({ functionName: "approve", args: [permit2?.address as `0x${string}`, MAX_UINT256] });
  };

  const prepareSingleToken = async (tokenAddress: `0x${string}`, symbol: string, ready: boolean) => {
    if (ready) return;
    if (!publicClient || !address || !permit2?.address || !posm?.address) {
      notification.error("Missing wallet/network contracts");
      return;
    }

    const erc20Allowance = (await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address as `0x${string}`, permit2.address as `0x${string}`],
    })) as bigint;

    if (erc20Allowance === 0n) {
      await approveErc20ToPermit2(symbol);
    }

    const permitAllowance = (await publicClient.readContract({
      address: permit2.address as `0x${string}`,
      abi: permit2ViewAbi,
      functionName: "allowance",
      args: [address as `0x${string}`, tokenAddress, posm.address as `0x${string}`],
    })) as readonly [bigint, number, number];

    if ((permitAllowance?.[0] || 0n) === 0n) {
      await approveTokenViaPermit2(tokenAddress);
    }

    notification.success(`${symbol} approvals are ready`);
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
      [key, tickLower, tickUpper, liquidityAmountRaw, amount0MaxRaw, amount1MaxRaw, address as `0x${string}`, "0x"],
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

      {selectedPool && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body space-y-2">
            <h2 className="card-title">Prep (Demo)</h2>
            <div className="flex gap-2 flex-wrap">
              {tokenMeta0 && (
                <button className="btn btn-sm" onClick={() => mintToken(tokenMeta0.symbol)}>
                  Mint {tokenMeta0.symbol}
                </button>
              )}
              {tokenMeta1 && (
                <button className="btn btn-sm" onClick={() => mintToken(tokenMeta1.symbol)}>
                  Mint {tokenMeta1.symbol}
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {tokenMeta0 && (
                <button
                  className="btn btn-sm btn-outline"
                  disabled={token0Ready}
                  onClick={() =>
                    prepareSingleToken(selectedPool.currency0, tokenMeta0.symbol, token0Ready).catch(e =>
                      notification.error(getParsedError(e)),
                    )
                  }
                >
                  {token0Ready ? `${tokenMeta0.symbol} approved` : `Approve ${tokenMeta0.symbol}`}
                </button>
              )}
              {tokenMeta1 && (
                <button
                  className="btn btn-sm btn-outline"
                  disabled={token1Ready}
                  onClick={() =>
                    prepareSingleToken(selectedPool.currency1, tokenMeta1.symbol, token1Ready).catch(e =>
                      notification.error(getParsedError(e)),
                    )
                  }
                >
                  {token1Ready ? `${tokenMeta1.symbol} approved` : `Approve ${tokenMeta1.symbol}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPool && (
        <>
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body space-y-2">
              <h2 className="card-title">Add Liquidity</h2>
              <div className="text-sm opacity-80">
                Pair: {tokenMeta0?.symbol || "Token0"} / {tokenMeta1?.symbol || "Token1"}
              </div>
              <div className="text-xs opacity-70">
                Balance {tokenMeta0?.symbol || "Token0"}: {formatUnits(bal0, dec0)}
              </div>
              <input
                className="input input-bordered"
                value={amount0Human}
                onChange={e => setAmount0Human(e.target.value)}
                placeholder={`${tokenMeta0?.symbol || "Token0"} amount`}
              />

              <div className="text-xs opacity-70">
                Balance {tokenMeta1?.symbol || "Token1"}: {formatUnits(bal1, dec1)}
              </div>
              <input
                className="input input-bordered"
                value={amount1Human}
                onChange={e => setAmount1Human(e.target.value)}
                placeholder={`${tokenMeta1?.symbol || "Token1"} amount`}
              />

              <details className="collapse collapse-arrow bg-base-200">
                <summary className="collapse-title text-sm">Advanced liquidity units</summary>
                <div className="collapse-content text-xs opacity-70">
                  Auto-generated liquidity units: {liquidityAmountRaw.toString()}
                </div>
              </details>

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
              <select
                className="select select-bordered w-full"
                value={tokenId}
                onChange={e => setTokenId(e.target.value)}
              >
                <option value="">Choose your position tokenId…</option>
                {filteredTokenIds.map(id => (
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
        </>
      )}

      <div className="text-xs opacity-70">If tx fails, use the demo mint and permit buttons first for pool tokens.</div>
    </div>
  );
};

export default LiquidityPage;
