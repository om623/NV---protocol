// ── Purchase UI helpers: same behaviour as the previous Profile screen ───────
// These render the state of the REAL, server-verified on-chain payment flow
// (usePurchases). Nothing here simulates a purchase.
import { Calendar, Check, CircleAlert as AlertCircle, ExternalLink, Loader as Loader2, Lock } from 'lucide-react';
import { useI18n } from '../i18n';
import type { LimitStatus, PurchaseState } from '../lib/payments';

export const BASE_EXPLORER_TX = 'https://basescan.org/tx';

export const isBusy = (s: PurchaseState, productId: string): boolean => s.status !== 'idle' && s.productId === productId;
export const canBuy = (limits: Record<string, LimitStatus>, productId: string): boolean => limits[productId]?.canBuyNow ?? true;

export function PurchaseStatusLine({ state, productId }: { state: PurchaseState; productId: string }) {
  const { t } = useI18n();
  if (state.productId !== productId || state.status === 'idle') return null;
  const cfg: Record<string, { Icon: typeof Loader2; text: string; color: string }> = {
    sending_tx: { Icon: Loader2, text: t('purchase.sendingTx'), color: 'text-amber-400' },
    verifying: { Icon: Loader2, text: t('purchase.verifying'), color: 'text-cyan-400' },
    confirmed: { Icon: Check, text: t('purchase.confirmed'), color: 'text-emerald-400' },
    failed: { Icon: AlertCircle, text: state.error ?? t('purchase.failed'), color: 'text-red-400' },
    limit_reached: { Icon: Lock, text: t('purchase.limitReached'), color: 'text-orange-400' },
  };
  const c = cfg[state.status];
  if (!c) return null;
  const spin = state.status === 'sending_tx' || state.status === 'verifying';
  return (
    <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-mono ${c.color}`} data-purchase-status={state.status}>
      <c.Icon size={11} className={spin ? 'animate-spin' : ''} />
      <span className="max-w-[160px] truncate">{c.text}</span>
      {state.txHash && (state.status === 'confirmed' || state.status === 'failed') && (
        <a href={`${BASE_EXPLORER_TX}/${state.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
          <ExternalLink size={9} /> {t('purchase.viewTx')}
        </a>
      )}
    </div>
  );
}

export function LimitBadge({ limits, productId }: { limits: Record<string, LimitStatus>; productId: string }) {
  const { t } = useI18n();
  const l = limits[productId];
  if (!l) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] font-mono text-muted-foreground/45">
      <Calendar size={8} />
      <span>{t('purchase.daily')}: {l.usedToday}/{l.maxPerDay}</span><span>·</span>
      <span>{t('purchase.weekly')}: {l.usedThisWeek}/{l.maxPerWeek}</span><span>·</span>
      <span>{t('purchase.monthly')}: {l.usedThisMonth}/{l.maxPerMonth}</span>
    </div>
  );
}

/** Label of a buy button, in the same priority order as before. */
export function buyLabel(t: (k: string) => string, o: { wallet: boolean; canBuy: boolean; busy: boolean; idle: string }): string {
  if (!o.wallet) return t('purchase.connectWallet');
  if (!o.canBuy) return t('purchase.limitReached');
  if (o.busy) return t('purchase.processing');
  return o.idle;
}
