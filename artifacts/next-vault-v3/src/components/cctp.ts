// ─── NV Protocol — CCTP V2 On-chain Layer ───────────────────────────────────
// SINGLE SOURCE OF TRUTH for all CCTP V2 network configuration.
//
// DATA SOURCES (consulted October 2026):
//   CCTP V2 EVM contracts:  developers.circle.com/cctp/references/contract-addresses.md
//   CCTP supported domains: developers.circle.com/cctp/concepts/supported-chains-and-domains.md
//   USDC addresses:         developers.circle.com/stablecoins/usdc-contract-addresses.md
//   Arc config:             docs.arc.io/arc/references/connect-to-arc.md
//   Chain IDs:              ethereum-lists/chains + direct RPC calls
//
// NOTES:
//   - BNB Smart Chain (domain 17) excluded: CCTP supports USYC only, not USDC.
//   - Solana (domain 5), Starknet (25), Stellar (27), Noble (4), Sui (8), Aptos (9):
//     non-EVM — not supported by this EVM/viem integration layer.
//   - EDGE (domain 28): uses unique TokenMessengerV2 and MessageTransmitterV2
//     addresses that differ from the shared mainnet addresses.
//
// Attestation endpoints:
//   Testnet:  https://iris-api-sandbox.circle.com/v2/messages/
//   Mainnet:  https://iris-api.circle.com/v2/messages/

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
  avalanche,
  unichain,
  linea,
  codex,
  sonic,
  worldchain,
  monad,
  sei,
  xdc,
  hyperEvm,
  ink,
  plumeMainnet,
  inEVM,
  morph,
  cronos,
  plasma,
  xLayer,
  arc as arcMainnet,
} from 'viem/chains';

// ─── Arc Testnet (custom chain — not exported as `arcTestnet` from viem) ────

export const arcTestnetChain = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    // Native gas token uses 18 decimals (native precision).
    // The ERC-20 USDC interface at 0x3600…0000 uses 6 decimals.
    // Source: docs.arc.io/arc/references/connect-to-arc.md
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' },
  },
});

// ─── EDGE mainnet custom chain ────────────────────────────────────────────────
// Not yet in viem/chains. Chain ID verified via eth_chainId RPC call.
// Source: Alchemy-hosted EDGE chain endpoint.

const edgeMainnetChain = defineChain({
  id: 3343,
  name: 'EDGE',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://edge-mainnet.g.alchemy.com/public'] },
  },
  blockExplorers: {
    default: { name: 'EDGE Explorer', url: 'https://pro.edgex.exchange/en-US/explorer' },
  },
});

// ─── Pharos mainnet custom chain ─────────────────────────────────────────────
// Not yet in viem/chains. Chain ID verified via eth_chainId RPC call: 0x688 = 1672.

const pharosMainnetChain = defineChain({
  id: 1672,
  name: 'Pharos',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.pharosnetwork.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Pharos Explorer', url: 'https://pharos.socialscan.io' },
  },
});

// ─── Attestation API URLs ─────────────────────────────────────────────────────
// Stored explicitly on each network — never inferred from environment or name.

export const IRIS_TESTNET = 'https://iris-api-sandbox.circle.com/v2/messages/';
export const IRIS_MAINNET = 'https://iris-api.circle.com/v2/messages/';

// ─── CCTP V2 Testnet Contracts ───────────────────────────────────────────────
// Source: developers.circle.com/cctp/references/contract-addresses.md
// All testnet chains share the same address.

const TESTNET_TOKEN_MESSENGER_V2  = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address;
const TESTNET_MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address;

// ─── CCTP V2 Mainnet Contracts ───────────────────────────────────────────────
// Source: developers.circle.com/cctp/references/contract-addresses.md
// Most mainnet chains share the same address.
// Exception: EDGE uses its own contracts (see below).

const MAINNET_TOKEN_MESSENGER_V2  = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d' as Address;
const MAINNET_MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64' as Address;

// EDGE uses unique contract addresses (different from shared mainnet addresses).
// Source: developers.circle.com/cctp/references/contract-addresses.md
const EDGE_TOKEN_MESSENGER_V2  = '0x98706A006bc632Df31CAdFCBD43F38887ce2ca5c' as Address;
const EDGE_MESSAGE_TRANSMITTER_V2 = '0x5b61381Fc9e58E70EfC13a4A97516997019198ee' as Address;

// ─── CCTP parameters ─────────────────────────────────────────────────────────

export const CCTP_STANDARD_FINALITY = 2000;
export const CCTP_MAX_FEE = 0n;

// ─── CctpNetwork type ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViemChain = any;

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  /** CCTP domain ID — sourced from developers.circle.com/cctp/concepts/supported-chains-and-domains.md */
  domain: number;
  isMainnet: boolean;
  /** Circle Iris attestation API base URL — explicit, never inferred */
  attestationUrl: string;
  chain: ViemChain;
  rpcUrl: string;
  explorerUrl: string;
  /** Native USDC ERC-20 address. Source: developers.circle.com/stablecoins/usdc-contract-addresses.md */
  usdc: Address;
  usdcDecimals: number;
  /** Source: developers.circle.com/cctp/references/contract-addresses.md */
  tokenMessengerV2: Address;
  messageTransmitterV2: Address;
}

// ─── CCTP Network Registry ────────────────────────────────────────────────────

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {

  // ── TESTNETS ───────────────────────────────────────────────────────────────

  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: 26,
    isMainnet: false,
    attestationUrl: IRIS_TESTNET,
    chain: arcTestnetChain,
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerUrl: 'https://explorer.testnet.arc.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
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

  'arc-mainnet': {
    id: 'arc-mainnet',
    name: 'Arc',
    chainId: 5042,
    domain: 26,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: arcMainnet,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    // Arc USDC ERC-20 sentinel address — 6 decimals for CCTP amounts.
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
    // Native USDC — not USDC.e. Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'avalanche': {
    id: 'avalanche',
    name: 'Avalanche',
    chainId: 43114,
    domain: 1,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: avalanche,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'unichain': {
    id: 'unichain',
    name: 'Unichain',
    chainId: 130,
    domain: 10,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: unichain,
    rpcUrl: 'https://mainnet.unichain.org',
    explorerUrl: 'https://uniscan.xyz',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'linea': {
    id: 'linea',
    name: 'Linea',
    chainId: 59144,
    domain: 11,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: linea,
    rpcUrl: 'https://rpc.linea.build',
    explorerUrl: 'https://lineascan.build',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'codex': {
    id: 'codex',
    name: 'Codex',
    chainId: 81224,
    domain: 12,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: codex,
    rpcUrl: 'https://rpc.codex.xyz',
    explorerUrl: 'https://explorer.codex.xyz',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xd996633a415985DBd7D6D12f4A4343E31f5037cf' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'sonic': {
    id: 'sonic',
    name: 'Sonic',
    chainId: 146,
    domain: 13,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: sonic,
    rpcUrl: 'https://rpc.soniclabs.com',
    explorerUrl: 'https://sonicscan.org',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'world-chain': {
    id: 'world-chain',
    name: 'World Chain',
    chainId: 480,
    domain: 14,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: worldchain,
    rpcUrl: 'https://worldchain-mainnet.g.alchemy.com/public',
    explorerUrl: 'https://worldscan.org',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x79A02482A880bCe3F13E09da970dC34dB4cD24D1' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'monad': {
    id: 'monad',
    name: 'Monad',
    chainId: 143,
    domain: 15,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: monad,
    rpcUrl: 'https://rpc.monad.xyz',
    explorerUrl: 'https://monadscan.com',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'sei': {
    id: 'sei',
    name: 'Sei',
    chainId: 1329,
    domain: 16,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: sei,
    rpcUrl: 'https://evm-rpc.sei-apis.com',
    explorerUrl: 'https://seiscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'xdc': {
    id: 'xdc',
    name: 'XDC Network',
    chainId: 50,
    domain: 18,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: xdc,
    rpcUrl: 'https://erpc.xinfin.network',
    explorerUrl: 'https://xdcscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'hyperevm': {
    id: 'hyperevm',
    name: 'HyperEVM',
    chainId: 999,
    domain: 19,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: hyperEvm,
    rpcUrl: 'https://rpc.hyperliquid.xyz/evm',
    explorerUrl: 'https://hyperevmscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xb88339CB7199b77E23DB6E890353E22632Ba630f' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'ink': {
    id: 'ink',
    name: 'Ink',
    chainId: 57073,
    domain: 21,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: ink,
    rpcUrl: 'https://rpc-gel.inkonchain.com',
    explorerUrl: 'https://explorer.inkonchain.com',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x2D270e6886d130D724215A266106e6832161EAEd' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'plume': {
    id: 'plume',
    name: 'Plume',
    chainId: 98866,
    domain: 22,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: plumeMainnet,
    rpcUrl: 'https://rpc.plume.org',
    explorerUrl: 'https://explorer.plume.org',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x222365EF19F7947e5484218551B56bb3965Aa7aF' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'edge': {
    id: 'edge',
    name: 'EDGE',
    chainId: 3343,
    domain: 28,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: edgeMainnetChain,
    rpcUrl: 'https://edge-mainnet.g.alchemy.com/public',
    explorerUrl: 'https://pro.edgex.exchange/en-US/explorer',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x98d2919b9A214E6Fa5384AC81E6864bA686Ad74c' as Address,
    usdcDecimals: 6,
    // EDGE uses unique contract addresses (not the shared mainnet set).
    // Source: developers.circle.com/cctp/references/contract-addresses.md
    tokenMessengerV2: EDGE_TOKEN_MESSENGER_V2,
    messageTransmitterV2: EDGE_MESSAGE_TRANSMITTER_V2,
  },

  'injective': {
    id: 'injective',
    name: 'Injective (inEVM)',
    chainId: 2525,
    domain: 29,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: inEVM,
    rpcUrl: 'https://mainnet.rpc.inevm.com/http',
    explorerUrl: 'https://inevm.calderaexplorer.xyz',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xa00C59fF5a080D2b954d0c75e46E22a0c371235a' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'morph': {
    id: 'morph',
    name: 'Morph',
    chainId: 2818,
    domain: 30,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: morph,
    rpcUrl: 'https://rpc.morphl2.io',
    explorerUrl: 'https://explorer.morphl2.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'pharos': {
    id: 'pharos',
    name: 'Pharos',
    chainId: 1672,
    domain: 31,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: pharosMainnetChain,
    rpcUrl: 'https://rpc.pharosnetwork.xyz',
    explorerUrl: 'https://pharos.socialscan.io',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'cronos': {
    id: 'cronos',
    name: 'Cronos',
    chainId: 25,
    domain: 32,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: cronos,
    rpcUrl: 'https://evm.cronos.org',
    explorerUrl: 'https://explorer.cronos.org',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x3D7F2C478aAfdB65542BCB44bCeeC05849999d2D' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'plasma': {
    id: 'plasma',
    name: 'Plasma',
    chainId: 9745,
    domain: 33,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: plasma,
    rpcUrl: 'https://rpc.plasma.to',
    explorerUrl: 'https://plasmascan.to',
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0x2d661C89D812261039AF9764eceaAee884f5F67F' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },

  'xlayer': {
    id: 'xlayer',
    name: 'X Layer',
    chainId: 196,
    domain: 37,
    isMainnet: true,
    attestationUrl: IRIS_MAINNET,
    chain: xLayer,
    rpcUrl: 'https://xlayerrpc.okx.com',
    explorerUrl: 'https://www.oklink.com/xlayer',
    // Circle-issued native USDC (not USDC.e bridged).
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
    usdc: '0xB6CEceAB302E2E4948951eE7843FC24E92933061' as Address,
    usdcDecimals: 6,
    tokenMessengerV2: MAINNET_TOKEN_MESSENGER_V2,
    messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER_V2,
  },
};

// ─── Derived sets for UI ──────────────────────────────────────────────────────

export const CCTP_TESTNET_NETWORKS = Object.values(CCTP_NETWORKS).filter(n => !n.isMainnet);
export const CCTP_MAINNET_NETWORKS = Object.values(CCTP_NETWORKS).filter(n => n.isMainnet);

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

// ─── Environment guard ────────────────────────────────────────────────────────
// Prevents cross-environment bridges: testnet→mainnet and mainnet→testnet are both blocked.

export function assertSameEnvironment(fromNetworkId: string, toNetworkId: string): void {
  const source      = getCctpNetwork(fromNetworkId);
  const destination = getCctpNetwork(toNetworkId);
  if (!source || !destination) return;
  if (source.isMainnet !== destination.isMainnet) {
    throw new Error(
      `Cross-environment bridging is not allowed: ` +
      `"${fromNetworkId}" (${source.isMainnet ? 'mainnet' : 'testnet'}) → ` +
      `"${toNetworkId}" (${destination.isMainnet ? 'mainnet' : 'testnet'}).`,
    );
  }
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
  assertSameEnvironment(params.fromNetwork, params.toNetwork);

  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error('Bridge amount must be greater than zero.');
  }

  const decimals          = params.decimals ?? source.usdcDecimals;
  const amount            = parseUnits(params.amount.toString(), decimals);
  const mintRecipient     = addressToBytes32(params.recipient);
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
  if (!source) throw new Error(`Unsupported source network: ${params.fromNetwork}`);

  assertSameEnvironment(params.fromNetwork, params.toNetwork);

  const walletClient = createWalletClient({
    chain: source.chain,
    transport: custom(provider),
  });

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('No connected wallet account.');

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
  if (!network) throw new Error(`Unsupported source network: ${sourceNetwork}`);
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
  if (fromNetwork === toNetwork) throw new Error('Source and destination networks must be different.');

  assertSameEnvironment(fromNetwork, toNetwork);

  const request = prepareCctpBurn({
    fromNetwork,
    toNetwork,
    amount,
    recipient:            walletAddress as Address,
    burnToken:            source.usdc,
    destinationCaller:    undefined,
    maxFee:               CCTP_MAX_FEE,
    minFinalityThreshold: CCTP_STANDARD_FINALITY,
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
  if (!source) throw new Error(`Unknown CCTP source network: ${sourceNetwork}`);

  const url = `${source.attestationUrl}${source.domain}?transactionHash=${transactionHash}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

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
  if (!destination) throw new Error(`Unsupported destination network: ${destinationNetwork}`);

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
