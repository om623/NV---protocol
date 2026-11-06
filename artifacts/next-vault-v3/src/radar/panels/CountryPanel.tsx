import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Landmark } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import type { CompanySeed, IndicatorKey, LoadState } from '../types';
import { continentOf, countryName } from '../data/countries';
import { fetchAllCountryIndicators, wbIndicatorUrl, WB_SOURCE, type AllCountryIndicators } from '../adapters/worldBank';
import { fetchBcbSnapshot, bcbSeriesUrl, BCB_SOURCE, type BcbSnapshot } from '../adapters/bcb';
import { SourceError } from '../adapters/http';
import { formatAsOf, formatCompact, formatPercent } from '../format';
import { Chip, LoadBlock, SectionTitle, Stat, cardCls } from '../ui';

const ORDER: IndicatorKey[] = ['gdp', 'gdpGrowth', 'gdpPerCapita', 'population', 'inflation', 'unemployment', 'fdi', 'manufacturing'];
const PERCENT: IndicatorKey[] = ['gdpGrowth', 'inflation', 'unemployment', 'manufacturing'];
const USD: IndicatorKey[] = ['gdp', 'gdpPerCapita', 'fdi'];

interface Props {
  a2: string;
  companies: CompanySeed[];
  onBack: () => void;
  onOpenCompany: (id: string) => void;
}

export function CountryPanel({ a2, companies, onBack, onOpenCompany }: Props) {
  const { t, localeBcp47 } = useI18n();
  const [wb, setWb] = useState<LoadState<AllCountryIndicators>>({ state: 'idle' });
  const [bcb, setBcb] = useState<LoadState<BcbSnapshot>>({ state: 'idle' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setWb({ state: 'loading' });
    fetchAllCountryIndicators()
      .then((data) => { if (!cancelled) setWb({ state: 'ready', data }); })
      .catch((e: unknown) => { if (!cancelled) setWb({ state: 'error', message: (e as Error).message, code: e instanceof SourceError ? e.code : undefined }); });
    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    if (a2 !== 'BR') { setBcb({ state: 'idle' }); return; }
    let cancelled = false;
    setBcb({ state: 'loading' });
    fetchBcbSnapshot()
      .then((data) => { if (!cancelled) setBcb({ state: 'ready', data }); })
      .catch((e: unknown) => { if (!cancelled) setBcb({ state: 'error', message: (e as Error).message, code: e instanceof SourceError ? e.code : undefined }); });
    return () => { cancelled = true; };
  }, [a2, tick]);

  const bySector = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of companies) m.set(c.sector, (m.get(c.sector) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const fmt = (k: IndicatorKey, v: number): string =>
    PERCENT.includes(k) ? formatPercent(v, localeBcp47, 1).replace('+', '')
    : USD.includes(k) ? formatCompact(v, localeBcp47, 'USD')
    : formatCompact(v, localeBcp47);

  const name = countryName(a2, localeBcp47);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <button onClick={onBack} aria-label={t('radar.back')} className="mt-0.5 rounded-lg border border-violet-500/25 p-2 text-violet-100 hover:bg-violet-500/15 cursor-pointer">
          <ArrowLeft size={14} className="rtl:rotate-180" />
        </button>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground">{name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip>{t(`radar.continent.${continentOf(a2)}`)}</Chip>
            <Chip tone="slate">{a2}</Chip>
            <Chip tone="slate">{t('radar.nCompanies', { n: companies.length })}</Chip>
          </div>
        </div>
      </div>

      <section>
        <SectionTitle>{t('radar.country.indicators')}</SectionTitle>
        <LoadBlock s={wb} onRetry={() => setTick((n) => n + 1)}>
          {(all) => {
            const ind = all[a2];
            return (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {ORDER.map((k) => {
                    const v = ind?.[k];
                    return (
                      <div key={k} className="rounded-xl border border-violet-500/15 bg-violet-950/25 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-violet-300/60">{t(`radar.ind.${k}`)}</p>
                        {v && v.value !== null ? (
                          <>
                            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{fmt(k, v.value)}</p>
                            <a href={wbIndicatorUrl(k)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-violet-200/45 hover:text-violet-100">
                              {WB_SOURCE} · {v.year && formatAsOf(v.year, localeBcp47)} <ExternalLink size={9} />
                            </a>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-violet-200/50">{t('radar.status.unavailable')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!ind && <p className="mt-2 text-xs text-violet-200/50">{t('radar.country.noWb')}</p>}
              </>
            );
          }}
        </LoadBlock>
      </section>

      {a2 === 'BR' && (
        <section>
          <SectionTitle>{t('radar.country.centralBank')}</SectionTitle>
          <LoadBlock s={bcb} onRetry={() => setTick((n) => n + 1)}>
            {(snap) => (
              <div className="grid grid-cols-2 gap-2">
                {([['policyRate', 'radar.ind.policyRate', snap.policyRate], ['inflation12m', 'radar.ind.inflation12m', snap.inflation12m]] as const).map(([k, label, p]) => (
                  <div key={k} className="rounded-xl border border-violet-500/15 bg-violet-950/25 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-violet-300/60">{t(label)}</p>
                    {p ? (
                      <>
                        <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatPercent(p.value, localeBcp47, 2).replace('+', '')}</p>
                        <a href={bcbSeriesUrl(p.seriesId)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-violet-200/45 hover:text-violet-100">
                          {BCB_SOURCE} · {formatAsOf(p.date, localeBcp47)} <ExternalLink size={9} />
                        </a>
                      </>
                    ) : <p className="mt-1 text-sm text-violet-200/50">{t('radar.status.unavailable')}</p>}
                  </div>
                ))}
              </div>
            )}
          </LoadBlock>
        </section>
      )}

      <section>
        <SectionTitle>{t('radar.country.companies')}</SectionTitle>
        {companies.length === 0 ? (
          <p className="text-xs text-violet-200/50">{t('radar.country.noCompanies')}</p>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-3 gap-2">
              <Stat label={t('radar.stat.companies')} value={companies.length} />
              <Stat label={t('radar.stat.listed')} value={companies.filter((c) => c.listed).length} />
              <Stat label={t('radar.stat.sectors')} value={bySector.length} />
            </div>
            <ul className="flex flex-col gap-1.5">
              {companies.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onOpenCompany(c.id)} className={`${cardCls} flex w-full items-center gap-3 px-3 py-2.5 text-start hover:border-violet-400/50 cursor-pointer`}>
                    <Landmark size={14} className="shrink-0 text-violet-300/60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="block truncate text-[11px] text-violet-200/55">{c.city} · {t(`radar.sector.${c.sector}`)}</span>
                    </span>
                    {c.ticker && <span className="font-mono text-[10px] text-violet-300/60">{c.ticker}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-snug text-violet-200/40">{t('radar.country.coverageNote')}</p>
          </>
        )}
      </section>
    </div>
  );
}
