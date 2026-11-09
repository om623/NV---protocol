// ── Identity: who you are in NV. The Nvult is the centrepiece ────────────────
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Flame, Shield, Sparkles, Zap } from 'lucide-react';
import { useFormat, useI18n } from '../../i18n';
import { SWAP_XP_BASE, nextMilestone } from '../../lib/gamification';
import { RARITY_COLOR, SLOTS, finishFor, rarityOf } from '../nvult/catalog';
import { NvultStage } from '../nvult/NvultStage';
import { Nvult3D } from '../nvult3d/Nvult3D';
import type { RenderMode } from '../nvult3d/support';
import { buildMilestones, seasonInfo, statusOf, tierInfo } from '../progress';
import type { ProfileCtx } from '../types';
import { Insignia, Meter, Panel, Reveal, Ring, Stat, Tag, describeLook, shortAddr } from '../ui';

const MILESTONES = buildMilestones();

export function Identity({ ctx }: { ctx: ProfileCtx }) {
  const { t } = useI18n();
  const { number } = useFormat();
  const { gamification: g, level, accent, nv, go } = ctx;
  const look = nv.effective;
  const tier = tierInfo(level);
  const next = nextMilestone(g);
  const season = seasonInfo(g.seasonXP);
  const fin = finishFor(g.equippedSkin);
  const statuses = statusOf(MILESTONES, level);
  const upcoming = MILESTONES.filter((_, i) => statuses[i] !== 'reached').slice(0, 3);
  const xpToGo = Math.max(0, next.xpNeeded - g.xp);
  const mm = String(Math.floor(ctx.boostRemaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((ctx.boostRemaining % 60000) / 1000)).padStart(2, '0');
  const [mode, setMode] = useState<RenderMode>('2d');
  const sig = `${g.equippedSkin}|${look.head}|${look.armor}|${look.back}|${look.weapon}|${look.aura}|${look.accent}|${look.style}`;

  return (
    <div className="grid gap-4 @2xl:grid-cols-[minmax(0,310px)_1fr]">
      {/* ── Stage: the character ─────────────────────────────────────── */}
      <Reveal i={0} className="@2xl:row-span-2">
        <Panel className="h-full" eyebrow="NV / NVULT" title={look.name} right={<Tag kind="local" />}>
          <NvultStage accent={accent} changeKey={sig} scene3d={mode === '3d'} className="aspect-[4/5] w-full">
            <Nvult3D look={look} skinId={g.equippedSkin} level={level} label={describeLook(t, look, t(`pf.tier.${tier.index}`))} onMode={setMode} className="h-full w-full" />
          </NvultStage>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-mono uppercase tracking-[.2em] text-muted-foreground/50">{t('pf.hero.tier')}</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}><Sparkles size={13} />{t(`pf.tier.${tier.index}`)}</div>
            </div>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="h-1.5 w-3 rounded-full" style={{ background: i <= tier.index ? accent : 'rgba(255,255,255,.1)', boxShadow: i <= tier.index ? `0 0 6px ${accent}88` : undefined }} />
              ))}
            </div>
          </div>
          <button onClick={() => go('nvult')} data-testid="customize-cta"
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all hover:-translate-y-0.5 hover:bg-white/[.05]"
            style={{ borderColor: `${accent}66`, color: accent, boxShadow: `0 0 18px ${accent}18` }}>
            {t('pf.hero.customize')} <ArrowRight size={13} />
          </button>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[.05] pt-3">
            {SLOTS.filter((s) => look[s] !== 'none').map((s) => (
              <span key={s} className="rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground/75" style={{ borderColor: `${RARITY_COLOR[rarityOf(partLevel(s, look[s]))]}44` }}>
                {t(`pf.slot.${s}`)}: {t(`pf.part.${s}.${look[s]}`)}
              </span>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* ── Identity + progression ───────────────────────────────────── */}
      <Reveal i={1}>
        <Panel className="h-full" eyebrow={t('pf.hero.eyebrow')} right={<Tag kind="live" />}>
          <div className="flex flex-wrap items-center gap-4">
            <Insignia accent={accent} level={level} size={60} label={t('pf.hero.insignia')} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-foreground">{look.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {g.equippedTitle && (
                  <span className="rounded-md border px-2 py-0.5 text-[10px] font-mono" style={{ borderColor: `${accent}55`, color: accent, background: `${accent}14` }}>{t(`title.${g.equippedTitle}`)}</span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground/55">{ctx.walletAddress ? shortAddr(ctx.walletAddress) : t('pf.hero.noWallet')}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5">
            <Ring value={next.progress} color={accent} size={132}>
              <div className="text-[9px] font-mono uppercase tracking-[.2em] text-muted-foreground/50">{t('profile.level')}</div>
              <div className="text-2xl font-bold leading-none text-foreground" data-testid="level-value">{number(level, 0)}</div>
              <div className="mt-1 text-[10px] font-mono text-muted-foreground/55">{number(g.xp, 1)} XP</div>
            </Ring>
            <div className="min-w-[180px] flex-1">
              <div className="text-[10px] font-mono uppercase tracking-[.16em] text-muted-foreground/50">{t('profile.nextMilestone')}</div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">{t('profile.level')} {number(next.level, 0)}</div>
              <Meter value={next.progress} color={accent} className="mt-2" />
              <div className="mt-1.5 text-[11px] text-muted-foreground/60">{t('pf.hero.xpToGo', { n: number(xpToGo, 1) })}</div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 @lg:grid-cols-4">
            <Stat accent={accent} icon={<Zap size={10} />} label={t('profile.totalSwaps')} value={number(g.totalSwaps, 0)} />
            <Stat accent={accent} icon={<Flame size={10} />} label={t('profile.boost')} value={`${ctx.activeBoost}x`} />
            <Stat accent={accent} icon={<Shield size={10} />} label={t('profile.badges')} value={`${g.unlockedBadges.length}`} />
            <Stat accent={accent} icon={<Sparkles size={10} />} label={t('pf.hero.seasonXp')} value={number(season.xp, 1)} />
          </dl>

          {ctx.hasBoost && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: `${accent}55`, background: `${accent}10` }}>
              <Zap size={14} className="animate-pulse" style={{ color: accent }} />
              <span className="flex-1 text-xs font-mono" style={{ color: accent }}>{ctx.activeBoost}x {t('profile.boostActive')} · {t('profile.xpPerSwap')}: {number(SWAP_XP_BASE * ctx.activeBoost, 1)} XP</span>
              <span className="flex items-center gap-1 text-xs font-mono" style={{ color: accent }}><Clock size={12} />{mm}:{ss}</span>
            </motion.div>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[.07] bg-black/20 p-3">
            <div className="h-9 w-9 shrink-0 rounded-lg border border-white/15" style={{ background: `linear-gradient(135deg, ${fin.c0}, ${fin.c1} 40%, ${fin.c2} 75%, ${fin.c3})` }} />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-mono uppercase tracking-[.18em] text-muted-foreground/50">{t('pf.lab.finish')}</div>
              <div className="truncate text-sm font-medium text-foreground">{t(`skin.${g.equippedSkin}`)}</div>
            </div>
            <button onClick={() => go('collection')} className="shrink-0 cursor-pointer rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">{t('pf.nav.collection')}</button>
          </div>
        </Panel>
      </Reveal>

      {/* ── Next unlocks ─────────────────────────────────────────────── */}
      <Reveal i={2}>
        <Panel eyebrow={t('pf.hero.nextUnlocks')} right={<span className="text-[10px] font-mono text-muted-foreground/50">{t('pf.hero.season', { n: season.season.index })}</span>}>
          <ul className="space-y-2">
            {upcoming.length === 0 && <li className="text-xs text-muted-foreground/60">{t('pf.ev.allReached')}</li>}
            {upcoming.map((m) => (
              <li key={m.level} className="rounded-xl border border-white/[.07] bg-black/15 px-3 py-2">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-14 shrink-0 text-xs font-mono font-semibold" style={{ color: accent }}>{number(m.level, 0)}</span>
                  <span className="flex flex-wrap gap-1.5 text-[11px] text-foreground/85">
                    {m.badges.map((b) => <span key={b.id} className="rounded bg-white/[.06] px-1.5 py-0.5">{t(`badge.${b.id}`)}</span>)}
                    {m.titles.map((x) => <span key={x.id} className="rounded bg-white/[.06] px-1.5 py-0.5">{t(`title.${x.id}`)}</span>)}
                    {m.parts.map((p) => {
                      const c = RARITY_COLOR[rarityOf(p.levelRequired)];
                      return <span key={`${p.slot}-${p.id}`} className="rounded border px-1.5 py-0.5" style={{ background: `${c}14`, color: c, borderColor: `${c}44` }}>{t(`pf.part.${p.slot}.${p.id}`)}</span>;
                    })}
                  </span>
                </div>
                <Meter value={level / m.level} color={accent} className="mt-2" />
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>
    </div>
  );
}

/** Level that unlocks a part (0 for free parts), used only to colour the chip by rarity. */
function partLevel(slot: string, id: string): number {
  for (const m of MILESTONES) for (const p of m.parts) if (p.slot === slot && p.id === id) return p.levelRequired;
  return 0;
}
