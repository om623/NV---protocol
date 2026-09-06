// ─── NV Protocol — CCTP V2 On-chain Layer ───────────────────────────────────

import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  parseUnits,
  type Address,
  type EIP1193Provider,
  type Hex,
} from 'viem';

import {
  sepolia,
  baseSepolia,
} from 'viem/chains';

// ─── Arc Testnet ────────────────────────────────────────────────────────────

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',

  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
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

// ─── USDC addresses ─────────────────────────────────────────────────────────

export const CCTP_USDC = {
  sepolia:
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,

  'base-sepolia':
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,

  'arc-testnet':
    '0x3600000000000000000000000000000000000000' as Address,
} as const;

// ─── Network metadata ───────────────────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  domain: number;
  chain:
    | typeof sepolia
    | typeof baseSepolia
    | typeof arcTestnet;
  rpcUrl: string;
  usdc: Address;
  usdcDecimals: number;
}

export const CCTP_NETWORKS: Record<
  string,
  CctpNetwork
> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: CCTP_DOMAINS.arcTestnet,
    chain: arcTestnet,
    rpcUrl: 'https://rpc.testnet.arc.network',
    usdc: CCTP_USDC['arc-testnet'],
    usdcDecimals: 6,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    domain: CCTP_DOMAINS.baseSepolia,
    chain: baseSepolia,
    rpcUrl: 'https://sepolia.base.org',
    usdc: CCTP_USDC['base-sepolia'],
    usdcDecimals: 6,
  },

  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    domain: CCTP_DOMAINS.ethereumSepolia,
    chain: sepolia,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    usdc: CCTP_USDC.sepolia,
    usdcDecimals: 6,
  },
};

// ─── CCTP parameters ────────────────────────────────────────────────────────

export const CCTP_STANDARD_FINALITY = 2000;

// Standard CCTP transfers currently use zero protocol max fee.
// This is kept isolated here so it can be changed later if Circle
// changes the applicable fee.
export const CCTP_MAX_FEE = 0n;

// ─── ERC20 ABI ───────────────────────────────────────────────────────────────

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

// ─── TokenMessengerV2 ABI ───────────────────────────────────────────────────
// IMPORTANT:
// depositForBurn has 7 parameters.
// hookData belongs to depositForBurnWithHook and is NOT used here.

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
    ],

    outputs: [],
  },
] as const;

// ─── MessageTransmitterV2 ABI ────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addressToBytes32(
  address: Address,
): `0x${string}` {
  return `0x${address.slice(2).padStart(64, '0')}`;
}

function asAddress(
  address: string,
): Address {
  return address as Address;
}

// ─── Network lookup ──────────────────────────────────────────────────────────

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

// ─── Public client ───────────────────────────────────────────────────────────

export function createCctpPublicClient(
  networkId: string,
) {
  const network =
    getCctpNetwork(networkId);

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

// ─── Prepare CCTP V2 burn ────────────────────────────────────────────────────

export interface PrepareBurnParams {
  fromNetwork: string;
  toNetwork: string;
  amount: number;
  decimals?: number;
  recipient: Address;
  burnToken?: Address;
  destinationCaller?: Address;
  maxFee?: bigint;
  minFinalityThreshold?: number;
}

export function prepareCctpBurn(
  params: PrepareBurnParams,
) {
  const source =
    getCctpNetwork(params.fromNetwork);

  const destination =
    getCctpNetwork(params.toNetwork);

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

  if (
    params.fromNetwork === params.toNetwork
  ) {
    throw new Error(
      'Source and destination networks must be different.',
    );
  }

  if (
    !Number.isFinite(params.amount) ||
    params.amount <= 0
  ) {
    throw new Error(
      'Bridge amount must be greater than zero.',
    );
  }

  const decimals =
    params.decimals ??
    source.usdcDecimals;

  const amount =
    parseUnits(
      params.amount.toString(),
      decimals,
    );

  const mintRecipient =
    addressToBytes32(params.recipient);

  const destinationCaller =
    params.destinationCaller
      ? addressToBytes32(
          params.destinationCaller,
        )
      : ('0x' +
          '0'.repeat(64)) as `0x${string}`;

  return {
    address:
      CCTP_CONTRACTS.tokenMessengerV2,

    abi: TOKEN_MESSENGER_V2_ABI,

    functionName:
      'depositForBurn' as const,

    args: [
      amount,

      destination.domain,

      mintRecipient,

      params.burnToken ??
        source.usdc,

      destinationCaller,

      params.maxFee ??
        CCTP_MAX_FEE,

      params.minFinalityThreshold ??
        CCTP_STANDARD_FINALITY,
    ],
  };
}

// ─── Send CCTP V2 burn ──────────────────────────────────────────────────────

export async function sendCctpBurn(
  provider: EIP1193Provider,
  params: PrepareBurnParams,
): Promise<`0x${string}`> {
  const source =
    getCctpNetwork(params.fromNetwork);

  if (!source) {
    throw new Error(
      `Unsupported source network: ${params.fromNetwork}`,
    );
  }

  const walletClient =
    createWalletClient({
      chain: source.chain,
      transport: custom(provider),
    });

  const [account] =
    await walletClient.getAddresses();

  if (!account) {
    throw new Error(
      'No connected wallet account.',
    );
  }

  const request =
    prepareCctpBurn({
      ...params,
      recipient:
        params.recipient ?? account,
    });

  return walletClient.writeContract({
    account,

    address:
      request.address,

    abi:
      request.abi,

    functionName:
      request.functionName,

    args:
      request.args,
  });
}

// ─── Approve USDC ────────────────────────────────────────────────────────────

export async function approveCctpUsdc(
  provider: EIP1193Provider,
  walletAddress: string,
  sourceNetwork: string,
  amount: number,
): Promise<string> {
  const network =
    getCctpNetwork(sourceNetwork);

  if (!network) {
    throw new Error(
      `Unsupported source network: ${sourceNetwork}`,
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Amount must be greater than zero.',
    );
  }

  const amountUnits =
    parseUnits(
      amount.toString(),
      network.usdcDecimals,
    );

  const walletClient =
    createWalletClient({
      chain: network.chain,
      transport: custom(provider),
    });

  const account =
    walletAddress as Address;

  return walletClient.writeContract({
    account,

    address:
      network.usdc,

    abi: ERC20_ABI,

    functionName:
      'approve',

    args: [
      CCTP_CONTRACTS.tokenMessengerV2,
      amountUnits,
    ],
  });
}

// ─── Start CCTP V2 bridge ───────────────────────────────────────────────────

export async function startCctpBridge(
  provider: EIP1193Provider,
  walletAddress: string,
  fromNetwork: string,
  toNetwork: string,
  amount: number,
): Promise<string> {
  const source =
    getCctpNetwork(fromNetwork);

  const destination =
    getCctpNetwork(toNetwork);

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

  if (
    fromNetwork === toNetwork
  ) {
    throw new Error(
      'Source and destination networks must be different.',
    );
  }

  const request =
    prepareCctpBurn({
      fromNetwork,
      toNetwork,
      amount,
      recipient:
        asAddress(walletAddress),
      burnToken:
        source.usdc,
      destinationCaller:
        undefined,
      maxFee:
        CCTP_MAX_FEE,
      minFinalityThreshold:
        CCTP_STANDARD_FINALITY,
    });

  const walletClient =
    createWalletClient({
      chain: source.chain,
      transport: custom(provider),
    });

  const account =
    walletAddress as Address;

  return walletClient.writeContract({
    account,

    address:
      request.address,

    abi:
      request.abi,

    functionName:
      request.functionName,

    args:
      request.args,
  });
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
  const source =
    getCctpNetwork(sourceNetwork);

  if (!source) {
    throw new Error(
      `Unknown CCTP source network: ${sourceNetwork}`,
    );
  }

  const url =
    `https://iris-api-sandbox.circle.com/v2/messages/` +
    `${source.domain}?transactionHash=${transactionHash}`;

  const response =
    await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

  // The message may simply not be indexed yet.
  // This is a pending state, not a fatal error.
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body =
      await response.text().catch(
        () => '',
      );

    throw new Error(
      `Circle attestation API returned HTTP ${response.status}${
        body ? `: ${body}` : ''
      }`,
    );
  }

  const data =
    (await response.json()) as {
      messages?: CctpAttestation[];
    };

  if (!data.messages?.length) {
    return null;
  }

  const message =
    data.messages[0];

  if (
    !message.message ||
    message.message === '0x' ||
    !message.attestation ||
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

// ─── Wait for Circle attestation ─────────────────────────────────────────────

export async function waitForCctpAttestation(
  sourceNetwork: string,
  transactionHash: string,
  timeoutMs = 20 * 60 * 1000,
  intervalMs = 5000,
): Promise<CctpAttestation> {
  const started =
    Date.now();

  while (
    Date.now() - started <
    timeoutMs
  ) {
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
      setTimeout(
        resolve,
        intervalMs,
      ),
    );
  }

  throw new Error(
    'CCTP attestation timed out after 20 minutes.',
  );
}

// ─── Complete CCTP V2 bridge ────────────────────────────────────────────────

export async function completeCctpBridge(
  provider: EIP1193Provider,
  walletAddress: string,
  destinationNetwork: string,
  attestation: CctpAttestation,
): Promise<string> {
  const destination =
    getCctpNetwork(
      destinationNetwork,
    );

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

  const walletClient =
    createWalletClient({
      chain: destination.chain,
      transport: custom(provider),
    });

  const account =
    walletAddress as Address;

  const data =
    {
      message:
        attestation.message as Hex,

      attestation:
        attestation.attestation as Hex,
    };

  return walletClient.writeContract({
    account,

    address:
      CCTP_CONTRACTS.messageTransmitterV2,

    abi:
      MESSAGE_TRANSMITTER_V2_ABI,

    functionName:
      'receiveMessage',

    args: [
      data.message,
      data.attestation,
    ],
  });
}
