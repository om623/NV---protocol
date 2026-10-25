# NV Agent + CRE + Autonomous Payments — Safe Architecture Map

## Scope lock

This branch is intentionally limited to the **NV Agent inside the Intelligence module**, CLI/CRE infrastructure, and autonomous-payment policy code.

Protected existing systems — **do not modify without explicit approval**:
- Swap (testnet + mainnet)
- Bridge / CCTP (testnet + mainnet)
- Network registry
- Market-data production pipelines and real-data sources
- Dashboard DigitalPresenter

The Dashboard presenter and NV Agent are separate products:
- `DigitalPresenter` belongs to Dashboard and presents dashboard information.
- `NV Agent` lives inside `NVIntelligence` and is the only agent in scope here.

## Current NV Agent map

```
NVIntelligence
  ├─ agentApi.ts              intent routing / answers
  ├─ agentContext.ts          unified read context
  ├─ NVEvmWalletContext.tsx   read-only EVM wallet snapshot
  ├─ useSolanaWallet.ts       Solana read context
  ├─ marketData.ts            real market data
  ├─ tvl.ts                   DeFiLlama TVL
  ├─ intelligence.ts          news corpus
  └─ payments.ts              existing user-approved payment execution/status
```

## CRE map

```
cre/workflows/nv-market-data/
  ├─ main.ts
  ├─ workflow.yaml
  ├─ config.staging.json
  ├─ package.json
  └─ tsconfig.json
```

The existing CRE workflow remains isolated from the Vite application.

## Autonomous-payment architecture

The first implementation deliberately separates **decision** from **execution**.

```
User policy
   ↓
NV Agent
   ↓
PaymentPolicy validation
   ↓
CRE / trusted condition evaluation
   ↓
PaymentIntent (prepared, never signed here)
   ↓
Authorization boundary
   ↓
Existing wallet/payment executor
```

### Security invariants

1. NV Agent never stores or receives a private key.
2. A policy has explicit network, token, recipient, per-payment limit and total limit.
3. A policy can be disabled at any time.
4. Policy evaluation cannot send a transaction.
5. A generated intent is immutable and auditable.
6. Execution is a separate adapter and must enforce the policy again immediately before sending.
7. Existing `payments.ts`, Swap and Bridge are not reused implicitly.
8. Mainnet execution stays disabled until testnet policy/execution tests are approved.

## Phase plan

### Phase A — safe foundation (this branch)
- Architecture map
- Pure payment-policy engine
- CLI policy validator / intent preview
- No transaction signing
- No changes to Swap, Bridge, DigitalPresenter or market-data pipelines

### Phase B — CRE conditions
- Add a new isolated CRE workflow for payment-condition evaluation
- Signed/verifiable decision output
- Dry-run only

### Phase C — testnet execution
- Explicit executor adapter
- Allowlist + limits + replay protection
- Full audit log
- Testnet only

### Phase D — mainnet
Only after manual review, testnet evidence and explicit approval.
