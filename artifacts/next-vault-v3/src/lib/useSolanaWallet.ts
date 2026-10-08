// ─── NV Protocol — Solana Wallet Hook (Wallet Standard) ──────────────────────
// Discovers Solana wallets using the Wallet Standard (window.navigator.wallets
// or the legacy window.solana fallback). Does NOT use EVM providers.
// Supports: Phantom, Solflare, Backpack, and any other Wallet Standard wallet.
//
// This hook manages ONLY Solana wallet state.
// EVM wallet state is managed separately (walletDiscovery.ts + App.tsx).
// The two wallet stacks never share state or providers.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type SolanaWalletState,
  type SolanaBalanceState,
  type SolanaUsdcBalanceState,
  type SolanaAddress,
  type SolanaAgentContext,
  SOLANA_NETWORK,
  SOLANA_USDC_MINT,
  fetchSolBalance,
  fetchUsdcBalance,
  lamportsToSol,
  rawUsdcToNumber,
} from './solana';

// ─── Wallet Standard types (subset we need) ──────────────────────────────────
// We type only the surface we use, avoiding a hard dep on the full spec at
// runtime (the @wallet-standard/wallet package provides these types for TS).

interface SolanaWalletAccount {
  address: string;
  chains: readonly string[];
}

interface StandardConnectOutput {
  accounts: readonly SolanaWalletAccount[];
}

interface StandardWallet {
  name: string;
  icon?: string;
  chains: readonly string[];
  features: Record<string, unknown>;
  accounts: readonly SolanaWalletAccount[];
}

interface StandardConnectFeature {
  connect(opts?: { silent?: boolean }): Promise<StandardConnectOutput>;
}

interface StandardDisconnectFeature {
  disconnect(): Promise<void>;
}

interface WalletStandardEvents {
  on(event: 'change', handler: () => void): () => void;
}

// Feature names per Wallet Standard spec
const FEATURE_CONNECT         = 'standard:connect';
const FEATURE_DISCONNECT      = 'standard:disconnect';
const FEATURE_EVENTS          = 'standard:events';
const FEATURE_SIGN_AND_SEND   = 'solana:signAndSendTransaction';
const FEATURE_SIGN_TX         = 'solana:signTransaction';
const SOLANA_MAINNET_CHAIN    = 'solana:mainnet';

// ─── Discover wallets ─────────────────────────────────────────────────────────

interface DiscoveredWallet {
  wallet: StandardWallet;
  name: string;
  icon?: string;
}

function getWindowWallets(): DiscoveredWallet[] {
  if (typeof window === 'undefined') return [];

  const discovered: DiscoveredWallet[] = [];

  // Wallet Standard: navigator.wallets (modern) or window.navigator.wallets
  const nav = window.navigator as unknown as {
    wallets?: { get(): readonly StandardWallet[] };
  };
  if (nav.wallets) {
    try {
      for (const w of nav.wallets.get()) {
        if (!isSolanaWallet(w)) continue;
        discovered.push({ wallet: w, name: w.name, icon: w.icon });
      }
    } catch {
      // Ignore — non-standard implementation
    }
  }

  // Wallet Standard: window.phantom?.solana (Phantom specific)
  const phantom = (window as unknown as {
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
        disconnect?: () => Promise<void>;
        on?: (event: string, handler: () => void) => void;
        off?: (event: string, handler: () => void) => void;
      };
    };
  }).phantom;

  // Legacy Solana wallet: window.solana
  const legacySolana = (window as unknown as {
    solana?: {
      isPhantom?: boolean;
      isSolflare?: boolean;
      connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
      disconnect?: () => Promise<void>;
      publicKey?: { toString(): string };
      on?: (event: string, handler: () => void) => void;
      off?: (event: string, handler: () => void) => void;
    };
  }).solana;

  // Wrap legacy wallets into a StandardWallet-like shape.
  // Merge both sources into a common type so all optional flags are accessible.
  const legacyProvider: {
    isPhantom?: boolean;
    isSolflare?: boolean;
    connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
    disconnect?: () => Promise<void>;
    publicKey?: { toString(): string };
    on?: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
  } | undefined = phantom?.solana ?? legacySolana;

  if (legacyProvider && typeof legacyProvider.connect === 'function') {
    const name = legacyProvider.isPhantom ? 'Phantom'
      : legacyProvider.isSolflare ? 'Solflare'
      : 'Solana Wallet';
    // Only add if not already discovered via Wallet Standard
    if (!discovered.find(d => d.name === name)) {
      discovered.push({
        wallet: makeLegacyWalletAdapter(name, legacyProvider),
        name,
        icon: undefined,
      });
    }
  }

  return discovered;
}

/** Adapts a legacy window.solana-style provider to our DiscoveredWallet shape */
function makeLegacyWalletAdapter(
  name: string,
  provider: {
    connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
    disconnect?: () => Promise<void>;
    publicKey?: { toString(): string };
    on?: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
  },
): StandardWallet {
  return {
    name,
    chains: [SOLANA_MAINNET_CHAIN],
    accounts: [],
    features: {
      [FEATURE_CONNECT]: {
        async connect(opts?: { silent?: boolean }): Promise<StandardConnectOutput> {
          if (!provider.connect) throw new Error('connect not available');
          const res = await provider.connect(opts?.silent ? { onlyIfTrusted: true } : {});
          const address = res.publicKey.toString();
          return { accounts: [{ address, chains: [SOLANA_MAINNET_CHAIN] }] };
        },
      } satisfies StandardConnectFeature,
      [FEATURE_DISCONNECT]: {
        async disconnect(): Promise<void> {
          if (provider.disconnect) await provider.disconnect();
        },
      } satisfies StandardDisconnectFeature,
      [FEATURE_EVENTS]: {
        on(_event: string, handler: () => void): () => void {
          if (provider.on) provider.on('accountChanged', handler);
          return () => { if (provider.off) provider.off('accountChanged', handler); };
        },
      } satisfies WalletStandardEvents,
    },
  };
}

function isSolanaWallet(w: StandardWallet): boolean {
  return w.chains.some(c => c.startsWith('solana:'))
    && FEATURE_CONNECT in w.features;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Result of a signAndSendTransaction call.
 * The signature is a base58-encoded transaction signature (the Solana tx id).
 */
export interface SolanaSignAndSendResult {
  signature: string;
}

export interface UseSolanaWalletReturn {
  /** Available Solana wallets discovered via Wallet Standard / legacy APIs */
  availableWallets: DiscoveredWallet[];
  /** Current wallet connection state */
  walletState: SolanaWalletState;
  /** Current SOL balance state */
  balanceState: SolanaBalanceState;
  /** Current USDC balance state (SPL Token, 6 decimals) */
  usdcBalanceState: SolanaUsdcBalanceState;
  /** Connect to a specific wallet by name, or the first available wallet */
  connect(walletName?: string): Promise<void>;
  /** Disconnect the current wallet */
  disconnect(): Promise<void>;
  /** Refresh the SOL and USDC balances for the connected wallet */
  refreshBalance(): Promise<void>;
  /**
   * Sign and send a serialized transaction (as Uint8Array) using the connected wallet.
   * Uses solana:signAndSendTransaction Wallet Standard feature when available,
   * falling back to solana:signTransaction + manual sendRawTransaction.
   *
   * The caller is responsible for building the transaction. This method only signs
   * and submits — it never constructs or modifies the transaction.
   *
   * @param transactionBytes - Serialized transaction (from @solana/kit getBase64EncodedWireTransaction or equivalent)
   * @param options          - Optional commitment level
   * @returns The transaction signature (base58 string)
   * @throws if wallet is not connected or signing is rejected
   */
  signAndSendTransaction(
    transactionBytes: Uint8Array,
    options?: { commitment?: 'processed' | 'confirmed' | 'finalized' },
  ): Promise<SolanaSignAndSendResult>;
  /**
   * Full context snapshot for NV Agent (read-only).
   * Ready for future agent query integration — no transactions.
   */
  agentContext: SolanaAgentContext;
}

export function useSolanaWallet(): UseSolanaWalletReturn {
  const [availableWallets, setAvailableWallets] = useState<DiscoveredWallet[]>([]);
  const [walletState, setWalletState] = useState<SolanaWalletState>({ status: 'disconnected' });
  const [balanceState, setBalanceState] = useState<SolanaBalanceState>({ status: 'idle' });
  const [usdcBalanceState, setUsdcBalanceState] = useState<SolanaUsdcBalanceState>({ status: 'idle' });

  const connectedWalletRef = useRef<StandardWallet | null>(null);
  const cleanupEventsRef = useRef<(() => void) | null>(null);

  // Discover wallets on mount
  useEffect(() => {
    function discover() {
      setAvailableWallets(getWindowWallets());
    }
    discover();

    // Re-check after a short delay (wallets may inject after page load)
    const t = setTimeout(discover, 600);

    // Listen for Wallet Standard register events (wallets added dynamically)
    const handler = () => discover();
    if (typeof window !== 'undefined') {
      window.addEventListener('wallet-standard:register-wallet', handler);
    }

    return () => {
      clearTimeout(t);
      if (typeof window !== 'undefined') {
        window.removeEventListener('wallet-standard:register-wallet', handler);
      }
    };
  }, []);

  const refreshBalance = useCallback(async () => {
    if (walletState.status !== 'connected') {
      setBalanceState({ status: 'idle' });
      setUsdcBalanceState({ status: 'idle' });
      return;
    }
    const { address } = walletState;

    // Fetch SOL and USDC in parallel
    setBalanceState({ status: 'loading' });
    setUsdcBalanceState({ status: 'loading' });

    const [lamports, usdcResult] = await Promise.all([
      fetchSolBalance(address),
      fetchUsdcBalance(address),
    ]);

    // SOL result
    if (lamports === null) {
      setBalanceState({ status: 'error', message: 'RPC error — could not fetch SOL balance' });
    } else {
      setBalanceState({
        status: 'loaded',
        lamports,
        sol: lamportsToSol(lamports),
        fetchedAt: Date.now(),
      });
    }

    // USDC result
    if (usdcResult === null) {
      setUsdcBalanceState({ status: 'error', message: 'RPC error — could not fetch USDC balance' });
    } else if (!usdcResult.found) {
      // No associated token account — wallet has no USDC (show 0, no transaction needed)
      setUsdcBalanceState({ status: 'noAccount' });
    } else {
      setUsdcBalanceState({
        status: 'loaded',
        rawAmount: usdcResult.raw,
        usdc: rawUsdcToNumber(usdcResult.raw),
        fetchedAt: Date.now(),
      });
    }
  }, [walletState]);

  // Auto-refresh balance every 30 seconds when connected
  useEffect(() => {
    if (walletState.status !== 'connected') return;
    refreshBalance();
    const iv = setInterval(refreshBalance, 30_000);
    return () => clearInterval(iv);
  }, [walletState, refreshBalance]);

  const connect = useCallback(async (walletName?: string) => {
    // Clean up any previous event listener
    if (cleanupEventsRef.current) {
      cleanupEventsRef.current();
      cleanupEventsRef.current = null;
    }

    const wallets = getWindowWallets();
    if (wallets.length === 0) {
      setWalletState({ status: 'error', message: 'No Solana wallet detected. Install Phantom or Solflare.' });
      return;
    }

    const target = walletName
      ? wallets.find(w => w.name === walletName)
      : wallets[0];

    if (!target) {
      setWalletState({ status: 'error', message: `Wallet "${walletName}" not found.` });
      return;
    }

    setWalletState({ status: 'connecting' });

    try {
      const connectFeature = target.wallet.features[FEATURE_CONNECT] as StandardConnectFeature;
      const result = await connectFeature.connect({ silent: false });

      if (!result.accounts[0]) {
        setWalletState({ status: 'error', message: 'No accounts returned by wallet.' });
        return;
      }

      const address: SolanaAddress = result.accounts[0].address;
      connectedWalletRef.current = target.wallet;

      setWalletState({
        status: 'connected',
        address,
        walletName: target.name,
        walletIcon: target.icon,
      });

      // Subscribe to account changes
      const eventsFeature = target.wallet.features[FEATURE_EVENTS] as WalletStandardEvents | undefined;
      if (eventsFeature?.on) {
        cleanupEventsRef.current = eventsFeature.on('change', () => {
          // Re-read the accounts after a change
          const accs = connectedWalletRef.current?.accounts;
          if (!accs || accs.length === 0) {
            setWalletState({ status: 'disconnected' });
            setBalanceState({ status: 'idle' });
          } else {
            const newAddress = accs[0].address;
            setWalletState(prev =>
              prev.status === 'connected' && prev.address === newAddress
                ? prev
                : { status: 'connected', address: newAddress, walletName: target.name, walletIcon: target.icon },
            );
          }
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection rejected';
      setWalletState({ status: 'error', message: msg });
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (cleanupEventsRef.current) {
      cleanupEventsRef.current();
      cleanupEventsRef.current = null;
    }

    const wallet = connectedWalletRef.current;
    if (wallet) {
      try {
        const disconnectFeature = wallet.features[FEATURE_DISCONNECT] as StandardDisconnectFeature | undefined;
        if (disconnectFeature?.disconnect) await disconnectFeature.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      connectedWalletRef.current = null;
    }

    setWalletState({ status: 'disconnected' });
    setBalanceState({ status: 'idle' });
    setUsdcBalanceState({ status: 'idle' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupEventsRef.current) cleanupEventsRef.current();
    };
  }, []);

  // ── signAndSendTransaction ────────────────────────────────────────────────
  // Signs a pre-built serialized transaction via the connected wallet.
  // Uses `solana:signAndSendTransaction` if the wallet supports it,
  // otherwise falls back to `solana:signTransaction` + manual RPC sendTransaction.

  const signAndSendTransaction = useCallback(async (
    transactionBytes: Uint8Array,
    options?: { commitment?: 'processed' | 'confirmed' | 'finalized' },
  ): Promise<SolanaSignAndSendResult> => {
    if (walletState.status !== 'connected') {
      throw new Error('Solana wallet is not connected.');
    }

    const wallet = connectedWalletRef.current;
    if (!wallet) throw new Error('Wallet reference lost — please reconnect.');

    const commitment = options?.commitment ?? 'confirmed';
    const chain = SOLANA_MAINNET_CHAIN;

    // Prefer solana:signAndSendTransaction (Wallet Standard)
    const signAndSendFeature = wallet.features[FEATURE_SIGN_AND_SEND] as {
      signAndSendTransaction(opts: {
        transaction: Uint8Array;
        chain: string;
        options?: { commitment?: string };
      }): Promise<{ signature: Uint8Array }>;
    } | undefined;

    if (signAndSendFeature?.signAndSendTransaction) {
      const result = await signAndSendFeature.signAndSendTransaction({
        transaction: transactionBytes,
        chain,
        options: { commitment },
      });
      // Convert Uint8Array signature to base58 string
      const sig = base58Encode(result.signature);
      return { signature: sig };
    }

    // Fallback: solana:signTransaction → sendTransaction via RPC
    const signTxFeature = wallet.features[FEATURE_SIGN_TX] as {
      signTransaction(opts: {
        transaction: Uint8Array;
        chain: string;
      }): Promise<{ signedTransaction: Uint8Array }>;
    } | undefined;

    if (signTxFeature?.signTransaction) {
      const { signedTransaction } = await signTxFeature.signTransaction({
        transaction: transactionBytes,
        chain,
      });
      // Send via JSON-RPC
      const encoded = btoa(String.fromCharCode(...signedTransaction));
      const result = await (await fetch(SOLANA_NETWORK.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [encoded, { encoding: 'base64', preflightCommitment: commitment }],
        }),
      })).json() as { result?: string; error?: { message: string } };

      if (result.error) throw new Error(result.error.message);
      if (!result.result) throw new Error('sendTransaction returned no signature.');
      return { signature: result.result };
    }

    // Legacy: window.solana.signAndSendTransaction
    const legacyProvider = (window as unknown as {
      solana?: {
        signAndSendTransaction?: (tx: { serialize(): Uint8Array }) => Promise<{ signature: string }>;
      };
    }).solana;

    if (legacyProvider?.signAndSendTransaction) {
      const res = await legacyProvider.signAndSendTransaction({
        serialize: () => transactionBytes,
      });
      return { signature: res.signature };
    }

    throw new Error(
      'Connected wallet does not support transaction signing. ' +
      'Please use Phantom or Solflare.',
    );
  }, [walletState]);

  const agentContext: SolanaAgentContext = {
    wallet: walletState,
    balance: balanceState,
    usdcBalance: usdcBalanceState,
    network: SOLANA_NETWORK,
    usdcMint: SOLANA_USDC_MINT,
  };

  return {
    availableWallets,
    walletState,
    balanceState,
    usdcBalanceState,
    connect,
    disconnect,
    refreshBalance,
    signAndSendTransaction,
    agentContext,
  };
}

// ─── base58 encode ────────────────────────────────────────────────────────────
// Minimal base58 encoder for Solana transaction signatures (64-byte Uint8Array).
// Avoids adding a runtime dependency for one use case.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  if (n === 0n) return '1';

  const chars: string[] = [];
  while (n > 0n) {
    chars.unshift(BASE58_ALPHABET[Number(n % 58n)]!);
    n /= 58n;
  }

  // Add leading '1's for leading zero bytes
  for (const b of bytes) {
    if (b !== 0) break;
    chars.unshift('1');
  }

  return chars.join('');
}
