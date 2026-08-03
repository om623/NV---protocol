import { lazy } from 'react';
import type { MarketCategory } from './types';
import { assetRegistry } from './assetRegistry';

/**
 * ─── Market Category Registry ─────────────────────────────────────────────────
 * The 14 categories of the Global Intelligence column. Each category defines a
 * filter over the asset registry — adding a category is just another entry.
 *
 * Fase 2:
 *  - Every category has a lazy `panel` (rendered by the ModuleRouter) and a
 *    set of `viewModes` (drives the CategoryWidget selector).
 *  - Regional categories (América/Europa/Ásia/África/Oceania) filter by region.
 *  - Scalability: adding a category = one entry; adding an asset to a category
 *    = one asset in the assetRegistry. No component changes.
 */

const categories: MarketCategory[] = [
  {
    id: 'global', icon: '🌍', labelKey: 'categories.global', order: 1, filter: () => true,
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'crypto', icon: '₿', labelKey: 'categories.crypto', order: 2, filter: a => a.category === 'crypto',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'sparkline', 'heatmap', 'table'],
  },
  {
    id: 'forex', icon: '💱', labelKey: 'categories.forex', order: 3, filter: a => a.category === 'forex',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'indices', icon: '📈', labelKey: 'categories.indices', order: 4, filter: a => a.category === 'indices',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'sparkline', 'table'],
  },
  {
    id: 'energy', icon: '🛢', labelKey: 'categories.energy', order: 5, filter: a => a.category === 'energy',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'agro', icon: '🌾', labelKey: 'categories.agro', order: 6, filter: a => a.category === 'agro',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'livestock', icon: '🐂', labelKey: 'categories.livestock', order: 7, filter: a => a.category === 'livestock',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'metals', icon: '🏭', labelKey: 'categories.metals', order: 8, filter: a => a.category === 'metals',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'smallCaps', icon: '📊', labelKey: 'categories.smallCaps', order: 9, filter: a => a.category === 'smallCaps',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'americas', icon: '🇺🇸', labelKey: 'categories.americas', order: 10, region: 'AMERICAS', filter: a => a.region === 'AMERICAS',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'europe', icon: '🇪🇺', labelKey: 'categories.europe', order: 11, region: 'EUROPE', filter: a => a.region === 'EUROPE',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'asia', icon: '🌏', labelKey: 'categories.asia', order: 12, region: 'ASIA', filter: a => a.region === 'ASIA',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'africa', icon: '🌍', labelKey: 'categories.africa', order: 13, region: 'AFRICA', filter: a => a.region === 'AFRICA',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
  {
    id: 'oceania', icon: '🌊', labelKey: 'categories.oceania', order: 14, region: 'OCEANIA', filter: a => a.region === 'OCEANIA',
    panel: lazy(() => import('@/app/intelligence/widgets/CategoryPanel').then(m => ({ default: m.CategoryPanel }))),
    viewModes: ['list', 'cards', 'table'],
  },
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

