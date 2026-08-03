/**
 * ─── NV Protocol — Intelligence barrel ───────────────────────────────────────
 * Central export point for the Global Intelligence layer (Fase 2).
 * Re-exports the provider, hook, and all widget types.
 */
export { GlobalMarketsProvider, useGlobalMarkets } from './GlobalMarketsProvider';
export type { GlobalMarketsContextValue, CategoryQuotes } from './GlobalMarketsProvider';
export { CategoryWidget } from './widgets/CategoryWidget';
export { IndicatorsWidget } from './widgets/IndicatorsWidget';
export { MultiCategoryTicker } from './widgets/MultiCategoryTicker';
export { CategoryPanel } from './widgets/CategoryPanel';


