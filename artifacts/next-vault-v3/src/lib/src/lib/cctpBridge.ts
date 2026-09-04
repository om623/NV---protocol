import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';

import { baseSepolia, mainnet } from 'viem/chains';
import type { Eip1193Provider } from './arc';

/**
 * ─────────────────────────────────────────────────────────────
 * NV Protocol — Circle CCTP V2
 * ─────────────────────────────────────────────────────────────
 *
 * Initial production path:
 *
 * Base Sepolia <-> Arc Testnet
 *
 * USDC only.
 *
 * CCTP V2 contracts:
 * TokenMessengerV2
 * MessageTransmitterV2
 * ─────────────────────────────────────────────────────────────
 */

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  domain: number;
  rpcUrl: string;
  tokenMessenger: Address;
  messageTransmitter: Address;
  usdc: Address;
  usdcDecimals: number;
}

/**
 * Circle CCTP V2 addresses.
 *
 * Base Sepolia domain = 6
 * Arc Testnet domain = 26
 *
 * These addresses are from Circle's official CCTP V2
 * contract registry.
 */

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {
  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    domain: 6,
    rpcUrl: 'https://sepolia.base.org',

    tokenMessenger:
      '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',

    messageTransmitter:
      '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',

    /**
     * Circle USDC on Base Sepolia.
     *
     * IMPORTANT:
     * Keep this value isolated here so the address can be
     * updated without touching the bridge logic.
     */
    usdc:
      '0x036CbD53842c5426634e7929541eC2318f3dCF7c',

    usdcDecimals: 6,
  },

  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: 26,
    rpcUrl: 'https://rpc.testnet.arc.network',

    tokenMessenger:
      '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',

    messageTransmitter:
      '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',

    /**
     * Circle USDC on Arc Testnet.
     *
     * Verify/update this address against the current
     * Circle Arc Testnet USDC contract registry before
     * performing a real transfer.
     */
    usdc:
      '0x3600000000000000000000000000000000000000',

    usdcDecimals: 6,
  },
};

/**
 * ─────────────────────────────────────────────────────────────
 * ABIs
 * ─────────────────────────────────────────────────────────────
 */

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
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
    ],
    outputs: [{ name: '', type: 'uint64' }],
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
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Convert an EVM address to bytes32.
 */
function addressToBytes32(address: Address): Hex {
  return `0x${address.slice(2).padStart(64, '0')}` as Hex;
}

/**
 * Create a public client for a registered CCTP network.
 */
export function getCctpPublicClient(networkId: string) {
  const network = CCTP_NETWORKS[networkId];

  if (!network) {
    throw new Error(`CCTP network not configured: ${networkId}`);
  }

  return createPublicClient({
    chain:
      networkId === 'base-sepolia'
        ? baseSepolia
        : {
            id: network.chainId,
            name: network.name,
            nativeCurrency: {
              name: 'USDC',
              symbol: 'USDC',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: [network.rpcUrl],
              },
            },
          },
    transport: http(network.rpcUrl),
  });
}

/**
 * Create a wallet client from the injected wallet.
 */
export function getCctpWalletClient(
  provider: Eip1193Provider,
  networkId: string,
) {
  const network = CCTP_NETWORKS[networkId];

  if (!network) {
    throw new Error(`CCTP network not configured: ${networkId}`);
  }

  return createWalletClient({
    account: undefined,
    chain:
      networkId === 'base-sepolia'
        ? baseSepolia
        : {
            id: network.chainId,
            name: network.name,
            nativeCurrency: {
              name: 'USDC',
              symbol: 'USDC',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: [network.rpcUrl],
              },
            },
          },
    transport: custom(provider),
  });
}

/**
 * Check the USDC allowance for TokenMessengerV2.
 */
export async function getUsdcAllowance(
  networkId: string,
  owner: Address,
): Promise<bigint> {
  const network = CCTP_NETWORKS[networkId];

  if (!network) {
    throw new Error(`CCTP network not configured: ${networkId}`);
  }

  const client = getCctpPublicClient(networkId);

  return client.readContract({
    address: network.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, network.tokenMessenger],
  });
}

/**
 * Approve TokenMessengerV2 to burn the required USDC.
 */
export async function approveUsdcForBridge(
  provider: Eip1193Provider,
  networkId: string,
  amount: number,
  account: Address,
): Promise<Hex> {
  const network = CCTP_NETWORKS[networkId];

  if (!network) {
    throw new Error(`CCTP network not configured: ${networkId}`);
  }

  const wallet = getCctpWalletClient(provider, networkId);

  const value = parseUnits(
    amount.toString(),
    network.usdcDecimals,
  );

  return wallet.writeContract({
    account,
    address: network.usdc,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [network.tokenMessenger, value],
  });
}

/**
 * Burn USDC on the source chain.
 *
 * This is the actual on-chain bridge initiation.
 */
export async function depositForBurn(
  provider: Eip1193Provider,
  sourceNetworkId: string,
  destinationNetworkId: string,
  amount: number,
  recipient: Address,
  account: Address,
): Promise<Hex> {
  const source = CCTP_NETWORKS[sourceNetworkId];
  const destination = CCTP_NETWORKS[destinationNetworkId];

  if (!source) {
    throw new Error(`Unknown source network: ${sourceNetworkId}`);
  }

  if (!destination) {
    throw new Error(`Unknown destination network: ${destinationNetworkId}`);
  }

  if (sourceNetworkId === destinationNetworkId) {
    throw new Error('Source and destination networks must be different.');
  }

  const wallet = getCctpWalletClient(
    provider,
    sourceNetworkId,
  );

  const value = parseUnits(
    amount.toString(),
    source.usdcDecimals,
  );

  return wallet.writeContract({
    account,
    address: source.tokenMessenger,
    abi: TOKEN_MESSENGER_ABI,
    functionName: 'depositForBurn',
    args: [
      value,
      destination.domain,
      addressToBytes32(recipient),
      source.usdc,
    ],
  });
}

/**
 * Submit the attested CCTP message on the destination chain.
 */
export async function receiveCctpMessage(
  provider: Eip1193Provider,
  destinationNetworkId: string,
  message: Hex,
  attestation: Hex,
  account: Address,
): Promise<Hex> {
  const destination = CCTP_NETWORKS[destinationNetworkId];

  if (!destination) {
    throw new Error(
      `Unknown destination network: ${destinationNetworkId}`,
    );
  }

  const wallet = getCctpWalletClient(
    provider,
    destinationNetworkId,
  );

  return wallet.writeContract({
    account,
    address: destination.messageTransmitter,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: 'receiveMessage',
    args: [message, attestation],
  });
}

import {
  encodeFunctionData,
  parseUnits,
  pad,
} from 'viem';

import type { Eip1193Provider } from './arc';

// ─── CCTP V2 contracts ─────────────────────────────────────────────────────

export const CCTP_TOKEN_MESSENGER_V2 =
  '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';

export const CCTP_MESSAGE_TRANSMITTER_V2 =
  '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';

// CCTP domains
export const CCTP_DOMAINS: Record<string, number> = {
  sepolia: 0,
  'base-sepolia': 6,
  'arc-testnet': 26,
};

// Standard CCTP V2 finality
export const CCTP_STANDARD_FINALITY = 2000;

// Testnet standard transfer fee.
// Circle currently documents standard transfer fees as 0,
// but maxFee remains an explicit CCTP V2 parameter.
export const CCTP_MAX_FEE = 0n;

// ─── Minimal ERC-20 ABI ─────────────────────────────────────────────────────

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

// ─── CCTP V2 depositForBurn ABI ────────────────────────────────────────────

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

// ─── MessageTransmitter V2 ABI ─────────────────────────────────────────────

const MESSAGE_TRANSMITTER_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function asHexAddress(address: string): `0x${string}` {
  return address as `0x${string}`;
}

function addressToBytes32(address: string): `0x${string}` {
  return pad(asHexAddress(address), { size: 32 });
}

async function sendContractTransaction(
  provider: Eip1193Provider,
  from: string,
  to: string,
  data: `0x${string}`,
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

// ─── Approve USDC for CCTP ──────────────────────────────────────────────────

export async function approveCctpUsdc(
  provider: Eip1193Provider,
  walletAddress: string,
  sourceNetwork: string,
  amount: number,
): Promise<string> {
  const network = getBridgeNetwork(sourceNetwork);

  if (!network) {
    throw new Error(`Unsupported source network: ${sourceNetwork}`);
  }

  if (!network.usdcAddress) {
    throw new Error(`USDC address is not configured for ${network.name}`);
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
    network.usdcAddress,
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
  const source = getBridgeNetwork(fromNetwork);
  const destination = getBridgeNetwork(toNetwork);

  if (!source || !destination) {
    throw new Error('Unsupported bridge network');
  }

  if (fromNetwork === toNetwork) {
    throw new Error('Source and destination networks must be different');
  }

  const sourceDomain = CCTP_DOMAINS[fromNetwork];
  const destinationDomain = CCTP_DOMAINS[toNetwork];

  if (
    sourceDomain === undefined ||
    destinationDomain === undefined
  ) {
    throw new Error('CCTP domain not configured');
  }

  if (!source.usdcAddress) {
    throw new Error(`USDC address missing on ${source.name}`);
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  const amountUnits = parseUnits(
    amount.toString(),
    source.usdcDecimals,
  );

  // The destination wallet is the same EVM address as the source wallet.
  const mintRecipient = addressToBytes32(walletAddress);

  // bytes32(0) means anyone may submit receiveMessage.
  const destinationCaller =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const data = encodeFunctionData({
    abi: TOKEN_MESSENGER_ABI,
    functionName: 'depositForBurn',
    args: [
      amountUnits,
      destinationDomain,
      mintRecipient,
      asHexAddress(source.usdcAddress),
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

// ─── Circle CCTP V2 attestation ─────────────────────────────────────────────

export interface CctpAttestation {
  message: string;
  attestation: string;
  status: string;
}

export async function getCctpAttestation(
  sourceNetwork: string,
  transactionHash: string,
): Promise<CctpAttestation | null> {
  const sourceDomain = CCTP_DOMAINS[sourceNetwork];

  if (sourceDomain === undefined) {
    throw new Error('Unknown CCTP source domain');
  }

  const url =
    `https://iris-api-sandbox.circle.com/v2/messages/` +
    `${sourceDomain}?transactionHash=${transactionHash}`;

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

// ─── Wait for Circle attestation ────────────────────────────────────────────

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
    'CCTP attestation timed out. The source transaction may still be waiting for finality.',
  );
}

// ─── Complete CCTP bridge ───────────────────────────────────────────────────

export async function completeCctpBridge(
  provider: Eip1193Provider,
  walletAddress: string,
  destinationNetwork: string,
  attestation: CctpAttestation,
): Promise<string> {
  const destination = getBridgeNetwork(destinationNetwork);

  if (!destination) {
    throw new Error(
      `Unsupported destination network: ${destinationNetwork}`,
    );
  }

  const data = encodeFunctionData({
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: 'receiveMessage',
    args: [
      attestation.message as `0x${string}`,
      attestation.attestation as `0x${string}`,
    ],
  });

  return sendContractTransaction(
    provider,
    walletAddress,
    CCTP_MESSAGE_TRANSMITTER_V2,
    data,
  );
}
