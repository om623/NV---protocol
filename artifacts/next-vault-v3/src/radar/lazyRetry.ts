import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'nv.radar.chunk-reload';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * React.lazy that survives stale/failed module requests (a dev-server dependency
 * re-optimisation, a redeploy, a flaky proxy): retry once, then reload the page once
 * (guarded so it can never loop), and only then surface the error to the boundary.
 */
export function lazyWithRetry<T extends ComponentType<never>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const done = (m: { default: T }) => {
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage unavailable */ }
      return m;
    };
    try {
      return done(await factory());
    } catch (first) {
      console.warn('[Radar] module load failed, retrying', first);
      await wait(800);
      try {
        return done(await factory());
      } catch (second) {
        let canReload = false;
        try {
          canReload = !sessionStorage.getItem(RELOAD_FLAG);
          if (canReload) sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch { canReload = false; }
        if (canReload) {
          window.location.reload();
          return new Promise<never>(() => undefined);
        }
        throw second;
      }
    }
  });
}
