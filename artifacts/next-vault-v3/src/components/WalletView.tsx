import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, RefreshCw, Loader as Loader2, Copy, Check, ExternalLink, Send, ArrowRight, AlertTriangle } from 'lucide-react';
import { type Eip1193Provider, getAllBalances, shortAddress, getProvider, getAccounts, getTokensForNetwork, transferErc20, transferNative } from '../lib/arc';
import type { NetworkConfig } from '../networks';
import { getAsset } from '../lib/marketData';
import { useI18n, useFormat } from '../i18n';

interface WalletViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  onConnect: () => void;
  explorerUrl: string;
  activeNetwork: NetworkConfig;
  walletName?: string | null;
}

const nvCard = "w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300";

// ─── EVM address validation ───────────────────────────────────────────────────
function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

type SendStep = 'idle' | 'review' | 'sending' | 'success' | 'error';

interface SendUsdcFormProps {
  provider: Eip1193Provider;
  fromAddress: string;
  usdcBalance: number;
  usdcAddress: string | null;
  usdcDecimals: number;
  explorerUrl: string;
  onSent: () => void;  // refresh balances after success
}

function SendUsdcForm({ provider, fromAddress, usdcBalance, usdcAddress, usdcDecimals, explorerUrl, onSent }: SendUsdcFormProps) {
  const { t } = useI18n();
  const [to, setTo]       = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep]   = useState<SendStep>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const sending = step === 'sending';

  const amountNum = parseFloat(amount.replace(',', '.'));
  const toValid   = isValidEvmAddress(to);
  const amtValid  = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= usdcBalance;
  // usdcAddress may be null on Arc (native USDC) — still valid, uses transferNative
  const canReview = toValid && amtValid;

  function reset() {
    setTo(''); setAmount(''); setStep('idle'); setTxHash(null); setErrMsg(null);
  }

  async function handleSend() {
    if (!canReview) return;
    setStep('sending');
    setErrMsg(null);
    try {
      let hash: string;
      if (usdcAddress) {
        // ERC-20 USDC (non-native)
        hash = await transferErc20(provider, fromAddress, usdcAddress, to, amountNum, usdcDecimals);
      } else {
        // Native USDC (Arc — USDC IS the native gas token)
        hash = await transferNative(provider, fromAddress, to, amountNum);
      }
      setTxHash(hash);
      setStep('success');
      onSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // User rejected — not a real error
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('cancel')) {
        setStep('idle');
        setErrMsg(t('wallet.send.rejected'));
      } else {
        setErrMsg(msg);
        setStep('error');
      }
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/40">
      <div className="flex items-center gap-2 mb-3">
        <Send size={13} className="text-primary" />
        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">{t('wallet.send.title')}</span>
      </div>

      <AnimatePresence mode="wait">
        {(step === 'idle' || step === 'review') && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Recipient */}
            <div className="mb-2">
              <label className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wide mb-1 block">{t('wallet.send.to')}</label>
              <input
                type="text"
                placeholder="0x..."
                value={to}
                onChange={e => { setTo(e.target.value); setStep('idle'); }}
                className="w-full bg-secondary/30 border border-border/40 rounded-xl px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors"
                disabled={sending}
              />
              {to && !toValid && (
                <span className="text-[10px] text-red-400/80 mt-0.5 block">{t('wallet.send.invalidAddress')}</span>
              )}
            </div>

            {/* Amount */}
            <div className="mb-3">
              <label className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wide mb-1 block">{t('wallet.send.amount')}</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setStep('idle'); }}
                  className="w-full bg-secondary/30 border border-border/40 rounded-xl px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors pr-16"
                  disabled={sending}
                />
                <button
                  onClick={() => setAmount(usdcBalance.toFixed(6))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-primary/70 hover:text-primary transition-colors cursor-pointer"
                  disabled={sending}
                >MAX</button>
              </div>
              {amount && !amtValid && (
                <span className="text-[10px] text-red-400/80 mt-0.5 block">
                  {amountNum <= 0 ? t('wallet.send.amountPositive') : t('wallet.send.insufficientBalance')}
                </span>
              )}
            </div>

            {/* Review step */}
            {step === 'review' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-3 space-y-1"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-[11px] font-semibold text-amber-400">{t('wallet.send.reviewTitle')}</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/70 space-y-1">
                  <div><span className="text-muted-foreground/40">{t('wallet.send.to')}: </span><span className="text-foreground/80 break-all">{to}</span></div>
                  <div><span className="text-muted-foreground/40">{t('wallet.send.amount')}: </span><span className="text-foreground font-semibold">{amountNum.toFixed(6)} USDC</span></div>
                  <div className="text-amber-400/60 text-[9px] pt-1">{t('wallet.send.irreversible')}</div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full mt-2 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send size={12} />
                  {t('wallet.send.confirmSend')}
                </button>
              </motion.div>
            )}

            {/* Error inline */}
            {errMsg && step === 'idle' && (
              <div className="text-[10px] text-red-400/80 mb-2 font-mono">{errMsg}</div>
            )}

            {/* Primary CTA */}
            {step === 'idle' && (
              <button
                onClick={() => { if (canReview) setStep('review'); }}
                disabled={!canReview}
                className="w-full py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ArrowRight size={12} />
                {t('wallet.send.review')}
              </button>
            )}
          </motion.div>
        )}

        {step === 'sending' && (
          <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground font-mono">
            <Loader2 size={14} className="animate-spin text-primary" />
            {t('wallet.send.sending')}
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-[11px] font-semibold text-red-400">{t('wallet.send.failed')}</span>
            </div>
            {errMsg && <p className="text-[10px] font-mono text-red-300/70 break-all">{errMsg}</p>}
            <button onClick={reset} className="text-[10px] font-mono text-primary hover:text-primary/80 cursor-pointer">{t('wallet.send.tryAgain')}</button>
          </motion.div>
        )}

        {step === 'success' && txHash && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Check size={12} className="text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400">{t('wallet.send.success')}</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/60 break-all">{txHash}</div>
            <div className="flex items-center gap-3">
              <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-mono text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer">
                <ExternalLink size={10} /> {t('wallet.send.viewExplorer')}
              </a>
              <button onClick={reset} className="text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground cursor-pointer">{t('wallet.send.sendAnother')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WalletView({ provider, connectedAddress, onConnect, explorerUrl, activeNetwork, walletName }: WalletViewProps) {
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
          <p className="text-sm text-muted-foreground/70 mb-2 max-w-sm leading-relaxed">
            Conecte sua carteira pelo botão no canto superior direito para visualizar seus saldos e liberar as funções de transferência com segurança.
          </p>
          <p className="text-[11px] font-mono text-primary/70 max-w-sm">
            Após a conexão, seus ativos disponíveis em <span translate="no">{activeNetwork.name}</span> aparecerão aqui automaticamente.
          </p>
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
          <div className="flex items-center gap-2 min-w-0">
            {walletName && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-primary/8 border border-primary/15 text-primary shrink-0">{walletName}</span>
            )}
            <span className="text-xs font-mono text-muted-foreground/60 truncate">{shortAddress(connectedAddress)}</span>
          </div>
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

        {/* USDC Send Form — only when USDC is available on the active network */}
        {(() => {
          const tokenMap = getTokensForNetwork(activeNetwork);
          const usdcCfg = tokenMap?.['USDC'];
          const usdcBal = balances?.['USDC'] ?? 0;
          if (!usdcCfg) return null;
          return (
            <SendUsdcForm
              provider={provider}
              fromAddress={connectedAddress}
              usdcBalance={usdcBal}
              usdcAddress={usdcCfg.address ?? null}
              usdcDecimals={usdcCfg.decimals}
              explorerUrl={explorerUrl}
              onSent={refresh}
            />
          );
        })()}
      </div>
    </motion.div>
  );
}
