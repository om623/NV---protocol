import { useState, useCallback, useEffect, useRef } from 'react';
import {
  type GamificationState,
  type BoostMultiplier,
  DEFAULT_GAMIFICATION_STATE,
  awardSwapXP,
  activateBoost,
  equipSkin,
  equipTitle,
  grantPurchasedSkin,
  creditPurchasedXp,
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

  const recordSwap = useCallback((swapId?: string): number => {
    let gained = 0;
    setState(prev => {
      const { state: next, xpGained } = awardSwapXP(prev, swapId);
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

  // Called by usePurchases after server verifies an on-chain skin payment
  const grantSkin = useCallback((skinId: string) => {
    setState(prev => grantPurchasedSkin(prev, skinId));
  }, []);

  // Called by usePurchases after server verifies an on-chain XP payment
  const grantXp = useCallback((xpAmount: number, txHash: string) => {
    setState(prev => {
      const { state: next } = creditPurchasedXp(prev, xpAmount, txHash);
      return next;
    });
  }, []);

  const boostRemaining = boostTimeRemaining(state);
  const hasBoost = boostRemaining > 0;

  return {
    state,
    recordSwap,
    startBoost,
    setEquippedSkin,
    setEquippedTitle,
    grantSkin,
    grantXp,
    boostRemaining,
    hasBoost,
  };
}
