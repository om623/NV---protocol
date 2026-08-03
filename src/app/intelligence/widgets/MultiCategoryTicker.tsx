import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useGlobalMarkets } from '@/app/intelligence';
import { assetRegistry } from '@/app/registry';

/**
 * ─── MultiCategoryTicker ─────────────────────────────────────────────────────
 * A continuous horizontal ticker that scrolls market data without stuttering.
 *
 * Architecture:
 *  - Data-driven: gathers all assets marked `display.ticker: true` from the
 *    assetRegistry. Adding an asset to the ticker = setting `ticker: true` in
 *    its registry entry.
 *  - Category-agnostic: the ticker renders ALL categories simultaneously.
 *  - Prepared for future category/topic switching (Forex, Commodities, Crypto,
 *    Indices, Economic News). The `categoryId` prop allows scoping.
 *  - Pure CSS animation (no JS frame updates) for smooth, stutter-free scrolling.
 *    The content is duplicated so the scroll loop is seamless.
 *
 * Fase 2: rendered inside the IntelligenceColumn (right column, w-72).
 * When the bottom ticker bar (Fase 3) is implemented, this component can be
 * reused there with a different container width.
 */

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function formatPrice(price: number, decimals: number): string {
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface MultiCategoryTickerProps {
  /** Optional: show only assets from this category. Default: all ticker assets. */
  categoryId?: string;
  /** Animation duration in seconds (lower = faster) */
  speed?: number;
  /** Height of the ticker bar */
  height?: number;
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export function MultiCategoryTicker({
  categoryId,
  speed = 40,
  height = 32,
}: MultiCategoryTickerProps) {
  const { byAssetId } = useGlobalMarkets();

  // Get assets to display
  const tickerAssets = useMemo(() => {
    const all = assetRegistry.getAll().filter(a => a.display.ticker);
    return categoryId ? all.filter(a => a.category === categoryId) : all;
  }, [categoryId]);

  // If no assets, render nothing
  if (tickerAssets.length === 0) return null;

  // Duplicate the items for seamless scroll
  const items = [...tickerAssets, ...tickerAssets];

  return (
    <div
      className="relative overflow-hidden w-full"
      style={{ height }}
    >
      {/* Gradient fade masks on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/* Scrolling track */}
      <div
        className="flex items-center gap-4 whitespace-nowrap"
        style={{
          animation: `ticker-scroll ${speed}s linear infinite`,
          width: 'max-content',
        }}
      >
        {items.map((asset, i) => {
          const quote = byAssetId[asset.id];
          const price = quote?.price ?? 0;
          const change = quote?.change24h ?? 0;
          const isPositive = change >= 0;

          return (
            <div
              key={`${asset.id}-${i}`}
              className="inline-flex items-center gap-1.5 shrink-0"
            >
              <span className="text-[9px] font-mono font-semibold text-foreground/80">
                {asset.symbol}
              </span>
              <span className="text-[9px] font-mono text-foreground/60">
                {price === 0 ? '—' : '$' + formatPrice(price, asset.decimals)}
              </span>
              <div className={`flex items-center gap-0.5 text-[8px] font-mono font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </div>
              <div className="w-px h-3 bg-border/30 mx-1" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

