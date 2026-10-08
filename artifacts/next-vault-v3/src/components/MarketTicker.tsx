// ─── NV Protocol — Market Ticker Tape ────────────────────────────────────────
// A horizontal, continuously-scrolling market tape showing real equity quotes
// for the locale selected by the user. Data comes from fetchEquityQuotes() which
// uses brapi.dev (Brazilian market, free) and Yahoo Finance via Supabase proxy.
// If a live source is unavailable the component shows the symbol + "—" change
// with an explicit "aguardando dado" indicator — no fabricated numbers.

import { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import {
  fetchEquityQuotes, getLocaleTickerList, formatEquityPrice, equityTypeBadge,
  type EquityQuote,
} from '../lib/equities';
import { useI18n } from '../i18n';

// ─── Type badge color by equity type ─────────────────────────────────────────
function typeBadgeStyle(type: string): string {
  switch (type) {
    case 'fii':      return 'text-violet-400 border-violet-400/30 bg-violet-400/8';
    case 'reit':     return 'text-indigo-400 border-indigo-400/30 bg-indigo-400/8';
    case 'etf':      return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/8';
    case 'smallcap': return 'text-amber-400 border-amber-400/30 bg-amber-400/8';
    default:         return 'text-primary/70 border-primary/20 bg-primary/8';
  }
}

// ─── Single ticker item ───────────────────────────────────────────────────────
function TickerItem({ quote }: { quote: EquityQuote }) {
  const positive = quote.change !== null ? quote.change >= 0 : null;
  const changeColor = positive === null
    ? 'text-muted-foreground/40'
    : positive ? 'text-emerald-400' : 'text-red-400';

  const priceStr = formatEquityPrice(quote.price, quote.currency);
  const changeStr = quote.change !== null
    ? `${positive ? '+' : ''}${quote.change.toFixed(2)}%`
    : '—';

  return (
    <span className="inline-flex items-center gap-2 px-4 shrink-0 select-none">
      {/* Type badge */}
      <span className={`text-[8px] font-mono px-1 py-px rounded border font-semibold tracking-widest ${typeBadgeStyle(quote.type)}`}>
        {equityTypeBadge(quote.type)}
      </span>

      {/* Symbol */}
      <span className="text-[11px] font-mono font-bold text-foreground/90 tracking-wide" translate="no">
        {quote.symbol}
      </span>

      {/* Price */}
      <span className="text-[11px] font-mono text-foreground/60 tabular-nums" translate="no">
        {priceStr}
      </span>

      {/* Change */}
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold tabular-nums ${changeColor}`} translate="no">
        {positive !== null && (
          positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />
        )}
        {changeStr}
      </span>

      {/* Separator dot */}
      <span className="text-muted-foreground/20 text-[10px] font-mono ml-1">·</span>
    </span>
  );
}

// ─── Loading state placeholder items ─────────────────────────────────────────
function LoadingItem({ idx }: { idx: number }) {
  const widths = ['w-12', 'w-16', 'w-10', 'w-14', 'w-12'];
  return (
    <span className="inline-flex items-center gap-2 px-4 shrink-0">
      <span className={`h-2 ${widths[idx % widths.length]} rounded bg-muted/30 animate-pulse`} />
      <span className="w-8 h-2 rounded bg-muted/20 animate-pulse" />
      <span className="text-muted-foreground/20 text-[10px] font-mono ml-1">·</span>
    </span>
  );
}

// ─── Scroll animation via CSS keyframes injected once ────────────────────────
const ANIMATION_ID = 'nv-ticker-keyframes';
function ensureTickerAnimation() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(ANIMATION_ID)) return;
  const style = document.createElement('style');
  style.id = ANIMATION_ID;
  style.textContent = `
    @keyframes nv-ticker-scroll {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .nv-ticker-track {
      animation: nv-ticker-scroll 45s linear infinite;
      will-change: transform;
    }
    .nv-ticker-track:hover {
      animation-play-state: paused;
    }
  `;
  document.head.appendChild(style);
}

// ─── Main MarketTicker component ──────────────────────────────────────────────
export function MarketTicker() {
  const { locale, t } = useI18n();
  const [quotes, setQuotes] = useState<EquityQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tickerList = getLocaleTickerList(locale);

  const loadQuotes = useCallback(async () => {
    try {
      const q = await fetchEquityQuotes(locale);
      setQuotes(q);
      setLastFetch(Date.now());
      setError(null);
    } catch {
      setError(t('ticker.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  // Initial load + locale change
  useEffect(() => {
    setLoading(true);
    setQuotes([]);
    loadQuotes();
  }, [loadQuotes]);

  // Periodic refresh every 5 minutes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { loadQuotes(); }, 2 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadQuotes]);

  // Inject CSS animation once
  useEffect(() => { ensureTickerAnimation(); }, []);

  const liveCount = quotes.filter(q => q.isLive).length;
  const hasAnyLive = liveCount > 0;

  // Build the items for display (we'll duplicate for seamless loop)
  const items = loading
    ? Array.from({ length: 12 }, (_, i) => i)
    : quotes;

  // Relative time label
  const ageLabel = lastFetch
    ? (() => {
        const diffMs = Date.now() - lastFetch;
        if (diffMs < 60_000) return t('ticker.justNow');
        const mins = Math.floor(diffMs / 60_000);
        return `${mins}m`;
      })()
    : null;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#080e10]/95 backdrop-blur-md shadow-[0_2px_16px_rgba(0,0,0,0.4)] relative">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
        {/* Market label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${hasAnyLive ? 'bg-primary animate-pulse' : 'bg-amber-500/60'}`} />
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">
            {tickerList.marketLabel}
          </span>
          {hasAnyLive && (
            <span className="text-[8px] font-mono text-primary/60 tracking-wider">
              {liveCount}/{quotes.length} {t('ticker.live')}
            </span>
          )}
          {!hasAnyLive && !loading && (
            <span className="flex items-center gap-1 text-[8px] font-mono text-amber-500/60">
              <AlertCircle size={8} />
              {t('ticker.apiPending')}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Age + refresh */}
        {ageLabel && (
          <span className="text-[8px] font-mono text-muted-foreground/30 shrink-0">{ageLabel}</span>
        )}
        <button
          onClick={() => { setLoading(true); loadQuotes(); }}
          className="p-0.5 rounded hover:bg-secondary/40 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors cursor-pointer shrink-0"
          title={t('ticker.refresh')}
        >
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono text-red-400/60">
          <AlertCircle size={10} />
          {error}
        </div>
      )}

      {/* Tape */}
      {!error && (
        <div className="relative overflow-hidden py-2" aria-label={t('ticker.ariaLabel')}>
          {/* Left fade */}
          <div className="absolute inset-y-0 left-0 w-10 z-10 pointer-events-none bg-gradient-to-r from-[#080e10] to-transparent" />
          {/* Right fade */}
          <div className="absolute inset-y-0 right-0 w-10 z-10 pointer-events-none bg-gradient-to-l from-[#080e10] to-transparent" />

          {/* Scrolling track — doubled content for seamless loop */}
          <div className="nv-ticker-track flex whitespace-nowrap" style={{ width: 'max-content' }}>
            {/* First copy */}
            <span className="inline-flex items-center">
              {loading
                ? items.map(i => <LoadingItem key={`a-${i}`} idx={i as number} />)
                : (items as EquityQuote[]).map(q => <TickerItem key={`a-${q.symbol}`} quote={q} />)
              }
            </span>
            {/* Second copy for seamless loop */}
            <span className="inline-flex items-center" aria-hidden="true">
              {loading
                ? items.map(i => <LoadingItem key={`b-${i}`} idx={i as number} />)
                : (items as EquityQuote[]).map(q => <TickerItem key={`b-${q.symbol}`} quote={q} />)
              }
            </span>
          </div>
        </div>
      )}

      {/* API config notice — shown only if zero live quotes after loading */}
      {!loading && !hasAnyLive && !error && quotes.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-white/[0.04] bg-amber-500/5">
          <Activity size={9} className="text-amber-500/50 shrink-0" />
          <span className="text-[8px] font-mono text-amber-500/50 leading-tight">
            {t('ticker.noLiveDesc')}
          </span>
        </div>
      )}
    </div>
  );
}
