import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wallet, RefreshCw, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { type Eip1193Provider, type WalletBalances, getAllBalances, shortAddress, getProvider, getAccounts } from '../lib/arc';

interface WalletViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  onConnect: () => void;
  explorerUrl: string;
}

const nvCard = "w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300";

const TOKEN_META = [
  { symbol: 'USDC', label: 'USD Coin',  decimals: 2, rate: 1.0 },
  { symbol: 'EURC', label: 'Euro Coin',  decimals: 2, rate: 1.087 },
  { symbol: 'ETH',  label: 'Ethereum',   decimals: 4, rate: 3215.84 },
];

export function WalletView({ provider, connectedAddress, onConnect, explorerUrl }: WalletViewProps) {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!provider || !connectedAddress) return;
    setLoading(true);
    try {
      const bal = await getAllBalances(provider, connectedAddress);
      setBalances(bal);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [provider, connectedAddress]);

  useEffect(() => {
    if (provider && connectedAddress) refresh();
  }, [provider, connectedAddress, refresh]);

  const handleCopy = () => {
    if (!connectedAddress) return;
    navigator.clipboard.writeText(connectedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h2 className="text-lg font-semibold text-foreground mb-2">Carteira nao conectada</h2>
          <p className="text-sm text-muted-foreground/60 mb-5 max-w-xs">
            Conecte sua carteira MetaMask para ver seus saldos reais na Arc Testnet.
          </p>
          <button onClick={onConnect}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(0,229,188,0.25)] transition-all duration-200 cursor-pointer">
            Conectar Carteira
          </button>
        </div>
      </motion.div>
    );
  }

  const balValues = balances
    ? { USDC: balances.usdc, EURC: balances.eurc, ETH: balances.eth }
    : { USDC: 0, EURC: 0, ETH: 0 };

  const totalUsd = TOKEN_META.reduce((sum, t) => sum + balValues[t.symbol as keyof typeof balValues] * t.rate, 0);

  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
      className={nvCard}>
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-5 -mt-1" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-wide">Minha Carteira</h2>
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
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-mono">Valor Total</span>
          <div className="text-3xl font-mono font-semibold text-foreground mt-1">
            ${totalUsd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="h-px w-full bg-border/40 my-4" />

        {/* Token balances */}
        <div className="flex flex-col gap-2">
          {TOKEN_META.map(({ symbol, label, decimals, rate }) => {
            const amt = balValues[symbol as keyof typeof balValues] || 0;
            const usd = amt * rate;
            return (
              <div key={symbol} className="flex items-center justify-between bg-secondary/25 rounded-xl p-3 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center text-[10px] font-bold text-primary font-mono">
                    {symbol[0]}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-mono font-medium text-foreground">{symbol}</span>
                    <span className="text-[10px] text-muted-foreground/50">{label}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-mono text-foreground">{amt.toLocaleString('pt-BR', { maximumFractionDigits: decimals })}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">${usd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

