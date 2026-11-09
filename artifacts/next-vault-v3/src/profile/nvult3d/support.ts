// Capability detection, quality tiers and render-mode choice for the 3D Nvult.
// Deliberately free of any `three` import: the React layer uses it to decide, before loading anything heavy,
// whether to show the 3D model or the simple SVG view.

export type QualityPref = 'auto' | 'high' | 'low' | 'off';
export type QualityTier = 'high' | 'medium' | 'low';

export const QUALITY_KEY = 'nv-nvult-quality-v1';
export const QUALITY_PREFS: readonly QualityPref[] = ['auto', 'high', 'low', 'off'];

export function readQualityPref(): QualityPref {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    return (QUALITY_PREFS as readonly string[]).includes(v ?? '') ? (v as QualityPref) : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeQualityPref(q: QualityPref): void {
  try {
    localStorage.setItem(QUALITY_KEY, q);
  } catch {
    /* private mode: the choice just lasts for this visit */
  }
}

let webglCache: boolean | null = null;

/** True when a WebGL context can really be created (not just when the API exists). Cached after the first probe. */
export function webglAvailable(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    webglCache = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function resetWebglProbe(): void {
  webglCache = null;
}

export interface Env {
  webgl: boolean;
  reducedMotion: boolean;
  pref: QualityPref;
  coarsePointer: boolean;
  memory: number | null; // GB, when the browser reports it
  cores: number | null;
  dpr: number;
}

export function detectEnv(overrides: Partial<Env> = {}): Env {
  const mq = (q: string) => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  return {
    webgl: webglAvailable(),
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    pref: readQualityPref(),
    coarsePointer: mq('(pointer: coarse)'),
    memory: nav?.deviceMemory ?? null,
    cores: nav?.hardwareConcurrency ?? null,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ...overrides,
  };
}

/** Which tier to start with. 'auto' looks at the device: phones get medium, weak hardware gets low. */
export function resolveTier(env: Env): QualityTier {
  if (env.pref === 'high') return 'high';
  if (env.pref === 'low') return 'low';
  if ((env.memory !== null && env.memory <= 2) || (env.cores !== null && env.cores <= 2)) return 'low';
  if (env.coarsePointer || (env.memory !== null && env.memory <= 4)) return 'medium';
  return 'high';
}

export type RenderMode = '3d' | '2d';

export function chooseRenderMode(env: Env): RenderMode {
  if (!env.webgl) return '2d';
  if (env.pref === 'off') return '2d';
  return '3d';
}

export interface QualityProfile {
  tier: QualityTier;
  dprCap: number;
  antialias: boolean;
  shadows: boolean;
  shadowMap: number;
  particles: number;
  segments: number; // radial segments for curved geometry
  envSize: number; // PMREM source size
  fpsCap: number;
  glow: boolean; // additive glow sprites
}

export const PROFILES: Record<QualityTier, QualityProfile> = {
  high: { tier: 'high', dprCap: 2, antialias: true, shadows: true, shadowMap: 1024, particles: 90, segments: 28, envSize: 128, fpsCap: 60, glow: true },
  medium: { tier: 'medium', dprCap: 1.5, antialias: true, shadows: false, shadowMap: 0, particles: 48, segments: 18, envSize: 64, fpsCap: 45, glow: true },
  low: { tier: 'low', dprCap: 1, antialias: false, shadows: false, shadowMap: 0, particles: 20, segments: 10, envSize: 32, fpsCap: 30, glow: false },
};

/** Next lower tier, or null when already at the floor. Used by the automatic frame-rate guard. */
export function downgrade(t: QualityTier): QualityTier | null {
  return t === 'high' ? 'medium' : t === 'medium' ? 'low' : null;
}
