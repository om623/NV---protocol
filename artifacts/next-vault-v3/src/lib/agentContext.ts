// ─── NV Agent — Unified Context (Phase 2) ────────────────────────────────────
//
// Defines NVAgentContext: a read-only snapshot of all live data the NV Agent
// can reason about. Assembled from existing data sources already loaded by the
// dashboard — nothing is fetched here.
//
// Rules:
//   • All fields are optional / nullable — the agent must handle absent data.
//   • No wallet transactions, no private keys, no credentials.
//   • No mocked / invented values — absent data is explicitly null / undefined.
//   • Compatible with future CRE integration (Phase 4): this type is the
//     payload that will be serialised into a CRE job context.

import type { MarketAsset, MarketSentiment } from './marketData';
import type { TvlEntry, TvlStatus }           from './tvl';
import type {
  SolanaWalletState,
  SolanaBalanceState,
  SolanaUsdcBalanceState,
} from './solana';
import type { NewsItem }                       from './intelligence';

// ─── Payment snapshot ─────────────────────────────────────────────────────────

export interface AgentPaymentSnapshot {
  /** One of the PurchaseStatus values from payments.ts */
  status: string;
  txHash: string | null;
  error: string | null;
  productId: string | null;
  /** Network name where payments run (Base Mainnet) */
  networkName: string;
  /** Token used for payments (USDC) */
  tokenSymbol: string;
}

// ─── Bridge snapshot ──────────────────────────────────────────────────────────

export interface AgentBridgeSnapshot {
  /** Current bridge step if a flow is active */
  step: string | null;
  /** Solana origin tx hash */
  txHash: string | null;
  /** EVM destination tx hash */
  evmTxHash: string | null;
  /** Error message if any */
  error: string | null;
  /** From-network label */
  fromNetwork: string | null;
  /** To-network label */
  toNetwork: string | null;
}

// ─── Market snapshot ─────────────────────────────────────────────────────────

export interface AgentMarketSnapshot {
  /** All loaded assets (crypto, stablecoins, commodities, indices, fiat) */
  assets: MarketAsset[];
  /** Aggregated market sentiment — null until first fetch */
  sentiment: MarketSentiment | null;
  /** Epoch ms of last successful market data fetch, 0 if never */
  fetchedAt: number;
  /** True if prices came from a live API; false means fallback/simulated */
  isLive: boolean;
}

// ─── TVL snapshot ─────────────────────────────────────────────────────────────

export interface AgentTvlSnapshot {
  /** Per-chain TVL entries sorted by TVL desc */
  entries: TvlEntry[];
  /** Aggregate status across all chains */
  status: TvlStatus;
  /** Epoch ms of last successful TVL fetch, null if never */
  fetchedAt: number | null;
}

// ─── Wallet snapshot ─────────────────────────────────────────────────────────

export interface AgentEvmWalletSnapshot {
  /** Human-readable address (checksummed) or null if not connected */
  address: string | null;
  /** Whether an EVM wallet is currently connected */
  connected: boolean;
  /** Network name (e.g. "Arc Mainnet", "Base", "Ethereum") */
  network: string | null;
  /** USDC balance as a display string (e.g. "12.50") or null */
  usdcBalance: string | null;
}

export interface AgentSolanaWalletSnapshot {
  walletState: SolanaWalletState;
  balanceState: SolanaBalanceState;
  usdcBalanceState: SolanaUsdcBalanceState;
}

// ─── News snapshot ───────────────────────────────────────────────────────────

export interface AgentNewsSnapshot {
  /** Loaded news items (already sorted / deduplicated by intelligence.ts) */
  items: NewsItem[];
  /** Epoch ms of last successful feed fetch, 0 if never */
  fetchedAt: number;
  /** Number of breaking items in the current corpus */
  breakingCount: number;
}

// ─── Master context ───────────────────────────────────────────────────────────

export interface NVAgentContext {
  /** Market data (crypto, commodities, indices, stablecoins, fiat) */
  market: AgentMarketSnapshot | null;
  /** DeFiLlama chain TVL */
  tvl: AgentTvlSnapshot | null;
  /** EVM wallet connected via wagmi / EIP-6963 */
  evmWallet: AgentEvmWalletSnapshot | null;
  /** Solana wallet connected via Wallet Standard */
  solanaWallet: AgentSolanaWalletSnapshot | null;
  /** Active payment state (gamification / USDC purchases) */
  payment: AgentPaymentSnapshot | null;
  /** Active bridge state (EVM↔EVM or Solana→EVM CCTP) */
  bridge: AgentBridgeSnapshot | null;
  /** Active news corpus */
  news: AgentNewsSnapshot | null;
  /** Locale of the current UI session (BCP-47) */
  locale: string;
  /** Epoch ms when this context snapshot was assembled */
  assembledAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal context with only the news corpus wired (Phases 1 base). */
export function buildNewsOnlyContext(
  items: NewsItem[],
  fetchedAt: number,
  locale: string,
): NVAgentContext {
  return {
    market: null,
    tvl: null,
    evmWallet: null,
    solanaWallet: null,
    payment: null,
    bridge: null,
    news: {
      items,
      fetchedAt,
      breakingCount: items.filter(i => i.priority === 'breaking').length,
    },
    locale,
    assembledAt: Date.now(),
  };
}

/**
 * Build a full context from all available data sources.
 * Every parameter is optional — pass only what is already loaded.
 * Missing fields degrade gracefully to null.
 */
export function buildFullContext(opts: {
  items?: NewsItem[];
  newsFetchedAt?: number;
  assets?: MarketAsset[];
  sentiment?: MarketSentiment | null;
  marketFetchedAt?: number;
  marketIsLive?: boolean;
  tvlEntries?: TvlEntry[];
  tvlStatus?: TvlStatus;
  tvlFetchedAt?: number | null;
  solanaWalletState?: SolanaWalletState;
  solanaBalanceState?: SolanaBalanceState;
  solanaUsdcBalanceState?: SolanaUsdcBalanceState;
  evmAddress?: string | null;
  evmNetwork?: string | null;
  evmUsdcBalance?: string | null;
  payment?: AgentPaymentSnapshot | null;
  bridge?: AgentBridgeSnapshot | null;
  locale?: string;
}): NVAgentContext {
  const {
    items = [],
    newsFetchedAt = 0,
    assets,
    sentiment,
    marketFetchedAt = 0,
    marketIsLive = false,
    tvlEntries,
    tvlStatus = 'loading',
    tvlFetchedAt = null,
    solanaWalletState,
    solanaBalanceState,
    solanaUsdcBalanceState,
    evmAddress,
    evmNetwork,
    evmUsdcBalance,
    payment = null,
    bridge = null,
    locale = 'en',
  } = opts;

  return {
    market: assets
      ? {
          assets,
          sentiment: sentiment ?? null,
          fetchedAt: marketFetchedAt,
          isLive: marketIsLive,
        }
      : null,

    tvl: tvlEntries
      ? {
          entries: tvlEntries,
          status: tvlStatus,
          fetchedAt: tvlFetchedAt,
        }
      : null,

    evmWallet:
      evmAddress !== undefined
        ? {
            address: evmAddress ?? null,
            connected: Boolean(evmAddress),
            network: evmNetwork ?? null,
            usdcBalance: evmUsdcBalance ?? null,
          }
        : null,

    solanaWallet:
      solanaWalletState
        ? {
            walletState: solanaWalletState,
            balanceState: solanaBalanceState ?? { status: 'idle' },
            usdcBalanceState: solanaUsdcBalanceState ?? { status: 'idle' },
          }
        : null,

    payment,
    bridge,

    news: {
      items,
      fetchedAt: newsFetchedAt,
      breakingCount: items.filter(i => i.priority === 'breaking').length,
    },

    locale,
    assembledAt: Date.now(),
  };
}
