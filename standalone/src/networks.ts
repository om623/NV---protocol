// ─── Network Configuration ─────────────────────────────────────────────────────
// Central registry for all supported networks.
// To add a new network, append an entry to NETWORKS_CONFIG below.
// The rest of the app picks it up automatically through TESTNET_NETWORKS /
// MAINNET_NETWORKS — no other file needs to change.

export type EnvMode = 'testnet' | 'mainnet';

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
  /** Placeholder RPC URL — not used yet; ready for Phase 2 (real balances) */
  rpcUrl: string;
  /** Block-explorer base URL — ready for Phase 2 */
  explorerUrl: string;
  nativeCurrency: { symbol: string; decimals: number };
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
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    nativeCurrency: { symbol: 'USDC', decimals: 18 },
  },
  {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    chainId: 11155111,
    type: 'testnet',
    color: 'bg-green-500',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    chainId: 84532,
    type: 'testnet',
    color: 'bg-blue-500',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia-explorer.base.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  {
    id: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    shortName: 'Arb Sepolia',
    chainId: 421614,
    type: 'testnet',
    color: 'bg-sky-500',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  {
    id: 'optimism-sepolia',
    name: 'Optimism Sepolia',
    shortName: 'OP Sepolia',
    chainId: 11155420,
    type: 'testnet',
    color: 'bg-red-500',
    rpcUrl: 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },

  // ── Mainnets ───────────────────────────────────────────────────────────────
  {
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'Ethereum',
    chainId: 1,
    type: 'mainnet',
    color: 'bg-indigo-500',
    rpcUrl: 'https://cloudflare-eth.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  {
    id: 'base',
    name: 'Base',
    shortName: 'Base',
    chainId: 8453,
    type: 'mainnet',
    color: 'bg-blue-600',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    shortName: 'Arbitrum',
    chainId: 42161,
    type: 'mainnet',
    color: 'bg-sky-600',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  {
    id: 'optimism',
    name: 'Optimism',
    shortName: 'Optimism',
    chainId: 10,
    type: 'mainnet',
    color: 'bg-red-600',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
];

export const TESTNET_NETWORKS = NETWORKS_CONFIG.filter(n => n.type === 'testnet');
export const MAINNET_NETWORKS = NETWORKS_CONFIG.filter(n => n.type === 'mainnet');

/** App always starts in Testnet mode on Arc Testnet */
export const DEFAULT_TESTNET = NETWORKS_CONFIG.find(n => n.id === 'arc-testnet')!;
export const DEFAULT_MAINNET = NETWORKS_CONFIG.find(n => n.id === 'ethereum')!;

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

