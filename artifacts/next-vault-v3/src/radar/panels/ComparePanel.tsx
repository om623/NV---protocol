import { GitCompare, X } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import type { CompanySeed, MetricKey, Sourced } from '../types';
import { getCompany } from '../data/companies';
import { countryName } from '../data/countries';
import { useCompanyMetrics, useCompanyQuote } from '../useCompanyData';
import { formatAsOf, formatCompact, formatPercent, formatPrice } from '../format';
import { Chip, Spinner } from '../ui';
import { clearCompare, type RadarUserData } from '../store';

const METRIC_ROWS: MetricKey[] = ['revenue', 'netIncome', 'equity', 'assets', 'liabilities', 'debt', 'marketCap', 'employees'];
const ROW = 'h-14 flex flex-col justify-center border-t border-violet-500/10 px-3';

interface Props {
  user: RadarUserData;
  onRemove: (id: string) => void;
  onOpenCompany: (id: string) => void;
}

export function ComparePanel({ user, onRemove, onOpenCompany }: Props) {
  const { t } = useI18n();
  const companies = user.compare.map((id) => getCompany(id)).filter((c): c is CompanySeed => Boolean(c));

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-violet-200/55">
        <GitCompare size={28} className="opacity-50" />
        <p className="text-sm">{t('radar.compare.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-violet-200/60">{t('radar.compare.count', { n: companies.length })}</p>
        <button onClick={clearCompare} className="text-xs text-violet-200 hover:text-white underline-offset-2 hover:underline cursor-pointer">{t('radar.compare.clear')}</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-violet-500/20 bg-[#0d0522]/85">
        <div className="flex min-w-max">
          <div className="sticky start-0 z-10 w-28 shrink-0 bg-[#0d0522]">
            <div className="h-16" />
            {['country', 'sector', 'listing', 'price', 'ret1m', 'ret3m', ...METRIC_ROWS].map((r) => (
              <div key={r} className={`${ROW} text-[10px] uppercase tracking-wider text-violet-300/60`}>
                {t(`radar.compare.row.${r}`)}
              </div>
            ))}
          </div>
          {companies.map((c) => <Column key={c.id} company={c} onRemove={() => onRemove(c.id)} onOpen={() => onOpenCompany(c.id)} />)}
        </div>
      </div>
      <p className="text-[10px] leading-snug text-violet-200/45">{t('radar.compare.note')}</p>
    </div>
  );
}

function Column({ company, onRemove, onOpen }: { company: CompanySeed; onRemove: () => void; onOpen: () => void }) {
  const { t, localeBcp47 } = useI18n();
  const metrics = useCompanyMetrics(company);
  const quote = useCompanyQuote(company);

  const metric = (k: MetricKey) => {
    if (metrics.state === 'loading' || metrics.state === 'idle') return <Spinner size={13} />;
    if (metrics.state === 'error') return <span className="text-xs text-amber-300/80">{t('radar.status.unavailable')}</span>;
    const m: Sourced<number> | undefined = metrics.data.metrics[k];
    if (!m || m.status === 'unavailable' || m.status === 'not_disclosed') {
      return <span className="text-xs text-violet-200/45">{m?.status === 'not_disclosed' ? t('radar.status.notDisclosed') : t('radar.status.unavailable')}</span>;
    }
    return (
      <>
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatCompact(m.value as number, localeBcp47, k === 'employees' ? undefined : m.currency)}</span>
        <span className="text-[10px] text-violet-200/45">
          {m.source?.split(' ')[0]} · {m.asOf ? formatAsOf(m.asOf, localeBcp47) : t('radar.noDate')}{m.status === 'stale' ? ` · ${t('radar.status.stale')}` : ''}
        </span>
      </>
    );
  };

  const q = quote.state === 'ready' ? quote.data : null;
  const qLoading = quote.state === 'loading';
  const quoteCell = (v: string | null) => (qLoading ? <Spinner size={13} /> : <span className={`text-sm tabular-nums ${v ? 'text-foreground' : 'text-violet-200/45'}`}>{v ?? '—'}</span>);

  return (
    <div className="w-44 shrink-0 border-s border-violet-500/10">
      <div className="flex h-16 items-start justify-between gap-1 px-3 pt-2">
        <button onClick={onOpen} className="min-w-0 text-start text-sm font-semibold leading-tight text-foreground hover:text-violet-100 cursor-pointer line-clamp-2">{company.name}</button>
        <button onClick={onRemove} aria-label={t('radar.compare.remove')} className="p-1 text-violet-300/50 hover:text-white cursor-pointer"><X size={13} /></button>
      </div>
      <div className={ROW}><span className="text-sm text-foreground">{countryName(company.country, localeBcp47)}</span></div>
      <div className={ROW}><Chip>{t(`radar.sector.${company.sector}`)}</Chip></div>
      <div className={ROW}><span className="text-sm text-foreground">{company.listed ? company.ticker : t('radar.private')}</span></div>
      <div className={ROW}>{quoteCell(q ? formatPrice(q.price, localeBcp47, q.currency) : null)}</div>
      <div className={ROW}>{quoteCell(q && q.ret1m !== null ? formatPercent(q.ret1m, localeBcp47) : null)}</div>
      <div className={ROW}>{quoteCell(q && q.ret3m !== null ? formatPercent(q.ret3m, localeBcp47) : null)}</div>
      {METRIC_ROWS.map((k) => <div key={k} className={ROW}>{metric(k)}</div>)}
    </div>
  );
}
