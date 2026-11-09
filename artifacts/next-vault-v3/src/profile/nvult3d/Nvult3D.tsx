import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { NvultFigure } from '../nvult/NvultFigure';
import { accentHex, tierOf } from '../nvult/catalog';
import type { Loadout } from '../nvult/loadout';
import type { Look, NvultScene } from './scene';
import { chooseRenderMode, detectEnv, resolveTier, type QualityTier, type RenderMode } from './support';
import { useQualityPref } from './quality';

export interface Nvult3DProps {
  look: Loadout;
  skinId: string;
  level: number;
  /** Accessible name for the character (also used by the SVG fallback). */
  label: string;
  className?: string;
  /** Show the rotate / reset buttons. */
  controls?: boolean;
  /** Reports which renderer is on screen, so the surrounding stage can adapt. */
  onMode?: (mode: RenderMode) => void;
}

type Status = 'loading' | 'ready' | 'fallback';
const STEP = 0.4;

/**
 * The Nvult as an interactive 3D character. The SVG figure is always rendered underneath: it is the placeholder while the 3D
 * engine downloads, and the permanent fallback when WebGL is missing, the context is lost, or the user chose the simple view.
 */
export function Nvult3D({ look, skinId, level, label, className = '', controls = true, onMode }: Nvult3DProps) {
  const { t } = useI18n();
  const hintId = useId();
  const pref = useQualityPref();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<NvultScene | null>(null);
  const onModeRef = useRef(onMode);
  onModeRef.current = onMode;
  const [status, setStatus] = useState<Status>('loading');
  const [tier, setTier] = useState<QualityTier | null>(null);

  const want3d = chooseRenderMode(detectEnv({ pref })) === '3d';
  const prefRef = useRef(pref);
  prefRef.current = pref;

  const sceneLook = useMemo<Look>(
    () => ({ head: look.head, armor: look.armor, back: look.back, weapon: look.weapon, aura: look.aura, style: look.style, accent: accentHex(look.accent), finish: skinId, tier: tierOf(level) }),
    [look.head, look.armor, look.back, look.weapon, look.aura, look.style, look.accent, skinId, level],
  );
  const lookRef = useRef(sceneLook);
  lookRef.current = sceneLook;

  // Create / destroy the scene. Re-runs only when 3D becomes wanted or unwanted, not on every look change.
  useEffect(() => {
    if (!want3d) {
      setStatus('fallback');
      onModeRef.current?.('2d');
      return;
    }
    let cancelled = false;
    let scene: NvultScene | null = null;
    let ro: ResizeObserver | null = null;
    let mq: MediaQueryList | null = null;
    const onMq = () => scene?.setReducedMotion(!!mq?.matches);
    setStatus('loading');
    void (async () => {
      try {
        const mod = await import('./scene');
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (cancelled || !canvas || !wrap) return;
        const env = detectEnv({ pref: prefRef.current });
        scene = new mod.NvultScene({
          canvas,
          tier: resolveTier(env),
          reducedMotion: env.reducedMotion,
          autoQuality: prefRef.current === 'auto',
          onQuality: setTier,
          onContext: (lost) => {
            setStatus(lost ? 'fallback' : 'ready');
            onModeRef.current?.(lost ? '2d' : '3d');
          },
        });
        sceneRef.current = scene;
        scene.resize(wrap.clientWidth, wrap.clientHeight);
        scene.setLook(lookRef.current, false);
        scene.start();
        ro = new ResizeObserver(() => scene?.resize(wrap.clientWidth, wrap.clientHeight));
        ro.observe(wrap);
        mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        mq.addEventListener('change', onMq);
        setTier(scene.tierNow);
        setStatus('ready');
        onModeRef.current?.('3d');
      } catch (err) {
        console.warn('[nvult3d] falling back to the simple view:', err);
        setStatus('fallback');
        onModeRef.current?.('2d');
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      mq?.removeEventListener('change', onMq);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [want3d]);

  // Quality preference changes between auto / high / low without tearing the scene down.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.setQuality(resolveTier(detectEnv({ pref })));
    setTier(s.tierNow);
  }, [pref]);

  // The look (equipment, colours, skin) flows straight into the 3D model, with transitions.
  useEffect(() => {
    sceneRef.current?.setLook(sceneLook, true);
  }, [sceneLook]);

  const rotate = (rad: number) => sceneRef.current?.rotateBy(rad);
  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'ArrowLeft') rotate(-STEP);
    else if (e.key === 'ArrowRight') rotate(STEP);
    else if (e.key === 'Home' || e.key === 'Escape') sceneRef.current?.resetView();
    else return;
    e.preventDefault();
  };

  const ready = status === 'ready';
  const btn = 'grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/40 text-foreground/80 backdrop-blur-md transition hover:border-white/40 hover:text-foreground';

  return (
    <div ref={wrapRef} className={`relative ${className}`} data-testid="nvult3d" data-render={ready ? '3d' : '2d'} data-status={status} data-tier={tier ?? ''} data-pref={pref}>
      <div aria-hidden={ready} className={`absolute inset-0 transition-opacity duration-500 ${ready ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <NvultFigure loadout={look} skinId={skinId} level={level} label={label} className="h-full w-full" />
      </div>

      {want3d && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          aria-describedby={hintId}
          tabIndex={ready ? 0 : -1}
          onKeyDown={onKey}
          data-testid="nvult3d-canvas"
          className={`absolute inset-0 h-full w-full cursor-grab touch-pan-y outline-none transition-opacity duration-500 active:cursor-grabbing ${ready ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        />
      )}
      <span id={hintId} className="sr-only">
        {t('pf.v3.hint')}
      </span>

      {ready && controls && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5" data-testid="nvult3d-controls">
          <button type="button" className={btn} aria-label={t('pf.v3.left')} onClick={() => rotate(-STEP)} data-testid="rot-left">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className={btn} aria-label={t('pf.v3.reset')} onClick={() => sceneRef.current?.resetView()} data-testid="rot-reset">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={btn} aria-label={t('pf.v3.right')} onClick={() => rotate(STEP)} data-testid="rot-right">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === 'fallback' && pref !== 'off' && (
        <span className="absolute bottom-2 left-2 rounded-full border border-amber-400/30 bg-black/50 px-2 py-0.5 text-[10px] text-amber-200/90" data-testid="nvult3d-fallback-note">
          {t('pf.v3.fallback')}
        </span>
      )}
    </div>
  );
}
