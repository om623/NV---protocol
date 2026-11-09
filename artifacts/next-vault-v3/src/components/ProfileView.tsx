// ── Profile: identity, evolution and the Nvult character ─────────────────────
// Thin shell. The props contract is unchanged (it is what App.tsx passes), the
// real XP / level / skin / purchase systems are untouched, and the experience
// itself lives in src/profile/*.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Bot, Fingerprint, Gem, ShoppingCart, Trophy } from 'lucide-react';
import { useI18n } from '../i18n';
import { computeLevel, getActiveBoost, type BoostMultiplier, type GamificationState } from '../lib/gamification';
import type { LimitStatus, PurchaseState } from '../lib/payments';
import { accentHex } from '../profile/nvult/catalog';
import { useNvultLoadout } from '../profile/nvult/loadout';
import { Achievements } from '../profile/sections/Achievements';
import { Collection } from '../profile/sections/Collection';
import { Identity } from '../profile/sections/Identity';
import { NvultLab } from '../profile/sections/NvultLab';
import { Ranking } from '../profile/sections/Ranking';
import { Shop } from '../profile/sections/Shop';
import { SECTIONS, type ProfileCtx, type Section } from '../profile/types';
import { SectionNav, type NavItem } from '../profile/ui';

interface ProfileViewProps {
  gamification: GamificationState;
  hasBoost: boolean;
  boostRemaining: number;
  onEquipSkin: (skinId: string) => void;
  onEquipTitle: (titleId: string) => void;
  onActivateBoost: (m: BoostMultiplier) => void;
  // Real payment flow
  walletAddress: string | null;
  purchaseState: PurchaseState;
  entitlements: { product_id: string; product_type: string; tx_hash: string }[];
  isSkinOwned: (skinId: string) => boolean;
  getLimit: (productId: string) => Promise<LimitStatus>;
  limits: Record<string, LimitStatus>;
  onBuySkin: (skinId: string) => void;
  onBuyXp: (packageId: string) => void;
}

const ICONS: Record<Section, typeof Bot> = {
  identity: Fingerprint, nvult: Bot, collection: Gem, achievements: Award, ranking: Trophy, shop: ShoppingCart,
};

export function ProfileView(props: ProfileViewProps) {
  const { t } = useI18n();
  const [section, setSection] = useState<Section>('identity');
  const level = computeLevel(props.gamification);
  const nv = useNvultLoadout(level);
  const accent = accentHex(nv.effective.accent);

  const ctx: ProfileCtx = {
    gamification: props.gamification,
    level,
    accent,
    nv,
    hasBoost: props.hasBoost,
    boostRemaining: props.boostRemaining,
    activeBoost: getActiveBoost(props.gamification),
    walletAddress: props.walletAddress,
    purchaseState: props.purchaseState,
    entitlements: props.entitlements,
    isSkinOwned: props.isSkinOwned,
    limits: props.limits,
    getLimit: props.getLimit,
    onEquipSkin: props.onEquipSkin,
    onEquipTitle: props.onEquipTitle,
    onActivateBoost: props.onActivateBoost,
    onBuySkin: props.onBuySkin,
    onBuyXp: props.onBuyXp,
    go: setSection,
  };

  const items: NavItem<Section>[] = useMemo(
    () => SECTIONS.map((id) => {
      const Icon = ICONS[id];
      return { id, label: t(`pf.nav.${id}`), icon: <Icon size={15} /> };
    }),
    [t],
  );

  return (
    <div className="@container relative space-y-4" data-profile data-active-section={section} style={{ ['--pf-focus' as string]: accent }}>
      {/* Keyboard focus ring for the whole Profile: visible on the dark UI, in the user's accent colour. */}
      <style>{'[data-profile] :focus-visible{outline:2px solid var(--pf-focus,#67e8f9);outline-offset:2px;border-radius:10px}.pf-shimmer{animation:pf-shimmer 2.8s ease-in-out infinite}.pf-shine{animation:pf-shine 5.5s ease-in-out infinite}@keyframes pf-shine{0%,40%{transform:translateX(-130%) skewX(-20deg)}75%,100%{transform:translateX(420%) skewX(-20deg)}}@keyframes pf-shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}@media (prefers-reduced-motion:reduce){.pf-shimmer{animation:none;opacity:0}.pf-shine{animation:none;opacity:0}}'}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-80 opacity-70"
        style={{ background: `radial-gradient(60% 70% at 25% 0%, ${accent}26, transparent 70%), radial-gradient(40% 50% at 90% 10%, rgba(139,92,246,.10), transparent 70%)` }} />
      <div className="relative space-y-4">
        <SectionNav<Section> items={items} active={section} onChange={(id) => setSection(id)} accent={accent} label={t('pf.nav.label')} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} role="tabpanel" id="pf-panel" aria-labelledby={`pf-tab-${section}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {section === 'identity' && <Identity ctx={ctx} />}
            {section === 'nvult' && <NvultLab ctx={ctx} />}
            {section === 'collection' && <Collection ctx={ctx} />}
            {section === 'achievements' && <Achievements ctx={ctx} />}
            {section === 'ranking' && <Ranking ctx={ctx} />}
            {section === 'shop' && <Shop ctx={ctx} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
