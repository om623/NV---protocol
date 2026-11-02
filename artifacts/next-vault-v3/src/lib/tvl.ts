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

export interface TvlProtocol {
  id: string;
  name: string;
  category?: string;
  tvlUsd: number | null;
  chains: string[];
  change1d: number | null;
  change7d: number | null;
}

export type TvlStatus = 'loading' | 'loaded' | 'error' | 'unavailable';

export interface TvlState {
  status: TvlStatus;
  entries: TvlEntry[];
  protocols: TvlProtocol[];
  fetchedAt: number | null;
  errorMessage?: string;
}

interface LlamaProtocol {
  slug?: string;
  name: string;
  category?: string;
  tvl?: number;
  chains?: string[];
  chainTvls?: Record<string, number>;
  change_1d?: number;
  change_7d?: number;
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

let _state: TvlState = { status: 'loading', entries: [], protocols: [], fetchedAt: null };
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
    const [chainsResult, protocolsResult] = await Promise.allSettled([
      fetch(ENDPOINT, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }),
      fetch('https://api.llama.fi/protocols', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }),
    ]);
    if (chainsResult.status !== 'fulfilled' || !chainsResult.value.ok) {
      const status = chainsResult.status === 'fulfilled' ? chainsResult.value.status : 'network error';
      throw new Error(`DeFiLlama /v2/chains failed: ${status}`);
    }
    const raw = await chainsResult.value.json() as LlamaChain[];
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('DeFiLlama returned an empty chain directory');

    let protocols: TvlProtocol[] = [];
    if (protocolsResult.status === 'fulfilled' && protocolsResult.value.ok) {
      const protocolRaw = await protocolsResult.value.json() as LlamaProtocol[];
      if (Array.isArray(protocolRaw)) {
        const mappedProtocols = protocolRaw
          .filter(protocol => protocol && typeof protocol.name === 'string')
          .map(protocol => {
            const chains = Array.isArray(protocol.chains) ? protocol.chains : [];
            const slug = protocol.slug || protocol.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const reportedTvl = typeof protocol.tvl === 'number'
              && Number.isFinite(protocol.tvl) && protocol.tvl > 0
              ? protocol.tvl
              : null;
            // Use only exact chain keys here; summing metric suffixes such as
            // "-staking" and "-borrowed" can double-count the same deposits.
            const chainBreakdownTvl = chains.reduce((sum, chain) => {
              const value = protocol.chainTvls?.[chain];
              return sum + (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
            }, 0);
            return {
              id: slug,
              name: protocol.name,
              category: protocol.category,
              tvlUsd: reportedTvl ?? (chainBreakdownTvl > 0 ? chainBreakdownTvl : null),
              chains,
              change1d: typeof protocol.change_1d === 'number' ? protocol.change_1d : null,
              change7d: typeof protocol.change_7d === 'number' ? protocol.change_7d : null,
            };
          })
          .sort((a, b) => (b.tvlUsd ?? -1) - (a.tvlUsd ?? -1));

        // Only the visible ranking can contain zero/missing records. Resolve
        // those individually through DeFiLlama's authoritative /tvl/{slug}
        // endpoint, with bounded concurrency to avoid a request burst.
        const visibleCandidates = mappedProtocols.slice(0, 180);
        const needsLookup = visibleCandidates.filter(protocol => protocol.tvlUsd === null || protocol.tvlUsd <= 0);
        let cursor = 0;
        const workers = Array.from({ length: Math.min(6, needsLookup.length) }, async () => {
          while (cursor < needsLookup.length) {
            const protocol = needsLookup[cursor++];
            try {
              const response = await fetch(`https://api.llama.fi/tvl/${encodeURIComponent(protocol.id)}`, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(10_000),
              });
              if (!response.ok) continue;
              const value: unknown = await response.json();
              if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                protocol.tvlUsd = value;
              }
            } catch { /* keep unresolved values unavailable and exclude below */ }
          }
        });
        await Promise.all(workers);
        protocols = visibleCandidates
          .filter(protocol => protocol.tvlUsd !== null && protocol.tvlUsd > 0)
          .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
      }
    }

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

    _state = { status: 'loaded', entries, protocols, fetchedAt: now };
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
  if (usd >= 1e12) return '$' + (usd / 1e12).toFixed(2) + 'T';
  if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B';
  if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
  if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(0) + 'K';
  if (usd < 0.01) return '$' + usd.toPrecision(2);
  if (usd < 1) return '$' + usd.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return '$' + usd.toFixed(2).replace(/\.00$/, '');
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
