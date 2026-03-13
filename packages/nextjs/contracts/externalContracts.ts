import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const poolManagerAbi = [
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "sqrtPriceX96", type: "uint160" },
    ],
    outputs: [{ name: "tick", type: "int24" }],
  },
  {
    type: "event",
    name: "Initialize",
    anonymous: false,
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "currency0", type: "address", indexed: true },
      { name: "currency1", type: "address", indexed: true },
      { name: "fee", type: "uint24", indexed: false },
      { name: "tickSpacing", type: "int24", indexed: false },
      { name: "hooks", type: "address", indexed: false },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "tick", type: "int24", indexed: false },
    ],
  },
] as const;

const launchLockHookAbi = [
  {
    type: "function",
    name: "initializeLaunchLock",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "poolOwner", type: "address" },
      { name: "lockEndTime", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "launchConfigs",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "initialized", type: "bool" },
      { name: "poolOwner", type: "address" },
      { name: "lockEndTime", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "groupConfigs",
    stateMutability: "view",
    inputs: [
      { name: "", type: "bytes32" },
      { name: "", type: "bytes32" },
    ],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "enabled", type: "bool" },
      { name: "lockEndTime", type: "uint64" },
    ],
  },
  {
    type: "event",
    name: "GroupConfigured",
    anonymous: false,
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "groupId", type: "bytes32", indexed: true },
      { name: "enabled", type: "bool", indexed: false },
      { name: "lockEndTime", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionGroupAssigned",
    anonymous: false,
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "positionKey", type: "bytes32", indexed: true },
      { name: "groupId", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "LaunchLockInitialized",
    anonymous: false,
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "poolOwner", type: "address", indexed: true },
      { name: "lockEndTime", type: "uint64", indexed: false },
    ],
  },
] as const;

const placeholderAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const positionManagerAbi = [
  {
    type: "function",
    name: "modifyLiquidities",
    stateMutability: "payable",
    inputs: [
      { name: "unlockData", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPositionLiquidity",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "liquidity", type: "uint128" }],
  },
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

const erc20DemoAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const externalContracts = {
  1301: {
    PoolManager: {
      address: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC",
      abi: poolManagerAbi,
    },
    PositionManager: {
      address: "0xf969Aee60879C54bAAed9F3eD26147Db216Fd664",
      abi: positionManagerAbi,
    },
    Permit2: {
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      abi: permit2Abi,
    },
    V4SwapRouter: {
      address: "0x9cD2b0a732dd5e023a5539921e0FD1c30E198Dba",
      abi: placeholderAbi,
    },
    LaunchLockHookExternal: {
      address: "0x0B14cF682D7dC7eBdB5461af0c31d5199aE24A00",
      abi: launchLockHookAbi,
    },
    DemoUNI: {
      address: "0x98E4D8B01561228Be089b04378adAECd39884016",
      abi: erc20DemoAbi,
    },
    DemoUSDC: {
      address: "0x81fC41ffA0B48462fa280e154bB288a245a7A263",
      abi: erc20DemoAbi,
    },
    DemoPEPE: {
      address: "0x15B13dEF61E1AcCb4Ac356a2d13e0608f1643b9d",
      abi: erc20DemoAbi,
    },
  },
  11155111: {
    PoolManager: {
      address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
      abi: poolManagerAbi,
    },
    PositionManager: {
      address: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",
      abi: placeholderAbi,
    },
    Permit2: {
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      abi: placeholderAbi,
    },
    V4SwapRouter: {
      address: "0xf13D190e9117920c703d79B5F33732e10049b115",
      abi: placeholderAbi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
