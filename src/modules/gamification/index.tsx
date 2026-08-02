import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * Gamification module — placeholder. Architecture is prepared to receive this
 * module as its own project within NV Protocol (concept to be defined later).
 */
export default function GamificationModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.gamification')} />;
}

