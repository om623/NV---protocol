import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import {
  type Quote,
  type GlobalIndicators,
  assetRegistry,
  dataSourceRegistry,
  categoryRegistry,
} from '@/app/registry';
import type { Asset } from '@/app/registry/types';

/**
 * ─── NV Protocol — GlobalMarketsProvider ─────────────────────────────────────
 * Central intelligence provider that aggregates the assetRegistry and
 * dataSourceRegistry to fetch market quotes and global indicators.
 *
 * Architecture:
 *  - Quotes are fetched per-category group, each with its own refresh interval
 *    (taken from the asset's `refreshMs` field). This avoids a single global
 *    refresh cycle — Crypto can refresh every 30s while indices update every 60s.
 *  - Adding a new asset or category is purely a data operation (registry entry).
 *    No provider code changes are needed.
 *  - Global indicators (Fear & Greed, BTC Dominance, Market Cap, Volume) are
 *    fetched on a separate cycle (30s) from the coingecko + alternativeMe sources.
 *
 * Fase 2: this provider is mounted inside the IntelligenceColumn, above the
 * widgets. It does NOT replace the ProtocolProvider — it's a separate context
 * for market data only.
 */

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface CategoryQuotes {
  /** Map of categoryId → Quote[] for that category */
  byCategory: Record<string, Quote[]>;
  /** All quotes flat (for the ticker bar) */
  allQuotes: Quote[];
  /** Map of assetId → Quote for O(1) lookup */
  byAssetId: Record<string, Quote>;
  /** Last updated per category */
  lastUpdatedByCategory: Record<string, number | null>;
  /** Global indicators (Fear & Greed, BTC Dominance, etc.) */
  indicators: GlobalIndicators;
  /** Whether any category is currently fetching */
  loading: boolean;
  /** Error message per category */
  errors: Record<string, string | null>;
}

export interface GlobalMarketsContextValue extends CategoryQuotes {
  /** Force refresh a specific category */
  refreshCategory: (categoryId: string) => Promise<void>;
  /** Force refresh all categories */
  refreshAll: () => Promise<void>;
  /** Get quotes for a specific category */
  getCategoryQuotes: (categoryId: string) => Quote[];
}

const DEFAULT_INDICATORS: GlobalIndicators = {
  fearGreed: 50,
  fearGreedLabel: 'Neutral',
  btcDominance: 51.2,
  globalMarketCap: 2_400_000_000_000,
  volume24h: 85_000_000_000,
  lastUpdated: null,
};

const GlobalMarketsContext = createContext<GlobalMarketsContextValue | null>(null);

/* ─── Provider ──────────────────────────────────────────────────────────────── */

export function GlobalMarketsProvider({ children }: { children: ReactNode }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [quotesByCategory, setQuotesByCategory] = useState<Record<string, Quote[]>>({});
  const [lastUpdatedByCategory, setLastUpdatedByCategory] = useState<Record<string, number | null>>({});
  const [indicators, setIndicators] = useState<GlobalIndicators>(DEFAULT_INDICATORS);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const timersRef = useRef<Map<string, number>>(new Map());
  const indicatorTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(t => window.clearInterval(t));
      timersRef.current.clear();
      if (indicatorTimerRef.current !== null) window.clearInterval(indicatorTimerRef.current);
    };
  }, []);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchCategory = useCallback(async (categoryId: string) => {
    const category = categoryRegistry.get(categoryId);
    if (!category) return;
    const assets = assetRegistry.byCategory(categoryId);
    if (assets.length === 0) return;

    // Group assets by source
    const bySource = new Map<string, Asset[]>();
    for (const asset of assets) {
      const list = bySource.get(asset.source) || [];
      list.push(asset);
      bySource.set(asset.source, list);
    }

    // Fetch from each source in parallel
    const promises: Promise<Quote[]>[] = [];
    for (const [sourceId, sourceAssets] of bySource) {
      const source = dataSourceRegistry.get(sourceId);
      if (!source) continue;
      promises.push(source.fetchQuotes(sourceAssets).catch(() => [] as Quote[]));
    }

    const results = await Promise.allSettled(promises);
    const quotes: Quote[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') quotes.push(...r.value);
    }

    if (!mountedRef.current) return;
    setQuotesByCategory(prev => ({ ...prev, [categoryId]: quotes }));
    setLastUpdatedByCategory(prev => ({ ...prev, [categoryId]: Date.now() }));
    setErrors(prev => ({ ...prev, [categoryId]: null }));
    setLoading(false);
  }, []);

  const fetchIndicators = useCallback(async () => {
    const sources = dataSourceRegistry.getAll().filter(s => s.fetchIndicators);
    const results = await Promise.allSettled(
      sources.map(s => s.fetchIndicators!().catch(() => ({} as Partial<GlobalIndicators>))),
    );
    const merged: Partial<GlobalIndicators> = {};
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) Object.assign(merged, r.value);
    }
    if (!mountedRef.current) return;
    setIndicators(prev => ({
      ...prev,
      ...merged,
      lastUpdated: merged.lastUpdated ?? prev.lastUpdated,
    }));
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const refreshCategory = useCallback(async (categoryId: string) => {
    await fetchCategory(categoryId);
  }, [fetchCategory]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const categories = categoryRegistry.getAll();
    await Promise.all(categories.map(c => fetchCategory(c.id)));
    await fetchIndicators();
    setLoading(false);
  }, [fetchCategory, fetchIndicators]);

  const getCategoryQuotes = useCallback((categoryId: string): Quote[] => {
    return quotesByCategory[categoryId] || [];
  }, [quotesByCategory]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const allQuotes = useMemo(() => {
    return Object.values(quotesByCategory).flat();
  }, [quotesByCategory]);

  const byAssetId = useMemo(() => {
    const map: Record<string, Quote> = {};
    for (const q of allQuotes) map[q.assetId] = q;
    return map;
  }, [allQuotes]);

  // ── Initial fetch + schedule ──────────────────────────────────────────────

  useEffect(() => {
    const categories = categoryRegistry.getAll();
    // Initial fetch of all categories
    Promise.all(categories.map(c => fetchCategory(c.id))).then(() => fetchIndicators());

    // Schedule per-category refresh based on the shortest refreshMs in that category
    for (const category of categories) {
      const assets = assetRegistry.byCategory(category.id);
      if (assets.length === 0) continue;
      const minRefresh = Math.min(...assets.map(a => a.refreshMs));
      const id = window.setInterval(() => {
        fetchCategory(category.id);
      }, minRefresh);
      timersRef.current.set(category.id, id);
    }

    // Indicators refresh every 30s
    indicatorTimerRef.current = window.setInterval(fetchIndicators, 30000);

    return () => {
      timersRef.current.forEach(t => window.clearInterval(t));
      timersRef.current.clear();
      if (indicatorTimerRef.current !== null) window.clearInterval(indicatorTimerRef.current);
    };
  }, [fetchCategory, fetchIndicators]);

  const value = useMemo<GlobalMarketsContextValue>(
    () => ({
      byCategory: quotesByCategory,
      allQuotes,
      byAssetId,
      lastUpdatedByCategory,
      indicators,
      loading,
      errors,
      refreshCategory,
      refreshAll,
      getCategoryQuotes,
    }),
    [
      quotesByCategory, allQuotes, byAssetId, lastUpdatedByCategory,
      indicators, loading, errors, refreshCategory, refreshAll, getCategoryQuotes,
    ],
  );

  return (
    <GlobalMarketsContext.Provider value={value}>
      {children}
    </GlobalMarketsContext.Provider>
  );
}

export function useGlobalMarkets(): GlobalMarketsContextValue {
  const ctx = useContext(GlobalMarketsContext);
  if (!ctx) throw new Error('useGlobalMarkets must be used within <GlobalMarketsProvider>');
  return ctx;
}
