import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Loader2,
  Wallet,
} from 'lucide-react';

import type { Eip1193Provider } from '../lib/arc';
import { getBridgeRoutes } from '../lib/cctpBridge';
import { executeBridge } from '../lib/cctpBridgeExecutor';
import { SolanaBridgePanel } from './SolanaBridgePanel';
import { NETWORKS_CONFIG, type NetworkConfig } from '../networks';
import {
  discoverLifiBridgeNetworks,
  discoverLifiBridgeTokens,
  executeLifiBridge,
  type LifiBridgeToken,
} from '../lib/lifiBridge';

interface BridgeViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  envMode: EnvMode;
}

// ─── Network display metadata ─────────────────────────────────────────────────
// Keyed by the same IDs used in cctp.ts / bridge.ts.

const TESTNET_NETWORKS = {
  'base-sepolia':  { name: 'Base Sepolia' },
  'arc-testnet':   { name: 'Arc Testnet' },
  'sepolia':       { name: 'Ethereum Sepolia' },
} as const;

const MAINNET_NETWORKS = {
  // IDs match cctp.ts exactly — 25 CCTP V2 EVM mainnet chains + Solana (October 2026).
  // Solana is listed as a source-only option (non-EVM — renders SolanaBridgePanel).
  'arc-mainnet':   { name: 'Arc' },
  'base':          { name: 'Base' },
  'solana':        { name: 'Solana ↗' },   // Non-EVM — triggers SolanaBridgePanel when FROM
  'arbitrum':      { name: 'Arbitrum One' },
  'ethereum':      { name: 'Ethereum' },
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
  return NETWORKS_CONFIG.find(network => network.id === id)?.name ?? id;
}

function getBridgeTokenKey(token: LifiBridgeToken): string {
  return token.isNative
    ? `native:${token.symbol.toUpperCase()}`
    : (token.address ?? '').toLowerCase();
}

function defaultBridgeToken(tokens: LifiBridgeToken[]): string {
  const preferred = tokens.find(token => token.symbol.toUpperCase() === 'USDC') ?? tokens[0];
  return preferred ? getBridgeTokenKey(preferred) : '';
}

interface TokenPickerProps {
  label: string;
  tokens: LifiBridgeToken[];
  selectedKey: string;
  disabled: boolean;
  onChange: (key: string) => void;
}

function TokenLogo({ token }: { token: LifiBridgeToken }) {
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-primary/10 text-[10px] font-bold text-primary">
      {token.symbol.slice(0, 2).toUpperCase()}
      {token.logoURI ? (
        <img
          src={token.logoURI}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={event => { event.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 h-full w-full rounded-full bg-card object-cover"
        />
      ) : null}
    </span>
  );
}

function TokenPicker({ label, tokens, selectedKey, disabled, onChange }: TokenPickerProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selected = tokens.find(token => getBridgeTokenKey(token) === selectedKey);

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
      <label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground/60">{label}</label>
      <details ref={detailsRef} className="group relative" >
        <summary
          aria-label={label}
          aria-disabled={disabled}
          className={`flex w-full list-none items-center gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5 text-left outline-none transition-colors marker:hidden focus:border-primary/50 [&::-webkit-details-marker]:hidden ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/40'}`}
          onClick={event => { if (disabled) event.preventDefault(); }}
        >
          {selected ? <TokenLogo token={selected} /> : <span className="h-8 w-8 rounded-full bg-secondary" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{selected?.symbol ?? (tokens.length ? 'Selecione um token' : 'Carregando tokens...')}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{selected?.name ?? 'Catálogo LI.FI'}</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-card p-1.5 shadow-2xl">
          {tokens.map(token => {
            const key = getBridgeTokenKey(token);
            const addressLabel = token.address
              ? `${token.address.slice(0, 6)}…${token.address.slice(-4)}`
              : 'Token nativo';
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  if (detailsRef.current) detailsRef.current.open = false;
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/70 ${key === selectedKey ? 'bg-primary/10' : ''}`}
              >
                <TokenLogo token={token} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">{token.symbol} <span className="font-normal text-muted-foreground">· {token.name}</span></span>
                  <span className="block truncate font-mono text-[9px] text-muted-foreground/60">{addressLabel}</span>
                </span>
              </button>
            );
          })}
          {!tokens.length ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum token disponível nesta rede.</p> : null}
        </div>
      </details>
    </div>
  );
}

export function BridgeView({
  provider,
  connectedAddress,
  envMode,
}: BridgeViewProps) {
  const routes = getBridgeRoutes();
  const [routeProvider, setRouteProvider] = useState<'cctp' | 'lifi'>('cctp');
  const [lifiNetworks, setLifiNetworks] = useState<NetworkConfig[]>([]);
  const [lifiNetworksLoading, setLifiNetworksLoading] = useState(false);
  const [lifiTokensFrom, setLifiTokensFrom] = useState<LifiBridgeToken[]>([]);
  const [lifiTokensTo, setLifiTokensTo] = useState<LifiBridgeToken[]>([]);
  const [lifiTokensLoading, setLifiTokensLoading] = useState(false);
  const [lifiError, setLifiError] = useState('');
  const [sourceTokenKey, setSourceTokenKey] = useState('');
  const [destinationTokenKey, setDestinationTokenKey] = useState('');

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
  const lifiActiveNetworks = useMemo(
    () => Object.fromEntries(lifiNetworks.map(network => [network.id, { name: network.name }])),
    [lifiNetworks],
  );
  const networkOptions = routeProvider === 'lifi' ? lifiActiveNetworks : activeNetworks;
  const selectedSourceToken = lifiTokensFrom.find(token => getBridgeTokenKey(token) === sourceTokenKey);
  const selectedDestinationToken = lifiTokensTo.find(token => getBridgeTokenKey(token) === destinationTokenKey);

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
  // LI.FI DISCOVERY — isolated from CCTP and the existing Swap registry
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (routeProvider !== 'lifi' || !isMainnet) return;
    let cancelled = false;
    setLifiNetworksLoading(true);
    setLifiError('');
    discoverLifiBridgeNetworks(NETWORKS_CONFIG)
      .then(networks => {
        if (cancelled) return;
        setLifiNetworks(networks);
        if (networks.length) {
          const availableIds = new Set(networks.map(network => network.id));
          const nextFrom = availableIds.has(fromNetwork) ? fromNetwork : networks[0].id;
          const nextTo = availableIds.has(toNetwork) && toNetwork !== nextFrom
            ? toNetwork
            : (networks.find(network => network.id !== nextFrom) ?? networks[0]).id;
          setFromNetwork(nextFrom as NetworkId);
          setToNetwork(nextTo as NetworkId);
        }
      })
      .catch(error => {
        if (!cancelled) setLifiError(error instanceof Error ? error.message : 'Não foi possível carregar as redes LI.FI.');
      })
      .finally(() => {
        if (!cancelled) setLifiNetworksLoading(false);
      });
    return () => { cancelled = true; };
  }, [routeProvider, isMainnet]);

  useEffect(() => {
    if (routeProvider !== 'lifi' || !isMainnet) return;
    const sourceNetwork = NETWORKS_CONFIG.find(network => network.id === fromNetwork && network.type === 'mainnet');
    const destinationNetwork = NETWORKS_CONFIG.find(network => network.id === toNetwork && network.type === 'mainnet');
    if (!sourceNetwork || !destinationNetwork) return;
    let cancelled = false;
    setLifiTokensLoading(true);
    if (lifiNetworks.length) setLifiError('');
    setLifiTokensFrom([]);
    setLifiTokensTo([]);
    Promise.all([
      discoverLifiBridgeTokens(sourceNetwork),
      discoverLifiBridgeTokens(destinationNetwork),
    ])
      .then(([sourceTokens, destinationTokens]) => {
        if (cancelled) return;
        setLifiTokensFrom(sourceTokens);
        setLifiTokensTo(destinationTokens);
        setSourceTokenKey(previous => sourceTokens.some(token => getBridgeTokenKey(token) === previous)
          ? previous : defaultBridgeToken(sourceTokens));
        setDestinationTokenKey(previous => destinationTokens.some(token => getBridgeTokenKey(token) === previous)
          ? previous : defaultBridgeToken(destinationTokens));
      })
      .catch(error => {
        if (!cancelled) setLifiError(error instanceof Error ? error.message : 'Não foi possível carregar os tokens LI.FI.');
      })
      .finally(() => {
        if (!cancelled) setLifiTokensLoading(false);
      });
    return () => { cancelled = true; };
  }, [routeProvider, isMainnet, fromNetwork, toNetwork]);

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
    (routeProvider === 'lifi'
      ? isMainnet && !lifiNetworksLoading && !lifiTokensLoading &&
        Boolean(selectedSourceToken) && Boolean(selectedDestinationToken) &&
        lifiNetworks.some(network => network.id === fromNetwork) &&
        lifiNetworks.some(network => network.id === toNetwork) &&
        fromNetwork !== toNetwork
      : Boolean(route)) &&
    Number(amount) > 0 &&
    status !== 'processing';

  // Keep Bridge route state aligned with the single global environment selector.
  useEffect(() => {
    setFromNetwork(DEFAULT_FROM[envMode]);
    setToNetwork(DEFAULT_TO[envMode]);
    if (envMode === 'testnet') setRouteProvider('cctp');
    setStatus('idle');
    setMessage('');
    setAmount('');
  }, [envMode]);

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
    if (routeProvider === 'cctp' && !route) {
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
        'Informe uma quantidade válida para o ativo selecionado.',
      );
      return;
    }

    if (routeProvider === 'lifi') {
      const sourceNetwork = NETWORKS_CONFIG.find(network => network.id === fromNetwork && network.type === 'mainnet');
      const destinationNetwork = NETWORKS_CONFIG.find(network => network.id === toNetwork && network.type === 'mainnet');
      if (!sourceNetwork || !destinationNetwork ||
          !lifiNetworks.some(network => network.id === fromNetwork) ||
          !lifiNetworks.some(network => network.id === toNetwork) ||
          !selectedSourceToken || !selectedDestinationToken) {
        setStatus('error');
        setMessage('Selecione redes e tokens disponíveis na rota LI.FI.');
        return;
      }
      try {
        setStatus('processing');
        setMessage('Preparando cotação LI.FI...');
        const result = await executeLifiBridge({
          provider,
          walletAddress: connectedAddress,
          fromNetwork: sourceNetwork,
          toNetwork: destinationNetwork,
          sourceToken: selectedSourceToken,
          destinationToken: selectedDestinationToken,
          amount,
          onProgress: setMessage,
        });
        setStatus('success');
        setMessage(
          `${result.statusMessage} Protocolo: ${result.tool} · Bridge: ${result.bridge}.${result.estimatedOutput ? ` Saída mínima estimada: ${result.estimatedOutput} ${selectedDestinationToken.symbol}.` : ''} Hash origem: ${result.transactionHash}${result.destinationTxHash ? ` · Hash destino: ${result.destinationTxHash}` : ''}`,
        );
        setAmount('');
      } catch (error) {
        console.error('NV Protocol — LI.FI Bridge error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Erro inesperado ao executar a rota LI.FI.');
      }
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
              CCTP para USDC · LI.FI para múltiplos ativos
            </p>
          </div>

        </div>
      </div>

      {isMainnet && (
        <div className="flex gap-2 rounded-xl border border-border/40 bg-secondary/20 p-1">
          <button
            type="button"
            onClick={() => { setRouteProvider('cctp'); setStatus('idle'); setMessage(''); }}
            disabled={status === 'processing'}
            className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${routeProvider === 'cctp' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Circle CCTP V2
          </button>
          <button
            type="button"
            onClick={() => {
              setRouteProvider('lifi');
              setFromNetwork(DEFAULT_FROM.mainnet);
              setToNetwork(DEFAULT_TO.mainnet);
              setStatus('idle');
              setMessage('');
            }}
            disabled={status === 'processing'}
            className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${routeProvider === 'lifi' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            LI.FI Aggregator
          </button>
        </div>
      )}

      {routeProvider === 'lifi' && (
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
          LI.FI agrega provedores de bridge e exchanges para encontrar rotas cross-chain entre redes EVM mainnet. Redes e ativos são carregados do catálogo oficial; a execução depende de uma cotação disponível para o par e valor selecionados. Testnets e Solana continuam no fluxo CCTP original.
          {lifiNetworksLoading || lifiTokensLoading ? <span className="block mt-2 text-primary">Carregando redes e ativos compatíveis...</span> : null}
          {lifiError ? <span className="block mt-2 text-amber-400">{lifiError}</span> : null}
          {!lifiNetworksLoading && !lifiNetworks.length && !lifiError ? <span className="block mt-2 text-amber-400">Nenhuma rede EVM desta configuração está disponível no catálogo LI.FI no momento.</span> : null}
        </div>
      )}

      {/* ─────────────────────────────────────────────
          SOLANA BRIDGE (non-EVM path)
          Rendered when "Solana ↗" is selected as FROM
          in mainnet mode. Completely isolated from the
          EVM bridge path below.
      ───────────────────────────────────────────── */}

      {routeProvider === 'cctp' && isMainnet && fromNetwork === 'solana' && (
        <SolanaBridgePanel
          evmProvider={provider}
          evmAddress={connectedAddress}
        />
      )}

      {/* ─────────────────────────────────────────────
          MAIN CARD (EVM bridge — hidden when Solana FROM)
      ───────────────────────────────────────────── */}

      {!(routeProvider === 'cctp' && isMainnet && fromNetwork === 'solana') && (<>
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
            {Object.entries(networkOptions).map(
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
            {Object.entries(networkOptions).map(
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

        {routeProvider === 'lifi' && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TokenPicker
              label="Ativo de origem"
              tokens={lifiTokensFrom}
              selectedKey={sourceTokenKey}
              disabled={lifiTokensLoading || status === 'processing'}
              onChange={key => { setSourceTokenKey(key); setStatus('idle'); setMessage(''); }}
            />
            <TokenPicker
              label="Ativo de destino"
              tokens={lifiTokensTo}
              selectedKey={destinationTokenKey}
              disabled={lifiTokensLoading || status === 'processing'}
              onChange={key => { setDestinationTokenKey(key); setStatus('idle'); setMessage(''); }}
            />
          </div>
        )}

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
              {routeProvider === 'lifi' ? selectedSourceToken?.symbol ?? 'Token' : 'USDC'}
            </div>

          </div>

          <div className="flex items-center gap-3">

            <input
              type="number"
              min="0"
              step={routeProvider === 'lifi' && selectedSourceToken ? String(1 / (10 ** selectedSourceToken.decimals)) : '0.000001'}
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
              {routeProvider === 'lifi' ? selectedSourceToken?.symbol ?? 'Token' : 'USDC'}
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
              {routeProvider === 'lifi' ? `${selectedSourceToken?.symbol ?? '—'} → ${selectedDestinationToken?.symbol ?? '—'}` : 'USDC'}
            </span>

          </div>

          <div className="flex justify-between text-sm">

            <span className="text-muted-foreground">
              Protocolo
            </span>

            <span className="font-mono text-primary">
              {routeProvider === 'lifi' ? 'LI.FI · Bridges + DEXs' : 'Circle CCTP V2'}
            </span>

          </div>

          <div className="flex justify-between text-sm">

            <span className="text-muted-foreground">
              Taxa da Bridge
            </span>

            <span className="font-mono text-foreground">
              {routeProvider === 'lifi' ? 'Calculada pela LI.FI' : route ? `${route.fee} USDC` : '—'}
            </span>

          </div>

          <div className="flex justify-between text-sm">

            <span className="text-muted-foreground">
              Tempo estimado
            </span>

            <span className="font-mono text-foreground">
              {routeProvider === 'lifi' ? 'Estimado pela rota' : route?.estimatedTime ?? '—'}
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

      {routeProvider === 'cctp' && connectedAddress && !route && (
        <div className="text-center text-xs text-amber-400/70">
          Esta combinação de redes ainda não está
          disponível no CCTP configurado.
        </div>
      )}
      </>)}

    </div>
  );
}
