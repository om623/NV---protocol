import {
  encodeFunctionData,
  pad,
  parseUnits,
} from 'viem';

import {
  type Eip1193Provider,
  getChainId,
  ensureNetwork,
  networkChainParams,
} from './arc';

import type { NetworkConfig } from '../networks';

// ─── CCTP V2 Configuration ──────────────────────────────────────────────────

export interface CctpNetworkConfig {
  networkId: string;
  domain: number;
  usdc: `0x${string}`;
  tokenMessengerV2: `0x${string}`;
  messageTransmitterV2: `0x${string}`;
}

// Circle CCTP V2 contracts.
// TokenMessengerV2 and MessageTransmitterV2 use the same addresses
// across the supported EVM testnets.

export const CCTP_NETWORKS: Record<string, CctpNetworkConfig> = {
  'base-sepolia': {
    networkId: 'base-sepolia',
    domain: 6,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  },

  'arc-testnet': {
    networkId: 'arc-testnet',
    domain: 26,
    usdc: '0x3600000000000000000000000000000000000000',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  },
};

// ─── ABI ─────────────────────────────────────────────────────────────────────

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
] as const;

const DEPOSIT_FOR_BURN_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
      },
      {
        name: 'destinationDomain',
        type: 'uint32',
      },
      {
        name: 'mintRecipient',
        type: 'bytes32',
      },
      {
        name: 'burnToken',
        type: 'address',
      },
      {
        name: 'destinationCaller',
        type: 'bytes32',
      },
      {
        name: 'maxFee',
        type: 'uint256',
      },
      {
        name: 'minFinalityThreshold',
        type: 'uint32',
      },
    ],
    outputs: [],
  },
] as const;

const RECEIVE_MESSAGE_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'message',
        type: 'bytes',
      },
      {
        name: 'attestation',
        type: 'bytes',
      },
    ],
    outputs: [],
  },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CctpTransferResult {
  transferId: string;
  sourceNetwork: string;
  destinationNetwork: string;
  amount: number;
  sourceTxHash: string;
  destinationTxHash: string;
  status: 'completed';
}

export interface CctpAttestationMessage {
  message: string;
  attestation: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCctpConfig(networkId: string): CctpNetworkConfig {
  const config = CCTP_NETWORKS[networkId];

  if (!config) {
    throw new Error(
      `CCTP não está configurado para a rede "${networkId}".`,
    );
  }

  return config;
}

function addressToBytes32(address: string): `0x${string}` {
  return pad(address as `0x${string}`, { size: 32 });
}

async function waitForReceipt(
  provider: Eip1193Provider,
  txHash: string,
  timeoutMs = 180_000,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) {
      const status =
        typeof receipt === 'object' &&
        receipt !== null &&
        'status' in receipt
          ? (receipt as { status?: string }).status
          : undefined;

      if (status === '0x0') {
        throw new Error(`A transação ${txHash} foi revertida.`);
      }

      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Timeout aguardando confirmação da transação ${txHash}.`,
  );
}

// ─── Circle Attestation API ──────────────────────────────────────────────────

async function waitForAttestation(
  sourceDomain: number,
  transactionHash: string,
  timeoutMs = 600_000,
): Promise<CctpAttestationMessage> {
  const url =
    `https://iris-api-sandbox.circle.com/v2/messages/` +
    `${sourceDomain}?transactionHash=${transactionHash}`;

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        messages?: CctpAttestationMessage[];
      };

      const message = data.messages?.[0];

      if (message?.status === 'complete') {
        return message;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error(
    'A attestation da Circle não ficou disponível dentro do tempo esperado.',
  );
}

// ─── Optional fee lookup ─────────────────────────────────────────────────────

async function getCctpFee(
  sourceDomain: number,
  destinationDomain: number,
): Promise<bigint> {
  const url =
    `https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/` +
    `${sourceDomain}/${destinationDomain}?forward=false`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return 0n;
    }

    const fees = (await response.json()) as Array<{
      finalityThreshold: number;
      minimumFee?: number;
    }>;

    // Prefer the Fast Transfer quote.
    const fast = fees.find(
      fee => fee.finalityThreshold === 1000,
    );

    if (!fast?.minimumFee) {
      return 0n;
    }

    // minimumFee is expressed in basis points.
    return BigInt(
      Math.ceil(fast.minimumFee * 100),
    );
  } catch {
    return 0n;
  }
}

// ─── Approve USDC ────────────────────────────────────────────────────────────

export async function approveCctpUsdc(
  provider: Eip1193Provider,
  sourceNetwork: NetworkConfig,
  amount: number,
): Promise<string> {
  const config = getCctpConfig(sourceNetwork.id);

  if (!sourceNetwork.chainId) {
    throw new Error('Rede de origem sem chainId.');
  }

  const amountRaw = parseUnits(
    amount.toString(),
    6,
  );

  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [
      config.tokenMessengerV2,
      amountRaw,
    ],
  });

  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: await getWalletAddress(provider),
        to: config.usdc,
        data,
      },
    ],
  })) as string;

  await waitForReceipt(provider, txHash);

  return txHash;
}

// ─── Burn USDC on source chain ───────────────────────────────────────────────

export async function depositForBurn(
  provider: Eip1193Provider,
  sourceNetwork: NetworkConfig,
  destinationNetwork: NetworkConfig,
  amount: number,
): Promise<string> {
  const source = getCctpConfig(sourceNetwork.id);
  const destination = getCctpConfig(destinationNetwork.id);

  if (sourceNetwork.id === destinationNetwork.id) {
    throw new Error(
      'A rede de origem e destino precisam ser diferentes.',
    );
  }

  const walletAddress = await getWalletAddress(provider);

  const amountRaw = parseUnits(
    amount.toString(),
    6,
  );

  // Query Circle for the current protocol fee.
  const fee = await getCctpFee(
    source.domain,
    destination.domain,
  );

  const maxFee = fee;

  const mintRecipient = addressToBytes32(
    walletAddress,
  );

  const destinationCaller =
    '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

  const data = encodeFunctionData({
    abi: DEPOSIT_FOR_BURN_ABI,
    functionName: 'depositForBurn',
    args: [
      amountRaw,
      destination.domain,
      mintRecipient,
      source.usdc,
      destinationCaller,
      maxFee,
      1000,
    ],
  });

  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: walletAddress,
        to: source.tokenMessengerV2,
        data,
      },
    ],
  })) as string;

  await waitForReceipt(provider, txHash);

  return txHash;
}

// ─── Mint USDC on destination chain ─────────────────────────────────────────

export async function receiveCctpMessage(
  provider: Eip1193Provider,
  destinationNetwork: NetworkConfig,
  attestation: CctpAttestationMessage,
): Promise<string> {
  const destination = getCctpConfig(
    destinationNetwork.id,
  );

  const data = encodeFunctionData({
    abi: RECEIVE_MESSAGE_ABI,
    functionName: 'receiveMessage',
    args: [
      attestation.message as `0x${string}`,
      attestation.attestation as `0x${string}`,
    ],
  });

  const walletAddress = await getWalletAddress(provider);

  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: walletAddress,
        to: destination.messageTransmitterV2,
        data,
      },
    ],
  })) as string;

  await waitForReceipt(provider, txHash);

  return txHash;
}

// ─── Full browser bridge flow ────────────────────────────────────────────────

export async function executeCctpTransfer(
  provider: Eip1193Provider,
  sourceNetwork: NetworkConfig,
  destinationNetwork: NetworkConfig,
  amount: number,
): Promise<CctpTransferResult> {
  if (!provider) {
    throw new Error(
      'Carteira não conectada.',
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      'Informe um valor de USDC maior que zero.',
    );
  }

  getCctpConfig(sourceNetwork.id);
  getCctpConfig(destinationNetwork.id);

  const currentChainId = await getChainId(provider);

  if (currentChainId !== sourceNetwork.chainId) {
    await ensureNetwork(
      provider,
      networkChainParams(sourceNetwork),
    );
  }

  const walletAddress = await getWalletAddress(provider);

  // 1. Approve
  await approveCctpUsdc(
    provider,
    sourceNetwork,
    amount,
  );

  // 2. Burn
  const sourceTxHash = await depositForBurn(
    provider,
    sourceNetwork,
    destinationNetwork,
    amount,
  );

  // 3. Wait for Circle attestation
  const attestation = await waitForAttestation(
    getCctpConfig(sourceNetwork.id).domain,
    sourceTxHash,
  );

  // 4. Switch to destination
  await ensureNetwork(
    provider,
    networkChainParams(destinationNetwork),
  );

  // 5. Mint
  const destinationTxHash =
    await receiveCctpMessage(
      provider,
      destinationNetwork,
      attestation,
    );

  return {
    transferId:
      `cctp-${Date.now()}-${sourceTxHash.slice(2, 10)}`,
    sourceNetwork: sourceNetwork.id,
    destinationNetwork: destinationNetwork.id,
    amount,
    sourceTxHash,
    destinationTxHash,
    status: 'completed',
  };
}

// ─── Wallet helper ───────────────────────────────────────────────────────────

async function getWalletAddress(
  provider: Eip1193Provider,
): Promise<string> {
  const accounts = (await provider.request({
    method: 'eth_accounts',
  })) as string[];

  if (!accounts?.[0]) {
    const requested = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];

    if (!requested?.[0]) {
      throw new Error(
        'Nenhuma conta encontrada na carteira.',
      );
    }

    return requested[0];
  }

  return accounts[0];
}
