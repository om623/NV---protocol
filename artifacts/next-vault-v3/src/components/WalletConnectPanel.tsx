import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Copy, Check, RefreshCw, AlertTriangle, Loader as Loader2, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import type { WalletInfo } from '../lib/walletDiscovery';
import {
  connectWalletConnect,
  getWalletConnectDiagnostics,
  isWalletConnectConfigured,
  WalletConnectError,
  type WalletConnectErrorCode,
} from '../lib/walletConnect';

interface WalletConnectPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called once the user approved the pairing in their wallet. */
  onConnected: (wallet: WalletInfo) => void | Promise<void>;
}

type PanelState =
  | { kind: 'preparing' }
  | { kind: 'awaiting'; uri: string }
  | { kind: 'error'; code: WalletConnectErrorCode };

const isMobileDevice = (): boolean =>
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Floating WalletConnect pairing window.
 * Deliberately has NO full-screen backdrop: the Dashboard stays visible and usable.
 */
/** Development only: what the SDK and the relay sockets did, as plain counters (never a URL or a token). */
function DevDiagnostics() {
  const [d, setD] = useState(getWalletConnectDiagnostics());
  useEffect(() => {
    const id = window.setInterval(() => setD(getWalletConnectDiagnostics()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!d) return null;
  const ms = (v?: number) => (v === undefined ? '...' : `${v} ms`);
  return (
    <p data-testid="wc-diagnostics" className="font-mono text-[9px] leading-relaxed text-muted-foreground/50 break-words">
      dev diagnostics: SDK import {ms(d.importMs)}, init {ms(d.initMs)}, QR {ms(d.uriMs)}. Relay sockets: {d.sockets} created, {d.opened} opened,
      {' '}{d.errors} errors, closed with {JSON.stringify(d.closes)}{d.lastLivedMs !== undefined ? `, last lived ${d.lastLivedMs} ms` : ''}.
    </p>
  );
}

export function WalletConnectPanel({ open, onClose, onConnected }: WalletConnectPanelProps) {
  const { t } = useI18n();
  const [state, setState] = useState<PanelState>({ kind: 'preparing' });
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  // Start / restart the pairing whenever the panel opens or the user retries.
  useEffect(() => {
    if (!open) return;
    if (!isWalletConnectConfigured()) {
      setState({ kind: 'error', code: 'not-configured' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'preparing' });
    setQr(null);
    setCopied(false);

    connectWalletConnect((uri) => setState({ kind: 'awaiting', uri }), controller.signal)
      .then((wallet) => {
        if (!controller.signal.aborted) void onConnectedRef.current(wallet);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const code = err instanceof WalletConnectError ? err.code : 'failed';
        if (code === 'cancelled') return;
        setState({ kind: 'error', code });
      });

    return () => controller.abort();
  }, [open, attempt]);

  // Render the QR Code for the current pairing URI.
  const uri = state.kind === 'awaiting' ? state.uri : null;
  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    import('qrcode')
      .then((mod) =>
        mod.default.toDataURL(uri, { margin: 1, width: 280, errorCorrectionLevel: 'M' }),
      )
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setState({ kind: 'error', code: 'failed' }); });
    return () => { cancelled = true; };
  }, [uri]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(async () => {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; the QR Code is still usable
    }
  }, [uri]);

  const errorMessage = (code: WalletConnectErrorCode): string => {
    switch (code) {
      case 'not-configured': return t('wc.notConfigured');
      case 'rejected': return t('wc.rejected');
      case 'expired': return t('wc.expired');
      case 'timeout': return t('wc.timeout');
      case 'blocked': return t('wc.blocked');
      default: return t('wc.failed');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="WalletConnect"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="fixed z-[62] inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[340px] max-h-[88vh] overflow-y-auto"
        >
          <div className="rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_24px_rgba(0,229,188,0.06)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h3 className="text-sm font-semibold text-foreground font-mono">{t('wc.title')}</h3>
              </div>
              <button
                onClick={onClose}
                aria-label={t('wc.cancel')}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center gap-3">
              {state.kind === 'preparing' && (
                <div className="flex flex-col items-center py-10 text-center">
                  <Loader2 size={24} className="animate-spin text-primary/60 mb-3" />
                  <p className="text-xs text-muted-foreground/60 font-mono">{t('wc.preparing')}</p>
                  {import.meta.env.DEV && <DevDiagnostics />}
                </div>
              )}

              {state.kind === 'awaiting' && (
                <>
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">{t('wc.scan')}</p>
                  <div className="w-[216px] h-[216px] rounded-xl bg-white p-2 flex items-center justify-center">
                    {qr ? (
                      <img src={qr} alt="WalletConnect QR Code" className="w-full h-full" />
                    ) : (
                      <Loader2 size={22} className="animate-spin text-black/40" />
                    )}
                  </div>
                  <div className="flex w-full gap-2">
                    {isMobileDevice() && (
                      <a
                        href={state.uri}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-mono hover:bg-primary/15 transition-colors"
                      >
                        <Smartphone size={13} /> {t('wc.openWallet')}
                      </a>
                    )}
                    <button
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 bg-secondary/40 text-foreground text-xs font-mono hover:bg-secondary transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      {copied ? t('wc.copied') : t('wc.copyUri')}
                    </button>
                  </div>
                </>
              )}

              {state.kind === 'error' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center w-full">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-amber-400" />
                  </div>
                  <p className="text-xs text-amber-300/80 leading-relaxed">{errorMessage(state.code)}</p>
                  {import.meta.env.DEV && <DevDiagnostics />}
                  {state.code !== 'not-configured' && (
                    <button
                      onClick={() => setAttempt((n) => n + 1)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-mono hover:bg-primary/15 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} /> {t('wc.retry')}
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 w-full pt-2 border-t border-border/20">
                <ShieldCheck size={13} className="text-primary/60 mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{t('wc.hint')}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
