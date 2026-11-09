// ── Collection: showcase of skins, titles and the Nvult parts inventory ──────
import { useState } from 'react';
import { ArrowRight, Check, Crown, Lock, Star } from 'lucide-react';
import { useFormat, useI18n } from '../../i18n';
import { SKINS, TITLES } from '../../lib/gamification';
import { PAYMENT_TOKEN_SYMBOL } from '../../lib/payments';
import { NvultFigure } from '../nvult/NvultFigure';
import { PARTS, RARITY_COLOR, SLOTS, finishFor, partsFor, rarityOf, type Rarity } from '../nvult/catalog';
import { LimitBadge, PurchaseStatusLine, buyLabel, canBuy, isBusy } from '../purchase';
import type { ProfileCtx } from '../types';
import { Meter, Panel, Reveal, Tag } from '../ui';

type Filter = 'all' | 'owned' | 'locked';

/** Skin rarity follows the level that unlocks it; premium (paid) skins are the rarest. */
function skinRarity(id: string, levelRequired: number, premium?: boolean): Rarity {
  if (premium) return 'mythic';
  if (id === 'default') return 'common';
  return rarityOf(levelRequired);
}

export function Collection({ ctx }: { ctx: ProfileCtx }) {
  const { t } = useI18n();
  const { number } = useFormat();
  const { gamification: g, level, accent, nv, go } = ctx;
  const [filter, setFilter] = useState<Filter>('all');
  const wallet = !!ctx.walletAddress;

  const skinUnlocked = (id: string, premium?: boolean) => (premium ? ctx.isSkinOwned(id) : g.unlockedSkins.includes(id));
  const pass = (unlocked: boolean) => filter === 'all' || (filter === 'owned' ? unlocked : !unlocked);

  const skins = SKINS.filter((s) => pass(skinUnlocked(s.id, s.premium)));
  const titles = TITLES.filter((x) => pass(g.unlockedTitles.includes(x.id)));
  const totalParts = PARTS.filter((p) => p.levelRequired > 0).length;
  const openParts = PARTS.filter((p) => p.levelRequired > 0 && level >= p.levelRequired).length;

  return (
    <div className="space-y-4">
      <Reveal i={0} className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={t('pf.nav.collection')} className="flex gap-1 rounded-xl border border-white/[.07] bg-black/25 p-1">
          {(['all', 'owned', 'locked'] as Filter[]).map((f) => (
            <button key={f} data-testid={`filter-${f}`} aria-pressed={filter === f} onClick={() => setFilter(f)}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all"
              style={filter === f ? { background: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}66, 0 0 14px ${accent}22` } : { color: 'rgba(160,170,180,.7)' }}>
              {t(`pf.col.filter.${f}`)}
            </button>
          ))}
        </div>
        <Tag kind="live" />
      </Reveal>

      {/* ── Finishes (skins) on pedestals ─────────────────────────────── */}
      <Reveal i={1}>
        <Panel eyebrow={t('pf.col.finishes')} title={t('pf.col.finishesSub')}>
          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
            {skins.map((skin) => {
              const unlocked = skinUnlocked(skin.id, skin.premium);
              const equipped = g.equippedSkin === skin.id;
              const busy = isBusy(ctx.purchaseState, skin.id);
              const buyable = canBuy(ctx.limits, skin.id);
              const rar = skinRarity(skin.id, skin.levelRequired, skin.premium);
              const rc = RARITY_COLOR[rar];
              const fin = finishFor(skin.id);
              return (
                <article key={skin.id} data-testid={`skin-${skin.id}`} data-rarity={rar}
                  className="group relative overflow-hidden rounded-xl border p-2.5 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: equipped ? `${accent}aa` : `${rc}33`, background: equipped ? `${accent}12` : 'rgba(0,0,0,.2)', boxShadow: equipped ? `0 0 22px ${accent}2a` : undefined }}>
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rc}, transparent)` }} />
                  <div className="relative mx-auto aspect-[360/300] w-full overflow-hidden rounded-lg" style={{ background: `radial-gradient(65% 55% at 50% 42%, ${fin.c1}30, transparent 72%)` }}>
                    <span aria-hidden className="absolute inset-x-6 bottom-1 h-3 rounded-[50%] opacity-70 blur-[2px]" style={{ background: `radial-gradient(closest-side, ${fin.c1}88, transparent)` }} />
                    <NvultFigure loadout={{ ...nv.effective, head: 'crest', armor: 'core', back: 'none', weapon: 'none', aura: 'none' }} skinId={skin.id} level={0} still label={t(`skin.${skin.id}`)} className="relative h-full w-full" />
                    {!unlocked && <div className="absolute inset-0 bg-black/25" />}
                    {!unlocked && <Lock size={14} className="absolute left-1.5 top-1.5 text-white/70" />}
                    {skin.premium && <Crown size={14} className="absolute right-1.5 top-1.5 text-amber-300" />}
                    {equipped && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: accent }}><Check size={12} className="text-black" /></span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium text-foreground">{t(`skin.${skin.id}`)}</span>
                    <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider" style={{ color: rc }}>{t(`pf.rarity.${rar}`)}</span>
                  </div>
                  {equipped ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-mono" style={{ color: accent }}><Check size={11} />{t('profile.equipped')}</div>
                  ) : unlocked ? (
                    <button onClick={() => ctx.onEquipSkin(skin.id)} data-testid={`equip-skin-${skin.id}`}
                      className="mt-1.5 w-full cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/[.06]" style={{ borderColor: `${accent}55`, color: accent }}>{t('profile.equip')}</button>
                  ) : skin.premium ? (
                    <>
                      <div className="mt-0.5 text-[11px] font-mono text-amber-300/90">${skin.price} {PAYMENT_TOKEN_SYMBOL}</div>
                      {skin.collectorTitle && <div className="flex items-center gap-1 text-[9px] font-mono text-amber-300/60"><Star size={9} />{t('profile.collectorTitle')}</div>}
                      {wallet && <LimitBadge limits={ctx.limits} productId={skin.id} />}
                      <button onClick={() => ctx.onBuySkin(skin.id)} disabled={busy || !wallet || !buyable} data-testid={`buy-skin-${skin.id}`}
                        className="mt-1.5 w-full cursor-pointer rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-55">
                        {buyLabel(t, { wallet, canBuy: buyable, busy, idle: t('profile.buy') })}
                      </button>
                      <PurchaseStatusLine state={ctx.purchaseState} productId={skin.id} />
                    </>
                  ) : level >= skin.levelRequired ? (
                    <div className="mt-1 text-[10px] leading-snug text-amber-200/75" data-testid={`skin-pending-${skin.id}`}>{t('pf.col.notGranted')}</div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-muted-foreground/55"><Lock size={10} />{t('profile.level')} {number(skin.levelRequired, 0)}</div>
                  )}
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground/50">{t('pf.col.skinNote')}</p>
        </Panel>
      </Reveal>

      {/* ── Titles ───────────────────────────────────────────────────── */}
      <Reveal i={2}>
        <Panel eyebrow={t('pf.col.titles')}>
          <div className="flex flex-wrap gap-2">
            {titles.map((title) => {
              const unlocked = g.unlockedTitles.includes(title.id);
              const equipped = g.equippedTitle === title.id;
              const rc = RARITY_COLOR[rarityOf(title.levelRequired)];
              return (
                <button key={title.id} data-testid={`title-${title.id}`} disabled={!unlocked || equipped} onClick={() => ctx.onEquipTitle(title.id)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all enabled:hover:-translate-y-0.5 disabled:cursor-default"
                  style={{ borderColor: equipped ? `${accent}aa` : unlocked ? `${rc}55` : 'rgba(255,255,255,.08)', background: equipped ? `${accent}18` : unlocked ? `${rc}0d` : 'transparent', color: unlocked ? undefined : 'rgba(160,170,180,.45)', boxShadow: equipped ? `0 0 14px ${accent}2a` : undefined }}>
                  {equipped ? <Check size={11} style={{ color: accent }} /> : !unlocked ? <Lock size={10} /> : <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: rc }} />}
                  {t(`title.${title.id}`)}
                </button>
              );
            })}
            {titles.length === 0 && <span className="text-xs text-muted-foreground/55">{t('pf.col.empty')}</span>}
          </div>
        </Panel>
      </Reveal>

      {/* ── Nvult inventory ──────────────────────────────────────────── */}
      <Reveal i={3}>
        <Panel eyebrow={t('pf.col.inventory')} right={<><Tag kind="local" /><span className="font-mono text-[11px] text-muted-foreground/60">{t('pf.col.count', { n: openParts, total: totalParts })}</span></>}>
          <Meter value={totalParts ? openParts / totalParts : 0} color={accent} className="mb-3" />
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2">
            {SLOTS.map((slot) => {
              const list = partsFor(slot).filter((p) => p.levelRequired > 0);
              const open = list.filter((p) => level >= p.levelRequired).length;
              return (
                <button key={slot} onClick={() => go('nvult')} className="group cursor-pointer rounded-xl border border-white/[.07] bg-black/15 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.03]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{t(`pf.slot.${slot}`)}</span>
                    <span className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60">{open}/{list.length}<ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" /></span>
                  </span>
                  <Meter value={list.length ? open / list.length : 0} color={accent} className="mt-2" />
                </button>
              );
            })}
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
