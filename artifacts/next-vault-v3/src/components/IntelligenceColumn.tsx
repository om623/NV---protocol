import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartBar as BarChart2, Target, Activity, Factory as History, Zap, Clock, CircleCheck as CheckCircle2, Loader as Loader2, TriangleAlert as AlertTriangle, TrendingUp, TrendingDown, Globe, RefreshCw, Radio, Droplets, Brain, Flame, Route, Lightbulb, Eye, Shield } from 'lucide-react';
import type { EnvMode, NetworkConfig } from '../networks';
import type { SimHistoryItem } from '../App';
import {
  type MarketAsset, type MarketGroup, type TrendStatus,
  getMarketGroups, refreshGlobalMarkets, formatVolume,
} from '../lib/marketData';

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntelligenceColumnProps {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
  simStats: { balance: number; roi: number; risk: number; execTime: number; poolsAnalyzed: number; opportunities: number };
  simPhase: 'pipeline' | 'complete';
  simId: string;
  simHistory: SimHistoryItem[];
  simProgress: number;
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

// ─── Insights data (simulated institutional terminal feed) ────────────────────

interface InsightItem {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'event';
  title: string;
  detail: string;
  value?: string;
}

const INSIGHTS: InsightItem[] = [
  { id: '1', type: 'opportunity', title: 'Arbitrage Spread', detail: 'USDC/EURC spread detected on Arc pool', value: '+0.42%' },
  { id: '2', type: 'trend',       title: 'ETH Momentum',     detail: 'Bullish RSI cross on 4H timeframe',    value: '72.4' },
  { id: '3', type: 'risk',        title: 'Volatility Alert', detail: 'BTC 24h vol above 90-day average',     value: 'High' },
  { id: '4', type: 'event',       title: 'Gas Low Window',   detail: 'Optimal execution window in ~18m',     value: '~$0.42' },
  { id: '5', type: 'opportunity', title: 'Liquidity Pool',   detail: 'New high-yield pool on Sepolia',       value: '12.4% APY' },
];

const insightConfig = {
  opportunity: { Icon: Target,       color: 'text-emerald-400', bg: 'bg-emerald-500/8',  border: 'border-emerald-500/20' },
  risk:        { Icon: AlertTriangle,color: 'text-orange-400',  bg: 'bg-orange-500/8',   border: 'border-orange-500/20' },
  trend:       { Icon: TrendingUp,   color: 'text-cyan-400',    bg: 'bg-cyan-500/8',     border: 'border-cyan-500/20' },
  event:       { Icon: Clock,        color: 'text-violet-400',  bg: 'bg-violet-500/8',   border: 'border-violet-500/20' },
} as const;

// ─── Network stats (simulated) ────────────────────────────────────────────────

const NETWORK_STATS = [
  { label: 'TPS',      value: '1,240',  Icon: Activity,  color: 'text-cyan-400' },
  { label: 'Gas',      value: '0.12',   Icon: Flame,     color: 'text-orange-400' },
  { label: 'Liquidez', value: '$12.4M', Icon: Droplets,  color: 'text-blue-400' },
  { label: 'Confiança',value: '94%',    Icon: Brain,     color: 'text-violet-400' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function IntelligenceColumn({
  envMode, activeNetwork, simStats, simPhase, simId, simHistory, simProgress,
}: IntelligenceColumnProps) {
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

  const isRunning = simPhase === 'pipeline' && simStats.execTime > 0;
  const TIPS = [
    'Use Testnet para validar estratégias sem risco real.',
    'Pools com maior liquidez reduzem o slippage.',
    'Monitore o gas em horários de menor tráfego.',
    'Diversifique as rotas para maximizar o ROI.',
    'Arbitrum Sepolia tem fees mínimos para testes.',
  ];

  return (
    <aside className="w-72 shrink-0 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden xl:flex flex-col gap-3 p-4 overflow-y-auto">

      {/* ── Intelligence Insights ──────────────────────────────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Lightbulb size={11} className="text-primary" />
          Intelligence Insights
          <span className="ml-auto bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[9px]">{INSIGHTS.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {INSIGHTS.map((ins, i) => {
            const cfg = insightConfig[ins.type];
            return (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-lg p-2.5 border ${cfg.bg} ${cfg.border}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <cfg.Icon size={11} className={cfg.color} />
                    <span className="text-[10px] font-mono font-medium text-foreground">{ins.title}</span>
                  </div>
                  {ins.value && (
                    <span className={`text-[9px] font-mono font-bold ${cfg.color}`}>{ins.value}</span>
                  )}
                </div>
                <p className="text-[9px] font-mono text-muted-foreground/60 leading-relaxed">{ins.detail}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Simulation Summary (preserved from RightPanel) ────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <BarChart2 size={11} className="text-primary" />
          Resumo da Simulação
        </div>
        {simId ? (
          <div className="space-y-1">
            <div className={fieldRow}>
              <span className="text-muted-foreground/60 font-mono">ID</span>
              <span className="text-primary font-mono text-[11px]">{simId}</span>
            </div>
            <div className={fieldRow}>
              <span className="text-muted-foreground/60 font-mono">Status</span>
              <span className={`font-mono text-[11px] flex items-center gap-1 ${simPhase === 'complete' ? 'text-emerald-400' : isRunning ? 'text-cyan-400' : 'text-muted-foreground'}`}>
                {simPhase === 'complete' ? <CheckCircle2 size={10} /> : isRunning ? <Loader2 size={10} className="animate-spin" /> : null}
                {simPhase === 'complete' ? 'Concluído' : isRunning ? 'Em andamento' : 'Aguardando'}
              </span>
            </div>
            {simProgress > 0 && simPhase === 'pipeline' && (
              <div className="mt-2 mb-1">
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50 mb-1">
                  <span>Progresso</span><span>{Math.round(simProgress)}%</span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full"
                    style={{ width: `${simProgress}%` }} transition={{ ease: 'linear' }} />
                </div>
              </div>
            )}
            <div className={fieldRow}>
              <span className="text-muted-foreground/60 font-mono">ROI</span>
              <span className="text-emerald-400 font-mono text-[11px]">+{simStats.roi.toFixed(2)}%</span>
            </div>
            <div className={fieldRow}>
              <span className="text-muted-foreground/60 font-mono">Risco</span>
              <span className="text-yellow-400 font-mono text-[11px]">{simStats.risk.toFixed(1)}%</span>
            </div>
            <div className={fieldRow}>
              <span className="text-muted-foreground/60 font-mono">Pools</span>
              <span className="text-violet-400 font-mono text-[11px]">{simStats.poolsAnalyzed}</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/40 font-mono">Nenhuma simulação iniciada.</p>
        )}
      </div>

      {/* ── Current Opportunity (preserved) ───────────────────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Target size={11} className="text-orange-400" />
          Oportunidade Atual
        </div>
        <div className="space-y-2">
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">Oportunidades</span>
            <span className="text-orange-400 font-mono text-[11px] font-bold">{simStats.opportunities}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">Estratégia</span>
            <span className="text-foreground font-mono text-[10px]">Arbitrum v2</span>
          </div>
          <div className="mt-1">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                animate={{ width: `${Math.min(100, (simStats.opportunities / 7) * 100)}%` }}
                transition={{ ease: 'easeOut', duration: 0.6 }}
              />
            </div>
            <div className="text-[9px] text-muted-foreground/40 font-mono mt-1 text-right">{simStats.opportunities}/7 slots</div>
          </div>
        </div>
      </div>

      {/* ── Network Activity (preserved + enhanced stats) ─────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Radio size={11} className="text-cyan-400" />
          Atividade da Rede
        </div>
        <div className="space-y-1">
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">Rede</span>
            <span className="text-foreground font-mono text-[10px]" translate="no">{activeNetwork.name}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">Chain ID</span>
            <span className="text-cyan-400 font-mono text-[11px]" translate="no">{activeNetwork.chainId}</span>
          </div>
          <div className={fieldRow}>
            <span className="text-muted-foreground/60 font-mono">Modo</span>
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
            <span className="text-[10px] text-muted-foreground/50 font-mono">Rede ativa</span>
          </div>
        </div>
      </div>

      {/* ── Recent History (preserved) ────────────────────────────────────── */}
      {simHistory.length > 0 && (
        <div className={panelCard}>
          <div className={panelLabel}>
            <History size={11} className="text-primary" />
            Histórico Recente
            <span className="ml-auto bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[9px]">{simHistory.length}</span>
          </div>
          <div className="space-y-1.5">
            {simHistory.slice(0, 4).map(item => (
              <div key={item.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-2.5 py-1.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-primary">{item.id}</span>
                  <span className="text-[8px] text-muted-foreground/40 font-mono">{item.duration.toFixed(1)}s</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">+{item.roi.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Security Status (new institutional touch) ─────────────────────── */}
      <div className={panelCard}>
        <div className={panelLabel}>
          <Shield size={11} className="text-emerald-400" />
          Status de Segurança
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
          Dica NV Protocol
        </div>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed font-mono">{TIPS[tipIdx]}</p>
      </div>

      {/* ── Global Markets (enhanced, preserved functionality) ────────────── */}
      <div className={panelCard}>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-3 -mt-1" />
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-primary" />
            <span className="text-sm font-semibold text-foreground tracking-wide">Global Markets</span>
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
          <span>Auto a cada 5s</span>
          <span className="ml-auto">Dados simulados</span>
        </div>
      </div>
    </aside>
  );
}
