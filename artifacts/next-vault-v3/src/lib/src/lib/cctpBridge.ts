import {
  encodeFunctionData,
  parseUnits,
  pad,
  type Hex,
} from 'viem';

import type { Eip1193Provider } from './arc';

// ─── NV Protocol — Circle CCTP V2 ───────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  domain: number;
  rpcUrl: string;
  explorerUrl: string;
  usdc: `0x${string}`;
  usdcDecimals: number;
}

// ─── Circle CCTP V2 contracts ───────────────────────────────────────────────

export const CCTP_TOKEN_MESSENGER_V2 =
  '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';

export const CCTP_MESSAGE_TRANSMITTER_V2 =
  '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';

// ─── CCTP V2 networks ───────────────────────────────────────────────────────

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: 26,
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    usdc: '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    domain: 6,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
  },

  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    domain: 0,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    usdcDecimals: 6,
  },
};

// ─── CCTP parameters ────────────────────────────────────────────────────────

export const CCTP_STANDARD_FINALITY = 2000;

export const CCTP_MAX_FEE = 0n;

// ─── ABIs ───────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const TOKEN_MESSENGER_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [],
  },
] as const;

const MESSAGE_TRANSMITTER_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [
      { name: 'success', type: 'bool' },
    ],
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function asHexAddress(address: string): `0x${string}` {
  return address as `0x${string}`;
}

function addressToBytes32(address: string): `0x${string}` {
  return pad(asHexAddress(address), {
    size: 32,
  });
}

async function sendContractTransaction(
  provider: Eip1193Provider,
  from: string,
  to: string,
  data: Hex,
): Promise<string> {
  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to,
        data,
      },
    ],
  })) as string;
}

// ─── Network lookup ─────────────────────────────────────────────────────────

export function getCctpNetwork(
  networkId: string,
): CctpNetwork | undefined {
  return CCTP_NETWORKS[networkId];
}

// ─── Approve USDC ───────────────────────────────────────────────────────────

export async function approveCctpUsdc(
  provider: Eip1193Provider,
  walletAddress: string,
  sourceNetwork: string,
  amount: number,
): Promise<string> {
  const network = getCctpNetwork(sourceNetwork);

  if (!network) {
    throw new Error(
      `Unsupported source network: ${sourceNetwork}`,
    );
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  const amountUnits = parseUnits(
    amount.toString(),
    network.usdcDecimals,
  );

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [
      asHexAddress(CCTP_TOKEN_MESSENGER_V2),
      amountUnits,
    ],
  });

  return sendContractTransaction(
    provider,
    walletAddress,
    network.usdc,
    data,
  );
}

// ─── Start CCTP V2 bridge ───────────────────────────────────────────────────

export async function startCctpBridge(
  provider: Eip1193Provider,
  walletAddress: string,
  fromNetwork: string,
  toNetwork: string,
  amount: number,
): Promise<string> {
  const source = getCctpNetwork(fromNetwork);
  const destination = getCctpNetwork(toNetwork);

  if (!source) {
    throw new Error(
      `Unsupported source network: ${fromNetwork}`,
    );
  }

  if (!destination) {
    throw new Error(
      `Unsupported destination network: ${toNetwork}`,
    );
  }

  if (fromNetwork === toNetwork) {
    throw new Error(
      'Source and destination networks must be different',
    );
  }

  if (amount <= 0) {
    throw new Error(
      'Amount must be greater than zero',
    );
  }

  const amountUnits = parseUnits(
    amount.toString(),
    source.usdcDecimals,
  );

  const mintRecipient =
    addressToBytes32(walletAddress);

  // Anyone may submit the receiveMessage transaction.
  const destinationCaller =
    '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

  const data = encodeFunctionData({
    abi: TOKEN_MESSENGER_ABI,
    functionName: 'depositForBurn',
    args: [
      amountUnits,
      destination.domain,
      mintRecipient,
      asHexAddress(source.usdc),
      destinationCaller,
      CCTP_MAX_FEE,
      CCTP_STANDARD_FINALITY,
    ],
  });

  return sendContractTransaction(
    provider,
    walletAddress,
    CCTP_TOKEN_MESSENGER_V2,
    data,
  );
}

// ─── Circle attestation ─────────────────────────────────────────────────────

export interface CctpAttestation {
  message: string;
  attestation: string;
  status: string;
}

export async function getCctpAttestation(
  sourceNetwork: string,
  transactionHash: string,
): Promise<CctpAttestation | null> {
  const source = getCctpNetwork(sourceNetwork);

  if (!source) {
    throw new Error(
      `Unknown CCTP source network: ${sourceNetwork}`,
    );
  }

  const url =
    `https://iris-api-sandbox.circle.com/v2/messages/` +
    `${source.domain}?transactionHash=${transactionHash}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Circle attestation API returned HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    messages?: CctpAttestation[];
  };

  if (!data.messages?.length) {
    return null;
  }

  const message = data.messages[0];

  if (
    !message.message ||
    message.message === '0x' ||
    message.attestation === 'PENDING'
  ) {
    return {
      ...message,
      status: 'pending',
    };
  }

  return {
    ...message,
    status: 'complete',
  };
}

// ─── Wait for attestation ───────────────────────────────────────────────────

export async function waitForCctpAttestation(
  sourceNetwork: string,
  transactionHash: string,
  timeoutMs = 10 * 60 * 1000,
  intervalMs = 5000,
): Promise<CctpAttestation> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await getCctpAttestation(
      sourceNetwork,
      transactionHash,
    );

    if (
      result &&
      result.status === 'complete' &&
      result.message !== '0x' &&
      result.attestation !== 'PENDING'
    ) {
      return result;
    }

    await new Promise(resolve =>
      setTimeout(resolve, intervalMs),
    );
  }

  throw new Error(
    'CCTP attestation timed out.',
  );
}

// ─── Complete CCTP V2 bridge ────────────────────────────────────────────────

export async function completeCctpBridge(
  provider: Eip1193Provider,
  walletAddress: string,
  destinationNetwork: string,
  attestation: CctpAttestation,
): Promise<string> {
  const destination =
    getCctpNetwork(destinationNetwork);

  if (!destination) {
    throw new Error(
      `Unsupported destination network: ${destinationNetwork}`,
    );
  }

  if (
    !attestation.message ||
    attestation.message === '0x'
  ) {
    throw new Error(
      'CCTP message is not ready',
    );
  }

  if (
    !attestation.attestation ||
    attestation.attestation === 'PENDING'
  ) {
    throw new Error(
      'CCTP attestation is not ready',
    );
  }

  const data = encodeFunctionData({
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: 'receiveMessage',
    args: [
      attestation.message as Hex,
      attestation.attestation as Hex,
    ],
  });

  return sendContractTransaction(
    provider,
    walletAddress,
    CCTP_MESSAGE_TRANSMITTER_V2,
    data,
  );
}
