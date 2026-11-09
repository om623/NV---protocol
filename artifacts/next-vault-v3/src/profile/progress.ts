// ── Progression: turns the engine's real thresholds into an evolution path ───
import { BADGES, TITLES, getCurrentSeason, type BadgeDef, type SeasonDef, type TitleDef } from '../lib/gamification';
import { PARTS, TIER_IDS, TIER_LEVELS, tierOf, type PartDef } from './nvult/catalog';

export interface Milestone {
  level: number;
  badges: BadgeDef[];
  titles: TitleDef[];
  parts: PartDef[];
}

export type MilestoneStatus = 'reached' | 'next' | 'upcoming';

/**
 * Every level at which something REAL unlocks:
 *  - badges and titles are granted by the XP engine (lib/gamification.checkUnlocks)
 *  - Nvult parts are unlocked from the same level (computed here, no state needed)
 * Level-based skins are intentionally not listed: the engine does not grant them yet.
 * The "collector" title comes from premium skins, not from a level.
 */
export function buildMilestones(): Milestone[] {
  const levels = new Set<number>();
  BADGES.forEach((b) => levels.add(b.levelRequired));
  TITLES.filter((t) => t.id !== 'collector').forEach((t) => levels.add(t.levelRequired));
  PARTS.filter((p) => p.levelRequired > 0).forEach((p) => levels.add(p.levelRequired));
  return [...levels].sort((a, b) => a - b).map((level) => ({
    level,
    badges: BADGES.filter((b) => b.levelRequired === level),
    titles: TITLES.filter((t) => t.id !== 'collector' && t.levelRequired === level),
    parts: PARTS.filter((p) => p.levelRequired === level),
  }));
}

export function statusOf(milestones: Milestone[], level: number): MilestoneStatus[] {
  const nextIdx = milestones.findIndex((m) => m.level > level);
  return milestones.map((m, i) => (m.level <= level ? 'reached' : i === nextIdx ? 'next' : 'upcoming'));
}

export interface TierInfo { index: number; id: string; nextLevel: number | null; progress: number }

/** Evolution tier of the character (0..6) and progress toward the following tier. */
export function tierInfo(level: number): TierInfo {
  const index = tierOf(level);
  const nextLevel = TIER_LEVELS[index + 1] ?? null;
  const from = TIER_LEVELS[index];
  const progress = nextLevel === null ? 1 : Math.max(0, Math.min(1, (level - from) / (nextLevel - from)));
  return { index, id: TIER_IDS[index], nextLevel, progress };
}

export interface SeasonInfo { season: SeasonDef; xp: number }
export const seasonInfo = (seasonXP: number): SeasonInfo => ({ season: getCurrentSeason(), xp: seasonXP });

/** Progress toward a given required level, for achievement cards. */
export const progressTo = (level: number, required: number): number => (required <= 0 ? 1 : Math.max(0, Math.min(1, level / required)));
