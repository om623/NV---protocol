import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useGlobalMarkets } from '@/app/intelligence';
import { categoryRegistry, assetRegistry } from '@/app/registry';
import { MultiCategoryTicker } from './MultiCategoryTicker';
import { CategoryWidget } from './CategoryWidget';

/**
 * ─── CategoryPanel ───────────────────────────────────────────────────────────
 * Full-page category panel rendered by the ModuleRouter when a category is
 * selected from the Global Intelligence column (right column).
 *
 * Architecture:
 *  - Data-driven: receives a categoryId, reads from the GlobalMarketsProvider
 *    and the assetRegistry. No hardcoded category logic.
 *  - Supports multiple view modes (prepared for future cards/sparkline/heatmap).
 *  - Renders a full-width ticker at the top, then the category's assets in
 *    the selected view mode.
 *  - Used as the `panel` entry in the categoryRegistry for the ModuleRouter.
 *
 * Fase 2: renders a list layout. The ticker is scoped to the current category.
 */

interface CategoryPanelProps {
  categoryId: string;
}

export function CategoryPanel({ categoryId }: CategoryPanelProps) {
  const { t } = useTranslation();
  const { refreshCategory, lastUpdatedByCategory } = useGlobalMarkets();
  const [refreshing, setRefreshing] = useState(false);

  const category = categoryRegistry.get(categoryId);
  const assets = category ? assetRegistry.byCategory(categoryId) : [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCategory(categoryId);
    setTimeout(() => setRefreshing(false), 400);
  };

  const lastUpdated = lastUpdatedByCategory[categoryId];
  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (!category) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground/50 text-sm font-mono">
        {t('module.notFound')}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 p-4 max-w-[600px] mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-base">
            {category.icon}
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-foreground tracking-wide">
              {t(category.labelKey)}
            </h1>
            <span className="text-[9px] font-mono text-muted-foreground/40">
              {assets.length} {t('markets.title').toLowerCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedStr && (
            <span className="text-[8px] font-mono text-muted-foreground/30">
              {lastUpdatedStr}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 cursor-pointer"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* Ticker for this category */}
      <div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden px-2">
        <MultiCategoryTicker categoryId={categoryId} speed={35} height={28} />
      </div>

      {/* Category widget in full mode */}
      <div className="bg-card/80 border border-border/50 rounded-2xl p-3">
        <CategoryWidget categoryId={categoryId} compact={false} maxItems={100} />
      </div>
    </motion.div>
  );
}

