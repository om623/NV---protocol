// ─── NV Protocol — Solana Bridge Panel ───────────────────────────────────────
// UI for Solana → EVM CCTP V2 bridge.
// Isolated from EVM→EVM bridge — never modifies BridgeView's EVM logic.
//
// Flow:
//   1. User connects Solana wallet (via existing SolanaWalletPanel / useSolanaWallet)
//   2. User selects destination EVM network (Arc first, then others)
//   3. User inputs USDC amount
//   4. Confirmation screen shown (amount, recipient, network, fee)
//   5. User clicks "Confirm Bridge"
//   6. Solana wallet signs → Iris polls → EVM wallet signs → done

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown, ArrowRight, CheckCircle2, AlertCircle,
  Loader2, ExternalLink, Copy, Zap, RefreshCw,
} from 'lucide-react';
import { useSolanaWallet } from '../lib/useSolanaWallet';
import { executeSolanaToEvmBridge, type BridgeStepState } from '../lib/cctpSolanaExecutor';
import { isSolCctpReady } from '../lib/cctpSolana';
import { truncateSolAddress, formatSol } from '../lib/solana';
import type { Eip1193Provider } from '../lib/arc';

// ─── EVM destination networks available for Solana → EVM ─────────────────────
// In order: Arc, Base, Ethereum, Arbitrum, Optimism — expandable later.

const SOLANA_BRIDGE_DESTINATIONS = [
  { id: 'arc-mainnet',  name: 'Arc',          domain: 26 },
  { id: 'base',         name: 'Base',          domain: 6  },
  { id: 'ethereum',     name: 'Ethereum',      domain: 0  },
  { id: 'arbitrum',     name: 'Arbitrum One',  domain: 3  },
  { id: 'optimism',     name: 'OP Mainnet',    domain: 2  },
  { id: 'polygon',      name: 'Polygon PoS',   domain: 7  },
  { id: 'avalanche',    name: 'Avalanche',     domain: 1  },
] as const;

type DestId = (typeof SOLANA_BRIDGE_DESTINATIONS)[number]['id'];

// ─── Step progress labels ─────────────────────────────────────────────────────

function stepLabel(step: BridgeStepState['step']): string {
  switch (step) {
    case 'building':        return 'Preparando transação...';
    case 'awaiting_sol_sig':return 'Aguardando assinatura Solana...';
    case 'sol_submitted':   return 'Transação Solana enviada';
    case 'polling_iris':    return 'Aguardando attestation Circle...';
    case 'awaiting_evm_sig':return 'Aguardando assinatura EVM...';
    case 'evm_submitted':   return 'Transação EVM enviada';
    case 'complete':        return 'Bridge concluída ✓';
    case 'error':           return 'Erro';
    default:                return '';
  }
}

const STEP_ORDER: BridgeStepState['step'][] = [
  'building', 'awaiting_sol_sig', 'sol_submitted',
  'polling_iris', 'awaiting_evm_sig', 'evm_submitted', 'complete',
];

function stepIndex(step: BridgeStepState['step']): number {
  return STEP_ORDER.indexOf(step);
}

// ─── Explorer links ───────────────────────────────────────────────────────────

function solExplorer(sig: string) {
  return `https://solscan.io/tx/${sig}`;
}

function evmExplorer(networkId: string, hash: string) {
  const map: Record<string, string> = {
    'arc-mainnet': `https://explorer.arc.io/tx/${hash}`,
    'base':        `https://basescan.org/tx/${hash}`,
    'ethereum':    `https://etherscan.io/tx/${hash}`,
    'arbitrum':    `https://arbiscan.io/tx/${hash}`,
    'optimism':    `https://optimistic.etherscan.io/tx/${hash}`,
    'polygon':     `https://polygonscan.com/tx/${hash}`,
    'avalanche':   `https://snowtrace.io/tx/${hash}`,
  };
  return map[networkId] ?? `https://etherscan.io/tx/${hash}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SolanaBridgePanelProps {
  /** EIP-1193 provider from the EVM wallet (for receiveMessage) */
  evmProvider: Eip1193Provider | null;
  /** Connected EVM address (recipient on destination chain) */
  evmAddress: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SolanaBridgePanel({ evmProvider, evmAddress }: SolanaBridgePanelProps) {
  const {
    walletState,
    balanceState,
    usdcBalanceState,
    signAndSendTransaction,
  } = useSolanaWallet();

  const [destId, setDestId] = useState<DestId>('arc-mainnet');
  const [amount, setAmount] = useState('');
  const [bridgeState, setBridgeState] = useState<BridgeStepState>({ step: 'idle' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = walletState.status === 'connected';
  const isProcessing = bridgeState.step !== 'idle' &&
                       bridgeState.step !== 'complete' &&
                       bridgeState.step !== 'error';

  const usdcBalance = usdcBalanceState.status === 'loaded'
    ? usdcBalanceState.usdc
    : usdcBalanceState.status === 'noAccount' ? 0 : null;

  const amountNum = Number(amount);
  const readinessCheck = isConnected && usdcBalance !== null
    ? isSolCctpReady(usdcBalance, amountNum)
    : null;

  const solBalance = balanceState.status === 'loaded'
    ? formatSol(balanceState.lamports)
    : null;

  const destName = SOLANA_BRIDGE_DESTINATIONS.find(d => d.id === destId)?.name ?? destId;

  // ── Set max amount ──
  function setMax() {
    if (usdcBalance !== null && usdcBalance > 0) {
      setAmount(usdcBalance.toFixed(6));
    }
  }

  // ── Copy address ──
  function copyAddress() {
    if (walletState.status === 'connected') {
      navigator.clipboard.writeText(walletState.address).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  // ── Start bridge ──
  const handleBridge = useCallback(async () => {
    if (!isConnected || walletState.status !== 'connected') return;
    if (!evmProvider || !evmAddress) return;
    if (!readinessCheck?.ready) return;

    setShowConfirm(false);
    setBridgeState({ step: 'building' });

    await executeSolanaToEvmBridge({
      solanaAddress: walletState.address,
      evmAddress,
      destinationNetworkId: destId,
      amount: amountNum,
      evmProvider,
      signAndSendSolana: signAndSendTransaction,
      onStep: (state) => {
        console.log('[NV SolanaBridge] step:', state.step, state.progressMessage);
        setBridgeState(state);
      },
    });

    setAmount('');
  }, [isConnected, walletState, evmProvider, evmAddress, readinessCheck, destId, amountNum, signAndSendTransaction]);

  // ── Reset ──
  function reset() {
    setBridgeState({ step: 'idle' });
    setAmount('');
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <Zap size={16} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Solana → EVM Bridge</h2>
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
            Circle CCTP V2 · Mainnet
          </p>
        </div>
      </div>

      {/* ── Not connected ── */}
      {!isConnected && (
        <div className="rounded-2xl border border-white/[0.06] bg-card/90 p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary/40 border border-border/30 flex items-center justify-center mx-auto">
            <Zap size={20} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-mono text-foreground/60">Conecte sua carteira Solana</p>
          <p className="text-[10px] font-mono text-muted-foreground/40">
            Acesse a aba "Solana" para conectar Phantom ou Solflare.
          </p>
        </div>
      )}

      {/* ── EVM not connected ── */}
      {isConnected && (!evmProvider || !evmAddress) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-mono text-amber-400/80 leading-relaxed">
            Conecte também uma carteira EVM para receber USDC na rede de destino.
          </p>
        </div>
      )}

      {/* ── Bridge form ── */}
      {isConnected && evmAddress && bridgeState.step === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl p-5 space-y-4"
        >
          {/* Solana wallet info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/25 border border-violet-500/15">
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-violet-400/70 mb-0.5">From · Solana</p>
              <p className="text-xs font-mono text-foreground/80 tabular-nums" translate="no">
                {truncateSolAddress(walletState.address)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                {solBalance && (
                  <span className="text-[9px] font-mono text-muted-foreground/40">{solBalance}</span>
                )}
                <span className="text-[9px] font-mono text-muted-foreground/60">
                  USDC: {usdcBalance !== null
                    ? usdcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </span>
              </div>
            </div>
            <button
              onClick={copyAddress}
              className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-foreground transition-colors"
            >
              {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>

          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-secondary/30 border border-border/30 flex items-center justify-center">
              <ArrowDown size={14} className="text-muted-foreground/50" />
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">To · EVM Network</p>
            <select
              value={destId}
              onChange={e => setDestId(e.target.value as DestId)}
              className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-violet-500/40"
            >
              {SOLANA_BRIDGE_DESTINATIONS.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="px-1 text-[9px] font-mono text-muted-foreground/40">
              Recipient: <span className="text-foreground/50 tabular-nums" translate="no">
                {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
              </span>
            </div>
          </div>

          {/* Amount */}
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">Amount</span>
              <button
                onClick={setMax}
                className="text-[9px] font-mono text-primary/60 hover:text-primary transition-colors"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.000001"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-2xl font-mono text-foreground outline-none"
              />
              <span className="text-sm font-semibold text-primary shrink-0">USDC</span>
            </div>
          </div>

          {/* Validation message */}
          {amount && readinessCheck && !readinessCheck.ready && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertCircle size={12} className="text-red-400 shrink-0" />
              <span className="text-[10px] font-mono text-red-400/80">{readinessCheck.reason}</span>
            </div>
          )}

          {/* Confirm button */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!readinessCheck?.ready || isProcessing}
            className="w-full py-3.5 rounded-xl bg-violet-500 text-white font-semibold hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
          >
            <ArrowRight size={16} />
            Iniciar Bridge
          </button>
        </motion.div>
      )}

      {/* ── Confirmation modal ── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-card shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                  <Zap size={16} className="text-violet-400" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Bridge Summary</h3>
              </div>

              <div className="space-y-2 text-sm">
                {[
                  { label: 'From',      value: 'Solana' },
                  { label: 'To',        value: destName },
                  { label: 'Amount',    value: `${amountNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC` },
                  { label: 'Recipient', value: `${evmAddress!.slice(0, 8)}...${evmAddress!.slice(-6)}` },
                  { label: 'Protocol',  value: 'Circle CCTP V2' },
                  { label: 'Network fee', value: 'SOL (Solana) + gas (EVM)' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[10px] font-mono text-amber-400/80 leading-relaxed">
                Você precisará assinar duas transações: uma na carteira Solana e outra na carteira EVM. Nenhuma transação é enviada automaticamente.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-secondary/40 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBridge}
                  className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-400 transition-all"
                >
                  Confirm Bridge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress ── */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.06] bg-card/90 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={14} className="animate-spin text-violet-400" />
            <span className="text-sm font-mono text-foreground/70">
              {bridgeState.progressMessage ?? stepLabel(bridgeState.step)}
            </span>
          </div>

          {/* Step progress bar */}
          <div className="space-y-1.5">
            {STEP_ORDER.filter(s => s !== 'idle').map((s) => {
              const current = stepIndex(bridgeState.step);
              const thisIdx = stepIndex(s);
              const done    = thisIdx < current;
              const active  = thisIdx === current;
              return (
                <div key={s} className={`flex items-center gap-2 text-[10px] font-mono transition-colors ${
                  done ? 'text-emerald-400' : active ? 'text-violet-400' : 'text-muted-foreground/20'
                }`}>
                  {done
                    ? <CheckCircle2 size={10} />
                    : active
                      ? <Loader2 size={10} className="animate-spin" />
                      : <span className="w-2.5 h-2.5 rounded-full border border-current" />
                  }
                  {stepLabel(s)}
                </div>
              );
            })}
          </div>

          {bridgeState.solanaTxSignature && (
            <a
              href={solExplorer(bridgeState.solanaTxSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/30 hover:text-violet-400 transition-colors"
            >
              Ver transação Solana <ExternalLink size={8} />
            </a>
          )}
        </motion.div>
      )}

      {/* ── Success ── */}
      {bridgeState.step === 'complete' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="text-base font-semibold text-emerald-400">Bridge Concluída</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">From</span>
              <span className="text-foreground">Solana</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">To</span>
              <span className="text-foreground">{destName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">Amount</span>
              <span className="text-foreground">{amountNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">Recipient</span>
              <span className="text-foreground tabular-nums">{evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {bridgeState.solanaTxSignature && (
              <a
                href={solExplorer(bridgeState.solanaTxSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40 hover:text-emerald-400 transition-colors"
              >
                Solana tx <ExternalLink size={8} />
              </a>
            )}
            {bridgeState.evmTxHash && (
              <a
                href={evmExplorer(destId, bridgeState.evmTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40 hover:text-emerald-400 transition-colors"
              >
                {destName} tx <ExternalLink size={8} />
              </a>
            )}
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <RefreshCw size={10} />
            Nova Bridge
          </button>
        </motion.div>
      )}

      {/* ── Error ── */}
      {bridgeState.step === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1">Erro na Bridge</p>
              <p className="text-[11px] font-mono text-red-400/70 leading-relaxed">
                {bridgeState.errorMessage}
              </p>
            </div>
          </div>

          {bridgeState.solanaTxSignature && (
            <a
              href={solExplorer(bridgeState.solanaTxSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/30 hover:text-red-400/60 transition-colors"
            >
              Ver transação Solana <ExternalLink size={8} />
            </a>
          )}

          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <RefreshCw size={10} />
            Tentar novamente
          </button>
        </motion.div>
      )}

    </div>
  );
}
