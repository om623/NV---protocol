import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Loader2, Wallet } from 'lucide-react';

import type { Eip1193Provider } from '../lib/arc';
import { getBridgeRoutes } from '../lib/cctpBridge';
import { executeBridge } from '../lib/cctpBridgeExecutor';

interface BridgeViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
}

const NETWORKS = {
  'base-sepolia': {
    name: 'Base Sepolia',
  },
  'arc-testnet': {
    name: 'Arc Testnet',
  },
  sepolia: {
    name: 'Ethereum Sepolia',
  },
} as const;

type NetworkId = keyof typeof NETWORKS;

export function BridgeView({
  provider,
  connectedAddress,
}: BridgeViewProps) {
  const routes = getBridgeRoutes();
  
    const [bridgeAmount, setBridgeAmount] = useState('');
  const [bridgeStatus, setBridgeStatus] = useState('');
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState(false);
  
  const availableRoutes = useMemo(
    () =>
      routes.filter(
        route =>
          route.status === 'available' &&
          route.token === 'USDC',
      ),
    [routes],
  );

  const [fromNetwork, setFromNetwork] =
    useState<NetworkId>('base-sepolia');

  const [toNetwork, setToNetwork] =
    useState<NetworkId>('arc-testnet');

  const [amount, setAmount] = useState('');

  const [status, setStatus] = useState<
    'idle' | 'processing' | 'success' | 'error'
  >('idle');

  const [message, setMessage] = useState('');

  const route = availableRoutes.find(
    item =>
      item.fromNetwork === fromNetwork &&
      item.toNetwork === toNetwork,
  );

  const canBridge =
    Boolean(provider) &&
    Boolean(connectedAddress) &&
    Boolean(route) &&
    Number(amount) > 0 &&
    status !== 'processing';

  function switchNetworks() {
    const oldFrom = fromNetwork;

    setFromNetwork(toNetwork);
    setToNetwork(oldFrom);
    setStatus('idle');
    setMessage('');
  }

  async function handleBridge() {
    if (!provider || !connectedAddress) {
      setStatus('error');
      setMessage('Conecte sua carteira primeiro.');
      return;
    }

    if (!route) {
      setStatus('error');
      setMessage(
        'Esta rota ainda não está disponível.',
      );
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus('error');
      setMessage('Informe uma quantidade válida de USDC.');
      return;
    }

    setStatus('processing');
    setMessage('Iniciando transferência on-chain...');

    const result = await executeBridge({
      provider,
      fromNetwork,
      toNetwork,
      walletAddress: connectedAddress,
      amount: numericAmount,
    });

    if (!result.success) {
      setStatus('error');
      setMessage(result.error ?? 'A transferência falhou.');
      return;
    }

    setStatus('success');

    setMessage(
      `Bridge concluída. Burn: ${result.burnTxHash ?? '—'} | Mint: ${result.mintTxHash ?? '—'}`,
    );

    setAmount('');
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ArrowRight
              size={20}
              className="text-primary"
            />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Bridge
            </h1>

            <p className="text-sm text-muted-foreground">
              Transferência cross-chain de USDC
            </p>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">

        {/* FROM */}
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-muted-foreground/60">
              From
            </span>

            <span className="text-xs text-muted-foreground">
              Rede de origem
            </span>
          </div>

          <select
            value={fromNetwork}
            onChange={e => {
              setFromNetwork(
                e.target.value as NetworkId,
              );
              setStatus('idle');
              setMessage('');
            }}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {Object.entries(NETWORKS).map(
              ([id, network]) => (
                <option key={id} value={id}>
                  {network.name}
                </option>
              ),
            )}
          </select>
        </div>

        {/* Switch */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={switchNetworks}
            className="w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all"
            title="Inverter redes"
          >
            <ArrowDown size={16} />
          </button>
        </div>

        {/* TO */}
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-muted-foreground/60">
              To
            </span>

            <span className="text-xs text-muted-foreground">
              Rede de destino
            </span>
          </div>

          <select
            value={toNetwork}
            onChange={e => {
              setToNetwork(
                e.target.value as NetworkId,
              );
              setStatus('idle');
              setMessage('');
            }}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {Object.entries(NETWORKS).map(
              ([id, network]) => (
                <option key={id} value={id}>
                  {network.name}
                </option>
              ),
            )}
          </select>
        </div>

        {/* Amount */}
        <div className="mt-5 rounded-xl border border-border/40 bg-secondary/20 p-4">

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-muted-foreground/60">
              Amount
            </span>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet size={13} />
              USDC
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.000001"
              value={amount}
              onChange={e => {
                setAmount(e.target.value);
                setStatus('idle');
                setMessage('');
              }}
              placeholder="0.00"
              className="w-full bg-transparent text-2xl font-mono text-foreground outline-none"
            />

            <span className="text-sm font-semibold text-primary">
              USDC
            </span>
          </div>
        </div>

        {/* Route information */}
        <div className="mt-5 space-y-2">

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Ativo
            </span>

            <span className="font-mono text-foreground">
              USDC
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Taxa da Bridge
            </span>

            <span className="font-mono text-foreground">
              {route ? `${route.fee} USDC` : '—'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Tempo estimado
            </span>

            <span className="font-mono text-foreground">
              {route?.estimatedTime ?? '—'}
            </span>
          </div>

        </div>

        {/* Status */}
        {message && (
          <div
            className={`mt-5 rounded-xl border p-3 text-xs font-mono break-all ${
              status === 'error'
                ? 'border-red-500/20 bg-red-500/5 text-red-400'
                : status === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                  : 'border-primary/20 bg-primary/5 text-primary'
            }`}
          >
            {message}
          </div>
        )}

        {/* Action */}
        <button
          onClick={handleBridge}
          disabled={!canBridge}
          className="w-full mt-5 rounded-xl py-3.5 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {status === 'processing' ? (
            <>
              <Loader2
                size={16}
                className="animate-spin"
              />
              Processando Bridge...
            </>
          ) : (
            <>
              <ArrowRight size={16} />
              Transferir USDC
            </>
          )}
        </button>

      </div>

      {/* Wallet warning */}
      {!connectedAddress && (
        <div className="text-center text-xs text-muted-foreground/60">
          Conecte sua carteira para realizar uma
          transferência on-chain.
        </div>
      )}

    </div>
  );
}
