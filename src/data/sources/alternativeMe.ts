import type { MarketDataSource } from '../types';
import type { GlobalIndicators } from '@/app/registry/types';

/**
 * Alternative.me — Crypto Fear & Greed Index.
 * Direct public URL (no proxy). Used by the Global Intelligence column.
 */
async function fetchIndicators(): Promise<Partial<GlobalIndicators>> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return {};
    const json = await res.json();
    const entry = json?.data?.[0];
    if (!entry) return {};
    const value = parseInt(entry.value, 10);
    if (isNaN(value)) return {};
    return {
      fearGreed: value,
      fearGreedLabel: entry.value_classification || 'Neutral',
      lastUpdated: Date.now(),
    };
  } catch {
    return {};
  }
}

export const alternativeMeSource: MarketDataSource = {
  id: 'alternativeMe',
  supports: [],
  fetchQuotes: async () => [],
  fetchIndicators,
  lastUpdated: null,
};

