/**
 * NV Protocol — Bridge routing facade
 *
 * Keeps the existing Circle CCTP USDC path intact and routes other token pairs
 * through LI.FI. This is an internal execution layer; it does not change the
 * current Bridge UI or Agent wiring.
 */
import type { Eip1193Provider } from './arc';
import { getBridgeRoute } from './bridge';
import { executeBridge as executeCctpBridge } from './cctpBridgeExecutor';
import {
  quoteLifiBridge,
  executeLifiBridge,
  type LifiBridgeQuote,
  type LifiBridgeToken,
} from './lifiBridge';

export interface BridgeRouteRequest {
  provider: Eip1193Provider;
  walletAddress: string;
  fromNetwork: string;
  toNetwork: string;
  fromChainId: number;
  toChainId: number;
  fromToken: LifiBridgeToken;
  toToken: LifiBridgeToken;
  amount: string;
  slippage?: number;
}

export type BridgeRouteQuote =
  | { provider: 'CCTP'; token: 'USDC'; route: { fromNetwork: string; toNetwork: string; token: 'USDC' } }
  | { provider: 'LI.FI'; quote: LifiBridgeQuote };

function isNative(token: LifiBridgeToken): boolean {
  return Boolean(token.isNative) || token.address.toLowerCase() === '0x0000000000000000000000000000000000000000';
}

/** Prefer native Circle CCTP for USDC when that exact route is configured. */
export async function quoteBridgeRoute(request: BridgeRouteRequest): Promise<BridgeRouteQuote> {
  const cctp = !isNative(request.fromToken) &&
    !isNative(request.toToken) &&
    request.fromToken.symbol.toUpperCase() === 'USDC' &&
    request.toToken.symbol.toUpperCase() === 'USDC'
      ? getBridgeRoute(request.fromNetwork, request.toNetwork, 'USDC')
      : undefined;
  if (cctp?.status === 'available') {
    return {
      provider: 'CCTP',
      token: 'USDC',
      route: { fromNetwork: request.fromNetwork, toNetwork: request.toNetwork, token: 'USDC' },
    };
  }
  return { provider: 'LI.FI', quote: await quoteLifiBridge(request) };
}

/** Executes through the chosen route; CCTP behavior remains untouched. */
export async function executeBridgeRoute(
  request: BridgeRouteRequest,
  quote?: BridgeRouteQuote,
  onStatus?: (status: string) => void,
): Promise<
  | { provider: 'CCTP'; success: boolean; sourceTxHash?: string; destinationTxHash?: string; error?: string }
  | { provider: 'LI.FI'; success: boolean; sourceTxHash: string; destinationTxHash?: string; status: string; error?: string }
> {
  const selected = quote ?? await quoteBridgeRoute(request);
  if (selected.provider === 'CCTP') {
    const result = await executeCctpBridge({
      provider: request.provider,
      fromNetwork: request.fromNetwork,
      toNetwork: request.toNetwork,
      walletAddress: request.walletAddress,
      amount: Number(request.amount),
    });
    return {
      provider: 'CCTP',
      success: result.success,
      sourceTxHash: result.burnTxHash,
      destinationTxHash: result.mintTxHash,
      error: result.error,
    };
  }
  const result = await executeLifiBridge(request, selected.quote, onStatus);
  return {
    provider: 'LI.FI',
    success: result.status === 'DONE',
    sourceTxHash: result.sourceTxHash,
    destinationTxHash: result.destinationTxHash,
    status: result.status,
  };
}
