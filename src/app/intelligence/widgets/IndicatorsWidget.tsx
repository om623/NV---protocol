import { Flame, Clock, Globe, Database, BarChart3, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useGlobalMarkets } from '@/app/intelligence';

/**
 * ─── IndicatorsWidget ────────────────────────────────────────────────────────
 * Renders the Global Indicators section in the right column.
 *
 * Sources:
 *  - Fear & Greed: alternativeMe
 *  - BTC Dominance, Global Market Cap, Volume: CoinGecko global data
 *
 * Architecture:
 *  - Pure data consumer from GlobalMarketsProvider.
 *  - Prepared for future indicators (VIX, DXY, Fed Funds, CPI, Treasuries,
 *    PPI, PMI, Unemployment) — these will be added to the provider as new
 *    data sources are implemented, without changing this widget.
 *  - The indicatorRegistry defines the full list; this widget renders the
 *    subset that has live data.
 *
 * Fase 2: compact layout suitable for the right column.
 */

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

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

/* ─── Component ─────────────────────────────────────────────────────────────── */

export function IndicatorsWidget() {
  const { t } = useTranslation();
  const { indicators, loading } = useGlobalMarkets();

  const lastUpdatedStr = indicators.lastUpdated
    ? new Date(indicators.lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const fieldRow = 'flex items-center justify-between rounded-lg bg-secondary/25 px-2 py-1.5';

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 pt-1">
        <BarChart3 size={10} className="text-primary/70" />
        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">
          {t('intelligence.indicators')}
        </span>
        {loading && <Loader2 size={9} className="animate-spin text-primary/40 ml-auto" />}
      </div>

      {/* Fear & Greed */}
      <div className={fieldRow}>
        <div className="flex items-center gap-1.5">
          <Flame size={9} className="text-orange-400/70" />
          <span className="text-[9px] font-mono text-muted-foreground/50">{t('intelligence.fearGreed')}</span>
        </div>
        <span className={`text-[10px] font-mono font-bold ${fearGreedColor(indicators.fearGreed)}`}>
          {indicators.fearGreed}
          <span className="opacity-60 font-medium ml-1">{indicators.fearGreedLabel}</span>
        </span>
      </div>

      {/* BTC Dominance */}
      <div className={fieldRow}>
        <div className="flex items-center gap-1.5">
          <Database size={9} className="text-primary/70" />
          <span className="text-[9px] font-mono text-muted-foreground/50">{t('intelligence.btcDominance')}</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-primary">{indicators.btcDominance.toFixed(1)}%</span>
      </div>

      {/* Global Market Cap */}
      <div className={fieldRow}>
        <div className="flex items-center gap-1.5">
          <Globe size={9} className="text-emerald-400/70" />
          <span className="text-[9px] font-mono text-muted-foreground/50">{t('intelligence.marketCap')}</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-foreground">{formatCompact(indicators.globalMarketCap)}</span>
      </div>

      {/* 24h Volume */}
      <div className={fieldRow}>
        <div className="flex items-center gap-1.5">
          <BarChart3 size={9} className="text-violet-400/70" />
          <span className="text-[9px] font-mono text-muted-foreground/50">{t('intelligence.volume')}</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-foreground">{formatCompact(indicators.volume24h)}</span>
      </div>

      {/* Last updated */}
      {lastUpdatedStr && (
        <div className="flex items-center gap-1.5 px-2 pt-1 pb-0.5">
          <Clock size={8} className="text-muted-foreground/30" />
          <span className="text-[8px] font-mono text-muted-foreground/30">
            {t('intelligence.lastUpdate')}: {lastUpdatedStr}
          </span>
        </div>
      )}
    </div>
  );
}

