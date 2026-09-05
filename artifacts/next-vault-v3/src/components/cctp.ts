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
import {
  mainnet,
  sepolia,
  baseSepolia,
  base,
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

// ─── Minimal ABI ────────────────────────────────────────────────────────────
// We intentionally keep only the functions required for the bridge flow.

const TOKEN_MESSENGER_V2_ABI = [
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
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

// ─── Network metadata ───────────────────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  domain: number;
  chain: typeof mainnet | typeof sepolia | typeof baseSepolia | typeof base;
  rpcUrl: string;
}

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    domain: CCTP_DOMAINS.arcTestnet,
    chain: baseSepolia,
    rpcUrl: 'https://rpc.testnet.arc.network',
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    domain: CCTP_DOMAINS.baseSepolia,
    chain: baseSepolia,
    rpcUrl: 'https://sepolia.base.org',
  },

  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    domain: CCTP_DOMAINS.ethereumSepolia,
    chain: sepolia,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addressToBytes32(address: Address): `0x${string}` {
  return `0x${address.slice(2).padStart(64, '0')}` as `0x${string}`;
}

export function getCctpNetwork(networkId: string): CctpNetwork | null {
  return CCTP_NETWORKS[networkId] ?? null;
}

export function getCctpDomain(networkId: string): number | null {
  return CCTP_NETWORKS[networkId]?.domain ?? null;
}

export function getCctpContracts() {
  return CCTP_CONTRACTS;
}

// ─── Public client ───────────────────────────────────────────────────────────

export function createCctpPublicClient(networkId: string) {
  const network = getCctpNetwork(networkId);

  if (!network) {
    throw new Error(`Unsupported CCTP network: ${networkId}`);
  }

  return createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  });
}

// ─── Prepare a CCTP V2 burn transaction ──────────────────────────────────────

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

export function prepareCctpBurn(params: PrepareBurnParams) {
  const source = getCctpNetwork(params.fromNetwork);
  const destination = getCctpNetwork(params.toNetwork);

  if (!source) {
    throw new Error(`Unsupported source network: ${params.fromNetwork}`);
  }

  if (!destination) {
    throw new Error(`Unsupported destination network: ${params.toNetwork}`);
  }

  if (source.domain === destination.domain) {
    throw new Error('Source and destination networks must be different');
  }

  const amount = parseUnits(
    params.amount.toString(),
    params.decimals,
  );

  const mintRecipient = addressToBytes32(params.recipient);

  const destinationCaller = addressToBytes32(
    params.destinationCaller ?? params.recipient,
  );

  return {
    address: CCTP_CONTRACTS.tokenMessengerV2,
    abi: TOKEN_MESSENGER_V2_ABI,
    functionName: 'depositForBurn' as const,
    args: [
      amount,
      destination.domain,
      mintRecipient,
      params.burnToken,
      destinationCaller,
      parseUnits(
        (params.maxFee ?? 0).toString(),
        params.decimals,
      ),
      params.minFinalityThreshold ?? 1000,
      '0x' as `0x${string}`,
    ],
  };
}

// ─── Send CCTP V2 burn ──────────────────────────────────────────────────────

export async function sendCctpBurn(
  provider: EIP1193Provider,
  params: PrepareBurnParams,
): Promise<`0x${string}`> {
  const source = getCctpNetwork(params.fromNetwork);

  if (!source) {
    throw new Error(`Unsupported source network: ${params.fromNetwork}`);
  }

  const walletClient = createWalletClient({
    chain: source.chain,
    transport: custom(provider),
  });

  const [account] = await walletClient.getAddresses();

  if (!account) {
    throw new Error('No connected wallet account');
  }

  const request = prepareCctpBurn({
    ...params,
    recipient: params.recipient ?? account,
  });

  const hash = await walletClient.writeContract({
    account,
    address: request.address,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
  });

  return hash;
}
