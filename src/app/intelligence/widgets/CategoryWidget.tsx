import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useGlobalMarkets } from '@/app/intelligence';
import { categoryRegistry, assetRegistry } from '@/app/registry';
import type { CategoryViewMode, Quote } from '@/app/registry/types';

/**
 * ─── CategoryWidget ──────────────────────────────────────────────────────────
 * A fully data-driven, generic intelligence widget. It receives a categoryId
 * and renders that category's assets using the GlobalMarketsProvider.
 *
 * Architecture:
 *  - Pure data consumer: reads from `useGlobalMarkets()` + `assetRegistry`.
 *  - Adding an asset or category requires NO changes to this widget — only a
 *    registry entry.
 *  - View modes are prepared for future expansion. The current implementation
 *    renders the default 'list' mode. The `viewModes` field on the category
 *    drives the selector UI (when more modes are implemented).
 *  - Future modes (cards, sparkline, heatmap, table) are declared in the type
 *    system and can be added without touching the widget logic.
 *
 * Fase 2: renders a compact asset list suitable for the right column.
 */

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function formatPrice(price: number, decimals: number): string {
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

function AssetRow({ asset, quote }: { asset: { id: string; symbol: string; name: string; decimals: number }; quote?: Quote }) {
  const isPositive = (quote?.change24h ?? 0) >= 0;
  const price = quote?.price ?? 0;
  const change = quote?.change24h ?? 0;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40 transition-colors duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-md bg-primary/8 border border-primary/15 flex items-center justify-center text-[8px] font-bold text-primary font-mono shrink-0">
          {asset.symbol.slice(0, 2)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-mono font-medium text-foreground truncate">{asset.symbol}</span>
          <span className="text-[8px] text-muted-foreground/50 truncate">{asset.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[11px] font-mono font-semibold text-foreground">
          {price === 0 ? '—' : '$' + formatPrice(price, asset.decimals)}
        </span>
        <div className={`flex items-center gap-0.5 text-[9px] font-mono font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {price === 0 ? (
            <span className="text-[8px] text-muted-foreground/40">N/A</span>
          ) : (
            <>
              {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface CategoryWidgetProps {
  /** Which category to render (must exist in categoryRegistry) */
  categoryId: string;
  /** Compact mode for the right column (default true) */
  compact?: boolean;
  /** Max items to show before truncating */
  maxItems?: number;
  /** Show a view-mode selector (future) */
  showViewMode?: boolean;
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export function CategoryWidget({
  categoryId,
  compact = true,
  maxItems = 20,
  showViewMode = false,
}: CategoryWidgetProps) {
  const { t } = useTranslation();
  const { byAssetId, refreshCategory, lastUpdatedByCategory } = useGlobalMarkets();
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<CategoryViewMode>('list');

  const category = categoryRegistry.get(categoryId);
  const assets = category ? assetRegistry.byCategory(categoryId) : [];
  const viewModes = category?.viewModes;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCategory(categoryId);
    setTimeout(() => setRefreshing(false), 400);
  };

  const lastUpdated = lastUpdatedByCategory[categoryId];
  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (!category) return null;
  if (assets.length === 0) {
    return (
      <div className="text-[10px] font-mono text-muted-foreground/40 text-center py-4">
        {t('markets.empty')}
      </div>
    );
  }

  const displayedAssets = assets.slice(0, maxItems);

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm leading-none">{category.icon}</span>
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">
            {t(category.labelKey)}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/30">{assets.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode selector (prepared for future implementation) */}
          {showViewMode && viewModes && viewModes.length > 1 && (
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value as CategoryViewMode)}
              className="text-[8px] font-mono bg-transparent border border-border/30 rounded px-1 py-0.5 text-muted-foreground/50"
            >
              {viewModes.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 rounded hover:bg-secondary text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-40 cursor-pointer"
            aria-label={`Atualizar ${t(category.labelKey)}`}
          >
            {refreshing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          </button>
        </div>
      </div>

      {/* Assets list */}
      <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto scrollbar-hide pr-0.5">
        {displayedAssets.map((asset, i) => (
          <motion.div
            key={asset.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
          >
            <AssetRow asset={asset} quote={byAssetId[asset.id]} />
          </motion.div>
        ))}
      </div>

      {/* Last updated */}
      {lastUpdatedStr && (
        <div className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground/30 px-2 pt-0.5">
          <span className="w-1 h-1 rounded-full bg-emerald-400/50" />
          <span>{lastUpdatedStr}</span>
        </div>
      )}
    </div>
  );
}

