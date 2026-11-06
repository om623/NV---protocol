import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Star, GitCompare, X, Building2 } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import type { CompanySeed, Continent, NamedItem, SectorId, SizeClass } from '../types';
import { CONTINENTS } from '../types';
import { SECTORS } from '../data/sectors';
import { COMPANIES } from '../data/companies';
import { continentOf, countryName } from '../data/countries';
import { activeFilterCount, defaultFilters, industryFacet, type Filters } from '../filters';
import { Chip, inputCls } from '../ui';
import { MAX_COMPARE, type RadarUserData } from '../store';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  results: CompanySeed[];
  industries: Map<string, NamedItem[]>;
  user: RadarUserData;
  onOpenCompany: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onCommitSearch: (q: string) => void;
}

const REVENUE_STEPS = [0, 10e9, 50e9, 100e9, 250e9];

export function DirectoryPanel({ filters, setFilters, results, industries, user, onOpenCompany, onToggleFavorite, onToggleCompare, onCommitSearch }: Props) {
  const { t, localeBcp47 } = useI18n();
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(60);
  const active = activeFilterCount(filters);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setLimit(60); setFilters({ ...filters, [k]: v }); };

  const countries = useMemo(() => {
    const codes = [...new Set(COMPANIES.map((c) => c.country))];
    return codes.map((a2) => ({ a2, name: countryName(a2, localeBcp47) })).sort((a, b) => a.name.localeCompare(b.name, localeBcp47));
  }, [localeBcp47]);
  const industryOptions = useMemo(() => industryFacet(COMPANIES, industries), [industries]);

  const sel = 'rounded-lg border border-violet-500/25 bg-violet-950/40 px-2 py-2 text-xs text-foreground focus:outline-none focus:border-violet-400/70 w-full';

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-violet-300/50" />
        <input
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommitSearch(filters.query); }}
          onBlur={() => onCommitSearch(filters.query)}
          placeholder={t('radar.search.placeholder')}
          aria-label={t('radar.search.placeholder')}
          className={`${inputCls} ps-9 pe-9`}
        />
        {filters.query && (
          <button onClick={() => set('query', '')} aria-label={t('radar.filters.clear')} className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-violet-300/60 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 px-2.5 py-1.5 text-xs text-violet-100 hover:bg-violet-500/10 cursor-pointer min-h-[36px]"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={13} /> {t('radar.filters.title')}
          {active > 0 && <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-semibold text-white">{active}</span>}
        </button>
        <p className="text-xs text-violet-200/60 tabular-nums">{t('radar.results', { n: results.length })}</p>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-violet-500/15 bg-violet-950/25 p-3">
          <label className="text-[10px] text-violet-300/70">{t('radar.filters.continent')}
            <select className={sel} value={filters.continent} onChange={(e) => set('continent', e.target.value as Continent | 'all')}>
              <option value="all">{t('radar.filters.all')}</option>
              {CONTINENTS.map((c) => <option key={c} value={c}>{t(`radar.continent.${c}`)}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-violet-300/70">{t('radar.filters.country')}
            <select className={sel} value={filters.country} onChange={(e) => set('country', e.target.value)}>
              <option value="all">{t('radar.filters.all')}</option>
              {countries.filter((c) => filters.continent === 'all' || continentOf(c.a2) === filters.continent).map((c) => <option key={c.a2} value={c.a2}>{c.name}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-[10px] text-violet-300/70">{t('radar.filters.sector')}
            <select className={sel} value={filters.sector} onChange={(e) => set('sector', e.target.value as SectorId | 'all')}>
              <option value="all">{t('radar.filters.all')}</option>
              {SECTORS.map((s) => <option key={s} value={s}>{t(`radar.sector.${s}`)}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-[10px] text-violet-300/70">{t('radar.filters.segment')}
            <select className={sel} value={filters.industry} onChange={(e) => set('industry', e.target.value)} disabled={industryOptions.length === 0}>
              <option value="all">{industryOptions.length ? t('radar.filters.all') : t('radar.filters.segmentLoading')}</option>
              {industryOptions.map((i) => <option key={i.id} value={i.id}>{i.label} ({i.count})</option>)}
            </select>
          </label>
          <label className="text-[10px] text-violet-300/70">{t('radar.filters.size')}
            <select className={sel} value={filters.size} onChange={(e) => set('size', e.target.value as SizeClass | 'all')}>
              <option value="all">{t('radar.filters.all')}</option>
              {(['mega', 'large', 'growth'] as SizeClass[]).map((s) => <option key={s} value={s}>{t(`radar.size.${s}`)}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-violet-300/70">{t('radar.filters.listing')}
            <select className={sel} value={filters.listing} onChange={(e) => set('listing', e.target.value as Filters['listing'])}>
              <option value="all">{t('radar.filters.all')}</option>
              <option value="listed">{t('radar.listed')}</option>
              <option value="private">{t('radar.private')}</option>
            </select>
          </label>
          <label className="col-span-2 text-[10px] text-violet-300/70">{t('radar.filters.revenue')}
            <select className={sel} value={filters.minRevenueUsd} onChange={(e) => set('minRevenueUsd', Number(e.target.value))}>
              {REVENUE_STEPS.map((v) => (
                <option key={v} value={v}>{v === 0 ? t('radar.filters.any') : `≥ ${new Intl.NumberFormat(localeBcp47, { style: 'currency', currency: 'USD', notation: 'compact' }).format(v)}`}</option>
              ))}
            </select>
          </label>
          <p className="col-span-2 text-[10px] leading-snug text-violet-200/45">{t('radar.filters.revenueNote')}</p>
          {active > 0 && (
            <button onClick={() => setFilters({ ...defaultFilters, query: filters.query })} className="col-span-2 text-xs text-violet-200 hover:text-white underline-offset-2 hover:underline cursor-pointer text-start">
              {t('radar.filters.reset')}
            </button>
          )}
        </div>
      )}

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-violet-200/50">
          <Building2 size={28} className="opacity-50" />
          <p className="text-sm">{t('radar.empty.results')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {results.slice(0, limit).map((c) => {
            const fav = user.favorites.includes(c.id);
            const cmp = user.compare.includes(c.id);
            return (
              <li key={c.id} className="group flex items-stretch gap-1 rounded-xl border border-violet-500/15 bg-violet-950/20 hover:border-violet-400/45 hover:bg-violet-500/10 transition-colors">
                <button onClick={() => onOpenCompany(c.id)} className="flex-1 min-w-0 px-3 py-2.5 text-start cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                    {c.ticker && <span className="shrink-0 font-mono text-[10px] text-violet-300/60">{c.ticker}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-violet-200/55">
                    <span className="truncate">{c.city}, {countryName(c.country, localeBcp47)}</span>
                    <Chip>{t(`radar.sector.${c.sector}`)}</Chip>
                    {!c.listed && <Chip tone="slate">{t('radar.private')}</Chip>}
                  </span>
                </button>
                <div className="flex flex-col justify-center pe-1">
                  <button onClick={() => onToggleFavorite(c.id)} aria-pressed={fav} aria-label={t('radar.favorite')} className={`p-2 cursor-pointer ${fav ? 'text-amber-300' : 'text-violet-300/40 hover:text-violet-100'}`}>
                    <Star size={14} fill={fav ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => onToggleCompare(c.id)}
                    aria-pressed={cmp}
                    aria-label={t('radar.compare.add')}
                    disabled={!cmp && user.compare.length >= MAX_COMPARE}
                    className={`p-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${cmp ? 'text-violet-200' : 'text-violet-300/40 hover:text-violet-100'}`}
                  >
                    <GitCompare size={14} />
                  </button>
                </div>
              </li>
            );
          })}
          {results.length > limit && (
            <button onClick={() => setLimit((n) => n + 60)} className="mt-1 rounded-lg border border-violet-500/25 py-2 text-xs text-violet-100 hover:bg-violet-500/10 cursor-pointer">
              {t('radar.showMore', { n: results.length - limit })}
            </button>
          )}
        </ul>
      )}
    </div>
  );
}
