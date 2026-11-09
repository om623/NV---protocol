// ── Nvult loadout: look + name, saved on this device only ────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACCENTS, BODY_STYLES, SLOTS, findPart, isPartUnlocked, partsFor,
  type BodyStyle, type SlotId,
} from './catalog';

export interface Loadout {
  name: string;
  accent: string;
  style: BodyStyle;
  head: string;
  armor: string;
  back: string;
  weapon: string;
  aura: string;
}

export const MAX_NAME = 16;
export const STORAGE_KEY = 'nv-nvult-loadout-v1';

export const DEFAULT_LOADOUT: Loadout = {
  name: 'Nvult',
  accent: 'teal',
  style: 'classic',
  head: 'crest',
  armor: 'core',
  back: 'none',
  weapon: 'none',
  aura: 'none',
};

/** Turns anything read from storage into a valid loadout (never throws). */
export function sanitizeLoadout(raw: unknown): Loadout {
  const base = { ...DEFAULT_LOADOUT };
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME) : '';
  if (name) base.name = name;
  if (typeof r.accent === 'string' && ACCENTS.some((a) => a.id === r.accent)) base.accent = r.accent;
  if (typeof r.style === 'string' && (BODY_STYLES as string[]).includes(r.style)) base.style = r.style as BodyStyle;
  for (const slot of SLOTS) {
    const v = r[slot];
    if (typeof v === 'string' && findPart(slot, v)) base[slot] = v;
  }
  return base;
}

/** The look actually shown: any part the real level no longer allows falls back to the default. */
export function effectiveLoadout(loadout: Loadout, level: number): Loadout {
  const out = { ...loadout };
  for (const slot of SLOTS) {
    const part = findPart(slot, out[slot]);
    if (!part || !isPartUnlocked(part, level)) out[slot] = DEFAULT_LOADOUT[slot];
  }
  return out;
}

export function randomLoadout(level: number, rnd: () => number = Math.random): Loadout {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length];
  const out: Loadout = { ...DEFAULT_LOADOUT };
  for (const slot of SLOTS) {
    out[slot] = pick(partsFor(slot).filter((p) => isPartUnlocked(p, level))).id;
  }
  out.accent = pick(ACCENTS).id;
  out.style = pick(BODY_STYLES);
  return out;
}

function read(): Loadout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeLoadout(JSON.parse(raw)) : { ...DEFAULT_LOADOUT };
  } catch {
    return { ...DEFAULT_LOADOUT };
  }
}

export function useNvultLoadout(level: number) {
  const [loadout, setLoadout] = useState<Loadout>(read);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loadout)); } catch { /* storage unavailable */ }
  }, [loadout]);

  const effective = useMemo(() => effectiveLoadout(loadout, level), [loadout, level]);

  const setPart = useCallback((slot: SlotId, id: string): boolean => {
    const part = findPart(slot, id);
    if (!part || !isPartUnlocked(part, level)) return false; // locked parts can only be previewed
    setLoadout((l) => ({ ...l, [slot]: id }));
    return true;
  }, [level]);

  const setAccent = useCallback((id: string) => { if (ACCENTS.some((a) => a.id === id)) setLoadout((l) => ({ ...l, accent: id })); }, []);
  const setStyle = useCallback((style: BodyStyle) => setLoadout((l) => ({ ...l, style })), []);
  const setName = useCallback((name: string) => setLoadout((l) => ({ ...l, name: name.replace(/[\u0000-\u001f<>]/g, '').slice(0, MAX_NAME) })), []);
  const reset = useCallback(() => setLoadout((l) => ({ ...DEFAULT_LOADOUT, name: l.name })), []);
  const randomize = useCallback(() => setLoadout((l) => ({ ...randomLoadout(level), name: l.name })), [level]);

  return { loadout, effective, setPart, setAccent, setStyle, setName, reset, randomize };
}
