// ── Achievements & evolution history ─────────────────────────────────────────
import { Award, Check, Crown, Diamond, ExternalLink, Flame, Lock, Sparkles, Trophy, Zap } from 'lucide-react';
import { useFormat, useI18n } from '../../i18n';
import { BADGES, XP_PACKAGES } from '../../lib/gamification';
import { RARITY_COLOR, rarityOf } from '../nvult/catalog';
import { BASE_EXPLORER_TX } from '../purchase';
import { buildMilestones, progressTo, statusOf } from '../progress';
import type { ProfileCtx } from '../types';
import { Panel, Reveal, Tag } from '../ui';

const ICONS: Record<string, typeof Sparkles> = { Sparkles, Zap, Flame, Trophy, Crown, Diamond };
const MILESTONES = buildMilestones();
const R = 27;
const CIRC = 2 * Math.PI * R;

export function Achievements({ ctx }: { ctx: ProfileCtx }) {
  const { t } = useI18n();
  const { number } = useFormat();
  const { gamification: g, level, accent } = ctx;
  const statuses = statusOf(MILESTONES, level);
  const reached = statuses.filter((s) => s === 'reached').length;
  const lineFill = MILESTONES.length > 1 ? Math.min(100, ((reached + (statuses.includes('next') ? 0.5 : 0)) / MILESTONES.length) * 100) : 0;

  const productLabel = (type: string, id: string): string => {
    if (type === 'skin') return t(`skin.${id}`);
    const pkg = XP_PACKAGES.find((p) => p.id === id);
    if (pkg) return `${number(pkg.xp, 0)} XP`;
    return id;
  };

  return (
    <div className="space-y-4">
      {/* ── Badges as medals ───────────────────────────────────────── */}
      <Reveal i={0}>
        <Panel eyebrow={t('profile.badges')} title={t('pf.ach.title', { n: g.unlockedBadges.length, total: BADGES.length })} right={<Tag kind="live" />}>
          <div className="grid grid-cols-1 gap-2.5 @xl:grid-cols-2">
            {BADGES.map((b) => {
              const unlocked = g.unlockedBadges.includes(b.id);
              const Icon = ICONS[b.icon] ?? Award;
              const p = unlocked ? 1 : progressTo(level, b.levelRequired);
              const rc = RARITY_COLOR[rarityOf(b.levelRequired)];
              const ring = unlocked ? rc : accent;
              return (
                <article key={b.id} data-testid={`badge-${b.id}`} data-unlocked={unlocked}
                  className="group relative overflow-hidden rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: unlocked ? `${rc}66` : 'rgba(255,255,255,.08)', background: unlocked ? `linear-gradient(135deg, ${rc}16, rgba(0,0,0,.15))` : 'rgba(0,0,0,.2)', boxShadow: unlocked ? `0 0 22px ${rc}1c` : undefined }}>
                  {unlocked && <span aria-hidden className="pf-shine pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)' }} />}
                  <div className="relative flex items-center gap-3">
                    <div className="relative h-[60px] w-[60px] shrink-0">
                      <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90" aria-hidden>
                        <circle cx="30" cy="30" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3.5" />
                        <circle cx="30" cy="30" r={R} fill="none" stroke={ring} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - p)} style={{ filter: `drop-shadow(0 0 4px ${ring}aa)`, transition: 'stroke-dashoffset .8s ease-out' }} />
                      </svg>
                      <div className="absolute inset-[7px] flex items-center justify-center rounded-full border" style={{ borderColor: unlocked ? `${rc}88` : 'rgba(255,255,255,.1)', color: unlocked ? rc : 'rgba(160,170,180,.45)', background: unlocked ? `radial-gradient(circle at 35% 30%, ${rc}30, rgba(0,0,0,.35))` : 'rgba(255,255,255,.03)' }}>
                        {unlocked ? <Icon size={20} strokeWidth={1.7} /> : <Lock size={15} />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><span className="truncate">{t(`badge.${b.id}`)}</span>{unlocked && <Check size={11} className="text-emerald-300" />}</div>
                      <div className={`mt-1 text-[9px] font-mono uppercase tracking-[.14em] ${unlocked ? 'text-foreground/75' : 'text-muted-foreground/55'}`}>
                        {unlocked ? t('pf.ach.unlocked') : t('pf.ach.progress', { n: Math.floor(p * 100), l: number(b.levelRequired, 0) })}
                      </div>
                      <div className="mt-1 text-[9px] font-mono uppercase tracking-wider" style={{ color: rc }}>{t(`pf.rarity.${rarityOf(b.levelRequired)}`)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      </Reveal>

      {/* ── Evolution history ───────────────────────────────────────── */}
      <Reveal i={1}>
        <Panel eyebrow={t('pf.ev.title')} right={<Tag kind="live" />}>
          <ol className="relative space-y-3 ps-7">
            <span aria-hidden className="absolute bottom-2 start-[9px] top-2 w-[2px] rounded-full" style={{ background: `linear-gradient(to bottom, ${accent} ${lineFill}%, rgba(255,255,255,.1) ${lineFill}%)`, boxShadow: `0 0 8px ${accent}55` }} />
            {MILESTONES.map((m, i) => {
              const st = statuses[i];
              const color = st === 'reached' ? accent : st === 'next' ? '#fcd34d' : 'rgba(160,170,180,.4)';
              return (
                <li key={m.level} data-testid={`milestone-${m.level}`} data-status={st} className="relative rounded-xl border px-3 py-2" style={{ borderColor: st === 'next' ? 'rgba(252,211,77,.35)' : 'rgba(255,255,255,.06)', background: st === 'reached' ? `${accent}0a` : 'rgba(0,0,0,.15)' }}>
                  <span className={`absolute -start-7 top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 bg-background ${st === 'next' ? 'animate-pulse' : ''}`} style={{ borderColor: color, boxShadow: st !== 'upcoming' ? `0 0 10px ${color}88` : undefined }}>
                    {st === 'reached' && <Check size={9} style={{ color }} />}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold" style={{ color }}>{t('profile.level')} {number(m.level, 0)}</span>
                    <span className="rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider" style={{ borderColor: `${color}55`, color }}>{t(`pf.ev.${st}`)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    {m.badges.map((b) => <span key={b.id} className="rounded bg-white/[.06] px-1.5 py-0.5 text-foreground/85">{t(`badge.${b.id}`)}</span>)}
                    {m.titles.map((x) => <span key={x.id} className="rounded bg-white/[.06] px-1.5 py-0.5 text-foreground/85">{t(`title.${x.id}`)}</span>)}
                    {m.parts.map((p) => {
                      const c = RARITY_COLOR[rarityOf(p.levelRequired)];
                      return <span key={`${p.slot}${p.id}`} className="rounded border px-1.5 py-0.5" style={{ background: `${c}14`, color: c, borderColor: `${c}40` }}>{t(`pf.slot.${p.slot}`)} · {t(`pf.part.${p.slot}.${p.id}`)}</span>;
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[10px] text-muted-foreground/50">{t('pf.ev.dateNote')}</p>
        </Panel>
      </Reveal>

      {/* ── Verified purchases ──────────────────────────────────────── */}
      <Reveal i={2}>
        <Panel eyebrow={t('pf.ev.purchases')} right={<Tag kind="live" />}>
          {ctx.entitlements.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">{ctx.walletAddress ? t('pf.ev.noPurchases') : t('purchase.connectWalletFirst')}</p>
          ) : (
            <ul className="divide-y divide-white/[.05]">
              {ctx.entitlements.map((e) => (
                <li key={`${e.product_id}-${e.tx_hash}`} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="text-foreground">{productLabel(e.product_type, e.product_id)}</span>
                  {e.tx_hash && (
                    <a href={`${BASE_EXPLORER_TX}/${e.tx_hash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300/80 hover:underline">
                      <ExternalLink size={9} /> {t('purchase.viewTx')}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
