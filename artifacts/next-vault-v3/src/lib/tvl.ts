// ─── NV Protocol — TVL Service (DeFiLlama) ───────────────────────────────────
//
// Fetches per-chain TVL from DeFiLlama's public API.
// Single call to /v2/chains — no authentication required.
//
// Source: https://api.llama.fi / https://api-docs.defillama.com/
// Rate limiting: be conservative — one call per 60s max.
//
// NEVER invents TVL data. If a chain is missing from the API response
// its status is 'unavailable' and the UI shows N/A.

// ─── Network registry ────────────────────────────────────────────────────────
// Visual name (for UI display) → DeFiLlama API name (for lookup).
// When the visual name exactly matches the API name, the entry is still
// explicit so the mapping is always auditable.

export interface TvlNetwork {
  /** Unique key used internally */
  id: string;
  /** Display name shown in the UI */
  displayName: string;
  /** Name used to look up the chain in the DeFiLlama /v2/chains response */
  llamaName: string;
}

/**
 * Central registry of the 27 networks to track.
 * Keep sorted by rank / typical TVL descending for default display order.
 * The actual display order is computed at runtime from live TVL data.
 */
export const TVL_NETWORKS: TvlNetwork[] = [
  { id: 'ethereum',   displayName: 'Ethereum',       llamaName: 'Ethereum'       },
  { id: 'solana',     displayName: 'Solana',          llamaName: 'Solana'         },
  { id: 'base',       displayName: 'Base',            llamaName: 'Base'           },
  { id: 'bnb',        displayName: 'BNB Chain',       llamaName: 'BSC'            },
  { id: 'arbitrum',   displayName: 'Arbitrum',        llamaName: 'Arbitrum'       },
  { id: 'polygon',    displayName: 'Polygon',         llamaName: 'Polygon'        },
  { id: 'avalanche',  displayName: 'Avalanche',       llamaName: 'Avalanche'      },
  { id: 'optimism',   displayName: 'Optimism',        llamaName: 'Optimism'       },
  { id: 'sui',        displayName: 'Sui',             llamaName: 'Sui'            },
  { id: 'starknet',   displayName: 'Starknet',        llamaName: 'Starknet'       },
  { id: 'monad',      displayName: 'Monad',           llamaName: 'Monad'          },
  { id: 'hyperevm',   displayName: 'HyperEVM',        llamaName: 'Hyperliquid L1' },
  { id: 'aptos',      displayName: 'Aptos',           llamaName: 'Aptos'          },
  { id: 'arc',        displayName: 'Arc',             llamaName: 'Arc'            },
  { id: 'cronos',     displayName: 'Cronos',          llamaName: 'Cronos'         },
  { id: 'mantle',     displayName: 'Mantle',          llamaName: 'Mantle'         },
  { id: 'berachain',  displayName: 'Berachain',       llamaName: 'Berachain'      },
  { id: 'sei',        displayName: 'Sei',             llamaName: 'Sei'            },
  { id: 'unichain',   displayName: 'Unichain',        llamaName: 'Unichain'       },
  { id: 'scroll',     displayName: 'Scroll',          llamaName: 'Scroll'         },
  { id: 'zksync',     displayName: 'zkSync Era',      llamaName: 'ZKsync Era'     },
  { id: 'linea',      displayName: 'Linea',           llamaName: 'Linea'          },
  { id: 'blast',      displayName: 'Blast',           llamaName: 'Blast'          },
  { id: 'celo',       displayName: 'Celo',            llamaName: 'Celo'           },
  { id: 'injective',  displayName: 'Injective',       llamaName: 'Injective'      },
  { id: 'sonic',      displayName: 'Sonic',           llamaName: 'Sonic'          },
  { id: 'xdc',        displayName: 'XDC',             llamaName: 'XDC'            },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TvlStatus = 'loading' | 'loaded' | 'error' | 'unavailable';

export interface TvlEntry {
  /** Network id (matches TVL_NETWORKS[n].id) */
  id: string;
  /** Display name */
  displayName: string;
  /** TVL in USD, null = unavailable */
  tvlUsd: number | null;
  /** 1-day change %, null = not available from this endpoint */
  change1d: number | null;
  /** 7-day change %, null = not available from this endpoint */
  change7d: number | null;
  /** Whether data came from the API (vs. absent) */
  status: 'loaded' | 'unavailable';
  /** Epoch ms of last successful fetch */
  fetchedAt: number;
}

export interface TvlState {
  status: TvlStatus;
  entries: TvlEntry[];
  fetchedAt: number | null;
  errorMessage?: string;
}

// ─── DeFiLlama API response shape ────────────────────────────────────────────

interface LlamaChain {
  name: string;
  tvl: number;
  change_1d?: number | null;
  change_7d?: number | null;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000; // 60 s — per spec

let _state: TvlState = {
  status: 'loading',
  entries: TVL_NETWORKS.map(n => ({
    id: n.id,
    displayName: n.displayName,
    tvlUsd: null,
    change1d: null,
    change7d: null,
    status: 'unavailable',
    fetchedAt: 0,
  })),
  fetchedAt: null,
};

let _lastFetch = 0;
let _listeners: (() => void)[] = [];
let _pendingFetch: Promise<void> | null = null;

function notify() {
  for (const fn of _listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

/** Subscribe to TVL state changes. Returns an unsubscribe function. */
export function subscribeTvl(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

/** Get the current snapshot (reactive — use subscribeTvl for updates) */
export function getTvlState(): TvlState {
  return _state;
}

/**
 * Fetch TVL for all 27 networks from DeFiLlama in a single call.
 * Respects the 60s minimum interval; safe to call multiple times.
 * Does NOT throw — errors are captured in state.
 */
export async function fetchTvlNetworks(): Promise<void> {
  const now = Date.now();
  if (now - _lastFetch < REFRESH_INTERVAL_MS) return;

  // Deduplicate concurrent calls
  if (_pendingFetch) return _pendingFetch;

  _pendingFetch = _doFetch().finally(() => { _pendingFetch = null; });
  return _pendingFetch;
}

async function _doFetch(): Promise<void> {
  _lastFetch = Date.now();

  try {
    const res = await fetch('https://api.llama.fi/v2/chains', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`DeFiLlama /v2/chains returned HTTP ${res.status}`);
    }

    const raw = (await res.json()) as LlamaChain[];

    // Build lookup by name (case-sensitive — we match DeFiLlama's casing exactly)
    const byName = new Map<string, LlamaChain>();
    for (const chain of raw) {
      if (chain.name) byName.set(chain.name, chain);
    }

    const now = Date.now();
    const entries: TvlEntry[] = TVL_NETWORKS.map(n => {
      const chain = byName.get(n.llamaName);
      if (!chain || typeof chain.tvl !== 'number') {
        return {
          id: n.id,
          displayName: n.displayName,
          tvlUsd: null,
          change1d: null,
          change7d: null,
          status: 'unavailable' as const,
          fetchedAt: now,
        };
      }
      return {
        id: n.id,
        displayName: n.displayName,
        tvlUsd: chain.tvl,
        change1d: typeof chain.change_1d === 'number' ? chain.change_1d : null,
        change7d: typeof chain.change_7d === 'number' ? chain.change_7d : null,
        status: 'loaded' as const,
        fetchedAt: now,
      };
    });

    // Sort by TVL descending; unavailable go to the bottom
    entries.sort((a, b) => {
      if (a.tvlUsd === null && b.tvlUsd === null) return 0;
      if (a.tvlUsd === null) return 1;
      if (b.tvlUsd === null) return -1;
      return b.tvlUsd - a.tvlUsd;
    });

    _state = { status: 'loaded', entries, fetchedAt: now };
    notify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Keep previous entries on error (stale data is better than blank)
    _state = {
      ..._state,
      status: 'error',
      errorMessage: msg,
    };
    notify();
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/** Format a TVL value for display (e.g. $51.5B, $1.2M, N/A) */
export function formatTvl(usd: number | null): string {
  if (usd === null || !Number.isFinite(usd)) return 'N/A';
  if (usd === 0) return '$0';
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

/** Format a percent change for display (e.g. +2.34%, -1.12%, N/A) */
export function formatTvlChange(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return 'N/A';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// ─── Auto-refresh ─────────────────────────────────────────────────────────────

// Initial fetch on module load
fetchTvlNetworks();

// Periodic refresh every 60s
if (typeof setInterval !== 'undefined') {
  setInterval(() => { fetchTvlNetworks(); }, REFRESH_INTERVAL_MS);
}
