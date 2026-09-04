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
