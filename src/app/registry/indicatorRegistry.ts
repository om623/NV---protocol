import { lazy } from 'react';
import type { IndicatorDefinition } from './types';

/**
 * ─── Indicator Registry (Global Intelligence) ─────────────────────────────────
 * Quick indicators for the right column.
 *
 * Fase 2: the registry is born PREPARED. The full set of global macro
 * indicators is declared structurally (id + labelKey + order), so adding a
 * data source or widget later is a pure registration — no structural change.
 *
 * Indicators with live data today (Fear & Greed, BTC Dominance, Market Cap,
 * Volume) are rendered by IndicatorsWidget from the GlobalMarketsProvider.
 * The remaining indicators (VIX, DXY, Fed Funds, CPI, Treasuries, PPI, PMI,
 * Unemployment) are registered as lazy placeholders and will be wired to data
 * sources in future phases without touching the registry contract.
 */

export const INDICATOR_PLACEHOLDER_IDS = [
  'vix',
  'dxy',
  'fed-funds',
  'cpi',
  'treasury-2y',
  'treasury-10y',
  'treasury-30y',
  'ppi',
  'pmi',
  'unemployment',
] as const;

const indicators: IndicatorDefinition[] = [
  // Live (rendered by IndicatorsWidget)
  { id: 'fear-greed',      labelKey: 'intelligence.fearGreed',      component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 1 },
  { id: 'btc-dominance',   labelKey: 'intelligence.btcDominance',   component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 2 },
  { id: 'market-cap',      labelKey: 'intelligence.marketCap',      component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 3 },
  { id: 'volume',          labelKey: 'intelligence.volume',         component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 4 },

  // Prepared placeholders (future data sources)
  { id: 'vix',             labelKey: 'indicators.vix',              component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 5 },
  { id: 'dxy',             labelKey: 'indicators.dxy',              component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 6 },
  { id: 'fed-funds',       labelKey: 'indicators.fedFunds',         component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 7 },
  { id: 'cpi',             labelKey: 'indicators.cpi',              component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 8 },
  { id: 'treasury-2y',     labelKey: 'indicators.treasury2y',       component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 9 },
  { id: 'treasury-10y',    labelKey: 'indicators.treasury10y',      component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 10 },
  { id: 'treasury-30y',    labelKey: 'indicators.treasury30y',      component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 11 },
  { id: 'ppi',             labelKey: 'indicators.ppi',              component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 12 },
  { id: 'pmi',             labelKey: 'indicators.pmi',              component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 13 },
  { id: 'unemployment',    labelKey: 'indicators.unemployment',     component: lazy(() => import('@/app/intelligence/widgets/IndicatorsWidget').then(m => ({ default: m.IndicatorsWidget }))), order: 14 },
];

export const indicatorRegistry: {
  getAll: () => IndicatorDefinition[];
  get: (id: string) => IndicatorDefinition | undefined;
} = {
  getAll: () => indicators,
  get: (id: string) => indicators.find(i => i.id === id),
};

