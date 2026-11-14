import type { Eip1193Provider } from './arc';
import { ensureNetwork } from './arc';
import type { NetworkConfig, TokenConfig } from '../networks';

const LIFI_API = 'https://li.quest/v1';
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
const MAX_TOKENS_PER_CHAIN = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const STATUS_POLL_MS = 10_000;
const STATUS_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export interface LifiBridgeToken extends TokenConfig {
  coinKey?: string;
}

interface LifiChain {
  id?: number;
  chainId?: number | string;
  name?: string;
  chainType?: string;
}

interface LifiTokenResponse {
  tokens?: Record<string, Array<{
    chainId?: number;
    address?: string;
    symbol?: string;
    name?: string;
    decimals?: number;
    logoURI?: string;
    logoUrl?: string;
    coinKey?: string;
  }>>;
}

interface LifiQuote {
  tool?: string;
  toolDetails?: { name?: string };
  bridge?: string;
  includedSteps?: Array<{
    type?: string;
    tool?: string;
    toolDetails?: { name?: string };
  }>;
  estimate?: {
    fromAmount?: string;
    toAmount?: string;
    toAmountMin?: string;
    approvalAddress?: string;
    executionDuration?: number;
    feeCosts?: Array<{ name?: string; amountUSD?: string }>;
    gasCosts?: Array<{ amountUSD?: string }>;
  };
  transactionRequest?: {
    from?: string;
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    chainId?: number | string;
  };
}

interface LifiStatus {
  status?: string;
  substatus?: string;
  substatusMessage?: string;
  receiving?: { txHash?: string; chainId?: number; amount?: string; token?: { symbol?: string } };
}

const tokenCache = new Map<number, { expiresAt: number; tokens: LifiBridgeToken[] }>();
const tokenRequests = new Map<number, Promise<LifiBridgeToken[]>>();
let supportedChainIds: Set<number> | null = null;
let supportedChainsRequest: Promise<Set<number>> | null = null;

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function withTimeoutSignal(timeoutMs = REQUEST_TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson<T>(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const timeout = withTimeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: timeout.signal,
    });
    const body = await response.json().catch(() => ({})) as T & { message?: string; error?: string };
    if (!response.ok) {
      throw new Error(body.message || body.error || `LI.FI API returned HTTP ${response.status}`);
    }
    return body;
  } finally {
    timeout.clear();
  }
}

/** Return only EVM chains that are both known to NV and currently listed by LI.FI. */
export async function discoverLifiBridgeNetworks(
  configuredNetworks: NetworkConfig[],
): Promise<NetworkConfig[]> {
  if (!supportedChainsRequest) {
    supportedChainsRequest = fetchJson<LifiChain[] | { chains?: LifiChain[] }>(`${LIFI_API}/chains?chainTypes=EVM`)
      .then(data => {
        const chains = Array.isArray(data) ? data : (data.chains ?? []);
        return new Set(
          chains
            .filter(chain => !chain.chainType || chain.chainType.toUpperCase() === 'EVM')
            .map(chain => Number(chain.id ?? chain.chainId))
            .filter(id => Number.isSafeInteger(id) && id > 0),
        );
      })
      .then(ids => {
        supportedChainIds = ids;
        return ids;
      })
      .finally(() => { supportedChainsRequest = null; });
  }
  const pending = supportedChainsRequest;
  if (!supportedChainIds && !pending) throw new Error('Não foi possível carregar as redes compatíveis com LI.FI.');
  const ids = supportedChainIds ?? await pending!;
  return configuredNetworks.filter(network =>
    network.type === 'mainnet' && !network.comingSoon && ids.has(network.chainId),
  );
}

/** Load LI.FI's live token catalog without changing the existing Swap token registry. */
export async function discoverLifiBridgeTokens(network: NetworkConfig): Promise<LifiBridgeToken[]> {
  if (network.type !== 'mainnet' || !Number.isSafeInteger(network.chainId)) return [];

  const cached = tokenCache.get(network.chainId);
  if (cached && cached.expiresAt > Date.now()) return cached.tokens;
  const inFlight = tokenRequests.get(network.chainId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const data = await fetchJson<LifiTokenResponse>(
      `${LIFI_API}/tokens?chains=${network.chainId}`,
    );
    const listed = data.tokens?.[String(network.chainId)] ?? [];
    const tokens: LifiBridgeToken[] = [];
    const seen = new Set<string>();

    const add = (token: LifiBridgeToken) => {
      const key = token.isNative
        ? `native:${token.symbol.toUpperCase()}`
        : (token.address ?? '').toLowerCase();
      if (!key || seen.has(key) || tokens.length >= MAX_TOKENS_PER_CHAIN) return;
      seen.add(key);
      tokens.push(token);
    };

    // Preserve NV's configured native asset and USDC as stable fallbacks.
    for (const token of network.tokens) {
      add({
        ...token,
        address: token.isNative ? null : token.address,
      });
    }

    for (const token of listed) {
      const symbol = typeof token.symbol === 'string' ? token.symbol.trim() : '';
      const name = typeof token.name === 'string' ? token.name.trim() : '';
      const address = token.address;
      const decimals = token.decimals;
      if (!symbol || !name || symbol.length > 24 || name.length > 100) continue;
      if (!/^[a-zA-Z0-9._-]+$/.test(symbol)) continue;
      if (!isAddress(address) || !Number.isInteger(decimals) || decimals! < 0 || decimals! > 36) continue;
      if (token.chainId !== undefined && Number(token.chainId) !== network.chainId) continue;
      const isNative = address!.toLowerCase() === NATIVE_TOKEN;
      const logoURI = [token.logoURI, token.logoUrl].find(value =>
        typeof value === 'string' && value.length <= 2048 && /^https:\/\//i.test(value),
      );
      add({
        symbol,
        name,
        decimals: decimals!,
        address: isNative ? null : address!,
        isNative,
        ...(typeof token.coinKey === 'string' ? { coinKey: token.coinKey } : {}),
        ...(logoURI ? { logoURI } : {}),
      });
    }

    tokenCache.set(network.chainId, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      tokens,
    });
    return tokens;
  })().finally(() => { tokenRequests.delete(network.chainId); });

  tokenRequests.set(network.chainId, request);
  return request;
}

export function getLifiTokenAddress(token: LifiBridgeToken): string {
  return token.isNative ? NATIVE_TOKEN : token.address ?? '';
}

export function parseLifiUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d*)?$/.test(normalized)) throw new Error('Informe um valor válido.');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Este token aceita no máximo ${decimals} casas decimais.`);
  }
  return BigInt(whole) * (10n ** BigInt(decimals))
    + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export function formatLifiUnits(value: string, decimals: number): string {
  const amount = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function toHex(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = String(value);
  if (/^0x[0-9a-f]+$/i.test(raw)) return raw;
  try { return `0x${BigInt(raw).toString(16)}`; } catch { return undefined; }
}

async function waitForReceipt(provider: Eip1193Provider, hash: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 5 * 60 * 1000) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    }) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === '0x0') throw new Error(`A transação ${hash} foi revertida na rede de origem.`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error(`Tempo limite aguardando confirmação da transação ${hash}. Consulte o explorador da rede de origem.`);
}

async function sendTransaction(
  provider: Eip1193Provider,
  from: string,
  to: string,
  data: string,
  value = '0x0',
): Promise<string> {
  return await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, data, value }],
  }) as string;
}

async function waitForLifiStatus(
  quote: LifiQuote,
  txHash: string,
  fromChain: number,
  toChain: number,
  onProgress?: (message: string) => void,
): Promise<{ destinationTxHash?: string; message: string }> {
  const started = Date.now();
  const params = new URLSearchParams({
    txHash,
    fromChain: String(fromChain),
    toChain: String(toChain),
  });
  const bridgeTool = quote.bridge
    ?? quote.includedSteps?.find(step => step.type?.toLowerCase().includes('cross'))?.tool;
  if (bridgeTool) params.set('bridge', bridgeTool);

  while (Date.now() - started < STATUS_TIMEOUT_MS) {
    let status: LifiStatus;
    try {
      status = await fetchJson<LifiStatus>(`${LIFI_API}/status?${params.toString()}`);
    } catch {
      // Temporary API/network errors are retried; the source transaction is already confirmed.
      onProgress?.('A transação de origem foi confirmada; tentando atualizar o status da LI.FI...');
      await new Promise(resolve => setTimeout(resolve, STATUS_POLL_MS));
      continue;
    }

    const state = (status.status ?? '').toUpperCase();
    const substatus = (status.substatus ?? '').toUpperCase();
    if (state === 'DONE') {
      if (substatus === 'REFUNDED') {
        throw new Error('A rota LI.FI foi reembolsada: os fundos retornaram à carteira de origem.');
      }
      if (substatus === 'PARTIAL') {
        return {
          destinationTxHash: status.receiving?.txHash,
          message: 'Transferência concluída com liquidação parcial. Confira o ativo efetivamente recebido.',
        };
      }
      return {
        destinationTxHash: status.receiving?.txHash,
        message: 'Transferência cross-chain concluída.',
      };
    }
    if (state === 'FAILED' || state === 'INVALID') {
      throw new Error(status.substatusMessage || 'A LI.FI informou falha na transferência cross-chain.');
    }
    onProgress?.(status.substatusMessage || 'Aguardando liquidação na rede de destino pela LI.FI...');
    await new Promise(resolve => setTimeout(resolve, STATUS_POLL_MS));
  }
  throw new Error(`A transação de origem ${txHash} foi confirmada, mas a LI.FI ainda não confirmou a liquidação. Consulte esse hash no explorador e tente novamente mais tarde.`);
}

export interface LifiBridgeExecutionParams {
  provider: Eip1193Provider;
  walletAddress: string;
  fromNetwork: NetworkConfig;
  toNetwork: NetworkConfig;
  sourceToken: LifiBridgeToken;
  destinationToken: LifiBridgeToken;
  amount: string;
  onProgress?: (message: string) => void;
}

export interface LifiBridgeExecutionResult {
  transactionHash: string;
  destinationTxHash?: string;
  tool: string;
  bridge: string;
  estimatedOutput: string;
  statusMessage: string;
}

/**
 * Execute a single-quote LI.FI cross-chain route. Each approval and transfer
 * remains a separate explicit wallet confirmation; the CCTP path is untouched.
 */
export async function executeLifiBridge(
  args: LifiBridgeExecutionParams,
): Promise<LifiBridgeExecutionResult> {
  const {
    provider, walletAddress, fromNetwork, toNetwork,
    sourceToken, destinationToken, amount, onProgress,
  } = args;

  if (!provider || !isAddress(walletAddress)) throw new Error('Conecte uma carteira EVM válida.');
  if (fromNetwork.chainId === toNetwork.chainId) throw new Error('Escolha redes de origem e destino diferentes.');
  const fromToken = getLifiTokenAddress(sourceToken);
  const toToken = getLifiTokenAddress(destinationToken);
  if (!isAddress(fromToken) || !isAddress(toToken)) throw new Error('Endereço de token inválido para a rota LI.FI.');

  const fromAmount = parseLifiUnits(amount, sourceToken.decimals);
  if (fromAmount <= 0n) throw new Error('O valor da Bridge precisa ser maior que zero.');

  onProgress?.(`Conectando a carteira à rede ${fromNetwork.name}...`);
  await ensureNetwork(provider, {
    chainId: `0x${fromNetwork.chainId.toString(16)}`,
    chainName: fromNetwork.name,
    nativeCurrency: {
      name: fromNetwork.nativeCurrency.symbol,
      symbol: fromNetwork.nativeCurrency.symbol,
      decimals: fromNetwork.nativeCurrency.decimals,
    },
    rpcUrls: [fromNetwork.rpcUrl],
    blockExplorerUrls: [fromNetwork.explorerUrl],
  });

  const currentChain = await provider.request({ method: 'eth_chainId' }) as string;
  if (Number.parseInt(currentChain, 16) !== fromNetwork.chainId) {
    throw new Error(`A carteira não mudou para ${fromNetwork.name}. Nenhuma transação foi enviada.`);
  }

  onProgress?.('Consultando as rotas e a cotação LI.FI...');
  const query = new URLSearchParams({
    fromChain: String(fromNetwork.chainId),
    toChain: String(toNetwork.chainId),
    fromToken,
    toToken,
    fromAmount: fromAmount.toString(),
    fromAddress: walletAddress,
    toAddress: walletAddress,
    slippage: '0.005',
    order: 'RECOMMENDED',
    integrator: 'nvprotocol',
  });
  const quote = await fetchJson<LifiQuote>(`${LIFI_API}/quote?${query.toString()}`, 30_000);
  const tx = quote.transactionRequest;
  if (!tx?.to || !isAddress(tx.to) || typeof tx.data !== 'string' || !tx.data.startsWith('0x')) {
    throw new Error('A LI.FI não retornou uma transação executável. Nenhuma transação foi enviada.');
  }
  if (tx.from && tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error('A cotação LI.FI retornou um remetente diferente da carteira conectada. Nenhuma transação foi enviada.');
  }
  if (tx.chainId !== undefined && Number(tx.chainId) !== fromNetwork.chainId
      && Number.parseInt(String(tx.chainId), 16) !== fromNetwork.chainId) {
    throw new Error('A cotação LI.FI retornou uma rede de origem inesperada. Nenhuma transação foi enviada.');
  }

  // Request ERC-20 approval only after a valid quote and only when allowance is insufficient.
  if (!sourceToken.isNative) {
    const tokenAddress = sourceToken.address;
    const approvalAddress = quote.estimate?.approvalAddress;
    if (!isAddress(tokenAddress) || !isAddress(approvalAddress)) {
      throw new Error('A cotação LI.FI não informou um contrato de aprovação válido. Nenhuma transação foi enviada.');
    }
    const allowanceData = `0xdd62ed3e${walletAddress.slice(2).toLowerCase().padStart(64, '0')}${approvalAddress.slice(2).toLowerCase().padStart(64, '0')}`;
    const allowanceRaw = await provider.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: allowanceData }, 'latest'],
    }) as string;
    if (BigInt(allowanceRaw || '0x0') < fromAmount) {
      onProgress?.(`Aguardando aprovação de ${sourceToken.symbol} na carteira...`);
      const approveData = `0x095ea7b3${approvalAddress.slice(2).toLowerCase().padStart(64, '0')}${MAX_UINT256.slice(2)}`;
      const approvalHash = await sendTransaction(provider, walletAddress, tokenAddress, approveData);
      await waitForReceipt(provider, approvalHash);
    }
  }

  onProgress?.('Aguardando sua confirmação da transação de origem na carteira...');
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: walletAddress,
      to: tx.to,
      data: tx.data,
      value: toHex(tx.value) ?? '0x0',
      ...(toHex(tx.gasLimit) ? { gas: toHex(tx.gasLimit) } : {}),
      ...(toHex(tx.gasPrice) ? { gasPrice: toHex(tx.gasPrice) } : {}),
      ...(toHex(tx.maxFeePerGas) ? { maxFeePerGas: toHex(tx.maxFeePerGas) } : {}),
      ...(toHex(tx.maxPriorityFeePerGas) ? { maxPriorityFeePerGas: toHex(tx.maxPriorityFeePerGas) } : {}),
    }],
  }) as string;

  onProgress?.('Transação enviada. Aguardando confirmação na rede de origem...');
  await waitForReceipt(provider, txHash);
  onProgress?.('Origem confirmada. Aguardando a liquidação cross-chain...');
  let settled: { destinationTxHash?: string; message: string };
  try {
    settled = await waitForLifiStatus(quote, txHash, fromNetwork.chainId, toNetwork.chainId, onProgress);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'A liquidação cross-chain não foi confirmada.';
    throw new Error(`${reason} Hash da transação de origem: ${txHash}`);
  }

  const estimatedOutputRaw = quote.estimate?.toAmountMin || quote.estimate?.toAmount;
  return {
    transactionHash: txHash,
    destinationTxHash: settled.destinationTxHash,
    tool: quote.toolDetails?.name || quote.tool || 'LI.FI',
    bridge: quote.bridge
      || quote.includedSteps?.find(step => step.type?.toLowerCase().includes('cross'))?.toolDetails?.name
      || quote.includedSteps?.find(step => step.type?.toLowerCase().includes('cross'))?.tool
      || 'Rota agregada LI.FI',
    estimatedOutput: estimatedOutputRaw
      ? formatLifiUnits(estimatedOutputRaw, destinationToken.decimals)
      : '',
    statusMessage: settled.message,
  };
}
