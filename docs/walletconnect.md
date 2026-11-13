# WalletConnect in NV

WalletConnect is an extra EVM connection option in the existing wallet picker. It reuses the current wallet flow (address,
balances, Consulte data, transfers, CCTP, NV Agent), so no second wallet module exists. MetaMask, Phantom and other injected
wallets are unchanged. It is built on the official `@walletconnect/ethereum-provider` (the Reown stack); NV renders its own QR
window instead of the SDK's full-screen modal, so `@reown/appkit`'s modal is never loaded.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | `.env` at the **repository root** (Vite's `envDir`) and the Vercel project env vars | Project ID of the NV project in the Reown dashboard (cloud.reown.com) |

1. Put the official NV Project ID in `.env` as `VITE_WALLETCONNECT_PROJECT_ID=<id>` (the file is git-ignored). It is a public identifier, but it is never hard-coded in source.
2. Vite reads env files at startup: restart the dev server after editing `.env`. Production builds embed the value at build time.
3. In Vercel add the same variable for **Production and Preview**, then redeploy.
4. In the Reown dashboard, add every origin that will use it (the production domain, the Arc Studio preview domain, `localhost`) if the project has a domain allowlist. A browser origin that is not allowed is refused by the relay.

Without the variable the WalletConnect option still appears and its window says WalletConnect is unavailable. Nothing else is affected.

## What it does

- QR Code in a floating window (no full-screen overlay; the Dashboard stays usable), plus "Copy link".
- On phones: "Open in wallet" (deep link). It is the generic `wc:` pairing URI, so it opens whichever installed wallet registers that scheme; there are no wallet-specific deep links.
- Reconnects an authorised session on page load without prompting the wallet (and without loading the SDK when there is nothing to restore).
- Disconnects from the existing account menu, which also ends the WalletConnect session on the wallet.
- If the **wallet** ends the session, NV disconnects and shows "The WalletConnect connection was interrupted."
- If the pairing is rejected, expires or the window is closed, nothing connects. If a wallet approves a pairing the user already closed, the session is closed again, so no hidden connection is left.
- One SDK instance serves the whole page. It is never initialised twice (a second Core on the same storage and relay makes both clients process each other's messages).

## Networks (including Arc)

The session requests **every live NV network as optional**, Ethereum mainnet included (30 networks, among them Arc `5042` and Arc Testnet `5042002`). The SDK sends no required network, and a wallet only approves the networks it knows.

- A network the wallet approved: "Switch to ..." is local and instant; the wallet is not asked. A change made inside the wallet updates NV.
- A network the wallet did **not** approve (typically Arc in a wallet that has not added it): WalletConnect cannot use it in this session. NV does not try, stays connected, keeps the mismatch banner and says: "Your wallet did not approve this network for the WalletConnect connection. Add the network in your wallet and connect again." Pointing the SDK at a network outside the session would leave it with no accounts and drop the connection, so this is deliberate.
- NV's own network switcher is unchanged for injected wallets.

## When the connection cannot start (time limits and the Arc Studio Preview)

The SDK only creates the pairing (the QR Code) after it is subscribed to the Reown relay over a WebSocket. If that WebSocket cannot open, the SDK
waits silently, so NV puts limits on the wait and says why:

| Situation | What the user sees |
|---|---|
| The SDK does not start within 20 s | "The WalletConnect connection took too long to start..." and **Try again** |
| No QR Code within 25 s of starting a pairing | the same message and **Try again** |
| The page's Content Security Policy refuses the relay connection | at once (under a second): "This page's security policy is blocking the connection to the WalletConnect relay..." and **Try again** |

Waiting for the wallet to approve is not limited by these (the QR itself expires after about five minutes). **Try again** reuses the same SDK
start-up; it never creates a second one. The error message never contains the relay URL (it carries an auth token).

**Why the Preview needs a special path.** The Arc Studio Preview host sends `content-security-policy: frame-ancestors https://studio.arc.io; connect-src 'self'`.
`connect-src 'self'` lets the page open a WebSocket only to its own origin, so a direct socket to `wss://relay.walletconnect.org` is refused, and
before this change the panel stayed on "Preparing connection..." with no error. The same policy also blocks other browser calls to third-party
hosts (market data, news), which is why those only work through NV's own dev-server proxies.

**How it is handled.**
- *Development and Preview only* (`import.meta.env.DEV`): `lib/walletConnect.ts` redirects the SDK's relay socket to the page's own `/wc-relay`, and
  the Vite dev server (`vite.config.ts`, `server.proxy`) forwards it to the Reown relay, passing the browser's `Origin` header through untouched
  (the Reown domain allowlist checks it). Only sockets aimed at `relay.walletconnect.org` are redirected; Vite's HMR socket and everything else are not.
- The SDK itself is **not** given a custom `relayUrl`: it signs its relay auth token for the relay address it is configured with, and the relay rejects
  a token signed for any other address (HTTP 401). So the SDK keeps the default address and only the socket is redirected.
- *Production builds*: `import.meta.env.DEV` is a build-time false, so the redirector is removed from the bundle, the proxy does not exist
  (`vite preview` has none), and the SDK talks to `wss://relay.walletconnect.org` directly, exactly as before. The time limits and the policy
  detector are active in production too.
- The dev server logs one line per relay connection: the page origin and, if the relay refuses, the HTTP status (never the URL). If the Preview
  still does not show the QR Code, `/tmp/dev-server.log` tells whether the Studio edge delivered the socket (a line "upgrade requested, origin=...")
  and what the relay answered (for example "refused the upgrade: HTTP 403" means the origin is not in the Reown allowlist).

## Where the session is stored

SDK 2.2x keeps its pairing/session data in the browser's **IndexedDB** (`WALLET_CONNECT_V2_INDEXED_DB`), not `localStorage`. These are relay session keys, not wallet keys. NV checks for a saved session with a read-only probe that never creates the database, and still recognises the older `localStorage` layout. Disconnecting clears the session.

## Security

- Connection layer only. Signatures and transactions are approved inside the wallet app.
- NV never asks for or stores seed phrases or private keys. No transaction is sent automatically.

## Files

- `src/lib/walletConnect.ts`: lazy-loaded provider, pairing with time limits, policy-block detection, dev-only relay redirect, restore, disconnect, session-ended notice, approved-network checks.
- `src/components/WalletConnectPanel.tsx`: floating QR window.
- `src/components/WalletPickerModal.tsx`: optional WalletConnect entry.
- `src/App.tsx`: wiring (connect, restore on load, disconnect, session-ended notice, network switch guard).
- `src/i18n/translations.ts`: 19 `wc.*` keys in all nine languages.
- `scripts/walletconnect-tests.ts`: automated tests (`bun run test:walletconnect`).
- `vite.config.ts`: `/wc-relay` WebSocket proxy to the Reown relay, in the dev server only (not in `preview`), plus pre-bundling of the SDK.
- `pnpm-workspace.yaml`: `@reown/appkit` install script intentionally not run (NV never loads its modal).

## Tested

End to end (tooling in `docs/walletconnect-e2e/`) against the **real Reown relay with the NV Project ID**, driving the real app in a browser and a headless
test wallet built with Reown's wallet SDK:

- **Connection suite** (QR, pairing, approval, Arc and Arc Testnet in the session, wallet-side network change, switch back, reload and restore, disconnect from
  NV, disconnect from the wallet with its own notice): 32 of 32. Failure paths (rejected pairing and retry, window closed before scanning with a late
  approval, a wallet without Arc, phone layout with the deep link): 7, 7, 11 and 7. Injected wallets unchanged: 10.
- **Preview simulation** (page served under the Preview origin and `connect-src 'self'`; relay socket through `/wc-relay`; QR; full pairing; relay unreachable
  gives the timeout notice and Try again recovers; a policy that blocks the relay is named in under a second): 9, 6, 4. And with **no socket mocking**, a real
  WebSocket under the real policy header served by a transparent edge: QR in about 5 s and a full pairing: 7 of 7.
- **Production build** (`vite preview`): the SDK uses the direct relay (no `/wc-relay`), QR in about 5 s, pairing completes; behind the Preview policy the
  block is named in under a second: 9 of 9. The bundle contains neither the redirector nor the proxy path used for connecting.
- **Unit tests** (`bun run test:walletconnect`): 63 of 63 (SDK options, time limits, policy detection, redirect, saved-session detection, no hard-coded Project ID,
  nine languages, scope of changed files).

**Not tested**: the Arc Studio edge itself. Its host answers 403 to anything outside Studio, so it cannot be reached from the sandbox: the simulations above reproduce
its Origin and its policy header, but not how it carries a WebSocket upgrade on `/wc-relay` (it does carry the Vite HMR socket, which is also an upgrade). Also not
tested: real mobile wallets (MetaMask, Rainbow, Trust, ...), the deep link opening an installed wallet app, QR expiry after five minutes, and transaction signing
(the test wallet never signs).

## Manual test checklist (real wallet)

- [ ] Desktop: picker > WalletConnect > QR appears > scan with a mobile wallet > NV shows the address.
- [ ] Mobile browser: "Open in wallet" opens the wallet app and returns connected.
- [ ] Close the window before scanning: nothing connects.
- [ ] Reject the request in the wallet: "rejected" message with "Try again".
- [ ] Reload the page: the session is restored without a wallet prompt.
- [ ] Disconnect from the account menu: address cleared, session ended on the wallet.
- [ ] Disconnect from inside the wallet app: NV shows the interrupted-connection message.
- [ ] Switch to Arc / Arc Testnet from NV with a wallet that has Arc: switches. Without Arc: NV explains and stays connected.
- [ ] MetaMask and Phantom: connect, disconnect and Bridge/Swap still behave as before.
