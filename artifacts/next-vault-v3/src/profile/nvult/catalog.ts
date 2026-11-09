// ── Nvult catalog ────────────────────────────────────────────────────────────
// Every part unlocks from the REAL level (XP-derived), using the same milestone
// thresholds as badges, titles and skins in lib/gamification. There is no coin,
// token or purchase here: levelRequired 0 means "free from the start".

export type SlotId = 'head' | 'armor' | 'back' | 'weapon' | 'aura';
export type BodyStyle = 'sleek' | 'classic' | 'heavy';

export interface PartDef {
  id: string;
  slot: SlotId;
  /** 0 = available to everyone; otherwise the real level that unlocks it. */
  levelRequired: number;
}

export const SLOTS: SlotId[] = ['head', 'armor', 'back', 'weapon', 'aura'];
export const BODY_STYLES: BodyStyle[] = ['sleek', 'classic', 'heavy'];

export const PARTS: PartDef[] = [
  // Head
  { id: 'standard', slot: 'head', levelRequired: 0 },
  { id: 'crest',    slot: 'head', levelRequired: 0 },
  { id: 'dome',     slot: 'head', levelRequired: 0 },
  { id: 'spectra',  slot: 'head', levelRequired: 1000 },
  { id: 'halo',     slot: 'head', levelRequired: 1500 },
  { id: 'aegis',    slot: 'head', levelRequired: 2000 },
  // Armor
  { id: 'core',     slot: 'armor', levelRequired: 0 },
  { id: 'plated',   slot: 'armor', levelRequired: 0 },
  { id: 'pulse',    slot: 'armor', levelRequired: 1000 },
  { id: 'bulwark',  slot: 'armor', levelRequired: 1500 },
  { id: 'vanguard', slot: 'armor', levelRequired: 2000 },
  // Back module
  { id: 'none',     slot: 'back', levelRequired: 0 },
  { id: 'antenna',  slot: 'back', levelRequired: 1250 },
  { id: 'crawler',  slot: 'back', levelRequired: 1500 },
  { id: 'wings',    slot: 'back', levelRequired: 1750 },
  // Weapon
  { id: 'none',     slot: 'weapon', levelRequired: 0 },
  { id: 'blade',    slot: 'weapon', levelRequired: 1000 },
  { id: 'staff',    slot: 'weapon', levelRequired: 1500 },
  { id: 'lance',    slot: 'weapon', levelRequired: 2000 },
  // Aura
  { id: 'none',     slot: 'aura', levelRequired: 0 },
  { id: 'ring',     slot: 'aura', levelRequired: 1250 },
  { id: 'embers',   slot: 'aura', levelRequired: 1750 },
  { id: 'nebula',   slot: 'aura', levelRequired: 2500 },
];

export interface AccentDef { id: string; hex: string }
export const ACCENTS: AccentDef[] = [
  { id: 'teal',    hex: '#2dd4bf' },
  { id: 'cyan',    hex: '#22d3ee' },
  { id: 'azure',   hex: '#60a5fa' },
  { id: 'violet',  hex: '#a78bfa' },
  { id: 'magenta', hex: '#e879f9' },
  { id: 'rose',    hex: '#fb7185' },
  { id: 'amber',   hex: '#fbbf24' },
  { id: 'ice',     hex: '#e0f2fe' },
];

/** Metal finish of the armor. It comes from the equipped REAL skin (lib/gamification SKINS). */
export interface FinishDef { c0: string; c1: string; c2: string; c3: string; shine: boolean }
export const FINISHES: Record<string, FinishDef> = {
  default:        { c0: '#e2e8f0', c1: '#94a3b8', c2: '#334155', c3: '#0b1120', shine: false },
  bronze:         { c0: '#fed7aa', c1: '#c2763a', c2: '#7c3a14', c3: '#1c0f07', shine: false },
  silver:         { c0: '#f8fafc', c1: '#cbd5e1', c2: '#64748b', c3: '#0f172a', shine: false },
  gold:           { c0: '#fef3c7', c1: '#f5b83d', c2: '#92610c', c3: '#1c1405', shine: true },
  platinum:       { c0: '#ecfeff', c1: '#a5f3fc', c2: '#0e7490', c3: '#06141b', shine: true },
  'premium-500':  { c0: '#fde68a', c1: '#f59e0b', c2: '#78350f', c3: '#1c0e02', shine: true },
  'premium-1000': { c0: '#fff7d6', c1: '#fbbf24', c2: '#b45309', c3: '#2a1604', shine: true },
};
export const finishFor = (skinId: string): FinishDef => FINISHES[skinId] ?? FINISHES.default;

/** Evolution tiers: a tier is reached each time a real milestone level is crossed. */
export const TIER_LEVELS = [0, 1000, 1250, 1500, 1750, 2000, 2500];
export const TIER_IDS = ['initiate', 'operator', 'adept', 'vanguard', 'sentinel', 'paragon', 'apex'];

export function tierOf(level: number): number {
  let tier = 0;
  TIER_LEVELS.forEach((l, i) => { if (level >= l) tier = i; });
  return tier;
}

export const partsFor = (slot: SlotId): PartDef[] => PARTS.filter((p) => p.slot === slot);
export const findPart = (slot: SlotId, id: string): PartDef | undefined => PARTS.find((p) => p.slot === slot && p.id === id);
export const isPartUnlocked = (part: PartDef, level: number): boolean => level >= part.levelRequired;
export const accentHex = (id: string): string => ACCENTS.find((a) => a.id === id)?.hex ?? ACCENTS[0].hex;

/** All parts that unlock exactly at a given level (for the evolution timeline). */
export const partsUnlockedAt = (level: number): PartDef[] => PARTS.filter((p) => p.levelRequired === level && p.levelRequired > 0);

// ── Rarity: derived from the real level that unlocks an item (no extra economy) ──
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITY_COLOR: Record<Rarity, string> = { common: '#94a3b8', rare: '#38bdf8', epic: '#a78bfa', legendary: '#fbbf24', mythic: '#fb7185' };
export function rarityOf(levelRequired: number): Rarity {
  if (levelRequired <= 0) return 'common';
  if (levelRequired <= 1250) return 'rare';
  if (levelRequired <= 1750) return 'epic';
  if (levelRequired <= 2000) return 'legendary';
  return 'mythic';
}
