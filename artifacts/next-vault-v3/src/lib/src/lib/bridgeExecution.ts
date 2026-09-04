import type { Address, Hex } from 'viem';
import type { Eip1193Provider } from './arc';

import {
  approveUsdcForBridge,
  depositForBurn,
  CCTP_NETWORKS,
} from './cctpBridge';

export interface BridgeExecutionResult {
  approvalTx: Hex;
  burnTx: Hex;
}

export async function executeBridge(
  provider: Eip1193Provider,
  sourceNetwork: string,
  destinationNetwork: string,
  amount: number,
  account: string,
): Promise<BridgeExecutionResult> {
  const source = CCTP_NETWORKS[sourceNetwork];
  const destination = CCTP_NETWORKS[destinationNetwork];

  if (!source) {
    throw new Error(`Rede de origem não configurada: ${sourceNetwork}`);
  }

  if (!destination) {
    throw new Error(`Rede de destino não configurada: ${destinationNetwork}`);
  }

  if (amount <= 0) {
    throw new Error('O valor da bridge deve ser maior que zero.');
  }

  if (sourceNetwork === destinationNetwork) {
    throw new Error('As redes de origem e destino devem ser diferentes.');
  }

  const address = account as Address;

  // 1. Autoriza o TokenMessenger a utilizar o USDC.
  const approvalTx = await approveUsdcForBridge(
    provider,
    sourceNetwork,
    amount,
    address,
  );

  // 2. Queima o USDC na rede de origem.
  const burnTx = await depositForBurn(
    provider,
    sourceNetwork,
    destinationNetwork,
    amount,
    address,
    address,
  );

  return {
    approvalTx,
    burnTx,
  };
}
