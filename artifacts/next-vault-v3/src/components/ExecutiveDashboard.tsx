import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Activity, Droplets,
  Radio, Zap, ArrowUpRight, ArrowDownRight, Gauge, Eye, Percent,
} from 'lucide-react';
import type { NetworkConfig, EnvMode } from '../networks';
import { getMarketSentiment, formatVolume, getAsset } from '../lib/marketData';
import { fetchInflation, type InflationQuote } from '../lib/inflation';
import { fetchPolicyRate, type PolicyRateQuote } from '../lib/policyRate';
import { isValidNum } from '../lib/utils';
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
  meta?: string;
  Icon: typeof Activity;
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

export function ExecutiveDashboard({ envMode, activeNetwork }: ExecutiveDashboardProps) {
  const { t, locale } = useI18n();
  const fmt = useFormat();
  const [sentiment, setSentiment] = useState(() => getMarketSentiment());
  const [inflation, setInflation] = useState<InflationQuote | null>(null);
  const [policyRate, setPolicyRate] = useState<PolicyRateQuote | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const btc = getAsset('BTC');
  const sparkData = btc?.spark?.filter(v => Number.isFinite(v) && v > 0) ?? [];

  useEffect(() => {
    const iv = setInterval(() => setSentiment(getMarketSentiment()), 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let active = true;
    setInflation(null);
    fetchInflation(locale).then(quote => {
      if (active) setInflation(quote);
    });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    let active = true;
    setPolicyRate(null);
    fetchPolicyRate(locale).then(quote => { if (active) setPolicyRate(quote); });
    return () => { active = false; };
  }, [locale]);

  const tvl = sentiment.totalTvl;
  const inflationCountry = inflation ? (new Intl.DisplayNames([fmt.bcp], { type: 'region' }).of(inflation.countryCode) ?? inflation.countryCode) : '';
  const policyRateCountry = policyRate ? (new Intl.DisplayNames([fmt.bcp], { type: 'region' }).of(policyRate.countryCode) ?? policyRate.countryCode) : '';

  const stats: ExecStat[] = [
    { label: t('dash.inflation'), value: inflation ? fmt.percent(inflation.value) : '—', meta: inflation ? `${inflationCountry} · World Bank · ${inflation.year}` : t('dash.inflationUnavailable'), Icon: Activity, color: 'text-amber-400', glow: 'hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]' },
    { label: t('dash.policyRate'), value: policyRate ? fmt.percent(policyRate.value) : '—', meta: policyRate ? `${policyRateCountry} · BIS · ${policyRate.date}` : t('dash.policyRateUnavailable'), Icon: Percent, color: 'text-cyan-400', glow: 'hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]' },
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
        <div
          className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-5"
          onMouseLeave={() => setExpandedCard(null)}
        >
          {stats.map(({ label, value, delta, deltaPositive, meta, Icon, color, glow }, i) => {
            const isExpanded = expandedCard === label;
            const detail = label === t('dash.inflation')
              ? t('dash.inflationAnnual')
              : label === t('dash.policyRate')
                ? t('dash.policyRateDescription')
                : label === t('dash.liquidity')
                  ? `${sentiment.bullishCount} ${t('dash.bull')} · ${sentiment.neutralCount} ${t('dash.neutral')} · ${sentiment.bearishCount} ${t('dash.bear')}`
                  : label === t('dash.tvl')
                    ? (tvl > 0 ? 'DefiLlama · Total Value Locked' : t('dash.unavailable'))
                    : `${activeNetwork.name} · ${envMode === 'testnet' ? t('net.testnet') : t('net.mainnet')}`;
            return (
              <motion.button
                key={label}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.04, duration: 0.3 }}
                onMouseEnter={() => setExpandedCard(label)}
                onFocus={() => setExpandedCard(label)}
                onClick={() => setExpandedCard(current => current === label ? null : label)}
                aria-expanded={isExpanded}
                className={`text-left min-w-0 bg-secondary/30 border rounded-xl p-3 flex flex-col gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${isExpanded ? 'border-primary/40 bg-secondary/55' : 'border-border/30'} ${glow}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon size={13} className={color} />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 truncate">{label}</span>
                </div>
                <div className={`text-sm font-mono font-bold ${color} tabular-nums truncate`}>{value}</div>
                {delta && (
                  <div className={`text-[9px] font-mono flex items-center gap-0.5 ${deltaPositive ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                    {deltaPositive ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
                    {delta}
                  </div>
                )}
                {meta && <div className="text-[9px] font-mono text-muted-foreground/50 truncate" title={label === t('dash.inflation') ? t('dash.inflationAnnual') : t('dash.policyRateDescription')}>{meta}</div>}
                <span className="sr-only">{isExpanded ? 'Details expanded' : 'Show details'}</span>
              </motion.button>
            );
          })}
          {expandedCard && (() => {
            const selected = stats.find(stat => stat.label === expandedCard);
            if (!selected) return null;
            const detail = selected.label === t('dash.inflation')
              ? t('dash.inflationAnnual')
              : selected.label === t('dash.policyRate')
                ? t('dash.policyRateDescription')
                : selected.label === t('dash.liquidity')
                  ? `${sentiment.bullishCount} ${t('dash.bull')} · ${sentiment.neutralCount} ${t('dash.neutral')} · ${sentiment.bearishCount} ${t('dash.bear')}`
                  : selected.label === t('dash.tvl')
                    ? (tvl > 0 ? 'DefiLlama · Total Value Locked' : t('dash.unavailable'))
                    : `${activeNetwork.name} · ${envMode === 'testnet' ? t('net.testnet') : t('net.mainnet')}`;
            return (
              <motion.div
                key={expandedCard}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                role="status"
                className="col-span-full min-w-0 rounded-lg border border-primary/20 bg-secondary/35 px-3 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <selected.Icon size={13} className={selected.color} />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/80">{selected.label}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground break-words">{detail}</span>
                <span className={`text-xs font-mono font-semibold ${selected.color}`}>{selected.value}</span>
              </motion.div>
            );
          })()}
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
