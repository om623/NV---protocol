// ─── NV Protocol — Circle CCTP X (issuer-managed ERC-20 assets) ───────────────
// Additive integration. The existing USDC CCTP executor is intentionally untouched.
// Supports only Circle-published non-USDC CCTP domains and configured tokenIds.

import {
  createPublicClient,
  createWalletClient,
  custom,
  encodePacked,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import type { EIP1193Provider as ViemProvider } from 'viem';
import type { Eip1193Provider } from './arc';
import { ensureNetwork } from './arc';
import {
  assertSameEnvironment,
  completeCctpBridge,
  getCctpNetwork,
  waitForCctpAttestation,
} from '../components/cctp';

const TESTNET_CCTS = '0x63753E722bd2C2A5DF6EE19C5106662208B81077' as Address;
const MAINNET_CCTS = '0x431871229103b780868f8C6BB820cd16ECf942BC' as Address;
const IRIS_TESTNET = 'https://iris-api-sandbox.circle.com';
const IRIS_MAINNET = 'https://iris-api.circle.com';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as Hex;
const STANDARD_FINALITY = 2000;

const TESTNET_IDS = new Set(['sepolia', 'base-sepolia', 'arc-testnet']);
const MAINNET_IDS = new Set([
  'ethereum', 'avalanche', 'optimism', 'arbitrum', 'base', 'polygon', 'arc-mainnet',
]);

const SERVICE_ABI = [
  {
    type: 'function', name: 'resolveTokenManager', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'bytes32' }],
    outputs: [{ name: 'tokenManager', type: 'address' }],
  },
  {
    type: 'function', name: 'resolveTokenAddress', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'bytes32' }],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'function', name: 'isTrustedDomain', stateMutability: 'view',
    inputs: [{ name: 'domain', type: 'uint32' }],
    outputs: [{ name: 'trusted', type: 'bool' }],
  },
  {
    type: 'function', name: 'crossChainTransfer', stateMutability: 'payable',
    inputs: [
      { name: 'tokenId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'destinationAddress', type: 'bytes' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'minFinalityThreshold', type: 'uint32' },
      {
        name: 'claim', type: 'tuple',
        components: [
          { name: 'signedQuote', type: 'bytes' },
          { name: 'refundAddress', type: 'address' },
        ],
      },
      { name: 'autoExecuteHookData', type: 'bool' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'ok', type: 'bool' }],
  },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

interface IrisTokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface IrisFeeQuote {
  signedQuote: Hex;
  feeTotalAmount: string;
}

export interface CctpXTransferParams {
  provider: Eip1193Provider;
  walletAddress: string;
  fromNetwork: string;
  toNetwork: string;
  tokenId: string;
  amount: string;
  onProgress?: (message: string) => void;
}

export interface CctpXTransferResult {
  success: boolean;
  token?: IrisTokenInfo;
  burnTxHash?: string;
  mintTxHash?: string;
  error?: string;
}

function serviceFor(networkId: string): Address {
  if (TESTNET_IDS.has(networkId)) return TESTNET_CCTS;
  if (MAINNET_IDS.has(networkId)) return MAINNET_CCTS;
  throw new Error(`A Circle ainda não lista suporte CCTP X para a rede ${networkId}.`);
}

function irisFor(networkId: string): string {
  const network = getCctpNetwork(networkId);
  if (!network) throw new Error(`Rede CCTP desconhecida: ${networkId}`);
  return network.isMainnet ? IRIS_MAINNET : IRIS_TESTNET;
}

function assertTokenId(tokenId: string): asserts tokenId is Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(tokenId)) {
    throw new Error('Informe um tokenId CCTP X válido (bytes32).');
  }
}

async function waitForReceipt(
  client: ReturnType<typeof createPublicClient>,
  hash: Hex,
  label: string,
): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 300_000 });
  if (receipt.status !== 'success') throw new Error(`${label}: transação revertida.`);
}

export async function executeCctpXTransfer(
  params: CctpXTransferParams,
): Promise<CctpXTransferResult> {
  let burnTxHash: string | undefined;
  const progress = params.onProgress ?? (() => undefined);

  try {
    const {
      provider, walletAddress, fromNetwork, toNetwork, tokenId, amount,
    } = params;

    if (!provider) throw new Error('Conecte sua carteira primeiro.');
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error('Endereço de carteira inválido.');
    }
    assertTokenId(tokenId);
    if (fromNetwork === toNetwork) throw new Error('Escolha duas redes diferentes.');
    assertSameEnvironment(fromNetwork, toNetwork);

    const source = getCctpNetwork(fromNetwork);
    const destination = getCctpNetwork(toNetwork);
    if (!source || !destination) throw new Error('Rede de origem ou destino não configurada.');
    const sourceService = serviceFor(fromNetwork);
    const destinationService = serviceFor(toNetwork);

    progress('Consultando o registro do ativo na infraestrutura Iris...');
    const tokenResponse = await fetch(
      `${irisFor(fromNetwork)}/v2/cctpx/tokens?tokenid=${tokenId}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!tokenResponse.ok) {
      throw new Error(`Iris não reconheceu este tokenId (HTTP ${tokenResponse.status}).`);
    }
    const tokenBody = await tokenResponse.json() as { data?: IrisTokenInfo[] };
    const token = tokenBody.data?.find(
      item => item.tokenId?.toLowerCase() === tokenId.toLowerCase(),
    );
    if (!token || !Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 36) {
      throw new Error('Token não encontrado no catálogo CCTP X ou metadados inválidos.');
    }

    let amountUnits: bigint;
    try {
      amountUnits = parseUnits(amount.trim(), token.decimals);
    } catch {
      throw new Error(`Quantidade inválida para ${token.symbol} (${token.decimals} casas decimais).`);
    }
    if (amountUnits <= 0n) throw new Error('A quantidade deve ser maior que zero.');

    const sourcePublic = createPublicClient({ chain: source.chain, transport: http(source.rpcUrl) });
    const destinationPublic = createPublicClient({
      chain: destination.chain, transport: http(destination.rpcUrl),
    });
    const sourceWallet = createWalletClient({
      chain: source.chain, transport: custom(provider as unknown as ViemProvider),
    });

    progress('Verificando identidade do token e permissões entre as redes...');
    const [sourceManager, destinationManager, sourceToken, destinationToken, sourceTrust, destinationTrust] =
      await Promise.all([
        sourcePublic.readContract({
          address: sourceService, abi: SERVICE_ABI, functionName: 'resolveTokenManager',
          args: [tokenId],
        }),
        destinationPublic.readContract({
          address: destinationService, abi: SERVICE_ABI, functionName: 'resolveTokenManager',
          args: [tokenId],
        }),
        sourcePublic.readContract({
          address: sourceService, abi: SERVICE_ABI, functionName: 'resolveTokenAddress',
          args: [tokenId],
        }),
        destinationPublic.readContract({
          address: destinationService, abi: SERVICE_ABI, functionName: 'resolveTokenAddress',
          args: [tokenId],
        }),
        sourcePublic.readContract({
          address: sourceService, abi: SERVICE_ABI, functionName: 'isTrustedDomain',
          args: [destination.domain],
        }),
        destinationPublic.readContract({
          address: destinationService, abi: SERVICE_ABI, functionName: 'isTrustedDomain',
          args: [source.domain],
        }),
      ]);

    if (!sourceTrust || !destinationTrust) {
      throw new Error('As redes ainda não confiam uma na outra para este token. A configuração do emissor está incompleta.');
    }

    const balance = await sourcePublic.readContract({
      address: sourceToken, abi: ERC20_ABI, functionName: 'balanceOf',
      args: [walletAddress as Address],
    });
    if (balance < amountUnits) throw new Error(`Saldo insuficiente de ${token.symbol} na rede de origem.`);

    progress(`Aprovando ${token.symbol} para o TokenManager...`);
    await ensureNetwork(provider, {
      chainId: `0x${source.chainId.toString(16)}`,
      chainName: source.name,
      nativeCurrency: source.chain.nativeCurrency,
      rpcUrls: [source.rpcUrl],
      blockExplorerUrls: [source.explorerUrl],
    });
    const approveHash = await sourceWallet.writeContract({
      account: walletAddress as Address,
      chain: null,
      address: sourceToken,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [sourceManager, amountUnits],
    });
    await waitForReceipt(sourcePublic, approveHash, 'Aprovação');

    progress('Solicitando cotação atualizada de taxa à Circle Iris...');
    const quoteResponse = await fetch(
      `${irisFor(fromNetwork)}/v2/quote/cctpx/${tokenId}/${source.domain}/${destination.domain}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          amount: amountUnits.toString(),
          feeToken: zeroAddress,
          requests: [],
        }),
      },
    );
    if (!quoteResponse.ok) {
      throw new Error(`Não foi possível obter a cotação CCTP X (HTTP ${quoteResponse.status}): ${await quoteResponse.text()}`);
    }
    const quote = await quoteResponse.json() as IrisFeeQuote;
    if (!quote.signedQuote || !/^0x[0-9a-fA-F]+$/.test(quote.signedQuote) ||
        !quote.feeTotalAmount || !/^\d+$/.test(quote.feeTotalAmount)) {
      throw new Error('A Circle retornou uma cotação incompleta. Nenhum burn foi iniciado.');
    }

    progress('Enviando transferência burn-and-mint para a rede de destino...');
    const transferHash = await sourceWallet.writeContract({
      account: walletAddress as Address,
      chain: null,
      address: sourceService,
      abi: SERVICE_ABI,
      functionName: 'crossChainTransfer',
      args: [
        tokenId,
        amountUnits,
        destination.domain,
        encodePacked(['address'], [walletAddress as Address]),
        ZERO_BYTES32,
        STANDARD_FINALITY,
        { signedQuote: quote.signedQuote, refundAddress: zeroAddress },
        false,
        '0x',
      ],
      value: BigInt(quote.feeTotalAmount),
    });
    burnTxHash = transferHash;
    await waitForReceipt(sourcePublic, transferHash, 'Burn cross-chain');

    progress('Aguardando a atestação da Circle Iris...');
    const attestation = await waitForCctpAttestation(fromNetwork, transferHash);

    progress('Preparando a rede de destino e concluindo a cunhagem...');
    await ensureNetwork(provider, {
      chainId: `0x${destination.chainId.toString(16)}`,
      chainName: destination.name,
      nativeCurrency: destination.chain.nativeCurrency,
      rpcUrls: [destination.rpcUrl],
      blockExplorerUrls: [destination.explorerUrl],
    });
    const mintHash = await completeCctpBridge(
      provider as unknown as ViemProvider,
      walletAddress,
      toNetwork,
      attestation,
    );
    await waitForReceipt(destinationPublic, mintHash, 'Mint de destino');

    return { success: true, token, burnTxHash: transferHash, mintTxHash: mintHash };
  } catch (error) {
    return {
      success: false,
      burnTxHash,
      error: error instanceof Error ? error.message : 'Falha inesperada na transferência CCTP X.',
    };
  }
}
