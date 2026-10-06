// ─── NV Protocol — Bridge Configuration ──────────────────────────────────────
// This file re-exports CCTP network data from the single source of truth
// (components/cctp.ts) and adds Bridge-specific route definitions.
// Do NOT duplicate CCTP contract addresses here.

import { CCTP_NETWORKS, type CctpNetwork } from '../components/cctp';

export type { CctpNetwork as BridgeNetwork };

export interface BridgeRoute {
  id: string;
  fromNetwork: string;
  toNetwork: string;
  token: string;
  estimatedTime: string;
  fee: number;
  status: 'available' | 'coming-soon';
}

export interface BridgeTransfer {
  id: string;
  fromNetwork: string;
  toNetwork: string;
  token: string;
  amount: number;
  fee: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

// ─── BRIDGE_NETWORKS: derived from the CCTP registry ─────────────────────────
// Expose the same shape as before so cctpBridgeExecutor.ts can import it.

export const BRIDGE_NETWORKS: Record<string, CctpNetwork> = CCTP_NETWORKS;

// ─── Mainnet route pairs ──────────────────────────────────────────────────────
// Each entry [A, B] auto-generates A→B and B→A in BRIDGE_ROUTES below.
// IDs must match the keys in CCTP_NETWORKS (cctp.ts). Do NOT store any
// contract addresses or domains here — cctp.ts is the single source of truth.
//
// Full mesh of all 25 CCTP V2 EVM mainnet chains (October 2026).
// Source: developers.circle.com/cctp/concepts/supported-chains-and-domains.md

const MAINNET_IDS = [
  'arc-mainnet',
  'ethereum',
  'base',
  'arbitrum',
  'optimism',
  'polygon',
  'avalanche',
  'unichain',
  'linea',
  'codex',
  'sonic',
  'world-chain',
  'monad',
  'sei',
  'xdc',
  'hyperevm',
  'ink',
  'plume',
  'edge',
  'injective',
  'morph',
  'pharos',
  'cronos',
  'plasma',
  'xlayer',
] as const;

// Generate every unique unordered pair (i < j) — 300 pairs → 600 bidirectional routes.
const MAINNET_ROUTE_PAIRS: [string, string][] = [];
for (let i = 0; i < MAINNET_IDS.length; i++) {
  for (let j = i + 1; j < MAINNET_IDS.length; j++) {
    MAINNET_ROUTE_PAIRS.push([MAINNET_IDS[i], MAINNET_IDS[j]]);
  }
}

// ─── Supported Bridge routes ──────────────────────────────────────────────────
// Testnet routes (Arc Testnet ↔ Base Sepolia) — preserved as-is.
// Mainnet routes — full mesh of all 25 CCTP V2 EVM mainnet chains.
// All contract addresses come from cctp.ts (single source of truth).
// Cross-environment (mainnet ↔ testnet) routes are intentionally absent —
// assertSameEnvironment() in cctp.ts enforces this at the executor level too.

const BRIDGE_ROUTES: BridgeRoute[] = [

  // ── Testnet ──────────────────────────────────────────────────────────────

  {
    id: 'base-sepolia-arc-usdc',
    fromNetwork: 'base-sepolia',
    toNetwork: 'arc-testnet',
    token: 'USDC',
    estimatedTime: '~2 min',
    fee: 0,
    status: 'available',
  },
  {
    id: 'arc-base-sepolia-usdc',
    fromNetwork: 'arc-testnet',
    toNetwork: 'base-sepolia',
    token: 'USDC',
    estimatedTime: '~2 min',
    fee: 0,
    status: 'available',
  },
  {
    id: 'sepolia-arc-usdc',
    fromNetwork: 'sepolia',
    toNetwork: 'arc-testnet',
    token: 'USDC',
    estimatedTime: '~3 min',
    fee: 0,
    status: 'coming-soon',
  },
  {
    id: 'arc-sepolia-usdc',
    fromNetwork: 'arc-testnet',
    toNetwork: 'sepolia',
    token: 'USDC',
    estimatedTime: '~3 min',
    fee: 0,
    status: 'coming-soon',
  },

  // ── Mainnet ───────────────────────────────────────────────────────────────
  // All mainnet routes are bidirectional. Routes are generated below from
  // MAINNET_ROUTE_PAIRS — each pair [A, B] produces A→B and B→A automatically.
  // Network IDs match cctp.ts exactly. No addresses are stored here.
  // Source: developers.circle.com/cctp/references/contract-addresses.md
  //         developers.circle.com/cctp/concepts/supported-chains-and-domains.md

  ...MAINNET_ROUTE_PAIRS.flatMap(([a, b]) => [
    {
      id: `${a}-${b}-usdc`,
      fromNetwork: a,
      toNetwork: b,
      token: 'USDC',
      estimatedTime: '~2 min',
      fee: 0,
      status: 'available' as const,
    },
    {
      id: `${b}-${a}-usdc`,
      fromNetwork: b,
      toNetwork: a,
      token: 'USDC',
      estimatedTime: '~2 min',
      fee: 0,
      status: 'available' as const,
    },
  ]),
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function getBridgeRoutes(): BridgeRoute[] {
  return BRIDGE_ROUTES;
}

export function getBridgeRoute(
  fromNetwork: string,
  toNetwork: string,
  token: string,
): BridgeRoute | undefined {
  return BRIDGE_ROUTES.find(
    route =>
      route.fromNetwork === fromNetwork &&
      route.toNetwork === toNetwork &&
      route.token === token,
  );
}

export function getBridgeNetwork(networkId: string): CctpNetwork | undefined {
  return BRIDGE_NETWORKS[networkId];
}

export function calculateBridgeFee(
  fromNetwork: string,
  toNetwork: string,
  token: string,
): number | null {
  const route = getBridgeRoute(fromNetwork, toNetwork, token);
  if (!route || route.status !== 'available') return null;
  return route.fee;
}
