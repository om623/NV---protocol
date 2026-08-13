import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Flame, Trophy, Crown, Diamond, Star, Award, ChevronRight, Clock, TrendingUp, ShoppingCart, Check, Lock, Zap as ZapIcon, Users, Calendar, Shield, Sword, Eye, Loader as Loader2, CircleAlert as AlertCircle, ExternalLink } from 'lucide-react';
import { useI18n, useFormat } from '../i18n';
import {
  BASE_LEVEL, SWAP_XP_BASE, BOOST_DURATION_MS, PAYMENT_WALLET,
  BADGES, TITLES, SKINS, XP_PACKAGES, SEASONS, EVENT_TOTAL_MONTHS,
  computeLevel, nextMilestone, getActiveBoost, getCurrentSeason,
  generateLeaderboard, type GamificationState, type BoostMultiplier,
} from '../lib/gamification';
import {
  PAYMENT_CHAIN_NAME, PAYMENT_TOKEN_SYMBOL, PAYMENT_CHAIN_ID,
  type PurchaseState, type LimitStatus,
} from '../lib/payments';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'skins' | 'leaderboard' | 'shop'>('overview');

  const level = computeLevel(gamification);
  const milestone = nextMilestone(gamification);
  const activeBoost = getActiveBoost(gamification);
  const currentSeason = getCurrentSeason();
  const leaderboard = useMemo(() => generateLeaderboard(gamification, t('profile.you')), [gamification, t]);

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

  // Season progress
  const seasonStartMonth = currentSeason.startMonth;
  const seasonEndMonth = seasonStartMonth + currentSeason.durationMonths;
  const eventStart = new Date(2025, 0, 1);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - eventStart.getFullYear()) * 12 + (now.getMonth() - eventStart.getMonth());

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
            href={`${'https://testnet.arcscan.app'}/tx/${purchaseState.txHash}`}
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
          <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 ${
            gamification.equippedSkin === 'gold' ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30' :
            gamification.equippedSkin === 'silver' ? 'bg-gradient-to-br from-slate-300/15 to-slate-500/10 border border-slate-300/25' :
            gamification.equippedSkin === 'bronze' ? 'bg-gradient-to-br from-orange-400/15 to-orange-600/10 border border-orange-400/25' :
            gamification.equippedSkin === 'platinum' ? 'bg-gradient-to-br from-cyan-300/15 to-cyan-500/10 border border-cyan-300/25' :
            gamification.equippedSkin === 'premium-500' ? 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 border border-amber-400/40' :
            gamification.equippedSkin === 'premium-1000' ? 'bg-gradient-to-br from-amber-300/30 to-amber-500/20 border border-amber-300/50' :
            'bg-primary/10 border border-primary/20'
          }`}>
            <span className="text-2xl font-bold text-primary">{level >= 1000 ? '' : ''}{level >= 2000 ? '' : ''}</span>
            <Shield size={32} className="text-primary/80" />
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
          { key: 'badges',      label: t('profile.tabBadges'),      Icon: Award },
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
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-violet-400/10 text-violet-400 border border-violet-400/20">
                {t('profile.season')} {currentSeason.index}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/20">
                <div className="text-sm font-bold text-violet-400">{currentSeason.index}/{SEASONS.length}</div>
                <div className="text-[9px] font-mono text-muted-foreground/40 uppercase">{t('profile.seasonCount')}</div>
              </div>
              <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/20">
                <div className="text-sm font-bold text-cyan-400">{number(gamification.seasonXP, 1)}</div>
                <div className="text-[9px] font-mono text-muted-foreground/40 uppercase">{t('profile.seasonXP')}</div>
              </div>
              <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/20">
                <div className="text-sm font-bold text-amber-400">{EVENT_TOTAL_MONTHS}</div>
                <div className="text-[9px] font-mono text-muted-foreground/40 uppercase">{t('profile.eventMonths')}</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] font-mono text-muted-foreground/40 text-center">
              {t('profile.month')}: {monthsElapsed + 1} / {EVENT_TOTAL_MONTHS}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SKINS.map(skin => {
            const serverOwned = skin.premium ? isSkinOwned(skin.id) : false;
            const unlocked = gamification.unlockedSkins.includes(skin.id);
            const equipped = gamification.equippedSkin === skin.id;
            const busy = isProductBusy(skin.id);
            const canBuy = canBuyProduct(skin.id);
            return (
              <div key={skin.id} className={`rounded-xl border p-3 transition-all relative overflow-hidden ${
                equipped ? 'border-primary/30 bg-primary/8' : unlocked ? 'border-border/30 bg-secondary/20' : 'border-border/20 bg-secondary/10'
              }`}>
                {/* Skin preview gradient */}
                <div className={`h-12 rounded-lg mb-2 ${
                  skin.id === 'default' ? 'bg-primary/10 border border-primary/20' :
                  skin.id === 'bronze' ? 'bg-gradient-to-br from-orange-400/20 to-orange-600/10 border border-orange-400/25' :
                  skin.id === 'silver' ? 'bg-gradient-to-br from-slate-300/20 to-slate-500/10 border border-slate-300/25' :
                  skin.id === 'gold' ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/25' :
                  skin.id === 'platinum' ? 'bg-gradient-to-br from-cyan-300/20 to-cyan-500/10 border border-cyan-300/25' :
                  skin.id === 'premium-500' ? 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 border border-amber-400/35' :
                  skin.id === 'premium-1000' ? 'bg-gradient-to-br from-amber-300/30 to-amber-500/20 border border-amber-300/45' :
                  'bg-secondary/40'
                }`}>
                  <div className="w-full h-full flex items-center justify-center">
                    {skin.premium && <Crown size={16} className="text-amber-400/60" />}
                  </div>
                </div>
                <div className="text-xs font-medium text-foreground mb-1">{t(`skin.${skin.id}`)}</div>
                {!unlocked && skin.premium && (
                  <div className="text-[10px] font-mono text-amber-400/70 mb-1.5">${skin.price} {PAYMENT_TOKEN_SYMBOL}</div>
                )}
                {!unlocked && !skin.premium && (
                  <div className="text-[9px] font-mono text-muted-foreground/40">{t('profile.level')} {skin.levelRequired}</div>
                )}
                {equipped ? (
                  <div className="text-[9px] font-mono text-primary flex items-center gap-1">
                    <Check size={10} /> {t('profile.equipped')}
                  </div>
                ) : unlocked ? (
                  <button onClick={() => onEquipSkin(skin.id)}
                    className="text-[9px] font-mono text-primary/60 hover:text-primary transition-colors cursor-pointer">
                    {t('profile.equip')}
                  </button>
                ) : skin.premium ? (
                  <>
                    <button
                      onClick={() => onBuySkin(skin.id)}
                      disabled={busy || !walletAddress || !canBuy}
                      className="text-[9px] font-mono text-amber-400/70 hover:text-amber-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {!walletAddress ? t('purchase.connectWallet') :
                       !canBuy ? t('purchase.limitReached') :
                       busy ? t('purchase.processing') :
                       t('profile.buy')}
                    </button>
                    {renderPurchaseStatus(skin.id)}
                  </>
                ) : (
                  <div className="text-[9px] font-mono text-muted-foreground/30 flex items-center gap-1">
                    <Lock size={9} /> {t('profile.locked')}
                  </div>
                )}
              </div>
            );
          })}
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
          <div className="divide-y divide-border/20">
            {leaderboard.map((entry, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                entry.isCurrentUser ? 'bg-primary/8' : 'hover:bg-secondary/30'
              }`}>
                <div className={`w-7 text-center text-sm font-bold ${
                  entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-slate-300' :
                  entry.rank === 3 ? 'text-orange-400' : 'text-muted-foreground/50'
                }`}>
                  {entry.rank}
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-primary/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium truncate block ${entry.isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                    {entry.name}
                  </span>
                  {entry.title && (
                    <span className="text-[9px] font-mono text-muted-foreground/40">{t(`title.${entry.title}`)}</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-cyan-400">{number(entry.level, 0)}</div>
                  <div className="text-[9px] font-mono text-muted-foreground/40">{number(entry.xp, 0)} XP</div>
                </div>
              </div>
            ))}
          </div>
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
              {([1, 2, 3, 4] as BoostMultiplier[]).map(m => (
                <button key={m} onClick={() => onActivateBoost(m)}
                  disabled={hasBoost}
                  className={`rounded-xl border p-3 text-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    activeBoost === m && hasBoost ? 'border-primary/30 bg-primary/10' : 'border-border/30 bg-secondary/20 hover:border-primary/20'
                  }`}>
                  <div className={`text-lg font-bold ${m === 4 ? 'text-amber-400' : 'text-primary'}`}>{m}x</div>
                  <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
                    {number(SWAP_XP_BASE * m, 1)} XP
                  </div>
                </button>
              ))}
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
              <div className="text-[10px] font-mono text-cyan-400/70 truncate max-w-[200px] sm:max-w-none">{PAYMENT_WALLET}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
