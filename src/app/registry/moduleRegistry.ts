import { lazy } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Waypoints,
  Wallet,
  Database,
  History,
  Activity,
  Trophy,
  Settings,
  LineChart,
} from 'lucide-react';
import type { NVModule } from './types';

/**
 * ─── Module Registry (left column — Operações) ────────────────────────────────
 * Every operational module is registered here with a lazy-loaded component.
 * Adding a module = adding one entry; the LeftNav and ModuleRouter pick it up
 * automatically. Placeholder modules (comingSoon) render the standard
 * "Em breve" experience while preserving full architecture for the future.
 */
export const moduleRegistry: {
  getAll: () => NVModule[];
  get: (id: string) => NVModule | undefined;
  byGroup: (group: NVModule['group']) => NVModule[];
} = {
  getAll: () => modules,
  get: (id: string) => modules.find(m => m.id === id),
  byGroup: (group: NVModule['group']) => modules.filter(m => m.group === group),
};

const modules: NVModule[] = [
  {
    id: 'dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    group: 'operacoes',
    component: lazy(() => import('@/modules/dashboard')),
    order: 1,
  },
  {
    id: 'swap',
    labelKey: 'nav.swap',
    icon: ArrowLeftRight,
    group: 'operacoes',
    component: lazy(() => import('@/modules/swap')),
    order: 2,
  },
  {
    id: 'bridge',
    labelKey: 'nav.bridge',
    icon: Waypoints,
    group: 'operacoes',
    component: lazy(() => import('@/modules/bridge')),
    order: 3,
    comingSoon: true,
  },
  {
    id: 'wallet',
    labelKey: 'nav.wallet',
    icon: Wallet,
    group: 'operacoes',
    component: lazy(() => import('@/modules/wallet')),
    order: 4,
  },
  {
    id: 'pools',
    labelKey: 'nav.pools',
    icon: Database,
    group: 'operacoes',
    component: lazy(() => import('@/modules/pools')),
    order: 5,
  },
  {
    id: 'history',
    labelKey: 'nav.history',
    icon: History,
    group: 'operacoes',
    component: lazy(() => import('@/modules/history')),
    order: 6,
    comingSoon: true,
  },
  {
    id: 'simulation',
    labelKey: 'nav.simulation',
    icon: Activity,
    group: 'operacoes',
    component: lazy(() => import('@/modules/simulation')),
    order: 7,
  },
  {
    id: 'gamification',
    labelKey: 'nav.gamification',
    icon: Trophy,
    group: 'operacoes',
    component: lazy(() => import('@/modules/gamification')),
    order: 8,
    comingSoon: true,
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    icon: Settings,
    group: 'sistema',
    component: lazy(() => import('@/modules/settings')),
    order: 9,
    comingSoon: true,
  },
  {
    id: 'markets',
    labelKey: 'nav.markets',
    icon: LineChart,
    group: 'inteligencia',
    component: lazy(() => import('@/modules/markets')),
    order: 1,
  },
];

export { modules };

