// ─── NV Protocol — CCTP V2 Bridge Executor ──────────────────────────────────

import type { Eip1193Provider } from './arc';

import {
  approveCctpUsdc,
  startCctpBridge,
  waitForCctpAttestation,
  completeCctpBridge,
  getCctpNetwork,
} from './cctp';

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
  const maxWaitMs =
    5 * 60 * 1000;

  const started =
    Date.now();

  while (
    Date.now() - started <
    maxWaitMs
  ) {
    const receipt =
      await provider.request({
        method:
          'eth_getTransactionReceipt',
        params: [hash],
      });

    if (receipt) {
      return receipt as TransactionReceipt;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 2000),
    );
  }

  throw new Error(
    'Tempo limite aguardando confirmação da transação.',
  );
}

// ─── Switch network ─────────────────────────────────────────────────────────

async function switchNetwork(
  provider: Eip1193Provider,
  chainId: number,
) {
  const hexChainId =
    `0x${chainId.toString(16)}`;

  await provider.request({
    method:
      'wallet_switchEthereumChain',
    params: [
      {
        chainId: hexChainId,
      },
    ],
  });
}

// ─── Execute bridge ─────────────────────────────────────────────────────────

export async function executeBridge(
  params: BridgeExecutionParams,
): Promise<BridgeExecutionResult> {
  const {
    provider,
    fromNetwork,
    toNetwork,
    walletAddress,
    amount,
  } = params;

  try {
    console.log(
      '[NV Protocol] Starting CCTP V2 bridge',
    );

    // ─────────────────────────────────────────────────────────────────────
    // 1. Basic validation
    // ─────────────────────────────────────────────────────────────────────

    if (!provider) {
      throw new Error(
        'Carteira não conectada.',
      );
    }

    if (!walletAddress) {
      throw new Error(
        'Endereço da carteira não encontrado.',
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        'Informe uma quantidade válida de USDC.',
      );
    }

    if (
      fromNetwork === toNetwork
    ) {
      throw new Error(
        'As redes de origem e destino devem ser diferentes.',
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. Resolve networks
    // ─────────────────────────────────────────────────────────────────────

    const source =
      getCctpNetwork(fromNetwork);

    const destination =
      getCctpNetwork(toNetwork);

    if (!source) {
      throw new Error(
        `Rede de origem não suportada: ${fromNetwork}`,
      );
    }

    if (!destination) {
      throw new Error(
        `Rede de destino não suportada: ${toNetwork}`,
      );
    }

    console.log(
      `[NV Protocol] Source: ${source.name}`,
    );

    console.log(
      `[NV Protocol] Destination: ${destination.name}`,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 3. Switch wallet to source
    // ─────────────────────────────────────────────────────────────────────

    console.log(
      `[NV Protocol] Switching to source chain ${source.chainId}`,
    );

    await switchNetwork(
      provider,
      source.chainId,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 4. Approve USDC
    // ─────────────────────────────────────────────────────────────────────

    console.log(
      '[NV Protocol] Approving USDC...',
    );

    const approveTx =
      await approveCctpUsdc(
        provider,
        walletAddress,
        fromNetwork,
        amount,
      );

    console.log(
      '[NV Protocol] Approve TX:',
      approveTx,
    );

    const approveReceipt =
      await waitForTransaction(
        provider,
        approveTx,
      );

    if (
      approveReceipt.status ===
      '0x0'
    ) {
      throw new Error(
        'A aprovação do USDC falhou.',
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. Burn USDC
    // ─────────────────────────────────────────────────────────────────────

    console.log(
      '[NV Protocol] Starting CCTP burn...',
    );

    const burnTx =
      await startCctpBridge(
        provider,
        walletAddress,
        fromNetwork,
        toNetwork,
        amount,
      );

    console.log(
      '[NV Protocol] Burn TX:',
      burnTx,
    );

    const burnReceipt =
      await waitForTransaction(
        provider,
        burnTx,
      );

    if (
      burnReceipt.status ===
      '0x0'
    ) {
      throw new Error(
        'A transação de burn falhou.',
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. Wait Circle attestation
    // ─────────────────────────────────────────────────────────────────────

    console.log(
      '[NV Protocol] Waiting for Circle attestation...',
    );

    const attestation =
      await waitForCctpAttestation(
        fromNetwork,
        burnTx,
      );

    console.log(
      '[NV Protocol] CCTP attestation ready.',
    );

    // ─────────────────────────────────────────────────────────────────────
    // 7. Switch to destination
    // ─────────────────────────────────────────────────────────────────────

    console.log(
      `[NV Protocol] Switching to destination chain ${destination.chainId}`,
    );

    await switchNetwork(
      provider,
      destination.chainId,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 8. Receive message / mint
    // ─────────────────────────────────────────────────────────────────────

    console.log(
      '[NV Protocol] Executing destination mint...',
    );

    const mintTx =
      await completeCctpBridge(
        provider,
        walletAddress,
        toNetwork,
        attestation,
      );

    console.log(
      '[NV Protocol] Mint TX:',
      mintTx,
    );

    const mintReceipt =
      await waitForTransaction(
        provider,
        mintTx,
      );

    if (
      mintReceipt.status ===
      '0x0'
    ) {
      throw new Error(
        'A transação de mint falhou.',
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 9. Success
    // ─────────────────────────────────────────────────────────────────────

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
    console.error(
      '[NV Protocol] CCTP Bridge error:',
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Falha desconhecida na Bridge CCTP V2.',
    };
  }
}
