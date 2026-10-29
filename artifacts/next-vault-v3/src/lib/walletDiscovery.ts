// ─── EIP-6963 Multi Injected Provider Discovery ──────────────────────────────
// Discovers injected EVM wallets without an external dependency. Supports
// EIP-6963 wallets and legacy window.ethereum providers used by desktop and
// mobile in-app browsers (for example MetaMask, Coinbase Wallet, Trust Wallet).
// WalletConnect is intentionally not fabricated here: it requires a project ID
// and a separate session lifecycle.

import type { Eip1193Provider } from './arc';

export interface WalletInfo {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: Eip1193Provider;
}

interface Eip6963AnnounceProvider {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

interface Eip6963AnnounceEvent extends CustomEvent {
  detail: Eip6963AnnounceProvider;
}

declare global {
  interface WindowEventMap {
    'eip6963:announceProvider': Eip6963AnnounceEvent;
  }
}

let discoveredWallets: WalletInfo[] = [];
let discoveryListenerInstalled = false;
const listeners: ((wallets: WalletInfo[]) => void)[] = [];

function notifyListeners() {
  const snapshot = [...discoveredWallets];
  for (const cb of listeners) cb(snapshot);
}

function addWallet(wallet: WalletInfo) {
  if (!wallet.provider || typeof wallet.provider.request !== 'function') return;
  const existing = discoveredWallets.find(w =>
    w.id === wallet.id ||
    (!!wallet.rdns && w.rdns === wallet.rdns) ||
    w.provider === wallet.provider
  );
  if (existing) {
    // Prefer richer EIP-6963 metadata when a legacy fallback found the same provider.
    if ((!existing.icon && wallet.icon) || (!existing.rdns && wallet.rdns)) {
      discoveredWallets = discoveredWallets.map(w => w === existing
        ? { ...w, icon: w.icon ?? wallet.icon, rdns: w.rdns ?? wallet.rdns, name: wallet.rdns ? wallet.name : w.name }
        : w);
      notifyListeners();
    }
    return;
  }
  discoveredWallets = [...discoveredWallets, wallet];
  notifyListeners();
}

function announceHandler(e: Eip6963AnnounceEvent) {
  const { info, provider } = e.detail ?? {};
  if (!info || !provider || typeof provider.request !== 'function') return;
  addWallet({ id: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider });
}

function discoverLegacyProviders() {
  if (typeof window === 'undefined') return;
  const eth = (window as unknown as { ethereum?: Eip1193Provider & Record<string, unknown> }).ethereum;
  if (!eth || typeof eth.request !== 'function') return;

  const meta = eth as unknown as {
    isMetaMask?: boolean;
    isCoinbaseWallet?: boolean;
    isBraveWallet?: boolean;
    isRabby?: boolean;
    isOpera?: boolean;
    isTrust?: boolean;
    isExodus?: boolean;
    providers?: (Eip1193Provider & Record<string, unknown>)[];
  };

  // Some desktop browsers expose several injected wallets through one wrapper.
  const candidates = Array.isArray(meta.providers) && meta.providers.length > 0
    ? meta.providers
    : [eth];

  for (const provider of candidates) {
    if (!provider || typeof provider.request !== 'function') continue;
    const pm = provider as unknown as {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isBraveWallet?: boolean;
      isRabby?: boolean;
      isOpera?: boolean;
      isTrust?: boolean;
      isExodus?: boolean;
    };
    const name = pm.isCoinbaseWallet ? 'Coinbase Wallet'
      : pm.isBraveWallet ? 'Brave Wallet'
      : pm.isRabby ? 'Rabby'
      : pm.isOpera ? 'Opera Wallet'
      : pm.isTrust ? 'Trust Wallet'
      : pm.isExodus ? 'Exodus'
      : pm.isMetaMask ? 'MetaMask'
      : 'Browser Wallet';
    addWallet({ id: `injected-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, provider });
  }
}

/**
 * Install the EIP-6963 listener once, but solicit announcements every time
 * discovery is requested. Mobile browsers can inject their provider after the
 * page loads, so a one-time request can leave the wallet list permanently empty.
 */
export function startDiscovery(): void {
  if (typeof window === 'undefined') return;

  if (!discoveryListenerInstalled) {
    window.addEventListener('eip6963:announceProvider', announceHandler as EventListener);
    discoveryListenerInstalled = true;
  }

  window.dispatchEvent(new CustomEvent('eip6963:requestProvider'));

  // Run legacy discovery as well as EIP-6963 discovery; one should not suppress
  // the other because browsers may expose multiple providers by both mechanisms.
  window.setTimeout(discoverLegacyProviders, 250);
}

/** Get the current list of discovered wallets and refresh discovery. */
export function getDiscoveredWallets(): WalletInfo[] {
  startDiscovery();
  return [...discoveredWallets];
}

/** Subscribe to wallet discovery updates. Returns an unsubscribe function. */
export function onWalletsDiscovered(cb: (wallets: WalletInfo[]) => void): () => void {
  listeners.push(cb);
  cb([...discoveredWallets]);
  startDiscovery();
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/** Find a specific wallet by its id. */
export function findWallet(id: string): WalletInfo | undefined {
  return discoveredWallets.find(w => w.id === id);
}

/** Backward-compatible legacy provider accessor. */
export function getLegacyProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === 'function' ? eth : null;
}
