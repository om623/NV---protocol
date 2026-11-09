// ── Ranking: only real data is shown ─────────────────────────────────────────
import { Globe2, Trophy } from 'lucide-react';
import { useFormat, useI18n } from '../../i18n';
import { SEASONS, generateLeaderboard } from '../../lib/gamification';
import { NvultFigure } from '../nvult/NvultFigure';
import { seasonInfo } from '../progress';
import type { ProfileCtx } from '../types';
import { Meter, Panel, Reveal, Tag, describeLook } from '../ui';

export function Ranking({ ctx }: { ctx: ProfileCtx }) {
  const { t } = useI18n();
  const { number } = useFormat();
  const { gamification: g, level, accent, nv } = ctx;
  const look = nv.effective;
  const rows = generateLeaderboard(g, look.name);
  const season = seasonInfo(g.seasonXP);
  const total = Math.max(g.xp, 1);

  return (
    <div className="grid gap-4 @2xl:grid-cols-[1fr_minmax(0,290px)]">
      <Reveal i={0}>
        <Panel className="h-full" eyebrow={t('profile.leaderboard')} right={<Tag kind="live" />}>
          {rows.length === 0 ? (
            <div className="py-10 text-center" data-testid="ranking-empty">
              <Trophy size={30} className="mx-auto mb-3 text-muted-foreground/25" />
              <p className="text-xs font-mono text-muted-foreground/55">{t('profile.leaderboardEmpty')}</p>
            </div>
          ) : (
            <ul data-testid="ranking-list">
              {rows.map((r) => (
                <li key={r.rank} className="relative flex items-center gap-4 overflow-hidden rounded-xl border px-4 py-4" style={{ borderColor: `${accent}66`, background: `linear-gradient(120deg, ${accent}1c, rgba(0,0,0,.2))`, boxShadow: `0 0 28px ${accent}1c` }}>
                  <span aria-hidden className="pointer-events-none absolute -left-2 -top-5 select-none text-[88px] font-black leading-none opacity-[.09]" style={{ color: accent }}>{r.rank}</span>
                  <span className="relative w-9 text-center text-3xl font-black" style={{ color: accent, textShadow: `0 0 18px ${accent}aa` }}>{r.rank}</span>
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: `${accent}55`, background: `radial-gradient(circle at 50% 40%, ${accent}33, rgba(0,0,0,.4))` }}>
                    <NvultFigure loadout={look} skinId={g.equippedSkin} level={level} focus="head" still label={describeLook(t, look)} className="h-full w-full" />
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{r.name} <span className="text-[10px] font-normal text-muted-foreground/55">({t('profile.you')})</span></div>
                    {g.equippedTitle && <div className="mt-0.5 text-[10px] font-mono" style={{ color: accent }}>{t(`title.${g.equippedTitle}`)}</div>}
                  </div>
                  <div className="relative text-right">
                    <div className="text-lg font-bold text-foreground">{number(r.level, 0)}</div>
                    <div className="text-[9px] font-mono text-muted-foreground/55">{number(r.xp, 1)} XP</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[.05] p-3">
            <Globe2 size={14} className="mt-0.5 shrink-0 text-amber-300/80" />
            <p className="flex-1 text-[11px] leading-relaxed text-amber-100/70">{t('pf.rank.globalOff')}</p>
            <Tag kind="soon" />
          </div>
        </Panel>
      </Reveal>

      <Reveal i={1}>
        <Panel className="h-full" eyebrow={t('pf.hero.season', { n: season.season.index })}>
          <div className="text-[9px] font-mono uppercase tracking-[.18em] text-muted-foreground/50">{t('pf.hero.seasonXp')}</div>
          <div className="mt-1 text-3xl font-bold text-foreground">{number(season.xp, 1)}</div>
          <Meter value={season.xp / total} color={accent} className="mt-3" />
          <p className="mt-2 text-[11px] text-muted-foreground/60">{t('pf.rank.seasonShare', { n: Math.round((season.xp / total) * 100) })}</p>
        </Panel>
      </Reveal>

      <Reveal i={2} className="@2xl:col-span-2">
        <Panel eyebrow={t('pf.rank.track')} right={<Tag kind="live" />}>
          <ol className="grid grid-cols-6 gap-1.5 @lg:grid-cols-9" data-testid="season-track">
            {SEASONS.map((sn) => {
              const state = sn.index < season.season.index ? 'past' : sn.index === season.season.index ? 'now' : 'future';
              return (
                <li key={sn.id} data-state={state} className="rounded-lg border px-1 py-2 text-center text-[11px] font-mono transition-transform hover:-translate-y-0.5"
                  style={state === 'now' ? { borderColor: accent, background: `${accent}26`, color: accent, boxShadow: `0 0 16px ${accent}44` } : state === 'past' ? { borderColor: 'rgba(255,255,255,.14)', background: 'linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.02))', color: 'rgba(226,232,240,.8)' } : { borderColor: 'rgba(255,255,255,.06)', color: 'rgba(160,170,180,.4)' }}>
                  {sn.index}
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[10px] text-muted-foreground/50">{t('pf.rank.trackNote', { n: SEASONS.length })}</p>
        </Panel>
      </Reveal>
    </div>
  );
}
