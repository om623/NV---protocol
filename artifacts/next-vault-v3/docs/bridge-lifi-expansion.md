# NV Bridge expansion — LI.FI adapter (branch preview)

Branch: `feature/lifi-bridge-expansion`

## What this branch adds

- `src/lib/lifiBridge.ts`: LI.FI quote + execution adapter for EVM cross-chain transfers across token pairs.
  - Live quote via `GET https://li.quest/v1/quote`.
  - Explicit ERC-20 allowance check and wallet approval when required.
  - User wallet signs the source transaction (`eth_sendTransaction`).
  - Source receipt confirmation and LI.FI status polling (up to 30 minutes).
  - Returns source/destination hashes and `DONE | PENDING | FAILED`.
  - Exposes a status callback for a future Agent progress UI.
- `src/lib/bridgeRouter.ts`: routing facade.
  - Uses existing CCTP for USDC→USDC when the exact CCTP route is available.
  - Falls back to LI.FI for other supported token/network combinations.
  - Existing `cctpBridgeExecutor.ts`, `BridgeView.tsx`, Swap, Supabase and Agent UI are untouched.

## Integration contract

Call `quoteBridgeRoute(request)` before presenting the user a confirmation card. For LI.FI, show the quote's minimum destination amount, tool, estimated duration and fees. Then call `executeBridgeRoute(request, quote, onStatus)` only after explicit user approval.

The wallet must be connected to `fromChainId` before execution. The provider signs the source transaction; no seed phrase or private key is handled by NV.

## Important limitations / next validation

- This commit adds the adapter and routing layer, **not the public UI integration**. Existing Bridge screen and Agent behavior remain unchanged intentionally.
- LI.FI route availability is dynamic. A token/network pair is only usable when a fresh executable quote is returned; do not derive availability from a static token list alone.
- This first adapter uses LI.FI's single-quote transaction flow. Routes requiring extra manual destination-chain transactions should be handled through LI.FI SDK/route-step execution in a subsequent integration, not assumed to complete from one source transaction.
- No API key or new dependency was added.
- No changes to main branch; no merge or deployment.
