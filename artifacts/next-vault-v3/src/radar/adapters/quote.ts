// Market quote via the app's existing Yahoo Finance proxy (/yf-proxy). Read-only chart data.

import type { Quote } from '../types';
import { cacheGet, cacheSet, dedupe, fetchJson, HOUR } from './http';

interface YfChart {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketTime?: number;
      };
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
    error?: unknown;
  };
}

function retOver(closes: number[], days: number): number | null {
  if (closes.length <= days) return null;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - days];
  if (!then) return null;
  return ((now - then) / then) * 100;
}

export function fetchQuote(symbol: string): Promise<Quote> {
  const key = `quote.${symbol}.v1`;
  const cached = cacheGet<Quote>(key, HOUR / 2);
  if (cached) return Promise.resolve(cached);
  return dedupe(key, async () => {
    const url = `/yf-proxy/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
    const json = await fetchJson<YfChart>(url, { timeoutMs: 15000 });
    const r = json.chart?.result?.[0];
    const meta = r?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('no quote');
    const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === 'number');
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    const q: Quote = {
      price: meta.regularMarketPrice,
      currency: meta.currency ?? '',
      changePct: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : null,
      high52: meta.fiftyTwoWeekHigh ?? null,
      low52: meta.fiftyTwoWeekLow ?? null,
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      marketTime: meta.regularMarketTime ?? null,
      spark: closes.slice(-90),
      ret1m: retOver(closes, 21),
      ret3m: retOver(closes, 63),
      source: 'Yahoo Finance',
      retrievedAt: new Date().toISOString(),
    };
    cacheSet(key, q);
    return q;
  });
}
