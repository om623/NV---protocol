// ─── On-chain Bridge Configuration ──────────────────────────────────────────

export interface BridgeNetwork {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  usdcAddress: string;
  usdcDecimals: number;
}

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

// ─── Networks ───────────────────────────────────────────────────────────────

export const BRIDGE_NETWORKS: Record<string, BridgeNetwork> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    usdcAddress: '',
    usdcDecimals: 6,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
  },

  'sepolia': {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    usdcAddress: '',
    usdcDecimals: 6,
  },
};

// ─── Supported routes ───────────────────────────────────────────────────────

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

export function getBridgeNetwork(
  networkId: string,
): BridgeNetwork | undefined {
  return BRIDGE_NETWORKS[networkId];
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
