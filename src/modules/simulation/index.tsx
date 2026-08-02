import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * Simulation module — Fase 0 structural stub.
 * The simulation experience currently lives inside the `Home` monolith
 * (App.tsx), which still renders directly during Fase 0 (identity/UX unchanged).
 * In Fase 1 the simulation pipeline is extracted into this module and wired to
 * the moduleRegistry + workspace.
 */
export default function SimulationModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.simulation')} />;
}

