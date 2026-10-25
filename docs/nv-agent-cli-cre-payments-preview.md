# NV Agent — CLI + CRE + Autonomous Payments Preview

Status: preview architecture branch. No production execution enabled.

## Isolation contract

- NV Agent lives only inside the Intelligence module.
- DigitalPresenter belongs to Dashboard and is not the NV Agent.
- Do not modify DigitalPresenter for agent actions.
- Do not modify existing Swap, Bridge, network registry, or real-market-data pipelines for this preview.
- Existing payment/bridge executors remain the only transaction paths until a separately reviewed execution adapter is approved.

## Current map

NV Intelligence UI -> buildFullContext() -> agentQuery()
- market data: CoinGecko / Yahoo / fiat feeds
- TVL: DeFiLlama
- EVM wallet: NVEvmWalletContext
- Solana wallet: Wallet Standard
- payments: payments.ts pub-sub
- bridge: bridgeState pub-sub
- news: intelligence.ts

CRE is isolated under:
- artifacts/next-vault-v3/cre/workflows/nv-market-data/

Current CRE workflow verifies market prices and TVL data. It does not sign payments.

## Proposed autonomous-payment architecture

NV Agent
  -> intent parser
  -> payment policy engine
  -> dry-run / simulation
  -> approval boundary
  -> execution adapter
  -> existing wallet/payment executor
  -> receipt + payment-state pub-sub
  -> NV Agent status response

CRE
  -> observes/verifies external conditions
  -> emits a signed/verifiable condition result
  -> never receives or stores a user's private key
  -> never bypasses payment policy limits

CLI
  -> inspect agent context
  -> inspect payment policies
  -> validate policy
  -> dry-run payment
  -> inspect CRE status
  -> inspect execution receipts

## Safety invariants for implementation

1. No private keys in frontend, CLI config, CRE config, logs, or repository.
2. Default mode is dry-run.
3. A payment requires an explicit policy containing network, token, recipient, maximum amount and authorization mode.
4. Recipient and network are allowlisted per policy.
5. Per-payment and cumulative spending limits are mandatory.
6. Expired or revoked policies cannot execute.
7. Agent-generated natural language never goes directly to eth_sendTransaction/signAndSendTransaction.
8. Policy engine outputs a typed PaymentIntent first.
9. Execution adapter re-validates the intent immediately before signing/submission.
10. Mainnet autonomous execution remains disabled until testnet validation and explicit owner approval.
11. Existing Swap and Bridge code paths are not reused implicitly as autonomous-payment routes.
12. Existing real-data sources remain unchanged; CRE is additive/verifying, not a replacement.

## First implementation slice

Create new isolated modules only:
- src/lib/agentPayments/types.ts
- src/lib/agentPayments/policy.ts
- src/lib/agentPayments/dryRun.ts
- cli/nv-agent.ts

The first slice must support policy validation and dry-run only. It must not submit a blockchain transaction.

## Approval gate

After preview validation, a later branch/commit may connect the execution adapter to the existing payment executor. That step requires a separate review because it crosses the read-only-agent boundary.
