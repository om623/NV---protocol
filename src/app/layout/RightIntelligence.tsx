import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface RightIntelligenceProps {
  /** Fase 0/1: reserved zone — keeps the current layout without rendering. */
  enabled?: boolean;
}

/**
 * ─── Right Intelligence (right column) ────────────────────────────────────────
 * Born in Fase 0 as a reserved zone. It will host, in Fase 2:
 *   - Quick indicators: Fear & Greed, BTC Dominance, Global Market Cap,
 *     Global Volume, Última atualização, Radar do Mercado.
 *   - The 14 market categories (each opens its panel in the workspace).
 * Until Fase 2, it renders null to preserve the exact current visuals.
 */
export function RightIntelligence({ enabled = false }: RightIntelligenceProps) {
  const { t } = useTranslation();

  if (!enabled) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="w-72 shrink-0 border-l border-border/40 bg-background/60 backdrop-blur-sm hidden xl:flex flex-col gap-3 p-4 overflow-y-auto"
    >
      <div className="flex items-center gap-2 px-0.5">
        <Globe size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground tracking-wide">{t('intelligence.title')}</h2>
      </div>
      {/* Indicators + categories are wired here in Fase 2 */}
    </motion.aside>
  );
}

