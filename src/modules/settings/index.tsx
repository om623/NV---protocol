import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * Settings module — placeholder for Fase 0/1.
 * Will host app configuration, network preferences and language selection.
 */
export default function SettingsModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.settings')} />;
}

