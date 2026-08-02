import type { MarketCategory } from './types';
import { assetRegistry } from './assetRegistry';

/**
 * ─── Market Category Registry ─────────────────────────────────────────────────
 * The 14 categories of the Global Intelligence column. Each category defines a
 * filter over the asset registry — adding a category is just another entry.
 * Regional categories (América/Europa/Ásia/África/Oceania) filter by region.
 */
const categories: MarketCategory[] = [
  { id: 'global',     icon: '🌍', labelKey: 'categories.global',     order: 1,  filter: () => true },
  { id: 'crypto',     icon: '₿',  labelKey: 'categories.crypto',     order: 2,  filter: a => a.category === 'crypto' },
  { id: 'forex',      icon: '💱', labelKey: 'categories.forex',      order: 3,  filter: a => a.category === 'forex' },
  { id: 'indices',    icon: '📈', labelKey: 'categories.indices',    order: 4,  filter: a => a.category === 'indices' },
  { id: 'energy',     icon: '🛢', labelKey: 'categories.energy',     order: 5,  filter: a => a.category === 'energy' },
  { id: 'agro',       icon: '🌾', labelKey: 'categories.agro',       order: 6,  filter: a => a.category === 'agro' },
  { id: 'livestock',  icon: '🐂', labelKey: 'categories.livestock',  order: 7,  filter: a => a.category === 'livestock' },
  { id: 'metals',     icon: '🏭', labelKey: 'categories.metals',     order: 8,  filter: a => a.category === 'metals' },
  { id: 'smallCaps',  icon: '📊', labelKey: 'categories.smallCaps',  order: 9,  filter: a => a.category === 'smallCaps' },
  { id: 'americas',   icon: '🇺🇸', labelKey: 'categories.americas',   order: 10, region: 'AMERICAS', filter: a => a.region === 'AMERICAS' },
  { id: 'europe',     icon: '🇪🇺', labelKey: 'categories.europe',     order: 11, region: 'EUROPE',   filter: a => a.region === 'EUROPE' },
  { id: 'asia',       icon: '🌏', labelKey: 'categories.asia',       order: 12, region: 'ASIA',     filter: a => a.region === 'ASIA' },
  { id: 'africa',     icon: '🌍', labelKey: 'categories.africa',     order: 13, region: 'AFRICA',   filter: a => a.region === 'AFRICA' },
  { id: 'oceania',    icon: '🌊', labelKey: 'categories.oceania',    order: 14, region: 'OCEANIA',  filter: a => a.region === 'OCEANIA' },
];

export const categoryRegistry = {
  getAll: (): MarketCategory[] => [...categories].sort((a, b) => a.order - b.order),
  get: (id: string): MarketCategory | undefined => categories.find(c => c.id === id),
  /** Assets that belong to a category (via its filter) */
  assetsFor: (id: string) => {
    const category = categories.find(c => c.id === id);
    if (!category) return [];
    return assetRegistry.getAll().filter(category.filter);
  },
};

