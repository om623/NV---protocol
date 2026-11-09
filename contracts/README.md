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
VITE_NV_SHOP_TREASURY=0xAd397122941D03450c70d0076379e079334D434f
VITE_NV_SHOP_DEPLOYMENT_BLOCK=<contract-deployment-block>
```

The deployment block is required for efficient event-history scanning. Do not set a placeholder contract address in production. If the contract address is missing, purchases fail closed and no transaction is sent.

## Compile and test

Install Foundry, then run from the repository root:

```sh
forge test
forge build
```

The GitHub Actions workflow `.github/workflows/nv-shop-contract.yml` runs the contract test suite on pushes and pull requests affecting the contract.

## Deploy and configure

The receiving wallet is fixed in the contract source. Review the contract and test suite before deploying. Use a dedicated deployment wallet; never commit its private key.

Compile first:

```sh
forge build
```

Deploy to Arc Mainnet using the deployer's local environment and the confirmed treasury:

```sh
forge create contracts/NVShop.sol:NVShop \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key "$NV_DEPLOYER_PRIVATE_KEY"
```

Save the deployed contract address and deployment block, then configure each product from the owner wallet. Values below use 18-decimal native USDC units. The owner must submit each transaction:

| Product ID | Type | Price | XP | Daily | Weekly | 30-day |
|---|---:|---:|---:|---:|---:|---:|
| xp-daily | 1 | 200000000000000000 | 30 | 1 | 5 | 20 |
| xp-weekly | 1 | 500000000000000000 | 60 | 1 | 3 | 12 |
| xp-quarterly | 1 | 1000000000000000000 | 300 | 1 | 1 | 4 |
| premium-500 | 0 | 10000000000000000000 | 0 | 1 | 2 | 4 |
| premium-1000 | 0 | 20000000000000000000 | 0 | 1 | 1 | 2 |

For each row, call:

```sh
cast send "$NV_SHOP_ADDRESS" \
  "configureProduct(bytes32,uint8,uint256,uint32,uint32,uint32,uint32,bool)" \
  "$(cast keccak "xp-daily")" 1 200000000000000000 30 1 5 20 true \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key "$NV_SHOP_OWNER_PRIVATE_KEY"
```

Replace the example arguments with each row's values and product ID. Keep private keys local; do not paste them into chat, GitHub, or the repository.

## Rollout safeguards

1. This contract is source code only until deployed and configured. No production purchase is enabled yet.
2. Validate the same contract on Arc Testnet first using a testnet deployment. The receiving wallet remains the official NV treasury.
3. Verify every product's on-chain configuration against the table before enabling the frontend.
4. Set the three Vite variables only after confirming deployment address and block.
5. Test a small purchase with explicit wallet approval, then verify receipt, XP credit, skin ownership, limits and history.
6. Do not remove Supabase from unrelated NV modules. This migration removes it from the shop payment flow only.
7. The contract is not audited. It must receive independent security review before handling production funds.
