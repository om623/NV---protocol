import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, RefreshCw, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  type MarketAsset,
  type MarketGroup,
  getMarketGroups,
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
        <span className="text-[11px] font-mono font-semibold text-foreground">${formatPrice(asset)}</span>
        <div className={`flex items-center gap-0.5 text-[9px] font-mono font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
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
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshGlobalMarkets();
      setGroups(getMarketGroups());
    }, 5000);
    return () => {
      clearInterval(interval);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshGlobalMarkets();
    setGroups(getMarketGroups());
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 500);
  }, []);

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
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Atualizar mercados"
          >
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>

        <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto scrollbar-hide pr-0.5">
          {groups.map(group => (
            <GroupSection key={group.id} group={group} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
          <span>Auto a cada 5s</span>
          <span className="ml-auto">Dados simulados</span>
        </div>
      </div>
    </motion.div>
  );
}
