# NV Agent — Read-Only Audit & CRE Integration Roadmap
> Generated: October 9, 2026 | Read-only analysis of `artifacts/next-vault-v3/src`

---

## 1. Files and Components Responsible for NV Agent

### Primary files

| File | Role |
|---|---|
| `src/lib/intelligence.ts` | Core logic: news types, 40+ RSS providers, `answerFromNews()`, `fetchAllNews()`, event clustering, editorial priority scoring, voice broadcast queue |
| `src/components/NVIntelligence.tsx` | Full UI shell: three-tab view (Feed · Agent · NV News), `NVAgentPanel`, `NVNewsPanel`, filter engine, breaking ticker |
| `src/lib/solana.ts` | `SolanaAgentContext` interface — structured read-only snapshot of wallet state + balances, **explicitly labelled "intended for future NV Agent queries"** |
| `src/lib/useSolanaWallet.ts` | Populates and exposes `agentContext` (Solana wallet, SOL balance, USDC balance, network, mint address) |

### Supporting data layers the agent could read

| File | Data available |
|---|---|
| `src/lib/api.ts` | CoinGecko crypto prices + sparklines, BTC dominance, total market cap, Fear & Greed Index, DeFiLlama chain TVL |
| `src/lib/marketData.ts` | All `MarketAsset` entries: crypto, stablecoins, commodities, indices, fiat |
| `src/lib/tvl.ts` | 27-network TVL from DeFiLlama, `TvlState` (loaded/loading/error) |
| `src/lib/commodities.ts` | Commodity prices (Supabase/Yahoo Finance proxy, optional) |
| `src/lib/indices.ts` | Equity index prices (same proxy) |
| `src/lib/equities.ts` | Brazilian + global equities via brapi.dev |
| `src/lib/bridge.ts` / `cctpBridge.ts` | EVM bridge route state, CCTP parameters |
| `src/lib/cctpSolana.ts` | Solana→EVM bridge parameters, account structures |
| `src/lib/walletDiscovery.ts` | EIP-6963 discovered EVM wallets, provider objects |

---

## 2. How the Agent Receives Messages, Interprets Requests and Generates Responses

### Message loop (entirely client-side, no LLM)

```
User types → handleSend() in NVAgentPanel
  → appends user message to local state
  → setTimeout(350ms)  ← synthetic "thinking" delay
  → answerFromNews(question, news, locale, t)   [src/lib/intelligence.ts]
  → appends assistant response
```

### `answerFromNews()` algorithm

1. **Tokenise** the question (lowercase, strip punctuation, words > 2 chars).
2. **Geo routing**: match keywords against `AGENT_GEO_MAP` (45 country/region keyword patterns).
3. **Category routing**: match against `AGENT_CAT_MAP` (13 category patterns).
4. **Score every loaded `NewsItem`**: +3 title match / +1 body match / +2 geo match / +2 category match.
5. **Select top 7** by score, then priority, then recency.
6. **Build a structured answer** from real article titles + 150-char summaries, framed by the locale's i18n template (`intel.agentAnswer` / `intel.agentAnswerContext`).
7. Return `{ answer: string, sources: SourceRef[] }` — sources link to real articles.

**There is no LLM, no API call to an inference backend.** The agent is a deterministic keyword-scoring retrieval system over the currently loaded RSS corpus (up to 400 items, refreshed every 30 s).

---

## 3. Real Data the Agent Can Currently Access

### Already loaded into the same React component tree

| Data | Source | Freshness | Agent access |
|---|---|---|---|
| Up to 400 international news items (40+ RSS feeds) | rss2json.com proxy | 30 s | **Direct** — passed as `news` prop to `NVAgentPanel` |
| Event clusters (Jaccard-similarity groups) | Computed in `intelligence.ts` | 30 s | In parent state, not passed to agent panel |
| Breaking news count, active sources | Derived from news array | 30 s | In parent state |

### Available in other modules but **not wired to the agent today**

| Data | Source file | Gap |
|---|---|---|
| Crypto prices, sparklines, market cap, Fear & Greed | `api.ts` → `marketData.ts` | `getAllAssets()` is not passed to `answerFromNews` |
| TVL (27 networks) | `tvl.ts` | `getTvlState()` not exposed to agent |
| Commodities / indices | `commodities.ts`, `indices.ts` | Optional Supabase proxy; not passed to agent |
| Fiat exchange rates | `marketData.ts` | Not passed to agent |
| EVM wallet — connected address, chain, native + USDC balance | `WalletView.tsx` / EIP-6963 | Not passed to agent |
| Solana wallet + SOL + USDC balance | `useSolanaWallet` → `agentContext` | `agentContext` is not passed to `NVAgentPanel` |
| Bridge status (EVM or Solana→EVM) | `cctpBridgeExecutor.ts`, `cctpSolanaExecutor.ts` | Execution state not exposed globally |
| Swap state | `BridgeView.tsx` local state | Not exposed globally |

---

## 4. Executable Actions — Current and Potential

### What the agent can do today

The agent is **read-only and informational only**. It produces text answers. It cannot execute any onchain action.

### What the project infrastructure can execute (outside the agent)

| Action | Implementation location | Wallet confirmation | Signature required |
|---|---|---|---|
| EVM → EVM CCTP bridge | `cctpBridgeExecutor.ts` | MetaMask/EIP-6963 `eth_sendTransaction` | Yes — user signs in wallet UI |
| Solana → EVM CCTP bridge | `cctpSolanaExecutor.ts` | Wallet Standard `solana:signAndSendTransaction` | Yes — user signs in wallet UI |
| USDC payment (EVM) | `payments.ts` | MetaMask / EIP-1193 | Yes |
| Supabase purchase verification | `payments.ts` → edge function | N/A (server-side) | No |

**Confirmation/signature points**: every onchain action goes through a manual UI confirmation step (amount review modal) → wallet extension popup → user approves. There is no way to trigger any of these programmatically without the user clicking "Approve" in their wallet.

---

## 5. CRE Integration — Current State

**Zero CRE/Chainlink integration exists in the codebase.**

A search for `CRE`, `chainlink` (non-price), `CCIP`, `Functions`, `Automation`, `oracle` across all `.ts`/`.tsx` source files returns:
- `LINK` as a CoinGecko price asset in `api.ts` and `marketData.ts` — this is a market price feed, not a Chainlink protocol integration.
- No Chainlink contracts, no ABI references, no `@chainlink/` npm packages in `package.json`.
- No off-chain computation jobs, no oracle feeds, no Automation upkeepers.
- No Chainlink Runtime Environment SDK, no CRE workflow files, no TOML job specs.

---

## 6. What Is Missing for Real CRE Integration

### External components required

| Component | Purpose | Where to obtain |
|---|---|---|
| Chainlink Runtime Environment access | Host and execute agent jobs | Chainlink CRE developer program (invite-only as of Oct 2026); requires registration with Chainlink Labs |
| `@chainlink/cre-sdk` or equivalent | CRE job authoring and deployment SDK | Not yet public on npm; obtained via Chainlink developer portal |
| Chainlink Functions subscription | Pay for off-chain JavaScript execution (if using CL Functions as a CRE building block) | Chainlink Functions UI on any supported chain (Ethereum, Base, Arbitrum, etc.) — requires LINK for subscription |
| LINK token balance | Fund CRE jobs / Functions subscriptions | Purchase LINK; faucet on testnets |
| CRE Workflow TOML / YAML spec | Declarative job graph: triggers + tasks + outputs | Authored locally, deployed via CRE CLI |
| CRE Secrets Manager entry | Securely inject API keys into CRE jobs | CRE dashboard — never hardcode in source |

### Configuration and secrets required

| Env variable | Purpose | Notes |
|---|---|---|
| `CRE_NODE_URL` or equivalent | CRE node endpoint | Provided by Chainlink after onboarding |
| `CRE_AUTH_TOKEN` | Authenticate job deployments | Never commit; inject at CI/CD time |
| (Optional) `VITE_NEWSAPI_KEY` | Enrich NV Agent with paid news in CRE job | Already declared in `PENDING_PROVIDERS` |
| (Optional) `VITE_ALPHAVANTAGE_KEY` | Economic data in CRE job | Already declared |
| No Circle API key is needed | Bridge/wallet already uses browser-side wallet signing | — |

**None of these should ever be invented, hardcoded, or placed in frontend env files exposed to the browser.** API keys for CRE jobs must live in CRE's encrypted secrets store.

---

## 7. Incremental Implementation Proposal

### Phase 1 — Wire existing data into the agent (no new dependencies, no CRE)

**Goal**: Give `NVAgentPanel` access to all the data that already exists in the project so it can answer questions about prices, TVL, wallet balances, and bridge state.

**Files to change**:
- `src/components/NVIntelligence.tsx` — pass `marketAssets`, `tvlState`, `solanaContext` as props/context into `NVAgentPanel`
- `src/lib/intelligence.ts` — extend `answerFromNews()` signature to accept optional `MarketAsset[]`, `TvlState`, `SolanaAgentContext`; add handlers for price/TVL/balance queries
- `src/components/NVIntelligence.tsx` — import `getAllAssets()` from `marketData.ts` and `getTvlState()` from `tvl.ts`; pass them down

**No new packages, no API keys, no CRE.**

---

### Phase 2 — Structured agent context object (no CRE)

**Goal**: Consolidate all agent-readable state into a single `NVAgentContext` object for clean extensibility.

**New file**: `src/lib/agentContext.ts`
```
NVAgentContext {
  news: NewsItem[]
  clusters: EventCluster[]
  marketAssets: MarketAsset[]
  tvl: TvlState
  solana: SolanaAgentContext | null
  evmWallet: { address, chainId, usdcBalance } | null
  bridgeState: { active, fromChain, toChain, amount } | null
}
```

**Files to change**:
- New `src/lib/agentContext.ts` — defines the type and a `useNVAgentContext()` hook
- `src/components/NVIntelligence.tsx` — populate and provide the context
- `src/lib/intelligence.ts` — update `answerFromNews()` to accept `NVAgentContext`
- `src/components/SolanaWalletPanel.tsx` — publish `agentContext` into a React context

---

### Phase 3 — Prepare for CRE: read-only agent API surface

**Goal**: Extract the agent's answering logic into a stateless function that can be called by a CRE job (or any future serverless/edge compute layer).

**New file**: `src/lib/agentApi.ts`
- Pure function `agentQuery(question: string, ctx: NVAgentContext): AgentResponse`
- No React, no browser APIs, no side effects
- Exportable to a Node.js / edge runtime without modification

**Files to change**:
- `src/lib/agentApi.ts` — new file, extracted pure logic from `intelligence.ts`
- `src/lib/intelligence.ts` — re-export `agentQuery` from `agentApi.ts`; keep existing UI-facing helpers
- No UI changes needed

---

### Phase 4 — CRE job integration (requires CRE access)

**Goal**: Move the market-data assembly and news-summarisation step into a CRE workflow job, so the agent's context is pre-computed off-chain and delivered to the frontend as a signed payload.

**Prerequisites**: CRE developer access, CRE CLI, LINK balance for subscriptions.

**New files**:
- `cre/workflows/nv-agent-context.toml` — CRE job spec: trigger every 30 s; tasks: fetch CoinGecko prices, fetch RSS headlines, fetch DeFiLlama TVL, call optional paid news APIs (using CRE secrets), assemble `NVAgentContext`, emit signed result
- `cre/secrets/` — CRE secret names (never values) for `NEWSAPI_KEY`, `ALPHAVANTAGE_KEY`, etc.
- `src/lib/creClient.ts` — thin client that polls the CRE job's output endpoint and deserialises the signed `NVAgentContext`

**Files to change**:
- `src/components/NVIntelligence.tsx` — optionally use `creClient.ts` result instead of direct RSS/API calls when CRE output is available; fall back to existing browser-side fetch if CRE is unreachable
- `src/lib/intelligence.ts` — no structural changes needed; `agentQuery()` already accepts the context object

**Architecture principle**: the CRE layer is **additive, not replacing**. The browser-side data pipeline stays intact as a fallback. CRE adds quality (paid news APIs, deduplicated summarisation, richer market context) without changing the UX or breaking existing functionality.

---

### Phase 5 — Agent actions via CRE (future, user-triggered)

**Goal**: Allow the agent to propose onchain actions (bridge, swap) that the user explicitly confirms.

This phase requires:
1. CRE Workflow that can construct unsigned transaction payloads (bridge params, swap quotes)
2. A new `NVAgentPanel` "action card" UI: shows the proposed action, amount, destination chain, and a "Review & Sign" button
3. On user approval, the action is routed to the existing `cctpBridgeExecutor.ts` or `cctpSolanaExecutor.ts` — **the CRE job never signs; it only proposes**
4. The wallet popup (MetaMask, Phantom, etc.) is always the final gate

**Files to change (future)**:
- `src/lib/agentContext.ts` — add `pendingAction: ProposedAction | null`
- `src/components/NVIntelligence.tsx` → `NVAgentPanel` — add action card rendering
- `src/lib/cctpBridgeExecutor.ts` / `cctpSolanaExecutor.ts` — no changes; called as-is from the action card
- `cre/workflows/nv-agent-actions.toml` — new CRE job for transaction assembly

---

## Summary

The NV Agent today is a deterministic, keyless, client-side keyword retrieval system over RSS news. It has no LLM, no CRE, and no onchain write capability. Its architecture is clean and extensible: `SolanaAgentContext` is already designed with agent readability in mind, `agentContext` is built and typed, and the `answerFromNews()` function signature is simple to extend.

The path to CRE integration is four phases: wire existing data (Phase 1–2), extract pure logic (Phase 3), add CRE workflow (Phase 4), and optionally add agent-proposed actions gated by wallet confirmation (Phase 5). Phases 1–3 require no new dependencies and no CRE access. Phase 4 is gated by CRE program availability. Phases 1–3 can start immediately.
