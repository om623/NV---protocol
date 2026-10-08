// ─── NV Protocol — Solana Wallet Panel ───────────────────────────────────────
// Renders the Solana connection panel: wallet picker, address, SOL balance.
// Completely isolated from EVM wallet state and providers.
// No transactions, no signing, no seed phrase — read-only wallet context only.

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, RefreshCw, Copy, LogOut, Zap,
  AlertCircle, CheckCircle2, Loader2, ExternalLink,
} from 'lucide-react';
import { useSolanaWallet } from '../lib/useSolanaWallet';
import {
  SOLANA_NETWORK,
  formatSol,
  formatUsdc,
  truncateSolAddress,
} from '../lib/solana';
import { useI18n } from '../i18n';

// ─── Gradient/badge helpers consistent with NV identity ──────────────────────
const nvCard = 'w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300';

function SolBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest bg-violet-500/10 border border-violet-500/25 text-violet-400">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
      SOL
    </span>
  );
}

// ─── Wallet list item ─────────────────────────────────────────────────────────
function WalletOption({
  name,
  icon,
  onSelect,
}: {
  name: string;
  icon?: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-border/30 hover:border-primary/25 transition-all duration-200 cursor-pointer group"
    >
      {icon ? (
        <img src={icon} alt={name} className="w-7 h-7 rounded-lg" />
      ) : (
        <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <Wallet size={13} className="text-violet-400" />
        </div>
      )}
      <span className="text-sm font-mono font-medium text-foreground/80 group-hover:text-foreground transition-colors">
        {name}
      </span>
      <span className="ml-auto text-[9px] font-mono text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
        →
      </span>
    </button>
  );
}

// ─── Balance row ──────────────────────────────────────────────────────────────
function BalanceRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/15 last:border-0">
      <span className="text-[11px] font-mono text-muted-foreground/60">{label}</span>
      <div className="text-right">
        <div className="text-sm font-mono font-semibold text-foreground tabular-nums">{value}</div>
        {sub && <div className="text-[9px] font-mono text-muted-foreground/40">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SolanaWalletPanel() {
  const { t } = useI18n();
  const {
    availableWallets,
    walletState,
    balanceState,
    usdcBalanceState,
    connect,
    disconnect,
    refreshBalance,
  } = useSolanaWallet();

  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (walletName?: string) => {
    setConnecting(true);
    await connect(walletName);
    setConnecting(false);
  };

  const handleCopy = () => {
    if (walletState.status !== 'connected') return;
    navigator.clipboard.writeText(walletState.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isConnected = walletState.status === 'connected';
  const isConnecting = walletState.status === 'connecting' || connecting;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className={nvCard}
    >
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/20 to-transparent mb-5 -mt-1" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            {/* Solana logo colour block */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 border border-violet-500/25 flex items-center justify-center shrink-0">
              <Zap size={14} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground tracking-wide">
                {t('sol.title')}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                  {SOLANA_NETWORK.name} · {t('sol.nonEvm')}
                </span>
              </div>
            </div>
          </div>
          <SolBadge />
        </div>

        {/* ── Not connected ───────────────────────────────────────────────────── */}
        {!isConnected && walletState.status !== 'error' && (
          <div>
            {availableWallets.length === 0 && !isConnecting && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-secondary/40 border border-border/30 flex items-center justify-center">
                  <Wallet size={20} className="text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-mono text-foreground/60 mb-1">{t('sol.noWallet')}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/40">{t('sol.installHint')}</p>
                </div>
                <div className="flex gap-2 mt-1">
                  <a
                    href="https://phantom.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-mono text-primary/60 hover:text-primary transition-colors"
                  >
                    Phantom <ExternalLink size={9} />
                  </a>
                  <span className="text-muted-foreground/20">·</span>
                  <a
                    href="https://solflare.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-mono text-primary/60 hover:text-primary transition-colors"
                  >
                    Solflare <ExternalLink size={9} />
                  </a>
                </div>
              </div>
            )}

            {isConnecting && (
              <div className="flex items-center gap-3 py-6 justify-center text-sm font-mono text-muted-foreground/60">
                <Loader2 size={16} className="animate-spin text-violet-400" />
                {t('sol.connecting')}
              </div>
            )}

            {availableWallets.length > 0 && !isConnecting && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40 mb-1">
                  {t('sol.selectWallet')}
                </p>
                {availableWallets.map(w => (
                  <WalletOption
                    key={w.name}
                    name={w.name}
                    icon={w.icon}
                    onSelect={() => handleConnect(w.name)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────────────────── */}
        {walletState.status === 'error' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-[11px] font-mono text-red-400/80 leading-relaxed">
                {walletState.message}
              </p>
            </div>
            <button
              onClick={() => handleConnect()}
              className="w-full py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/70 border border-border/30 hover:border-primary/25 text-sm font-mono text-muted-foreground/70 hover:text-foreground transition-all cursor-pointer"
            >
              {t('sol.tryAgain')}
            </button>
          </div>
        )}

        {/* ── Connected ────────────────────────────────────────────────────────── */}
        {isConnected && (
          <div className="flex flex-col gap-4">
            {/* Wallet identity */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/25 border border-border/25">
              <div className="flex items-center gap-2.5 min-w-0">
                {walletState.walletIcon ? (
                  <img src={walletState.walletIcon} alt={walletState.walletName} className="w-6 h-6 rounded-lg shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                    <Wallet size={11} className="text-violet-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-muted-foreground/50 truncate">{walletState.walletName}</div>
                  <div className="text-xs font-mono text-foreground/80 tabular-nums truncate" translate="no">
                    {truncateSolAddress(walletState.address)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  onClick={handleCopy}
                  title={t('sol.copyAddress')}
                  className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"
                >
                  {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <button
                  onClick={disconnect}
                  title={t('sol.disconnect')}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>

            {/* Balances */}
            <div className="rounded-xl bg-secondary/20 border border-border/25 px-4 py-1">
              {/* SOL balance */}
              {balanceState.status === 'loading' && (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 size={12} className="animate-spin text-violet-400" />
                  <span className="text-[11px] font-mono text-muted-foreground/50">{t('sol.loadingBalance')}</span>
                </div>
              )}
              {balanceState.status === 'loaded' && (
                <BalanceRow
                  label="SOL"
                  value={formatSol(balanceState.lamports)}
                  sub={`${t('sol.updated')} ${Math.round((Date.now() - balanceState.fetchedAt) / 1000)}s`}
                />
              )}
              {balanceState.status === 'error' && (
                <div className="flex items-center gap-2 py-2.5">
                  <AlertCircle size={11} className="text-amber-400 shrink-0" />
                  <span className="text-[10px] font-mono text-amber-400/70">{balanceState.message}</span>
                </div>
              )}
              {balanceState.status === 'idle' && (
                <div className="py-3 text-[10px] font-mono text-muted-foreground/40">{t('sol.balanceIdle')}</div>
              )}

              {/* USDC balance — real SPL Token query */}
              <div className="border-t border-border/15">
                {usdcBalanceState.status === 'loading' && (
                  <div className="flex items-center gap-2 py-2.5">
                    <Loader2 size={11} className="animate-spin text-blue-400" />
                    <span className="text-[11px] font-mono text-muted-foreground/50">USDC</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground/30">
                      {t('sol.loadingBalance')}
                    </span>
                  </div>
                )}
                {usdcBalanceState.status === 'loaded' && (
                  <BalanceRow
                    label="USDC"
                    value={formatUsdc(usdcBalanceState.rawAmount)}
                    sub={`${t('sol.updated')} ${Math.round((Date.now() - usdcBalanceState.fetchedAt) / 1000)}s`}
                  />
                )}
                {usdcBalanceState.status === 'noAccount' && (
                  <BalanceRow
                    label="USDC"
                    value="0.00 USDC"
                    sub={t('sol.usdcNoAccount')}
                  />
                )}
                {usdcBalanceState.status === 'error' && (
                  <div className="flex items-center gap-2 py-2.5">
                    <AlertCircle size={11} className="text-amber-400 shrink-0" />
                    <span className="text-[11px] font-mono text-muted-foreground/50">USDC</span>
                    <span className="ml-auto text-[10px] font-mono text-amber-400/70">
                      {t('sol.usdcError')}
                    </span>
                  </div>
                )}
                {usdcBalanceState.status === 'idle' && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[11px] font-mono text-muted-foreground/40">USDC</span>
                    <span className="text-[10px] font-mono text-muted-foreground/25">—</span>
                  </div>
                )}
              </div>
            </div>

            {/* Refresh button */}
            <button
              onClick={refreshBalance}
              disabled={balanceState.status === 'loading'}
              className="flex items-center gap-2 justify-center w-full py-2 rounded-xl bg-secondary/25 hover:bg-secondary/50 border border-border/25 hover:border-violet-500/20 text-[11px] font-mono text-muted-foreground/50 hover:text-foreground transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={11} className={balanceState.status === 'loading' ? 'animate-spin' : ''} />
              {t('sol.refreshBalance')}
            </button>

            {/* Explorer link */}
            <a
              href={`${SOLANA_NETWORK.explorerUrl}/account/${walletState.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/30 hover:text-primary/50 transition-colors justify-center"
            >
              {t('sol.viewOnExplorer')} <ExternalLink size={8} />
            </a>
          </div>
        )}

        {/* Footer: CCTP / future integration note */}
        <div className="mt-5 pt-4 border-t border-border/20">
          <p className="text-[9px] font-mono text-muted-foreground/25 text-center leading-relaxed">
            {t('sol.cctpNote')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
