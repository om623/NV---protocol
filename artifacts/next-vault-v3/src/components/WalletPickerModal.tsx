import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet as WalletIcon, ChevronRight, Loader as Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { onWalletsDiscovered, type WalletInfo } from '../lib/walletDiscovery';

interface WalletPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (wallet: WalletInfo) => void;
}

export function WalletPickerModal({ open, onClose, onSelect }: WalletPickerModalProps) {
  const { t } = useI18n();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsub = onWalletsDiscovered(setWallets);
    return unsub;
  }, [open]);

  const handleSelect = useCallback((wallet: WalletInfo) => {
    setConnecting(wallet.id);
    onSelect(wallet);
  }, [onSelect]);

  useEffect(() => {
    if (!open) setConnecting(null);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-sm mx-4"
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

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border/30">
                <p className="text-[9px] font-mono text-muted-foreground/30 text-center">
                  {t('wallet.pickerFooter')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
