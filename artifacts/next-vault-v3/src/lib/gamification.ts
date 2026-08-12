// ── Gamification core: XP, levels, badges, titles, skins, seasons ────────────
// All definitions are data-driven so new badges/titles/skins can be added
// by simply appending to the arrays below.

export const BASE_LEVEL = 1000;
export const SWAP_XP_BASE = 0.5;
export const BOOST_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const PAYMENT_WALLET = '0xAd397122941D03450c70d0076379e079334D434f';

export type BoostMultiplier = 1 | 2 | 3 | 4;

export interface BadgeDef {
  id: string;
  levelRequired: number;
  levelGrant: number;
  icon: string; // lucide icon name
}

export interface TitleDef {
  id: string;
  levelRequired: number;
  levelGrant: number;
}

export interface SkinDef {
  id: string;
  levelRequired: number;
  premium?: boolean;
  price?: number; // USD for premium skins
  collectorTitle?: boolean;
}

export interface SeasonDef {
  id: string;
  index: number;
  startMonth: number; // 0-indexed month within the 72-month event
  durationMonths: number;
}

export interface XPPackageDef {
  id: string;
  price: number; // USD
  xp: number;
  duration: 'daily' | 'weekly' | 'quarterly';
}

// ── Badge definitions (extensible) ───────────────────────────────────────────
export const BADGES: BadgeDef[] = [
  { id: 'first-swap',    levelRequired: 1000, levelGrant: 250, icon: 'Sparkles' },
  { id: 'swapper-50',    levelRequired: 1250, levelGrant: 250, icon: 'Zap' },
  { id: 'swapper-100',   levelRequired: 1500, levelGrant: 250, icon: 'Flame' },
  { id: 'swapper-250',   levelRequired: 1750, levelGrant: 250, icon: 'Trophy' },
  { id: 'swapper-500',   levelRequired: 2000, levelGrant: 500, icon: 'Crown' },
  { id: 'swapper-1000',  levelRequired: 2500, levelGrant: 500, icon: 'Diamond' },
];

// ── Title definitions (extensible) ───────────────────────────────────────────
export const TITLES: TitleDef[] = [
  { id: 'novice',       levelRequired: 1000, levelGrant: 0   },
  { id: 'trader',       levelRequired: 1250, levelGrant: 250 },
  { id: 'expert',       levelRequired: 1500, levelGrant: 250 },
  { id: 'master',       levelRequired: 1750, levelGrant: 250 },
  { id: 'legend',       levelRequired: 2000, levelGrant: 500 },
  { id: 'collector',    levelRequired: 2000, levelGrant: 0   }, // from premium skins
];

// ── Skin definitions (extensible) ────────────────────────────────────────────
export const SKINS: SkinDef[] = [
  { id: 'default',   levelRequired: 1000 },
  { id: 'bronze',    levelRequired: 1250 },
  { id: 'silver',    levelRequired: 1500 },
  { id: 'gold',      levelRequired: 1750 },
  { id: 'platinum',  levelRequired: 2000 },
  { id: 'premium-500',  levelRequired: 2000, premium: true,  price: 500,  collectorTitle: true },
  { id: 'premium-1000', levelRequired: 2000, premium: true,  price: 1000, collectorTitle: true },
];

// ── XP purchase packages ─────────────────────────────────────────────────────
export const XP_PACKAGES: XPPackageDef[] = [
  { id: 'xp-daily',      price: 10,  xp: 30,  duration: 'daily'     },
  { id: 'xp-weekly',     price: 25,  xp: 60,  duration: 'weekly'    },
  { id: 'xp-quarterly',  price: 100, xp: 300, duration: 'quarterly' },
];

// ── Season definitions (72-month event, 4-month seasons = 18 seasons) ────────
export const SEASONS: SeasonDef[] = Array.from({ length: 18 }, (_, i) => ({
  id: `season-${i + 1}`,
  index: i + 1,
  startMonth: i * 4,
  durationMonths: 4,
}));

export const EVENT_TOTAL_MONTHS = 72;
export const SEASON_DURATION_MONTHS = 4;

// ── Leaderboard entry ─────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  name: string;
  level: number;
  xp: number;
  badge?: string;
  title?: string;
  isCurrentUser?: boolean;
}

// ── State shape ───────────────────────────────────────────────────────────────
export interface GamificationState {
  xp: number;
  totalSwaps: number;
  unlockedBadges: string[];
  unlockedTitles: string[];
  equippedTitle: string | null;
  unlockedSkins: string[];
  equippedSkin: string;
  boostMultiplier: BoostMultiplier;
  boostEndsAt: number | null; // epoch ms
  seasonXP: number;
  lastSwapAt: number | null;
}

export const DEFAULT_GAMIFICATION_STATE: GamificationState = {
  xp: 0,
  totalSwaps: 0,
  unlockedBadges: [],
  unlockedTitles: ['novice'],
  equippedTitle: 'novice',
  unlockedSkins: ['default'],
  equippedSkin: 'default',
  boostMultiplier: 1,
  boostEndsAt: null,
  seasonXP: 0,
  lastSwapAt: null,
};

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Compute effective level from XP and badge/title grants. */
export function computeLevel(state: GamificationState): number {
  let level = BASE_LEVEL;
  for (const b of BADGES) {
    if (state.unlockedBadges.includes(b.id)) level += b.levelGrant;
  }
  for (const t of TITLES) {
    if (state.unlockedTitles.includes(t.id)) level += t.levelGrant;
  }
  return level;
}

/** XP needed to reach the next badge milestone. */
export function nextMilestone(state: GamificationState): { level: number; xpNeeded: number; progress: number } {
  const currentLevel = computeLevel(state);
  const allMilestones = [...BADGES.map(b => b.levelRequired), ...TITLES.map(t => t.levelRequired)]
    .filter(l => l > currentLevel)
    .sort((a, b) => a - b);
  const next = allMilestones[0] ?? currentLevel + 500;
  const prev = currentLevel;
  const xpNeeded = next - prev;
  const progress = xpNeeded > 0 ? Math.min(1, state.xp / xpNeeded) : 1;
  return { level: next, xpNeeded, progress };
}

/** Check and unlock badges/titles based on swap count. */
export function checkUnlocks(state: GamificationState): GamificationState {
  const swaps = state.totalSwaps;
  const newBadges = [...state.unlockedBadges];
  const newTitles = [...state.unlockedTitles];
  let changed = false;

  for (const b of BADGES) {
    const swapThreshold = badgeSwapThreshold(b.id);
    if (swaps >= swapThreshold && !newBadges.includes(b.id)) {
      newBadges.push(b.id);
      changed = true;
    }
  }
  for (const t of TITLES) {
    if (t.id === 'collector') continue; // only from premium skins
    const swapThreshold = titleSwapThreshold(t.id);
    if (swaps >= swapThreshold && !newTitles.includes(t.id)) {
      newTitles.push(t.id);
      changed = true;
    }
  }
  if (!changed) return state;
  return { ...state, unlockedBadges: newBadges, unlockedTitles: newTitles };
}

function badgeSwapThreshold(id: string): number {
  const map: Record<string, number> = {
    'first-swap': 1, 'swapper-50': 50, 'swapper-100': 100,
    'swapper-250': 250, 'swapper-500': 500, 'swapper-1000': 1000,
  };
  return map[id] ?? Infinity;
}

function titleSwapThreshold(id: string): number {
  const map: Record<string, number> = {
    'novice': 0, 'trader': 50, 'expert': 100, 'master': 250, 'legend': 500,
  };
  return map[id] ?? Infinity;
}

/** Award XP for a swap, respecting active boost. */
export function awardSwapXP(state: GamificationState): { state: GamificationState; xpGained: number } {
  const multiplier = getActiveBoost(state);
  const xpGained = SWAP_XP_BASE * multiplier;
  const newState = {
    ...state,
    xp: state.xp + xpGained,
    totalSwaps: state.totalSwaps + 1,
    seasonXP: state.seasonXP + xpGained,
    lastSwapAt: Date.now(),
  };
  return { state: checkUnlocks(newState), xpGained };
}

/** Get currently active boost multiplier (1 if no active boost). */
export function getActiveBoost(state: GamificationState): BoostMultiplier {
  if (state.boostEndsAt && state.boostEndsAt > Date.now()) {
    return state.boostMultiplier;
  }
  return 1;
}

/** Activate a boost. */
export function activateBoost(state: GamificationState, multiplier: BoostMultiplier): GamificationState {
  return {
    ...state,
    boostMultiplier: multiplier,
    boostEndsAt: Date.now() + BOOST_DURATION_MS,
  };
}

/** Get boost time remaining in ms. */
export function boostTimeRemaining(state: GamificationState): number {
  if (!state.boostEndsAt) return 0;
  return Math.max(0, state.boostEndsAt - Date.now());
}

/** Get current season based on a start date. */
export function getCurrentSeason(eventStart: Date = new Date(2025, 0, 1)): SeasonDef {
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - eventStart.getFullYear()) * 12
    + (now.getMonth() - eventStart.getMonth());
  const seasonIdx = Math.floor(monthsElapsed / SEASON_DURATION_MONTHS);
  return SEASONS[Math.min(seasonIdx, SEASONS.length - 1)] ?? SEASONS[0];
}

/** Unlock a premium skin and grant collector title. */
export function unlockPremiumSkin(state: GamificationState, skinId: string): GamificationState {
  const skin = SKINS.find(s => s.id === skinId);
  if (!skin?.premium) return state;
  const newSkins = state.unlockedSkins.includes(skinId) ? state.unlockedSkins : [...state.unlockedSkins, skinId];
  const newTitles = state.unlockedTitles.includes('collector') ? state.unlockedTitles : [...state.unlockedTitles, 'collector'];
  return { ...state, unlockedSkins: newSkins, unlockedTitles: newTitles };
}

/** Equip a skin if unlocked. */
export function equipSkin(state: GamificationState, skinId: string): GamificationState {
  if (!state.unlockedSkins.includes(skinId)) return state;
  return { ...state, equippedSkin: skinId };
}

/** Equip a title if unlocked. */
export function equipTitle(state: GamificationState, titleId: string): GamificationState {
  if (!state.unlockedTitles.includes(titleId)) return state;
  return { ...state, equippedTitle: titleId };
}

/** Generate a mock leaderboard for display (extensible with real data later). */
export function generateLeaderboard(currentUser: GamificationState, currentUserName: string): LeaderboardEntry[] {
  const userLevel = computeLevel(currentUser);
  const entries: LeaderboardEntry[] = [
    { rank: 1, name: 'NV_Master', level: 3200, xp: 1850, badge: 'swapper-1000', title: 'legend' },
    { rank: 2, name: 'CryptoWolf', level: 2800, xp: 1420, badge: 'swapper-500', title: 'legend' },
    { rank: 3, name: 'AlphaTrader', level: 2500, xp: 1180, badge: 'swapper-500', title: 'master' },
    { rank: 4, name: 'DeFiNinja', level: 2200, xp: 940, badge: 'swapper-250', title: 'master' },
    { rank: 5, name: 'SwapKing', level: 2000, xp: 720, badge: 'swapper-250', title: 'expert' },
    { rank: 6, name: 'GreenFlash', level: 1800, xp: 560, badge: 'swapper-100', title: 'expert' },
    { rank: 7, name: 'NeonRider', level: 1600, xp: 410, badge: 'swapper-100', title: 'trader' },
    { rank: 8, name: 'BlockRunner', level: 1400, xp: 280, badge: 'swapper-50', title: 'trader' },
    { rank: 9, name: 'EmberFox', level: 1250, xp: 150, badge: 'swapper-50', title: 'trader' },
    { rank: 10, name: currentUserName, level: userLevel, xp: currentUser.xp, isCurrentUser: true },
  ];
  // Sort by level desc, reassign ranks
  entries.sort((a, b) => b.level - a.level);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}
