import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, Activity, Droplets,
  Radio, Zap, ArrowUpRight, ArrowDownRight, Gauge, Eye,
} from 'lucide-react';
import type { NetworkConfig, EnvMode } from '../networks';
import { getMarketSentiment, formatVolume, getAsset } from '../lib/marketData';
import { safeUsd, isValidNum } from '../lib/utils';
import { useI18n, useFormat } from '../i18n';

interface ExecutiveDashboardProps {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
  realBalances: Record<string, number> | null;
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

export function ExecutiveDashboard({ envMode, activeNetwork, realBalances }: ExecutiveDashboardProps) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [sentiment, setSentiment] = useState(() => getMarketSentiment());
  const btc = getAsset('BTC');
  const sparkData = btc?.spark?.filter(v => Number.isFinite(v) && v > 0) ?? [];

  useEffect(() => {
    const iv = setInterval(() => setSentiment(getMarketSentiment()), 15000);
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

  const tvl = sentiment.totalTvl;

  const stats: ExecStat[] = [
    { label: t('dash.patrimony'), value: safeUsd(totalPatrimony ?? undefined), Icon: Wallet, color: 'text-primary', glow: 'hover:shadow-[0_0_20px_rgba(0,229,188,0.15)]' },
    { label: t('dash.dailyProfit'), value: '—', Icon: TrendingUp, color: 'text-emerald-400', glow: 'hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]' },
    { label: t('dash.roi'), value: '—', Icon: Activity, color: 'text-cyan-400', glow: 'hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]' },
    { label: t('dash.liquidity'), value: isValidNum(sentiment.totalVolume) ? formatVolume(sentiment.totalVolume) : '—', delta: `${sentiment.bullishCount + sentiment.bearishCount + sentiment.neutralCount} ${t('dash.assets')}`, deltaPositive: true, Icon: Droplets, color: 'text-blue-400', glow: 'hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]' },
    { label: t('dash.tvl'), value: tvl > 0 ? fmt.compact(tvl) : '—', delta: tvl > 0 ? 'DefiLlama' : 'placeholder', deltaPositive: tvl > 0, Icon: Zap, color: 'text-violet-400', glow: 'hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]' },
    { label: t('dash.network'), value: activeNetwork.shortName, delta: envMode === 'testnet' ? t('net.testnet') : t('net.mainnet'), deltaPositive: envMode === 'testnet', Icon: Radio, color: envMode === 'testnet' ? 'text-green-400' : 'text-amber-400', glow: 'hover:shadow-[0_0_20px_rgba(34,197,94,0.12)]' },
  ];

  const sparkW = 520, sparkH = 82;
  const chartData = sparkData.length > 1 ? sparkData : [];
  const min = chartData.length ? Math.min(...chartData) : 0;
  const max = chartData.length ? Math.max(...chartData) : 1;
  const range = max - min || Math.max(1, max * 0.001);
  const pts = chartData.map((v, i) => {
    const x = (i / (chartData.length - 1)) * sparkW;
    const y = sparkH - 8 - ((v - min) / range) * (sparkH - 16);
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

        {/* Bitcoin chart sourced from Global Markets */}
        <div className="mb-5 rounded-xl border border-border/30 bg-secondary/15 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">₿</div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/55 font-mono">Bitcoin · BTC/USD</div>
                <div className="text-lg sm:text-xl font-mono font-bold text-foreground tabular-nums">{btc?.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(btc.price) : 'Preço indisponível'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-mono font-semibold ${(btc?.change24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {btc ? `${btc.change24h >= 0 ? '+' : ''}${btc.change24h.toFixed(2)}% (24h)` : '—'}
              </div>
              <div className="text-[9px] text-muted-foreground/45 font-mono mt-1">{btc?.isLive ? 'Fonte de mercado ao vivo' : 'Indicativo · aguardando cotação ao vivo'}</div>
            </div>
          </div>
          <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-full" style={{ height: 'clamp(76px, 11vw, 104px)' }} preserveAspectRatio="none" role="img" aria-label="Gráfico de tendência do Bitcoin em Global Markets">
            <defs><linearGradient id="execBtcSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(34,211,238)" stopOpacity={0.22} /><stop offset="100%" stopColor="rgb(34,211,238)" stopOpacity={0} /></linearGradient></defs>
            {chartData.length > 1 && <><polygon points={`0,${sparkH} ${pts.join(' ')} ${sparkW},${sparkH}`} fill="url(#execBtcSpark)" /><polyline points={pts.join(' ')} fill="none" stroke="rgb(34,211,238)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></>}
            {chartData.length < 2 && <text x="50%" y="50%" fill="currentColor" opacity=".5" fontSize="12" textAnchor="middle">Aguardando dados de mercado…</text>}
          </svg>
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground/35 mt-1"><span>Histórico disponível</span><span>Atualiza com Global Markets</span></div>
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
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">{t('dash.marketSentiment')}</span>
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
            <span>{t('dash.extremeFear')}</span>
            <span>{t('dash.neutral')}</span>
            <span>{t('dash.extremeGreed')}</span>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={10} className="text-emerald-400" />
              <span className="text-[10px] font-mono text-emerald-400">{sentiment.bullishCount} {t('dash.bull')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={10} className="text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground/60">{sentiment.neutralCount} {t('dash.neutral')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingDown size={10} className="text-red-400" />
              <span className="text-[10px] font-mono text-red-400">{sentiment.bearishCount} {t('dash.bear')}</span>
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


      </div>
    </motion.div>
  );
}
