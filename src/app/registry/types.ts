import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * ─── NV Protocol — Registry Contracts ─────────────────────────────────────────
 * Central types that define every pluggable piece of the platform.
 * Anything new (module, category, asset, data source, indicator, market)
 * must implement one of these contracts and register itself in the
 * corresponding registry. No component depends on another component directly.
 */

/* ── Module (left column — Operações) ──────────────────────────────────────── */

export type ModuleGroup = 'operacoes' | 'inteligencia' | 'sistema';

export interface NVModule {
  /** Unique id, e.g. 'swap', 'bridge', 'gamification' */
  id: string;
  /** Human-readable label (translated via i18n key `nav.<id>`) */
  labelKey: string;
  /** Icon used in the left navigation */
  icon: ComponentType<{ className?: string; size?: number }>;
  /** Which section of the nav the module belongs to */
  group: ModuleGroup;
  /** Lazy-loaded component (code-split chunk) */
  component: LazyExoticComponent<ComponentType<Record<string, unknown>>>;
  /** Sort order within the group */
  order: number;
  /** When true, the module is a placeholder ("Em breve") */
  comingSoon?: boolean;
  /** When true, module is hidden from nav but still registered */
  hidden?: boolean;
}

/* ── Market Category (Global Intelligence — right column) ─────────────────── */

export type MarketRegion =
  | 'GLOBAL'
  | 'AMERICAS'
  | 'EUROPE'
  | 'ASIA'
  | 'AFRICA'
  | 'OCEANIA';

/**
 * View modes supported by a category panel.
 * The CategoryWidget is data-driven and future-proof: adding a view mode is a
 * component concern, never a registry change. Modes are declared per category
 * to drive the selector UI; modes not yet implemented render the default list.
 */
export type CategoryViewMode = 'cards' | 'list' | 'sparkline' | 'heatmap' | 'table';

export interface MarketCategory {
  /** Unique id, e.g. 'crypto', 'forex', 'agro' */
  id: string;
  /** Display emoji/icon */
  icon: string;
  /** i18n key for the label */
  labelKey: string;
  /** Optional geographic region for regional categories */
  region?: MarketRegion;
  /** Selects which assets belong to this category */
  filter: (asset: Asset) => boolean;
  /** Optional lazy panel rendered in the workspace when the category is opened */
  panel?: LazyExoticComponent<ComponentType<{ categoryId: string }>>;
  /** View modes this category can render (drives the CategoryWidget selector) */
  viewModes?: CategoryViewMode[];
  /** Sort order */
  order: number;
}

/* ── Asset (ticker + panels) ───────────────────────────────────────────────── */

export interface Asset {
  /** Unique id, e.g. 'USD-BRL', 'GOLD', 'IBOV' */
  id: string;
  /** Compact symbol, e.g. 'USD/BRL' */
  symbol: string;
  /** Full name */
  name: string;
  /** Which category this asset belongs to (must exist in categoryRegistry) */
  category: string;
  /** Optional region tag */
  region?: MarketRegion;
  /** Data source id (must exist in dataSourceRegistry) */
  source: string;
  /** Symbol/param used by the source adapter, e.g. 'USDBRL=X' */
  sourceSymbol: string;
  /** Number of decimals for price display */
  decimals: number;
  /** Refresh interval in ms (ticker 30000, slow markets 60000) */
  refreshMs: number;
  /** Display configuration */
  display: {
    /** Show in the bottom ticker bar */
    ticker: boolean;
    /** Show in category panels */
    panel: boolean;
    /** Optional override precision */
    precision?: number;
  };
}

/* ── Data Source (pluggable adapter) ───────────────────────────────────────── */

export interface Quote {
  assetId: string;
  price: number;
  change24h: number;
  /** ISO timestamp or ms epoch when the quote was produced */
  updatedAt: number;
}

export interface GlobalIndicators {
  fearGreed: number;
  fearGreedLabel: string;
  btcDominance: number;
  globalMarketCap: number;
  volume24h: number;
  lastUpdated: number | null;
}

export interface MarketDataSource {
  /** Unique id, e.g. 'coingecko', 'yahoo', 'frankfurter' */
  id: string;
  /** Categories this source can provide quotes for */
  supports: string[];
  /** Fetch quotes for the given assets (only those it supports) */
  fetchQuotes: (assets: Asset[]) => Promise<Quote[]>;
  /** Optional provider of global indicators */
  fetchIndicators?: () => Promise<Partial<GlobalIndicators>>;
  /** Optional ticker of last update — used by the intelligence column */
  lastUpdated?: number | null;
}

/* ── Indicator (Global Intelligence — right column) ───────────────────────── */

export interface IndicatorDefinition {
  /** Unique id, e.g. 'fear-greed', 'btc-dominance' */
  id: string;
  /** i18n key for the label */
  labelKey: string;
  /** Lazy-loaded indicator widget */
  component: LazyExoticComponent<ComponentType<Record<string, unknown>>>;
  /** Sort order */
  order: number;
}

/* ── Market registry (consolidated markets view) ───────────────────────────── */

export interface MarketDefinition {
  id: string;
  labelKey: string;
  icon: string;
  categoryId: string;
}

