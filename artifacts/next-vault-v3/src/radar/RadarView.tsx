import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Building2, Database, GitCompare, Pause, Play, RotateCcw, TrendingUp, TriangleAlert, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/context';
import { COMPANIES, getCompany } from './data/companies';
import { SECTORS } from './data/sectors';
import { continentOf, countryName } from './data/countries';
import type { MarkerPoint, WorldGeo } from './geo';
import { loadWorld } from './geoLoader';
import { fetchBasics } from './adapters/wikidata';
import { wikiLang, useLoadedMetrics } from './useCompanyData';
import { defaultFilters, filterCompanies, type Filters } from './filters';
import { recordHistory, toggleCompare, toggleFavorite, useRadarUser } from './store';
import type { NamedItem } from './types';
import { RadarGlobe, type FocusRequest } from './globe/RadarGlobe';
import { DirectoryPanel } from './panels/DirectoryPanel';
import { CountryPanel } from './panels/CountryPanel';
import { CompanyPanel } from './panels/CompanyPanel';
import { ComparePanel } from './panels/ComparePanel';
import { TrendsPanel } from './panels/TrendsPanel';
import { SavedPanel } from './panels/SavedPanel';
import { SourcesPanel } from './panels/SourcesPanel';
import { Chip, Spinner, cardCls } from './ui';

type Tab = 'directory' | 'trends' | 'compare' | 'saved' | 'sources';
type Detail = { kind: 'country'; a2: string } | { kind: 'company'; id: string } | { kind: 'cluster'; ids: string[] } | null;

const WEIGHT = { mega: 3, large: 2, growth: 1 } as const;
const COVERED = new Set(COMPANIES.map((c) => c.country));
const QIDS = COMPANIES.map((c) => c.qid).filter((q): q is string => Boolean(q));

/** Camera distance that frames a whole country (bigger countries need a wider view). */
function viewDistance(areaDeg2: number): number {
  return areaDeg2 > 1000 ? 2.7 : areaDeg2 > 300 ? 2.35 : areaDeg2 > 60 ? 2.0 : 1.65;
}

export default function RadarView() {
  const { t, locale, localeBcp47 } = useI18n();
  const user = useRadarUser();
  const loaded = useLoadedMetrics();

  const [world, setWorld] = useState<WorldGeo | null>(null);
  const [worldError, setWorldError] = useState(false);
  const [worldKey, setWorldKey] = useState(0);
  const [noGl, setNoGl] = useState(false);
  const [globeState, setGlobeState] = useState<'starting' | 'ready' | 'error'>('starting');
  const [globeErr, setGlobeErr] = useState('');
  const [globeKey, setGlobeKey] = useState(0);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tab, setTab] = useState<Tab>('directory');
  const [detail, setDetail] = useState<Detail>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [rotate, setRotate] = useState(true);
  const [industries, setIndustries] = useState<Map<string, NamedItem[]>>(new Map());
  const panelRef = useRef<HTMLElement>(null);

  // Watchdog: if the world is loaded but no frame was ever drawn, say so instead of showing a dead canvas.
  useEffect(() => {
    if (!world || noGl || globeState !== 'starting') return;
    const id = window.setTimeout(() => {
      setGlobeErr('The 3D view did not draw its first frame in time.');
      setGlobeState('error');
    }, 12000);
    return () => window.clearTimeout(id);
  }, [world, noGl, globeState, globeKey]);

  useEffect(() => {
    let alive = true;
    loadWorld().then((w) => { if (alive) setWorld(w); }).catch((err) => { console.error('[Radar] map data failed', err); if (alive) setWorldError(true); });
    return () => { alive = false; };
  }, [worldKey]);

  // Segment (industry) labels in the active language, for every verified company.
  const lang = wikiLang(locale);
  useEffect(() => {
    let alive = true;
    fetchBasics(QIDS, lang)
      .then((basics) => {
        if (!alive) return;
        const m = new Map<string, NamedItem[]>();
        for (const c of COMPANIES) if (c.qid && basics[c.qid]) m.set(c.id, basics[c.qid].industries);
        setIndustries(m);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [lang]);

  const results = useMemo(
    () => filterCompanies(COMPANIES, filters, {
      countryName: (a2) => countryName(a2, localeBcp47),
      sectorName: (s) => t(`radar.sector.${s}`),
      continentName: (c) => t(`radar.continent.${c}`),
      industries,
      loaded: loaded.map,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, localeBcp47, industries, loaded.version, locale],
  );

  const points = useMemo<MarkerPoint[]>(
    () => results.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, country: c.country, weight: WEIGHT[c.size] })),
    [results],
  );

  const fly = useCallback((lat: number, lon: number, dist: number) => setFocus({ lat, lon, dist, nonce: Date.now() }), []);
  const revealPanel = () => { if (window.innerWidth < 1024) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const openCountry = useCallback((a2: string) => {
    setDetail({ kind: 'country', a2 });
    recordHistory('country', a2);
    const g = world?.byA2.get(a2);
    const here = COMPANIES.filter((c) => c.country === a2);
    if (g) fly(g.centroid[0], g.centroid[1], viewDistance(g.area));
    else if (here.length) fly(here[0].lat, here[0].lon, 1.6);
    revealPanel();
  }, [world, fly]);

  const openCompany = useCallback((id: string) => {
    const c = getCompany(id);
    if (!c) return;
    setDetail({ kind: 'company', id });
    recordHistory('company', id);
    fly(c.lat, c.lon, viewDistance(world?.byA2.get(c.country)?.area ?? 0));
    revealPanel();
  }, [fly, world]);

  const selectedCountry = detail?.kind === 'country' ? detail.a2 : detail?.kind === 'company' ? getCompany(detail.id)?.country ?? null : null;
  const back = () => setDetail(null);
  const commitSearch = (q: string) => { if (q.trim().length >= 2) recordHistory('search', q); };

  const tabs: { id: Tab; Icon: typeof Building2; badge?: number }[] = [
    { id: 'directory', Icon: Building2 },
    { id: 'trends', Icon: TrendingUp },
    { id: 'compare', Icon: GitCompare, badge: user.compare.length || undefined },
    { id: 'saved', Icon: Bookmark, badge: user.favorites.length || undefined },
    { id: 'sources', Icon: Database },
  ];

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,430px)] lg:h-[calc(100dvh-8.5rem)] lg:min-h-[640px]">
      {/* ── Globe ───────────────────────────────────────────────────────── */}
      <div className="radar-aura relative h-[58vh] min-h-[380px] overflow-hidden rounded-3xl border border-violet-500/30 bg-[radial-gradient(ellipse_at_50%_45%,#1d0b45_0%,#0b0420_55%,#050110_100%)] lg:h-full">
        <RadarGlobe
          key={globeKey}
          world={world}
          points={points}
          covered={COVERED}
          selectedCountry={selectedCountry}
          autoRotate={rotate && detail === null}
          focus={focus}
          onCountryClick={openCountry}
          onCompanyClick={openCompany}
          onClusterOpen={(ids, country) => {
            if (country && ids.length > 12) openCountry(country);
            else { setDetail({ kind: 'cluster', ids }); revealPanel(); }
          }}
          onUnsupported={() => setNoGl(true)}
          onReady={() => setGlobeState('ready')}
          onError={(m) => { setGlobeErr(m); setGlobeState('error'); }}
        />

        <div className="pointer-events-none absolute start-4 top-4 z-10 max-w-[70%]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-300" />
            </span>
            <h2 className="text-sm font-bold tracking-[0.3em] text-violet-100 sm:text-base">GLOBAL RADAR</h2>
          </div>
          <p className="mt-1.5 hidden text-[11px] leading-snug text-violet-200/60 sm:block">{t('radar.tagline')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>{t('radar.stat.shown', { n: results.length, total: COMPANIES.length })}</Chip>
            <Chip tone="slate">{t('radar.stat.countries', { n: COVERED.size })}</Chip>
          </div>
        </div>

        <div className="absolute end-3 top-3 z-10 flex gap-1.5">
          <button onClick={() => setRotate((v) => !v)} aria-label={rotate ? t('radar.globe.pause') : t('radar.globe.resume')} title={rotate ? t('radar.globe.pause') : t('radar.globe.resume')}
            className="rounded-lg border border-violet-500/30 bg-[#0d0522]/80 p-2 text-violet-100 hover:bg-violet-500/20 cursor-pointer backdrop-blur">
            {rotate ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button onClick={() => { fly(18, -35, 99); setDetail(null); }} aria-label={t('radar.globe.reset')} title={t('radar.globe.reset')}
            className="rounded-lg border border-violet-500/30 bg-[#0d0522]/80 p-2 text-violet-100 hover:bg-violet-500/20 cursor-pointer backdrop-blur">
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-3 start-4 z-10 flex flex-col gap-1 text-[10px] text-violet-200/60">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_2px_rgba(168,85,247,0.8)]" /> {t('radar.legend.clusters')}</span>
          <span className="flex items-center gap-1.5"><span className="h-px w-3 bg-violet-300/70" /> {t('radar.legend.hubs')}</span>
        </div>
        <p className="pointer-events-none absolute bottom-3 end-4 z-10 hidden max-w-[220px] text-end text-[10px] leading-snug text-violet-200/45 sm:block">{t('radar.globe.hint')}</p>

        {!world && !worldError && !noGl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-violet-200/70"><Spinner size={22} /><p className="text-xs">{t('radar.globe.loading')}</p></div>
        )}
        {globeState === 'starting' && world && !noGl && (
          <p className="pointer-events-none absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-full border border-violet-500/30 bg-[#0d0522]/80 px-3 py-1 text-[11px] text-violet-200/80">{t('radar.globe.starting')}</p>
        )}
        {globeState === 'error' && !noGl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-8 text-center text-amber-200/90">
            <TriangleAlert size={22} />
            <p className="text-sm">{t('radar.globe.error')}</p>
            {globeErr && <p className="max-w-full break-words font-mono text-[10px] text-violet-200/50">{globeErr}</p>}
            <p className="text-xs text-violet-200/50">{t('radar.globe.fallback')}</p>
            <button onClick={() => { setGlobeErr(''); setGlobeState('starting'); setGlobeKey((k) => k + 1); }} className="mt-1 cursor-pointer rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/30">{t('radar.globe.retry')}</button>
          </div>
        )}
        {(worldError || noGl) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-8 text-center text-amber-200/90">
            <TriangleAlert size={22} />
            <p className="text-sm">{noGl ? t('radar.globe.noWebgl') : t('radar.globe.geoError')}</p>
            <p className="text-xs text-violet-200/50">{t('radar.globe.fallback')}</p>
            {worldError && !noGl && (
              <button onClick={() => { setWorldError(false); setWorldKey((k) => k + 1); }} className="mt-1 cursor-pointer rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/30">{t('radar.globe.retry')}</button>
            )}
          </div>
        )}
      </div>

      {/* ── Side panel ──────────────────────────────────────────────────── */}
      <aside ref={panelRef} className={`${cardCls} flex min-h-[420px] flex-col overflow-hidden lg:h-full lg:min-h-0`}>
        <div role="tablist" aria-label="Radar" className="flex shrink-0 gap-1 overflow-x-auto border-b border-violet-500/15 p-2">
          {tabs.map(({ id, Icon, badge }) => {
            const active = tab === id && detail === null;
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => { setTab(id); setDetail(null); }}
                className={`relative flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-xs font-medium transition-colors cursor-pointer ${active ? 'bg-violet-500/25 text-white shadow-[0_0_14px_rgba(168,85,247,0.35)]' : 'text-violet-200/65 hover:bg-violet-500/10 hover:text-white'}`}>
                <Icon size={14} /> <span className="hidden sm:inline">{t(`radar.tab.${id}`)}</span>
                {badge ? <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-semibold leading-4 text-white">{badge}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {detail?.kind === 'country' && (
            <CountryPanel a2={detail.a2} companies={COMPANIES.filter((c) => c.country === detail.a2)} onBack={back} onOpenCompany={openCompany} />
          )}
          {detail?.kind === 'company' && getCompany(detail.id) && (
            <CompanyPanel
              key={detail.id}
              company={getCompany(detail.id)!}
              user={user}
              onBack={back}
              onOpenCountry={openCountry}
              onToggleFavorite={toggleFavorite}
              onToggleCompare={(id) => { toggleCompare(id); }}
            />
          )}
          {detail?.kind === 'cluster' && (
            <div className="flex flex-col gap-3">
              <button onClick={back} className="inline-flex w-fit items-center gap-1.5 text-xs text-violet-200 hover:text-white cursor-pointer"><ArrowLeft size={13} className="rtl:rotate-180" /> {t('radar.back')}</button>
              <p className="text-xs text-violet-200/60">{t('radar.nCompanies', { n: detail.ids.length })}</p>
              <ul className="flex flex-col gap-1.5">
                {detail.ids.map((id) => {
                  const c = getCompany(id);
                  return c ? (
                    <li key={id}><button onClick={() => openCompany(id)} className="w-full rounded-xl border border-violet-500/15 bg-violet-950/20 px-3 py-2.5 text-start hover:border-violet-400/45 cursor-pointer">
                      <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="block truncate text-[11px] text-violet-200/55">{c.city} · {t(`radar.sector.${c.sector}`)}</span>
                    </button></li>
                  ) : null;
                })}
              </ul>
            </div>
          )}
          {detail === null && tab === 'directory' && (
            <DirectoryPanel filters={filters} setFilters={setFilters} results={results} industries={industries} user={user}
              onOpenCompany={openCompany} onToggleFavorite={toggleFavorite} onToggleCompare={(id) => { toggleCompare(id); }} onCommitSearch={commitSearch} />
          )}
          {detail === null && tab === 'trends' && <TrendsPanel onOpenCompany={openCompany} />}
          {detail === null && tab === 'compare' && <ComparePanel user={user} onRemove={(id) => { toggleCompare(id); }} onOpenCompany={openCompany} />}
          {detail === null && tab === 'saved' && (
            <SavedPanel user={user} onOpenCompany={openCompany} onOpenCountry={openCountry} onToggleFavorite={toggleFavorite}
              onSearch={(q) => { setFilters({ ...defaultFilters, query: q }); setTab('directory'); }} />
          )}
          {detail === null && tab === 'sources' && <SourcesPanel />}
        </div>
      </aside>
    </div>
  );
}

// Exposed for tests / documentation: number of sectors the filters understand.
export const RADAR_SECTOR_COUNT = SECTORS.length;
export { continentOf };
