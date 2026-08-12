import { useState, useCallback, useEffect, useRef } from 'react';
import {
  type GamificationState,
  type BoostMultiplier,
  DEFAULT_GAMIFICATION_STATE,
  awardSwapXP,
  activateBoost,
  equipSkin,
  equipTitle,
  unlockPremiumSkin,
  boostTimeRemaining,
} from '../lib/gamification';

const STORAGE_KEY = 'nv-gamification';

function loadState(): GamificationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
  return { ...DEFAULT_GAMIFICATION_STATE, ...parsed };
    }
  } catch {}
  return DEFAULT_GAMIFICATION_STATE;
}

function saveState(state: GamificationState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useGamification() {
  const [state, setState] = useState<GamificationState>(loadState);
  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Tick every second for boost timer updates
  useEffect(() => {
    tickRef.current = window.setInterval(() => forceTick(t => t + 1), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, []);

  // Persist on change
  useEffect(() => { saveState(state); }, [state]);

  const recordSwap = useCallback((): number => {
    let gained = 0;
    setState(prev => {
      const { state: next, xpGained } = awardSwapXP(prev);
      gained = xpGained;
      return next;
    });
    return gained;
  }, []);

  const startBoost = useCallback((multiplier: BoostMultiplier) => {
    setState(prev => activateBoost(prev, multiplier));
  }, []);

  const setEquippedSkin = useCallback((skinId: string) => {
    setState(prev => equipSkin(prev, skinId));
  }, []);

  const setEquippedTitle = useCallback((titleId: string) => {
    setState(prev => equipTitle(prev, titleId));
  }, []);

  const purchasePremiumSkin = useCallback((skinId: string) => {
    setState(prev => unlockPremiumSkin(prev, skinId));
  }, []);

  const boostRemaining = boostTimeRemaining(state);
  const hasBoost = boostRemaining > 0;

  return {
    state,
    recordSwap,
    startBoost,
    setEquippedSkin,
    setEquippedTitle,
    purchasePremiumSkin,
    boostRemaining,
    hasBoost,
  };
}
