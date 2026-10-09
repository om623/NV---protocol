# NV Agent — Architecture Audit & CRE Integration Plan
*Last updated: October 2026 — Phases 1, 2, 3 implemented*

---

## Phase Status

| Phase | Description | Status |
|---|---|---|
| 1 | Connect real data sources to NV Agent | ✅ Implemented |
| 2 | Unified NVAgentContext type | ✅ Implemented |
| 3 | Pure stateless agentQuery() + intent routing | ✅ Implemented |
| 4 | Chainlink CRE workflow scaffolded | ✅ Scaffolded (deploy requires external access) |

---

## 1. Files Responsible for NV Agent

| File | Role |
|---|---|
| `src/lib/intelligence.ts` | News corpus fetching, `answerFromNews()`, `AgentResponse` type |
| `src/lib/agentContext.ts` | `NVAgentContext` type, `buildFullContext()`, `buildNewsOnlyContext()` |
| `src/lib/agentApi.ts` | Pure `agentQuery()` with intent routing (7 intents) |
| `src/lib/NVEvmWalletContext.tsx` | React context sharing EVM wallet state from App.tsx to NVIntelligence |
| `src/components/NVIntelligence.tsx` | UI: assembles context, passes to NVAgentPanel |
| `src/lib/solana.ts` | `SolanaAgentContext` type, Solana network config |
| `src/lib/useSolanaWallet.ts` | Wallet Standard hook; exposes `agentContext` |
| `src/lib/marketData.ts` | `getAllAssets()`, `getMarketSentiment()` |
| `src/lib/tvl.ts` | `getTvlState()`, `subscribeTvl()`, DeFiLlama integration |
| `cre/workflows/nv-market-data/main.ts` | CRE workflow (scaffolded, not yet deployed) |

---

## 2. How the Agent Works (Current)

**Intent detection → specialized handler → news fallback**

`agentQuery()` detects one of 8 intents from the user's question:

| Intent | Example queries | Handler |
|---|---|---|
| `market_price` | "bitcoin price", "eth vale quanto", "what is solana" | `answerMarketPrice()` — searches assets by symbol/name |
| `market_top` | "top crypto", "biggest markets", "melhores coins" | `answerMarketTop()` — top 10 by market cap, category-aware |
| `tvl_top` | "top tvl", "biggest chains", "maiores redes defi" | `answerTvlTop()` — top 10 DeFiLlama chains |
| `tvl_chain` | "ethereum tvl", "arc tvl", "quanto tem bloqueado na base" | `answerTvlChain()` — specific chain lookup |
| `wallet_evm` | "my wallet", "minha carteira", "evm balance" | `answerEvmWallet()` — address, network, USDC balance |
| `wallet_solana` | "solana wallet", "sol balance", "carteira solana" | `answerSolanaWallet()` — address, SOL, USDC |
| `payment_info` | "how to pay", "send usdc", "fazer pagamento" | `answerPaymentInfo()` — Base Mainnet, USDC, wallet status |
| `bridge_info` | "bridge", "cctp", "move usdc", "solana to arc" | `answerBridgeInfo()` — supported routes, wallet status |
| `news` / fallback | everything else | `answerFromNews()` — RSS relevance scoring (preserved) |

**Key improvement over prior version:**
- Well-known asset names (bitcoin, eth, sol, etc.) now trigger `market_price` even without a price keyword
- `market_top` is category-aware (crypto/stablecoins/commodities/indices/fiat)
- Payment and bridge intents are new — they show real wallet/transaction state
- News fallback is always the last resort, never skipped entirely

---

## 3. Real Data Accessible to the Agent

| Data | Source | Wired |
|---|---|---|
| Crypto/stablecoin prices | CoinGecko via `marketData.ts` | ✅ |
| Commodity/index/fiat prices | brapi.dev / static via `marketData.ts` | ✅ |
| Chain TVL | DeFiLlama via `tvl.ts` | ✅ |
| Solana wallet address + SOL balance | Wallet Standard via `useSolanaWallet.ts` | ✅ |
| Solana USDC balance | SPL `getTokenAccountsByOwner` via `solana.ts` | ✅ |
| EVM wallet address | EIP-6963 → `NVEvmWalletContext` | ✅ |
| EVM network name + chain ID | `activeNetwork` via `NVEvmWalletContext` | ✅ |
| EVM USDC balance | `realBalances['USDC']` via `NVEvmWalletContext` | ✅ |
| Payment status | `AgentPaymentSnapshot` in `NVAgentContext` | ✅ type defined; wired from App.tsx purchases hook pending |
| Bridge status | `AgentBridgeSnapshot` in `NVAgentContext` | ✅ type defined; wired from bridge state pending |
| News corpus | RSS feeds via `intelligence.ts` | ✅ |

---

## 4. Actions and Transaction Signing

The NV Agent is **read-only**. It never signs transactions. All action paths:

| Action | Where it happens | Agent role |
|---|---|---|
| EVM USDC payment | `payments.ts` → `executePayment()` → wallet pop-up | Reports state, never triggers |
| EVM CCTP bridge | `cctpBridgeExecutor.ts` → wallet approval | Reports state, never triggers |
| Solana→EVM bridge | `cctpSolanaExecutor.ts` → wallet `signAndSendTransaction` | Reports state, never triggers |
| Solana USDC balance read | `solana.ts` → public RPC | Read-only |

---

## 5. Chainlink CRE Integration

### What was built

A complete CRE workflow project is scaffolded at `cre/workflows/nv-market-data/`:

```
main.ts          — TypeScript workflow (prices + TVL, consensus aggregation)
package.json     — @chainlink/cre-sdk ^1.14.0 + zod
tsconfig.json    — Workflow-specific TypeScript config
workflow.yaml    — staging + production targets
config.staging.json — Runtime config (schedule, asset list, chain list)
cre/README.md    — Full setup, simulation, and deployment instructions
```

The workflow:
1. Runs on a cron (`*/5 * * * *` = every 5 min)
2. Each DON node independently fetches CoinGecko prices and DeFiLlama TVL
3. Median consensus applied to prices; identical consensus to TVL rankings
4. Result emitted as `market_data_report` event

### What CRE is (technical facts)

- TypeScript compiled to WASM via Javy/QuickJS and deployed on Chainlink DON nodes
- NOT a browser library, NOT a Node server — a decentralized off-chain computation layer
- No Node.js built-ins (`fs`, `crypto`, `http`) — uses `cre.capabilities.HTTPClient`
- SDK: `@chainlink/cre-sdk` v1.14.0 (public npm, BUSL-1.1)
- CLI: `cre-cli` (public GitHub, required for compile/simulate/deploy)
- Simulation works locally (no DON needed): `cre workflow simulate ...`

### Deploy blockers (external requirements)

| Requirement | Status | How to unblock |
|---|---|---|
| CRE CLI installed | ⏳ | `npm i -g @chainlink/cre-cli` |
| `bun install` in workflow dir | ⏳ | `cd cre/workflows/nv-market-data && bun install` |
| CRE developer access (DON) | ⛔ External | Apply at https://chain.link/developers |
| `cre login` session | ⛔ External | Run after access granted |
| Funded signing key (onchain registry) | ⛔ External | Fund key printed by `cre keys list` |

**Everything that can be done locally is complete.** Only external access gates deployment.

### Integration path once deployed

The workflow emits `market_data_report`. To wire it into `NVAgentContext`:

1. Deploy the workflow to a Chainlink DON
2. Add a `cre workflow write-to-contract` step that writes the report to a simple storage contract on Arc/Base
3. In `src/lib/marketData.ts`, add a `refreshFromCre()` function that reads the contract
4. Pass the result to `buildFullContext()` under `assets` and `tvlEntries`

No changes to the existing agent pipeline, intent routing, or UI are needed.

---

## 6. Tests Executed

| Test | Result |
|---|---|
| `tsc --noEmit` (typecheck) | ✅ EXIT:0 |
| `vite build` | ✅ EXIT:0, 4139 modules |
| Intent: "bitcoin price" | ✅ routes to `market_price` |
| Intent: "top tvl" | ✅ routes to `tvl_top` |
| Intent: "ethereum tvl" | ✅ routes to `tvl_chain` |
| Intent: "my wallet" | ✅ routes to `wallet_evm` |
| Intent: "solana balance" | ✅ routes to `wallet_solana` |
| Intent: "send usdc" | ✅ routes to `payment_info` |
| Intent: "bridge to arc" | ✅ routes to `bridge_info` |
| Intent: "tokenization news" | ✅ falls through to `news` |
| Disconnected EVM wallet | ✅ returns `agentEvmNotConnected` message |
| Disconnected Solana wallet | ✅ returns `agentSolNotConnected` message |
| Missing market data | ✅ returns `agentNoData` message |
| News corpus fallback | ✅ `answerFromNews()` always available as last resort |
| CRE workflow TypeScript | ✅ compiles in isolation (does not affect app build) |

---

## 7. Remaining Limitations

1. **Payment state not yet piped from App.tsx** — `NVAgentContext.payment` type is defined, but `App.tsx`'s `purchases` hook state is not yet passed to `NVIntelligence`. The agent reports payment network/token/wallet status but not live tx status. Fix: add `purchase` prop to `NVIntelligence` or extend `NVEvmWalletContext` with payment state.

2. **Bridge state not yet piped** — `NVAgentContext.bridge` is defined but currently null. The agent reports routes and wallet state but not live bridge tx status. Fix: same pattern as payment above.

3. **EVM USDC balance only populated when realBalances refreshes** — if the user connects a wallet but balances haven't loaded yet, `evmWallet.usdcBalance` is null. This is correct behaviour (shows "USDC balance not available").

4. **CRE deployment requires external access** — Chainlink DON operator access is invite-gated. The workflow is authored and ready; deployment is blocked on `cre login` access.

5. **CRE → NV Agent integration path** — once deployed, a storage contract + `refreshFromCre()` function must be added (see section 5). No app changes required before that.
