// ─── NV Protocol — CCTP V2 Solana → EVM Bridge Executor ──────────────────────
//
// Orchestrates the full Solana → EVM CCTP V2 bridge flow:
//
//   1. Build the depositForBurn Solana transaction
//   2. Request user wallet signature (via useSolanaWallet.signAndSendTransaction)
//   3. Poll Circle Iris for the attestation
//   4. Execute receiveMessage on the destination EVM chain
//
// SECURITY:
//   - Never signs automatically — every step requires explicit user action.
//   - Never stores private keys.
//   - The Solana signature comes from the user's connected Phantom/Solflare.
//   - The EVM signature comes from the user's connected EVM wallet (EIP-1193).
//
// SOURCES:
//   Circle CCTP Solana quickstart:
//     developers.circle.com/cctp/quickstarts/transfer-usdc-solana-to-arc
//   CCTP V2 program addresses verified October 2026.

import {
  getBase64EncodedWireTransaction,
  signTransactionMessageWithSigners,
} from '@solana/kit';

import {
  buildDepositForBurnTx,
  fetchIrisAttestation,
  base64ToBytes,
  CCTP_DOMAIN_SOLANA,
  type IrisMessageV2,
} from './cctpSolana';

import {
  completeCctpBridge,
  getCctpNetwork,
} from '../components/cctp';

import type { SolanaSignAndSendResult } from './useSolanaWallet';
import type { Eip1193Provider } from './arc';
import type { EIP1193Provider as ViemProvider } from 'viem';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BridgeStep =
  | 'idle'
  | 'building'           // Building and preparing the Solana transaction
  | 'awaiting_sol_sig'   // Waiting for the user to sign on Solana wallet
  | 'sol_submitted'      // Solana tx sent, waiting for on-chain confirmation
  | 'polling_iris'       // Polling Circle Iris for attestation
  | 'awaiting_evm_sig'   // Waiting for user to sign receiveMessage on EVM
  | 'evm_submitted'      // EVM tx sent, waiting for confirmation
  | 'complete'           // Bridge complete
  | 'error';

export interface BridgeStepState {
  step: BridgeStep;
  solanaTxSignature?: string;
  evmTxHash?: string;
  attestation?: IrisMessageV2;
  errorMessage?: string;
  /** Progress message to show in the UI */
  progressMessage?: string;
  /** Elapsed seconds since bridge started */
  elapsedSeconds?: number;
}

export interface SolanaEvmBridgeParams {
  /** Solana wallet address (sender) */
  solanaAddress: string;
  /** EVM wallet address (recipient on destination chain) */
  evmAddress: string;
  /** Destination EVM network ID (matches cctp.ts registry key, e.g. 'arc-mainnet') */
  destinationNetworkId: string;
  /** USDC amount in human-readable decimals (e.g. 1.5 = 1.5 USDC) */
  amount: number;
  /** EIP-1193 provider for the EVM destination wallet (for receiveMessage) */
  evmProvider: Eip1193Provider;
  /** Called on every step change — use to update UI */
  onStep: (state: BridgeStepState) => void;
  /** Optional: max fee in raw USDC base units (default 0) */
  maxFeeRaw?: bigint;
  /** Optional: min finality threshold (default 2000 = standard finality) */
  minFinalityThreshold?: number;
  /** The signAndSendTransaction function from useSolanaWallet */
  signAndSendSolana: (
    txBytes: Uint8Array,
    opts?: { commitment?: 'processed' | 'confirmed' | 'finalized' },
  ) => Promise<SolanaSignAndSendResult>;
}

export interface SolanaEvmBridgeResult {
  success: boolean;
  solanaTxSignature?: string;
  evmTxHash?: string;
  errorMessage?: string;
}

// ─── Human-friendly error messages ───────────────────────────────────────────

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('User rejected') || msg.includes('user rejected') ||
      msg.includes('WalletSignTransactionError') || msg.includes('declined')) {
    return 'Transação rejeitada pelo usuário. Nenhum USDC foi movido.';
  }
  if (msg.includes('insufficient funds') || msg.includes('insufficient lamports')) {
    return 'Saldo SOL insuficiente para pagar a taxa de rede Solana.';
  }
  if (msg.includes('TokenAccountNotFound') || msg.includes('invalid account')) {
    return 'Conta USDC não encontrada. Certifique-se de que sua carteira possui USDC na Solana.';
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.';
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'Tempo limite de espera atingido. A transação pode ainda estar sendo processada.';
  }
  if (msg.includes('blockhash') || msg.includes('Blockhash')) {
    return 'Blockhash expirado. Tente novamente em alguns segundos.';
  }
  if (msg.includes('RPC') || msg.includes('fetch') || msg.includes('network')) {
    return 'Erro de rede. Verifique sua conexão e tente novamente.';
  }
  // Return the raw message if it's short enough to be informative
  if (msg.length < 120) return msg;
  return 'Erro inesperado. Verifique o console para detalhes.';
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeSolanaToEvmBridge(
  params: SolanaEvmBridgeParams,
): Promise<SolanaEvmBridgeResult> {
  const {
    solanaAddress,
    evmAddress,
    destinationNetworkId,
    amount,
    evmProvider,
    onStep,
    maxFeeRaw = 0n,
    minFinalityThreshold = 2000,
    signAndSendSolana,
  } = params;

  const startedAt = Date.now();

  function elapsed() {
    return Math.round((Date.now() - startedAt) / 1000);
  }

  // ── Validate destination network ──────────────────────────────────────────
  const destNetwork = getCctpNetwork(destinationNetworkId);
  if (!destNetwork) {
    const msg = `Rede de destino não suportada: ${destinationNetworkId}`;
    onStep({ step: 'error', errorMessage: msg });
    return { success: false, errorMessage: msg };
  }

  console.log('[NV CCTP Solana] Starting bridge', {
    solanaAddress,
    evmAddress,
    destinationNetworkId,
    amount,
    destinationDomain: destNetwork.domain,
  });

  try {
    // ── STEP 1: Build the Solana transaction ─────────────────────────────────
    onStep({
      step: 'building',
      progressMessage: 'Preparando transação Solana...',
      elapsedSeconds: elapsed(),
    });

    const amountRaw = BigInt(Math.round(amount * 1_000_000));

    const { transactionMessage } = await buildDepositForBurnTx({
      walletAddress: solanaAddress,
      toEvmAddress: evmAddress,
      destinationDomain: destNetwork.domain,
      amountRaw,
      maxFeeRaw,
      minFinalityThreshold,
    });

    // Partially sign with the ephemeral messageSentEventAccount signer
    // (embedded in the transaction message accounts as a signer).
    // The wallet will add its own signature when signAndSendSolana is called.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partiallySignedTx = await signTransactionMessageWithSigners(transactionMessage as any);

    // Serialize to wire format for the wallet (base64ToBytes is Buffer-free)
    const wireBytes = base64ToBytes(getBase64EncodedWireTransaction(partiallySignedTx));

    // ── STEP 2: Request wallet signature ─────────────────────────────────────
    onStep({
      step: 'awaiting_sol_sig',
      progressMessage: 'Aguardando assinatura na carteira Solana...',
      elapsedSeconds: elapsed(),
    });

    let solanaSig: string;
    try {
      const result = await signAndSendSolana(wireBytes, { commitment: 'confirmed' });
      solanaSig = result.signature;
    } catch (err) {
      const msg = friendlyError(err);
      console.error('[NV CCTP Solana] Wallet signature rejected:', err);
      onStep({ step: 'error', errorMessage: msg, elapsedSeconds: elapsed() });
      return { success: false, errorMessage: msg };
    }

    console.log('[NV CCTP Solana] Solana tx submitted:', solanaSig);
    onStep({
      step: 'sol_submitted',
      solanaTxSignature: solanaSig,
      progressMessage: `Transação Solana enviada. Aguardando confirmação...`,
      elapsedSeconds: elapsed(),
    });

    // ── STEP 3: Poll Circle Iris for attestation ──────────────────────────────
    onStep({
      step: 'polling_iris',
      solanaTxSignature: solanaSig,
      progressMessage: 'Aguardando attestation da Circle (pode levar até 2 minutos)...',
      elapsedSeconds: elapsed(),
    });

    const POLL_INTERVAL_MS = 5_000;
    const POLL_TIMEOUT_MS  = 20 * 60 * 1000; // 20 minutes
    const pollStart = Date.now();
    let attestation: IrisMessageV2 | null = null;

    while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const result = await fetchIrisAttestation(CCTP_DOMAIN_SOLANA, solanaSig, true);

        if (
          result &&
          result.attestation !== 'PENDING' &&
          result.message !== '0x' &&
          result.message.length > 2
        ) {
          attestation = result;
          break;
        }

        onStep({
          step: 'polling_iris',
          solanaTxSignature: solanaSig,
          progressMessage: `Aguardando attestation da Circle... (${Math.round((Date.now() - pollStart) / 1000)}s)`,
          elapsedSeconds: elapsed(),
        });
      } catch (err) {
        // Rate limit or transient error — log and continue polling
        console.warn('[NV CCTP Solana] Iris poll error (will retry):', err);
      }
    }

    if (!attestation) {
      const msg = 'Attestation da Circle não chegou dentro do limite de 20 minutos.';
      onStep({ step: 'error', solanaTxSignature: solanaSig, errorMessage: msg, elapsedSeconds: elapsed() });
      return { success: false, solanaTxSignature: solanaSig, errorMessage: msg };
    }

    console.log('[NV CCTP Solana] Attestation ready:', attestation.eventNonce);
    onStep({
      step: 'awaiting_evm_sig',
      solanaTxSignature: solanaSig,
      attestation,
      progressMessage: 'Attestation pronta. Aguardando assinatura na carteira EVM...',
      elapsedSeconds: elapsed(),
    });

    // ── STEP 4: Execute receiveMessage on destination EVM ────────────────────
    let evmTxHash: string;
    try {
      evmTxHash = await completeCctpBridge(
        evmProvider as unknown as ViemProvider,
        evmAddress,
        destinationNetworkId,
        {
          message: attestation.message,
          attestation: attestation.attestation as string,
          status: 'complete',
        },
      );
    } catch (err) {
      const msg = friendlyError(err);
      console.error('[NV CCTP Solana] EVM receiveMessage failed:', err);
      onStep({
        step: 'error',
        solanaTxSignature: solanaSig,
        attestation,
        errorMessage: msg,
        elapsedSeconds: elapsed(),
      });
      return { success: false, solanaTxSignature: solanaSig, errorMessage: msg };
    }

    console.log('[NV CCTP Solana] EVM mint tx submitted:', evmTxHash);
    onStep({
      step: 'evm_submitted',
      solanaTxSignature: solanaSig,
      evmTxHash,
      attestation,
      progressMessage: 'Transação EVM enviada. Aguardando confirmação final...',
      elapsedSeconds: elapsed(),
    });

    // Wait briefly for the EVM tx to be picked up
    await new Promise(r => setTimeout(r, 4_000));

    onStep({
      step: 'complete',
      solanaTxSignature: solanaSig,
      evmTxHash,
      attestation,
      progressMessage: 'Bridge concluída com sucesso!',
      elapsedSeconds: elapsed(),
    });

    console.log('[NV CCTP Solana] Bridge complete!', { solanaSig, evmTxHash });
    return { success: true, solanaTxSignature: solanaSig, evmTxHash };

  } catch (err) {
    const msg = friendlyError(err);
    console.error('[NV CCTP Solana] Unexpected bridge error:', err);
    onStep({ step: 'error', errorMessage: msg, elapsedSeconds: elapsed() });
    return { success: false, errorMessage: msg };
  }
}
