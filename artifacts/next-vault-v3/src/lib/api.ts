// ─── Real Market Data API Layer ──────────────────────────────────────────────
// Public, keyless APIs:
//   CoinGecko    — crypto prices, market cap, volume, sparkline, BTC dominance
//   alternative.me — Fear & Greed Index
//   DefiLlama    — TVL per chain and protocol
//
// All fetches are cached with a TTL to avoid rate limits. If a fetch fails,
// the last successful cache entry is returned (stale-while-error). If there
// is no cache at all, the caller gets null and falls back to simulated data.

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string, maxAgeMs: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) return null;
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Deduplicated, cached fetch. If the same key is in-flight, reuses the promise. */
async function cachedFetch<T>(
  key: string,
  url: string,
  ttlMs: number,
  timeoutMs?: number,
): Promise<T | null> {
  const cached = getCached<T>(key, ttlMs);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) {
    try { return (await existing) as T; } catch { /* fall through */ }
  }

  const p = fetchJson<T>(url, timeoutMs)
    .then((data) => { setCached(key, data); return data; })
    .catch((err) => {
      // Return stale cache if available (stale-while-error)
      const stale = cache.get(key);
      if (stale) return stale.data as T;
      console.warn(`[api] ${key} failed:`, err);
      return null;
    })
    .finally(() => { inflight.delete(key); });

  inflight.set(key, p);
  return (await p) as T | null;
}

// ─── CoinGecko: crypto market data ───────────────────────────────────────────

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d?: number;
  sparkline_in_7d?: { price: number[] };
  high_24h?: number;
  low_24h?: number;
  circulating_supply?: number;
}

const COINGECKO_IDS = [
  'bitcoin', 'ethereum', 'solana', 'arbitrum', 'optimism',
  'chainlink', 'tether', 'usd-coin', 'eurocoin',
];

const COINGECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ARB: 'arbitrum',
  OP: 'optimism',
  LINK: 'chainlink',
  USDT: 'tether',
  USDC: 'usd-coin',
  EURC: 'eurocoin',
};

const COINGECKO_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(COINGECKO_MAP).map(([sym, id]) => [id, sym]),
);

const PRICE_TTL = 60_000; // 1 minute

export async function fetchCryptoPrices(): Promise<Map<string, CoinGeckoCoin>> {
  const ids = COINGECKO_IDS.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h,7d`;
  const data = await cachedFetch<CoinGeckoCoin[]>('cg_markets', url, PRICE_TTL);
  if (!data) return new Map();
  const map = new Map<string, CoinGeckoCoin>();
  for (const coin of data) {
    const sym = COINGECKO_REVERSE[coin.id];
    if (sym) map.set(sym, coin);
  }
  return map;
}

// ─── CoinGecko: global data (BTC dominance, total mcap/vol) ──────────────────

export interface GlobalMarketData {
  btcDominance: number;
  ethDominance: number;
  totalMarketCap: number;
  totalVolume: number;
  marketCapChange24h: number;
  activeCryptos: number;
}

const GLOBAL_TTL = 120_000; // 2 minutes

export async function fetchGlobalMarket(): Promise<GlobalMarketData | null> {
  const url = 'https://api.coingecko.com/api/v3/global';
  const data = await cachedFetch<{ data: Record<string, unknown> }>('cg_global', url, GLOBAL_TTL);
  if (!data?.data) return null;
  const d = data.data;
  const mcp = d['market_cap_percentage'] as Record<string, number> | undefined;
  const tmc = d['total_market_cap'] as Record<string, number> | undefined;
  const tvol = d['total_volume'] as Record<string, number> | undefined;
  return {
    btcDominance: mcp?.['btc'] ?? 0,
    ethDominance: mcp?.['eth'] ?? 0,
    totalMarketCap: tmc?.['usd'] ?? 0,
    totalVolume: tvol?.['usd'] ?? 0,
    marketCapChange24h: (d['market_cap_change_percentage_24h_usd'] as number) ?? 0,
    activeCryptos: (d['active_cryptocurrencies'] as number) ?? 0,
  };
}

// ─── CoinGecko: historical chart data for portfolio evolution ────────────────

export interface PricePoint { t: number; v: number; }

const CHART_TTL = 300_000; // 5 minutes

export async function fetchPriceChart(coinId: string, days = 30): Promise<PricePoint[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const data = await cachedFetch<{ prices: [number, number][] }>(`cg_chart_${coinId}_${days}`, url, CHART_TTL);
  if (!data?.prices) return [];
  return data.prices.map(([t, v]) => ({ t, v }));
}

// ─── alternative.me: Fear & Greed Index ──────────────────────────────────────

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: number;
}

const FG_TTL = 600_000; // 10 minutes

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  const url = 'https://api.alternative.me/fng/?limit=1';
  const data = await cachedFetch<{ data: { value: string; value_classification: string; timestamp: string }[] }>(
    'fng', url, FG_TTL,
  );
  if (!data?.data?.[0]) return null;
  const d = data.data[0];
  return {
    value: parseInt(d.value, 10),
    classification: d.value_classification,
    timestamp: parseInt(d.timestamp, 10),
  };
}

// ─── DefiLlama: TVL per chain ────────────────────────────────────────────────

export interface ChainTvl {
  name: string;
  tvl: number;
  tokenSymbol?: string;
}

const TVL_TTL = 300_000; // 5 minutes

export async function fetchChainTvl(): Promise<ChainTvl[]> {
  const url = 'https://api.llama.fi/v2/chains';
  const data = await cachedFetch<ChainTvl[]>('llama_chains', url, TVL_TTL);
  return data ?? [];
}

export async function fetchTotalTvl(): Promise<number> {
  const chains = await fetchChainTvl();
  return chains.reduce((sum, c) => sum + (c.tvl || 0), 0);
}

// ─── CoinGecko: simple price for forex-style commodities/indices ─────────────
// For non-crypto assets we use CoinGecko's /simple/price with asset-specific IDs
// (e.g. 'weth' for silver proxy, or we keep simulated fallback for commodities)

export async function fetchSimplePrice(coinIds: string[]): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  if (coinIds.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const data = await cachedFetch<Record<string, { usd: number; usd_24h_change: number }>>(
    'cg_simple', url, PRICE_TTL,
  );
  return data ?? {};
}
