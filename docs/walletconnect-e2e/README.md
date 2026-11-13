# WalletConnect end-to-end tooling (test-only, not part of the app)

These scripts drive the **real NV app in a browser** against the **real Reown relay** with the NV Project ID. The wallet side is a
headless test wallet built with Reown's wallet SDK (`@reown/walletkit`); it approves sessions and answers requests but never signs
or sends anything. Nothing here ships with the app.

| File | Purpose |
|---|---|
| `tools/wallet.mjs` | Headless test wallet. Modes: `known-arc`, `no-arc`, `reject`. Control: `cmd.txt` (`disconnect`, `chain <id>`). |
| `tools/wc-lib.mjs` | Browser helpers (open app, QR panel, pairing URI, wallet process, IndexedDB check). |
| `tools/wc-a.mjs` | Suite A: QR, pairing, approval, networks, restore after reload, disconnect from NV, disconnect from the wallet (32 checks). |
| `tools/wc-b.mjs` | Suite B (`ONLY=reject\|cancel\|noarc\|mobile`): failure paths, a wallet without Arc, phone layout and deep link. |
| `tools/wc-c.mjs` | Suite C: an injected wallet (EIP-6963) behaves as before. |
| `tools/wc-d.mjs` | Suite D (`ONLY=proof\|timeout\|csp\|real`): the Arc Studio Preview, simulated (Preview origin, `connect-src 'self'`, relay through `/wc-relay`). |
| `tools/wc-prod.mjs` | Production build served by `vite preview` (port 4173): direct relay, and the policy block is detected. |
| `tools/edge.cjs` | A transparent edge server that forwards HTTP and WebSocket upgrades to Vite and adds the Preview's policy header (used by D4 and the production test). |
| `tools/wc-shots.mjs` | Regenerates `screenshots/`. |

Needs: the dev server on `127.0.0.1:5173` with `VITE_WALLETCONNECT_PROJECT_ID` set, `playwright-core` with a Chromium, and for the
wallet `bun add @reown/walletkit @walletconnect/core @walletconnect/utils viem` in a scratch folder (paths inside the scripts point
at `/tmp/wcwallet` and `/tmp/pw`; adjust them). The automated unit tests that need no browser or network are `bun run test:walletconnect`.
