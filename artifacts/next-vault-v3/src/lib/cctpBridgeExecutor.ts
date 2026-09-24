// ─── NV Protocol — CCTP V2 Bridge Executor ──────────────────────────────────

import type { Eip1193Provider } from './arc';
import type { EIP1193Provider as ViemProvider } from 'viem';

import {
  approveCctpUsdc,
  startCctpBridge,
  waitForCctpAttestation,
  completeCctpBridge,
  getCctpNetwork,
} from '../components/cctp';
import { ensureNetwork } from './arc';
import { BRIDGE_NETWORKS } from './bridge';

type ViemEip1193Provider = ViemProvider;

export interface BridgeExecutionParams {
  provider: Eip1193Provider;
  fromNetwork: string;
  toNetwork: string;
  walletAddress: string;
  amount: number;
}

export interface BridgeExecutionResult {
  success: boolean;
  burnTxHash?: string;
  mintTxHash?: string;
  status?: 'approved' | 'burned' | 'minted';
  error?: string;
}

// ─── Transaction receipt ─────────────────────────────────────────────────────

interface TransactionReceipt {
  status?: string;
  [key: string]: unknown;
}

async function waitForTransaction(
  provider: Eip1193Provider,
  hash: string,
): Promise<TransactionReceipt> {
  const maxWaitMs = 5 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    });

    if (receipt) {
      return receipt as TransactionReceipt;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(
    'Tempo limite aguardando confirmação da transação.',
  );
}

// ─── Switch network ─────────────────────────────────────────────────────────

async function switchNetwork(
  provider: Eip1193Provider,
  networkId: string,
) {
  const net = BRIDGE_NETWORKS[networkId];
  if (!net) {
    throw new Error(`Unknown network: ${networkId}`);
  }
  await ensureNetwork(provider, {
    chainId: '0x' + net.chainId.toString(16),
    chainName: net.name,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: [net.rpcUrl],
    blockExplorerUrls: [net.explorerUrl],
  });
}

// ─── Execute bridge ─────────────────────────────────────────────────────────

export async function executeBridge(
  params: BridgeExecutionParams,
): Promise<BridgeExecutionResult> {
  const { provider, fromNetwork, toNetwork, walletAddress, amount } = params;

  try {
    console.log('[NV Protocol] Starting CCTP V2 bridge');

    if (!provider) {
      throw new Error('Carteira não conectada.');
    }

    if (!walletAddress) {
      throw new Error('Endereço da carteira não encontrado.');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Informe uma quantidade válida de USDC.');
    }

    if (fromNetwork === toNetwork) {
      throw new Error(
        'As redes de origem e destino devem ser diferentes.',
      );
    }

    const source = getCctpNetwork(fromNetwork);
    const destination = getCctpNetwork(toNetwork);

    if (!source) {
      throw new Error(`Rede de origem não suportada: ${fromNetwork}`);
    }

    if (!destination) {
      throw new Error(`Rede de destino não suportada: ${toNetwork}`);
    }

    console.log(`[NV Protocol] Source: ${source.name}`);
    console.log(`[NV Protocol] Destination: ${destination.name}`);

    // Switch wallet to source chain
    console.log(
      `[NV Protocol] Switching to source chain ${source.chainId}`,
    );
    await switchNetwork(provider, fromNetwork);

    // Approve USDC
    console.log('[NV Protocol] Approving USDC...');
    const approveTx = await approveCctpUsdc(
      provider as unknown as ViemEip1193Provider,
      walletAddress,
      fromNetwork,
      amount,
    );
    console.log('[NV Protocol] Approve TX:', approveTx);

    const approveReceipt = await waitForTransaction(
      provider,
      approveTx,
    );

    if (approveReceipt.status === '0x0') {
      throw new Error('A aprovação do USDC falhou.');
    }

    // Burn USDC
    console.log('[NV Protocol] Starting CCTP burn...');
    const burnTx = await startCctpBridge(
      provider as unknown as ViemEip1193Provider,
      walletAddress,
      fromNetwork,
      toNetwork,
      amount,
    );
    console.log('[NV Protocol] Burn TX:', burnTx);

    const burnReceipt = await waitForTransaction(provider, burnTx);

    if (burnReceipt.status === '0x0') {
      throw new Error('A transação de burn falhou.');
    }

    // Wait for Circle attestation
    console.log('[NV Protocol] Waiting for Circle attestation...');
    const attestation = await waitForCctpAttestation(
      fromNetwork,
      burnTx,
    );
    console.log('[NV Protocol] CCTP attestation ready.');

    // Switch to destination chain
    console.log(
      `[NV Protocol] Switching to destination chain ${destination.chainId}`,
    );
    await switchNetwork(provider, toNetwork);

    // Receive message / mint
    console.log('[NV Protocol] Executing destination mint...');
    const mintTx = await completeCctpBridge(
      provider as unknown as ViemEip1193Provider,
      walletAddress,
      toNetwork,
      attestation,
    );
    console.log('[NV Protocol] Mint TX:', mintTx);

    const mintReceipt = await waitForTransaction(provider, mintTx);

    if (mintReceipt.status === '0x0') {
      throw new Error('A transação de mint falhou.');
    }

    console.log(
      '[NV Protocol] CCTP bridge completed successfully.',
    );

    return {
      success: true,
      burnTxHash: burnTx,
      mintTxHash: mintTx,
      status: 'minted',
    };
  } catch (error) {
    console.error('[NV Protocol] CCTP Bridge error:', error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Falha desconhecida na Bridge CCTP V2.',
    };
  }
}
