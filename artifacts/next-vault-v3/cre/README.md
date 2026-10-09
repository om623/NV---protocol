# NV Protocol — Chainlink CRE Workflows

This directory contains Chainlink Runtime Environment (CRE) workflows for NV Protocol.
It is **completely isolated from the Vite/React frontend build** — the app bundler
never processes files here.

## Structure

```
cre/
└── workflows/
    └── nv-market-data/     ← Cron-based market data fetcher
        ├── main.ts          ← Workflow source (TypeScript → compiled to WASM)
        ├── package.json     ← Workflow-specific deps (@chainlink/cre-sdk)
        ├── tsconfig.json    ← Workflow-specific tsconfig
        ├── workflow.yaml    ← CRE deployment config (staging + production targets)
        └── config.staging.json ← Runtime configuration for staging
```

## What the workflow does

`nv-market-data` runs every 5 minutes on a Chainlink DON:

1. Each DON node independently fetches crypto prices from CoinGecko.
2. Each DON node independently fetches TVL data from DeFiLlama.
3. The DON applies consensus (median for prices, identical for TVL rankings).
4. The verified result is emitted as a `market_data_report` event.

## Prerequisites to deploy

| Requirement | How to get it |
|---|---|
| CRE CLI | `npm i -g @chainlink/cre-cli` or download from GitHub |
| CRE developer access | Apply at https://chain.link/developers |
| CRE login session | `cre login` (opens browser, SSO) |
| Funded signing key (on-chain registry only) | Fund the key printed by `cre keys list` |

## Local setup (per workflow directory)

```bash
cd cre/workflows/nv-market-data
bun install
```

## Local simulation (no DON needed)

```bash
cd cre/workflows/nv-market-data
cre workflow simulate --target staging-settings --config config.staging.json main.ts
```

Simulation runs the workflow locally using mock DON nodes. It validates the
TypeScript, checks for unsupported APIs (Node built-ins / browser globals),
and shows the consensus output — without touching any blockchain.

## Compilation

```bash
cd cre/workflows/nv-market-data
cre compile:workflow main.ts
```

Outputs a WASM binary. Required before deployment.

## Deployment (requires CRE access + funded key)

```bash
cd cre/workflows/nv-market-data
cre workflow deploy --target staging-settings
```

## Integration with NV Agent

Once deployed, the workflow emits `market_data_report` events. To integrate
with the NV Agent context (`src/lib/agentContext.ts`), two options exist:

1. **On-chain contract**: The workflow writes to an on-chain contract via
   `cre.capabilities.EVMClient`. The frontend polls the contract via
   `read_contract` and merges the result into `NVAgentContext.market`.

2. **Webhook**: The workflow emits to a webhook endpoint (`src/server/`).
   The frontend polls the endpoint, and the server pushes via SSE.

Option 1 is recommended — no backend server required, data is verifiable
on-chain, and the existing NV Protocol frontend can read it directly.

## Current status

| Step | Status |
|---|---|
| Workflow authored | ✅ Complete |
| Workflow compiles | ⏳ Requires `bun install` + CRE CLI |
| Simulation passes | ⏳ Requires CRE CLI installed |
| Deployed to staging | ⛔ Requires CRE developer access (external) |
| Deployed to production | ⛔ Requires CRE developer access + funded key |
| NV Agent reads workflow output | ⛔ Requires on-chain contract or webhook endpoint |
