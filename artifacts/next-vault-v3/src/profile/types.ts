import type { BoostMultiplier, GamificationState } from '../lib/gamification';
import type { LimitStatus, PurchaseState } from '../lib/payments';
import type { useNvultLoadout } from './nvult/loadout';

export type Section = 'identity' | 'nvult' | 'collection' | 'achievements' | 'ranking' | 'shop';
export const SECTIONS: Section[] = ['identity', 'nvult', 'collection', 'achievements', 'ranking', 'shop'];

/** Everything a section needs: the real engine state, the real purchase flow, and the local Nvult look. */
export interface ProfileCtx {
  gamification: GamificationState;
  level: number;
  accent: string;
  nv: ReturnType<typeof useNvultLoadout>;
  hasBoost: boolean;
  boostRemaining: number;
  activeBoost: BoostMultiplier;
  walletAddress: string | null;
  purchaseState: PurchaseState;
  entitlements: { product_id: string; product_type: string; tx_hash: string }[];
  isSkinOwned: (skinId: string) => boolean;
  limits: Record<string, LimitStatus>;
  getLimit: (productId: string) => Promise<LimitStatus>;
  onEquipSkin: (skinId: string) => void;
  onEquipTitle: (titleId: string) => void;
  onActivateBoost: (m: BoostMultiplier) => void;
  onBuySkin: (skinId: string) => void;
  onBuyXp: (packageId: string) => void;
  go: (s: Section) => void;
}
