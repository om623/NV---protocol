import type { MarketDefinition } from './types';

/**
 * ─── Market Registry ──────────────────────────────────────────────────────────
 * Consolidated definition of tradable/viewable markets. Bridges categories and
 * assets. In Fase 2, selecting a market opens the category panel in the
 * workspace. New markets are added here as data.
 */
const markets: MarketDefinition[] = [
  { id: 'global',   labelKey: 'categories.global',   icon: '🌍', categoryId: 'global' },
  { id: 'crypto',   labelKey: 'categories.crypto',   icon: '₿',  categoryId: 'crypto' },
  { id: 'forex',    labelKey: 'categories.forex',    icon: '💱', categoryId: 'forex' },
  { id: 'indices',  labelKey: 'categories.indices',  icon: '📈', categoryId: 'indices' },
  { id: 'energy',   labelKey: 'categories.energy',   icon: '🛢', categoryId: 'energy' },
  { id: 'agro',     labelKey: 'categories.agro',     icon: '🌾', categoryId: 'agro' },
  { id: 'livestock',labelKey: 'categories.livestock',icon: '🐂', categoryId: 'livestock' },
  { id: 'metals',   labelKey: 'categories.metals',   icon: '🏭', categoryId: 'metals' },
  { id: 'smallCaps',labelKey: 'categories.smallCaps',icon: '📊', categoryId: 'smallCaps' },
  { id: 'americas', labelKey: 'categories.americas', icon: '🇺🇸', categoryId: 'americas' },
  { id: 'europe',   labelKey: 'categories.europe',   icon: '🇪🇺', categoryId: 'europe' },
  { id: 'asia',     labelKey: 'categories.asia',     icon: '🌏', categoryId: 'asia' },
  { id: 'africa',   labelKey: 'categories.africa',   icon: '🌍', categoryId: 'africa' },
  { id: 'oceania',  labelKey: 'categories.oceania',  icon: '🌊', categoryId: 'oceania' },
];

export const marketRegistry = {
  getAll: (): MarketDefinition[] => markets,
  get: (id: string): MarketDefinition | undefined => markets.find(m => m.id === id),
};

