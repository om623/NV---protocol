# NV Shop — Arc-native purchase contract

The NV shop is being migrated away from Supabase as its payment and entitlement authority.

## Contract

- Source: `contracts/NVShop.sol`
- Target chain: Arc Mainnet (chain ID `5042`)
- Payment asset: Arc native USDC, transferred as `msg.value` using 18-decimal native precision.
- Product IDs: `keccak256(bytes(productId))`, preserving the existing shop IDs (for example, `xp-daily`).
- The contract stores authoritative product price, XP amount, active state and purchase limits.
- Purchases forward the exact payment directly to the immutable treasury address and emit `PurchaseCompleted`.
- Skin ownership and XP purchase counters are recorded on-chain. Skin purchases are one-time per wallet.
- XP limits are enforced by the contract: per UTC day, per UTC week and per fixed 30-day epoch window. The 30-day window is intentionally fixed-length; the frontend must display the same reset rule.

## Security and rollout constraints

1. The contract has not been deployed. No live payment should be sent to it yet.
2. The treasury address must be confirmed before deployment; it is immutable after deployment.
3. Product configuration must be loaded from the existing shop catalogue and independently reconciled before enabling purchases.
4. Frontend purchase, entitlement, history and limit reads must be migrated to the contract before removing Supabase from this flow.
5. Do not remove Supabase dependencies used by unrelated NV modules.
6. Deploy and validate on Arc Testnet first, then review the bytecode/source and configuration before any Arc Mainnet deployment.
7. This contract is a first implementation, not an audited financial contract. It requires compilation, automated tests, review and testnet validation before production use.

## Local contract checks

This repository uses Foundry configuration in `foundry.toml`. Run:

```sh
forge test
```

The test suite covers payment forwarding, exact-price enforcement, on-chain purchase limits, one-time skin ownership, inactive products and owner-only product configuration.
