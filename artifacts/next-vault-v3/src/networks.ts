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
  comingSoon?: boolean;
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
    // Arc native currency is USDC with 6 decimals (confirmed Circle docs)
    nativeCurrency: { symbol: 'USDC', decimals: 6 },
    status: 'online',
    tokens: [
      // USDC is the native gas token on Arc; decimals = 6 (Circle official)
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3600000000000000000000000000000000000000', isNative: true },
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
      // USDC on Ethereum Sepolia — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', isNative: false },
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
      // USDC on Base Sepolia — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', isNative: false },
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
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // USDC on Arbitrum Sepolia — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', isNative: false },
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
      // USDC on OP Sepolia — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', isNative: false },
    ],
  },

  // ── Mainnets ───────────────────────────────────────────────────────────────
  // All CCTP V2 contract addresses sourced from developers.circle.com/cctp/evm-smart-contracts.md
  // All USDC addresses sourced from developers.circle.com/stablecoins/usdc-contract-addresses.md
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
      // USDC on Ethereum Mainnet — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', isNative: false },
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
      // USDC on Base Mainnet — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', isNative: false },
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
      // USDC on Arbitrum One — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', isNative: false },
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
      // USDC on OP Mainnet — Circle official address
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', isNative: false },
    ],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    shortName: 'Polygon',
    chainId: 137,
    type: 'mainnet',
    color: 'bg-purple-600',
    icon: 'P',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: { symbol: 'MATIC', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'MATIC', name: 'Polygon', decimals: 18, address: null, isNative: true },
      // USDC on Polygon PoS — Circle official address (native USDC, not bridged USDC.e)
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', isNative: false },
    ],
  },
];

export const TESTNET_NETWORKS =
  NETWORKS_CONFIG.filter(n => n.type === 'testnet');

export const MAINNET_NETWORKS =
  NETWORKS_CONFIG.filter(n => n.type === 'mainnet');

export const DEFAULT_TESTNET =
  NETWORKS_CONFIG.find(n => n.id === 'arc-testnet')!;

export const DEFAULT_MAINNET =
  NETWORKS_CONFIG.find(n => n.id === 'base')!;

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
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
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
