/**
 * NV Protocol — LI.FI cross-chain bridge adapter
 *
 * Adds multi-token cross-chain routing without changing the existing Circle CCTP
 * USDC executor. Quotes are live; execution always requires wallet approval.
 * Uses LI.FI's public API directly (no extra dependency).
 */
import type { Eip1193Provider } from './arc';

const API = 'https://li.quest/v1';
const NATIVE = '0x0000000000000000000000000000000000000000';
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export interface LifiBridgeToken {
  address: string;
  symbol: string;
  decimals: number;
  isNative?: boolean;
}

export interface LifiBridgeRequest {
  provider: Eip1193Provider;
  walletAddress: string;
  fromChainId: number;
  toChainId: number;
  fromToken: LifiBridgeToken;
  toToken: LifiBridgeToken;
  amount: string; // human-readable amount, e.g. "12.5"
  slippage?: number; // fraction, default 0.5%
}

export interface LifiBridgeQuote {
  tool: string;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  executionDurationSeconds?: number;
  feeCosts: Array<{ name: string; amount?: string; token?: string }>;
  approvalAddress?: string;
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  raw: unknown;
}

export interface LifiBridgeExecution {
  sourceTxHash: string;
  destinationTxHash?: string;
  status: 'DONE' | 'PENDING' | 'FAILED';
  tool: string;
  estimatedOutput: string;
}

type QuoteResponse = {
  tool?: string;
  estimate?: {
    fromAmount?: string;
    toAmount?: string;
    toAmountMin?: string;
    executionDuration?: number;
    approvalAddress?: string;
    feeCosts?: Array<{ name?: string; amount?: string; token?: { symbol?: string } }>;
  };
  transactionRequest?: LifiBridgeQuote['transactionRequest'];
  message?: string;
  error?: string;
};

function parseUnits(value: string, decimals: number): bigint {
  const input = value.trim();
  if (!/^\d+(\.\d*)?$/.test(input)) throw new Error('Informe um valor válido.');
  const [whole, fraction = ''] = input.split('.');
  if (fraction.length > decimals) throw new Error(`Este token aceita no máximo ${decimals} casas decimais.`);
  return BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

function hex(value: string | number | bigint | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  const raw = String(value);
  return raw.startsWith('0x') ? raw : `0x${BigInt(raw).toString(16)}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.message || body.error || `LI.FI API error (${response.status})`);
  }
  return body;
}

function tokenAddress(token: LifiBridgeToken): string {
  const address = token.isNative ? NATIVE : token.address;
  if (!address) throw new Error(`Endereço do token ${token.symbol} não configurado.`);
  return address;
}

function validate(request: LifiBridgeRequest): bigint {
  if (!request.provider || !request.walletAddress) throw new Error('Conecte sua carteira antes da Bridge.');
  if (request.fromChainId === request.toChainId) throw new Error('Escolha redes de origem e destino diferentes.');
  if (!Number.isInteger(request.fromChainId) || !Number.isInteger(request.toChainId)) throw new Error('Chain ID inválido.');
  if (!request.fromToken || !request.toToken) throw new Error('Selecione os tokens de origem e destino.');
  const amount = parseUnits(request.amount, request.fromToken.decimals);
  if (amount <= 0n) throw new Error('O valor deve ser maior que zero.');
  return amount;
}

/** Requests a real, executable cross-chain quote. No transaction is sent. */
export async function quoteLifiBridge(request: LifiBridgeRequest): Promise<LifiBridgeQuote> {
  const amount = validate(request);
  const params = new URLSearchParams({
    fromChain: String(request.fromChainId),
    toChain: String(request.toChainId),
    fromToken: tokenAddress(request.fromToken),
    toToken: tokenAddress(request.toToken),
    fromAddress: request.walletAddress,
    toAddress: request.walletAddress,
    fromAmount: amount.toString(),
    slippage: String(request.slippage ?? 0.005),
    order: 'RECOMMENDED',
    integrator: 'nvprotocol',
  });
  const quote = await api<QuoteResponse>(`/quote?${params.toString()}`);
  const tx = quote.transactionRequest;
  if (!tx?.to || !tx.data) throw new Error('LI.FI não retornou uma transação executável para esta rota.');
  return {
    tool: quote.tool || 'LI.FI',
    fromAmount: quote.estimate?.fromAmount || amount.toString(),
    toAmount: quote.estimate?.toAmount || '0',
    toAmountMin: quote.estimate?.toAmountMin || quote.estimate?.toAmount || '0',
    executionDurationSeconds: quote.estimate?.executionDuration,
    feeCosts: (quote.estimate?.feeCosts ?? []).map(fee => ({
      name: fee.name || 'Fee',
      amount: fee.amount,
      token: fee.token?.symbol,
    })),
    approvalAddress: quote.estimate?.approvalAddress,
    transactionRequest: tx,
    raw: quote,
  };
}

async function waitReceipt(provider: Eip1193Provider, hash: string, timeoutMs = 180_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] }) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('A transação de origem foi revertida.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error('Tempo limite aguardando confirmação da transação de origem.');
}

async function approveIfNeeded(request: LifiBridgeRequest, quote: LifiBridgeQuote, amount: bigint): Promise<void> {
  if (request.fromToken.isNative) return;
  const token = tokenAddress(request.fromToken);
  const spender = quote.approvalAddress;
  if (!spender) throw new Error('LI.FI não informou o contrato de aprovação. Nenhuma Bridge foi enviada.');
  const owner = request.walletAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const spenderWord = spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const allowance = await request.provider.request({
    method: 'eth_call',
    params: [{ to: token, data: `0xdd62ed3e${owner}${spenderWord}` }, 'latest'],
  }) as string;
  if (BigInt(allowance || '0x0') >= amount) return;
  const approvalHash = await request.provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: request.walletAddress, to: token, data: `0x095ea7b3${spenderWord}${MAX_UINT256.slice(2)}`, value: '0x0' }],
  }) as string;
  await waitReceipt(request.provider, approvalHash);
}

export async function executeLifiBridge(
  request: LifiBridgeRequest,
  quote?: LifiBridgeQuote,
  onStatus?: (status: string) => void,
): Promise<LifiBridgeExecution> {
  const amount = validate(request);
  const currentChain = request.provider.request({ method: 'eth_chainId' }) as Promise<string>;
  const chainHex = await currentChain;
  if (Number.parseInt(chainHex, 16) !== request.fromChainId) {
    throw new Error('A carteira está na rede errada. Mude para a rede de origem antes de executar.');
  }
  const selectedQuote = quote ?? await quoteLifiBridge(request);
  await approveIfNeeded(request, selectedQuote, amount);
  onStatus?.('Aguardando assinatura da transação de origem');
  const tx = selectedQuote.transactionRequest;
  const sourceTxHash = await request.provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: request.walletAddress,
      to: tx.to,
      data: tx.data,
      value: hex(tx.value) ?? '0x0',
      ...(hex(tx.gasLimit) ? { gas: hex(tx.gasLimit) } : {}),
      ...(hex(tx.gasPrice) ? { gasPrice: hex(tx.gasPrice) } : {}),
      ...(hex(tx.maxFeePerGas) ? { maxFeePerGas: hex(tx.maxFeePerGas) } : {}),
      ...(hex(tx.maxPriorityFeePerGas) ? { maxPriorityFeePerGas: hex(tx.maxPriorityFeePerGas) } : {}),
    }],
  }) as string;
  onStatus?.('Transação de origem enviada; aguardando confirmação');
  await waitReceipt(request.provider, sourceTxHash);
  onStatus?.('Transação confirmada; acompanhando a Bridge');
  const started = Date.now();
  let delay = 3000;
  while (Date.now() - started < 30 * 60 * 1000) {
    const status = await api<{
      status?: string;
      receiving?: { txHash?: string };
      toTxHash?: string;
      substatusMessage?: string;
      message?: string;
    }>(`/status?txHash=${encodeURIComponent(sourceTxHash)}&fromChain=${request.fromChainId}&toChain=${request.toChainId}`);
    const normalized = (status.status || 'PENDING').toUpperCase();
    onStatus?.(status.substatusMessage || normalized);
    if (normalized === 'DONE') {
      return {
        sourceTxHash,
        destinationTxHash: status.receiving?.txHash || status.toTxHash,
        status: 'DONE',
        tool: selectedQuote.tool,
        estimatedOutput: selectedQuote.toAmountMin,
      };
    }
    if (normalized === 'FAILED' || normalized === 'REFUNDED' || normalized === 'NOT_FOUND') {
      return { sourceTxHash, status: 'FAILED', tool: selectedQuote.tool, estimatedOutput: selectedQuote.toAmountMin };
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(Math.round(delay * 1.5), 20_000);
  }
  return { sourceTxHash, status: 'PENDING', tool: selectedQuote.tool, estimatedOutput: selectedQuote.toAmountMin };
}
