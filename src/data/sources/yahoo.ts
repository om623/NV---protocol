import type { MarketDataSource, Quote } from '../types';
import type { Asset } from '@/app/registry/types';

/**
 * Yahoo Finance adapter.
 * Indices/commodities fetch through the dev proxy `/api/yahoo/...`.
 * In production the vercel rewrite must exist for these to be live
 * (otherwise they fall back gracefully to static values).
 *
 * Fase 2: fetch is fully parallel (each symbol resolves independently, so a
 * slow/unknown symbol never blocks the rest of the category). Supports agro
 * and livestock futures as well as indices/metals/energy.
 */
const YAHOO_SYMBOLS: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'Nasdaq',
  '^DJI': 'Dow Jones',
  '^RUT': 'Russell 2000',
  '^GDAXI': 'DAX',
  '^FCHI': 'CAC 40',
  '^FTSE': 'FTSE 100',
  '^STOXX50E': 'Euro Stoxx 50',
  '^N225': 'Nikkei 225',
  '^HSI': 'Hang Seng',
  '000001.SS': 'Shanghai Composite',
  '^KS11': 'KOSPI',
  '^BSESN': 'SENSEX',
  '^AXJO': 'ASX 200',
  'GC=F': 'Ouro',
  'SI=F': 'Prata',
  'PL=F': 'Platina',
  'PA=F': 'Paládio',
  'HG=F': 'Cobre',
  'BZ=F': 'Brent',
  'CL=F': 'WTI',
  'NG=F': 'Gás Natural',
  'ZS=F': 'Soja',
  'ZC=F': 'Milho',
  'ZW=F': 'Trigo',
  'KC=F': 'Café',
  'SB=F': 'Açúcar',
  'CT=F': 'Algodão',
  'GF=F': 'Boi Gordo',
  'LE=F': 'Gado de Corte',
  'HE=F': 'Suínos',
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

/**
 * Parallel fetch. Dedupes by sourceSymbol so multiple registered assets backed
 * by the same ticker (e.g. livestock futures) only trigger one request.
 */
async function fetchQuotes(assets: Asset[]): Promise<Quote[]> {
  const now = Date.now();
  const uniqueSymbols = Array.from(new Set(assets.map(a => a.sourceSymbol)));
  const settled = await Promise.allSettled(
    uniqueSymbols.map(async sym => ({ sym, quote: await fetchYahooQuote(sym) })),
  );
  const bySymbol = new Map<string, { price: number; changePct: number }>();
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.quote) bySymbol.set(r.value.sym, r.value.quote);
  }
  const quotes: Quote[] = [];
  for (const asset of assets) {
    const q = bySymbol.get(asset.sourceSymbol);
    if (!q) continue;
    quotes.push({ assetId: asset.id, price: q.price, change24h: q.changePct, updatedAt: now });
  }
  return quotes;
}

export const yahooSource: MarketDataSource = {
  id: 'yahoo',
  supports: ['indices', 'commodities', 'metals', 'energy', 'agro', 'livestock'],
  fetchQuotes,
  lastUpdated: null,
};

export { YAHOO_SYMBOLS };

