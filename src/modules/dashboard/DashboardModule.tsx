import { Home } from '@/App';

/**
 * ─── Dashboard Module ─────────────────────────────────────────────────────────
 * Fase 0: the dashboard experience is the current `Home` surface (fully working
 * monolith — portfolio, market, swap, simulation, wallet, pools and history).
 *
 * To preserve the exact visual identity, animations, UX and layout of the app,
 * this module re-exports the existing `Home` component from `App.tsx`.
 * During Fase 0 the AppShell/ModuleRouter infrastructure is structural and
 * dormant — `App.tsx` still renders `Home` directly, so nothing changes at
 * runtime. In Fase 1 the dashboard is truly extracted into this module and the
 * shell becomes the single entry point.
 *
 * NOTE: `@/App` must NOT import `@/app/layout/AppShell` while this re-export
 * exists, otherwise a circular dependency would be created. The shell wiring
 * (Fase 1) replaces this re-export with the extracted dashboard component.
 */
export default Home;

