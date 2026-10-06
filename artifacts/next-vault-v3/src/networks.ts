// ─── Network Configuration ─────────────────────────────────────────────────────
// Central registry for all supported networks.
// To add a new network, append an entry to NETWORKS_CONFIG below.
// The rest of the app picks it up automatically through TESTNET_NETWORKS /
// MAINNET_NETWORKS — no other file needs to change.
//
// DATA SOURCES (consulted October 2026):
//   CCTP V2 EVM contracts:  developers.circle.com/cctp/references/contract-addresses.md
//   CCTP supported domains: developers.circle.com/cctp/concepts/supported-chains-and-domains.md
//   USDC addresses:         developers.circle.com/stablecoins/usdc-contract-addresses.md
//   Arc config:             docs.arc.io/arc/references/connect-to-arc.md
//                           docs.arc.io/arc/references/contract-addresses.md
//   Chain IDs:              ethereum-lists/chains + RPC verification

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
  rpcUrl: string;
  /** Block-explorer base URL */
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
    // Source: docs.arc.io/arc/references/connect-to-arc.md
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerUrl: 'https://explorer.testnet.arc.io',
    nativeCurrency: { symbol: 'USDC', decimals: 18 },
    status: 'online',
    tokens: [
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3600000000000000000000000000000000000000', isNative: true },
      // Source: docs.arc.io/arc/references/contract-addresses.md
      { symbol: 'EURC', name: 'Euro Coin', decimals: 6, address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', isNative: false },
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
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
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
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
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
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
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
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', isNative: false },
    ],
  },

  // ── Mainnets ───────────────────────────────────────────────────────────────
  // All CCTP V2 contract addresses: developers.circle.com/cctp/references/contract-addresses.md
  // All USDC addresses: developers.circle.com/stablecoins/usdc-contract-addresses.md
  // All CCTP domains: developers.circle.com/cctp/concepts/supported-chains-and-domains.md
  // Chain IDs: ethereum-lists/chains + direct RPC verification

  {
    id: 'arc-mainnet',
    name: 'Arc',
    shortName: 'Arc',
    chainId: 5042,
    type: 'mainnet',
    color: 'bg-emerald-600',
    icon: 'A',
    // Source: docs.arc.io/arc/references/connect-to-arc.md
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    // Arc native gas token = USDC with 18 decimal native precision.
    // ERC-20 USDC interface uses 6 decimals — use 6 for all CCTP/token amounts.
    nativeCurrency: { symbol: 'USDC', decimals: 18 },
    status: 'online',
    tokens: [
      // Source: docs.arc.io/arc/references/contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3600000000000000000000000000000000000000', isNative: true },
    ],
  },
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
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
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
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', isNative: false },
    ],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
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
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', isNative: false },
    ],
  },
  {
    id: 'optimism',
    name: 'OP Mainnet',
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
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', isNative: false },
    ],
  },
  {
    id: 'polygon',
    name: 'Polygon PoS',
    shortName: 'Polygon',
    chainId: 137,
    type: 'mainnet',
    color: 'bg-purple-600',
    icon: 'P',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: { symbol: 'POL', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'POL', name: 'POL (ex-MATIC)', decimals: 18, address: null, isNative: true },
      // Native USDC (not USDC.e). Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', isNative: false },
    ],
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    shortName: 'Avalanche',
    chainId: 43114,
    type: 'mainnet',
    color: 'bg-red-500',
    icon: 'Av',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: { symbol: 'AVAX', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'AVAX', name: 'Avalanche', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', isNative: false },
    ],
  },
  {
    id: 'unichain',
    name: 'Unichain',
    shortName: 'Unichain',
    chainId: 130,
    type: 'mainnet',
    color: 'bg-pink-500',
    icon: 'U',
    rpcUrl: 'https://mainnet.unichain.org',
    explorerUrl: 'https://uniscan.xyz',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', isNative: false },
    ],
  },
  {
    id: 'linea',
    name: 'Linea',
    shortName: 'Linea',
    chainId: 59144,
    type: 'mainnet',
    color: 'bg-slate-500',
    icon: 'L',
    rpcUrl: 'https://rpc.linea.build',
    explorerUrl: 'https://lineascan.build',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', isNative: false },
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    shortName: 'Codex',
    chainId: 81224,
    type: 'mainnet',
    color: 'bg-teal-500',
    icon: 'C',
    rpcUrl: 'https://rpc.codex.xyz',
    explorerUrl: 'https://explorer.codex.xyz',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xd996633a415985DBd7D6D12f4A4343E31f5037cf', isNative: false },
    ],
  },
  {
    id: 'sonic',
    name: 'Sonic',
    shortName: 'Sonic',
    chainId: 146,
    type: 'mainnet',
    color: 'bg-yellow-500',
    icon: 'S',
    rpcUrl: 'https://rpc.soniclabs.com',
    explorerUrl: 'https://sonicscan.org',
    nativeCurrency: { symbol: 'S', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'S', name: 'Sonic', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', isNative: false },
    ],
  },
  {
    id: 'world-chain',
    name: 'World Chain',
    shortName: 'World Chain',
    chainId: 480,
    type: 'mainnet',
    color: 'bg-violet-500',
    icon: 'W',
    rpcUrl: 'https://worldchain-mainnet.g.alchemy.com/public',
    explorerUrl: 'https://worldscan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x79A02482A880bCe3F13E09da970dC34dB4cD24D1', isNative: false },
    ],
  },
  {
    id: 'monad',
    name: 'Monad',
    shortName: 'Monad',
    chainId: 143,
    type: 'mainnet',
    color: 'bg-purple-500',
    icon: 'M',
    rpcUrl: 'https://rpc.monad.xyz',
    explorerUrl: 'https://monadscan.com',
    nativeCurrency: { symbol: 'MON', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'MON', name: 'Monad', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', isNative: false },
    ],
  },
  {
    id: 'sei',
    name: 'Sei',
    shortName: 'Sei',
    chainId: 1329,
    type: 'mainnet',
    color: 'bg-orange-500',
    icon: 'Se',
    rpcUrl: 'https://evm-rpc.sei-apis.com',
    explorerUrl: 'https://seiscan.io',
    nativeCurrency: { symbol: 'SEI', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'SEI', name: 'Sei', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392', isNative: false },
    ],
  },
  {
    id: 'xdc',
    name: 'XDC Network',
    shortName: 'XDC',
    chainId: 50,
    type: 'mainnet',
    color: 'bg-cyan-600',
    icon: 'X',
    rpcUrl: 'https://erpc.xinfin.network',
    explorerUrl: 'https://xdcscan.io',
    nativeCurrency: { symbol: 'XDC', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'XDC', name: 'XDC', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1', isNative: false },
    ],
  },
  {
    id: 'hyperevm',
    name: 'HyperEVM',
    shortName: 'HyperEVM',
    chainId: 999,
    type: 'mainnet',
    color: 'bg-lime-500',
    icon: 'H',
    rpcUrl: 'https://rpc.hyperliquid.xyz/evm',
    explorerUrl: 'https://hyperevmscan.io',
    nativeCurrency: { symbol: 'HYPE', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'HYPE', name: 'HYPE', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xb88339CB7199b77E23DB6E890353E22632Ba630f', isNative: false },
    ],
  },
  {
    id: 'ink',
    name: 'Ink',
    shortName: 'Ink',
    chainId: 57073,
    type: 'mainnet',
    color: 'bg-fuchsia-500',
    icon: 'Ik',
    rpcUrl: 'https://rpc-gel.inkonchain.com',
    explorerUrl: 'https://explorer.inkonchain.com',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x2D270e6886d130D724215A266106e6832161EAEd', isNative: false },
    ],
  },
  {
    id: 'plume',
    name: 'Plume',
    shortName: 'Plume',
    chainId: 98866,
    type: 'mainnet',
    color: 'bg-rose-500',
    icon: 'Pl',
    rpcUrl: 'https://rpc.plume.org',
    explorerUrl: 'https://explorer.plume.org',
    nativeCurrency: { symbol: 'PLUME', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'PLUME', name: 'Plume', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x222365EF19F7947e5484218551B56bb3965Aa7aF', isNative: false },
    ],
  },
  {
    id: 'edge',
    name: 'EDGE',
    shortName: 'EDGE',
    chainId: 3343,
    type: 'mainnet',
    color: 'bg-amber-500',
    icon: 'Ed',
    // Source: Alchemy-hosted EDGE chain (verified via eth_chainId RPC call)
    rpcUrl: 'https://edge-mainnet.g.alchemy.com/public',
    explorerUrl: 'https://pro.edgex.exchange/en-US/explorer',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x98d2919b9A214E6Fa5384AC81E6864bA686Ad74c', isNative: false },
    ],
  },
  {
    id: 'injective',
    name: 'Injective (inEVM)',
    shortName: 'Injective',
    chainId: 2525,
    type: 'mainnet',
    color: 'bg-blue-400',
    icon: 'Inj',
    rpcUrl: 'https://mainnet.rpc.inevm.com/http',
    explorerUrl: 'https://inevm.calderaexplorer.xyz',
    nativeCurrency: { symbol: 'INJ', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'INJ', name: 'Injective', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xa00C59fF5a080D2b954d0c75e46E22a0c371235a', isNative: false },
    ],
  },
  {
    id: 'morph',
    name: 'Morph',
    shortName: 'Morph',
    chainId: 2818,
    type: 'mainnet',
    color: 'bg-green-400',
    icon: 'Mo',
    rpcUrl: 'https://rpc.morphl2.io',
    explorerUrl: 'https://explorer.morphl2.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B', isNative: false },
    ],
  },
  {
    id: 'pharos',
    name: 'Pharos',
    shortName: 'Pharos',
    chainId: 1672,
    type: 'mainnet',
    color: 'bg-indigo-400',
    icon: 'Ph',
    rpcUrl: 'https://rpc.pharosnetwork.xyz',
    explorerUrl: 'https://pharos.socialscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815', isNative: false },
    ],
  },
  {
    id: 'cronos',
    name: 'Cronos',
    shortName: 'Cronos',
    chainId: 25,
    type: 'mainnet',
    color: 'bg-gray-400',
    icon: 'Cr',
    rpcUrl: 'https://evm.cronos.org',
    explorerUrl: 'https://explorer.cronos.org',
    nativeCurrency: { symbol: 'CRO', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'CRO', name: 'Cronos', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3D7F2C478aAfdB65542BCB44bCeeC05849999d2D', isNative: false },
    ],
  },
  {
    id: 'plasma',
    name: 'Plasma',
    shortName: 'Plasma',
    chainId: 9745,
    type: 'mainnet',
    color: 'bg-sky-400',
    icon: 'Ps',
    rpcUrl: 'https://rpc.plasma.to',
    explorerUrl: 'https://plasmascan.to',
    nativeCurrency: { symbol: 'XPL', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'XPL', name: 'Plasma', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x2d661C89D812261039AF9764eceaAee884f5F67F', isNative: false },
    ],
  },
  {
    id: 'xlayer',
    name: 'X Layer',
    shortName: 'X Layer',
    chainId: 196,
    type: 'mainnet',
    color: 'bg-neutral-500',
    icon: 'XL',
    rpcUrl: 'https://xlayerrpc.okx.com',
    explorerUrl: 'https://www.oklink.com/xlayer',
    nativeCurrency: { symbol: 'OKB', decimals: 18 },
    status: 'online',
    tokens: [
      { symbol: 'OKB', name: 'OKB', decimals: 18, address: null, isNative: true },
      // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md (Circle-issued native USDC)
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', isNative: false },
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
 * EIP-3085 chain params for wallet_addEthereumChain / wallet_switchEthereumChain.
 */
export const ARC_TESTNET_CHAIN_PARAMS = {
  chainId: '0x' + (5042002).toString(16),
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.io'],
  blockExplorerUrls: ['https://explorer.testnet.arc.io'],
};

export const ARC_MAINNET_CHAIN_PARAMS = {
  chainId: '0x' + (5042).toString(16),
  chainName: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.mainnet.arc.io'],
  blockExplorerUrls: ['https://explorer.arc.io'],
};

export const BASE_MAINNET_CHAIN_PARAMS = {
  chainId: '0x' + (8453).toString(16),
  chainName: 'Base',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

/** Return the tokens supported on a given network. */
export function getNetworkTokens(network: NetworkConfig): TokenConfig[] {
  return network.tokens;
}

/**
 * Simulated wallet chain ID — Ethereum Mainnet (1) by default.
 * Phase 2 will replace this with a real wallet provider query.
 */
export const SIMULATED_WALLET_CHAIN_ID = 1;
