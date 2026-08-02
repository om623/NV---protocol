import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * Swap module — Fase 0 structural stub.
 * The swap experience currently lives inside the `Home` monolith (App.tsx),
 * which still renders directly during Fase 0 (identity/UX unchanged).
 * In Fase 1 the swap UI is truly extracted into this module and wired to the
 * moduleRegistry + workspace. Until then this stub keeps the architecture
 * complete and the build green.
 */
export default function SwapModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.swap')} />;
}

