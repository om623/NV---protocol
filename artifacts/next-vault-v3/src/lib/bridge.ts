// ─── Bridge Configuration ───────────────────────────────────────────────────

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
}

// ─── Supported bridge routes ────────────────────────────────────────────────

const BRIDGE_ROUTES: BridgeRoute[] = [
  {
    id: 'arc-base-usdc',
    fromNetwork: 'arc-testnet',
    toNetwork: 'base',
    token: 'USDC',
    estimatedTime: '~2 min',
    fee: 0,
    status: 'available',
  },
  {
    id: 'base-arc-usdc',
    fromNetwork: 'base',
    toNetwork: 'arc-testnet',
    token: 'USDC',
    estimatedTime: '~2 min',
    fee: 0,
    status: 'available',
  },

  // Preparadas para as próximas integrações
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

// ─── Public API ──────────────────────────────────────────────────────────────

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

export function calculateBridgeFee(
  fromNetwork: string,
  toNetwork: string,
  token: string,
): number | null {
  const route = getBridgeRoute(fromNetwork, toNetwork, token);

  if (!route || route.status !== 'available') {
    return null;
  }

  return route.fee;
}

export function createBridgeTransfer(
  fromNetwork: string,
  toNetwork: string,
  token: string,
  amount: number,
): BridgeTransfer | null {
  const route = getBridgeRoute(fromNetwork, toNetwork, token);

  if (!route || route.status !== 'available') {
    return null;
  }

  return {
    id: `bridge-${Date.now()}`,
    fromNetwork,
    toNetwork,
    token,
    amount,
    fee: route.fee,
    status: 'pending',
    createdAt: Date.now(),
  };
}
