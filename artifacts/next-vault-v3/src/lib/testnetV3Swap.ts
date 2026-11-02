import { decodeFunctionResult, encodeFunctionData, formatUnits, parseUnits } from 'viem';
import type { Eip1193Provider } from './arc';
import type { NetworkConfig, TokenConfig } from '../networks';

/**
 * Isolated same-chain testnet swap adapter.
 *
 * This adapter is deliberately limited to official Uniswap v3 SwapRouter02 /
 * QuoterV2 deployments for which the addresses are published by Uniswap.
 * It discovers a live pool by requesting quotes at the supported fee tiers;
 * it never fabricates a price or assumes that a pool has liquidity.
 *
 * Arc Testnet and Base Sepolia are intentionally not enabled here until a
 * compatible, verified swap entrypoint is available for those networks.
 */
const TESTNET_V3_ROUTES: Record<string, {
  router: `0x${string}`;
  quoter: `0x${string}`;
  weth9: `0x${string}`;
}> = {
  sepolia: {
    router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
    quoter: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
    weth9: '0xfff9976782d46CC05630D1f6eBAb18b2324d6B14',
  },
  'arbitrum-sepolia': {
    router: '0x101F443B4d1b059569D643917553c771E1b9663E',
    quoter: '0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B',
    weth9: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
  },
  'optimism-sepolia': {
    router: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
    quoter: '0x0FBEa6cf957d95ee9313490050F6A0DA68039404',
    weth9: '0x4200000000000000000000000000000000000006',
  },
};

const FEE_TIERS = [500, 3000, 10000] as const;
const SLIPPAGE_BPS = 50n; // 0.50%
const MAX_UINT256 = (1n << 256n) - 1n;

const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const quoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'fee', type: 'uint24' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

const routerAbi = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [{
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'unwrapWETH9',
    stateMutability: 'payable',
    inputs: [{ name: 'amountMinimum', type: 'uint256' }, { name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'multicall',
    stateMutability: 'payable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
] as const;

function asHex(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}`;
}

async function rpc(provider: Eip1193Provider, method: string, params: unknown[] = []): Promise<unknown> {
  return provider.request({ method, params });
}

async function waitForReceipt(provider: Eip1193Provider, hash: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const receipt = await rpc(provider, 'eth_getTransactionReceipt', [hash]) as { status?: string | number } | null;
    if (receipt) {
      if (receipt.status === '0x0' || receipt.status === '0x00' || receipt.status === 0) {
        throw new Error('A transação foi revertida pela rede de teste.');
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error('Tempo limite aguardando a confirmação on-chain.');
}

async function call(
  provider: Eip1193Provider,
  to: `0x${string}`,
  data: `0x${string}`,
): Promise<`0x${string}`> {
  return await rpc(provider, 'eth_call', [{ to, data }, 'latest']) as `0x${string}`;
}

async function send(
  provider: Eip1193Provider,
  from: string,
  to: `0x${string}`,
  data: `0x${string}`,
  value = 0n,
): Promise<string> {
  return await rpc(provider, 'eth_sendTransaction', [{
    from,
    to,
    data,
    value: asHex(value),
  }]) as string;
}

export function supportsTestnetV3Swap(networkId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TESTNET_V3_ROUTES, networkId);
}

export async function executeTestnetV3Swap(args: {
  provider: Eip1193Provider;
  walletAddress: string;
  network: NetworkConfig;
  sourceToken: TokenConfig;
  destinationToken: TokenConfig;
  amount: string;
}): Promise<{ transactionHash: string; tool: string; estimatedOutput: string }> {
  const { provider, walletAddress, network, sourceToken, destinationToken, amount } = args;
  if (network.type !== 'testnet') throw new Error('Este executor aceita somente redes de teste.');
  const deployment = TESTNET_V3_ROUTES[network.id];
  if (!deployment) {
    throw new Error(`Ainda não há um roteador DEX de testnet verificado e habilitado para ${network.name}. Nenhuma transação foi enviada.`);
  }
  if (sourceToken.symbol === destinationToken.symbol) {
    throw new Error('Selecione dois ativos diferentes para realizar um swap na mesma rede.');
  }

  const liveChainHex = await rpc(provider, 'eth_chainId') as string;
  const liveChainId = Number(BigInt(liveChainHex));
  if (liveChainId !== network.chainId) {
    throw new Error(`A carteira está na chain ${liveChainId}. Troque para ${network.name} (${network.chainId}) e tente novamente.`);
  }

  const tokenIn = sourceToken.isNative ? deployment.weth9 : sourceToken.address;
  const tokenOut = destinationToken.isNative ? deployment.weth9 : destinationToken.address;
  if (!tokenIn || !tokenOut) throw new Error('O endereço do token não está configurado para esta rede.');
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) throw new Error('O par selecionado não é válido.');

  const amountIn = parseUnits(amount, sourceToken.decimals);
  if (amountIn <= 0n) throw new Error('Informe um valor maior que zero.');

  // Discover a pool with a real, executable quote. A reverted quote means the
  // fee tier has no usable pool/liquidity for this amount and is skipped.
  const quotes: Array<{ fee: number; amountOut: bigint }> = [];
  for (const fee of FEE_TIERS) {
    try {
      const data = encodeFunctionData({
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const result = await call(provider, deployment.quoter, data);
      const decoded = decodeFunctionResult({
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        data: result,
      });
      const amountOut = decoded[0];
      if (amountOut > 0n) quotes.push({ fee, amountOut });
    } catch {
      // No usable pool at this fee tier; try the next published tier.
    }
  }

  if (quotes.length === 0) {
    throw new Error(`Não foi encontrada liquidez executável para ${sourceToken.symbol} → ${destinationToken.symbol} em ${network.name}. Nenhuma transação foi enviada.`);
  }
  quotes.sort((a, b) => a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0);
  const best = quotes[0];
  const amountOutMinimum = best.amountOut * (10_000n - SLIPPAGE_BPS) / 10_000n;

  // ERC-20 input: approve only the exact amount, and wait for confirmation.
  if (!sourceToken.isNative) {
    const allowanceData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress as `0x${string}`, deployment.router],
    });
    const allowanceResult = await call(provider, sourceToken.address as `0x${string}`, allowanceData);
    const allowance = decodeFunctionResult({
      abi: erc20Abi,
      functionName: 'allowance',
      data: allowanceResult,
    });
    if (allowance < amountIn) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [deployment.router, amountIn],
      });
      const approvalHash = await send(provider, walletAddress, sourceToken.address as `0x${string}`, approveData);
      await waitForReceipt(provider, approvalHash);
    }
  }

  const outputIsNative = destinationToken.isNative;
  const swapRecipient = outputIsNative ? deployment.router : walletAddress as `0x${string}`;
  const swapData = encodeFunctionData({
    abi: routerAbi,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: tokenIn as `0x${string}`,
      tokenOut: tokenOut as `0x${string}`,
      fee: best.fee,
      recipient: swapRecipient,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    }],
  });

  let transactionData = swapData;
  if (outputIsNative) {
    const unwrapData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'unwrapWETH9',
      args: [amountOutMinimum, walletAddress as `0x${string}`],
    });
    transactionData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'multicall',
      args: [[swapData, unwrapData]],
    });
  }

  const txHash = await send(
    provider,
    walletAddress,
    deployment.router,
    transactionData,
    sourceToken.isNative ? amountIn : 0n,
  );
  await waitForReceipt(provider, txHash);

  return {
    transactionHash: txHash,
    tool: 'Uniswap v3 testnet',
    estimatedOutput: formatUnits(best.amountOut, destinationToken.decimals),
  };
}
