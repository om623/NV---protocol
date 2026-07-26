// ─── Global Market Data (simulated) ───────────────────────────────────────────
// Centralised market-asset registry. Currently returns simulated values, but
// the shape mirrors a typical REST payload so swapping in a real provider
// (e.g. CoinGecko / Yahoo Finance / a backend edge function) later only
// requires replacing `fetchGlobalMarkets` below.

export type MarketCategory = 'fiat' | 'commodities' | 'indices' | 'crypto';

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

const BASE_ASSETS: Omit<MarketAsset, 'change24h'>[] = [
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
  return BASE_ASSETS.map(a => ({
    ...a,
    change24h: rngChange(0, TYPICAL_VOLATILITY[a.category]),
  }));
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

/**
 * Simulates a refresh tick: applies a small random drift to each asset.
 * Replace with a real fetch when an API key is available.
 */
export function refreshGlobalMarkets(): MarketAsset[] {
  for (const a of CURRENT_ASSETS) {
    const drift = (Math.random() - 0.48) * 0.012;
    a.price = Math.max(0.0001, +(a.price * (1 + drift)).toFixed(a.decimals));
    a.change24h = Math.max(-15, Math.min(15, +(a.change24h + drift * 100).toFixed(2)));
  }
  return CURRENT_ASSETS;
}

/** Placeholder for a future real-data integration point. */
export async function fetchGlobalMarkets(): Promise<MarketAsset[]> {
  return CURRENT_ASSETS;
}
