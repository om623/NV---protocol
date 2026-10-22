import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Flame, Trophy, Crown, Diamond, Star, Award, ChevronRight, Clock, TrendingUp, ShoppingCart, Check, Lock, Zap as ZapIcon, Users, Calendar, Shield, Sword, Eye, Loader as Loader2, CircleAlert as AlertCircle, ExternalLink } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'skins' | 'leaderboard' | 'shop'>('overview');

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
          <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 ${
            gamification.equippedSkin === 'gold' ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30' :
            gamification.equippedSkin === 'silver' ? 'bg-gradient-to-br from-slate-300/15 to-slate-500/10 border border-slate-300/25' :
            gamification.equippedSkin === 'bronze' ? 'bg-gradient-to-br from-orange-400/15 to-orange-600/10 border border-orange-400/25' :
            gamification.equippedSkin === 'platinum' ? 'bg-gradient-to-br from-cyan-300/15 to-cyan-500/10 border border-cyan-300/25' :
            gamification.equippedSkin === 'premium-500' ? 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 border border-amber-400/40' :
            gamification.equippedSkin === 'premium-1000' ? 'bg-gradient-to-br from-amber-300/30 to-amber-500/20 border border-amber-300/50' :
            'bg-primary/10 border border-primary/20'
          }`}>
            <motion.div
              aria-label={`NV avatar level ${Math.min(1000, level)}`}
              animate={{ y: [0, -3, 0], rotate: [-1, 1, -1], scale: level >= 1000 ? [1, 1.06, 1] : [1, 1.025, 1] }}
              transition={{ duration: level >= 500 ? 2.2 : 3.4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative flex h-14 w-14 items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: level >= 500 ? 12 : 24, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-primary/50 border-t-cyan-300 shadow-[0_0_18px_rgba(0,229,188,0.22)]"
              />
              <svg viewBox="0 0 64 64" className="h-12 w-12 drop-shadow-[0_0_8px_rgba(0,229,188,0.45)]" role="img" aria-label="NV Core avatar">
                <defs>
                  <linearGradient id="nv-core-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={level >= 1000 ? '#f5d76e' : level >= 500 ? '#9d8cff' : '#00e5bc'} />
                    <stop offset="100%" stopColor="#19a7ff" />
                  </linearGradient>
                </defs>
                <path d="M32 4 53 16v24L32 60 11 40V16Z" fill="#07181c" stroke="url(#nv-core-gradient)" strokeWidth="2.4" />
                <path d="M20 22h8l8 20h-8Zm16 0h8L36 42h-8Z" fill="url(#nv-core-gradient)" opacity=".95" />
                <circle cx="32" cy="32" r="5" fill="#eafffb" />
              </svg>
              <motion.span
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="absolute -bottom-1 rounded-full border border-primary/40 bg-[#061316] px-1.5 py-0.5 text-[8px] font-mono font-bold text-primary"
              >LVL {Math.min(1000, level)}</motion.span>
            </motion.div>
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
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-400/10 text-emerald-300 border border-emerald-300/25">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                {({ 'pt-BR': 'TEMPORADA ABERTA', en: 'SEASON OPEN', es: 'TEMPORADA ABIERTA', fr: 'SAISON OUVERTE', zh: '赛季开放', ja: 'シーズン開催中', ko: '시즌 오픈', hi: 'सीज़न खुला है', ar: 'الموسم مفتوح' } as Record<string, string>)[(t('profile.level') && (typeof window !== 'undefined' ? localStorage.getItem('nv-locale') : null)) || 'pt-BR'] || 'SEASON OPEN'}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-[#08191d] to-cyan-500/5 p-4">
              <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full border border-primary/15" />
              <div className="relative flex items-center gap-4">
                <motion.div animate={{ rotate: [0, 6, -6, 0], y: [0, -3, 0] }} transition={{ duration: 4, repeat: Infinity }} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-[#061316] shadow-[0_0_22px_rgba(0,229,188,0.12)]">
                  <Sparkles size={25} className="text-primary" />
                </motion.div>
                <div className="min-w-0">
                  <div className="text-lg font-bold tracking-wide text-foreground">NV · Season 0</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{({ 'pt-BR': 'Temporada inaugural aberta. Acumule XP, desbloqueie badges e evolua seu NV Core do nível 1 ao 1000.', en: 'Genesis season is open. Earn XP, unlock badges and evolve your NV Core from level 1 to 1000.', es: 'La temporada inaugural está abierta. Gana XP, desbloquea insignias y evoluciona tu NV Core del nivel 1 al 1000.', fr: 'La saison inaugurale est ouverte. Gagnez de l’XP, débloquez des badges et faites évoluer votre NV Core du niveau 1 à 1000.', zh: '创世赛季已开放。获取 XP、解锁徽章，让 NV Core 从 1 级进化到 1000 级。', ja: 'ジェネシスシーズン開催中。XPを獲得し、バッジを解除してNV Coreをレベル1から1000へ進化させよう。', ko: '시즌 0이 열렸습니다. XP를 모으고 배지를 잠금 해제하며 NV Core를 1레벨에서 1000레벨까지 진화시키세요.', hi: 'पहला सीज़न खुला है। XP कमाएँ, बैज अनलॉक करें और NV Core को लेवल 1 से 1000 तक विकसित करें।', ar: 'الموسم التأسيسي مفتوح. اجمع XP وافتح الشارات وطوّر NV Core من المستوى 1 إلى 1000.' } as Record<string, string>)[(typeof window !== 'undefined' ? localStorage.getItem('nv-locale') : null) || 'pt-BR'] || 'Season 0 is open.'}</p>
                </div>
              </div>
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
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`group relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 ${
                      unlocked
                        ? 'border-primary/45 bg-gradient-to-br from-primary/15 via-[#0b1b20] to-cyan-500/10 shadow-[0_0_18px_rgba(0,229,188,0.08)]'
                        : 'border-white/10 bg-[#071014]/70 opacity-65'
                    }`}
                  >
                    <div className="absolute -right-4 -top-5 h-16 w-16 rounded-full border border-primary/15 transition-transform duration-500 group-hover:scale-125" />
                    <div className="relative flex items-center gap-2 mb-2">
                      <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        unlocked ? 'border-primary/40 bg-primary/15 text-primary shadow-[0_0_12px_rgba(0,229,188,0.12)]' : 'border-white/10 bg-white/5 text-muted-foreground/40'
                      }`}>
                        {unlocked ? <Icon size={18} /> : <Lock size={14} />}
                        {unlocked && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-[#061316] bg-cyan-300" />}
                      </div>
                      <span className="min-w-0 text-xs font-semibold tracking-wide text-foreground">{t(`badge.${badge.id}`)}</span>
                    </div>
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-primary/75">NV CORE · ${String(badge.levelRequired).padStart(3, '0')}</span>
                      <span className={`text-[9px] font-mono ${unlocked ? 'text-emerald-300' : 'text-muted-foreground/45'}`}>
                        {unlocked ? 'UNLOCKED' : `LVL ${badge.levelRequired}`}
                      </span>
                    </div>
                  </motion.div>
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
            const unlocked = skin.premium ? serverOwned : gamification.unlockedSkins.includes(skin.id);
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
    </div>
  );
}
