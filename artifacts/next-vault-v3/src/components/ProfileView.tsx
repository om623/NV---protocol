import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Flame, Trophy, Crown, Diamond, Star, Award, ChevronRight, Clock, TrendingUp, ShoppingCart, Check, Lock, Zap as ZapIcon, Users, Calendar, Shield, Sword, Eye, Loader as Loader2, CircleAlert as AlertCircle, ExternalLink, Bot } from 'lucide-react';
import { NvultPrototype } from './NvultPrototype';
import { useI18n, useFormat } from '../i18n';
import {
  BASE_LEVEL, SWAP_XP_BASE, BOOST_DURATION_MS,
  BADGES, TITLES, SKINS, XP_PACKAGES,
  computeLevel, nextMilestone, getActiveBoost,
  type GamificationState, type BoostMultiplier,
} from '../lib/gamification';
import {
  PAYMENT_CHAIN_NAME, PAYMENT_TOKEN_SYMBOL, PAYMENT_CHAIN_ID,
  getServerPaymentWallet,
  type PurchaseState, type LimitStatus,
} from '../lib/payments';

const BASE_EXPLORER_TX = 'https://basescan.org/tx';

const BADGE_ICONS: Record<string, typeof Sparkles> = {
  Sparkles, Zap, Flame, Trophy, Crown, Diamond,
};

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

export function ProfileView({
  gamification, hasBoost, boostRemaining,
  onEquipSkin, onEquipTitle, onActivateBoost,
  walletAddress, purchaseState, entitlements, isSkinOwned,
  getLimit, limits, onBuySkin, onBuyXp,
}: ProfileViewProps) {
  const { t } = useI18n();
  const { number } = useFormat();
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'skins' | 'leaderboard' | 'shop' | 'nvult'>('overview');

  const level = computeLevel(gamification);
  const milestone = nextMilestone(gamification);
  const activeBoost = getActiveBoost(gamification);

  const boostMinutes = Math.floor(boostRemaining / 60000);
  const boostSeconds = Math.floor((boostRemaining % 60000) / 1000);

  // Fetch limits for XP packages and premium skins when shop tab opens
  const loadLimits = useCallback(async () => {
    if (!walletAddress) return;
    await Promise.all([
      ...XP_PACKAGES.map(p => getLimit(p.id)),
      ...SKINS.filter(s => s.premium).map(s => getLimit(s.id)),
    ]);
  }, [walletAddress, getLimit]);

  useEffect(() => {
    if (activeTab === 'shop' && walletAddress) {
      loadLimits();
    }
  }, [activeTab, walletAddress, loadLimits]);

  function isProductBusy(productId: string): boolean {
    return purchaseState.status !== "idle" && purchaseState.productId === productId;
  }

  function renderPurchaseStatus(productId: string): React.ReactNode {
    if (purchaseState.productId !== productId || purchaseState.status === "idle") return null;

    const statusConfig: Record<string, { icon: typeof Loader2; text: string; color: string }> = {
      sending_tx: { icon: Loader2, text: t('purchase.sendingTx'), color: "text-amber-400" },
      verifying: { icon: Loader2, text: t('purchase.verifying'), color: "text-cyan-400" },
      confirmed: { icon: Check, text: t('purchase.confirmed'), color: "text-emerald-400" },
      failed: { icon: AlertCircle, text: purchaseState.error ?? t('purchase.failed'), color: "text-red-400" },
      limit_reached: { icon: Lock, text: t('purchase.limitReached'), color: "text-orange-400" },
    };

    const cfg = statusConfig[purchaseState.status];
    if (!cfg) return null;
    const Icon = cfg.icon;
    const spin = purchaseState.status === "sending_tx" || purchaseState.status === "verifying";

    return (
      <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] font-mono ${cfg.color}`}>
        <Icon size={11} className={spin ? "animate-spin" : ""} />
        <span className="truncate max-w-[160px]">{cfg.text}</span>
        {purchaseState.txHash && (purchaseState.status === "confirmed" || purchaseState.status === "failed") && (
          <a
            href={`${BASE_EXPLORER_TX}/${purchaseState.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:underline"
          >
            <ExternalLink size={9} /> {t('purchase.viewTx')}
          </a>
        )}
      </div>
    );
  }

  function renderLimitBadge(productId: string): React.ReactNode {
    const limit = limits[productId];
    if (!limit) return null;

    return (
      <div className="flex items-center gap-1 mt-1 text-[9px] font-mono text-muted-foreground/40">
        <Calendar size={8} />
        <span>{t('purchase.daily')}: {limit.usedToday}/{limit.maxPerDay}</span>
        <span className="mx-0.5">·</span>
        <span>{t('purchase.weekly')}: {limit.usedThisWeek}/{limit.maxPerWeek}</span>
        <span className="mx-0.5">·</span>
        <span>{t('purchase.monthly')}: {limit.usedThisMonth}/{limit.maxPerMonth}</span>
      </div>
    );
  }

  function canBuyProduct(productId: string): boolean {
    const limit = limits[productId];
    if (!limit) return true;
    return limit.canBuyNow;
  }

  return (
    <div className="space-y-4">
      {/* ── Profile Header Card ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
          {/* Avatar */}
          <div style={{ clipPath: "polygon(18% 0, 82% 0, 100% 22%, 100% 78%, 82% 100%, 18% 100%, 0 78%, 0 22%)" }} className={`relative w-20 h-20 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(34,211,238,.10)] ${
            gamification.equippedSkin === 'gold' ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30' :
            gamification.equippedSkin === 'silver' ? 'bg-gradient-to-br from-slate-300/15 to-slate-500/10 border border-slate-300/25' :
            gamification.equippedSkin === 'bronze' ? 'bg-gradient-to-br from-orange-400/15 to-orange-600/10 border border-orange-400/25' :
            gamification.equippedSkin === 'platinum' ? 'bg-gradient-to-br from-cyan-300/15 to-cyan-500/10 border border-cyan-300/25' :
            gamification.equippedSkin === 'premium-500' ? 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 border border-amber-400/40' :
            gamification.equippedSkin === 'premium-1000' ? 'bg-gradient-to-br from-amber-300/30 to-amber-500/20 border border-amber-300/50' :
            'bg-primary/10 border border-primary/20'
          }`}>
            <div className="absolute inset-1 rounded-[inherit] border border-primary/20" />
            <div className="absolute inset-2 rounded-[inherit] opacity-60" style={{ backgroundImage: 'linear-gradient(135deg, transparent 38%, rgba(45,212,191,.12), transparent 70%)' }} />
            <div className="relative flex flex-col items-center gap-0.5">
              <Shield size={25} className="text-primary drop-shadow-[0_0_10px_rgba(34,211,238,.6)]" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-primary">{String(level).padStart(3, '0')}</span>
            </div>
            {gamification.equippedTitle && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-primary/15 border border-primary/25 text-[9px] font-mono text-primary whitespace-nowrap">
                {t(`title.${gamification.equippedTitle}`)}
              </div>
            )}
          </div>

          {/* Level & XP */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground/50">{t('profile.level')}</span>
              <span className="text-2xl font-bold text-foreground">{number(level, 0)}</span>
              <span className="text-xs text-muted-foreground/40">·</span>
              <span className="text-xs font-mono text-muted-foreground/50">{number(gamification.xp, 1)} XP</span>
            </div>

            {/* XP Progress Bar */}
            <div className="relative h-2.5 rounded-full bg-secondary/60 overflow-hidden mb-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${milestone.progress * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_8px_rgba(0,229,188,0.3)]"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
              <span>{number(gamification.xp, 1)} / {number(milestone.xpNeeded, 0)} XP</span>
              <span>{t('profile.nextMilestone')}: {t('profile.level')} {number(milestone.level, 0)}</span>
            </div>
            {/* Existing badges belong to the Profile module, not the Nvult character tab. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[.06] via-transparent to-violet-400/[.04] p-2.5" aria-label="Insígnias do perfil">
              <span className="mr-1 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[.16em] text-muted-foreground/60"><Award size={12} className="text-primary" /> Insígnias</span>
              {BADGES.slice(0, 5).map(badge => {
                const unlocked = gamification.unlockedBadges.includes(badge.id);
                const Icon = BADGE_ICONS[badge.icon] ?? Sparkles;
                return (
                  <div key={badge.id} title={t(`badge.${badge.id}`)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                    unlocked ? 'border-primary/35 bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,229,188,0.08)]' : 'border-border/30 bg-secondary/20 text-muted-foreground/25'
                  }`}>
                    {unlocked ? <Icon size={14} /> : <Lock size={12} />}
                  </div>
                );
              })}
              <button onClick={() => setActiveTab('badges')} className="text-[9px] font-mono text-primary/70 hover:text-primary">
                Ver todas <ChevronRight size={10} className="inline" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-4 border-t border-border/30">
          <div className="px-3 py-2.5 text-center border-r border-border/20">
            <div className="text-sm font-bold text-primary">{number(gamification.totalSwaps, 0)}</div>
            <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">{t('profile.totalSwaps')}</div>
          </div>
          <div className="px-3 py-2.5 text-center border-r border-border/20">
            <div className="text-sm font-bold text-cyan-400">{activeBoost}x</div>
            <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">{t('profile.boost')}</div>
          </div>
          <div className="px-3 py-2.5 text-center border-r border-border/20">
            <div className="text-sm font-bold text-violet-400">{gamification.unlockedBadges.length}</div>
            <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">{t('profile.badges')}</div>
          </div>
          <div className="px-3 py-2.5 text-center">
            <div className="text-sm font-bold text-amber-400">{gamification.unlockedSkins.length}</div>
            <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">{t('profile.skins')}</div>
          </div>
        </div>
      </div>

      {/* ── Boost Banner (when active) ────────────────────────────────────── */}
      {hasBoost && (
        <motion.div
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/30 bg-primary/8 p-3 flex items-center gap-3"
        >
          <ZapIcon size={16} className="text-primary animate-pulse" />
          <div className="flex-1">
            <span className="text-xs font-mono text-primary">{activeBoost}x {t('profile.boostActive')}</span>
            <span className="text-[10px] font-mono text-muted-foreground/50 ml-2">
              {t('profile.xpPerSwap')}: {number(SWAP_XP_BASE * activeBoost, 1)} XP
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-primary">
            <Clock size={13} />
            <span>{String(boostMinutes).padStart(2, '0')}:{String(boostSeconds).padStart(2, '0')}</span>
          </div>
        </motion.div>
      )}

      {/* ── Tab Selector ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 border border-border/30 overflow-x-auto">
        {([
          { key: 'overview',    label: t('profile.tabOverview'),    Icon: TrendingUp },
          { key: 'nvult',       label: 'Nvult',                      Icon: Bot },
          { key: 'badges',      label: t('profile.tabBadges'),       Icon: Award },
          { key: 'skins',       label: t('profile.tabSkins'),       Icon: Shield },
          { key: 'leaderboard', label: t('profile.tabLeaderboard'), Icon: Users },
          { key: 'shop',        label: t('profile.tabShop'),        Icon: ShoppingCart },
        ] as const).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === key ? 'bg-primary/12 text-primary border border-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Season & Event */}
          <div className="rounded-2xl border border-border/40 bg-card/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-violet-400" />
              <h3 className="text-sm font-semibold text-foreground">{t('profile.event')}</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20">
                {t('nav.comingSoon')}
              </span>
            </div>
            <div className="py-6 text-center">
              <Calendar size={28} className="text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] font-mono text-muted-foreground/40">{t('profile.eventSoon')}</p>
            </div>
          </div>

          {/* Equipped items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-card/80 p-3">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 mb-2">{t('profile.equippedSkin')}</div>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${
                  gamification.equippedSkin === 'gold' ? 'bg-amber-400/15 border border-amber-400/30' :
                  gamification.equippedSkin === 'silver' ? 'bg-slate-300/15 border border-slate-300/25' :
                  gamification.equippedSkin === 'bronze' ? 'bg-orange-400/15 border border-orange-400/25' :
                  gamification.equippedSkin === 'platinum' ? 'bg-cyan-300/15 border border-cyan-300/25' :
                  gamification.equippedSkin.startsWith('premium') ? 'bg-amber-400/20 border border-amber-400/40' :
                  'bg-primary/10 border border-primary/20'
                }`} />
                <span className="text-sm text-foreground">{t(`skin.${gamification.equippedSkin}`)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/80 p-3">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 mb-2">{t('profile.equippedTitle')}</div>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-amber-400/70" />
                <span className="text-sm text-foreground">{t(`title.${gamification.equippedTitle ?? 'novice'}`)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Badges & Titles Tab ───────────────────────────────────────────── */}
      {activeTab === 'badges' && (
        <div className="space-y-4">
          {/* Badges */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground/50 mb-2">{t('profile.badgesList')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {BADGES.map(badge => {
                const unlocked = gamification.unlockedBadges.includes(badge.id);
                const Icon = BADGE_ICONS[badge.icon] ?? Sparkles;
                return (
                  <div key={badge.id} className={`rounded-xl border p-3 transition-all ${
                    unlocked ? 'border-primary/25 bg-primary/5' : 'border-border/30 bg-secondary/20 opacity-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        unlocked ? 'bg-primary/15 text-primary' : 'bg-secondary/50 text-muted-foreground/40'
                      }`}>
                        {unlocked ? <Icon size={14} /> : <Lock size={12} />}
                      </div>
                      <span className="text-xs font-medium text-foreground truncate">{t(`badge.${badge.id}`)}</span>
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground/40">
                      {unlocked
                        ? `${t('profile.unlocked')} · +${badge.levelGrant} ${t('profile.levels')}`
                        : `${t('profile.level')} ${badge.levelRequired}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Titles */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground/50 mb-2">{t('profile.titlesList')}</h3>
            <div className="space-y-1.5">
              {TITLES.map(title => {
                const unlocked = gamification.unlockedTitles.includes(title.id);
                const equipped = gamification.equippedTitle === title.id;
                return (
                  <div key={title.id} className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                    equipped ? 'border-primary/30 bg-primary/8' : unlocked ? 'border-border/30 bg-secondary/20' : 'border-border/20 bg-secondary/10 opacity-50'
                  }`}>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                      unlocked ? 'bg-amber-400/15 text-amber-400' : 'bg-secondary/50 text-muted-foreground/40'
                    }`}>
                      {unlocked ? <Star size={12} /> : <Lock size={11} />}
                    </div>
                    <span className="text-xs font-medium text-foreground flex-1">{t(`title.${title.id}`)}</span>
                    {unlocked && title.levelGrant > 0 && (
                      <span className="text-[9px] font-mono text-muted-foreground/40">+{title.levelGrant}</span>
                    )}
                    {equipped ? (
                      <span className="text-[9px] font-mono text-primary">{t('profile.equipped')}</span>
                    ) : unlocked ? (
                      <button onClick={() => onEquipTitle(title.id)}
                        className="text-[9px] font-mono text-primary/60 hover:text-primary transition-colors cursor-pointer">
                        {t('profile.equip')}
                      </button>
                    ) : (
                      <span className="text-[9px] font-mono text-muted-foreground/30">{t('profile.level')} {title.levelRequired}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Skins Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'skins' && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[#081521] via-card to-[#0d1020] p-4 sm:p-5">
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(34,211,238,.12), transparent 35%), radial-gradient(circle at 90% 80%, rgba(139,92,246,.10), transparent 35%)' }} />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[.22em] text-primary/70"><Sparkles size={11} /> Character lab / 02</div>
                <h3 className="text-base font-semibold text-white">Coleção de skins</h3>
                <p className="mt-1 max-w-md text-[10px] leading-relaxed text-slate-400">Personalize sua identidade no Perfil. Cada skin tem uma assinatura visual e pode ser equipada quando desbloqueada.</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[.07] px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-wider text-primary/60">Coleção</div>
                <div className="text-lg font-semibold text-white">{gamification.unlockedSkins.length}<span className="ml-1 text-xs font-normal text-slate-500">/ {SKINS.length}</span></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SKINS.map(skin => {
              const serverOwned = skin.premium ? isSkinOwned(skin.id) : false;
              const unlocked = skin.premium ? serverOwned : gamification.unlockedSkins.includes(skin.id);
              const equipped = gamification.equippedSkin === skin.id;
              const busy = isProductBusy(skin.id);
              const canBuy = canBuyProduct(skin.id);
              const theme = skin.id === 'bronze' ? { edge: '#fb923c', light: 'rgba(251,146,60,.17)', label: 'BRONZE / FORGED' } :
                skin.id === 'silver' ? { edge: '#cbd5e1', light: 'rgba(203,213,225,.17)', label: 'SILVER / TITANIUM' } :
                skin.id === 'gold' ? { edge: '#fbbf24', light: 'rgba(251,191,36,.18)', label: 'GOLD / ASCENSION' } :
                skin.id === 'platinum' ? { edge: '#67e8f9', light: 'rgba(103,232,249,.17)', label: 'PLATINUM / OVERDRIVE' } :
                skin.id === 'premium-500' ? { edge: '#fb7185', light: 'rgba(251,113,133,.18)', label: 'PREMIUM / PHANTOM' } :
                skin.id === 'premium-1000' ? { edge: '#c4b5fd', light: 'rgba(196,181,253,.2)', label: 'PREMIUM / SINGULARITY' } :
                { edge: '#2dd4bf', light: 'rgba(45,212,191,.16)', label: 'GENESIS / STANDARD' };
              return (
                <article key={skin.id} className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${equipped ? 'border-primary/50 bg-primary/[.06] shadow-[0_0_24px_rgba(45,212,191,.08)]' : 'border-border/40 bg-card/70 hover:border-primary/25'}`}>
                  <div className="relative h-32 overflow-hidden border-b border-white/[.06]" style={{ background: 'radial-gradient(ellipse at 50% 70%, ' + theme.light + ', transparent 60%), linear-gradient(135deg, #101827, #050a13)' }}>
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px),linear-gradient(90deg,rgba(148,163,184,.12) 1px,transparent 1px)', backgroundSize: '18px 18px' }} />
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[8px] font-mono tracking-[.16em]" style={{ color: theme.edge }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.edge, boxShadow: '0 0 8px ' + theme.edge }} /> {theme.label}</div>
                    <div className="absolute bottom-[-17px] left-1/2 h-24 w-24 -translate-x-1/2 rounded-[28px] border bg-gradient-to-br from-slate-300/70 via-slate-700 to-slate-950 shadow-[0_0_28px_rgba(0,0,0,.3)]" style={{ borderColor: theme.edge + '99', boxShadow: '0 0 28px ' + theme.light }}>
                      <div className="absolute left-1/2 top-[-18px] h-9 w-9 -translate-x-1/2 rounded-[12px] border border-slate-300/70 bg-gradient-to-br from-slate-200 via-slate-600 to-slate-950" style={{ boxShadow: '0 0 12px ' + theme.light }}>
                        <div className="absolute left-1 right-1 top-3 flex h-2 items-center justify-center gap-1 rounded-sm bg-slate-950"><span className="h-1 w-2 rounded-full" style={{ background: theme.edge, boxShadow: '0 0 6px ' + theme.edge }} /><span className="h-1 w-2 rounded-full" style={{ background: theme.edge, boxShadow: '0 0 6px ' + theme.edge }} /></div>
                      </div>
                      <div className="absolute left-3 right-3 top-7 h-1 rounded-full" style={{ background: theme.edge, boxShadow: '0 0 8px ' + theme.edge }} />
                      <div className="absolute bottom-3 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border" style={{ borderColor: theme.edge, background: theme.light, boxShadow: '0 0 10px ' + theme.edge }} />
                    </div>
                    {skin.premium && <div className="absolute right-3 top-3 rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[8px] font-mono text-amber-200"><Crown size={10} className="mr-1 inline" /> PREMIUM</div>}
                    {equipped && <div className="absolute bottom-3 right-3 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[8px] font-mono text-emerald-200"><Check size={10} className="mr-1 inline" /> ATIVA</div>}
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-foreground">{t(`skin.${skin.id}`)}</h4><p className="mt-1 text-[9px] font-mono text-muted-foreground/50">{skin.premium ? 'PERSONALIZAÇÃO PREMIUM' : 'RECOMPENSA DE PROGRESSÃO'}</p></div><div className="text-right">{!unlocked && skin.premium ? <div className="font-mono text-sm font-semibold text-amber-300">${skin.price}<span className="ml-1 text-[9px] text-muted-foreground/50">{PAYMENT_TOKEN_SYMBOL}</span></div> : !unlocked ? <div className="text-[9px] font-mono text-muted-foreground/50">NÍVEL {skin.levelRequired}</div> : <div className="text-[9px] font-mono text-emerald-300">DESBLOQUEADA</div>}</div></div>
                    <div className="mt-3">
                      {equipped ? <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary"><Check size={12} /> {t('profile.equipped')}</div> :
                       unlocked ? <button onClick={() => onEquipSkin(skin.id)} className="w-full rounded-lg border border-primary/25 bg-primary/[.07] px-3 py-2 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/[.12]">{t('profile.equip')} skin</button> :
                       skin.premium ? <><button onClick={() => onBuySkin(skin.id)} disabled={busy || !walletAddress || !canBuy} className="w-full rounded-lg border border-amber-300/25 bg-amber-300/[.07] px-3 py-2 text-[10px] font-semibold text-amber-200 transition-colors hover:bg-amber-300/[.12] disabled:cursor-not-allowed disabled:opacity-30">{!walletAddress ? t('purchase.connectWallet') : !canBuy ? t('purchase.limitReached') : busy ? t('purchase.processing') : t('profile.buy')}</button>{renderPurchaseStatus(skin.id)}{renderLimitBadge(skin.id)}</> :
                       <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40"><Lock size={11} /> Desbloqueie ao alcançar o nível exigido</div>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Leaderboard Tab ───────────────────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <div className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users size={14} className="text-primary" />
              {t('profile.leaderboard')}
            </h3>
          </div>
          {gamification.xp > 0 ? (
            <div className="divide-y divide-border/20">
              <div className={`flex items-center gap-3 px-4 py-2.5 bg-primary/8`}>
                <div className="w-7 text-center text-sm font-bold text-primary">1</div>
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-primary/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-primary block">{t('profile.you')}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-cyan-400">{number(level, 0)}</div>
                  <div className="text-[9px] font-mono text-muted-foreground/40">{number(gamification.xp, 0)} XP</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <Trophy size={32} className="text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-xs font-mono text-muted-foreground/40">{t('profile.leaderboardEmpty')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Shop Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <div className="space-y-4">
          {/* Wallet status banner */}
          {!walletAddress && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-400 shrink-0" />
              <span className="text-xs text-amber-400/80">{t('purchase.connectWalletFirst')}</span>
            </div>
          )}

          {/* Boost section */}
          <div className="rounded-2xl border border-border/40 bg-card/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ZapIcon size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t('profile.boostMultiplier')}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground/50 mb-3">{t('profile.boostDescription')}</p>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as BoostMultiplier[]).map(m => {
                const isFree = m === 1;
                const isPurchased = isFree || entitlements.some(
                  (e) => e.product_type === 'xp' && e.product_id === `boost-${m}x`,
                );
                return (
                  <button
                    key={m}
                    onClick={() => isPurchased ? onActivateBoost(m) : undefined}
                    disabled={!isPurchased || hasBoost}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      isPurchased
                        ? activeBoost === m && hasBoost
                          ? 'border-primary/30 bg-primary/10 cursor-default'
                          : 'border-border/30 bg-secondary/20 hover:border-primary/20 cursor-pointer'
                        : 'border-border/20 bg-secondary/10 opacity-50 cursor-not-allowed'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className={`text-lg font-bold ${m === 4 ? 'text-amber-400' : 'text-primary'}`}>{m}x</div>
                    <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
                      {number(SWAP_XP_BASE * m, 3)} XP
                    </div>
                    {!isPurchased && (
                      <div className="text-[8px] font-mono text-amber-400/60 mt-1 flex items-center justify-center gap-0.5">
                        <Lock size={7} /> {t('profile.locked')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] font-mono text-muted-foreground/40 text-center">
              {t('profile.boostDuration')}: 15 {t('profile.minutes')}
            </div>
          </div>

          {/* XP Packages */}
          <div className="rounded-2xl border border-border/40 bg-card/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart size={14} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">{t('profile.xpPackages')}</h3>
            </div>
            <div className="space-y-2">
              {XP_PACKAGES.map(pkg => {
                const busy = isProductBusy(pkg.id);
                const canBuy = canBuyProduct(pkg.id);
                return (
                  <div key={pkg.id} className="flex items-center gap-3 rounded-xl border border-border/30 bg-secondary/20 p-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{number(pkg.xp, 0)} XP</div>
                      <div className="text-[10px] font-mono text-muted-foreground/40">{t(`profile.duration.${pkg.duration}`)}</div>
                      {walletAddress && renderLimitBadge(pkg.id)}
                      {renderPurchaseStatus(pkg.id)}
                    </div>
                    <div className="text-sm font-bold text-amber-400 shrink-0">${pkg.price}</div>
                    <button
                      onClick={() => onBuyXp(pkg.id)}
                      disabled={busy || !walletAddress || !canBuy}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/15 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                      {!walletAddress ? t('purchase.connectWallet') :
                       !canBuy ? t('purchase.limitReached') :
                       busy ? t('purchase.processing') :
                       t('profile.buyXP')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Premium Skins */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/3 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={14} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-400">{t('profile.premiumSkins')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SKINS.filter(s => s.premium).map(skin => {
                const owned = isSkinOwned(skin.id);
                const busy = isProductBusy(skin.id);
                const canBuy = canBuyProduct(skin.id);
                return (
                  <div key={skin.id} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                    <div className="h-12 rounded-lg mb-2 bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/25 flex items-center justify-center">
                      <Crown size={16} className="text-amber-400/60" />
                    </div>
                    <div className="text-xs font-medium text-foreground mb-1">{t(`skin.${skin.id}`)}</div>
                    <div className="text-sm font-bold text-amber-400 mb-1.5">${skin.price} {PAYMENT_TOKEN_SYMBOL}</div>
                    {skin.collectorTitle && (
                      <div className="text-[9px] font-mono text-amber-400/60 flex items-center gap-1">
                        <Star size={9} /> {t('profile.collectorTitle')}
                      </div>
                    )}
                    {walletAddress && renderLimitBadge(skin.id)}
                    {owned ? (
                      <div className="mt-2 w-full px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-xs font-medium text-emerald-400 text-center flex items-center justify-center gap-1">
                        <Check size={12} /> {t('purchase.purchased')}
                      </div>
                    ) : (
                      <button
                        onClick={() => onBuySkin(skin.id)}
                        disabled={busy || !walletAddress || !canBuy}
                        className="mt-2 w-full px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/25 text-xs font-medium text-amber-400 hover:bg-amber-400/15 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {!walletAddress ? t('purchase.connectWallet') :
                         !canBuy ? t('purchase.limitReached') :
                         busy ? t('purchase.processing') :
                         t('profile.buy')}
                      </button>
                    )}
                    {renderPurchaseStatus(skin.id)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment info */}
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-3">
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 mb-2">{t('profile.paymentInfo')}</div>
            <div className="space-y-1">
              <div className="text-xs text-foreground">{t('profile.paymentTokens')}: {PAYMENT_TOKEN_SYMBOL}</div>
              <div className="text-[10px] font-mono text-muted-foreground/40">{t('purchase.network')}: {PAYMENT_CHAIN_NAME} (Chain ID: {PAYMENT_CHAIN_ID})</div>
              <div className="text-[10px] font-mono text-muted-foreground/40">{t('profile.paymentWallet')}:</div>
              <div className="text-[10px] font-mono text-cyan-400/70 truncate max-w-[200px] sm:max-w-none">{getServerPaymentWallet() ?? '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nvult prototype: local demo only; no real token or payment is used. */}
      {activeTab === 'nvult' && (
        <NvultPrototype
          equippedSkin={gamification.equippedSkin}
          level={level}
          xp={gamification.xp}
        />
      )}
    </div>
  );
}
