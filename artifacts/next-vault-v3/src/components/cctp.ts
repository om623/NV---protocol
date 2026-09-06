// ─── NV Protocol — CCTP V2 On-chain Layer ───────────────────────────────────

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Address,
  type EIP1193Provider,
  type Chain,
  type Hex,
} from 'viem';

import {
  mainnet,
  sepolia,
  baseSepolia,
  arcTestnet,
} from 'viem/chains';

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

// ─── Network metadata ────────────────────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  domain: number;
  chain: Chain;
  rpcUrl: string;
  usdc: Address;
  usdcDecimals: number;
  explorerUrl: string;
}

// ─── CCTP V2 networks ────────────────────────────────────────────────────────

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: CCTP_DOMAINS.arcTestnet,
    chain: arcTestnet,
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    usdc:
      '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    domain: CCTP_DOMAINS.baseSepolia,
    chain: baseSepolia,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdc:
      '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
  },

  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    domain: CCTP_DOMAINS.ethereumSepolia,
    chain: sepolia,
    rpcUrl:
      'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    usdc:
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    usdcDecimals: 6,
  },
};

// ─── CCTP parameters ────────────────────────────────────────────────────────

export const CCTP_STANDARD_FINALITY = 2000;

// Standard Transfer has no protocol fee on the current
// supported testnet routes.
export const CCTP_MAX_FEE = 0n;

// ─── ABIs ────────────────────────────────────────────────────────────────────

// Normal CCTP V2 depositForBurn has 7 parameters.
// depositForBurnWithHook has 8 parameters and is NOT used here.

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
    outputs: [
      {
        name: 'success',
        type: 'bool',
      },
    ],
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asAddress(
  address: string,
): Address {
  return address as Address;
}

function addressToBytes32(
  address: Address,
): Hex {
  return `0x${address
    .slice(2)
    .padStart(64, '0')}` as Hex;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve =>
    setTimeout(resolve, ms),
  );
}

// ─── Network lookup ─────────────────────────────────────────────────────────

export function getCctpNetwork(
  networkId: string,
): CctpNetwork | undefined {
  return CCTP_NETWORKS[networkId];
}

export function getCctpDomain(
  networkId: string,
): number | null {
  return (
    CCTP_NETWORKS[networkId]?.domain ?? null
  );
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
  decimals: number;
  recipient: Address;
  burnToken: Address;
  destinationCaller?: Address;
  maxFee?: number;
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
    source.domain === destination.domain
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

  const amount = parseUnits(
    params.amount.toString(),
    params.decimals,
  );

  const mintRecipient =
    addressToBytes32(params.recipient);

  const destinationCaller =
    params.destinationCaller
      ? addressToBytes32(
          params.destinationCaller,
        )
      : ('0x' +
          '00'.repeat(32)) as Hex;

  const maxFee =
    params.maxFee !== undefined
      ? parseUnits(
          params.maxFee.toString(),
          params.decimals,
        )
      : CCTP_MAX_FEE;

  const minFinalityThreshold =
    params.minFinalityThreshold ??
    CCTP_STANDARD_FINALITY;

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
      params.burnToken,
      destinationCaller,
      maxFee,
      minFinalityThreshold,
    ],
  };
}

// ─── Send CCTP V2 burn ──────────────────────────────────────────────────────

export async function sendCctpBurn(
  provider: EIP1193Provider,
  params: PrepareBurnParams,
): Promise<Hex> {
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

  const hash =
    await walletClient.writeContract({
      account,
      address: request.address,
      abi: request.abi,
      functionName:
        request.functionName,
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
  const source =
    getCctpNetwork(sourceNetwork);

  if (!source) {
    throw new Error(
      `Unknown CCTP source network: ${sourceNetwork}`,
    );
  }

  const url =
    `https://iris-api-sandbox.circle.com/v2/messages/` +
    `${source.domain}` +
    `?transactionHash=${transactionHash}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  // IMPORTANT:
  // Circle returns 404 while Iris has not observed
  // or processed the burn yet.
  // This is expected and must NOT abort the bridge.

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body =
      await response.text().catch(
        () => '',
      );

    throw new Error(
      `Circle attestation API returned HTTP ` +
        `${response.status}` +
        `${body ? `: ${body}` : ''}`,
    );
  }

  const data =
    (await response.json()) as {
      messages?: CctpAttestation[];
    };

  if (
    !data.messages ||
    data.messages.length === 0
  ) {
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

// ─── Wait for CCTP attestation ──────────────────────────────────────────────

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
    try {
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

      console.log(
        '[NV Protocol] CCTP attestation pending...',
      );
    } catch (error) {
      console.warn(
        '[NV Protocol] CCTP attestation polling error:',
        error,
      );
    }

    await sleep(intervalMs);
  }

  throw new Error(
    'Tempo limite aguardando a attestation da Circle.',
  );
}

// ─── Complete CCTP V2 bridge ────────────────────────────────────────────────

export async function completeCctpBridge(
  provider: EIP1193Provider,
  walletAddress: string,
  destinationNetwork: string,
  attestation: CctpAttestation,
): Promise<Hex> {
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

  const walletClient =
    createWalletClient({
      chain: destination.chain,
      transport: custom(provider),
    });

  const account =
    asAddress(walletAddress);

  const hash =
    await walletClient.writeContract({
      account,
      address:
        CCTP_CONTRACTS
          .messageTransmitterV2,
      abi: MESSAGE_TRANSMITTER_V2_ABI,
      functionName:
        'receiveMessage',
      args: [
        attestation.message as Hex,
        attestation.attestation as Hex,
      ],
    });

  return hash;
}
