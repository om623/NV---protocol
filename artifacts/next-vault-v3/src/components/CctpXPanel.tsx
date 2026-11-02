import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import type { Eip1193Provider } from '../lib/arc';
import { executeCctpXTransfer } from '../lib/cctpXExecutor';

type EnvMode = 'testnet' | 'mainnet';

interface CctpXPanelProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  envMode: EnvMode;
}

const TESTNET_OPTIONS = [
  { id: 'base-sepolia', name: 'Base Sepolia', domain: 6 },
  { id: 'arc-testnet', name: 'Arc Testnet', domain: 26 },
  { id: 'sepolia', name: 'Ethereum Sepolia', domain: 0 },
] as const;

const MAINNET_OPTIONS = [
  { id: 'arc-mainnet', name: 'Arc', domain: 26 },
  { id: 'base', name: 'Base', domain: 6 },
  { id: 'ethereum', name: 'Ethereum', domain: 0 },
  { id: 'arbitrum', name: 'Arbitrum One', domain: 3 },
  { id: 'optimism', name: 'OP Mainnet', domain: 2 },
  { id: 'polygon', name: 'Polygon PoS', domain: 7 },
  { id: 'avalanche', name: 'Avalanche', domain: 1 },
] as const;

export function CctpXPanel({ provider, connectedAddress, envMode }: CctpXPanelProps) {
  const networks = envMode === 'mainnet' ? MAINNET_OPTIONS : TESTNET_OPTIONS;
  const [fromNetwork, setFromNetwork] = useState<string>(
    envMode === 'mainnet' ? 'arc-mainnet' : 'base-sepolia',
  );
  const [toNetwork, setToNetwork] = useState<string>(
    envMode === 'mainnet' ? 'base' : 'arc-testnet',
  );
  const [tokenId, setTokenId] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [burnHash, setBurnHash] = useState('');
  const [mintHash, setMintHash] = useState('');

  useEffect(() => {
    setFromNetwork(envMode === 'mainnet' ? 'arc-mainnet' : 'base-sepolia');
    setToNetwork(envMode === 'mainnet' ? 'base' : 'arc-testnet');
    setStatus('idle');
    setMessage('');
    setBurnHash('');
    setMintHash('');
  }, [envMode]);

  const selectedFrom = networks.find(network => network.id === fromNetwork);
  const selectedTo = networks.find(network => network.id === toNetwork);
  const canTransfer = Boolean(
    provider && connectedAddress && selectedFrom && selectedTo &&
    fromNetwork !== toNetwork && /^0x[0-9a-fA-F]{64}$/.test(tokenId) &&
    amount.trim() && Number(amount) > 0 && status !== 'processing',
  );

  function resetStatus() {
    if (status === 'processing') return;
    setStatus('idle');
    setMessage('');
    setBurnHash('');
    setMintHash('');
  }

  async function handleTransfer() {
    if (!provider || !connectedAddress) {
      setStatus('error');
      setMessage('Conecte uma carteira EVM antes de continuar.');
      return;
    }
    if (!selectedFrom || !selectedTo || fromNetwork === toNetwork) {
      setStatus('error');
      setMessage('Selecione duas redes CCTP X diferentes.');
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(tokenId)) {
      setStatus('error');
      setMessage('Informe o tokenId CCTP X (bytes32) fornecido pelo emissor.');
      return;
    }
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setStatus('error');
      setMessage('Informe uma quantidade válida.');
      return;
    }

    setStatus('processing');
    setMessage('Iniciando validações...');
    setBurnHash('');
    setMintHash('');

    const result = await executeCctpXTransfer({
      provider,
      walletAddress: connectedAddress,
      fromNetwork,
      toNetwork,
      tokenId: tokenId.trim(),
      amount: amount.trim(),
      onProgress: setMessage,
    });

    if (!result.success) {
      setStatus('error');
      setMessage(result.error ?? 'A transferência CCTP X não foi concluída.');
      setBurnHash(result.burnTxHash ?? '');
      return;
    }

    setStatus('success');
    setMessage(
      `${result.token?.symbol ?? 'Token'} transferido com sucesso: ${result.token?.name ?? 'ativo CCTP X'}.`,
    );
    setBurnHash(result.burnTxHash ?? '');
    setMintHash(result.mintTxHash ?? '');
    setAmount('');
  }

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-card/90 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)] space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <ShieldCheck size={19} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">CCTP X — ERC-20 de terceiros</h2>
          <p className="text-sm text-muted-foreground">
            Transferência nativa burn-and-mint para tokens configurados pelo emissor.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
        Este fluxo é independente da Bridge USDC existente. Aceita apenas tokens issuer-managed já
        registrados no CCTP X nas duas redes. O emissor precisa ter configurado os TokenManagers,
        permissões de mint, limites e confiança entre domínios. Tokens comuns não se tornam
        compatíveis automaticamente.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Origem</span>
          <select
            value={fromNetwork}
            disabled={status === 'processing'}
            onChange={event => { setFromNetwork(event.target.value); resetStatus(); }}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {networks.map(network => <option key={network.id} value={network.id}>{network.name}</option>)}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Destino</span>
          <select
            value={toNetwork}
            disabled={status === 'processing'}
            onChange={event => { setToNetwork(event.target.value); resetStatus(); }}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {networks.map(network => <option key={network.id} value={network.id}>{network.name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>{selectedFrom?.name ?? fromNetwork}</span>
        <ArrowRight size={14} className="text-primary" />
        <span>{selectedTo?.name ?? toNetwork}</span>
      </div>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Token ID (bytes32)</span>
        <input
          value={tokenId}
          onChange={event => { setTokenId(event.target.value); resetStatus(); }}
          disabled={status === 'processing'}
          placeholder="0x..."
          spellCheck={false}
          className="w-full bg-background border border-border/50 rounded-xl px-3 py-3 text-xs font-mono text-foreground outline-none focus:border-primary/50"
        />
        <span className="block text-[11px] text-muted-foreground">
          Identificador cross-chain emitido pelo Circle CCTP X — não é o endereço do contrato ERC-20.
        </span>
      </label>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground/70">Quantidade</span>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={event => { setAmount(event.target.value); resetStatus(); }}
          disabled={status === 'processing'}
          placeholder="0.00"
          className="w-full bg-background border border-border/50 rounded-xl px-3 py-3 text-xl font-mono text-foreground outline-none focus:border-primary/50"
        />
      </label>

      {message && (
        <div className={`rounded-xl border p-3 text-xs break-all leading-relaxed ${
          status === 'error'
            ? 'border-red-500/20 bg-red-500/5 text-red-400'
            : status === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
              : 'border-primary/20 bg-primary/5 text-primary'
        }`}>
          {message}
          {burnHash && <div className="mt-2">Origem: {burnHash}</div>}
          {mintHash && <div className="mt-1">Destino: {mintHash}</div>}
          {status === 'error' && burnHash && (
            <div className="mt-2 font-semibold">
              O burn foi enviado. Não repita a transferência antes de verificar o estado desta operação.
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleTransfer}
        disabled={!canTransfer}
        className="w-full rounded-xl py-3.5 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {status === 'processing' ? (
          <><Loader2 size={16} className="animate-spin" /> Processando CCTP X...</>
        ) : (
          <><ArrowRight size={16} /> Transferir ERC-20</>
        )}
      </button>

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        A cotação de taxa é consultada na Circle Iris antes do burn. Este fluxo usa finalidade padrão
        e exige gas na rede de origem e na rede de destino. A transferência é irreversível.
      </p>
    </section>
  );
}
