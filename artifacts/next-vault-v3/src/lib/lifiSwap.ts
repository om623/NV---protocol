import type { Eip1193Provider } from './arc';
import type { NetworkConfig, TokenConfig } from '../networks';

const LIFI_API = 'https://li.quest/v1/quote';
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

type LifiQuote = {
  tool?: string;
  estimate?: {
    toAmount?: string;
    toAmountMin?: string;
    approvalAddress?: string;
    executionDuration?: number;
  };
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
};

function parseUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d*)?$/.test(value.trim())) throw new Error('Informe um valor válido.');
  const [whole, fraction = ''] = value.trim().split('.');
  if (fraction.length > decimals) throw new Error(`Este token aceita no máximo ${decimals} casas decimais.`);
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

function toHex(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const str = String(value);
  return str.startsWith('0x') ? str : `0x${BigInt(str).toString(16)}`;
}

async function waitForReceipt(provider: Eip1193Provider, hash: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] }) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('A transação foi revertida pela rede.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error('Tempo limite aguardando confirmação da transação.');
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

export async function executeLifiSameChainSwap(args: {
  provider: Eip1193Provider;
  walletAddress: string;
  network: NetworkConfig;
  sourceToken: TokenConfig;
  destinationToken: TokenConfig;
  amount: string;
}): Promise<{ transactionHash: string; tool: string; estimatedOutput: string }> {
  const { provider, walletAddress, network, sourceToken, destinationToken, amount } = args;
  if (network.type !== 'mainnet') {
    throw new Error('O roteamento LI.FI está habilitado somente para mainnets compatíveis. Os fluxos de testnet existentes foram preservados.');
  }
  const fromAddress = sourceToken.isNative ? NATIVE_TOKEN : sourceToken.address;
  const toAddress = destinationToken.isNative ? NATIVE_TOKEN : destinationToken.address;
  if (!fromAddress || !toAddress) throw new Error('Não foi possível identificar os endereços dos tokens nesta rede.');
  if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
    throw new Error('Selecione dois ativos diferentes. Os dois seletores apontam para o mesmo token.');
  }
  const currentChain = await provider.request({ method: 'eth_chainId' }) as string;
  if (Number.parseInt(currentChain, 16) !== network.chainId) {
    throw new Error(`Sua carteira precisa estar conectada à rede ${network.name} antes de executar o swap.`);
  }
  const fromAmount = parseUnits(amount, sourceToken.decimals);
  if (fromAmount <= 0n) throw new Error('O valor do swap precisa ser maior que zero.');

  const query = new URLSearchParams({
    fromChain: String(network.chainId),
    toChain: String(network.chainId),
    fromToken: fromAddress,
    toToken: toAddress,
    fromAddress: walletAddress,
    toAddress: walletAddress,
    fromAmount: fromAmount.toString(),
    slippage: '0.005',
    order: 'CHEAPEST',
    integrator: 'nvprotocol',
  });
  const response = await fetch(`${LIFI_API}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const quote = await response.json() as LifiQuote & { message?: string; error?: string };
  if (!response.ok) throw new Error(quote.message || quote.error || 'A LI.FI não encontrou uma rota executável para este par e valor.');
  const tx = quote.transactionRequest;
  if (!tx?.to || !tx.data) throw new Error('A cotação recebida não contém uma transação executável.');
  
  // ERC-20 allowance: request approval only when needed; native tokens do not need approval.
  if (!sourceToken.isNative && quote.estimate?.approvalAddress) {
    const allowanceData = `0xdd62ed3e${walletAddress.slice(2).toLowerCase().padStart(64, '0')}${quote.estimate.approvalAddress.slice(2).toLowerCase().padStart(64, '0')}`;
    const allowanceRaw = await provider.request({
      method: 'eth_call',
      params: [{ to: sourceToken.address, data: allowanceData }, 'latest'],
    }) as string;
    const allowance = BigInt(allowanceRaw || '0x0');
    if (allowance < fromAmount) {
      const approveData = `0x095ea7b3${quote.estimate.approvalAddress.slice(2).toLowerCase().padStart(64, '0')}${MAX_UINT256.slice(2)}`;
      const approvalHash = await sendTransaction(provider, walletAddress, sourceToken.address!, approveData);
      await waitForReceipt(provider, approvalHash);
    }
  }

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
  await waitForReceipt(provider, txHash);
  return {
    transactionHash: txHash,
    tool: quote.tool || 'LI.FI',
    estimatedOutput: quote.estimate?.toAmountMin || quote.estimate?.toAmount || '',
  };
}
