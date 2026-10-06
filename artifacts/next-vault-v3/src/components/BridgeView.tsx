import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Loader2,
  Wallet,
} from 'lucide-react';

import type { Eip1193Provider } from '../lib/arc';
import { getBridgeRoutes } from '../lib/cctpBridge';
import { executeBridge } from '../lib/cctpBridgeExecutor';

interface BridgeViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
}

// ─── Network display metadata ─────────────────────────────────────────────────
// Keyed by the same IDs used in cctp.ts / bridge.ts.

const TESTNET_NETWORKS = {
  'base-sepolia':  { name: 'Base Sepolia' },
  'arc-testnet':   { name: 'Arc Testnet' },
  'sepolia':       { name: 'Ethereum Sepolia' },
} as const;

const MAINNET_NETWORKS = {
  // IDs match cctp.ts exactly — 25 CCTP V2 EVM mainnet chains (October 2026).
  'arc-mainnet':   { name: 'Arc' },
  'ethereum':      { name: 'Ethereum' },
  'base':          { name: 'Base' },
  'arbitrum':      { name: 'Arbitrum One' },
  'optimism':      { name: 'OP Mainnet' },
  'polygon':       { name: 'Polygon PoS' },
  'avalanche':     { name: 'Avalanche' },
  'unichain':      { name: 'Unichain' },
  'linea':         { name: 'Linea' },
  'codex':         { name: 'Codex' },
  'sonic':         { name: 'Sonic' },
  'world-chain':   { name: 'World Chain' },
  'monad':         { name: 'Monad' },
  'sei':           { name: 'Sei' },
  'xdc':           { name: 'XDC Network' },
  'hyperevm':      { name: 'HyperEVM' },
  'ink':           { name: 'Ink' },
  'plume':         { name: 'Plume' },
  'edge':          { name: 'EDGE' },
  'injective':     { name: 'Injective (inEVM)' },
  'morph':         { name: 'Morph' },
  'pharos':        { name: 'Pharos' },
  'cronos':        { name: 'Cronos' },
  'plasma':        { name: 'Plasma' },
  'xlayer':        { name: 'X Layer' },
} as const;

type TestnetId = keyof typeof TESTNET_NETWORKS;
type MainnetId = keyof typeof MAINNET_NETWORKS;
type NetworkId = TestnetId | MainnetId;

type EnvMode = 'testnet' | 'mainnet';

const DEFAULT_FROM: Record<EnvMode, NetworkId> = {
  testnet: 'base-sepolia',
  mainnet: 'arc-mainnet',
};

const DEFAULT_TO: Record<EnvMode, NetworkId> = {
  testnet: 'arc-testnet',
  mainnet: 'base',
};

function getNetworkName(id: string): string {
  if (id in TESTNET_NETWORKS) return TESTNET_NETWORKS[id as TestnetId].name;
  if (id in MAINNET_NETWORKS) return MAINNET_NETWORKS[id as MainnetId].name;
  return id;
}

export function BridgeView({
  provider,
  connectedAddress,
}: BridgeViewProps) {
  const routes = getBridgeRoutes();

  // ─────────────────────────────────────────────────────────────
  // ENV MODE (testnet / mainnet)
  // ─────────────────────────────────────────────────────────────

  const [envMode, setEnvMode] = useState<EnvMode>('testnet');

  // ─────────────────────────────────────────────────────────────
  // ROTAS DISPONÍVEIS para o modo atual
  // ─────────────────────────────────────────────────────────────

  const isMainnet = envMode === 'mainnet';

  const availableRoutes = useMemo(
    () =>
      routes.filter(route => {
        if (route.status !== 'available') return false;
        if (route.token !== 'USDC') return false;
        // Keep only routes whose fromNetwork belongs to the active env.
        const fromIsMainnet = route.fromNetwork in MAINNET_NETWORKS;
        return isMainnet ? fromIsMainnet : !fromIsMainnet;
      }),
    [routes, isMainnet],
  );

  // Networks available for the current env (for the dropdowns).
  const activeNetworks = isMainnet ? MAINNET_NETWORKS : TESTNET_NETWORKS;

  // ─────────────────────────────────────────────────────────────
  // ESTADO DA BRIDGE
  // ─────────────────────────────────────────────────────────────

  const [fromNetwork, setFromNetwork] =
    useState<NetworkId>(DEFAULT_FROM[envMode]);

  const [toNetwork, setToNetwork] =
    useState<NetworkId>(DEFAULT_TO[envMode]);

  const [amount, setAmount] = useState('');

  const [status, setStatus] = useState<
    'idle' | 'processing' | 'success' | 'error'
  >('idle');

  const [message, setMessage] = useState('');

  // ─────────────────────────────────────────────────────────────
  // ROTA ATUAL
  // ─────────────────────────────────────────────────────────────

  const route = availableRoutes.find(
    item =>
      item.fromNetwork === fromNetwork &&
      item.toNetwork === toNetwork,
  );

  // ─────────────────────────────────────────────────────────────
  // VALIDAÇÃO DO BOTÃO
  // ─────────────────────────────────────────────────────────────

  const canBridge =
    Boolean(provider) &&
    Boolean(connectedAddress) &&
    Boolean(route) &&
    Number(amount) > 0 &&
    status !== 'processing';

  // ─────────────────────────────────────────────────────────────
  // TROCAR MODO (testnet / mainnet)
  // ─────────────────────────────────────────────────────────────

  function switchEnvMode(mode: EnvMode) {
    setEnvMode(mode);
    setFromNetwork(DEFAULT_FROM[mode]);
    setToNetwork(DEFAULT_TO[mode]);
    setStatus('idle');
    setMessage('');
    setAmount('');
  }

  // ─────────────────────────────────────────────────────────────
  // TROCAR REDES
  // ─────────────────────────────────────────────────────────────

  function switchNetworks() {
    const oldFrom = fromNetwork;

    setFromNetwork(toNetwork);
    setToNetwork(oldFrom);

    setStatus('idle');
    setMessage('');
  }

  // ─────────────────────────────────────────────────────────────
  // EXECUTAR BRIDGE
  // ─────────────────────────────────────────────────────────────

  async function handleBridge() {
    console.log('NV Bridge: botão Iniciar Bridge acionado');

    // Carteira
    if (!provider) {
      setStatus('error');
      setMessage('Conecte sua carteira primeiro.');
      return;
    }

    // Endereço
    if (!connectedAddress) {
      setStatus('error');
      setMessage(
        'Endereço da carteira não encontrado.',
      );
      return;
    }

    // Rota
    if (!route) {
      setStatus('error');
      setMessage(
        `Rota indisponível: ${getNetworkName(fromNetwork)} → ${getNetworkName(toNetwork)}`,
      );
      return;
    }

    // Quantidade
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setStatus('error');
      setMessage(
        'Informe uma quantidade válida de USDC.',
      );
      return;
    }

    try {
      setStatus('processing');

      setMessage(
        `Preparando Bridge de ${numericAmount} USDC...`,
      );

      console.log('NV Bridge:', {
        fromNetwork,
        toNetwork,
        amount: numericAmount,
        walletAddress: connectedAddress,
      });

      // ─────────────────────────────────────────────
      // EXECUTOR CCTP V2
      // ─────────────────────────────────────────────

      const result = await executeBridge({
        provider,
        fromNetwork,
        toNetwork,
        walletAddress: connectedAddress,
        amount: numericAmount,
      });

      console.log(
        'NV Bridge: resultado do executor',
        result,
      );

      // ─────────────────────────────────────────────
      // ERRO
      // ─────────────────────────────────────────────

      if (!result.success) {
        setStatus('error');

        setMessage(
          result.error ??
            'A transferência CCTP V2 falhou.',
        );

        return;
      }

      // ─────────────────────────────────────────────
      // SUCESSO
      // ─────────────────────────────────────────────

      setStatus('success');

      setMessage(
        `Bridge concluída. Burn: ${
          result.burnTxHash ?? '—'
        } | Mint: ${
          result.mintTxHash ?? '—'
        }`,
      );

      setAmount('');
    } catch (error) {
      console.error(
        'NV Protocol — Bridge error:',
        error,
      );

      setStatus('error');

      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao executar a Bridge.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INTERFACE
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">

      {/* ─────────────────────────────────────────────
          HEADER
      ───────────────────────────────────────────── */}

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

      {/* ─────────────────────────────────────────────
          ENV MODE TOGGLE (Testnet / Mainnet)
      ───────────────────────────────────────────── */}

      <div className="flex rounded-xl border border-border/40 overflow-hidden text-sm font-medium">
        <button
          type="button"
          onClick={() => switchEnvMode('testnet')}
          disabled={status === 'processing'}
          className={`flex-1 py-2 transition-all disabled:cursor-not-allowed ${
            envMode === 'testnet'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/20 text-muted-foreground hover:text-foreground'
          }`}
        >
          🧪 Testnet
        </button>
        <button
          type="button"
          onClick={() => switchEnvMode('mainnet')}
          disabled={status === 'processing'}
          className={`flex-1 py-2 transition-all disabled:cursor-not-allowed ${
            envMode === 'mainnet'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/20 text-muted-foreground hover:text-foreground'
          }`}
        >
          🌐 Mainnet
        </button>
      </div>

      {/* ─────────────────────────────────────────────
          MAIN CARD
      ───────────────────────────────────────────── */}

      <div className="rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">

        {/* ─────────────────────────────────────────
            FROM
        ───────────────────────────────────────── */}

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
            onChange={event => {
              setFromNetwork(
                event.target.value as NetworkId,
              );

              setStatus('idle');
              setMessage('');
            }}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {Object.entries(activeNetworks).map(
              ([id, network]) => (
                <option
                  key={id}
                  value={id}
                >
                  {network.name}
                </option>
              ),
            )}
          </select>

        </div>

        {/* ─────────────────────────────────────────
            SWITCH
        ───────────────────────────────────────── */}

        <div className="flex justify-center -my-3 relative z-10">

          <button
            type="button"
            onClick={switchNetworks}
            disabled={status === 'processing'}
            className="w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Inverter redes"
          >
            <ArrowDown size={16} />
          </button>

        </div>

        {/* ─────────────────────────────────────────
            TO
        ───────────────────────────────────────── */}

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
            onChange={event => {
              setToNetwork(
                event.target.value as NetworkId,
              );

              setStatus('idle');
              setMessage('');
            }}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {Object.entries(activeNetworks).map(
              ([id, network]) => (
                <option
                  key={id}
                  value={id}
                >
                  {network.name}
                </option>
              ),
            )}
          </select>

        </div>

        {/* ─────────────────────────────────────────
            AMOUNT
        ───────────────────────────────────────── */}

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
              onChange={event => {
                setAmount(event.target.value);
                setStatus('idle');
                setMessage('');
              }}
              placeholder="0.00"
              disabled={status === 'processing'}
              className="w-full bg-transparent text-2xl font-mono text-foreground outline-none disabled:opacity-50"
            />

            <span className="text-sm font-semibold text-primary">
              USDC
            </span>

          </div>

        </div>

        {/* ─────────────────────────────────────────
            ROUTE INFORMATION
        ───────────────────────────────────────── */}

        <div className="mt-5 rounded-xl border border-border/40 bg-secondary/10 p-4 space-y-3">

          <div className="flex justify-between text-sm">

            <span className="text-muted-foreground">
              Rota
            </span>

            <span className="font-mono text-foreground text-right">
              {getNetworkName(fromNetwork)}
              {' → '}
              {getNetworkName(toNetwork)}
            </span>

          </div>

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
              Protocolo
            </span>

            <span className="font-mono text-primary">
              Circle CCTP V2
            </span>

          </div>

          <div className="flex justify-between text-sm">

            <span className="text-muted-foreground">
              Taxa da Bridge
            </span>

            <span className="font-mono text-foreground">
              {route
                ? `${route.fee} USDC`
                : '—'}
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

        {/* ─────────────────────────────────────────
            STATUS
        ───────────────────────────────────────── */}

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

        {/* ─────────────────────────────────────────
            ACTION
        ───────────────────────────────────────── */}

        <button
          type="button"
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

              Iniciar Bridge
            </>
          )}

        </button>

      </div>

      {/* ─────────────────────────────────────────────
          WALLET WARNING
      ───────────────────────────────────────────── */}

      {!connectedAddress && (
        <div className="text-center text-xs text-muted-foreground/60">
          Conecte sua carteira para realizar uma
          transferência on-chain.
        </div>
      )}

      {/* ─────────────────────────────────────────────
          ROUTE WARNING
      ───────────────────────────────────────────── */}

      {connectedAddress && !route && (
        <div className="text-center text-xs text-amber-400/70">
          Esta combinação de redes ainda não está
          disponível no CCTP configurado.
        </div>
      )}

    </div>
  );
        }
