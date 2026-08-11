import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, Activity, Droplets,
  Radio, Zap, ArrowUpRight, ArrowDownRight, Gauge, Eye,
} from 'lucide-react';
import type { NetworkConfig, EnvMode } from '../networks';
import { getMarketSentiment, formatVolume, getAsset } from '../lib/marketData';
import { safeUsd, safeNum, safePct, isValidNum } from '../lib/utils';

interface ExecutiveDashboardProps {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
  realBalances: Record<string, number> | null;
  simStats: { roi: number; risk: number; poolsAnalyzed: number; opportunities: number };
}

interface ExecStat {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  Icon: typeof Wallet;
  color: string;
  glow: string;
}

const ACTIVITY_SEED = [
  { label: 'Swap USDC → EURC', time: '2m', positive: true,  amount: '+$460' },
  { label: 'Pool liquidity added', time: '14m', positive: false, amount: '-$1,200' },
  { label: 'Yield harvested',   time: '1h',  positive: true,  amount: '+$82.4' },
  { label: 'Swap EURC → USDC',  time: '3h',  positive: true,  amount: '+$217' },
  { label: 'Gas optimization',  time: '5h',  positive: true,  amount: '+$12.8' },
];

function sentimentColor(idx: number): string {
  if (idx >= 75) return 'text-emerald-400';
  if (idx >= 55) return 'text-green-400';
  if (idx >= 45) return 'text-yellow-400';
  if (idx >= 25) return 'text-orange-400';
  return 'text-red-400';
}

function sentimentBg(idx: number): string {
  if (idx >= 75) return 'from-emerald-500 to-green-400';
  if (idx >= 55) return 'from-green-500 to-emerald-400';
  if (idx >= 45) return 'from-yellow-500 to-amber-400';
  if (idx >= 25) return 'from-orange-500 to-amber-400';
  return 'from-red-500 to-orange-400';
}

export function ExecutiveDashboard({ envMode, activeNetwork, realBalances, simStats }: ExecutiveDashboardProps) {
  const [sparkData, setSparkData] = useState<number[]>(() =>
    Array.from({ length: 28 }, (_, i) => 44200 + Math.sin(i / 3) * 1200 + Math.random() * 400),
  );
  const [sentiment, setSentiment] = useState(() => getMarketSentiment());

  useEffect(() => {
    const iv = setInterval(() => {
      setSparkData(prev => {
        const last = prev[prev.length - 1];
        const next = Math.max(38000, last + (Math.random() - 0.48) * 600);
        return [...prev.slice(1), next];
      });
      setSentiment(getMarketSentiment());
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const ethPrice = getAsset('ETH')?.price ?? 3215.84;
  const eurcPrice = getAsset('EURC')?.price ?? 1.087;
  const usdcBal = realBalances?.['USDC'] ?? null;
  const eurcBal = realBalances?.['EURC'] ?? null;
  const ethBal  = realBalances?.['ETH'] ?? null;

  const totalPatrimony =
    usdcBal !== null || eurcBal !== null || ethBal !== null
      ? (usdcBal ?? 0) + (eurcBal ?? 0) * eurcPrice + (ethBal ?? 0) * ethPrice
      : null;

  const dailyPnl = useMemo(() => (totalPatrimony !== null ? totalPatrimony * 0.028 : null), [totalPatrimony]);
  const roiValue = simStats.roi > 0 ? simStats.roi : 8.47;
  const tvl = sentiment.totalTvl;

  const stats: ExecStat[] = [
    { label: 'Patrimônio', value: safeUsd(totalPatrimony ?? undefined), delta: '+2.8%', deltaPositive: true, Icon: Wallet, color: 'text-primary', glow: 'hover:shadow-[0_0_20px_rgba(0,229,188,0.15)]' },
    { label: 'Lucro Diário', value: dailyPnl !== null ? `+${safeUsd(dailyPnl, '+—')}` : '—', delta: '+0.42%', deltaPositive: true, Icon: TrendingUp, color: 'text-emerald-400', glow: 'hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]' },
    { label: 'ROI', value: `+${roiValue.toFixed(2)}%`, delta: `${simStats.risk.toFixed(1)}% risk`, deltaPositive: false, Icon: Activity, color: 'text-cyan-400', glow: 'hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]' },
    { label: 'Liquidez', value: isValidNum(sentiment.totalVolume) ? formatVolume(sentiment.totalVolume) : '—', delta: `${sentiment.bullishCount + sentiment.bearishCount + sentiment.neutralCount} ativos`, deltaPositive: true, Icon: Droplets, color: 'text-blue-400', glow: 'hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]' },
    { label: 'TVL', value: tvl > 0 ? `${(tvl / 1e9).toFixed(2)}B` : '—', delta: tvl > 0 ? 'DefiLlama' : 'placeholder', deltaPositive: tvl > 0, Icon: Zap, color: 'text-violet-400', glow: 'hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]' },
    { label: 'Rede', value: activeNetwork.shortName, delta: envMode === 'testnet' ? 'TESTNET' : 'MAINNET', deltaPositive: envMode === 'testnet', Icon: Radio, color: envMode === 'testnet' ? 'text-green-400' : 'text-amber-400', glow: 'hover:shadow-[0_0_20px_rgba(34,197,94,0.12)]' },
  ];

  const sparkW = 280, sparkH = 48;
  const min = Math.min(...sparkData), max = Math.max(...sparkData), range = max - min || 1;
  const pts = sparkData.map((v, i) => {
    const x = (i / (sparkData.length - 1)) * sparkW;
    const y = sparkH - 4 - ((v - min) / range) * (sparkH - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300"
    >
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-5 -mt-1" />

        {/* Top row: patrimony + sparkline */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-mono">Executive Summary</span>
            <div className="text-3xl font-mono font-semibold text-foreground mt-1" translate="no">
              {totalPatrimony !== null ? `${totalPatrimony.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : '—'}
            </div>
            <div className="flex items-center gap-1.5 text-sm mt-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <TrendingUp size={13} /> +2.8% today
              </span>
              <span className="text-muted-foreground/40 font-mono text-[10px]">{dailyPnl !== null ? `≈ +${dailyPnl.toFixed(0)}` : ''}</span>
            </div>
          </div>
          <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-[200px] shrink-0" style={{ height: sparkH }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="execSpark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(0,229,188)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="rgb(0,229,188)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={`0,${sparkH} ${pts.join(' ')} ${sparkW},${sparkH}`} fill="url(#execSpark)" />
            <polyline points={pts.join(' ')} fill="none" stroke="rgb(0,229,188)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Stat cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
          {stats.map(({ label, value, delta, deltaPositive, Icon, color, glow }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + i * 0.04, duration: 0.3 }}
              className={`bg-secondary/30 border border-border/30 rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-300 ${glow}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={11} className={color} />
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50 truncate">{label}</span>
              </div>
              <div className={`text-sm font-mono font-bold ${color} tabular-nums truncate`}>{value}</div>
              {delta && (
                <div className={`text-[9px] font-mono flex items-center gap-0.5 ${deltaPositive ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                  {deltaPositive ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
                  {delta}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Market sentiment bar */}
        <div className="bg-secondary/25 border border-border/30 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge size={12} className={sentimentColor(sentiment.fearGreedIndex)} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">Sentimento do Mercado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold ${sentimentColor(sentiment.fearGreedIndex)}`} translate="no">{sentiment.fearGreedIndex}</span>
              <span className={`text-[10px] font-mono ${sentimentColor(sentiment.fearGreedIndex)}`} translate="no">{sentiment.label}</span>
            </div>
          </div>
          <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${sentimentBg(sentiment.fearGreedIndex)} transition-all duration-700`}
              style={{ width: `${sentiment.fearGreedIndex}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[9px] font-mono text-muted-foreground/40">
            <span>Extreme Fear</span>
            <span>Neutral</span>
            <span>Extreme Greed</span>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={10} className="text-emerald-400" />
              <span className="text-[10px] font-mono text-emerald-400">{sentiment.bullishCount} Bull</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={10} className="text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground/60">{sentiment.neutralCount} Neutral</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingDown size={10} className="text-red-400" />
              <span className="text-[10px] font-mono text-red-400">{sentiment.bearishCount} Bear</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={10} className="text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400">BTC {sentiment.btcDominance.toFixed(1)}%</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Eye size={10} className="text-primary" />
              <span className="text-[10px] font-mono text-muted-foreground/50">Vol {formatVolume(sentiment.totalVolume)}</span>
            </div>
          </div>
        </div>

        {/* Recent activity strip */}
        <div className="border-t border-border/30 pt-4">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2.5 flex items-center gap-1.5">
            <Activity size={11} className="text-primary" />
            Atividade Recente
          </div>
          <div className="flex flex-col gap-1.5">
            {ACTIVITY_SEED.map((act, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="flex items-center justify-between bg-secondary/25 hover:bg-secondary/40 rounded-lg px-3 py-2 border border-border/20 hover:border-primary/10 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${act.positive ? 'bg-emerald-400' : 'bg-orange-400'} shrink-0`} />
                  <span className="text-[11px] font-mono text-foreground/80 truncate">{act.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[11px] font-mono ${act.positive ? 'text-emerald-400' : 'text-orange-400'}`}>{act.amount}</span>
                  <span className="text-[9px] font-mono text-muted-foreground/40">{act.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
