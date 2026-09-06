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

async function waitForTransaction(
  provider: Eip1193Provider,
  hash: string,
) {
  const maxWaitMs = 5 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    });

    if (receipt) {
      return receipt;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 2000),
    );
  }

  throw new Error(
    'Tempo limite aguardando confirmação da transação.',
  );
}

async function switchNetwork(
  provider: Eip1193Provider,
  chainId: number,
) {
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [
      {
        chainId:
          `0x${chainId.toString(16)}`,
      },
    ],
  });
}

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

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        'Informe uma quantidade válida de USDC.',
      );
    }

    if (fromNetwork === toNetwork) {
      throw new Error(
        'As redes de origem e destino devem ser diferentes.',
      );
    }

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

    // ─────────────────────────────────────────────────────────────────────
    // 1. Switch to source network
    // ─────────────────────────────────────────────────────────────────────

    await switchNetwork(
      provider,
      source.chain.id,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 2. Approve USDC
    // ─────────────────────────────────────────────────────────────────────

    const approveTx =
      await approveCctpUsdc(
        provider,
        walletAddress,
        fromNetwork,
        amount,
      );

    await waitForTransaction(
      provider,
      approveTx,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 3. Burn USDC
    // ─────────────────────────────────────────────────────────────────────

    const burnTx =
      await startCctpBridge(
        provider,
        walletAddress,
        fromNetwork,
        toNetwork,
        amount,
      );

    const burnReceipt =
      await waitForTransaction(
        provider,
        burnTx,
      );

    if (
      burnReceipt &&
      typeof burnReceipt === 'object' &&
      'status' in burnReceipt &&
      burnReceipt.status === '0x0'
    ) {
      throw new Error(
        'A transação de burn falhou.',
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. Wait Circle attestation
    // ─────────────────────────────────────────────────────────────────────

    const attestation =
      await waitForCctpAttestation(
        fromNetwork,
        burnTx,
      );

    // ─────────────────────────────────────────────────────────────────────
    // 5. Switch to destination
    // ─────────────────────────────────────────────────────────────────────

    await switchNetwork(
      provider,
      destination.chain.id,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 6. Receive message / mint
    // ─────────────────────────────────────────────────────────────────────

    const mintTx =
      await completeCctpBridge(
        provider,
        walletAddress,
        toNetwork,
        attestation,
      );

    await waitForTransaction(
      provider,
      mintTx,
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
