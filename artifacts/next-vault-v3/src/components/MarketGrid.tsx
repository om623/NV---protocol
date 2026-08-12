import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RefreshCw, Loader as Loader2, Search } from 'lucide-react';
import {
  type MarketAsset, type MarketCategory, type TrendStatus,
  getAllAssets, refreshGlobalMarkets, formatVolume,
} from '../lib/marketData';
import { useI18n } from '../i18n';

type FilterCategory = MarketCategory | 'all';
type SortKey = 'change24h' | 'volume24h' | 'price';

function MiniSpark({ data, trend }: { data: number[]; trend: TrendStatus }) {
  const W = 80, H = 28, PAD = 2;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const color = trend === 'bullish' ? 'rgb(52,211,153)' : trend === 'bearish' ? 'rgb(248,113,113)' : 'rgb(148,163,184)';
  const pts = data.map((v, i) => {
    const x = PAD + i * stepX;
    const y = PAD + (H - PAD * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function trendColor(t: TrendStatus) {
  return t === 'bullish' ? 'text-emerald-400' : t === 'bearish' ? 'text-red-400' : 'text-muted-foreground';
}

function trendBg(t: TrendStatus) {
  return t === 'bullish' ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
    : t === 'bearish' ? 'bg-red-500/8 border-red-500/20 text-red-400'
    : 'bg-secondary/40 border-border/30 text-muted-foreground';
}

function formatPrice(a: MarketAsset): string {
  if (!Number.isFinite(a.price)) return '—';
  if (a.price < 0.01) return a.price.toFixed(6);
  if (a.price < 1) return a.price.toFixed(4);
  return a.price.toLocaleString('en-US', { maximumFractionDigits: a.decimals, minimumFractionDigits: 0 });
}

const FILTERS: { key: FilterCategory; label: string }[] = [
  { key: 'all',        label: 'Todos' },
  { key: 'crypto',     label: 'Crypto' },
  { key: 'commodities',label: 'Commodities' },
  { key: 'indices',    label: 'Índices' },
  { key: 'fiat',       label: 'Fiat' },
];

export function MarketGrid() {
  const { t } = useI18n();
  const [assets, setAssets] = useState<MarketAsset[]>(() => getAllAssets());
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [sort, setSort] = useState<SortKey>('change24h');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      refreshGlobalMarkets();
      setAssets([...getAllAssets()]);
    }, 4000);
    return () => {
      clearInterval(iv);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshGlobalMarkets();
    setAssets([...getAllAssets()]);
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 500);
  }, []);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? assets : assets.filter(a => a.category === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === 'price') return b.price - a.price;
      if (sort === 'volume24h') return b.volume24h - a.volume24h;
      return b.change24h - a.change24h;
    });
  }, [assets, filter, sort, query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.4 }}
      className="w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300"
    >
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-4 -mt-1" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-wide">{t('market.globalMarket')}</h2>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 border border-border/30">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer ${
                  filter === f.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 border border-border/30">
            {([['change24h','Variação'],['volume24h','Volume'],['price','Preço']] as [SortKey,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setSort(k)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer ${
                  sort === k ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[120px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('market.searchPlaceholder')}
              className="w-full bg-secondary/30 border border-border/30 rounded-lg pl-7 pr-3 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map((coin, i) => {
            const isPositive = coin.change24h >= 0;
            return (
              <motion.div key={coin.symbol}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02, duration: 0.25 }}
                className={`relative rounded-xl p-3 border transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
                  coin.trend === 'bullish' ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/35'
                  : coin.trend === 'bearish' ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/35'
                  : 'bg-secondary/25 border-border/30 hover:border-primary/15'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center text-[10px] font-bold text-primary font-mono shrink-0">
                      {coin.symbol.slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-medium text-foreground" translate="no">{coin.symbol}</span>
                      <span className="text-[9px] text-muted-foreground/50 truncate max-w-[80px]">{coin.name}</span>
                    </div>
                  </div>
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border ${trendBg(coin.trend)}`} translate="no">
                    {coin.trend === 'bullish' ? 'BULL' : coin.trend === 'bearish' ? 'BEAR' : 'NEUT'}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 mb-2">
                  <span className="text-sm font-mono font-semibold text-foreground" translate="no">${formatPrice(coin)}</span>
                  <div className={`flex items-center gap-0.5 text-[10px] font-mono font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Number.isFinite(coin.change24h) ? `${isPositive ? '+' : ''}${coin.change24h.toFixed(2)}%` : '—'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono text-muted-foreground/50" translate="no">Vol {formatVolume(coin.volume24h)}</span>
                  <div className="w-16 shrink-0">
                    <MiniSpark data={coin.spark} trend={coin.trend} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-[11px] font-mono text-muted-foreground/40">
            {t('market.noResults')} "{query}".
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
          <span>{t('market.autoRefresh4s')}</span>
          <span className="ml-auto">{filtered.length} {t('market.assetsCount')}</span>
        </div>
      </div>
    </motion.div>
  );
}
