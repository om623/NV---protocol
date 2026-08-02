import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * Bridge module — placeholder for Fase 0/1.
 * The architecture is ready; bridge logic will be implemented in a later phase.
 */
export default function BridgeModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.bridge')} />;
}

