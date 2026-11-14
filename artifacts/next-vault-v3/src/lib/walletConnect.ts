// ─── WalletConnect (EVM) ──────────────────────────────────────────────────────
// Adds WalletConnect as one more EIP-1193 provider source for the existing NV
// wallet flow. It does NOT replace the injected-wallet (EIP-6963) discovery and
// does NOT own any wallet state: App.tsx keeps address / chain / balances and
// receives this provider through the same `WalletInfo` shape as MetaMask.
//
// Security:
//   • Connection and communication layer only. Every signature and transaction
//     is approved inside the user's wallet app.
//   • No seed phrases or private keys are ever requested or handled here.
//   • The SDK keeps its own pairing/session data in localStorage (relay session
//     keys, not wallet keys). Disconnecting clears it.
//   • The Project ID is read from VITE_WALLETCONNECT_PROJECT_ID. It is a public
//     identifier, but it is never hardcoded.
//
// The SDK is loaded lazily, so users who never use WalletConnect do not pay for it.

import type EthereumProviderType from '@walletconnect/ethereum-provider';
import type { Eip1193Provider } from './arc';
import type { WalletInfo } from './walletDiscovery';
import { NETWORKS_CONFIG } from '../networks';

export type WalletConnectErrorCode =
  | 'not-configured'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'timeout' // the SDK or the pairing QR did not become ready in time (see WC_TIMEOUTS)
  | 'blocked' // the page's Content Security Policy refused the connection to the relay
  | 'failed';

export class WalletConnectError extends Error {
  code: WalletConnectErrorCode;
  constructor(code: WalletConnectErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'WalletConnectError';
    this.code = code;
  }
}

const PROJECT_ID: string = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim();

export function isWalletConnectConfigured(): boolean {
  return PROJECT_ID.length > 0;
}

/** Read-only view of the networks NV already supports (nothing is changed here). */
function buildChainConfig() {
  const live = NETWORKS_CONFIG.filter((n) => !n.comingSoon && n.rpcUrl);
  // Every live NV network is optional. No chain is mandatory: wallets that support only a subset can still pair.
  // Reown's current CAIP-25 guidance is to leave the deprecated `chains` option unset.
  const optionalChains = Array.from(new Set(live.map((n) => n.chainId)));
  const rpcMap: Record<string, string> = {};
  for (const n of live) rpcMap[String(n.chainId)] = n.rpcUrl;
  return { optionalChains, rpcMap };
}

let instance: EthereumProviderType | null = null;

// "The wallet ended the session" is detected here, once per provider instance, and not inside a React effect: the SDK
// first clears its accounts (which makes NV disconnect and re-render) and only afterwards emits `disconnect`, so a
// listener tied to React state would already be gone. A session ended by the user's own Disconnect is not reported.
let sessionActive = false;
let userInitiatedDisconnect = false;
const sessionEndedHandlers = new Set<() => void>();

/** Subscribe to "the wallet ended the WalletConnect session". Returns the unsubscribe function. */
export function onWalletConnectSessionEnded(handler: () => void): () => void {
  sessionEndedHandlers.add(handler);
  return () => { sessionEndedHandlers.delete(handler); };
}
/**
 * Time budgets in milliseconds. Without them a relay that cannot be reached leaves the panel on "Preparing connection..."
 * forever (the SDK only creates the pairing once it is subscribed to the relay). Exported as a mutable object so tests can
 * shorten them.
 */
export const WC_TIMEOUTS = {
  /** Loading the SDK and initialising it (storage, relay transport). */
  init: 20_000,
  /** From starting a pairing until the pairing URI (the QR Code) is available. Waiting for the wallet to approve is NOT limited here. */
  uri: 25_000,
};

function safeUri(uri: string): string {
  try { const u = new URL(uri); return `${u.host}${u.pathname}`; } catch { return 'relay'; }
}

// ── Development-only diagnostics (every use is behind import.meta.env.DEV, so production builds drop all of it) ─────────────────
interface DevSocketRecord { openedAfterMs?: number; closeCode?: number; livedMs?: number; errored: boolean }
const devDiag: { importMs?: number; initMs?: number; uriMs?: number; sockets: DevSocketRecord[] } = { sockets: [] };

export interface WalletConnectDiagnostics {
  importMs?: number; initMs?: number; uriMs?: number;
  sockets: number; opened: number; errors: number; closes: Record<string, number>; lastLivedMs?: number;
}

/** Counters about the SDK start-up and the relay sockets, for the dev-only panel line. Never contains a URL or a token. */
export function getWalletConnectDiagnostics(): WalletConnectDiagnostics | null {
  if (!import.meta.env.DEV) return null;
  const closes: Record<string, number> = {};
  for (const r of devDiag.sockets) if (r.closeCode !== undefined) closes[String(r.closeCode)] = (closes[String(r.closeCode)] ?? 0) + 1;
  const last = [...devDiag.sockets].reverse().find((r) => r.livedMs !== undefined);
  return {
    importMs: devDiag.importMs, initMs: devDiag.initMs, uriMs: devDiag.uriMs,
    sockets: devDiag.sockets.length,
    opened: devDiag.sockets.filter((r) => r.openedAfterMs !== undefined).length,
    errors: devDiag.sockets.filter((r) => r.errored).length,
    closes, lastLivedMs: last?.livedMs,
  };
}

const RELAY_PROXY_PATH = '/wc-relay';
const RELAY_HOST = 'relay.walletconnect.org';

/**
 * Development only (the local dev server and the Arc Studio Preview). The Preview serves the page under "connect-src 'self'",
 * which forbids a WebSocket to relay.walletconnect.org. The SDK is left to use the default relay address (it signs its auth token
 * for that address, and the relay rejects a token signed for any other: HTTP 401), but the actual socket is redirected to the dev
 * server's same-origin proxy at /wc-relay, which forwards it to the relay.
 *
 * Only sockets aimed at the relay host are redirected; Vite's HMR socket and anything else are untouched. In production builds
 * `import.meta.env.DEV` is a build-time false, so this function and the redirector are removed from the bundle and the SDK talks to
 * the relay directly, exactly as before.
 */
export function installDevRelayRedirect(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  const flag = '__nvWcRelayRedirect';
  const w = window as unknown as Record<string, unknown>;
  if (w[flag]) return;
  w[flag] = true;
  const Native = window.WebSocket;
  class RelayRedirectingWebSocket extends Native {
    constructor(url: string | URL, protocols?: string | string[]) {
      const target = RelayRedirectingWebSocket.redirect(url);
      super(target, protocols);
      if (target !== url) {
        // a relay socket: remember how it behaved (counters only)
        const rec: DevSocketRecord = { errored: false };
        devDiag.sockets.push(rec);
        if (devDiag.sockets.length > 50) devDiag.sockets.shift();
        const t0 = Date.now();
        this.addEventListener('open', () => { rec.openedAfterMs = Date.now() - t0; });
        this.addEventListener('error', () => { rec.errored = true; });
        this.addEventListener('close', (e) => { rec.closeCode = (e as CloseEvent).code; rec.livedMs = Date.now() - t0; });
      }
    }
    static redirect(url: string | URL): string | URL {
      try {
        const u = new URL(String(url));
        if (u.hostname !== RELAY_HOST) return url;
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${window.location.host}${RELAY_PROXY_PATH}${u.search}`;
      } catch {
        return url;
      }
    }
  }
  window.WebSocket = RelayRedirectingWebSocket as unknown as typeof WebSocket;
}

/** True when a blocked URL is the relay connection (the direct relay, or the same-origin proxy path). */
function isRelayUri(blockedUri: string): boolean {
  try {
    const u = new URL(blockedUri);
    if (/(^|\.)relay\.walletconnect\.(org|com)$/.test(u.hostname)) return true;
    return u.host === window.location.host && u.pathname.startsWith(RELAY_PROXY_PATH);
  } catch {
    return false;
  }
}

/**
 * Listens for Content Security Policy violations on the relay connection. The promise rejects with a 'blocked' error at the
 * first one, so the user sees the real reason immediately instead of waiting for a timeout. Violations for any other host (for
 * example market data) are ignored: they do not stop WalletConnect.
 */
function watchRelayBlocked(): { promise: Promise<never>; stop: () => void } {
  let handler: ((e: Event) => void) | undefined;
  const promise = new Promise<never>((_, reject) => {
    if (typeof document === 'undefined') return;
    handler = (e: Event) => {
      const blocked = (e as SecurityPolicyViolationEvent).blockedURI ?? '';
      // The message keeps only host and path: the full URL can carry the relay auth token.
      if (isRelayUri(blocked)) reject(new WalletConnectError('blocked', safeUri(blocked)));
    };
    document.addEventListener('securitypolicyviolation', handler);
  });
  return {
    promise,
    stop: () => { if (handler && typeof document !== 'undefined') document.removeEventListener('securitypolicyviolation', handler); },
  };
}

function raceWithTimeout<T>(work: Promise<T>, ms: number, guard?: Promise<never>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WalletConnectError('timeout')), ms);
  });
  return Promise.race(guard ? [work, timeout, guard] : [work, timeout]).finally(() => clearTimeout(timer));
}

let initPromise: Promise<EthereumProviderType> | null = null;

function startInit(): Promise<EthereumProviderType> {
  const work = (async () => {
    installDevRelayRedirect();
    const tInit = Date.now();
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
    if (import.meta.env.DEV) devDiag.importMs = Date.now() - tInit;
    const { optionalChains, rpcMap } = buildChainConfig();
    const origin = window.location.origin;
    const provider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      optionalChains: optionalChains as [number, ...number[]],
      rpcMap,
      // NV renders its own non-blocking QR panel instead of the SDK's full-screen modal.
      showQrModal: false,
      metadata: {
        name: 'NV Protocol',
        description: 'Next Vault Protocol: Bridge, Swap and market intelligence.',
        url: origin,
        icons: [`${origin}/favicon.svg`],
      },
    });
    if (import.meta.env.DEV) devDiag.initMs = Date.now() - tInit;
    provider.on('disconnect', () => {
      if (!sessionActive || userInitiatedDisconnect) return;
      sessionActive = false;
      sessionEndedHandlers.forEach((h) => { try { h(); } catch { /* a handler must not break the others */ } });
    });
    instance = provider;
    return provider;
  })();
  initPromise = work;
  const clear = () => { if (initPromise === work) initPromise = null; };
  work.then(clear, clear);
  return work;
}

/**
 * Returns the single SDK instance. The init promise is shared and kept: if one attempt times out, the next attempt waits on the
 * same initialisation instead of starting a second one (a second Core on the same storage and relay breaks both clients).
 */
async function getInstance(guard?: Promise<never>): Promise<EthereumProviderType> {
  if (!isWalletConnectConfigured()) throw new WalletConnectError('not-configured');
  if (instance) return instance;
  return raceWithTimeout(initPromise ?? startInit(), WC_TIMEOUTS.init, guard);
}

/** Cancel a pairing that is still waiting for the wallet, so the same SDK instance can start a clean one next time. */
function abortPendingPairing(p: EthereumProviderType): void {
  try {
    (p as unknown as { signer?: { abortPairingAttempt?: () => void } }).signer?.abortPairingAttempt?.();
  } catch {
    // nothing pending, nothing to cancel
  }
}

function toWalletInfo(p: EthereumProviderType): WalletInfo {
  const peer = p.session?.peer?.metadata;
  return {
    id: 'walletconnect',
    name: peer?.name ? `${peer.name} (WalletConnect)` : 'WalletConnect',
    icon: peer?.icons?.[0],
    rdns: 'org.walletconnect',
    provider: p as unknown as Eip1193Provider,
  };
}

function classifyError(err: unknown): WalletConnectError {
  if (err instanceof WalletConnectError) return err;
  const e = err as { code?: number; message?: string } | undefined;
  const msg = (e?.message ?? '').toLowerCase();
  if (e?.code === 5000 || e?.code === 4001 || msg.includes('rejected') || msg.includes('declined')) {
    return new WalletConnectError('rejected', e?.message);
  }
  if (msg.includes('expired') || msg.includes('timeout') || msg.includes('timed out')) {
    return new WalletConnectError('expired', e?.message);
  }
  return new WalletConnectError('failed', e?.message);
}

/** True when `provider` is the WalletConnect provider managed by this module. */
export function isWalletConnectProvider(provider: unknown): boolean {
  return instance !== null && provider === (instance as unknown);
}

/**
 * Open a WalletConnect pairing. `onUri` receives the pairing URI (render it as a
 * QR Code, or open it on mobile). Resolves with a `WalletInfo` once the user
 * approves in their wallet. Rejects with a `WalletConnectError`.
 */
export async function connectWalletConnect(
  onUri: (uri: string) => void,
  signal: AbortSignal,
): Promise<WalletInfo> {
  const watch = watchRelayBlocked();
  let uriTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    let provider: EthereumProviderType;
    try {
      provider = await getInstance(watch.promise);
    } catch (err) {
      throw classifyError(err);
    }
    if (signal.aborted) throw new WalletConnectError('cancelled');

    // An authorised session already exists: reuse it instead of pairing again.
    if (provider.session && provider.accounts.length > 0) { sessionActive = true; return toWalletInfo(provider); }

    const tPair = Date.now();
    const handleUri = (uri: string) => { clearTimeout(uriTimer); if (import.meta.env.DEV) devDiag.uriMs = Date.now() - tPair; onUri(uri); };
    provider.on('display_uri', handleUri);

    const connectPromise = provider.connect();
    let onAbort: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => reject(new WalletConnectError('cancelled'));
      signal.addEventListener('abort', onAbort, { once: true });
    });
    // The pairing URI must show up soon: it only exists once the SDK is subscribed to the relay.
    const uriTimeout = new Promise<never>((_, reject) => {
      uriTimer = setTimeout(() => reject(new WalletConnectError('timeout')), WC_TIMEOUTS.uri);
    });

    try {
      await Promise.race([connectPromise, abortPromise, uriTimeout, watch.promise]);
      sessionActive = true;
      return toWalletInfo(provider);
    } catch (err) {
      const classified = classifyError(err);
      if (classified.code === 'cancelled') {
        // If the wallet approves after the user cancelled, close that session so
        // NV never ends up connected without the user's knowledge.
        connectPromise.then(() => provider.disconnect()).catch(() => undefined);
      }
      // A failed or abandoned pairing must not leave the SDK waiting. The instance is KEPT (never re-initialised: a second
      // Core on the same storage and relay makes both clients process each other's messages, "Init() was called 2 times").
      abortPendingPairing(provider);
      throw classified;
    } finally {
      provider.removeListener('display_uri', handleUri);
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  } finally {
    clearTimeout(uriTimer);
    watch.stop();
  }
}

const WC_IDB_NAME = 'WALLET_CONNECT_V2_INDEXED_DB';
const WC_IDB_STORE = 'keyvaluestorage';
const WC_SESSION_KEY = /^wc@2:client:[^:]+:session$/;

/** A stored session value is "real" when it is a non-empty list (the SDK serialises it as JSON or as an array). */
function isNonEmptySession(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.length > 2 && value !== '[]';
  return value !== null && value !== undefined;
}

/** Older SDK releases kept their data in localStorage, under keys that end in a double slash plus 'session'. */
function hasLegacyLocalStorageSession(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wc@2:') && key.endsWith('//session') && isNonEmptySession(localStorage.getItem(key))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Current SDK releases (2.2x) keep their data in IndexedDB. This is a read-only probe: if the database does not
 * exist it is NOT created (the upgrade is aborted), so the SDK's own first initialisation is never disturbed.
 */
function hasIndexedDbSession(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const req = indexedDB.open(WC_IDB_NAME);
      req.onupgradeneeded = () => { try { req.transaction?.abort(); } catch { /* nothing to undo */ } };
      req.onerror = () => done(false);
      req.onblocked = () => done(false);
      req.onsuccess = () => {
        const db = req.result;
        try {
          if (!db.objectStoreNames.contains(WC_IDB_STORE)) { db.close(); done(false); return; }
          const store = db.transaction(WC_IDB_STORE, 'readonly').objectStore(WC_IDB_STORE);
          const keysReq = store.getAllKeys();
          keysReq.onsuccess = () => {
            const key = keysReq.result.map(String).find((k) => WC_SESSION_KEY.test(k));
            if (!key) { db.close(); done(false); return; }
            const getReq = store.get(key);
            getReq.onsuccess = () => { db.close(); done(isNonEmptySession(getReq.result)); };
            getReq.onerror = () => { db.close(); done(false); };
          };
          keysReq.onerror = () => { db.close(); done(false); };
        } catch {
          try { db.close(); } catch { /* ignore */ }
          done(false);
        }
      };
    } catch {
      done(false);
    }
  });
}

/** Cheap check so the SDK is only loaded when there is something to restore. */
export async function hasPersistedWalletConnectSession(): Promise<boolean> {
  if (!isWalletConnectConfigured()) return false;
  return hasLegacyLocalStorageSession() || (await hasIndexedDbSession());
}

/**
 * Restore a previously authorised session without prompting the wallet.
 * Returns null when there is nothing valid to restore.
 */
export async function restoreWalletConnect(): Promise<WalletInfo | null> {
  if (!(await hasPersistedWalletConnectSession())) return null;
  try {
    const provider = await getInstance();
    if (provider.session && provider.accounts.length > 0) { sessionActive = true; return toWalletInfo(provider); }
  } catch {
    // restoring is best effort; the user can always reconnect manually
  }
  return null;
}

/** True while the SDK still holds an authorised session (it is cleared first when the wallet ends it). */
export function isWalletConnectSessionAlive(): boolean {
  return !!instance?.session;
}

/**
 * True when the active WalletConnect session approved `chainId`. A network the wallet only "added" later is NOT usable in
 * this session (WalletConnect needs it in the session's namespaces), so NV must not report that switch as done.
 */
export function isChainApprovedInWalletConnectSession(chainId: number): boolean {
  const ns = instance?.session?.namespaces?.eip155;
  if (!ns) return false;
  const ref = `eip155:${chainId}`;
  return (ns.chains ?? []).includes(ref) || (ns.accounts ?? []).some((a) => a.startsWith(`${ref}:`));
}

/** Put the SDK's default network back on an approved one after an unusable switch (local, the wallet is not asked). */
export async function restoreWalletConnectChain(chainId: number): Promise<void> {
  if (!instance || !isChainApprovedInWalletConnectSession(chainId)) return;
  try {
    await instance.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }] });
  } catch {
    // best effort: the mismatch banner already tells the user the truth
  }
}

/** Terminate the WalletConnect session (also clears the SDK's stored session). */
export async function disconnectWalletConnect(): Promise<void> {
  const current = instance;
  if (!current) return;
  // No session left means it already ended (typically the wallet ended it and NV is just reacting). There is nothing to
  // close, and this must not be mistaken for a disconnect of ours, or the "connection interrupted" notice would be lost.
  if (!current.session) return;
  userInitiatedDisconnect = true;
  sessionActive = false;
  try {
    await current.disconnect();
  } catch {
    // the session may already be closed on the wallet side
  } finally {
    userInitiatedDisconnect = false; // the instance stays: it is reused for the next connection
  }
}
