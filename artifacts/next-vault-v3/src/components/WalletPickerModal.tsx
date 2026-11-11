import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet as WalletIcon, ChevronRight, Loader as Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { onWalletsDiscovered, type WalletInfo } from '../lib/walletDiscovery';
import { connectWalletConnect } from '../lib/walletConnect';

interface WalletPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (wallet: WalletInfo) => void;
}

export function WalletPickerModal({ open, onClose, onSelect }: WalletPickerModalProps) {
  const { t } = useI18n();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsub = onWalletsDiscovered(setWallets);
    return unsub;
  }, [open]);

  const handleSelect = useCallback((wallet: WalletInfo) => {
    // Close our overlay before the extension opens its own authorization UI.
    // Keeping a full-screen backdrop mounted while MetaMask/Phantom is active
    // can leave the NV interface visually dark or apparently frozen.
    setConnecting(wallet.id);
    setConnectionError(null);
    onClose();
    onSelect(wallet);
  }, [onClose, onSelect]);

  useEffect(() => {
    if (!open) { setConnecting(null); setConnectionError(null); }
  }, [open]);

  const handleWalletConnect = useCallback(async () => {
    setConnecting('walletconnect');
    setConnectionError(null);
    try {
      const wallet = await connectWalletConnect();
      onClose();
      onSelect(wallet);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WalletConnect connection failed.';
      setConnectionError(message);
      setConnecting(null);
    }
  }, [onClose, onSelect]);

  return (
    <AnimatePresence>
      {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="fixed right-4 top-16 z-[61] w-[calc(100%-2rem)] max-w-sm"
          >
            <div className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <WalletIcon size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{t('wallet.pickerTitle')}</h3>
                </div>
                <button onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              {/* Wallet list */}
              <div className="p-3 flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
                {wallets.length === 0 && !connecting && (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Loader2 size={24} className="animate-spin text-primary/40 mb-3" />
                    <p className="text-xs text-muted-foreground/50 font-mono">{t('wallet.searchingWallets')}</p>
                  </div>
                )}

                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleSelect(wallet)}
                    disabled={connecting !== null}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-secondary/30 hover:bg-secondary hover:border-primary/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0 overflow-hidden">
                      {wallet.icon ? (
                        <img src={wallet.icon} alt="" className="w-6 h-6" />
                      ) : (
                        <WalletIcon size={16} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">{wallet.name}</span>
                      {wallet.rdns && (
                        <span className="text-[10px] font-mono text-muted-foreground/40">{wallet.rdns}</span>
                      )}
                    </div>
                    {connecting === wallet.id ? (
                      <Loader2 size={15} className="animate-spin text-primary shrink-0" />
                    ) : (
                      <ChevronRight size={15} className="text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                    )}
                  </button>
                ))}

                {wallets.length === 0 && !connecting && (
                  <div className="mt-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                    <p className="text-[11px] text-amber-400/70 font-mono leading-relaxed">
                      {t('wallet.noWalletFound')}
                    </p>
                  </div>
                )}
              </div>

                <div className="px-3 pb-3">
                  <button
                    type="button"
                    onClick={handleWalletConnect}
                    disabled={connecting !== null}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      {connecting === 'walletconnect' ? <Loader2 size={17} className="animate-spin text-primary" /> : <span className="text-primary font-bold text-lg">W</span>}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="text-sm font-semibold text-foreground block">WalletConnect</span>
                      <span className="text-[10px] text-muted-foreground block">Conectar carteira móvel por QR code</span>
                    </div>
                    {connecting === 'walletconnect' ? <Loader2 size={15} className="animate-spin text-primary" /> : <ChevronRight size={15} className="text-primary" />}
                  </button>
                  {connectionError && (
                    <p role="alert" className="mt-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs break-words">
                      {connectionError}
                    </p>
                  )}
                </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border/30">
                <p className="text-[9px] font-mono text-muted-foreground/30 text-center">
                  {t('wallet.pickerFooter')}
                </p>
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
