import type { MarketDataSource, Quote } from '../types';
import type { Asset } from '@/app/registry/types';

/**
 * Frankfurter — free FX reference rates (ECB).
 * Batch fetch: one request returns EUR-based rates for every target currency,
 * plus a second request for the previous business day to compute real change.
 * Cross rates are derived — pair X/Y = rate[Y] / rate[X] where rate[c] is the
 * amount of c per 1 EUR. Forex stays fully scalable: new pairs are pure data.
 */
const TARGET_CURRENCIES = ['USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'BRL', 'CNY'];

function toDecimals(v: number, d: number): number {
  if (v === undefined || v === null || isNaN(v)) return 0;
  return parseFloat(v.toFixed(d));
}

async function fetchRates(date?: string): Promise<Record<string, number> | null> {
  try {
    const url = date
      ? `https://api.frankfurter.app/${date}?from=EUR&to=${TARGET_CURRENCIES.join(',')}`
      : `https://api.frankfurter.app/latest?from=EUR&to=${TARGET_CURRENCIES.join(',')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const rates = json?.rates;
    if (!rates) return null;
    return rates as Record<string, number>;
  } catch {
    return null;
  }
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function crossRate(rates: Record<string, number>, pair: string): number | null {
  const [from, to] = pair.split('/');
  const rFrom = from === 'EUR' ? 1 : rates[from];
  const rTo = to === 'EUR' ? 1 : rates[to];
  if (rFrom === undefined || rTo === undefined || rFrom === 0) return null;
  return rTo / rFrom;
}

async function fetchQuotes(assets: Asset[]): Promise<Quote[]> {
  const [latest, prev] = await Promise.all([fetchRates(), fetchRates(yesterdayIso())]);
  if (!latest) return [];
  const now = Date.now();
  const quotes: Quote[] = [];
  for (const asset of assets) {
    const price = crossRate(latest, asset.sourceSymbol);
    if (price === null) continue;
    let change24h = 0;
    if (prev) {
      const prevPrice = crossRate(prev, asset.sourceSymbol);
      if (prevPrice && prevPrice !== 0) {
        change24h = toDecimals(((price - prevPrice) / prevPrice) * 100, 2);
      }
    }
    quotes.push({ assetId: asset.id, price: toDecimals(price, asset.decimals), change24h, updatedAt: now });
  }
  return quotes;
}

export const frankfurterSource: MarketDataSource = {
  id: 'frankfurter',
  supports: ['forex'],
  fetchQuotes,
  lastUpdated: null,
};

