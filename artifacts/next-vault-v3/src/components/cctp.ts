// ─── NV Protocol — CCTP V2 On-chain Layer ───────────────────────────────────
// SINGLE SOURCE OF TRUTH for all CCTP network configuration.
//
// Contract addresses sourced exclusively from:
//   developers.circle.com/cctp/evm-smart-contracts.md
// USDC addresses sourced exclusively from:
//   developers.circle.com/stablecoins/usdc-contract-addresses.md
//
// Attestation endpoints:
//   Testnet:  https://iris-api-sandbox.circle.com/v2/messages/
//   Mainnet:  https://iris-api.circle.com/v2/messages/
// These are stored explicitly on each CctpNetwork — never derived by string matching.

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
  base,
  mainnet,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  polygon,
  arc as arcMainnet,
} from 'viem/chains';

// ─── Arc Testnet (custom chain — not in viem/chains) ─────────────────────────

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    // Native gas token uses 18 decimals (native precision).
    // The ERC-20 USDC interface at 0x3600…0000 uses 6 decimals for token amounts.
    // Source: docs.arc.io/arc/references/connect-to-arc.md
    decimals: 18,
  },
  rpcUrls: {
    // Source: docs.arc.io/arc/references/connect-to-arc.md
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' },
  },
});

// ─── Attestation API URLs ─────────────────────────────────────────────────────
// Stored explicitly on each network — never inferred from environment or name.

export const IRIS_TESTNET = 'https://iris-api-sandbox.circle.com/v2/messages/';
export const IRIS_MAINNET  = 'https://iris-api.circle.com/v2/messages/';

// ─── CCTP V2 Testnet Contracts ───────────────────────────────────────────────
// Source: developers.circle.com/cctp/evm-smart-contracts.md
// All testnet chains share the same addresses.

const TESTNET_TOKEN_MESSENGER_V2  = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address;
const TESTNET_MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address;

// ─── CCTP V2 Mainnet Contracts ───────────────────────────────────────────────
// Source: developers.circle.com/cctp/evm-smart-contracts.md
// All mainnet chains share the same addresses.

const MAINNET_TOKEN_MESSENGER_V2  = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d' as Address;
const MAINNET_MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64' as Address;

// ─── CCTP parameters ─────────────────────────────────────────────────────────

export const CCTP_STANDARD_FINALITY = 2000;
export const CCTP_MAX_FEE = 0n;

// ─── CctpNetwork type ────────────────────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  domain: number;
  isMainnet: boolean;
  /** Circle Iris attestation API base URL — explicit, never inferred */
  attestationUrl: string;
  chain: ReturnType<typeof defineChain> | typeof sepolia | typeof baseSepolia | typeof base | typeof mainnet | typeof arbitrum | typeof arbitrumSepolia | typeof optimism | typeof optimismSepolia | typeof polygon | typeof arcMainnet;
  rpcUrl: string;
  explorerUrl: string;
  usdc: Address;
  usdcDecimals: number;
  tokenMessengerV2: Address;
  messageTransmitterV2: Address;
}

// ─── CCTP Network Registry ────────────────────────────────────────────────────
// Testnets and Mainnets are kept completely separate.

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {

  // ── TESTNETS ───────────────────────────────────────────────────────────────

  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: 26,
    isMainnet: false,
    attestationUrl: IRIS_TESTNET,
    chain: arcTestnet,
    // Source: docs.arc.io/arc/references/connect-to-arc.md
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerUrl: 'https://explorer.testnet.arc.io',
    // Arc USDC ERC-20 sentinel address — 6 decimals for CCTP amounts.
    // Source: docs.arc.io/arc/references/contract-addresses.md
    usdc: '0x3600000000000000000000000000000000000000' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: TESTNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: TESTNET_MESSAGE_TRANSMITTER_V2,
  },

  'sepolia': {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    domain: 0,
    isMainnet: false,
    attestationUrl: IRIS_TESTNET,
    chain: sepolia,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: TESTNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: TESTNET_MESSAGE_TRANSMITTER_V2,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    domain: 6,
    isMainnet: false,
    attestationUrl: IRIS_TESTNET,
    chain: baseSepolia,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: TESTNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: TESTNET_MESSAGE_TRANSMITTER_V2,
  },

  'arbitrum-sepolia': {
    id: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    domain: 3,
    isMainnet: false,
    attestationUrl: IRIS_TESTNET,
    chain: arbitrumSepolia,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: TESTNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: TESTNET_MESSAGE_TRANSMITTER_V2,
  },

  'optimism-sepolia': {
    id: 'optimism-sepolia',
    name: 'Optimism Sepolia',
    chainId: 11155420,
    domain: 2,
    isMainnet: false,
    attestationUrl: IRIS_TESTNET,
    chain: optimismSepolia,
    rpcUrl: 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: TESTNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: TESTNET_MESSAGE_TRANSMITTER_V2,
  },

  // ── MAINNETS ──────────────────────────────────────────────────────────────
  // All addresses sourced from:
  //   docs.arc.io/arc/references/contract-addresses.md  (Arc)
  //   developers.circle.com/cctp/evm-smart-contracts.md (others)

  'arc-mainnet': {
    id: 'arc-mainnet',
    name: 'Arc',
    chainId: 5042,
    domain: 26,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    // viem ships `arc` (chain ID 5042) as a built-in chain.
    chain: arcMainnet,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    // Arc USDC ERC-20 sentinel address — 6 decimals for CCTP amounts.
    // Native gas token uses 18 decimals but CCTP operates on ERC-20 (6 dec).
    // Source: docs.arc.io/arc/references/contract-addresses.md
    usdc: '0x3600000000000000000000000000000000000000' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'ethereum': {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    domain: 0,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: mainnet,
    rpcUrl: 'https://cloudflare-eth.com',
    explorerUrl: 'https://etherscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'base': {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    domain: 6,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: base,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'arbitrum': {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    domain: 3,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: arbitrum,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'optimism': {
    id: 'optimism',
    name: 'OP Mainnet',
    chainId: 10,
    domain: 2,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: optimism,
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'polygon': {
    id: 'polygon',
    name: 'Polygon PoS',
    chainId: 137,
    domain: 7,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: polygon,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    // Note: this is the Circle-issued native USDC, not USDC.e (bridged)
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },
};

// ─── ERC20 ABI ────────────────────────────────────────────────────────────────

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

// ─── TokenMessengerV2 ABI ─────────────────────────────────────────────────────
// depositForBurn has 7 parameters — hookData is NOT used here (that is depositForBurnWithHook).

const TOKEN_MESSENGER_V2_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount',               type: 'uint256' },
      { name: 'destinationDomain',    type: 'uint32'  },
      { name: 'mintRecipient',        type: 'bytes32' },
      { name: 'burnToken',            type: 'address' },
      { name: 'destinationCaller',    type: 'bytes32' },
      { name: 'maxFee',               type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32'  },
    ],
    outputs: [],
  },
] as const;

// ─── MessageTransmitterV2 ABI ─────────────────────────────────────────────────

const MESSAGE_TRANSMITTER_V2_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message',     type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addressToBytes32(address: Address): `0x${string}` {
  return `0x${address.slice(2).padStart(64, '0')}`;
}

// ─── Network lookup ───────────────────────────────────────────────────────────

export function getCctpNetwork(networkId: string): CctpNetwork | null {
  return CCTP_NETWORKS[networkId] ?? null;
}

export function getCctpDomain(networkId: string): number | null {
  return CCTP_NETWORKS[networkId]?.domain ?? null;
}

// ─── Public client ────────────────────────────────────────────────────────────

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

// ─── PrepareBurn params ───────────────────────────────────────────────────────

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

export function prepareCctpBurn(params: PrepareBurnParams) {
  const source      = getCctpNetwork(params.fromNetwork);
  const destination = getCctpNetwork(params.toNetwork);

  if (!source) {
    throw new Error(`Unsupported source network: ${params.fromNetwork}`);
  }
  if (!destination) {
    throw new Error(`Unsupported destination network: ${params.toNetwork}`);
  }
  if (params.fromNetwork === params.toNetwork) {
    throw new Error('Source and destination networks must be different.');
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error('Bridge amount must be greater than zero.');
  }

  const decimals       = params.decimals ?? source.usdcDecimals;
  const amount         = parseUnits(params.amount.toString(), decimals);
  const mintRecipient  = addressToBytes32(params.recipient);
  const destinationCaller = params.destinationCaller
    ? addressToBytes32(params.destinationCaller)
    : ('0x' + '0'.repeat(64)) as `0x${string}`;

  return {
    address:      source.tokenMessengerV2,
    abi:          TOKEN_MESSENGER_V2_ABI,
    functionName: 'depositForBurn' as const,
    args: [
      amount,
      destination.domain,
      mintRecipient,
      params.burnToken ?? source.usdc,
      destinationCaller,
      params.maxFee ?? CCTP_MAX_FEE,
      params.minFinalityThreshold ?? CCTP_STANDARD_FINALITY,
    ],
  };
}

// ─── Send CCTP V2 burn ────────────────────────────────────────────────────────

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
    throw new Error('No connected wallet account.');
  }

  const request = prepareCctpBurn({
    ...params,
    recipient: params.recipient ?? account,
  });

  return walletClient.writeContract({
    account,
    chain: null,
    address:      request.address,
    abi:          request.abi,
    functionName: request.functionName,
    args: request.args as unknown as readonly [bigint, number, `0x${string}`, `0x${string}`, `0x${string}`, bigint, number],
  });
}

// ─── Approve USDC ─────────────────────────────────────────────────────────────

export async function approveCctpUsdc(
  provider: EIP1193Provider,
  walletAddress: string,
  sourceNetwork: string,
  amount: number,
): Promise<string> {
  const network = getCctpNetwork(sourceNetwork);
  if (!network) {
    throw new Error(`Unsupported source network: ${sourceNetwork}`);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const amountUnits = parseUnits(amount.toString(), network.usdcDecimals);

  const walletClient = createWalletClient({
    chain: network.chain,
    transport: custom(provider),
  });

  const account = walletAddress as Address;

  return walletClient.writeContract({
    account,
    chain: null,
    address:      network.usdc,
    abi:          ERC20_ABI,
    functionName: 'approve',
    args: [network.tokenMessengerV2, amountUnits],
  });
}

// ─── Start CCTP V2 bridge (burn) ─────────────────────────────────────────────

export async function startCctpBridge(
  provider: EIP1193Provider,
  walletAddress: string,
  fromNetwork: string,
  toNetwork: string,
  amount: number,
): Promise<string> {
  const source      = getCctpNetwork(fromNetwork);
  const destination = getCctpNetwork(toNetwork);

  if (!source)      throw new Error(`Unsupported source network: ${fromNetwork}`);
  if (!destination) throw new Error(`Unsupported destination network: ${toNetwork}`);
  if (fromNetwork === toNetwork) {
    throw new Error('Source and destination networks must be different.');
  }

  const request = prepareCctpBurn({
    fromNetwork,
    toNetwork,
    amount,
    recipient:              walletAddress as Address,
    burnToken:              source.usdc,
    destinationCaller:      undefined,
    maxFee:                 CCTP_MAX_FEE,
    minFinalityThreshold:   CCTP_STANDARD_FINALITY,
  });

  const walletClient = createWalletClient({
    chain: source.chain,
    transport: custom(provider),
  });

  const account = walletAddress as Address;

  return walletClient.writeContract({
    account,
    chain: null,
    address:      request.address,
    abi:          request.abi,
    functionName: request.functionName,
    args: request.args as unknown as readonly [bigint, number, `0x${string}`, `0x${string}`, `0x${string}`, bigint, number],
  });
}

// ─── Circle Iris attestation ──────────────────────────────────────────────────

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
    throw new Error(`Unknown CCTP source network: ${sourceNetwork}`);
  }

  // attestationUrl is set explicitly per-network — testnet vs mainnet kept separate
  const url = `${source.attestationUrl}${source.domain}?transactionHash=${transactionHash}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  // The message may simply not be indexed yet — this is a pending state.
  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Circle attestation API returned HTTP ${response.status}${body ? `: ${body}` : ''}`,
    );
  }

  const data = (await response.json()) as { messages?: CctpAttestation[] };

  if (!data.messages?.length) return null;

  const message = data.messages[0];

  if (
    !message.message ||
    message.message === '0x' ||
    !message.attestation ||
    message.attestation === 'PENDING'
  ) {
    return { ...message, status: 'pending' };
  }

  return { ...message, status: 'complete' };
}

// ─── Wait for Circle attestation ─────────────────────────────────────────────

export async function waitForCctpAttestation(
  sourceNetwork: string,
  transactionHash: string,
  timeoutMs = 20 * 60 * 1000,
  intervalMs = 5000,
): Promise<CctpAttestation> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await getCctpAttestation(sourceNetwork, transactionHash);

    if (
      result &&
      result.status === 'complete' &&
      result.message !== '0x' &&
      result.attestation !== 'PENDING'
    ) {
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('CCTP attestation timed out after 20 minutes.');
}

// ─── Complete CCTP V2 bridge (mint) ──────────────────────────────────────────

export async function completeCctpBridge(
  provider: EIP1193Provider,
  walletAddress: string,
  destinationNetwork: string,
  attestation: CctpAttestation,
): Promise<string> {
  const destination = getCctpNetwork(destinationNetwork);
  if (!destination) {
    throw new Error(`Unsupported destination network: ${destinationNetwork}`);
  }

  if (!attestation.message || attestation.message === '0x') {
    throw new Error('CCTP message is not ready.');
  }
  if (!attestation.attestation || attestation.attestation === 'PENDING') {
    throw new Error('CCTP attestation is not ready.');
  }

  const walletClient = createWalletClient({
    chain: destination.chain,
    transport: custom(provider),
  });

  const account = walletAddress as Address;

  return walletClient.writeContract({
    account,
    chain: null,
    address:      destination.messageTransmitterV2,
    abi:          MESSAGE_TRANSMITTER_V2_ABI,
    functionName: 'receiveMessage',
    args: [
      attestation.message as Hex,
      attestation.attestation as Hex,
    ],
  });
}
