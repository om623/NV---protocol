import { useTranslation } from '@/i18n';

/**
 * Markets module — structural skeleton for Fase 0/1.
 * In Fase 2 this becomes the central panel for the selected market category
 * (opened via the Global Intelligence column). For now it renders a minimal
 * container so the module is registered and lazy-loadable.
 */
export default function MarketsModule() {
  const { t } = useTranslation();
  return (
    <div className="max-w-[520px] mx-auto px-4 pt-5 pb-10">
      <div className="text-sm font-mono text-muted-foreground/60">{t('markets.title')}</div>
      <div className="text-xs font-mono text-muted-foreground/40 mt-2">{t('markets.empty')}</div>
    </div>
  );
}

