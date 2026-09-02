// ─── Network Configuration ─────────────────────────────────────────────────────
// Central registry for all supported networks.
// To add a new network, append an entry to NETWORKS_CONFIG below.
// The rest of the app picks it up automatically through TESTNET_NETWORKS /
// MAINNET_NETWORKS — no other file needs to change.

export type EnvMode = 'testnet' | 'mainnet';

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  /** ERC-20 contract address on this network, or null for the native gas token */
  address: string | null;
  isNative: boolean;
}

export interface NetworkConfig {
  id: string;
  /** Full human-readable name */
  name: string;
  /** Compact name used in nav indicator */
  shortName: string;
  chainId: number;
  type: EnvMode;
  /** Tailwind bg-* class for the coloured status dot */
  color: string;
  /** Short glyph used as the network icon badge */
  icon: string;
  /** Placeholder RPC URL — not used yet; ready for Phase 2 (real balances) */
  rpcUrl: string;
  /** Block-explorer base URL — ready for Phase 2 */
  explorerUrl: string;
  nativeCurrency: { symbol: string; decimals: number };
  /** Network status shown in the Central de Redes */
  status: 'online' | 'unstable' | 'offline';
  /** Tokens supported on this network for the Swap UI */
  tokens: TokenConfig[];
}

export const NETWORKS_CONFIG: NetworkConfig[] = [
  // ── Testnets ───────────────────────────────────────────────────────────────
  {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    shortName: 'Arc',
    chainId: 5042002,
    type: 'testnet',
    color: 'bg-emerald-500',
    icon: 'A',
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    nativeCurrency: { symbol: 'USDC', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 18, address: null, isNative: true },
      { symbol: 'EURC', name: 'Euro Coin', decimals: 6, address: '0x82aF49447D8a07e3bd9BD0b78325c7F9b5C98E3a', isNative: false },
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    chainId: 11155111,
    type: 'testnet',
    color: 'bg-green-500',
    icon: 'E',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    chainId: 84532,
    type: 'testnet',
    color: 'bg-blue-500',
    icon: 'B',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia-explorer.base.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  {
    id: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    shortName: 'Arb Sepolia',
    chainId: 421614,
    type: 'testnet',
    color: 'bg-sky-500',
    icon: 'Ar',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'unstable',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  {
    id: 'optimism-sepolia',
    name: 'Optimism Sepolia',
    shortName: 'OP Sepolia',
    chainId: 11155420,
    type: 'testnet',
    color: 'bg-red-500',
    icon: 'O',
    rpcUrl: 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  

  // ── Mainnets ───────────────────────────────────────────────────────────────
  {
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'Ethereum',
    chainId: 1,
    type: 'mainnet',
    color: 'bg-indigo-500',
    icon: 'E',
    rpcUrl: 'https://cloudflare-eth.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  {
    id: 'base',
    name: 'Base',
    shortName: 'Base',
    chainId: 8453,
    type: 'mainnet',
    color: 'bg-blue-600',
    icon: 'B',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
  { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', isNative: false },
  { symbol: 'EURC', name: 'Euro Coin', decimals: 6, address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', isNative: false },
],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    shortName: 'Arbitrum',
    chainId: 42161,
    type: 'mainnet',
    color: 'bg-sky-600',
    icon: 'Ar',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
  {
    id: 'optimism',
    name: 'Optimism',
    shortName: 'Optimism',
    chainId: 10,
    type: 'mainnet',
    color: 'bg-red-600',
    icon: 'O',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
    ],
  },
];

export const TESTNET_NETWORKS = NETWORKS_CONFIG.filter(n => n.type === 'testnet');
export const MAINNET_NETWORKS = NETWORKS_CONFIG.filter(n => n.type === 'mainnet');

/** App always starts in Testnet mode on Arc Testnet */
export const DEFAULT_TESTNET = NETWORKS_CONFIG.find(n => n.id === 'arc-testnet')!;
export const DEFAULT_MAINNET = NETWORKS_CONFIG.find(n => n.id === 'base')!;

/**
 * Chain ID injected as the simulated wallet's current network when the user
 * clicks "Connect".  Intentionally set to Ethereum Mainnet (1) so the UI
 * can demonstrate the network-mismatch warning while in Testnet mode.
 * Phase 2 will replace this with a real wallet provider query.
 */
export const SIMULATED_WALLET_CHAIN_ID = 1; // Ethereum Mainnet

/**
 * EIP-3085 chain params for wallet_addEthereumChain / wallet_switchEthereumChain.
 * Used to request the injected wallet to switch to Arc Testnet before real swaps.
 */
export const ARC_TESTNET_CHAIN_PARAMS = {
  chainId: '0x' + (5042002).toString(16), // 0x4D2E32
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
};

/**
 * EIP-3085 chain params for Base Mainnet — the production payment network.
 */
export const BASE_MAINNET_CHAIN_PARAMS = {
  chainId: '0x' + (8453).toString(16), // 0x2105
  chainName: 'Base',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

/** Return the tokens supported on a given network. */
export function getNetworkTokens(network: NetworkConfig): TokenConfig[] {
  return network.tokens;
}
