// ─── Global Market Data (live via public APIs) ───────────────────────────────
// Uses CoinGecko, Alternative.me (Fear & Greed), and Yahoo Finance (indices).
// Falls back to last valid values when an API fails — never breaks the UI.

export type MarketCategory = 'indices' | 'commodities' | 'crypto' | 'global';

export interface MarketAsset {
  symbol: string;
  name: string;
  category: MarketCategory;
  price: number;
  change24h: number;
  decimals: number;
}

export interface MarketGroup {
  id: MarketCategory;
  label: string;
  assets: MarketAsset[];
}

export interface GlobalIndicators {
  fearGreed: number;
  fearGreedLabel: string;
  btcDominance: number;
  globalMarketCap: number;
  volume24h: number;
}

export interface MarketSnapshot {
  assets: MarketAsset[];
  indicators: GlobalIndicators;
  lastUpdated: number | null;
  updatePending: boolean;
  error: string | null;
}

// ─── Static fallback data (used on first load or when APIs fail) ─────────────

const FALLBACK_ASSETS: MarketAsset[] = [
  { symbol: 'SPX',  name: 'S&P 500',      category: 'indices',     price: 5464.32,  change24h: 0.00, decimals: 2 },
  { symbol: 'NDX',  name: 'Nasdaq',       category: 'indices',     price: 19842.71, change24h: 0.00, decimals: 2 },
  { symbol: 'DJI',  name: 'Dow Jones',    category: 'indices',     price: 39118.86, change24h: 0.00, decimals: 2 },
  { symbol: 'XAU',  name: 'Gold',         category: 'commodities', price: 2412.55,  change24h: 0.00, decimals: 2 },
  { symbol: 'XAG',  name: 'Silver',       category: 'commodities', price: 29.84,    change24h: 0.00, decimals: 2 },
  { symbol: 'BTC',  name: 'Bitcoin',      category: 'crypto',      price: 67432.18, change24h: 0.00, decimals: 2 },
  { symbol: 'ETH',  name: 'Ethereum',     category: 'crypto',      price: 3215.84,  change24h: 0.00, decimals: 2 },
  { symbol: 'SOL',  name: 'Solana',       category: 'crypto',      price: 178.42,   change24h: 0.00, decimals: 2 },
  { symbol: 'BNB',  name: 'BNB',          category: 'crypto',      price: 612.30,   change24h: 0.00, decimals: 2 },
  { symbol: 'XRP',  name: 'XRP',          category: 'crypto',      price: 0.5234,   change24h: 0.00, decimals: 4 },
  { symbol: 'USDC', name: 'USD Coin',     category: 'crypto',      price: 1.00,     change24h: 0.00, decimals: 4 },
  { symbol: 'EURC', name: 'EURC',         category: 'crypto',      price: 0.00,     change24h: 0.00, decimals: 4 },
];

const FALLBACK_INDICATORS: GlobalIndicators = {
  fearGreed: 50,
  fearGreedLabel: 'Neutral',
  btcDominance: 51.2,
  globalMarketCap: 2_400_000_000_000,
  volume24h: 85_000_000_000,
};

// ─── In-memory store (survives across refreshes) ────────────────────────────

let lastAssets: MarketAsset[] = [...FALLBACK_ASSETS.map(a => ({ ...a }))];
let lastIndicators: GlobalIndicators = { ...FALLBACK_INDICATORS };
let lastUpdated: number | null = null;
let updatePending = false;
let errorMessage: string | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDecimals(v: number | undefined | null, d: number): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return parseFloat(v.toFixed(d));
}

function pctChange(current: number, previous: number | undefined | null): number {
  if (!previous || previous === 0) return 0;
  return toDecimals(((current - previous) / previous) * 100, 2);
}

// ─── Yahoo Finance fetching via dev proxy ─────────────────────────────────────

function yahooSymbol(s: string): string {
  const map: Record<string, string> = {
    'SPX': '^GSPC',
    'NDX': '^IXIC',
    'DJI': '^DJI',
  };
  return map[s] || s;
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const mapped = yahooSymbol(symbol);
    const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(mapped)}?range=2d&interval=1d`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const closes: number[] | undefined = result.indicators?.quote?.[0]?.close;
    const price = meta?.regularMarketPrice ?? closes?.[closes.length - 1] ?? null;
    if (price === null || price === undefined) return null;
    const prevClose = closes && closes.length > 1 ? closes[closes.length - 2] : price;
    const changePct = pctChange(price, prevClose);
    return { price: toDecimals(price, 2), changePct };
  } catch {
    return null;
  }
}

// ─── CoinGecko ────────────────────────────────────────────────────────────────

const CG_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  BNB: 'binancecoin', XRP: 'ripple', USDC: 'usd-coin',
};

async function fetchCoinGecko(): Promise<{
  assets: { symbol: string; price: number; change24h: number }[];
  global?: Partial<GlobalIndicators>;
}> {
  const results: { symbol: string; price: number; change24h: number }[] = [];

  // Fetch individual coin prices
  const ids = Object.values(CG_IDS).join(',');
  const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  let priceData: Record<string, { usd?: number; usd_24h_change?: number }> | null = null;

  try {
    const priceRes = await fetch(priceUrl, { signal: AbortSignal.timeout(8000) });
    if (priceRes.ok) {
      priceData = await priceRes.json();
    }
  } catch {
    // will fall back to last values
  }

  if (priceData) {
    for (const [symbol, cgId] of Object.entries(CG_IDS)) {
      const entry = priceData[cgId];
      const price = entry?.usd;
      const change24h = entry?.usd_24h_change;
      if (price !== undefined && !isNaN(price)) {
        results.push({
          symbol,
          price: toDecimals(price, symbol === 'XRP' || symbol === 'USDC' ? 4 : 2),
          change24h: change24h !== undefined ? toDecimals(change24h, 2) : 0,
        });
      }
    }
  }

  // Fetch global data separately for more fields
  let global: Partial<GlobalIndicators> = {};
  try {
    const globalRes = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(8000) });
    if (globalRes.ok) {
      const globalJson = await globalRes.json();
      const d = globalJson?.data;
      if (d) {
        if (d.market_cap_percentage?.btc !== undefined) {
          global.btcDominance = toDecimals(d.market_cap_percentage.btc, 1);
        }
        if (d.total_market_cap?.usd !== undefined) {
          global.globalMarketCap = d.total_market_cap.usd;
        }
        if (d.total_volume?.usd !== undefined) {
          global.volume24h = d.total_volume.usd;
        }
      }
    }
  } catch {
    // ignored
  }

  return { assets: results, global };
}

// ─── Gold & Silver via Yahoo Finance futures ─────────────────────────────────

async function fetchCommodities(): Promise<{ symbol: string; price: number }[]> {
  const results: { symbol: string; price: number }[] = [];
  const yahooMap: Record<string, string> = {
    XAU: 'GC=F',
    XAG: 'SI=F',
  };
  for (const [sym, yahooSym] of Object.entries(yahooMap)) {
    try {
      const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=2d&interval=1d`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        const closes: number[] | undefined = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (closes && closes.length > 0) {
          const price = closes[closes.length - 1];
          if (price && !isNaN(price)) {
            results.push({ symbol: sym, price: toDecimals(price, 2) });
          }
        }
      }
    } catch {
      // keep fallback
    }
  }
  return results;
}

// ─── Fear & Greed Index from Alternative.me ───────────────────────────────────

async function fetchFearGreed(): Promise<{ value: number; label: string } | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const entry = json?.data?.[0];
    if (!entry) return null;
    const value = parseInt(entry.value, 10);
    if (isNaN(value)) return null;
    const classification = entry.value_classification || 'Neutral';
    return { value, label: classification };
  } catch {
    return null;
  }
}

// ─── EURC price (try to fetch from CoinGecko) ────────────────────────────────

async function fetchEURCPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=eurc&vs_currencies=usd',
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.eurc?.usd;
      if (price !== undefined && !isNaN(price)) return price;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Public entry-point: refreshes all data ────────────────────────────────

export async function refreshGlobalMarkets(): Promise<MarketSnapshot> {
  updatePending = true;
  errorMessage = null;

  // Parallel fetching
  const [cgResult, fearGreedResult, commoditiesResult, eurcPrice, spxQuote, ndxQuote, djiQuote] = await Promise.allSettled([
    fetchCoinGecko(),
    fetchFearGreed(),
    fetchCommodities(),
    fetchEURCPrice(),
    fetchYahooQuote('SPX'),
    fetchYahooQuote('NDX'),
    fetchYahooQuote('DJI'),
  ]);

  // ── Update assets ────────────────────────────────────────────────────
  const assetMap = new Map(lastAssets.map(a => [a.symbol, a]));
  let changesMade = false;

  // CoinGecko crypto prices
  if (cgResult.status === 'fulfilled' && cgResult.value.assets.length > 0) {
    for (const { symbol, price, change24h } of cgResult.value.assets) {
      const existing = assetMap.get(symbol);
      if (existing) {
        existing.price = price;
        existing.change24h = change24h;
        changesMade = true;
      }
    }
  }

  // EURC (if available)
  if (eurcPrice.status === 'fulfilled' && eurcPrice.value !== null) {
    const eurcAsset = assetMap.get('EURC');
    if (eurcAsset) {
      const prev = eurcAsset.price;
      eurcAsset.price = toDecimals(eurcPrice.value, 4);
      eurcAsset.change24h = pctChange(eurcPrice.value, prev);
      changesMade = true;
    }
  }

  // Commodities (Gold & Silver)
  if (commoditiesResult.status === 'fulfilled') {
    for (const { symbol, price } of commoditiesResult.value) {
      const existing = assetMap.get(symbol);
      if (existing) {
        existing.price = price;
        changesMade = true;
      }
    }
  }

  // Yahoo Finance indices
  const yahooResults: { symbol: string; quote: { price: number; changePct: number } }[] = [];
  if (spxQuote.status === 'fulfilled' && spxQuote.value) yahooResults.push({ symbol: 'SPX', quote: spxQuote.value });
  if (ndxQuote.status === 'fulfilled' && ndxQuote.value) yahooResults.push({ symbol: 'NDX', quote: ndxQuote.value });
  if (djiQuote.status === 'fulfilled' && djiQuote.value) yahooResults.push({ symbol: 'DJI', quote: djiQuote.value });

  for (const { symbol, quote } of yahooResults) {
    const existing = assetMap.get(symbol);
    if (existing) {
      existing.price = quote.price;
      existing.change24h = quote.changePct;
      changesMade = true;
    }
  }

  // ── Update indicators ────────────────────────────────────────────────
  const indicators: GlobalIndicators = { ...lastIndicators };

  if (cgResult.status === 'fulfilled' && cgResult.value.global) {
    const g = cgResult.value.global;
    if (g.btcDominance !== undefined) indicators.btcDominance = g.btcDominance;
    if (g.globalMarketCap !== undefined) indicators.globalMarketCap = g.globalMarketCap;
    if (g.volume24h !== undefined) indicators.volume24h = g.volume24h;
  }

  if (fearGreedResult.status === 'fulfilled' && fearGreedResult.value) {
    indicators.fearGreed = fearGreedResult.value.value;
    indicators.fearGreedLabel = fearGreedResult.value.label;
  }

  // ── Commit ────────────────────────────────────────────────────────────
  if (changesMade || cgResult.status === 'fulfilled') {
    lastAssets = Array.from(assetMap.values());
    lastIndicators = indicators;
    lastUpdated = Date.now();
  }

  updatePending = false;

  return {
    assets: lastAssets,
    indicators: lastIndicators,
    lastUpdated,
    updatePending: false,
    error: errorMessage,
  };
}

/**
 * Returns the current snapshot synchronously (no fetch).
 * Used for initial render.
 */
export function getMarketSnapshot(): MarketSnapshot {
  return {
    assets: lastAssets,
    indicators: lastIndicators,
    lastUpdated,
    updatePending,
    error: errorMessage,
  };
}

/**
 * Groups the current assets by category into MarketGroup[].
 * Used by GlobalMarketsPanel to render sections.
 */
export function getMarketGroups(): MarketGroup[] {
  const groups: Map<MarketCategory, MarketGroup> = new Map();
  const labels: Record<MarketCategory, string> = {
    indices: 'Traditional Markets',
    commodities: 'Commodities',
    crypto: 'Crypto',
    global: 'Global',
  };
  for (const asset of lastAssets) {
    let group = groups.get(asset.category);
    if (!group) {
      group = { id: asset.category, label: labels[asset.category] || asset.category, assets: [] };
      groups.set(asset.category, group);
    }
    group.assets.push(asset);
  }
  return Array.from(groups.values());
}
