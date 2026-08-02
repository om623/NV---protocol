import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * History module — placeholder for Fase 0/1.
 * Will show the user's operation history when implemented.
 */
export default function HistoryModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.history')} />;
}

