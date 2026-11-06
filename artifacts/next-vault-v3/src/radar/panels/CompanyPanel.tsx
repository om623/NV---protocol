import { ArrowLeft, ExternalLink, GitCompare, Globe2, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import type { CompanySeed, MetricKey } from '../types';
import { continentOf, countryName } from '../data/countries';
import { useCompanyMetrics, useCompanyNews, useCompanyProfile, useCompanyQuote } from '../useCompanyData';
import { formatAsOf, formatDateTime, formatPercent, formatPrice } from '../format';
import { Chip, LoadBlock, MetricCell, SectionTitle, SourceLink, Spark, cardCls } from '../ui';
import { MAX_COMPARE, type RadarUserData } from '../store';

const FINANCIALS: MetricKey[] = ['revenue', 'netIncome', 'equity', 'assets', 'liabilities', 'debt', 'marketCap'];

interface Props {
  company: CompanySeed;
  user: RadarUserData;
  onBack: () => void;
  onOpenCountry: (a2: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleCompare: (id: string) => void;
}

export function CompanyPanel({ company, user, onBack, onOpenCountry, onToggleFavorite, onToggleCompare }: Props) {
  const { t, locale, localeBcp47 } = useI18n();
  const metrics = useCompanyMetrics(company);
  const profile = useCompanyProfile(company, locale);
  const quote = useCompanyQuote(company);
  const news = useCompanyNews(company);
  const fav = user.favorites.includes(company.id);
  const cmp = user.compare.includes(company.id);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} aria-label={t('radar.back')} className="mt-0.5 rounded-lg border border-violet-500/25 p-2 text-violet-100 hover:bg-violet-500/15 cursor-pointer">
          <ArrowLeft size={14} className="rtl:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight text-foreground">{company.name}</h3>
          <button onClick={() => onOpenCountry(company.country)} className="mt-0.5 text-xs text-violet-200/70 hover:text-white underline-offset-2 hover:underline cursor-pointer">
            {company.city}, {countryName(company.country, localeBcp47)} · {t(`radar.continent.${continentOf(company.country)}`)}
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip>{t(`radar.sector.${company.sector}`)}</Chip>
            <Chip tone={company.listed ? 'green' : 'slate'}>{company.listed ? `${company.ticker}${company.exchange ? ` · ${company.exchange}` : ''}` : t('radar.private')}</Chip>
            <Chip tone="slate">{t(`radar.size.${company.size}`)}</Chip>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => onToggleFavorite(company.id)} aria-pressed={fav} aria-label={t('radar.favorite')} className={`rounded-lg border border-violet-500/25 p-2 cursor-pointer ${fav ? 'text-amber-300' : 'text-violet-200 hover:bg-violet-500/15'}`}>
            <Star size={14} fill={fav ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onToggleCompare(company.id)}
            aria-pressed={cmp}
            aria-label={t('radar.compare.add')}
            title={!cmp && user.compare.length >= MAX_COMPARE ? t('radar.compare.full') : t('radar.compare.add')}
            disabled={!cmp && user.compare.length >= MAX_COMPARE}
            className={`rounded-lg border border-violet-500/25 p-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${cmp ? 'bg-violet-500/25 text-white' : 'text-violet-200 hover:bg-violet-500/15'}`}
          >
            <GitCompare size={14} />
          </button>
        </div>
      </div>

      {/* Market quote */}
      {company.yahoo && (
        <section className={`${cardCls} p-4`}>
          <SectionTitle>{t('radar.company.market')}</SectionTitle>
          <LoadBlock s={quote} compact>
            {(q) => {
              const up = (q.changePct ?? 0) >= 0;
              return (
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{formatPrice(q.price, localeBcp47, q.currency)}</p>
                    {q.changePct !== null && (
                      <p className={`flex items-center gap-1 text-sm font-medium tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {formatPercent(q.changePct, localeBcp47)}
                      </p>
                    )}
                  </div>
                  <Spark values={q.spark} positive={(q.ret3m ?? 0) >= 0} />
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {([['radar.q.ret1m', q.ret1m], ['radar.q.ret3m', q.ret3m]] as const).map(([k, v]) => (
                      <div key={k}><p className="text-[10px] uppercase tracking-wider text-violet-300/55">{t(k)}</p><p className="tabular-nums text-foreground">{v === null ? '—' : formatPercent(v, localeBcp47)}</p></div>
                    ))}
                    <div><p className="text-[10px] uppercase tracking-wider text-violet-300/55">{t('radar.q.high52')}</p><p className="tabular-nums text-foreground">{q.high52 ? formatPrice(q.high52, localeBcp47, q.currency) : '—'}</p></div>
                    <div><p className="text-[10px] uppercase tracking-wider text-violet-300/55">{t('radar.q.low52')}</p><p className="tabular-nums text-foreground">{q.low52 ? formatPrice(q.low52, localeBcp47, q.currency) : '—'}</p></div>
                  </div>
                  <p className="mt-2 text-[10px] text-violet-200/45">
                    {q.source}{q.exchange ? ` · ${q.exchange}` : ''} · {t('radar.q.updated', { date: formatDateTime(q.marketTime ? new Date(q.marketTime * 1000).toISOString() : q.retrievedAt, localeBcp47) })} · {t('radar.q.delayNote')}
                  </p>
                </div>
              );
            }}
          </LoadBlock>
        </section>
      )}
      {!company.yahoo && (
        <p className="text-xs text-violet-200/50">{company.listed ? t('radar.q.noSymbol') : t('radar.q.private')}</p>
      )}

      {/* About + facts */}
      <section>
        <SectionTitle>{t('radar.company.about')}</SectionTitle>
        {!company.qid ? (
          <p className="text-xs text-violet-200/55">{t('radar.company.noEntity')}</p>
        ) : (
          <LoadBlock s={profile}>
            {(p) => (
              <div className="flex flex-col gap-3">
                {p.summary ? (
                  <div>
                    <p className="text-sm leading-relaxed text-pretty text-foreground/90">{p.summary.text}</p>
                    <p className="mt-1.5 text-[10px] text-violet-200/45">
                      <a href={p.summary.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-violet-100">
                        Wikipedia ({p.summary.lang}) <ExternalLink size={9} />
                      </a>
                      {p.summary.lang !== (locale === 'pt-BR' ? 'pt' : locale) && ` · ${t('radar.company.summaryFallback')}`}
                    </p>
                  </div>
                ) : p.articleTitle ? (
                  <p className="text-xs text-violet-200/50">{t('radar.loading')}</p>
                ) : (
                  <p className="text-xs text-violet-200/55">{t('radar.company.noSummary')}</p>
                )}
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                  <Fact label={t('radar.fact.hq')} value={`${company.city}, ${countryName(company.country, localeBcp47)}`} />
                  <Fact label={t('radar.fact.founded')} value={p.inception?.value ? formatAsOf(p.inception.value, localeBcp47) : t('radar.status.unavailable')} />
                  <Fact label={t('radar.fact.founders')} value={p.founders.length ? p.founders.map((f) => f.label).join(', ') : t('radar.status.unavailable')} />
                  <Fact label={t('radar.fact.parent')} value={p.parent?.label ?? '—'} />
                  <Fact label={t('radar.fact.segments')} value={p.industries.length ? p.industries.slice(0, 5).map((i) => i.label).join(', ') : t('radar.status.unavailable')} wide />
                  {p.website && (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wider text-violet-300/60">{t('radar.fact.website')}</dt>
                      <dd><a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-violet-200 hover:text-white">{p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} <ExternalLink size={10} /></a></dd>
                    </div>
                  )}
                </dl>
                <SourceLink source="Wikidata" url={`https://www.wikidata.org/wiki/${company.qid}`} locale={localeBcp47} />
              </div>
            )}
          </LoadBlock>
        )}
      </section>

      {/* Financials */}
      <section>
        <SectionTitle>{t('radar.company.financials')}</SectionTitle>
        <LoadBlock s={metrics}>
          {(r) => (
            <>
              <div className="grid grid-cols-2 gap-2">
                {FINANCIALS.map((k) => <MetricCell key={k} label={t(`radar.metric.${k}`)} m={r.metrics[k]} />)}
                <MetricCell label={t('radar.metric.employees')} m={r.metrics.employees} kind="count" />
              </div>
              {r.notes.includes('sec_not_configured') && <p className="mt-2 text-[11px] text-amber-200/80">{t('radar.note.secNotConfigured')}</p>}
              {r.notes.includes('sec_failed') && <p className="mt-2 text-[11px] text-amber-200/80">{t('radar.note.secFailed')}</p>}
              {r.notes.includes('wikidata_failed') && <p className="mt-2 text-[11px] text-amber-200/80">{t('radar.note.wikidataFailed')}</p>}
              <p className="mt-2 text-[10px] leading-snug text-violet-200/40">{t('radar.note.currency')}</p>
            </>
          )}
        </LoadBlock>
      </section>

      {/* Subsidiaries and presence */}
      {company.qid && (
        <section>
          <SectionTitle>{t('radar.company.presence')}</SectionTitle>
          <LoadBlock s={profile} compact>
            {(p) => (
              <div className="flex flex-col gap-3">
                {p.subsidiaries.length === 0 ? (
                  <p className="text-xs text-violet-200/55">{t('radar.company.noSubs')}</p>
                ) : (
                  <>
                    <p className="text-xs text-violet-200/70">{t('radar.company.subsCount', { n: p.subsidiaries.length, c: p.subsidiaryCountries.length })}</p>
                    {p.subsidiaryCountries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.subsidiaryCountries.map((cc) => (
                          <button key={cc} onClick={() => onOpenCountry(cc)} className="cursor-pointer"><Chip tone="slate"><Globe2 size={10} className="me-1" />{countryName(cc, localeBcp47)}</Chip></button>
                        ))}
                      </div>
                    )}
                    <ul className="grid grid-cols-1 gap-1 text-xs text-foreground/85 sm:grid-cols-2">
                      {p.subsidiaries.slice(0, 14).map((s) => <li key={s.id} className="truncate">{s.label}{s.country ? <span className="text-violet-300/50"> · {s.country}</span> : null}</li>)}
                    </ul>
                    {p.subsidiaries.length > 14 && <p className="text-[10px] text-violet-200/45">{t('radar.company.moreSubs', { n: p.subsidiaries.length - 14 })}</p>}
                  </>
                )}
                <p className="text-[10px] text-violet-200/40">{t('radar.company.subsNote')}</p>
              </div>
            )}
          </LoadBlock>
        </section>
      )}

      {/* News */}
      <section>
        <SectionTitle>{t('radar.company.news')}</SectionTitle>
        <LoadBlock s={news}>
          {(items) => items.length === 0 ? (
            <p className="text-xs text-violet-200/55">{t('radar.company.noNews')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((n) => (
                <li key={n.url} className="rounded-xl border border-violet-500/15 bg-violet-950/20 p-3">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm leading-snug text-foreground hover:text-violet-100">{n.title}</a>
                  <p className="mt-1 text-[10px] text-violet-200/45">{n.domain}{n.date ? ` · ${formatDateTime(n.date, localeBcp47)}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </LoadBlock>
        <p className="mt-2 text-[10px] text-violet-200/40">GDELT Project · {t('radar.company.newsNote')}</p>
      </section>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[10px] uppercase tracking-wider text-violet-300/60">{label}</dt>
      <dd className="text-foreground/90">{value}</dd>
    </div>
  );
}
