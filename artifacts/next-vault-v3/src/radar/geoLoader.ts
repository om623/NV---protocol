// Loads the Natural Earth country geometry (static asset, fetched once) and builds the world model.
// Primary source: /radar/countries-50m.json from public/ (same origin, works behind any proxy and in
// production). Fallback: the copy bundled from the world-atlas package, imported lazily so that a
// blocked or missing fallback can never prevent the Radar module itself from loading.
import { buildWorld, type WorldGeo } from './geo';

let worldPromise: Promise<WorldGeo> | null = null;

async function fetchTopology(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geodata ${res.status}`);
  return res.json();
}

export function loadWorld(): Promise<WorldGeo> {
  worldPromise ??= (async () => {
    const primary = `${import.meta.env.BASE_URL}radar/countries-50m.json`;
    let topo: unknown;
    try {
      topo = await fetchTopology(primary);
    } catch (first) {
      console.warn('[Radar] map data from public/ failed, using the bundled copy', first);
      const { default: bundledUrl } = await import('world-atlas/countries-50m.json?url');
      topo = await fetchTopology(bundledUrl);
    }
    return buildWorld(topo as Parameters<typeof buildWorld>[0]);
  })().catch((err) => {
    worldPromise = null; // a failed load must not be cached: the retry button needs a real retry
    throw err;
  });
  return worldPromise;
}
