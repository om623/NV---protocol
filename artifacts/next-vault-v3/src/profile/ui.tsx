// ── Profile UI primitives ────────────────────────────────────────────────────
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useI18n } from '../i18n';
import { SLOTS } from './nvult/catalog';
import type { Loadout } from './nvult/loadout';

/** Honesty tags: LIVE = real engine / server-verified, LOCAL = this device only, SOON = not connected yet. */
export type TagKind = 'live' | 'local' | 'soon';

const TAG_STYLE: Record<TagKind, { dot: string; box: string }> = {
  live:  { dot: 'bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,.9)]', box: 'border-emerald-300/25 text-emerald-200/90' },
  local: { dot: 'bg-sky-300 shadow-[0_0_6px_rgba(125,211,252,.8)]',     box: 'border-sky-300/25 text-sky-200/90' },
  soon:  { dot: 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,.7)]',    box: 'border-amber-300/25 text-amber-200/90' },
};

export function Tag({ kind }: { kind: TagKind }) {
  const { t } = useI18n();
  const s = TAG_STYLE[kind];
  return (
    <span title={t(`pf.tagHint.${kind}`)} data-tag={kind}
      className={`inline-flex items-center gap-1.5 rounded-full border bg-black/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[.14em] ${s.box}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {t(`pf.tag.${kind}`)}
    </span>
  );
}

export function Panel({ eyebrow, title, right, children, className = '' }: {
  eyebrow?: string; title?: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  const line = 'color-mix(in srgb, var(--pf-focus, #2dd4bf) 55%, transparent)';
  return (
    <section className={`relative overflow-hidden rounded-2xl border border-white/[.08] backdrop-blur-sm ${className}`}
      style={{
        background: 'radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--pf-focus, #2dd4bf) 11%, transparent), transparent 62%), linear-gradient(160deg, rgba(255,255,255,.05), rgba(255,255,255,.012))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 22px 44px -28px rgba(0,0,0,.8)',
      }}>
      <i aria-hidden className="pointer-events-none absolute left-2 top-2 h-2 w-2 border-l border-t" style={{ borderColor: line }} />
      <i aria-hidden className="pointer-events-none absolute bottom-2 right-2 h-2 w-2 border-b border-r" style={{ borderColor: line }} />
      {(eyebrow || title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[.05] px-4 py-3">
          <div className="min-w-0">
            {eyebrow && (
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[.22em] text-muted-foreground/55">
                <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: 'var(--pf-focus, #2dd4bf)', boxShadow: '0 0 8px var(--pf-focus, #2dd4bf)' }} />
                <span className="truncate">{eyebrow}</span>
              </div>
            )}
            {title && <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Meter({ value, color, className = '' }: { value: number; color: string; className?: string }) {
  return (
    <div className={`relative h-2 overflow-hidden rounded-full bg-white/[.07] shadow-[inset_0_1px_2px_rgba(0,0,0,.55)] ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative h-full overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 12px ${color}77` }}>
        <span aria-hidden className="pf-shimmer absolute inset-y-0 left-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)' }} />
      </motion.div>
    </div>
  );
}

/** Circular XP progress around the level number: ticks, glowing arc and a travelling end dot. */
export function Ring({ value, color, size = 132, children }: { value: number; color: string; size?: number; children?: ReactNode }) {
  const r = size / 2 - 11;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const c = size / 2;
  // The end dot follows the arc: angle 0 is 12 o'clock after the -90deg rotation of the svg.
  const ang = useMotionValue(0);
  const dotX = useTransform(ang, (a) => c + r * Math.cos(a));
  const dotY = useTransform(ang, (a) => c + r * Math.sin(a));
  useEffect(() => {
    const ctl = animate(ang, v * 2 * Math.PI, { duration: 0.95, ease: 'easeOut' });
    return () => ctl.stop();
  }, [v, ang]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={c} cy={c} r={size / 2 - 3} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3.5" strokeDasharray="1.2 5.6" />
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="6" />
        <motion.circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - v) }}
          transition={{ duration: 0.95, ease: 'easeOut' }} style={{ filter: `drop-shadow(0 0 7px ${color}aa)` }} />
        {v > 0 && <motion.circle cx={dotX} cy={dotY} r="4.2" fill="#fff" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Compact statistic tile. */
export function Stat({ label, value, icon, accent }: { label: string; value: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[.07] px-3 py-2.5 transition-colors hover:border-white/20"
      style={{ background: 'linear-gradient(160deg, rgba(255,255,255,.05), rgba(0,0,0,.22))' }}>
      <span aria-hidden className="absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-30 blur-xl transition-opacity group-hover:opacity-60" style={{ background: accent }} />
      <dt className="relative flex items-center gap-1 text-[9px] font-mono uppercase tracking-[.14em] text-muted-foreground/55"><span style={{ color: accent }}>{icon}</span>{label}</dt>
      <dd className="relative mt-0.5 text-base font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** Staggered entrance; renders without motion for users who prefer reduced motion. */
export function Reveal({ children, i = 0, className = '' }: { children: ReactNode; i?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.34, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

/** NV insignia: the compact identity mark (evolved from the prototype branch), tinted by the user's accent. */
export function Insignia({ accent, level, size = 56, label }: { accent: string; level: number; size?: number; label: string }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label} width={size} height={size} style={{ filter: `drop-shadow(0 0 8px ${accent}88)` }}>
        <path d="M50 5 77 16 91 39 84 69 63 89 50 95 37 89 16 69 9 39 23 16Z" fill="none" stroke={accent} strokeWidth="1.8" opacity=".85" />
        <path d="M50 12 72 21 83 40 77 65 60 81 50 86 40 81 23 65 17 40 28 21Z" fill="#081323" stroke={accent} strokeWidth="2" />
        <path d="M31 34 39 26 61 26 69 34 73 54 63 66 50 72 37 66 27 54Z" fill="#0b1220" stroke="#94a3b8" strokeWidth="1.4" />
        <path d="M38 43 45 43 M55 43 62 43" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        <path d="M43 60 50 64 57 60" fill="none" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="50" cy="18" r="2" fill={accent} />
      </svg>
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-[#07111f]/95 px-1.5 text-[8px] font-mono font-bold tracking-wider"
        style={{ borderColor: `${accent}66`, color: accent }}>{level >= 1000 ? `${Math.floor(level)}` : `L${Math.floor(level)}`}</span>
    </div>
  );
}

export interface NavItem<T extends string> { id: T; label: string; icon: ReactNode }

/** Segmented section navigation with a sliding indicator. */
/** WAI-ARIA tabs keyboard model: arrows (mirrored in RTL), Home/End; selection follows focus. */
export function tabKeys<T extends string>(e: KeyboardEvent<HTMLElement>, ids: readonly T[], active: T, select: (id: T) => void, attr: string): void {
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const i = Math.max(0, ids.indexOf(active));
  let n: number;
  if (e.key === 'ArrowRight') n = i + (rtl ? -1 : 1);
  else if (e.key === 'ArrowLeft') n = i + (rtl ? 1 : -1);
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = ids.length - 1;
  else return;
  e.preventDefault();
  const id = ids[(n + ids.length) % ids.length];
  // The target tab already exists in the DOM (inactive tabs are tabIndex -1, still focusable by script), so focus it
  // right away instead of waiting for a frame: this stays correct even when the page is busy rendering.
  e.currentTarget.querySelector<HTMLElement>(`[${attr}="${id}"]`)?.focus();
  select(id);
}

export function SectionNav<T extends string>({ items, active, onChange, accent, label }: {
  items: NavItem<T>[]; active: T; onChange: (id: T) => void; accent: string; label: string;
}) {
  const ids = items.map((i) => i.id);
  return (
    <div role="tablist" aria-label={label} onKeyDown={(e) => tabKeys(e, ids, active, onChange, 'data-section')}
      className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-white/[.07] bg-background/80 p-1 backdrop-blur-xl [scrollbar-width:none]">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button key={it.id} role="tab" id={`pf-tab-${it.id}`} aria-selected={on} aria-controls="pf-panel" tabIndex={on ? 0 : -1} data-section={it.id} onClick={() => onChange(it.id)}
            className={`relative flex min-w-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors ${on ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground'}`}>
            {on && (
              <motion.span layoutId="pf-nav-pill" className="absolute inset-0 rounded-xl border"
                style={{ borderColor: `${accent}55`, background: `linear-gradient(135deg, ${accent}22, transparent)`, boxShadow: `0 0 18px ${accent}22` }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative" style={on ? { color: accent } : undefined}>{it.icon}</span>
            <span className="relative hidden whitespace-nowrap sm:inline">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Accessible description of the Nvult: name, optional tier, and every equipped part. */
export function describeLook(t: (k: string) => string, look: Loadout, tierName?: string): string {
  const parts = SLOTS.filter((s) => look[s] !== 'none').map((s) => `${t(`pf.slot.${s}`)}: ${t(`pf.part.${s}.${look[s]}`)}`);
  return [look.name + (tierName ? `, ${tierName}` : ''), ...parts].join('. ');
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
