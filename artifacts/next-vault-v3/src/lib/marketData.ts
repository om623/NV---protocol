// ─── Global Market Data (simulated) ───────────────────────────────────────────
// Centralised market-asset registry. Currently returns simulated values, but
// the shape mirrors a typical REST payload so swapping in a real provider
// (e.g. CoinGecko / Yahoo Finance / a backend edge function) later only
// requires replacing `fetchGlobalMarkets` below.

export type MarketCategory = 'fiat' | 'commodities' | 'indices' | 'crypto';

export type TrendStatus = 'bullish' | 'bearish' | 'neutral';

export interface MarketAsset {
  symbol: string;
  name: string;
  category: MarketCategory;
  /** Current price in USD */
  price: number;
  /** 24h change percentage */
  change24h: number;
  /** Number of decimals to show for the price */
  decimals: number;
  /** 24h volume in USD (simulated) */
  volume24h: number;
  /** Sparkline data points for mini chart */
  spark: number[];
  /** Derived trend status */
  trend: TrendStatus;
}

export interface MarketGroup {
  id: MarketCategory;
  label: string;
  assets: MarketAsset[];
}

// Small helper that randomises a percentage within a range — used so the
// simulated feed feels alive when refreshed. Kept tiny and deterministic
// enough to avoid wild swings.
function rngChange(base: number, spread: number): number {
  return +(base + (Math.random() - 0.5) * spread).toFixed(2);
}

function genSpark(base: number, vol: number, n = 24): number[] {
  const pts: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * vol;
    pts.push(Math.max(0.0001, v));
  }
  return pts;
}

function deriveTrend(change: number): TrendStatus {
  if (change > 1.5) return 'bullish';
  if (change < -1.5) return 'bearish';
  return 'neutral';
}

function baseVolume(category: MarketCategory): number {
  switch (category) {
    case 'crypto':      return 1_200_000_000;
    case 'commodities': return 85_000_000;
    case 'indices':     return 220_000_000;
    case 'fiat':        return 450_000_000;
  }
}

const BASE_ASSETS: Omit<MarketAsset, 'change24h' | 'volume24h' | 'spark' | 'trend'>[] = [
  // FIAT
  { symbol: 'USD', name: 'US Dollar',        category: 'fiat',        price: 1.0,        decimals: 4 },
  { symbol: 'EUR', name: 'Euro',             category: 'fiat',        price: 1.087,      decimals: 4 },
  { symbol: 'BRL', name: 'Brazilian Real',   category: 'fiat',        price: 5.42,       decimals: 4 },

  // COMMODITIES
  { symbol: 'XAU', name: 'Gold',             category: 'commodities', price: 2412.55,    decimals: 2 },
  { symbol: 'XAG', name: 'Silver',           category: 'commodities', price: 29.84,      decimals: 2 },
  { symbol: 'WTI', name: 'Oil (WTI)',        category: 'commodities', price: 78.92,      decimals: 2 },
  { symbol: 'NG',  name: 'Natural Gas',      category: 'commodities', price: 2.34,       decimals: 4 },
  { symbol: 'COP', name: 'Copper',           category: 'commodities', price: 4.52,       decimals: 3 },

  // ÍNDICES
  { symbol: 'SPX', name: 'S&P 500',          category: 'indices',     price: 5464.32,    decimals: 2 },
  { symbol: 'NDX', name: 'Nasdaq',           category: 'indices',     price: 19842.71,   decimals: 2 },
  { symbol: 'DXY', name: 'Dollar Index',     category: 'indices',     price: 104.38,     decimals: 2 },

  // CRYPTO
  { symbol: 'BTC', name: 'Bitcoin',          category: 'crypto',      price: 67432.18,   decimals: 2 },
  { symbol: 'ETH', name: 'Ethereum',         category: 'crypto',      price: 3215.84,    decimals: 2 },
];

const TYPICAL_VOLATILITY: Record<MarketCategory, number> = {
  fiat: 0.4,
  commodities: 2.5,
  indices: 1.4,
  crypto: 5.5,
};

function seedAssets(): MarketAsset[] {
  return BASE_ASSETS.map(a => {
    const change = rngChange(0, TYPICAL_VOLATILITY[a.category]);
    const vol = baseVolume(a.category) * (0.7 + Math.random() * 0.6);
    return {
      ...a,
      change24h: change,
      volume24h: vol,
      spark: genSpark(a.price, a.price * TYPICAL_VOLATILITY[a.category] / 100),
      trend: deriveTrend(change),
    };
  });
}

const CURRENT_ASSETS: MarketAsset[] = seedAssets();

export function getMarketGroups(): MarketGroup[] {
  const labels: Record<MarketCategory, string> = {
    fiat: 'Fiat',
    commodities: 'Commodities',
    indices: 'Índices',
    crypto: 'Crypto',
  };
  const order: MarketCategory[] = ['fiat', 'commodities', 'indices', 'crypto'];
  return order.map(id => ({
    id,
    label: labels[id],
    assets: CURRENT_ASSETS.filter(a => a.category === id),
  }));
}

/** Returns all assets as a flat array. */
export function getAllAssets(): MarketAsset[] {
  return CURRENT_ASSETS;
}

/** Returns a single asset by symbol, or undefined. */
export function getAsset(symbol: string): MarketAsset | undefined {
  return CURRENT_ASSETS.find(a => a.symbol === symbol);
}

/**
 * Simulates a refresh tick: applies a small random drift to each asset.
 * Replace with a real fetch when an API key is available.
 */
export function refreshGlobalMarkets(): MarketAsset[] {
  for (const a of CURRENT_ASSETS) {
    const drift = (Math.random() - 0.48) * 0.012;
    a.price = Math.max(0.0001, +(a.price * (1 + drift)).toFixed(a.decimals));
    a.change24h = Math.max(-15, Math.min(15, +(a.change24h + drift * 100).toFixed(2)));
    a.volume24h = Math.max(1_000_000, a.volume24h * (1 + (Math.random() - 0.5) * 0.04));
    a.spark = [...a.spark.slice(1), a.price];
    a.trend = deriveTrend(a.change24h);
  }
  return CURRENT_ASSETS;
}

/** Placeholder for a future real-data integration point. */
export async function fetchGlobalMarkets(): Promise<MarketAsset[]> {
  return CURRENT_ASSETS;
}

/** Formats a USD volume compactly (e.g. 1.2B, 85M, 450K). */
export function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
