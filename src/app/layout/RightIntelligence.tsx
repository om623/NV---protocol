import { motion } from 'framer-motion';
import { Globe, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { GlobalMarketsProvider, MultiCategoryTicker, IndicatorsWidget } from '@/app/intelligence';
import { categoryRegistry } from '@/app/registry';
import { useWorkspace } from '@/app/workspace/useWorkspace';

/**
 * ─── Right Intelligence (right column) ────────────────────────────────────────
 * Fase 2: the Global Intelligence column is now LIVE.
 *   - MultiCategoryTicker: continuous scrolling market data.
 *   - IndicatorsWidget: Fear & Greed, BTC Dominance, Market Cap, Volume.
 *   - 14 market categories (from categoryRegistry) — clicking a category
 *     opens its panel in the central workspace via `useWorkspace().openCategory`.
 *
 * Architecture:
 *  - Data-driven: every section is generated from the registries. Adding a
 *    category/asset = registry entry, no component change.
 *  - The GlobalMarketsProvider is mounted here, above the widgets, so the
 *    right column and the category panels share the same live data context.
 *  - Fully prepared for Fase 3 (bottom ticker bar can reuse MultiCategoryTicker).
 */
export function RightIntelligence({ enabled = false }: RightIntelligenceProps) {
  if (!enabled) return null;

  return (
    <GlobalMarketsProvider>
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="w-72 shrink-0 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden xl:flex flex-col gap-3 p-4 overflow-y-auto"
      >
        <IntelligenceColumn />
      </motion.aside>
    </GlobalMarketsProvider>
  );
}

/**
 * ─── IntelligenceColumn ───────────────────────────────────────────────────────
 * Content of the Global Intelligence column (provider-agnostic).
 * Renders the live ticker, indicators and the market radar (categories).
 * Used both by RightIntelligence (standalone column) and embedded in the
 * legacy RightPanel (App.tsx) as the market section — single source of truth.
 */
export function IntelligenceColumn() {
  const { t } = useTranslation();
  const { openCategory } = useWorkspace();
  const categories = categoryRegistry.getAll();

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-0.5">
        <Globe size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground tracking-wide">{t('intelligence.title')}</h2>
      </div>

      {/* Live market ticker */}
      <div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden">
        <MultiCategoryTicker height={30} speed={45} />
      </div>

      {/* Quick indicators */}
      <div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden">
        <IndicatorsWidget />
      </div>

      {/* Market Radar / Categories */}
      <div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">
            {t('intelligence.marketRadar')}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/30 ml-auto">{categories.length}</span>
        </div>
        <div className="flex flex-col p-1.5 gap-0.5">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => openCategory(cat.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 text-left transition-colors duration-150 cursor-pointer group"
            >
              <span className="text-[13px] leading-none w-4 text-center shrink-0">{cat.icon}</span>
              <span className="flex-1 text-[11px] font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                {t(cat.labelKey)}
              </span>
              <ChevronRight size={10} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface RightIntelligenceProps {
  /** Fase 2: when enabled, the Global Intelligence column is rendered. */
  enabled?: boolean;
}

