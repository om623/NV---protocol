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

// ─── Supported Bridge routes ──────────────────────────────────────────────────
// BridgeView only shows testnet USDC routes — kept exactly as before.

const BRIDGE_ROUTES: BridgeRoute[] = [
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
