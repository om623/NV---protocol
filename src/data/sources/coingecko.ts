import type { MarketDataSource, Quote } from '../types';
import type { Asset, GlobalIndicators } from '@/app/registry/types';

const CG_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  USDC: 'usd-coin',
  EURC: 'eurc',
};

function toDecimals(v: number, d: number): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return parseFloat(v.toFixed(d));
}

function pctChange(current: number, previous: number | undefined | null): number {
  if (!previous || previous === 0) return 0;
  return toDecimals(((current - previous) / previous) * 100, 2);
}

async function fetchCryptoPrices(assets: Asset[]): Promise<Quote[]> {
  const ids = assets
    .map(a => CG_IDS[a.sourceSymbol])
    .filter(Boolean)
    .join(',');
  if (!ids) return [];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data: Record<string, { usd?: number; usd_24h_change?: number }> = await res.json();
  const now = Date.now();
  return assets
    .map(asset => {
      const cgId = CG_IDS[asset.sourceSymbol];
      const entry = cgId ? data[cgId] : undefined;
      const price = entry?.usd;
      if (price === undefined || isNaN(price)) return null;
      return {
        assetId: asset.id,
        price: toDecimals(price, asset.decimals),
        change24h: entry?.usd_24h_change !== undefined ? toDecimals(entry.usd_24h_change, 2) : 0,
        updatedAt: now,
      } satisfies Quote;
    })
    .filter((q): q is Quote => q !== null);
}

async function fetchIndicators(): Promise<Partial<GlobalIndicators>> {
  const indicators: Partial<GlobalIndicators> = {};
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return indicators;
    const json = await res.json();
    const d = json?.data;
    if (!d) return indicators;
    if (d.market_cap_percentage?.btc !== undefined) {
      indicators.btcDominance = toDecimals(d.market_cap_percentage.btc, 1);
    }
    if (d.total_market_cap?.usd !== undefined) indicators.globalMarketCap = d.total_market_cap.usd;
    if (d.total_volume?.usd !== undefined) indicators.volume24h = d.total_volume.usd;
    indicators.lastUpdated = Date.now();
  } catch {
    // non-fatal
  }
  return indicators;
}

export const coingeckoSource: MarketDataSource = {
  id: 'coingecko',
  supports: ['crypto', 'global'],
  fetchQuotes: fetchCryptoPrices,
  fetchIndicators,
  lastUpdated: null,
};

/** Re-exported helper used by the intelligence layer for single-coin lookups */
export { pctChange };

