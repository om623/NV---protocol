import type { ReactNode } from 'react';
import { ExternalLink, Loader as Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/context';
import type { LoadState, Sourced } from './types';
import { formatAsOf, formatCompact } from './format';

export const cardCls = 'rounded-2xl border border-violet-500/20 bg-[#0d0522]/85 backdrop-blur-xl';
export const inputCls =
  'w-full rounded-xl border border-violet-500/25 bg-violet-950/30 px-3 py-2 text-sm text-foreground placeholder:text-violet-200/35 focus:outline-none focus:border-violet-400/70 focus:ring-1 focus:ring-violet-400/40';
export const btnCls =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/20 hover:border-violet-400/60 transition-colors cursor-pointer min-h-[36px]';

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">{children}</h4>
      {aside}
    </div>
  );
}

export function Chip({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'amber' | 'green' | 'slate' | 'red' }) {
  const tones = {
    violet: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    green: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    red: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    slate: 'border-slate-400/20 bg-slate-500/10 text-slate-300',
  } as const;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-violet-300/70" />;
}

/** Renders loading / error (with retry) for a LoadState; children render when ready. */
export function LoadBlock<T>({ s, onRetry, children, compact }: { s: LoadState<T> & { reload?: () => void }; onRetry?: () => void; children: (data: T) => ReactNode; compact?: boolean }) {
  const { t } = useI18n();
  if (s.state === 'ready') return <>{children(s.data)}</>;
  if (s.state === 'idle') return null;
  if (s.state === 'loading') {
    return (
      <div className={`flex items-center gap-2 text-xs text-violet-200/60 ${compact ? 'py-2' : 'py-4'}`}>
        <Spinner /> {t('radar.loading')}
      </div>
    );
  }
  const key =
    s.code === 'rate_limited' ? 'radar.error.rate'
    : s.code === 'timeout' || s.code === 'network' ? 'radar.error.network'
    : s.code === 'not_configured' ? 'radar.error.notConfigured'
    : 'radar.error.generic';
  const retry = onRetry ?? s.reload;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{t(key)}</p>
        {retry && (
          <button onClick={retry} className="mt-1.5 inline-flex items-center gap-1 text-violet-200 hover:text-white cursor-pointer">
            <RefreshCw size={11} /> {t('radar.retry')}
          </button>
        )}
      </div>
    </div>
  );
}

export function SourceLink({ source, url, asOf, locale }: { source?: string; url?: string; asOf?: string; locale: string }) {
  const { t } = useI18n();
  if (!source) return null;
  return (
    <p className="mt-1 text-[10px] leading-tight text-violet-200/45">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-violet-100 underline-offset-2 hover:underline">
          {source} <ExternalLink size={9} />
        </a>
      ) : source}
      {asOf ? ` · ${t('radar.asOf', { date: formatAsOf(asOf, locale) })}` : ` · ${t('radar.noDate')}`}
    </p>
  );
}

export function MetricCell({ label, m, kind = 'money' }: { label: string; m: Sourced<number> | undefined; kind?: 'money' | 'count' }) {
  const { t, localeBcp47 } = useI18n();
  const missing = !m || m.status === 'unavailable' || m.status === 'not_disclosed';
  return (
    <div className="rounded-xl border border-violet-500/15 bg-violet-950/25 p-3 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-violet-300/60">{label}</p>
      {missing ? (
        <p className="mt-1 text-sm text-violet-200/50">
          {m?.status === 'not_disclosed' ? t('radar.status.notDisclosed') : t('radar.status.unavailable')}
        </p>
      ) : (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-base font-semibold tabular-nums text-foreground">
            {formatCompact(m.value as number, localeBcp47, kind === 'money' ? m.currency : undefined)}
            {kind === 'money' && !m.currency && <span className="text-[10px] font-normal text-violet-200/50">?</span>}
            {m.status === 'stale' && <Chip tone="amber">{t('radar.status.stale')}</Chip>}
          </p>
          <SourceLink source={m.source} url={m.sourceUrl} asOf={m.asOf} locale={localeBcp47} />
        </>
      )}
    </div>
  );
}

export function Spark({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(2)},${(28 - ((v - min) / span) * 26).toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={positive ? '#34d399' : '#fb7185'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-violet-500/15 bg-violet-950/25 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-violet-300/55">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
