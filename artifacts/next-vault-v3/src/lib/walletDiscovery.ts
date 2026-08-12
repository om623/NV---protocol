// ─── EIP-6963 Multi Injected Provider Discovery ──────────────────────────────
// Discover all injected EVM wallets (MetaMask, Coinbase, Brave, Rabby, etc.)
// without any external dependency. Falls back to window.ethereum for legacy
// wallets that don't announce via EIP-6963.

import type { Eip1193Provider } from './arc';

export interface WalletInfo {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: Eip1193Provider;
}

interface Eip6963AnnounceProvider {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
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
let discoveryDone = false;
const listeners: ((wallets: WalletInfo[]) => void)[] = [];

function announceHandler(e: Eip6963AnnounceEvent) {
  const { info, provider } = e.detail;
  if (!provider || typeof provider.request !== 'function') return;
  const existing = discoveredWallets.find(w => w.id === info.uuid || w.rdns === info.rdns);
  if (existing) return;
  discoveredWallets.push({
    id: info.uuid,
    name: info.name,
    icon: info.icon,
    rdns: info.rdns,
    provider,
  });
  notifyListeners();
}

function notifyListeners() {
  for (const cb of listeners) cb([...discoveredWallets]);
}

/**
 * Start EIP-6963 provider discovery. Safe to call multiple times.
 * Dispatches `eip6963:requestProvider` to solicit announcements, then
 * listens for `eip6963:announceProvider` events.
 */
export function startDiscovery(): void {
  if (discoveryDone) return;
  discoveryDone = true;

  if (typeof window === 'undefined') return;

  window.addEventListener('eip6963:announceProvider', announceHandler as EventListener);

  // Request all providers to announce themselves
  window.dispatchEvent(new CustomEvent('eip6963:requestProvider'));

  // Fallback: if no EIP-6963 announcements arrive within 300ms, check window.ethereum
  window.setTimeout(() => {
    if (discoveredWallets.length > 0) return;
    const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (eth && typeof eth.request === 'function') {
      // Try to identify the wallet from provider metadata
      const meta = eth as unknown as {
        isMetaMask?: boolean;
        isCoinbaseWallet?: boolean;
        isBraveWallet?: boolean;
        isRabby?: boolean;
        isOpera?: boolean;
        isTrust?: boolean;
        isExodus?: boolean;
        providers?: Eip1193Provider[];
      };

      // Some wallets (MetaMask) expose multiple providers via .providers array
      if (meta.providers && Array.isArray(meta.providers) && meta.providers.length > 0) {
        for (const p of meta.providers) {
          if (p && typeof p.request === 'function') {
            const pm = p as unknown as { isMetaMask?: boolean; isCoinbaseWallet?: boolean };
            const name = pm.isCoinbaseWallet ? 'Coinbase Wallet'
              : pm.isMetaMask ? 'MetaMask'
              : 'EVM Wallet';
            discoveredWallets.push({ id: `fallback-${name}`, name, provider: p });
          }
        }
      } else {
        const name = meta.isCoinbaseWallet ? 'Coinbase Wallet'
          : meta.isBraveWallet ? 'Brave Wallet'
          : meta.isRabby ? 'Rabby'
          : meta.isOpera ? 'Opera Wallet'
          : meta.isTrust ? 'Trust Wallet'
          : meta.isExodus ? 'Exodus'
          : meta.isMetaMask ? 'MetaMask'
          : 'EVM Wallet';
        discoveredWallets.push({ id: `fallback-${name}`, name, provider: eth });
      }
      notifyListeners();
    }
  }, 300);
}

/**
 * Get the current list of discovered wallets. Starts discovery if needed.
 */
export function getDiscoveredWallets(): WalletInfo[] {
  startDiscovery();
  return [...discoveredWallets];
}

/**
 * Subscribe to wallet discovery updates. Returns an unsubscribe function.
 */
export function onWalletsDiscovered(cb: (wallets: WalletInfo[]) => void): () => void {
  listeners.push(cb);
  startDiscovery();
  cb([...discoveredWallets]);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Find a specific wallet by its id.
 */
export function findWallet(id: string): WalletInfo | undefined {
  return discoveredWallets.find(w => w.id === id);
}

/**
 * Get a fallback provider from window.ethereum (legacy path, for backward
 * compatibility with code that doesn't use the picker).
 */
export function getLegacyProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === 'function' ? eth : null;
}
