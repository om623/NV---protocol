// ─── NV Protocol — TVL Service (DeFiLlama) ───────────────────────────────────
// Loads the complete live chain directory from DeFiLlama instead of maintaining
// a small manually curated network list. Missing values remain unavailable.

export interface TvlEntry {
  id: string;
  displayName: string;
  tvlUsd: number | null;
  change1d: number | null;
  change7d: number | null;
  status: 'loaded' | 'unavailable';
  fetchedAt: number;
  chainId?: number;
  tokenSymbol?: string;
  geckoId?: string;
}

export type TvlStatus = 'loading' | 'loaded' | 'error' | 'unavailable';

export interface TvlState {
  status: TvlStatus;
  entries: TvlEntry[];
  fetchedAt: number | null;
  errorMessage?: string;
}

interface LlamaChain {
  name: string;
  tvl: number;
  tokenSymbol?: string;
  chainId?: number;
  gecko_id?: string;
}

const REFRESH_INTERVAL_MS = 60_000;
const ENDPOINT = 'https://api.llama.fi/v2/chains';

let _state: TvlState = { status: 'loading', entries: [], fetchedAt: null };
let _lastFetch = 0;
let _listeners: (() => void)[] = [];
let _pendingFetch: Promise<void> | null = null;

function notify() {
  for (const listener of _listeners) {
    try { listener(); } catch { /* isolate subscribers */ }
  }
}

export function subscribeTvl(fn: () => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(listener => listener !== fn); };
}

export function getTvlState(): TvlState {
  return _state;
}

/** Fetch every chain currently listed by DeFiLlama; no 27-chain allowlist. */
export async function fetchTvlNetworks(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - _lastFetch < REFRESH_INTERVAL_MS) return;
  if (_pendingFetch) return _pendingFetch;
  _pendingFetch = _doFetch().finally(() => { _pendingFetch = null; });
  return _pendingFetch;
}

async function _doFetch(): Promise<void> {
  _lastFetch = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`DeFiLlama /v2/chains returned HTTP ${response.status}`);

    const raw = await response.json() as LlamaChain[];
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('DeFiLlama returned an empty chain directory');

    const now = Date.now();
    const seen = new Set<string>();
    const entries: TvlEntry[] = raw
      .filter(chain => chain && typeof chain.name === 'string' && chain.name.trim())
      .map(chain => {
        const name = chain.name.trim();
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const uniqueId = seen.has(id) ? `${id}-${String(chain.chainId ?? seen.size)}` : id;
        seen.add(id);
        const validTvl = typeof chain.tvl === 'number' && Number.isFinite(chain.tvl) && chain.tvl >= 0;
        return {
          id: uniqueId,
          displayName: name,
          tvlUsd: validTvl ? chain.tvl : null,
          // /v2/chains supplies current TVL only; do not fabricate daily/weekly deltas.
          change1d: null,
          change7d: null,
          status: validTvl ? 'loaded' as const : 'unavailable' as const,
          fetchedAt: now,
          chainId: typeof chain.chainId === 'number' ? chain.chainId : undefined,
          tokenSymbol: chain.tokenSymbol,
          geckoId: chain.gecko_id,
        };
      })
      .sort((a, b) => {
        if (a.tvlUsd === null && b.tvlUsd === null) return a.displayName.localeCompare(b.displayName);
        if (a.tvlUsd === null) return 1;
        if (b.tvlUsd === null) return -1;
        return b.tvlUsd - a.tvlUsd;
      });

    _state = { status: 'loaded', entries, fetchedAt: now };
    notify();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    _state = { ..._state, status: 'error', errorMessage: message };
    notify();
  }
}

export function formatTvl(usd: number | null): string {
  if (usd === null || !Number.isFinite(usd)) return 'N/A';
  if (usd === 0) return '$0';
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

export function formatTvlChange(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return 'N/A';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

// Initial fetch and conservative one-minute refresh.
fetchTvlNetworks();
if (typeof setInterval !== 'undefined') {
  setInterval(() => { fetchTvlNetworks(); }, REFRESH_INTERVAL_MS);
}
