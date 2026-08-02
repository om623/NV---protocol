import type { MarketDataSource, Quote } from '../types';
import type { Asset } from '@/app/registry/types';

/**
 * Brapi — free Brazilian market API (B3 stocks, indices, FIIs).
 * Asset.sourceSymbol like '^BVSP' (Ibovespa), 'PETR4', 'BOVA11', ...
 * Docs: https://brapi.dev
 */
const BRAPI_BASE = 'https://brapi.dev/api';

function toDecimals(v: number, d: number): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return parseFloat(v.toFixed(d));
}

async function fetchQuotes(assets: Asset[]): Promise<Quote[]> {
  const results: Quote[] = [];
  const now = Date.now();
  // Brapi supports a comma-separated list of tickers for /api/quote
  const tickers = assets.map(a => a.sourceSymbol).filter(Boolean);
  if (tickers.length === 0) return results;
  try {
    const url = `${BRAPI_BASE}/quote/${tickers.join(',')}?fundamental=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return results;
    const json = await res.json();
    const list: Array<{ symbol?: string; regularMarketPrice?: number; regularMarketChangePercent?: number }> = json?.results ?? [];
    const bySymbol = new Map(list.map(item => [item.symbol, item]));
    for (const asset of assets) {
      const item = bySymbol.get(asset.sourceSymbol);
      if (!item || item.regularMarketPrice === undefined || item.regularMarketPrice === null) continue;
      results.push({
        assetId: asset.id,
        price: toDecimals(item.regularMarketPrice, asset.decimals),
        change24h: item.regularMarketChangePercent !== undefined ? toDecimals(item.regularMarketChangePercent, 2) : 0,
        updatedAt: now,
      });
    }
  } catch {
    // non-fatal
  }
  return results;
}

export const brapiSource: MarketDataSource = {
  id: 'brapi',
  supports: ['indices', 'smallCaps', 'americas'],
  fetchQuotes,
  lastUpdated: null,
};

