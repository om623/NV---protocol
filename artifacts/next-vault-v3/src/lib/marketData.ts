// ─── Global Market Data (simulated, realistic) ────────────────────────────────

export type MarketCategory = 'fiat' | 'commodities' | 'indices' | 'crypto';

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

function baseMarketCap(category: MarketCategory, price: number): number {
  switch (category) {
    case 'crypto':      return price * (Math.random() * 5_000_000 + 10_000_000);
    case 'commodities': return price * 50_000_000;
    case 'indices':     return price * 2_000_000;
    case 'fiat':        return price * 100_000_000;
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
}

const BASE_ASSETS: BaseAsset[] = [
  // FIAT
  { symbol: 'USD', name: 'US Dollar',        category: 'fiat',        price: 1.0,        decimals: 4, change7d: 0 },
  { symbol: 'EUR', name: 'Euro',             category: 'fiat',        price: 1.087,      decimals: 4, change7d: 0.8 },
  { symbol: 'BRL', name: 'Brazilian Real',   category: 'fiat',        price: 5.42,       decimals: 4, change7d: -1.2 },
  { symbol: 'GBP', name: 'British Pound',    category: 'fiat',        price: 1.273,      decimals: 4, change7d: 0.3 },
  { symbol: 'JPY', name: 'Japanese Yen',     category: 'fiat',        price: 0.0063,     decimals: 6, change7d: -0.5 },

  // COMMODITIES
  { symbol: 'XAU', name: 'Gold',             category: 'commodities', price: 2412.55,    decimals: 2, change7d: 2.1 },
  { symbol: 'XAG', name: 'Silver',           category: 'commodities', price: 29.84,      decimals: 2, change7d: 3.4 },
  { symbol: 'WTI', name: 'Oil (WTI)',        category: 'commodities', price: 78.92,      decimals: 2, change7d: -1.8 },
  { symbol: 'NG',  name: 'Natural Gas',      category: 'commodities', price: 2.34,       decimals: 4, change7d: -3.2 },
  { symbol: 'COP', name: 'Copper',           category: 'commodities', price: 4.52,       decimals: 3, change7d: 1.1 },

  // ÍNDICES
  { symbol: 'SPX', name: 'S&P 500',          category: 'indices',     price: 5464.32,    decimals: 2, change7d: 1.4 },
  { symbol: 'NDX', name: 'Nasdaq 100',       category: 'indices',     price: 19842.71,   decimals: 2, change7d: 2.6 },
  { symbol: 'DXY', name: 'Dollar Index',     category: 'indices',     price: 104.38,     decimals: 2, change7d: -0.4 },
  { symbol: 'VIX', name: 'Volatility Index', category: 'indices',     price: 14.27,      decimals: 2, change7d: -5.2 },

  // CRYPTO
  { symbol: 'BTC', name: 'Bitcoin',          category: 'crypto',      price: 67432.18,   decimals: 2, change7d: 4.2 },
  { symbol: 'ETH', name: 'Ethereum',         category: 'crypto',      price: 3215.84,    decimals: 2, change7d: 3.8 },
  { symbol: 'SOL', name: 'Solana',           category: 'crypto',      price: 168.43,     decimals: 2, change7d: 7.1 },
  { symbol: 'ARB', name: 'Arbitrum',         category: 'crypto',      price: 0.92,       decimals: 4, change7d: 5.3 },
  { symbol: 'OP',  name: 'Optimism',         category: 'crypto',      price: 1.78,       decimals: 4, change7d: 4.1 },
  { symbol: 'LINK',name: 'Chainlink',        category: 'crypto',      price: 14.27,      decimals: 2, change7d: 2.4 },
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
      marketCap: baseMarketCap(a.category, a.price),
      spark: genSpark(a.price, a.price * TYPICAL_VOLATILITY[a.category] / 100),
      trend: deriveTrend(change),
      rsi: genRsi(),
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

export function getAllAssets(): MarketAsset[] {
  return CURRENT_ASSETS;
}

export function getAsset(symbol: string): MarketAsset | undefined {
  return CURRENT_ASSETS.find(a => a.symbol === symbol);
}

export function refreshGlobalMarkets(): MarketAsset[] {
  for (const a of CURRENT_ASSETS) {
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
  return CURRENT_ASSETS;
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function formatMarketCap(v: number): string {
  return formatVolume(v);
}

export function getMarketSentiment(): MarketSentiment {
  const crypto = CURRENT_ASSETS.filter(a => a.category === 'crypto');
  const bullish = crypto.filter(a => a.trend === 'bullish').length;
  const bearish = crypto.filter(a => a.trend === 'bearish').length;
  const neutral = crypto.filter(a => a.trend === 'neutral').length;
  const totalVolume = CURRENT_ASSETS.reduce((s, a) => s + a.volume24h, 0);
  const totalMarketCap = CURRENT_ASSETS.reduce((s, a) => s + a.marketCap, 0);

  const fearGreedIndex = Math.round(40 + (bullish / Math.max(1, crypto.length)) * 45);
  const label = fearGreedIndex >= 75 ? 'Extreme Greed' :
                fearGreedIndex >= 55 ? 'Greed' :
                fearGreedIndex >= 45 ? 'Neutral' :
                fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear';

  const dominantTrend: TrendStatus = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';

  return { fearGreedIndex, label, bullishCount: bullish, bearishCount: bearish, neutralCount: neutral, totalVolume, totalMarketCap, dominantTrend };
}

// ─── Simulated liquidity pools ───────────────────────────────────────────────

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
