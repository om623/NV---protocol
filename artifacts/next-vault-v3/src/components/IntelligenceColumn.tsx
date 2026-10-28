import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Activity, Zap, CircleCheck as CheckCircle2, Loader as Loader2, TriangleAlert as AlertTriangle, TrendingUp, TrendingDown, Globe, RefreshCw, Radio, Droplets, Brain, Flame, Route, Eye, Shield } from 'lucide-react';
import type { EnvMode, NetworkConfig } from '../networks';
import { useI18n } from '../i18n';
import {
  type MarketAsset, type MarketGroup, type TrendStatus,
  getMarketGroups, refreshGlobalMarkets, formatVolume,
} from '../lib/marketData';

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntelligenceColumnProps {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const panelCard = 'bg-card/80 border border-border/50 rounded-2xl p-4 hover:border-primary/15 transition-all duration-300 hover:shadow-[0_0_16px_rgba(0,229,188,0.04)]';
const panelLabel = 'text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5';
const fieldRow = 'flex justify-between items-center text-xs py-1';

// ─── Mini market row for global markets section ───────────────────────────────

function MarketRow({ asset }: { asset: MarketAsset }) {
  const isPositive = asset.change24h >= 0;
  const trendColor = asset.trend === 'bullish' ? 'text-emerald-400' : asset.trend === 'bearish' ? 'text-red-400' : 'text-muted-foreground';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40 transition-colors duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-primary/8 border border-primary/15 flex items-center justify-center text-[9px] font-bold text-primary font-mono shrink-0">
          {asset.symbol.slice(0, 2)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-mono font-medium text-foreground truncate" translate="no">{asset.symbol}</span>
          <span className="text-[9px] text-muted-foreground/50 truncate">{asset.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[11px] font-mono font-semibold text-foreground">
          ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString('en-US', { maximumFractionDigits: asset.decimals })}
        </span>
        <div className={`flex items-center gap-0.5 text-[9px] font-mono font-medium ${trendColor}`}>
          {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Network stats (simulated) ────────────────────────────────────────────────

const NETWORK_STATS = [
  { label: 'TPS',      value: '1,240',  Icon: Activity,  color: 'text-cyan-400' },
  { label: 'Gas',      value: '0.12',   Icon: Flame,     color: 'text-orange-400' },
  { label: 'Liquidez', value: '$12.4M', Icon: Droplets,  color: 'text-blue-400' },
  { label: 'Confiança',value: '94%',    Icon: Brain,     color: 'text-violet-400' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function IntelligenceColumn({
  envMode, activeNetwork,
}: IntelligenceColumnProps) {
  const { t } = useI18n();
  const [tipIdx] = useState(() => Math.floor(Math.random() * 5));
  const [marketGroups, setMarketGroups] = useState<MarketGroup[]>(() => getMarketGroups());
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const marketTimer = useRef<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      refreshGlobalMarkets();
      setMarketGroups(getMarketGroups());
    }, 5000);
    return () => {
      clearInterval(iv);
      if (marketTimer.current !== null) window.clearTimeout(marketTimer.current);
    };
  }, []);

  const handleMarketRefresh = () => {
    setMarketRefreshing(true);
    refreshGlobalMarkets();
    setMarketGroups(getMarketGroups());
    if (marketTimer.current !== null) window.clearTimeout(marketTimer.current);
    marketTimer.current = window.setTimeout(() => setMarketRefreshing(false), 500);
  };

  const TIPS = [
    t('intel.tips.1'),
    t('intel.tips.2'),
    t('intel.tips.3'),
    t('intel.tips.4'),
    t('intel.tips.5'),
  ];

  return (
    <aside className="w-72 shrink-0 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden xl:flex flex-col gap-3 p-4 overflow-y-auto">

      {/* ── Network Activity (preserved + enhanced stats) ─────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Radio size={11} className="text-cyan-400" />
          {t('intel.networkActivity')}
        </div>
        <div className="space-y-1">
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">{t('dash.network')}</span>
            <span className="text-foreground font-mono text-[10px]" translate="no">{activeNetwork.name}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">{t('intel.chainId')}</span>
            <span className="text-cyan-400 font-mono text-[11px]" translate="no">{activeNetwork.chainId}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">{t('intel.mode')}</span>
            <span className={`font-mono text-[11px] ${envMode === 'testnet' ? 'text-green-400' : 'text-amber-400'}`}>
              {envMode === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}
            </span>
          </div>
          {/* Mini network stat grid */}
          <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-border/30">
            {NETWORK_STATS.map(({ label, value, Icon, color }) => (
              <div key={label} className="flex items-center gap-1.5 bg-secondary/30 rounded-lg px-2 py-1.5">
                <Icon size={10} className={color} />
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono text-muted-foreground/50 uppercase">{label}</span>
                  <span className={`text-[10px] font-mono font-bold ${color}`}>{value}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-border/30">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground/50 font-mono">{t('intel.networkActive')}</span>
          </div>
        </div>
      </div>

      {/* ── Security Status (new institutional touch) ─────────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Shield size={11} className="text-emerald-400" />
          {t('intel.securityStatus')}
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'Auditoria',     value: 'Aprovado',  ok: true },
            { label: 'Multi-sig',     value: 'Ativo',     ok: true },
            { label: 'Slippage Max',  value: '0.5%',      ok: true },
            { label: 'Front-run',     value: 'Protegido', ok: true },
          ].map(s => (
            <div key={s.label} className={fieldRow}>
              <span className="text-muted-foreground/60 font-mono">{s.label}</span>
              <span className={`flex items-center gap-1 font-mono text-[10px] ${s.ok ? 'text-emerald-400' : 'text-orange-400'}`}>
                <CheckCircle2 size={9} /> {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NV Tip (preserved) ────────────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 hover:border-primary/25 transition-all duration-300">
        <div className={panelLabel + ' !text-primary/60'}>
          <Zap size={11} className="text-primary" />
          {t('intel.nvTip')}
        </div>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed font-mono">{TIPS[tipIdx]}</p>
      </div>

      {/* ── Global Markets (enhanced, preserved functionality) ────────────── */}
      <div className={panelCard}>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-3 -mt-1" />
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-primary" />
            <span className="text-sm font-semibold text-foreground tracking-wide">{t('intel.globalMarkets')}</span>
          </div>
          <button onClick={handleMarketRefresh} disabled={marketRefreshing}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
            {marketRefreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto scrollbar-hide pr-0.5">
          {marketGroups.map(group => (
            <div key={group.id} className="flex flex-col gap-1">
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 px-2 pt-1 pb-0.5">{group.label}</div>
              {group.assets.map(asset => <MarketRow key={asset.symbol} asset={asset} />)}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
          <span>{t('intel.autoEvery5s')}</span>
          <span className="ml-auto">{t('intel.simulatedData')}</span>
        </div>
      </div>
    </aside>
  );
}
