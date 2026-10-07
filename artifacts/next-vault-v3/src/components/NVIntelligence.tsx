// ─── NV Intelligence — Global Market Intelligence Platform ────────────────────
// Real-time international news from public RSS feeds.
// Locale-aware UI, filters, and NV Agent — all real data, no fabrication.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  RefreshCw,
  ExternalLink,
  Clock,
  Filter,
  Bot,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Radio,
  ChevronDown,
  ChevronUp,
  Info,
  Mic,
  Newspaper,
  MapPin,
  Tag,
  Languages,
  Layers,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { useI18n } from '../i18n/context';
import { LOCALES } from '../i18n/types';
import {
  type NewsItem,
  type NewsCategory,
  type MarketRegion,
  type CountryMarket,
  type NewsPriority,
  type AgentMessage,
  type EventCluster,
  ALL_CATEGORIES,
  ALL_REGIONS,
  ALL_COUNTRY_MARKETS,
  PRIORITY_CONFIG,
  CATEGORY_CONFIG,
  REGION_CONFIG,
  COUNTRY_FLAG,
  LANGUAGE_LABELS,
  FEED_REFRESH_MS,
  PENDING_PROVIDERS,
  fetchAllNewsWithClusters,
  answerFromNews,
  formatRelativeTime,
  buildNVNewsQueue,
} from '../lib/intelligence';

// ─── Badge components ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: NewsPriority }) {
  const { t } = useI18n();
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded-md border ${cfg.textClass} ${cfg.bgClass} ${cfg.borderClass}`}>
      {priority === 'breaking' && (
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.dotClass}`} />
      )}
      {t(cfg.labelKey)}
    </span>
  );
}

function CategoryBadge({ category }: { category: NewsCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className={`inline-flex text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bg}`}>
      {category}
    </span>
  );
}

function CountryBadge({ country, region }: { country: CountryMarket; region: MarketRegion }) {
  const regionCfg = REGION_CONFIG[region];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/30 ${regionCfg.color}`}>
      <span>{COUNTRY_FLAG[country]}</span>
      <span>{country}</span>
    </span>
  );
}

// ─── Breaking Ticker ─────────────────────────────────────────────────────────

function BreakingTicker({ items }: { items: NewsItem[] }) {
  const breaking = items.filter(i => i.priority === 'breaking');
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (breaking.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % breaking.length), 5000);
    return () => clearInterval(t);
  }, [breaking.length]);
  if (!breaking.length) return null;
  const item = breaking[idx % breaking.length];
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-3 py-2 overflow-hidden">
      <span className="flex items-center gap-1 shrink-0 text-[9px] font-mono font-bold text-red-400 tracking-widest uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        BREAKING
      </span>
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="block text-[11px] text-red-300 hover:text-red-200 truncate transition-colors"
          >
            {COUNTRY_FLAG[item.country]} {item.title}
          </motion.a>
        </AnimatePresence>
      </div>
      <span className="shrink-0 text-[9px] font-mono text-red-400/50">{item.source}</span>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({
  news,
  clusters,
  lastUpdate,
}: {
  news: NewsItem[];
  clusters: EventCluster[];
  lastUpdate: number;
}) {
  const { locale, t } = useI18n();
  const breaking = news.filter(i => i.priority === 'breaking').length;
  const multiConfirmed = clusters.filter(c => c.multiSourceConfirmed).length;
  const sources = [...new Set(news.map(n => n.source))].length;

  const stats = [
    { icon: Newspaper,  value: news.length,    label: t('intel.statItems'),     color: 'text-foreground/70' },
    { icon: Zap,        value: breaking,        label: t('intel.breaking'),      color: 'text-red-400' },
    { icon: Layers,     value: clusters.length, label: t('intel.statEvents'),    color: 'text-cyan-400' },
    { icon: Users,      value: multiConfirmed,  label: t('intel.statConfirmed'), color: 'text-emerald-400' },
    { icon: TrendingUp, value: sources,         label: t('intel.statSources'),   color: 'text-primary' },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap px-1">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-1.5">
          <s.icon size={11} className={s.color} />
          <span className={`text-[11px] font-mono font-semibold ${s.color}`}>{s.value}</span>
          <span className="text-[10px] text-muted-foreground/40 font-mono">{s.label}</span>
        </div>
      ))}
      {lastUpdate > 0 && (
        <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/40 font-mono">
          <Radio size={9} className="text-emerald-400" />
          {formatRelativeTime(lastUpdate, locale)}
        </div>
      )}
    </div>
  );
}

// ─── Cluster Card ─────────────────────────────────────────────────────────────

function ClusterCard({ cluster }: { cluster: EventCluster }) {
  const { t, locale } = useI18n();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const rep = cluster.representative;
  const cfg = PRIORITY_CONFIG[cluster.priority];
  const catCfg = CATEGORY_CONFIG[cluster.category];
  const regionCfg = REGION_CONFIG[cluster.region];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-card/60 hover:bg-card/80 transition-all duration-200 overflow-hidden ${
        cluster.priority === 'breaking' ? 'border-red-500/30' : 'border-border/40 hover:border-primary/20'
      }`}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <PriorityBadge priority={cluster.priority} />
          <span className={`inline-flex text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded ${catCfg.bg} ${catCfg.color}`}>
            {cluster.category}
          </span>
          {cluster.multiSourceConfirmed && (
            <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 size={8} />
              {cluster.sources.length} {t('intel.confirmed')}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono shrink-0">
            <Clock size={9} />
            {formatRelativeTime(cluster.publishedMs, locale)}
          </span>
        </div>

        {/* Headline */}
        <a
          href={rep.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium text-foreground hover:text-primary transition-colors leading-snug group"
        >
          {cluster.headline}
          <ExternalLink size={10} className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
        </a>

        {/* Context summary line */}
        {cluster.contextSummary && (
          <p className="mt-1 text-[10px] text-muted-foreground/50 font-mono">{cluster.contextSummary}</p>
        )}

        {/* Related categories (cross-topic events) */}
        {cluster.relatedCategories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cluster.relatedCategories.slice(0, 3).map(cat => {
              const cc = CATEGORY_CONFIG[cat];
              return (
                <span key={cat} className={`text-[8px] font-mono px-1 py-0.5 rounded ${cc.bg} ${cc.color} opacity-70`}>
                  {cat}
                </span>
              );
            })}
          </div>
        )}

        {/* Summary (expandable) */}
        {rep.summary && rep.summary.length > 10 && (
          <>
            <button
              type="button"
              onClick={() => setSummaryOpen(v => !v)}
              className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {summaryOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {summaryOpen ? t('intel.collapse') : t('intel.expand')}
            </button>
            <AnimatePresence>
              {summaryOpen && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 text-xs text-muted-foreground/70 leading-relaxed overflow-hidden"
                >
                  {rep.summary}
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Related sources (separate expandable) */}
        {cluster.items.length > 1 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setSourcesOpen(v => !v)}
              className="text-[9px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              {cluster.items.length} {t('intel.relatedSources')} {sourcesOpen ? '▲' : '▼'}
            </button>
            <AnimatePresence>
              {sourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1.5 space-y-1 overflow-hidden"
                >
                  {cluster.items.slice(0, 6).map(item => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
                    >
                      <ExternalLink size={8} className="shrink-0" />
                      <span className="font-mono text-muted-foreground/40">[{item.source}]</span>
                      <span className="truncate">{item.title}</span>
                    </a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/20 flex-wrap">
          <div className="w-4 h-4 rounded bg-secondary/40 flex items-center justify-center text-[8px] font-bold text-muted-foreground/60 font-mono uppercase shrink-0">
            {rep.source.slice(0, 2)}
          </div>
          <a
            href={rep.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors font-mono"
          >
            {rep.source}
          </a>
          <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/30 ${regionCfg.color} ml-auto`}>
            <span>{COUNTRY_FLAG[cluster.country]}</span>
            <span>{cluster.country}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── News Card ────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const hasSummary = Boolean(item.summary && item.summary.length > 10);
  const needsTranslation = item.originalLanguage !== 'en' && !['en'].includes(item.originalLanguage);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/40 bg-card/60 hover:border-primary/20 hover:bg-card/80 transition-all duration-200 overflow-hidden"
    >
      <div className="p-4">
        {/* Top row: priority + category + time */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <PriorityBadge priority={item.priority} />
          <CategoryBadge category={item.category} />
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono shrink-0">
            <Clock size={9} />
            {formatRelativeTime(item.publishedMs, locale)}
          </span>
        </div>

        {/* Title */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium text-foreground hover:text-primary transition-colors leading-snug group"
        >
          {item.title}
          <ExternalLink size={10} className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
        </a>

        {/* Translation notice */}
        {needsTranslation && (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground/40 font-mono">
            <Languages size={8} />
            {t('intel.translationNote', { lang: LANGUAGE_LABELS[item.originalLanguage] ?? item.originalLanguage })}
          </div>
        )}

        {/* Summary expand */}
        {hasSummary && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? t('intel.collapse') : t('intel.expand')}
          </button>
        )}
        <AnimatePresence>
          {expanded && hasSummary && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 text-xs text-muted-foreground/70 leading-relaxed overflow-hidden"
            >
              {item.summary}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Footer: source + country */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/20 flex-wrap">
          <div className="w-4 h-4 rounded bg-secondary/40 flex items-center justify-center text-[8px] font-bold text-muted-foreground/60 font-mono uppercase shrink-0">
            {item.source.slice(0, 2)}
          </div>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors font-mono"
          >
            {item.source}
          </a>
          <div className="ml-auto">
            <CountryBadge country={item.country} region={item.region} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Region Tab Bar ───────────────────────────────────────────────────────────

function RegionTabBar({
  active,
  onChange,
  counts,
}: {
  active: MarketRegion | 'all';
  onChange: (r: MarketRegion | 'all') => void;
  counts: Record<string, number>;
}) {
  const { t } = useI18n();
  const tabs: { id: MarketRegion | 'all'; labelKey: string; flag: string }[] = [
    { id: 'all',         labelKey: 'intel.global',     flag: '🌐' },
    { id: 'americas',   labelKey: 'intel.americas',   flag: '🌎' },
    { id: 'europe',     labelKey: 'intel.europe',     flag: '🌍' },
    { id: 'asia',       labelKey: 'intel.asia',       flag: '🌏' },
    { id: 'middle-east',labelKey: 'intel.middleEast', flag: '🕌' },
  ];

  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map(tab => {
        const count = tab.id === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[tab.id] ?? 0);
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all ${
              isActive
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:border-border/60 hover:text-foreground/70'
            }`}
          >
            <span>{tab.flag}</span>
            <span>{t(tab.labelKey)}</span>
            {count > 0 && (
              <span className={`text-[9px] px-1 rounded ${isActive ? 'bg-primary/20' : 'bg-secondary/40'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface Filters {
  region: MarketRegion | 'all';
  country: CountryMarket | 'all';
  categories: Set<NewsCategory>;
  priority: NewsPriority | 'all';
  confirmedOnly: boolean;
}

function FilterPanel({
  filters,
  onChange,
  news,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  news: NewsItem[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const categoryCounts = useMemo(() =>
    news.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {}), [news]);

  const countriesInRegion = useMemo(() => {
    const set = new Set<CountryMarket>();
    news.forEach(item => {
      if (filters.region === 'all' || item.region === filters.region) set.add(item.country);
    });
    return Array.from(set).sort();
  }, [news, filters.region]);

  function toggleCat(cat: NewsCategory) {
    const next = new Set(filters.categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange({ ...filters, categories: next });
  }

  const priorityOptions: { id: NewsPriority | 'all'; labelKey: string }[] = [
    { id: 'all', labelKey: 'intel.allPriorities' },
    { id: 'breaking', labelKey: 'intel.breaking' },
    { id: 'high', labelKey: 'intel.high' },
    { id: 'medium', labelKey: 'intel.medium' },
    { id: 'low', labelKey: 'intel.low' },
  ];

  return (
    <div className="rounded-xl border border-border/30 bg-secondary/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-secondary/20 transition-colors"
      >
        <Filter size={12} className="text-muted-foreground/50 shrink-0" />
        <span className="text-xs text-muted-foreground/60">{t('intel.language')} · {t('intel.country')} · {t('intel.priority')} · {t('intel.allCategories')}</span>
        {(filters.categories.size > 0 || filters.country !== 'all' || filters.priority !== 'all' || filters.confirmedOnly) && (
          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
        )}
        {open ? <ChevronUp size={12} className="ml-auto text-muted-foreground/40" /> : <ChevronDown size={12} className="ml-auto text-muted-foreground/40" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-border/20"
          >
            <div className="px-4 py-4 space-y-4">

              {/* Country filter */}
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-1">
                  <MapPin size={8} /> {t('intel.country')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChange({ ...filters, country: 'all' })}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${filters.country === 'all' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:border-border/60'}`}
                  >
                    {t('intel.allCountries')}
                  </button>
                  {countriesInRegion.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange({ ...filters, country: c })}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${filters.country === c ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:border-border/60'}`}
                    >
                      {COUNTRY_FLAG[c]} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority filter */}
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2">{t('intel.priority')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {priorityOptions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({ ...filters, priority: opt.id })}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${filters.priority === opt.id ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:border-border/60'}`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category filter */}
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2 flex items-center gap-1">
                  <Tag size={8} /> {t('intel.allCategories')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CATEGORIES.map(cat => {
                    const count = categoryCounts[cat] ?? 0;
                    if (count === 0) return null;
                    const cfg = CATEGORY_CONFIG[cat];
                    const active = filters.categories.has(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCat(cat)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${active ? `${cfg.bg} border-current ${cfg.color}` : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:border-border/60'}`}
                      >
                        {cat} <span className="opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confirmed events only toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, confirmedOnly: !filters.confirmedOnly })}
                  className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border transition-all ${
                    filters.confirmedOnly
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:border-border/60'
                  }`}
                >
                  <CheckCircle2 size={9} />
                  {t('intel.showConfirmed')}
                </button>
              </div>

              {/* Reset */}
              {(filters.categories.size > 0 || filters.country !== 'all' || filters.priority !== 'all' || filters.confirmedOnly) && (
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, categories: new Set(), country: 'all', priority: 'all', confirmedOnly: false })}
                  className="text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 underline transition-colors"
                >
                  {t('intel.resetFilters')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── NV News Panel (voice infrastructure) ────────────────────────────────────

function NVNewsPanel({ news }: { news: NewsItem[] }) {
  const { t, locale } = useI18n();
  const queue = useMemo(() => buildNVNewsQueue(news, 10, locale), [news, locale]);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Mic size={14} className="text-amber-400" />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">{t('intel.nvNewsTitle')}</div>
          <div className="text-[9px] text-muted-foreground/50 font-mono">{t('intel.nvNewsSubtitle')}</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-md bg-amber-500/5 border border-amber-500/15 px-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
          <span className="text-[9px] font-mono text-amber-400/70">{t('intel.voiceSoon')}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground/60 mb-3 leading-relaxed">{t('intel.nvNewsVoice')}</p>

        {queue.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 italic">{t('intel.nvNewsReady')}</p>
        ) : (
          <div className="space-y-2">
            {queue.map((item, i) => {
              const catCfg = CATEGORY_CONFIG[item.category];
              return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                  item.priority === 'breaking'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-orange-500/5 border-orange-500/10'
                }`}
              >
                <div className={`text-[9px] font-mono font-bold mt-0.5 shrink-0 w-4 text-center ${item.priority === 'breaking' ? 'text-red-400' : 'text-orange-400'}`}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[9px] font-mono text-muted-foreground/60">{COUNTRY_FLAG[item.country]} {item.country}</span>
                    <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${catCfg.bg} ${catCfg.color}`}>{item.category}</span>
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground/40 flex items-center gap-1">
                      <Clock size={8} />
                      {formatRelativeTime(new Date(item.publishedAt).getTime() || Date.now(), locale)}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-foreground/80 hover:text-primary transition-colors leading-snug block"
                  >
                    {item.headline}
                  </a>
                  <div className="mt-1 text-[9px] font-mono text-muted-foreground/40">{item.source}</div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NV Agent Panel ───────────────────────────────────────────────────────────

function NVAgentPanel({ news }: { news: NewsItem[] }) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      role: 'assistant',
      content: t('intel.agentGreeting'),
      sources: [],
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Suggested queries — locale-aware
  const suggestions = useMemo(() => {
    const byLocale: Record<string, string[]> = {
      'pt-BR': [
        'O que está acontecendo nos mercados hoje?',
        'Quais são as principais notícias da Ásia?',
        'Quais tensões geopolíticas estão em destaque?',
        'Mostre notícias sobre tokenização.',
        'Quais bancos centrais tomaram decisões recentes?',
      ],
      'en': [
        "What's happening in markets today?",
        "Top news from Asia?",
        "Key geopolitical tensions?",
        "Tokenization news?",
        "Central bank decisions?",
      ],
      'es': [
        '¿Qué pasa en los mercados hoy?',
        'Noticias principales de Asia',
        'Tensiones geopolíticas clave',
        'Noticias de tokenización',
        'Decisiones de bancos centrales',
      ],
      'fr': [
        "Que se passe-t-il sur les marchés aujourd'hui?",
        "Principales nouvelles d'Asie",
        "Tensions géopolitiques clés",
        "Actualités tokenisation",
        "Décisions des banques centrales",
      ],
      'zh': ['今天市场发生了什么？', '亚洲主要新闻', '主要地缘政治紧张局势', '代币化新闻', '央行决定'],
      'ja': ['今日の市場は？', 'アジアのトップニュース', '地政学的緊張', 'トークン化ニュース', '中央銀行の決定'],
      'ko': ['오늘 시장 동향은?', '아시아 주요 뉴스', '지정학적 긴장', '토큰화 뉴스', '중앙은행 결정'],
      'hi': ['आज बाज़ार में क्या हो रहा है?', 'एशिया की मुख्य खबरें', 'भू-राजनीतिक तनाव', 'टोकनाइज़ेशन समाचार', 'केंद्रीय बैंक निर्णय'],
      'ar': ['ماذا يحدث في الأسواق اليوم؟', 'أبرز أخبار آسيا', 'التوترات الجيوسياسية', 'أخبار التوكنيز', 'قرارات البنوك المركزية'],
    };
    return byLocale[locale] ?? byLocale['en'];
  }, [locale]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset greeting when locale changes
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: t('intel.agentGreeting'),
      sources: [],
      timestamp: Date.now(),
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  async function handleSend(q = input) {
    const question = q.trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: Date.now() }]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 350));
    const { answer, sources } = answerFromNews(question, news, locale, t);
    setMessages(prev => [...prev, { role: 'assistant', content: answer, sources, timestamp: Date.now() }]);
    setLoading(false);
  }

  return (
    <div className="flex flex-col min-h-[400px] max-h-[600px] rounded-2xl border border-border/40 bg-card/80 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Bot size={14} className="text-primary" />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">{t('intel.agent')}</div>
          <div className="text-[9px] text-muted-foreground/50 font-mono">
            {news.length} {t('intel.agentItems')}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/40 font-mono">
          <Mic size={9} />
          {t('intel.voiceSoon')}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2">
        <AlertTriangle size={10} className="text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[9px] text-amber-400/80 leading-relaxed">{t('intel.agentDisclaimer')}</p>
      </div>

      {/* Suggestion chips */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(s)}
              className="text-[9px] font-mono px-2 py-1 rounded-lg bg-secondary/30 border border-border/30 text-muted-foreground/60 hover:border-primary/30 hover:text-primary transition-all text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary/15 text-foreground border border-primary/20 rounded-br-sm'
                  : 'bg-secondary/30 text-foreground/90 border border-border/30 rounded-bl-sm'
              }`}
            >
              {msg.content}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                  <div className="text-[9px] text-muted-foreground/50 font-mono uppercase tracking-wider">
                    {t('intel.agentSources')}
                  </div>
                  {msg.sources.map((src, si) => (
                    <a
                      key={si}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-[9px] text-muted-foreground/60 hover:text-primary transition-colors group"
                    >
                      <ExternalLink size={8} className="shrink-0 mt-0.5" />
                      <span className="truncate">[{src.source}] {src.title.slice(0, 70)}…</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary/30 border border-border/30 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground/60">{t('intel.agentLoading')}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/30 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('intel.agentPlaceholder')}
            disabled={loading}
            className="flex-1 bg-background/60 border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending integrations panel ───────────────────────────────────────────────

function PendingIntegrationsPanel() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/30 bg-secondary/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
      >
        <Info size={12} className="text-muted-foreground/50 shrink-0" />
        <span className="text-xs text-muted-foreground/60">{t('intel.pendingIntegrations')}</span>
        {open ? <ChevronUp size={12} className="ml-auto text-muted-foreground/40" /> : <ChevronDown size={12} className="ml-auto text-muted-foreground/40" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-border/20"
          >
            <div className="px-4 py-3 space-y-2">
              {PENDING_PROVIDERS.map(p => (
                <div key={p.id} className="flex items-start gap-3 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground/80">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">{p.envKey}</div>
                    <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {p.categories.join(' · ')}
                    </div>
                    <div className="text-[10px] text-muted-foreground/40">{p.notes}</div>
                    <div className="text-[10px] text-muted-foreground/30 mt-0.5">
                      {p.countries.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Language Selector ────────────────────────────────────────────────────────

function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LOCALES.find(l => l.code === locale)!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-border/40 bg-secondary/20 hover:border-primary/30 transition-all text-muted-foreground/70 hover:text-foreground"
      >
        <Languages size={11} />
        <span>{current.flag} {current.label}</span>
        <ChevronDown size={10} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-border/40 bg-card shadow-xl overflow-hidden"
          >
            {LOCALES.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => { setLocale(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${locale === l.code ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary/30'}`}
              >
                <span className="text-sm">{l.flag}</span>
                <span>{l.label}</span>
                {locale === l.code && <CheckCircle2 size={11} className="ml-auto text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function NVIntelligence() {
  const { t, locale } = useI18n();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [clusters, setClusters] = useState<EventCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'agent' | 'nvnews'>('feed');
  const [viewMode, setViewMode] = useState<'clusters' | 'flat'>('clusters');
  const [filters, setFilters] = useState<Filters>({
    region: 'all',
    country: 'all',
    categories: new Set(),
    priority: 'all',
    confirmedOnly: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNews = useCallback(async () => {
    try {
      const { items, clusters: c } = await fetchAllNewsWithClusters();
      if (items.length > 0) {
        setNews(items);
        setClusters(c);
        setLastUpdate(Date.now());
        setError(null);
      } else {
        setError(t('intel.error'));
      }
    } catch (err) {
      setError(t('intel.error'));
      console.error('[NV Intelligence] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadNews();
    timerRef.current = setInterval(loadNews, FEED_REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadNews]);

  // Filtered news (flat)
  const filteredNews = useMemo(() => {
    return news.filter(item => {
      if (filters.region !== 'all' && item.region !== filters.region) return false;
      if (filters.country !== 'all' && item.country !== filters.country) return false;
      if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
      if (filters.categories.size > 0 && !filters.categories.has(item.category)) return false;
      return true;
    });
  }, [news, filters]);

  // Filtered clusters
  const filteredClusters = useMemo(() => {
    return clusters.filter(c => {
      if (filters.region !== 'all' && c.region !== filters.region) return false;
      if (filters.country !== 'all' && c.country !== filters.country) return false;
      if (filters.priority !== 'all' && c.priority !== filters.priority) return false;
      if (filters.categories.size > 0 && !filters.categories.has(c.category)) return false;
      if (filters.confirmedOnly && !c.multiSourceConfirmed) return false;
      return true;
    });
  }, [clusters, filters]);

  // Region counts
  const regionCounts = useMemo(() =>
    news.reduce<Record<string, number>>((acc, item) => {
      acc[item.region] = (acc[item.region] ?? 0) + 1;
      return acc;
    }, {}), [news]);

  const breakingCount = useMemo(() => news.filter(n => n.priority === 'breaking').length, [news]);

  // Active sources list
  const activeSources = useMemo(() => [...new Set(news.map(n => n.source))].sort(), [news]);

  const tabs: { id: 'feed' | 'agent' | 'nvnews'; labelKey: string; icon: typeof Newspaper }[] = [
    { id: 'feed',   labelKey: 'intel.feed',   icon: Newspaper },
    { id: 'agent',  labelKey: 'intel.agent',  icon: Bot },
    { id: 'nvnews', labelKey: 'intel.news',   icon: Mic },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Globe size={20} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground">{t('intel.nv')}</h1>
              {breakingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  {breakingCount} {t('intel.breaking')}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {activeSources.length > 0 ? `${activeSources.length} sources · ${news.length} items` : 'Global market intelligence'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <LanguageSelector />
          <button
            type="button"
            onClick={() => { setLoading(true); loadNews(); }}
            disabled={loading}
            className="w-8 h-8 rounded-lg bg-secondary/30 border border-border/40 flex items-center justify-center hover:border-primary/30 hover:text-primary transition-all disabled:opacity-40"
            title={t('intel.refresh')}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-primary' : ''} />
          </button>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      {news.length > 0 && (
        <StatsBar news={news} clusters={clusters} lastUpdate={lastUpdate} />
      )}

      {/* ── Breaking ticker ─────────────────────────────────────────────────── */}
      {news.filter(i => i.priority === 'breaking').length > 0 && (
        <BreakingTicker items={news} />
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex rounded-xl border border-border/40 overflow-hidden text-sm font-medium">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 flex items-center justify-center gap-2 transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/20 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              {tab.id === 'feed' && news.length > 0 && (
                <span className={`text-[10px] font-mono px-1 rounded ${isActive ? 'bg-white/20' : 'bg-secondary/50'}`}>
                  {filteredNews.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Feed tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'feed' && (
        <div className="space-y-4">

          {/* Region tabs */}
          <RegionTabBar
            active={filters.region}
            onChange={r => setFilters(prev => ({ ...prev, region: r, country: 'all' }))}
            counts={regionCounts}
          />

          {/* View mode toggle + Advanced filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-border/40 overflow-hidden text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setViewMode('clusters')}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-all ${viewMode === 'clusters' ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground/70'}`}
              >
                <Layers size={11} />
                {t('intel.viewClusters')}
                {filteredClusters.length > 0 && (
                  <span className={`text-[9px] px-1 rounded ${viewMode === 'clusters' ? 'bg-primary/20' : 'bg-secondary/40'}`}>
                    {filteredClusters.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-border/40 transition-all ${viewMode === 'flat' ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-foreground/70'}`}
              >
                <Newspaper size={11} />
                {t('intel.viewFlat')}
                {filteredNews.length > 0 && (
                  <span className={`text-[9px] px-1 rounded ${viewMode === 'flat' ? 'bg-primary/20' : 'bg-secondary/40'}`}>
                    {filteredNews.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <FilterPanel filters={filters} onChange={setFilters} news={news} />

          {/* Loading */}
          {loading && news.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground/60">{t('intel.loading')}</p>
              <p className="text-xs text-muted-foreground/40 font-mono">
                Reuters · Bloomberg · BBC · FT · Nikkei · CoinDesk · Al Jazeera · Economic Times…
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400">{error}</p>
                <p className="text-xs text-muted-foreground/50 mt-1">{t('intel.partialError')}</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && viewMode === 'clusters' && filteredClusters.length === 0 && !error && (
            <div className="text-center py-12 text-sm text-muted-foreground/50">{t('intel.noNews')}</div>
          )}
          {!loading && viewMode === 'flat' && filteredNews.length === 0 && !error && (
            <div className="text-center py-12 text-sm text-muted-foreground/50">{t('intel.noNews')}</div>
          )}

          {/* Cluster view */}
          {viewMode === 'clusters' && filteredClusters.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredClusters.map(cluster => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Flat view */}
          {viewMode === 'flat' && filteredNews.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredNews.map(item => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Source legend */}
          {news.length > 0 && (
            <div className="flex items-start gap-2 pt-2">
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[10px] text-muted-foreground/50 font-mono leading-relaxed">
                {t('intel.sources')}: {activeSources.slice(0, 14).join(' · ')}
                {activeSources.length > 14 ? ` + ${activeSources.length - 14} more` : ''}
              </div>
            </div>
          )}

          <PendingIntegrationsPanel />
        </div>
      )}

      {/* ── Agent tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'agent' && (
        <div className="space-y-4">
          <NVAgentPanel news={news} />
          {news.length > 0 && (
            <div className="rounded-xl border border-border/30 bg-secondary/10 px-4 py-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2">
                {t('intel.sources')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeSources.map(src => (
                  <span
                    key={src}
                    className="text-[9px] font-mono px-2 py-0.5 rounded bg-secondary/30 border border-border/20 text-muted-foreground/60"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
          <PendingIntegrationsPanel />
        </div>
      )}

      {/* ── NV News tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'nvnews' && (
        <div className="space-y-4">
          <NVNewsPanel news={news} />
          <PendingIntegrationsPanel />
        </div>
      )}
    </div>
  );
}
