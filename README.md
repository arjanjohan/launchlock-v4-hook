# LaunchLock — Uniswap v4 Hook


<div align="center">

![logo](/nextjs/public/logo.png)
<h4 align="center">
  <a href="https://launchlock-ruby.vercel.app/">App</a>
</h4>
</div>

LaunchLock is a Uniswap v4 hook that enforces time-based liquidity lock windows for token launches. At launch, nobody knows if liquidity will stay. LaunchLock makes that guarantee protocol-native, transparent, and auditable.

- 🔒 **Time-locked liquidity**: Pool owners set lock durations that are enforced directly in the Uniswap v4 pool lifecycle.
- 🔀 **Two lock modes**: General lock for all pool liquidity, or group-specific locks per LP address.
- 🪝 **Hook architecture**: `beforeAddLiquidity` enforces initialization guardrails; `beforeRemoveLiquidity` enforces lock expiry.
- 🛡️ **Owner-controlled**: Pool-level initialization and config functions give launch teams full control over lock behavior.

## How It Works

1. **Create Pool** — Deploy and initialize a Uniswap v4 pool with the LaunchLock hook attached.
2. **Configure Lock Schema** — Set lock durations and optionally assign group-specific locks for individual LPs.
3. **Manage Liquidity** — Add/remove liquidity with lock-aware validation. Removal is blocked until the lock expires.

## Contracts

- `LaunchLockHook.sol` — The core v4 BaseHook with `beforeAddLiquidity` and `beforeRemoveLiquidity` permissions.
- `DemoToken.sol` — ERC-20 demo tokens for local testing.

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))

## Quickstart

1. Install dependencies:

```
yarn install
```

2. Run a local network in the first terminal:

```
yarn chain
```

3. On a second terminal, deploy the contracts:

```
yarn deploy
```

4. On a third terminal, start the frontend:

```
yarn start
```

Visit your app on: `http://localhost:3000`.

5. Run smart contract tests:

```
yarn foundry:test
```

## Built With

- [Scaffold-ETH 2](https://scaffoldeth.io)
- [Uniswap v4](https://docs.uniswap.org/)
