import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, X, Building2, Globe2, TrendingUp, Users, MapPin, ExternalLink, ArrowLeft, GitCompare, History, Filter } from 'lucide-react';
import { RadarGlobe } from './radar/RadarGlobe';
import { RADAR_COMPANIES, RADAR_REGIONS, RADAR_SECTORS } from '@/lib/radar/catalog';
import type { RadarCompany, RadarRegion, RadarSector } from '@/lib/radar/types';
import { getRadarFavorites, toggleRadarFavorite, saveRadarSearch, getRadarHistory } from '@/lib/radar/storage';
import { useFormat } from '@/i18n';
import { useRadarT } from '@/lib/radar/i18n';

export function GlobalRadar() {
  const t = useRadarT();
  const { compact, number } = useFormat();
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<RadarRegion | 'all'>('all');
  const [sectorFilter, setSectorFilter] = useState<RadarSector | 'all'>('all');
  const [selected, setSelected] = useState<RadarCompany | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setFavorites(getRadarFavorites());
    setHistory(getRadarHistory());
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return RADAR_COMPANIES.filter(c => {
      if (regionFilter !== 'all' && c.region !== regionFilter) return false;
      if (sectorFilter !== 'all' && c.sector !== sectorFilter) return false;
      if (showFavorites && !favorites.includes(c.id)) return false;
      if (q) {
        const hay = `${c.name} ${c.ticker ?? ''} ${c.country} ${c.city} ${c.sector}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, regionFilter, sectorFilter, favorites, showFavorites]);

  const favoriteCompanies = useMemo(() => RADAR_COMPANIES.filter(c => favorites.includes(c.id)), [favorites]);
  const compareCompanies = useMemo(() => RADAR_COMPANIES.filter(c => compareList.includes(c.id)), [compareList]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (q.trim().length > 2) {
      setHistory(saveRadarSearch(q));
    }
  };

  const handleFavorite = (id: string) => {
    setFavorites(toggleRadarFavorite(id));
  };

  const handleSelect = (company: RadarCompany) => {
    setSelected(company);
  };

  const addToCompare = (id: string) => {
    setCompareList(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev);
  };

  const stats = {
    total: RADAR_COMPANIES.length,
    regions: new Set(RADAR_COMPANIES.map(c => c.region)).size,
    sectors: new Set(RADAR_COMPANIES.map(c => c.sector)).size,
    countries: new Set(RADAR_COMPANIES.map(c => c.country)).size,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-[calc(100vh-4rem)]">
      {/* Globe area — protagonist */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Globe2 className="text-purple-400" size={28} />
              <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg -z-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-300 via-fuchsia-300 to-purple-400 bg-clip-text text-transparent">
                {t('radar.title')}
              </h1>
              <p className="text-xs text-muted-foreground">{t('radar.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">{stats.total} {t('radar.companies')}</span>
            <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">{stats.regions} {t('radar.regions')}</span>
            <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">{stats.countries} {t('radar.countries')}</span>
          </div>
        </div>

        {/* Globe canvas */}
        <div className="relative flex-1 min-h-[340px] rounded-2xl overflow-hidden border border-purple-500/20 bg-gradient-to-b from-[#0a0418] to-[#050208]">
          <RadarGlobe companies={filtered} selectedId={selected?.id} onSelect={handleSelect} />
          {/* Globe overlay hints */}
          <div className="absolute bottom-3 left-3 text-[10px] text-purple-300/60 font-mono pointer-events-none">
            {t('radar.globeHint')}
          </div>
          {selected && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-200 hover:bg-purple-500/30 transition-colors"
            >
              <X size={16} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-96 flex flex-col gap-3 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/60" size={18} />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('radar.searchPlaceholder')}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-purple-500/20 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Quick toggles */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setShowFilters(v => !v); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showFilters ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <Filter size={14} /> {t('radar.filters')}
          </button>
          <button
            onClick={() => { setShowFavorites(v => !v); if (showFavorites) setRegionFilter('all'), setSectorFilter('all'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showFavorites ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <Star size={14} /> {favorites.length}
          </button>
          <button
            onClick={() => setShowCompare(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showCompare ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <GitCompare size={14} /> {compareList.length}
          </button>
          <button
            onClick={() => setShowHistory(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showHistory ? 'bg-purple-500/20 border-purple-500/40 text-purple-200' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <History size={14} />
          </button>
        </div>

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-card border border-border">
                <label className="text-xs font-medium text-muted-foreground">{t('radar.region')}</label>
                <select
                  value={regionFilter}
                  onChange={e => setRegionFilter(e.target.value as RadarRegion | 'all')}
                  className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="all">{t('radar.allRegions')}</option>
                  {RADAR_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <label className="text-xs font-medium text-muted-foreground mt-1">{t('radar.sector')}</label>
                <select
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value as RadarSector | 'all')}
                  className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="all">{t('radar.allSectors')}</option>
                  {RADAR_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History panel */}
        <AnimatePresence>
          {showHistory && history.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-card border border-border">
                <span className="text-xs font-medium text-muted-foreground mb-1">{t('radar.recentSearches')}</span>
                {history.map((q, i) => (
                  <button key={i} onClick={() => { setSearch(q); setShowHistory(false); }} className="text-left px-2 py-1 rounded-lg hover:bg-secondary text-sm text-foreground/80 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compare panel */}
        <AnimatePresence>
          {showCompare && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-xs font-medium text-muted-foreground mb-2 block">{t('radar.compare')} ({compareCompanies.length}/4)</span>
                {compareCompanies.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">{t('radar.compareEmpty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-1.5 pr-2">{t('radar.company')}</th>
                          <th className="py-1.5 px-2">{t('radar.sector')}</th>
                          <th className="py-1.5 px-2">{t('radar.marketCap')}</th>
                          <th className="py-1.5 pl-2">{t('radar.employees')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareCompanies.map(c => (
                          <tr key={c.id} className="border-b border-border/40">
                            <td className="py-1.5 pr-2 font-medium">{c.name}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{c.sector}</td>
                            <td className="py-1.5 px-2">{c.marketCapUsd ? compact(c.marketCapUsd) : t('radar.notDisclosed')}</td>
                            <td className="py-1.5 pl-2">{c.employees ? number(c.employees, 0) : t('radar.notDisclosed')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content: company list or selected profile */}
        <div className="flex-1 overflow-y-auto rounded-xl bg-card/50 border border-border/50 min-h-0">
          {selected ? (
            <CompanyProfile company={selected} isFavorite={favorites.includes(selected.id)} onFavorite={() => handleFavorite(selected.id)} onBack={() => setSelected(null)} onCompare={() => addToCompare(selected.id)} inCompare={compareList.includes(selected.id)} t={t} compact={compact} number={number} />
          ) : showFavorites && favoriteCompanies.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground/60">{t('radar.noFavorites')}</div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {(showFavorites ? favoriteCompanies : filtered).map(c => (
                <CompanyRow key={c.id} company={c} isFavorite={favorites.includes(c.id)} onFavorite={() => handleFavorite(c.id)} onSelect={() => handleSelect(c)} onCompare={() => addToCompare(c.id)} inCompare={compareList.includes(c.id)} t={t} compact={compact} />
              ))}
              {(showFavorites ? favoriteCompanies : filtered).length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground/60">{t('radar.noResults')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyRow({ company, isFavorite, onFavorite, onSelect, onCompare, inCompare, t, compact }: {
  company: RadarCompany; isFavorite: boolean; onFavorite: () => void; onSelect: () => void; onCompare: () => void; inCompare: boolean;
  t: (k: string) => string; compact: (v: number) => string;
}) {
  return (
    <div className="group flex items-center gap-2 p-2.5 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer" onClick={onSelect}>
      <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
        <Building2 size={16} className="text-purple-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate" translate="no">{company.name}</span>
          {company.ticker && <span className="text-[10px] font-mono text-muted-foreground/70" translate="no">{company.ticker}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <MapPin size={10} /> {company.city}, {company.country}
          <span className="mx-1">·</span> {company.sector}
        </div>
      </div>
      {company.marketCapUsd && <span className="text-xs text-muted-foreground/80 font-mono hidden sm:block">{compact(company.marketCapUsd)}</span>}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onCompare(); }} className={`p-1.5 rounded-md hover:bg-purple-500/20 ${inCompare ? 'text-purple-400' : 'text-muted-foreground'}`}>
          <GitCompare size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onFavorite(); }} className={`p-1.5 rounded-md hover:bg-purple-500/20 ${isFavorite ? 'text-yellow-400' : 'text-muted-foreground'}`}>
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}

function CompanyProfile({ company, isFavorite, onFavorite, onBack, onCompare, inCompare, t, compact, number }: {
  company: RadarCompany; isFavorite: boolean; onFavorite: () => void; onBack: () => void; onCompare: () => void; inCompare: boolean;
  t: (k: string) => string; compact: (v: number) => string; number: (v: number, d: number) => string;
}) {
  const statusKey = `radar.status.${company.dataStatus}`;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> {t('radar.back')}
        </button>
        <div className="flex gap-1">
          <button onClick={onCompare} className={`p-1.5 rounded-md hover:bg-purple-500/20 ${inCompare ? 'text-purple-400' : 'text-muted-foreground'}`}>
            <GitCompare size={15} />
          </button>
          <button onClick={onFavorite} className={`p-1.5 rounded-md hover:bg-purple-500/20 ${isFavorite ? 'text-yellow-400' : 'text-muted-foreground'}`}>
            <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
          <Building2 size={24} className="text-purple-300" />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight" translate="no">{company.name}</h2>
          {company.ticker && <span className="text-xs font-mono text-muted-foreground" translate="no">{company.ticker}</span>}
        </div>
      </div>
      <p className="text-sm text-foreground/80 mb-4">{company.description}</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <InfoCell icon={<MapPin size={14} />} label={t('radar.headquarters')} value={`${company.city}, ${company.country}`} />
        <InfoCell icon={<Globe2 size={14} />} label={t('radar.region')} value={company.region} />
        <InfoCell icon={<Building2 size={14} />} label={t('radar.sector')} value={company.sector} />
        <InfoCell icon={<TrendingUp size={14} />} label={t('radar.founded')} value={company.founded ? String(company.founded) : t('radar.notDisclosed')} />
        <InfoCell icon={<TrendingUp size={14} />} label={t('radar.marketCap')} value={company.marketCapUsd ? compact(company.marketCapUsd) : t('radar.notDisclosed')} />
        <InfoCell icon={<Users size={14} />} label={t('radar.employees')} value={company.employees ? number(company.employees, 0) : t('radar.notDisclosed')} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${company.listed ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-muted/30 border-border text-muted-foreground'}`}>
          {company.listed ? t('radar.listed') : t('radar.private')}
        </span>
        {company.international && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-500/10 border border-purple-500/20 text-purple-300">{t('radar.international')}</span>}
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${company.dataStatus === 'available' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
          {t(statusKey)}
        </span>
      </div>

      <div className="p-3 rounded-xl bg-background/60 border border-border">
        <span className="text-xs font-medium text-muted-foreground block mb-1.5">{t('radar.source')}</span>
        <a href={company.source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-purple-300 hover:text-purple-200 transition-colors">
          <ExternalLink size={14} /> {company.source.name}
        </a>
        <span className="text-[11px] text-muted-foreground/60 block mt-1">{t('radar.updated')}: {company.source.updatedAt}</span>
      </div>
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-background/40 border border-border/50">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 mb-0.5">{icon} {label}</div>
      <div className="text-sm font-medium text-foreground/90" translate="no">{value}</div>
    </div>
  );
}
