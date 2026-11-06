import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/context';
import { countryName } from '../data/countries';
import type { MarkerPoint, WorldGeo } from '../geo';
import { GlobeEngine } from './engine';

export interface FocusRequest { lat: number; lon: number; dist: number; nonce: number }

interface Props {
  world: WorldGeo | null;
  points: MarkerPoint[];
  covered: Set<string>;
  selectedCountry: string | null;
  autoRotate: boolean;
  focus: FocusRequest | null;
  onCountryClick: (a2: string) => void;
  onCompanyClick: (id: string) => void;
  onClusterOpen: (ids: string[], country: string | null) => void;
  onUnsupported: () => void;
  onReady: () => void;
  onError: (message: string) => void;
}

/** Thin React wrapper: creates the engine once and forwards prop changes to it. */
export function RadarGlobe(props: Props) {
  const { t, localeBcp47 } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<GlobeEngine | null>(null);
  const handlers = useRef(props);
  handlers.current = props;
  const bcp = useRef(localeBcp47);
  bcp.current = localeBcp47;

  /** Every engine call is isolated: a 3D failure must never take the page down. */
  const guard = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      console.error('[Radar globe]', err);
      handlers.current.onError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!host.current) return;
    let e: GlobeEngine | null = null;
    guard(() => {
      e = new GlobeEngine({
        container: host.current as HTMLElement,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onCountryClick: (a2) => handlers.current.onCountryClick(a2),
        onCompanyClick: (id) => handlers.current.onCompanyClick(id),
        onClusterOpen: (ids, c) => handlers.current.onClusterOpen(ids, c),
        onUnsupported: () => handlers.current.onUnsupported(),
        onReady: () => handlers.current.onReady(),
        onError: (m) => handlers.current.onError(m),
      });
      engine.current = e;
    });
    return () => {
      try { e?.dispose(); } catch (err) { console.error('[Radar globe] dispose', err); }
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geometry + texture: built once when the world arrives.
  useEffect(() => {
    if (!props.world || !engine.current) return;
    const w = props.world;
    guard(() => engine.current?.setWorld(
      w,
      props.covered,
      (a2) => countryName(a2, bcp.current),
      (code) => t(`radar.continent.${code}`),
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.world, props.covered]);

  // Language change: only labels are rebuilt, never the texture.
  useEffect(() => {
    const e = engine.current;
    if (!e || !props.world) return;
    guard(() => {
      e.setLabels(props.covered, (a2) => countryName(a2, localeBcp47));
      e.setContinentNames((code) => t(`radar.continent.${code}`));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localeBcp47]);

  useEffect(() => { guard(() => engine.current?.setPoints(props.points)); }, [props.points]);
  useEffect(() => { guard(() => engine.current?.setSelected(props.selectedCountry)); }, [props.selectedCountry]);
  useEffect(() => { guard(() => engine.current?.setAutoRotate(props.autoRotate)); }, [props.autoRotate]);
  useEffect(() => {
    const f = props.focus;
    if (f) guard(() => engine.current?.flyTo(f.lat, f.lon, f.dist));
  }, [props.focus]);

  return <div ref={host} className="absolute inset-0" role="application" aria-label={t('radar.globe.aria')} />;
}
