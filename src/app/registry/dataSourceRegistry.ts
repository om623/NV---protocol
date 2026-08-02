import type { MarketDataSource } from '@/data/types';
import { coingeckoSource } from '@/data/sources/coingecko';
import { yahooSource } from '@/data/sources/yahoo';
import { alternativeMeSource } from '@/data/sources/alternativeMe';
import { frankfurterSource } from '@/data/sources/frankfurter';
import { brapiSource } from '@/data/sources/brapi';

/**
 * ─── Data Source Registry ─────────────────────────────────────────────────────
 * All market data sources register here. To add a new source, implement
 * `MarketDataSource` and append it to the array — nothing else changes.
 * A future premium API simply replaces an adapter's implementation.
 */
const sources: MarketDataSource[] = [
  coingeckoSource,
  yahooSource,
  alternativeMeSource,
  frankfurterSource,
  brapiSource,
];

export const dataSourceRegistry = {
  getAll: (): MarketDataSource[] => sources,
  get: (id: string): MarketDataSource | undefined => sources.find(s => s.id === id),
  /** All sources that can provide quotes for a given category */
  forCategory: (categoryId: string): MarketDataSource[] =>
    sources.filter(s => s.supports.includes(categoryId)),
};

