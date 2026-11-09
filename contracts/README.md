# NV Shop — Arc-native purchase contract

The NV shop payment and entitlement flow is being migrated away from Supabase. The application reads purchase receipts and entitlements directly from Arc Mainnet.

## Contract and network

- Contract: `contracts/NVShop.sol`
- Chain: Arc Mainnet, chain ID `5042`
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://explorer.arc.io`
- Payment: Arc native USDC, 18 decimal places, sent as `msg.value`.
- Product key: `keccak256(bytes(productId))`; existing IDs are preserved.
- Purchase events are the source for history and entitlements.
- Contract mappings enforce skin ownership and XP purchase limits.
- Official immutable treasury: `0xAd397122941D03450c70d0076379e079334D434f` (recovered from the original Profile/Shop payment configuration).
- The contract hardcodes this receiving wallet; it cannot be changed through deployment arguments or owner actions.

## Configure the frontend

Set these Vite variables in the deployment environment for the app:

```dotenv
VITE_NV_SHOP_ADDRESS=0x<deployed-contract-address>
VITE_NV_SHOP_DEPLOYMENT_BLOCK=<contract-deployment-block>
```

The official treasury is hardcoded in both the frontend and contract; no treasury environment override is accepted. The deployment block is required for efficient event-history scanning. Do not set a placeholder contract address in production. If the contract address is missing, purchases fail closed and no transaction is sent.

## Compile and test

Install Foundry, then run from the repository root:

```sh
forge test
forge build
```

The GitHub Actions workflow `.github/workflows/nv-shop-contract.yml` runs the contract test suite on pushes and pull requests affecting the contract.

## Deploy and configure

The repository includes a single guarded Foundry script that deploys the contract and configures all five catalog products. It refuses to run unless the connected RPC reports Arc Mainnet chain ID `5042`. This is a production deployment; do not run it until you have independently reviewed the contract and intentionally chosen to deploy to mainnet.

Use a dedicated deployment wallet. Its private key must remain in your local shell environment and must never be pasted into chat, committed, or added to GitHub/Vercel.

From the repository root:

```sh
forge build
forge test
read -s -p "Deployment private key: " NV_DEPLOYER_PRIVATE_KEY
export NV_DEPLOYER_PRIVATE_KEY
echo
forge script script/DeployNVShop.s.sol:DeployNVShop \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast
unset NV_DEPLOYER_PRIVATE_KEY
```

The script deploys `NVShop`, sets the deploying wallet as owner, verifies the immutable official treasury, and submits configuration transactions for all five products:

| Product ID | Type | Price (18 decimals) | XP | Daily | Weekly | 30-day |
|---|---:|---:|---:|---:|---:|---:|
| xp-daily | 1 | 200000000000000000 | 30 | 1 | 5 | 20 |
| xp-weekly | 1 | 500000000000000000 | 60 | 1 | 3 | 12 |
| xp-quarterly | 1 | 1000000000000000000 | 300 | 1 | 1 | 4 |
| premium-500 | 0 | 10000000000000000000 | 0 | 1 | 2 | 4 |
| premium-1000 | 0 | 20000000000000000000 | 0 | 1 | 1 | 2 |

Keep the deployment output and transaction hashes. The script prints the contract address. Find the deployment transaction in `broadcast/DeployNVShop.s.sol/5042/run-latest.json`; query its receipt to obtain the exact deployment block:

```sh
cast receipt <deployment-transaction-hash> \
  --rpc-url https://rpc.mainnet.arc.io --json
```

Use the receipt's `blockNumber` (hex value) converted to a decimal integer as `VITE_NV_SHOP_DEPLOYMENT_BLOCK`. Set the verified contract address as `VITE_NV_SHOP_ADDRESS`. Do not configure Vercel with placeholders, and do not enable the frontend until the deployed treasury and all five product records have been independently read back and verified.

## Rollout safeguards

1. This contract is source code only until deployed and configured. No production purchase is enabled yet.
2. The current frontend and deployment script target Arc Mainnet (5042); this branch does not provide an end-to-end Arc Testnet mode. Do not assume testnet validation is available through the NV interface.
3. Verify the deployed treasury and every product's on-chain configuration against the table before enabling the frontend.
4. Set the two Vite variables only after confirming the deployment address and exact deployment block.
5. Only after independent review, test with explicit wallet approval and a deliberately small purchase; verify receipt, XP credit, skin ownership, limits and history.
6. Do not remove Supabase from unrelated NV modules. This migration removes it from the shop payment flow only.
7. The contract is not audited. It requires independent security review before handling production funds.
