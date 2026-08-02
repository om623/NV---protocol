import { ModulePlaceholder } from '@/components/shared/ModulePlaceholder';
import { useTranslation } from '@/i18n';

/**
 * Wallet module — Fase 0 structural stub.
 * The wallet experience currently lives inside the `Home` monolith (App.tsx),
 * which still renders directly during Fase 0 (identity/UX unchanged).
 * In Fase 1 the wallet view (`WalletView`) is extracted into this module and
 * wired to the moduleRegistry + workspace.
 */
export default function WalletModule() {
  const { t } = useTranslation();
  return <ModulePlaceholder moduleLabel={t('nav.wallet')} />;
}

