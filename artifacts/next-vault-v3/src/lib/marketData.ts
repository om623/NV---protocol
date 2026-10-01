// ─── Global Market Data — real API integration with simulated fallback ──────

import {
  type CoinGeckoCoin, type GlobalMarketData, type FearGreedData,
  fetchCryptoPrices, fetchGlobalMarket, fetchFearGreed, fetchTotalTvl,
} from './api';
import { fetchCommodityPrices } from './commodities';

export type MarketCategory = 'fiat' | 'commodities' | 'indices' | 'crypto' | 'stablecoins';

export type TrendStatus = 'bullish' | 'bearish' | 'neutral';

export interface MarketAsset {
  symbol: string;
  name: string;
  category: MarketCategory;
  price: number;
  change24h: number;
  decimals: number;
  volume24h: number;
  marketCap: number;
  spark: number[];
  trend: TrendStatus;
  change7d: number;
  rsi: number;
  /** Whether the current price comes from a real API (true) or simulated fallback (false) */
  isLive: boolean;
}

export interface MarketGroup {
  id: MarketCategory;
  label: string;
  assets: MarketAsset[];
}

export interface MarketSentiment {
  fearGreedIndex: number;
  label: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalVolume: number;
  totalMarketCap: number;
  dominantTrend: TrendStatus;
  btcDominance: number;
  ethDominance: number;
  totalTvl: number;
  isLive: boolean;
}

export interface PoolData {
  pair: string;
  protocol: string;
  tvl: number;
  apr: number;
  volume24h: number;
  risk: 'Low' | 'Medium' | 'High';
  reserves: [number, number];
  chain: string;
}

export interface OpportunityData {
  id: string;
  type: 'arbitrage' | 'yield' | 'liquidity' | 'route';
  title: string;
  detail: string;
  potentialRoi: number;
  risk: 'Low' | 'Medium' | 'High';
  timeWindow: string;
}

// ─── Simulated fallback helpers ──────────────────────────────────────────────

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
    case 'stablecoins': return 800_000_000;
  }
}

function baseMarketCap(category: MarketCategory, price: number): number {
  switch (category) {
    case 'crypto':      return price * (Math.random() * 5_000_000 + 10_000_000);
    case 'commodities': return price * 50_000_000;
    case 'indices':     return price * 2_000_000;
    case 'fiat':        return price * 100_000_000;
    case 'stablecoins': return price * 5_000_000_000;
  }
}

function genRsi(): number {
  return Math.round(30 + Math.random() * 50);
}

interface BaseAsset {
  symbol: string;
  name: string;
  category: MarketCategory;
  price: number;
  decimals: number;
  change7d: number;
  /** CoinGecko coin id for real price fetch (crypto/stablecoins only) */
  coinGeckoId?: string;
}

const BASE_ASSETS: BaseAsset[] = [
  // FIAT
  { symbol: 'USD', name: 'US Dollar',       category: 'fiat', price: 1.0,    decimals: 4, change7d: 0 },
  { symbol: 'EUR', name: 'Euro',            category: 'fiat', price: 1.087,  decimals: 4, change7d: 0.8 },
  { symbol: 'BRL', name: 'Brazilian Real',  category: 'fiat', price: 5.42,   decimals: 4, change7d: -1.2 },
  { symbol: 'GBP', name: 'British Pound',   category: 'fiat', price: 1.273,  decimals: 4, change7d: 0.3 },
  { symbol: 'JPY', name: 'Japanese Yen',    category: 'fiat', price: 0.0063, decimals: 6, change7d: -0.5 },

  { symbol: 'CHF', name: 'Swiss Franc',     category: 'fiat', price: 1.11,   decimals: 4, change7d: 0.2 },
  { symbol: 'CAD', name: 'Canadian Dollar',  category: 'fiat', price: 0.73,   decimals: 4, change7d: -0.4 },
  { symbol: 'AUD', name: 'Australian Dollar',category: 'fiat', price: 0.66,   decimals: 4, change7d: 0.5 },
  { symbol: 'CNY', name: 'Chinese Yuan',     category: 'fiat', price: 0.138,  decimals: 5, change7d: -0.2 },
  { symbol: 'HKD', name: 'Hong Kong Dollar', category: 'fiat', price: 0.128,  decimals: 5, change7d: 0.1 },
  { symbol: 'SGD', name: 'Singapore Dollar', category: 'fiat', price: 0.75,   decimals: 4, change7d: 0.3 },
  { symbol: 'MXN', name: 'Mexican Peso',     category: 'fiat', price: 0.055,  decimals: 5, change7d: -0.7 },
 
  // COMMODITIES
  { symbol: 'XAU', name: 'Gold',          category: 'commodities', price: 2412.55, decimals: 2, change7d: 2.1 },
  { symbol: 'XAG', name: 'Silver',        category: 'commodities', price: 29.84,   decimals: 2, change7d: 3.4 },
  { symbol: 'WTI', name: 'Oil (WTI)',     category: 'commodities', price: 78.92,   decimals: 2, change7d: -1.8 },
  { symbol: 'NG',  name: 'Natural Gas',   category: 'commodities', price: 2.34,    decimals: 4, change7d: -3.2 },
  { symbol: 'COP', name: 'Copper',        category: 'commodities', price: 4.52,    decimals: 3, change7d: 1.1 },

  { symbol: 'BRENT', name: 'Brent Crude', category: 'commodities', price: 82.15, decimals: 2, change7d: -1.2 },
  { symbol: 'PL',    name: 'Platinum',    category: 'commodities', price: 985.40, decimals: 2, change7d: 1.8 },
  { symbol: 'PA',    name: 'Palladium',   category: 'commodities', price: 925.60, decimals: 2, change7d: -0.9 },
  { symbol: 'AL',    name: 'Aluminum',    category: 'commodities', price: 2.34,   decimals: 3, change7d: 0.6 },
  { symbol: 'NI',    name: 'Nickel',      category: 'commodities', price: 16.85,  decimals: 2, change7d: -1.4 },

  // AGRICULTURAL COMMODITIES
  { symbol: 'ZC', name: 'Corn',          category: 'commodities', price: 522.25, decimals: 2, change7d: 0.05 },
  { symbol: 'ZW', name: 'Wheat',         category: 'commodities', price: 695.25, decimals: 2, change7d: 0.36 },
  { symbol: 'ZS', name: 'Soybeans',      category: 'commodities', price: 1300.50,decimals: 2, change7d: 0.21 },
  { symbol: 'KC', name: 'Coffee',        category: 'commodities', price: 292.70, decimals: 2, change7d: 1.12 },
  { symbol: 'SB', name: 'Sugar',         category: 'commodities', price: 18.84,  decimals: 2, change7d: 0.0  },
  { symbol: 'CT', name: 'Cotton',        category: 'commodities', price: 78.86,  decimals: 2, change7d: -4.83 },
  { symbol: 'CC', name: 'Cocoa',         category: 'commodities', price: 5354.0, decimals: 0, change7d: -1.0 },
  { symbol: 'OJ', name: 'Orange Juice',  category: 'commodities', price: 153.55, decimals: 2, change7d: -0.03 },
  { symbol: 'LE', name: 'Live Cattle',   category: 'commodities', price: 220.90, decimals: 2, change7d: 0.05 },
  { symbol: 'HE', name: 'Lean Hogs',     category: 'commodities', price: 69.68,  decimals: 2, change7d: 1.86 },

    // ÍNDICES
  { symbol: 'SPX',  name: 'S&P 500',           category: 'indices', price: 5464.32,  decimals: 2, change7d: 1.4 },
  { symbol: 'NDX',  name: 'Nasdaq 100',        category: 'indices', price: 19842.71, decimals: 2, change7d: 2.6 },
  { symbol: 'DXY',  name: 'Dollar Index',      category: 'indices', price: 104.38,   decimals: 2, change7d: -0.4 },
  { symbol: 'VIX',  name: 'Volatility Index',  category: 'indices', price: 14.27,    decimals: 2, change7d: -5.2 },

  { symbol: 'DJI',  name: 'Dow Jones',         category: 'indices', price: 39150.20, decimals: 2, change7d: 1.1 },
  { symbol: 'RUT',  name: 'Russell 2000',      category: 'indices', price: 2035.40,  decimals: 2, change7d: 0.8 },
  { symbol: 'FTSE', name: 'FTSE 100',          category: 'indices', price: 8235.40,  decimals: 2, change7d: 0.9 },
  { symbol: 'DAX',  name: 'DAX',               category: 'indices', price: 18450.30, decimals: 2, change7d: 1.7 },
  { symbol: 'CAC',  name: 'CAC 40',            category: 'indices', price: 7580.20,  decimals: 2, change7d: 1.2 },
  { symbol: 'N225', name: 'Nikkei 225',        category: 'indices', price: 38600.50, decimals: 2, change7d: 2.3 },
  { symbol: 'HSI',  name: 'Hang Seng',         category: 'indices', price: 18120.40, decimals: 2, change7d: -0.6 },
  { symbol: 'IBOV', name: 'Ibovespa',          category: 'indices', price: 127450.00,decimals: 2, change7d: 1.5 },
 
    // CRYPTO
  { symbol: 'BTC',    name: 'Bitcoin',          category: 'crypto', price: 67432.18, decimals: 2, change7d: 4.2,  coinGeckoId: 'bitcoin' },
  { symbol: 'ETH',    name: 'Ethereum',         category: 'crypto', price: 3215.84,  decimals: 2, change7d: 3.8,  coinGeckoId: 'ethereum' },
  { symbol: 'SOL',    name: 'Solana',           category: 'crypto', price: 168.43,   decimals: 2, change7d: 7.1,  coinGeckoId: 'solana' },
  { symbol: 'BNB',    name: 'BNB',              category: 'crypto', price: 580.00,   decimals: 2, change7d: 3.2,  coinGeckoId: 'binancecoin' },
  { symbol: 'XRP',    name: 'XRP',              category: 'crypto', price: 0.52,     decimals: 4, change7d: 2.8,  coinGeckoId: 'ripple' },
  { symbol: 'ADA',    name: 'Cardano',          category: 'crypto', price: 0.45,     decimals: 4, change7d: 1.9,  coinGeckoId: 'cardano' },
  { symbol: 'DOGE',   name: 'Dogecoin',         category: 'crypto', price: 0.14,     decimals: 5, change7d: 4.7,  coinGeckoId: 'dogecoin' },
  { symbol: 'AVAX',   name: 'Avalanche',        category: 'crypto', price: 35.20,    decimals: 2, change7d: 5.4,  coinGeckoId: 'avalanche-2' },
  { symbol: 'DOT',    name: 'Polkadot',         category: 'crypto', price: 6.80,     decimals: 3, change7d: 2.1,  coinGeckoId: 'polkadot' },
  { symbol: 'LINK',   name: 'Chainlink',        category: 'crypto', price: 14.27,    decimals: 2, change7d: 2.4,  coinGeckoId: 'chainlink' },
  { symbol: 'POL',    name: 'Polygon',          category: 'crypto', price: 0.45,     decimals: 4, change7d: 1.7,  coinGeckoId: 'polygon-ecosystem-token' },
  { symbol: 'UNI',    name: 'Uniswap',          category: 'crypto', price: 10.20,    decimals: 2, change7d: 4.2,  coinGeckoId: 'uniswap' },
  { symbol: 'LTC',    name: 'Litecoin',         category: 'crypto', price: 72.40,    decimals: 2, change7d: 1.4,  coinGeckoId: 'litecoin' },
  { symbol: 'NEAR',   name: 'Near Protocol',    category: 'crypto', price: 5.10,     decimals: 3, change7d: 5.1,  coinGeckoId: 'near' },
  { symbol: 'ICP',    name: 'Internet Computer',category: 'crypto', price: 8.30,     decimals: 2, change7d: 3.6,  coinGeckoId: 'internet-computer' },
  { symbol: 'APT',    name: 'Aptos',            category: 'crypto', price: 7.20,     decimals: 3, change7d: 2.9,  coinGeckoId: 'aptos' },
  { symbol: 'ATOM',   name: 'Cosmos',           category: 'crypto', price: 6.80,     decimals: 3, change7d: 1.8,  coinGeckoId: 'cosmos' },
  { symbol: 'ARB',    name: 'Arbitrum',         category: 'crypto', price: 0.92,     decimals: 4, change7d: 5.3,  coinGeckoId: 'arbitrum' },
  { symbol: 'OP',     name: 'Optimism',         category: 'crypto', price: 1.78,     decimals: 4, change7d: 4.1,  coinGeckoId: 'optimism' },
  { symbol: 'SUI',    name: 'Sui',              category: 'crypto', price: 0.90,     decimals: 4, change7d: 6.2,  coinGeckoId: 'sui' },
  { symbol: 'PEPE',   name: 'Pepe',             category: 'crypto', price: 0.000012, decimals: 8, change7d: 8.4, coinGeckoId: 'pepe' },
  { symbol: 'RENDER', name: 'Render',           category: 'crypto', price: 7.10,     decimals: 3, change7d: 6.5,  coinGeckoId: 'render-token' },
  { symbol: 'INJ',    name: 'Injective',        category: 'crypto', price: 23.40,    decimals: 2, change7d: 4.9,  coinGeckoId: 'injective-protocol' },
  { symbol: 'AAVE',   name: 'Aave',             category: 'crypto', price: 95.00,    decimals: 2, change7d: 5.8,  coinGeckoId: 'aave' },
  { symbol: 'MKR',    name: 'Maker',            category: 'crypto', price: 2800.00,  decimals: 2, change7d: 2.7,  coinGeckoId: 'maker' },
   
     // STABLECOINS
  { symbol: 'USDC',  name: 'USD Coin',        category: 'stablecoins', price: 1.0, decimals: 4, change7d: 0,   coinGeckoId: 'usd-coin' },
  { symbol: 'USDT',  name: 'Tether',          category: 'stablecoins', price: 1.0, decimals: 4, change7d: 0,   coinGeckoId: 'tether' },
  { symbol: 'EURC',  name: 'Euro Coin',       category: 'stablecoins', price: 1.087, decimals: 4, change7d: 0.8, coinGeckoId: 'eurocoin' },
  { symbol: 'DAI',   name: 'Dai',             category: 'stablecoins', price: 1.0, decimals: 4, change7d: 0.1, coinGeckoId: 'dai' },
  { symbol: 'USDe',  name: 'Ethena USDe',     category: 'stablecoins', price: 1.0, decimals: 4, change7d: 0.1, coinGeckoId: 'ethena-usde' },
  { symbol: 'PYUSD', name: 'PayPal USD',      category: 'stablecoins', price: 1.0, decimals: 4, change7d: 0.0, coinGeckoId: 'paypal-usd' },
  { symbol: 'USDS',  name: 'USDS',             category: 'stablecoins', price: 1.0, decimals: 4, change7d: 0.0, coinGeckoId: 'usds' },
];

const TYPICAL_VOLATILITY: Record<MarketCategory, number> = {
  fiat: 0.4,
  commodities: 2.5,
  indices: 1.4,
  crypto: 5.5,
  stablecoins: 0.2,
};

function seedAssets(): MarketAsset[] {
  return BASE_ASSETS.map(a => {
    const change = rngChange(0, TYPICAL_VOLATILITY[a.category]);
    const vol = baseVolume(a.category) * (0.7 + Math.random() * 0.6);
    return {
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      price: a.price,
      change24h: change,
      decimals: a.decimals,
      volume24h: vol,
      marketCap: baseMarketCap(a.category, a.price),
      spark: genSpark(a.price, a.price * TYPICAL_VOLATILITY[a.category] / 100),
      trend: deriveTrend(change),
      change7d: a.change7d,
      rsi: genRsi(),
      isLive: false,
    };
  });
}

// ─── Live asset store ────────────────────────────────────────────────────────

const CURRENT_ASSETS: MarketAsset[] = seedAssets();

// Real data cache (updated by refreshFromApis)
let liveGlobal: GlobalMarketData | null = null;
let liveFearGreed: FearGreedData | null = null;
let liveTvl = 0;
let lastApiRefresh = 0;
const API_REFRESH_INTERVAL = 60_000; // 1 minute minimum between API calls

/**
 * Fetch real data from public APIs and merge into CURRENT_ASSETS.
 * Called automatically on an interval; also safe to call manually.
 * Does nothing if called within API_REFRESH_INTERVAL of the last call.
 */
export async function refreshFromApis(): Promise<void> {
  if (Date.now() - lastApiRefresh < API_REFRESH_INTERVAL) return;
  lastApiRefresh = Date.now();

  // Collect commodity symbols that have Yahoo Finance mappings
  const commoditySymbols = CURRENT_ASSETS
    .filter(a => a.category === 'commodities')
    .map(a => a.symbol);

  try {
    const [priceMap, global, fng, tvl, commodityMap] = await Promise.all([
      fetchCryptoPrices(),
      fetchGlobalMarket(),
      fetchFearGreed(),
      fetchTotalTvl(),
      fetchCommodityPrices(commoditySymbols),
    ]);

    // Merge real crypto prices into assets
    for (const asset of CURRENT_ASSETS) {
      const coin = priceMap.get(asset.symbol);
      if (coin) {
        asset.price = coin.current_price ?? asset.price;
        asset.change24h = coin.price_change_percentage_24h ?? asset.change24h;
        asset.change7d = coin.price_change_percentage_7d ?? asset.change7d;
        asset.volume24h = coin.total_volume ?? asset.volume24h;
        asset.marketCap = coin.market_cap ?? asset.marketCap;
        if (coin.sparkline_in_7d?.price?.length) {
          // Take last 24 points for 24h sparkline
          const spark = coin.sparkline_in_7d.price;
          asset.spark = spark.slice(-24);
        }
        asset.trend = deriveTrend(asset.change24h);
        // Approximate RSI from recent sparkline direction
        if (asset.spark.length >= 14) {
          const recent = asset.spark.slice(-14);
          const gains = recent.slice(1).filter((v, i) => v > recent[i]);
          const losses = recent.slice(1).filter((v, i) => v < recent[i]);
          const avgGain = gains.reduce((s, v) => s + (v - recent[gains.indexOf(v)]), 0) / Math.max(1, gains.length);
          const avgLoss = losses.reduce((s, v) => s + (recent[losses.indexOf(v) + 1] - v), 0) / Math.max(1, losses.length);
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          asset.rsi = Math.round(Math.max(15, Math.min(85, 100 - 100 / (1 + rs))));
        }
        asset.isLive = true;
      }
    }

    // Merge real commodity prices into assets
    for (const asset of CURRENT_ASSETS) {
      if (asset.category !== 'commodities') continue;
      const quote = commodityMap.get(asset.symbol);
      if (quote) {
        asset.price = quote.price;
        asset.change24h = quote.changePercent;
        if (typeof quote.volume === 'number' && Number.isFinite(quote.volume) && quote.volume > 0) {
          asset.volume24h = quote.volume;
        }
        asset.spark = [...asset.spark.slice(1), asset.price];
        asset.trend = deriveTrend(asset.change24h);
        asset.isLive = true;
      }
    }

    liveGlobal = global;
    liveFearGreed = fng;
    liveTvl = tvl;
  } catch {
    // Keep existing data (simulated fallback remains)
  }
}

// Start background refresh on module load
refreshFromApis();
// Periodic refresh every 60s
if (typeof setInterval !== 'undefined') {
  setInterval(() => { refreshFromApis(); }, 60_000);
}

// ─── Exported API (same interface as before, now backed by real data) ────────

export function getMarketGroups(): MarketGroup[] {
  const labels: Record<MarketCategory, string> = {
    fiat: 'Fiat',
    commodities: 'Commodities',
    indices: 'Índices',
    crypto: 'Crypto',
    stablecoins: 'Stablecoins',
  };
  const order: MarketCategory[] = ['fiat', 'commodities', 'indices', 'crypto', 'stablecoins'];
  return order.map(id => ({
    id,
    label: labels[id],
    assets: CURRENT_ASSETS.filter(a => a.category === id),
  }));
}

export function getAllAssets(): MarketAsset[] {
  return CURRENT_ASSETS;
}

export function getAsset(symbol: string): MarketAsset | undefined {
  return CURRENT_ASSETS.find(a => a.symbol === symbol);
}

export function refreshGlobalMarkets(): MarketAsset[] {
  // Light simulated drift for non-live assets (keeds UI animated between API refreshes)
  for (const a of CURRENT_ASSETS) {
    if (a.isLive) continue;
    const drift = (Math.random() - 0.48) * 0.012;
    a.price = Math.max(0.0001, +(a.price * (1 + drift)).toFixed(a.decimals));
    a.change24h = Math.max(-15, Math.min(15, +(a.change24h + drift * 100).toFixed(2)));
    a.volume24h = Math.max(1_000_000, a.volume24h * (1 + (Math.random() - 0.5) * 0.04));
    a.marketCap = Math.max(1_000_000, a.marketCap * (1 + drift));
    a.spark = [...a.spark.slice(1), a.price];
    a.trend = deriveTrend(a.change24h);
    a.rsi = Math.max(15, Math.min(85, a.rsi + Math.round((Math.random() - 0.5) * 4)));
  }
  return CURRENT_ASSETS;
}

export async function fetchGlobalMarkets(): Promise<MarketAsset[]> {
  await refreshFromApis();
  return CURRENT_ASSETS;
}

export function formatVolume(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${v.toFixed(0)}`;
}

export function formatMarketCap(v: number): string {
  return formatVolume(v);
}

export function getMarketSentiment(): MarketSentiment {
  const crypto = CURRENT_ASSETS.filter(a => a.category === 'crypto');
  const stable = CURRENT_ASSETS.filter(a => a.category === 'stablecoins');
  const allTradable = [...crypto, ...stable];
  const bullish = allTradable.filter(a => a.trend === 'bullish').length;
  const bearish = allTradable.filter(a => a.trend === 'bearish').length;
  const neutral = allTradable.filter(a => a.trend === 'neutral').length;
  const totalVolume = CURRENT_ASSETS.reduce((s, a) => s + a.volume24h, 0);
  const totalMarketCap = CURRENT_ASSETS.reduce((s, a) => s + a.marketCap, 0);

  // Use real Fear & Greed if available, otherwise derive from trends
  let fearGreedIndex: number;
  let label: string;
  const isLive = liveFearGreed !== null;

  if (liveFearGreed) {
    fearGreedIndex = liveFearGreed.value;
    label = liveFearGreed.classification;
  } else {
    fearGreedIndex = Math.round(40 + (bullish / Math.max(1, allTradable.length)) * 45);
    label = fearGreedIndex >= 75 ? 'Extreme Greed' :
            fearGreedIndex >= 55 ? 'Greed' :
            fearGreedIndex >= 45 ? 'Neutral' :
            fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear';
  }

  const dominantTrend: TrendStatus = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';

  return {
    fearGreedIndex,
    label,
    bullishCount: bullish,
    bearishCount: bearish,
    neutralCount: neutral,
    totalVolume,
    totalMarketCap,
    dominantTrend,
    btcDominance: liveGlobal?.btcDominance ?? 0,
    ethDominance: liveGlobal?.ethDominance ?? 0,
    totalTvl: liveTvl || 0,
    isLive,
  };
}

// ─── Simulated liquidity pools (placeholder for future on-chain integration) ─

const SIM_POOLS: PoolData[] = [
  { pair: 'USDC / EURC',  protocol: 'ArcSwap',   tvl: 4_280_000,  apr: 8.4,  volume24h: 1_240_000, risk: 'Low',    reserves: [2_140_000, 1_968_220], chain: 'Arc Testnet' },
  { pair: 'USDC / ETH',   protocol: 'ArcSwap',   tvl: 8_920_000,  apr: 12.7, volume24h: 3_410_000, risk: 'Medium', reserves: [4_460_000, 1_387],      chain: 'Arc Testnet' },
  { pair: 'ETH / ARB',    protocol: 'UniV3',     tvl: 2_140_000,  apr: 18.2, volume24h: 890_000,   risk: 'High',   reserves: [532, 1_852_174],         chain: 'Arbitrum Sepolia' },
  { pair: 'USDC / SOL',   protocol: 'UniV3',     tvl: 1_680_000,  apr: 15.3, volume24h: 720_000,   risk: 'High',   reserves: [840_000, 4_987],         chain: 'Arbitrum Sepolia' },
  { pair: 'EURC / ETH',   protocol: 'ArcSwap',   tvl: 3_120_000,  apr: 10.1, volume24h: 1_080_000, risk: 'Medium', reserves: [1_560_000, 485],         chain: 'Arc Testnet' },
  { pair: 'USDC / LINK',  protocol: 'Curve',     tvl: 980_000,    apr: 14.8, volume24h: 420_000,   risk: 'Medium', reserves: [490_000, 34_368],        chain: 'Sepolia' },
];

export function getPoolsData(): PoolData[] {
  return SIM_POOLS.map(p => ({
    ...p,
    tvl: p.tvl * (1 + (Math.random() - 0.5) * 0.02),
    volume24h: p.volume24h * (1 + (Math.random() - 0.5) * 0.06),
    apr: +(p.apr * (1 + (Math.random() - 0.5) * 0.08)).toFixed(1),
  }));
}

// ─── Simulated opportunities ─────────────────────────────────────────────────

const SIM_OPPORTUNITIES: OpportunityData[] = [
  { id: '1', type: 'arbitrage',  title: 'USDC/EURC Spread',     detail: '0.42% arbitrage spread detected across Arc pools', potentialRoi: 0.42, risk: 'Low',    timeWindow: '~12 min' },
  { id: '2', type: 'yield',      title: 'ETH/ARB Pool Yield',   detail: '18.2% APY on Arbitrum Sepolia liquidity pool',      potentialRoi: 18.2, risk: 'High',   timeWindow: '~24h' },
  { id: '3', type: 'route',      title: 'Optimal Swap Route',   detail: 'Multi-hop route via EURC saves 0.3% slippage',      potentialRoi: 0.3,  risk: 'Low',    timeWindow: 'now' },
  { id: '4', type: 'liquidity',  title: 'New Pool Incentive',   detail: 'Early LP rewards on USDC/SOL pool — 15.3% APR',      potentialRoi: 15.3, risk: 'Medium', timeWindow: '~6h' },
  { id: '5', type: 'arbitrage',  title: 'ETH Price Gap',        detail: 'Cross-DEX price discrepancy of 0.18% on ETH',        potentialRoi: 0.18, risk: 'Low',    timeWindow: '~8 min' },
];

export function getOpportunities(): OpportunityData[] {
  return SIM_OPPORTUNITIES;
}
