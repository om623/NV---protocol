// ── Shop: REAL on-chain purchases (same flow and rules as before) ─────────────
import { useEffect } from 'react';
import { Check, CircleAlert as AlertCircle, Crown, Lock, ShoppingCart, Star } from 'lucide-react';
import { useFormat, useI18n } from '../../i18n';
import { SKINS, SWAP_XP_BASE, XP_PACKAGES, type BoostMultiplier } from '../../lib/gamification';
import { PAYMENT_CHAIN_ID, PAYMENT_CHAIN_NAME, PAYMENT_TOKEN_SYMBOL, getServerPaymentWallet } from '../../lib/payments';
import { RARITY_COLOR, finishFor } from '../nvult/catalog';
import { NvultFigure } from '../nvult/NvultFigure';
import { LimitBadge, PurchaseStatusLine, buyLabel, canBuy, isBusy } from '../purchase';
import type { ProfileCtx } from '../types';
import { Panel, Reveal, Tag } from '../ui';

export function Shop({ ctx }: { ctx: ProfileCtx }) {
  const { t } = useI18n();
  const { number } = useFormat();
  const { gamification: g, level, accent, nv, getLimit } = ctx;
  const wallet = !!ctx.walletAddress;

  // Same behaviour as the previous screen: load limits when the shop opens with a wallet.
  useEffect(() => {
    if (!ctx.walletAddress) return;
    void Promise.all([...XP_PACKAGES.map((p) => getLimit(p.id)), ...SKINS.filter((s) => s.premium).map((s) => getLimit(s.id))]);
  }, [ctx.walletAddress, getLimit]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.05] px-3 py-2">
        <Tag kind="live" />
        <span className="text-[11px] text-emerald-100/75">{t('pf.shop.live')}</span>
      </div>

      {!wallet && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <AlertCircle size={14} className="shrink-0 text-amber-400" />
          <span className="text-xs text-amber-400/80">{t('purchase.connectWalletFirst')}</span>
        </div>
      )}

      {/* ── Boost ─────────────────────────────────────────────────── */}
      <Reveal i={1}><Panel eyebrow={t('profile.boostMultiplier')}>
        <p className="mb-3 text-[11px] text-muted-foreground/60">{t('profile.boostDescription')}</p>
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as BoostMultiplier[]).map((m) => {
            const owned = m === 1 || ctx.entitlements.some((e) => e.product_type === 'xp' && e.product_id === `boost-${m}x`);
            const active = ctx.activeBoost === m && ctx.hasBoost;
            return (
              <button key={m} data-testid={`boost-${m}`} onClick={() => (owned ? ctx.onActivateBoost(m) : undefined)} disabled={!owned || ctx.hasBoost}
                className="rounded-xl border p-3 text-center transition-all disabled:cursor-not-allowed"
                style={{ borderColor: active ? `${accent}99` : owned ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.06)', background: active ? `${accent}14` : 'rgba(0,0,0,.18)', opacity: owned ? 1 : 0.5, cursor: owned && !ctx.hasBoost ? 'pointer' : undefined }}>
                <div className="text-lg font-bold" style={{ color: m === 4 ? '#fbbf24' : accent }}>{m}x</div>
                <div className="mt-0.5 text-[9px] font-mono text-muted-foreground/50">{number(SWAP_XP_BASE * m, 3)} XP</div>
                {!owned && <div className="mt-1 flex items-center justify-center gap-0.5 text-[8px] font-mono text-amber-400/70"><Lock size={7} />{t('profile.locked')}</div>}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-center text-[10px] font-mono text-muted-foreground/45">{t('profile.boostDuration')}: 15 {t('profile.minutes')}</div>
      </Panel></Reveal>

      {/* ── XP packages ───────────────────────────────────────────── */}
      <Reveal i={2}><Panel eyebrow={t('profile.xpPackages')} right={<ShoppingCart size={14} className="text-amber-300" />}>
        <div className="space-y-2">
          {XP_PACKAGES.map((pkg) => {
            const busy = isBusy(ctx.purchaseState, pkg.id);
            const buyable = canBuy(ctx.limits, pkg.id);
            return (
              <div key={pkg.id} data-testid={`pack-${pkg.id}`} className="flex items-center gap-3 rounded-xl border border-white/[.08] p-3 transition-all hover:-translate-y-0.5 hover:border-white/20" style={{ background: `linear-gradient(120deg, ${accent}10, rgba(0,0,0,.22))` }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold" style={{ borderColor: `${accent}55`, color: accent, background: `${accent}14`, boxShadow: `0 0 14px ${accent}22` }}>XP</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{number(pkg.xp, 0)} XP</div>
                  <div className="text-[10px] font-mono text-muted-foreground/50">{t(`profile.duration.${pkg.duration}`)}</div>
                  {wallet && <LimitBadge limits={ctx.limits} productId={pkg.id} />}
                  <PurchaseStatusLine state={ctx.purchaseState} productId={pkg.id} />
                </div>
                <div className="shrink-0 text-sm font-bold text-amber-300">${pkg.price}</div>
                <button onClick={() => ctx.onBuyXp(pkg.id)} disabled={busy || !wallet || !buyable} data-testid={`buy-${pkg.id}`}
                  className="shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/[.05] disabled:cursor-not-allowed disabled:opacity-55" style={{ borderColor: `${accent}55`, color: accent }}>
                  {buyLabel(t, { wallet, canBuy: buyable, busy, idle: t('profile.buyXP') })}
                </button>
              </div>
            );
          })}
        </div>
      </Panel></Reveal>

      {/* ── Premium skins ─────────────────────────────────────────── */}
      <Reveal i={3}><Panel eyebrow={t('profile.premiumSkins')} right={<Crown size={14} className="text-amber-300" />}>
        <div className="grid grid-cols-2 gap-3">
          {SKINS.filter((s) => s.premium).map((skin) => {
            const owned = ctx.isSkinOwned(skin.id);
            const busy = isBusy(ctx.purchaseState, skin.id);
            const buyable = canBuy(ctx.limits, skin.id);
            return (
              <div key={skin.id} data-testid={`shop-skin-${skin.id}`} className="relative overflow-hidden rounded-xl border p-2.5 transition-all hover:-translate-y-0.5" style={{ borderColor: `${RARITY_COLOR.mythic}44`, background: 'linear-gradient(160deg, rgba(251,191,36,.07), rgba(0,0,0,.25))' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${RARITY_COLOR.mythic}, transparent)` }} />
                <div className="relative mx-auto aspect-[360/300] w-full overflow-hidden rounded-lg" style={{ background: `radial-gradient(65% 55% at 50% 42%, ${finishFor(skin.id).c1}30, transparent 72%)` }}>
                  <NvultFigure loadout={{ ...nv.effective, head: 'crest', armor: 'core', back: 'none', weapon: 'none', aura: 'none' }} skinId={skin.id} level={level} still label={t(`skin.${skin.id}`)} className="h-full w-full" />
                </div>
                <div className="text-xs font-medium text-foreground">{t(`skin.${skin.id}`)}</div>
                <div className="text-sm font-bold text-amber-300">${skin.price} {PAYMENT_TOKEN_SYMBOL}</div>
                {skin.collectorTitle && <div className="flex items-center gap-1 text-[9px] font-mono text-amber-300/60"><Star size={9} />{t('profile.collectorTitle')}</div>}
                {wallet && <LimitBadge limits={ctx.limits} productId={skin.id} />}
                {owned ? (
                  <div className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300"><Check size={12} />{t('purchase.purchased')}</div>
                ) : (
                  <button onClick={() => ctx.onBuySkin(skin.id)} disabled={busy || !wallet || !buyable} data-testid={`shop-buy-skin-${skin.id}`}
                    className="mt-2 w-full cursor-pointer rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-55">
                    {buyLabel(t, { wallet, canBuy: buyable, busy, idle: t('profile.buy') })}
                  </button>
                )}
                <PurchaseStatusLine state={ctx.purchaseState} productId={skin.id} />
              </div>
            );
          })}
        </div>
      </Panel></Reveal>

      <div className="rounded-xl border border-white/[.07] bg-black/20 p-3">
        <div className="mb-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">{t('profile.paymentInfo')}</div>
        <div className="space-y-1">
          <div className="text-xs text-foreground">{t('profile.paymentTokens')}: {PAYMENT_TOKEN_SYMBOL}</div>
          <div className="text-[10px] font-mono text-muted-foreground/45">{t('purchase.network')}: {PAYMENT_CHAIN_NAME} (Chain ID: {PAYMENT_CHAIN_ID})</div>
          <div className="text-[10px] font-mono text-muted-foreground/45">{t('profile.paymentWallet')}:</div>
          <div className="max-w-[220px] truncate font-mono text-[10px] text-cyan-300/75 sm:max-w-none">{getServerPaymentWallet() ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
