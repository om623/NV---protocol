import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, RefreshCw, Loader as Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { type Eip1193Provider, getAllBalances, shortAddress, getProvider, getAccounts, getTokensForNetwork } from '../lib/arc';
import type { NetworkConfig } from '../networks';
import { getAsset } from '../lib/marketData';
import { useI18n, useFormat } from '../i18n';

interface WalletViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  onConnect: () => void;
  explorerUrl: string;
  activeNetwork: NetworkConfig;
}

const nvCard = "w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300";

export function WalletView({ provider, connectedAddress, onConnect, explorerUrl, activeNetwork }: WalletViewProps) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!provider || !connectedAddress) return;
    setLoading(true);
    setError(false);
    try {
      const tokenMap = getTokensForNetwork(activeNetwork);
      const bal = await getAllBalances(provider, connectedAddress, tokenMap);
      if (!mounted.current) return;
      setBalances(bal);
    } catch {
      if (!mounted.current) return;
      setError(true);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
    }
  }, [provider, connectedAddress, activeNetwork]);

  useEffect(() => {
    if (provider && connectedAddress) refresh();
  }, [provider, connectedAddress, refresh]);

  const handleCopy = () => {
    if (!connectedAddress) return;
    navigator.clipboard.writeText(connectedAddress);
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => {
      if (mounted.current) setCopied(false);
    }, 2000);
  };

  if (!provider || !connectedAddress) {
    return (
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
        className={nvCard}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-6 -mt-3" />
          <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center mb-4 relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-lg" />
            <Wallet size={28} className="text-primary relative z-10" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('wallet.notConnected')}</h2>
          <p className="text-sm text-muted-foreground/60 mb-5 max-w-xs">
            {t('wallet.connectDescription')} <span translate="no">{activeNetwork.name}</span>.
          </p>
          <button onClick={onConnect}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(0,229,188,0.25)] transition-all duration-200 cursor-pointer">
            {t('action.connectWallet')}
          </button>
        </div>
      </motion.div>
    );
  }

  const networkTokenMeta = useMemo(
    () => getTokensForNetwork(activeNetwork) 
      ? Object.entries(getTokensForNetwork(activeNetwork)).map(([sym, cfg]) => {
          const asset = getAsset(sym);
          return { symbol: sym, label: sym, decimals: cfg.decimals, rate: asset?.price ?? 1 };
        })
      : [],
    [activeNetwork],
  );

  const balValues = useMemo(() => {
    const result: Record<string, number> = {};
    for (const { symbol } of networkTokenMeta) {
      result[symbol] = balances?.[symbol] ?? 0;
    }
    return result;
  }, [balances, networkTokenMeta]);

  const totalUsd = networkTokenMeta.reduce((sum, t) => sum + (balValues[t.symbol] || 0) * t.rate, 0);

  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
      className={nvCard}>
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-5 -mt-1" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-wide">{t('wallet.myWallet')}</h2>
          </div>
          <button onClick={refresh} disabled={loading}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {/* Address */}
        <div className="bg-secondary/30 rounded-xl p-3 mb-4 border border-border/30 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-muted-foreground/60 truncate">{shortAddress(connectedAddress)}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            <a href={`${explorerUrl}/address/${connectedAddress}`} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Total */}
        <div className="flex flex-col gap-0.5 mb-4">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-mono">{t('wallet.totalValue')}</span>
          {error ? (
            <span className="text-2xl font-mono font-semibold text-muted-foreground/40">—</span>
          ) : (
            <span className="text-3xl font-mono font-semibold text-foreground mt-1" translate="no">
              {fmt.currency(totalUsd)}
            </span>
          )}
          {error && (
            <span className="text-[10px] font-mono text-red-400/70 mt-1">{t('wallet.loadError')}</span>
          )}
        </div>

        <div className="h-px w-full bg-border/40 my-4" />

        {/* Token balances */}
        <div className="flex flex-col gap-2">
          {networkTokenMeta.map(({ symbol, label, decimals, rate }) => {
            const amt = balValues[symbol] || 0;
            const usd = amt * rate;
            return (
              <div key={symbol} className="flex items-center justify-between bg-secondary/25 rounded-xl p-3 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center text-[10px] font-bold text-primary font-mono">
                    {symbol[0]}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-mono font-medium text-foreground" translate="no">{symbol}</span>
                    <span className="text-[10px] text-muted-foreground/50">{label}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-mono text-foreground">{fmt.number(amt, decimals)}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">{fmt.currency(usd)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
