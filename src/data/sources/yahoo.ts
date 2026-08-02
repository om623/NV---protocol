import type { MarketDataSource, Quote } from '../types';
import type { Asset } from '@/app/registry/types';

/**
 * Yahoo Finance adapter.
 * Indices/commodities fetch through the dev proxy `/api/yahoo/...`.
 * In production the vercel rewrite must exist for these to be live
 * (otherwise they fall back gracefully to static values).
 */
const YAHOO_SYMBOLS: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'Nasdaq',
  '^DJI': 'Dow Jones',
  'GC=F': 'Gold',
  'SI=F': 'Silver',
};

function toDecimals(v: number, d: number): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return parseFloat(v.toFixed(d));
}

function pctChange(current: number, previous: number | undefined | null): number {
  if (!previous || previous === 0) return 0;
  return toDecimals(((current - previous) / previous) * 100, 2);
}

async function fetchYahooQuote(sourceSymbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(sourceSymbol)}?range=2d&interval=1d`;
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

async function fetchQuotes(assets: Asset[]): Promise<Quote[]> {
  const results: Quote[] = [];
  const now = Date.now();
  for (const asset of assets) {
    const quote = await fetchYahooQuote(asset.sourceSymbol);
    if (quote) {
      results.push({
        assetId: asset.id,
        price: quote.price,
        change24h: quote.changePct,
        updatedAt: now,
      });
    }
  }
  return results;
}

export const yahooSource: MarketDataSource = {
  id: 'yahoo',
  supports: ['indices', 'commodities', 'metals', 'energy'],
  fetchQuotes,
  lastUpdated: null,
};

export { YAHOO_SYMBOLS };

