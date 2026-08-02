import type { MarketDataSource, Quote } from '../types';
import type { Asset } from '@/app/registry/types';

/**
 * Frankfurter — free FX reference rates (ECB).
 * Supports pairs against EUR. Asset.sourceSymbol must be like 'BRL', 'USD',
 * 'JPY', ... (the quote is EUR -> base).
 * For pairs like USD/BRL we compute cross rate via EUR.
 */
function toDecimals(v: number, d: number): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return parseFloat(v.toFixed(d));
}

async function fetchFxRate(base: string): Promise<number | null> {
  try {
    // Example: https://api.frankfurter.app/latest?from=EUR&to=BRL
    const url = `https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(base)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const rate = json?.rates?.[base];
    return typeof rate === 'number' ? rate : null;
  } catch {
    return null;
  }
}

async function fetchQuotes(assets: Asset[]): Promise<Quote[]> {
  const results: Quote[] = [];
  const now = Date.now();
  for (const asset of assets) {
    // Support simple pairs: USD-BRL -> base BRL, quote from EUR/USD cross.
    const parts = asset.sourceSymbol.split('/');
    const base = parts[parts.length - 1];
    const rate = await fetchFxRate(base);
    if (rate === null) continue;
    let price = rate; // EUR -> base
    if (parts.length === 2 && parts[0] !== 'EUR') {
      // Cross: EUR/base divided by EUR/counter gives counter/base.
      // For simplicity we compute via EUR for the base, and treat the pair
      // symbol 'USD/BRL' as base 'BRL' (counter=USD implied by EUR/USD).
      // Full cross-rate support comes with the premium data phase.
      const eurUsd = await fetchFxRate('USD');
      if (eurUsd === null) continue;
      price = parts[0] === 'USD' ? rate / eurUsd : rate;
    }
    results.push({
      assetId: asset.id,
      price: toDecimals(price, asset.decimals),
      change24h: 0,
      updatedAt: now,
    });
  }
  return results;
}

export const frankfurterSource: MarketDataSource = {
  id: 'frankfurter',
  supports: ['forex'],
  fetchQuotes,
  lastUpdated: null,
};

