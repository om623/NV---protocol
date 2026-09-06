// ─── NV Protocol — CCTP V2 On-chain Layer ───────────────────────────────────

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Address,
  type EIP1193Provider,
} from 'viem';
import { defineChain, sepolia, baseSepolia } from 'viem/chains';

// ─── Arc Testnet ────────────────────────────────────────────────────────────

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

// ─── CCTP V2 contracts ──────────────────────────────────────────────────────

export const CCTP_CONTRACTS = {
  tokenMessengerV2:
    '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address,

  messageTransmitterV2:
    '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address,
} as const;

// ─── CCTP domains ───────────────────────────────────────────────────────────

export const CCTP_DOMAINS = {
  ethereumSepolia: 0,
  baseSepolia: 6,
  arcTestnet: 26,
} as const;

// ─── Network metadata ───────────────────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  domain: number;
  chain: typeof arcTestnet | typeof sepolia | typeof baseSepolia;
  rpcUrl: string;
  usdc: Address;
  usdcDecimals: number;
}

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    domain: CCTP_DOMAINS.arcTestnet,
    chain: arcTestnet,
    rpcUrl: 'https://rpc.testnet.arc.network',
    usdc:
      '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    domain: CCTP_DOMAINS.baseSepolia,
    chain: baseSepolia,
    rpcUrl: 'https://sepolia.base.org',
    usdc:
      '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
  },

  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    domain: CCTP_DOMAINS.ethereumSepolia,
    chain: sepolia,
    rpcUrl:
      'https://ethereum-sepolia-rpc.publicnode.com',
    usdc:
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    usdcDecimals: 6,
  },
};

// ─── CCTP V2 parameters ────────────────────────────────────────────────────

export const CCTP_STANDARD_FINALITY = 2000;
export const CCTP_MAX_FEE = 0n;

// ─── ABIs ───────────────────────────────────────────────────────────────────

const ERC20_ABI = [
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

const TOKEN_MESSENGER_V2_ABI = [
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
      {
        name: 'hookData',
        type: 'bytes',
      },
    ],
    outputs: [],
  },
] as const;

const MESSAGE_TRANSMITTER_V2_ABI = [
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function addressToBytes32(
  address: Address,
): `0x${string}` {
  return `0x${address.slice(2).padStart(64, '0')}`;
}

export function getCctpNetwork(
  networkId: string,
): CctpNetwork | null {
  return CCTP_NETWORKS[networkId] ?? null;
}

export function getCctpDomain(
  networkId: string,
): number | null {
  return CCTP_NETWORKS[networkId]?.domain ?? null;
}

export function getCctpContracts() {
  return CCTP_CONTRACTS;
}

// ─── Public client ──────────────────────────────────────────────────────────

export function createCctpPublicClient(
  networkId: string,
) {
  const network = getCctpNetwork(networkId);

  if (!network) {
    throw new Error(
      `Unsupported CCTP network: ${networkId}`,
    );
  }

  return createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  });
}

// ─── Prepare CCTP V2 burn ───────────────────────────────────────────────────

export interface PrepareBurnParams {
  fromNetwork: string;
  toNetwork: string;
  amount: number;
  decimals?: number;
  recipient: Address;
  burnToken?: Address;
  destinationCaller?: Address;
  maxFee?: number;
  minFinalityThreshold?: number;
}

export function prepareCctpBurn(
  params: PrepareBurnParams,
) {
  const source = getCctpNetwork(params.fromNetwork);
  const destination = getCctpNetwork(params.toNetwork);

  if (!source) {
    throw new Error(
      `Unsupported source network: ${params.fromNetwork}`,
    );
  }

  if (!destination) {
    throw new Error(
      `Unsupported destination network: ${params.toNetwork}`,
    );
  }

  if (source.domain === destination.domain) {
    throw new Error(
      'Source and destination networks must be different.',
    );
  }

  if (params.amount <= 0) {
    throw new Error(
      'Bridge amount must be greater than zero.',
    );
  }

  const decimals =
    params.decimals ?? source.usdcDecimals;

  const amount = parseUnits(
    params.amount.toString(),
    decimals,
  );

  const mintRecipient =
    addressToBytes32(params.recipient);

  const destinationCaller =
    params.destinationCaller
      ? addressToBytes32(params.destinationCaller)
      : ('0x' + '00'.repeat(32)) as `0x${string}`;

  return {
    address: CCTP_CONTRACTS.tokenMessengerV2,
    abi: TOKEN_MESSENGER_V2_ABI,
    functionName: 'depositForBurn' as const,
    args: [
      amount,
      destination.domain,
      mintRecipient,
      params.burnToken ?? source.usdc,
      destinationCaller,
      BigInt(
        params.maxFee ?? 0,
      ),
      params.minFinalityThreshold ??
        CCTP_STANDARD_FINALITY,
      '0x' as `0x${string}`,
    ],
  };
}

// ─── Approve USDC ───────────────────────────────────────────────────────────

export async function approveCctpUsdc(
  provider: EIP1193Provider,
  walletAddress: string,
  sourceNetwork: string,
  amount: number,
): Promise<`0x${string}`> {
  const network = getCctpNetwork(sourceNetwork);

  if (!network) {
    throw new Error(
      `Unsupported source network: ${sourceNetwork}`,
    );
  }

  if (amount <= 0) {
    throw new Error(
      'Amount must be greater than zero.',
    );
  }

  const walletClient = createWalletClient({
    account: walletAddress as Address,
    chain: network.chain,
    transport: custom(provider),
  });

  const amountUnits = parseUnits(
    amount.toString(),
    network.usdcDecimals,
  );

  const hash =
    await walletClient.writeContract({
      account: walletAddress as Address,
      address: network.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [
        CCTP_CONTRACTS.tokenMessengerV2,
        amountUnits,
      ],
    });

  return hash;
}

// ─── Start CCTP V2 burn ─────────────────────────────────────────────────────

export async function startCctpBridge(
  provider: EIP1193Provider,
  walletAddress: string,
  fromNetwork: string,
  toNetwork: string,
  amount: number,
): Promise<`0x${string}`> {
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

  const walletClient = createWalletClient({
    account: walletAddress as Address,
    chain: source.chain,
    transport: custom(provider),
  });

  const request = prepareCctpBurn({
    fromNetwork,
    toNetwork,
    amount,
    recipient: walletAddress as Address,
    burnToken: source.usdc,
    destinationCaller: undefined,
  });

  const hash =
    await walletClient.writeContract({
      account: walletAddress as Address,
      address: request.address,
      abi: request.abi,
      functionName: request.functionName,
      args: request.args,
    });

  return hash;
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

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Circle attestation API returned HTTP ${response.status}`,
    );
  }

  const data =
    (await response.json()) as {
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
  timeoutMs = 20 * 60 * 1000,
  intervalMs = 5000,
): Promise<CctpAttestation> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result =
      await getCctpAttestation(
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
  provider: EIP1193Provider,
  walletAddress: string,
  destinationNetwork: string,
  attestation: CctpAttestation,
): Promise<`0x${string}`> {
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
      'CCTP message is not ready.',
    );
  }

  if (
    !attestation.attestation ||
    attestation.attestation === 'PENDING'
  ) {
    throw new Error(
      'CCTP attestation is not ready.',
    );
  }

  const walletClient = createWalletClient({
    account: walletAddress as Address,
    chain: destination.chain,
    transport: custom(provider),
  });

  const hash =
    await walletClient.writeContract({
      account: walletAddress as Address,
      address:
        CCTP_CONTRACTS.messageTransmitterV2,
      abi: MESSAGE_TRANSMITTER_V2_ABI,
      functionName: 'receiveMessage',
      args: [
        attestation.message as `0x${string}`,
        attestation.attestation as `0x${string}`,
      ],
    });

  return hash;
}
