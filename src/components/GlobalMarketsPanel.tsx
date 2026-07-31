import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, RefreshCw, Loader2, TrendingUp, TrendingDown, Clock, Flame } from 'lucide-react';
import {
  type MarketAsset,
  type MarketGroup,
  type GlobalIndicators,
  getMarketGroups,
  getMarketSnapshot,
  refreshGlobalMarkets,
} from '../lib/marketData';

const nvCard =
  'w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300';

function formatPrice(asset: MarketAsset): string {
  const v = asset.price;
  if (v < 0.01) return v.toFixed(6);
  if (v < 1) return v.toFixed(4);
  return v.toLocaleString('en-US', { maximumFractionDigits: asset.decimals, minimumFractionDigits: 0 });
}

function formatCompact(v: number): string {
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${v.toFixed(2)}`;
}

function fearGreedColor(v: number): string {
  if (v >= 75) return 'text-emerald-400';
  if (v >= 55) return 'text-lime-400';
  if (v >= 45) return 'text-yellow-400';
  if (v >= 25) return 'text-orange-400';
  return 'text-red-400';
}

function AssetRow({ asset, index }: { asset: MarketAsset; index: number }) {
  const isPositive = asset.change24h >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40 transition-colors duration-200"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-primary/8 border border-primary/15 flex items-center justify-center text-[9px] font-bold text-primary font-mono shrink-0">
          {asset.symbol.slice(0, 2)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-mono font-medium text-foreground truncate">{asset.symbol}</span>
          <span className="text-[9px] text-muted-foreground/50 truncate">{asset.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[11px] font-mono font-semibold text-foreground">
          {asset.price === 0 && asset.symbol === 'EURC' ? 'N/A' : '$' + formatPrice(asset)}
        </span>
        <div className={'flex items-center gap-0.5 text-[9px] font-mono font-medium ' + (isPositive ? 'text-emerald-400' : 'text-red-400')}>
          {asset.price === 0 && asset.symbol === 'EURC' ? (
            <span className="text-[8px] text-muted-foreground/40">N/A</span>
          ) : (
            <>
              {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GroupSection({ group }: { group: MarketGroup }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 px-2 pt-1 pb-0.5">
        {group.label}
      </div>
      {group.assets.map((asset, i) => (
        <AssetRow key={asset.symbol} asset={asset} index={i} />
      ))}
    </div>
  );
}

export function GlobalMarketsPanel() {
  const [groups, setGroups] = useState<MarketGroup[]>(() => getMarketGroups());
  const [indicators, setIndicators] = useState<GlobalIndicators>(() => getMarketSnapshot().indicators);
  const [refreshing, setRefreshing] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setUpdatePending(true);
      await refreshGlobalMarkets();
      if (!cancelled) {
        setGroups(getMarketGroups());
        setIndicators(getMarketSnapshot().indicators);
        setLoading(false);
        setUpdatePending(false);
      }
    })();
    const interval = setInterval(async () => {
      setUpdatePending(true);
      await refreshGlobalMarkets();
      setGroups(getMarketGroups());
      setIndicators(getMarketSnapshot().indicators);
      setUpdatePending(false);
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshGlobalMarkets().then(() => {
      setGroups(getMarketGroups());
      setIndicators(getMarketSnapshot().indicators);
    });
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 500);
  }, []);

  const snapshot = getMarketSnapshot();
  const lastUpdatedStr = snapshot.lastUpdated
    ? new Date(snapshot.lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, duration: 0.4 }}
      className={nvCard}
    >
      <div className="p-4">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-4 -mt-1" />
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground tracking-wide">Global Markets</h2>
          </div>
          <div className="flex items-center gap-2">
            {updatePending && (
              <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse shrink-0">
                Refresh pending
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Atualizar mercados"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto scrollbar-hide pr-0.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 size={18} className="animate-spin text-primary/60" />
              <span className="text-[9px] font-mono text-muted-foreground/40 animate-pulse">Carregando dados reais...</span>
            </div>
          ) : (
            groups.map(group => (
              <GroupSection key={group.id} group={group} />
            ))
          )}
        </div>

        {/* ── Global Indicators ─────────────────────────────────────── */}
        <div className="mt-2 pt-2.5 border-t border-border/30 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-2 pt-1">
            <Flame size={9} className="text-primary/70" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">Global Indicators</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 px-1">
            <div className="flex items-center justify-between rounded-lg bg-secondary/25 px-2 py-1.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">Fear &amp; Greed</span>
              <span className={`text-[10px] font-mono font-bold ${fearGreedColor(indicators.fearGreed)}`}>
                {indicators.fearGreed} <span className="opacity-60 font-medium">{indicators.fearGreedLabel}</span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/25 px-2 py-1.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">BTC Dominance</span>
              <span className="text-[10px] font-mono font-bold text-primary">{indicators.btcDominance.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/25 px-2 py-1.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">Market Cap</span>
              <span className="text-[10px] font-mono font-bold text-foreground">{formatCompact(indicators.globalMarketCap)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/25 px-2 py-1.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">24h Volume</span>
              <span className="text-[10px] font-mono font-bold text-foreground">{formatCompact(indicators.volume24h)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
          <span className={'w-1.5 h-1.5 rounded-full ' + (updatePending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400/70') + ' shrink-0'} />
          <span>Auto a cada 30s</span>
          {lastUpdatedStr && (
            <>
              <span className="opacity-30">&bull;</span>
              <Clock size={8} className="opacity-40" />
              <span>{lastUpdatedStr}</span>
            </>
          )}
          <span className="ml-auto">Dados reais</span>
        </div>
      </div>
    </motion.div>
  );
}
