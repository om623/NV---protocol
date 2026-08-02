/**
 * ─── NV Protocol — Data layer contracts ───────────────────────────────────────
 * Fully decoupled from the UI. Any future premium API can be added as a new
 * adapter implementing `MarketDataSource` without touching the interface.
 */
import type { Asset, GlobalIndicators } from '@/app/registry/types';

export interface Quote {
  assetId: string;
  price: number;
  change24h: number;
  updatedAt: number;
}

export interface MarketDataSource {
  id: string;
  supports: string[];
  fetchQuotes: (assets: Asset[]) => Promise<Quote[]>;
  fetchIndicators?: () => Promise<Partial<GlobalIndicators>>;
  lastUpdated?: number | null;
}

export type { Asset, GlobalIndicators };

