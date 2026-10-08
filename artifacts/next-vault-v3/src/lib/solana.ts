// ─── NV Protocol — Solana Network Configuration ──────────────────────────────
// Solana is a non-EVM chain. It has no EVM chain ID.
// This file is the single source of truth for all Solana-related constants.
//
// Data sources (consulted October 2026):
//   Solana mainnet RPC:    api.mainnet-beta.solana.com (official)
//   USDC on Solana:        developers.circle.com/stablecoins/usdc-contract-addresses.md
//   CCTP V2 Solana domain: developers.circle.com/cctp/concepts/supported-chains-and-domains.md
//   Solana explorer:       solscan.io / explorer.solana.com

// ─── Network identity ────────────────────────────────────────────────────────

export const SOLANA_NETWORK = {
  id: 'solana-mainnet',
  name: 'Solana',
  shortName: 'Solana',
  /** Solana is NOT an EVM chain — no chainId */
  chainId: null as null,
  type: 'mainnet' as const,
  color: 'bg-violet-500',
  icon: 'SOL',
  /** Official Solana mainnet-beta JSON-RPC endpoint */
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  explorerUrl: 'https://solscan.io',
  nativeCurrency: { symbol: 'SOL', decimals: 9 },
  status: 'online' as const,
} as const;

// ─── Token addresses ─────────────────────────────────────────────────────────

/**
 * USDC native mint on Solana mainnet.
 * Source: developers.circle.com/stablecoins/usdc-contract-addresses.md
 */
export const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** Native SOL has no mint — represented as null (sentinel for native asset) */
export const SOLANA_NATIVE_MINT = null;

export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

// ─── CCTP V2 program addresses ────────────────────────────────────────────────
// Source: developers.circle.com/cctp/references/solana-programs
//         github.com/circlefin/solana-cctp-contracts (README V2 Deployments)
// Verified October 2026. These are the V2 programs — NOT the V1 programs.
//
// V1 programs (DO NOT USE for CCTP V2):
//   CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd  — V1 MessageTransmitter
//   CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3  — V1 TokenMessengerMinter

/**
 * CCTP V2 Solana domain ID.
 * Source: developers.circle.com/cctp/concepts/supported-chains-and-domains.md
 */
export const SOLANA_CCTP_DOMAIN = 5;

/**
 * CCTP V2 TokenMessengerMinterV2 program ID on Solana (mainnet and devnet share the same address).
 * Source: developers.circle.com/cctp/references/solana-programs
 *         github.com/circlefin/solana-cctp-contracts — V2 Deployments table
 */
export const SOLANA_CCTP_TOKEN_MESSENGER_V2 = 'CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe';

/**
 * CCTP V2 MessageTransmitterV2 program ID on Solana (mainnet and devnet share the same address).
 * Source: developers.circle.com/cctp/references/solana-programs
 *         github.com/circlefin/solana-cctp-contracts — V2 Deployments table
 */
export const SOLANA_CCTP_MESSAGE_TRANSMITTER_V2 = 'CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A Solana base58 public key string */
export type SolanaAddress = string;

/** Connection state for a Solana wallet */
export type SolanaWalletState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; address: SolanaAddress; walletName: string; walletIcon?: string }
  | { status: 'error'; message: string };

/** Balance state for SOL */
export type SolanaBalanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; lamports: bigint; sol: number; fetchedAt: number }
  | { status: 'error'; message: string };

/**
 * Balance state for USDC (SPL token, 6 decimals).
 * noAccount = wallet exists but has no associated token account for USDC → display 0.
 */
export type SolanaUsdcBalanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; rawAmount: bigint; usdc: number; fetchedAt: number }
  | { status: 'noAccount' }   // wallet has no USDC ATA — balance is 0
  | { status: 'error'; message: string };

/**
 * Snapshot of Solana context — intended for future NV Agent queries.
 * Structure is intentionally read-only; agents must never sign transactions.
 */
export interface SolanaAgentContext {
  /** Current wallet state */
  wallet: SolanaWalletState;
  /** SOL balance */
  balance: SolanaBalanceState;
  /** USDC balance */
  usdcBalance: SolanaUsdcBalanceState;
  /** Solana network being used */
  network: typeof SOLANA_NETWORK;
  /** USDC mint address */
  usdcMint: string;
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

let _rpcId = 1;

/**
 * Make a raw JSON-RPC call to the Solana RPC endpoint.
 * Used for getBalance — keeps the bundle minimal (no extra deps needed).
 */
export async function solanaRpc<T>(
  method: string,
  params: unknown[],
  rpcUrl: string = SOLANA_NETWORK.rpcUrl,
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: _rpcId++, method, params }),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/**
 * Fetch the native SOL balance (in lamports) for a public key.
 * Returns null if the request fails.
 */
export async function fetchSolBalance(address: SolanaAddress): Promise<bigint | null> {
  try {
    const result = await solanaRpc<{ value: number }>(
      'getBalance',
      [address, { commitment: 'confirmed' }],
    );
    return BigInt(result.value);
  } catch {
    return null;
  }
}

/** Convert lamports to SOL (9 decimals) */
export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1e9;
}

/** Format SOL balance for display */
export function formatSol(lamports: bigint): string {
  const sol = lamportsToSol(lamports);
  if (sol === 0) return '0 SOL';
  if (sol < 0.001) return `${sol.toFixed(6)} SOL`;
  if (sol < 1) return `${sol.toFixed(4)} SOL`;
  return `${sol.toLocaleString('en-US', { maximumFractionDigits: 4 })} SOL`;
}

/** Truncate a Solana address for display (first 4 + last 4) */
export function truncateSolAddress(address: SolanaAddress): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ─── USDC (SPL Token) balance ─────────────────────────────────────────────────

/**
 * Fetch the USDC balance for a Solana wallet address.
 *
 * Uses `getTokenAccountsByOwner` with the SPL Token program and the official
 * USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.
 *
 * Returns:
 *   { found: false }           — wallet has no USDC associated token account
 *   { found: true; raw: bigint } — raw token amount (6 decimals)
 *   null                       — RPC error
 *
 * NEVER creates a token account or executes any transaction.
 */
export async function fetchUsdcBalance(
  address: SolanaAddress,
  rpcUrl = SOLANA_NETWORK.rpcUrl,
): Promise<{ found: false } | { found: true; raw: bigint } | null> {
  try {
    // SPL Token Program ID (mainnet, fixed)
    const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

    const result = await solanaRpc<{
      value: Array<{
        account: {
          data: {
            parsed: {
              info: {
                tokenAmount: { amount: string; decimals: number };
              };
            };
          };
        };
      }>;
    }>(
      'getTokenAccountsByOwner',
      [
        address,
        { mint: SOLANA_USDC_MINT },
        {
          encoding: 'jsonParsed',
          commitment: 'confirmed',
          programId: TOKEN_PROGRAM_ID,
        },
      ],
      rpcUrl,
    );

    if (!result.value || result.value.length === 0) {
      // No ATA found — wallet simply has no USDC account; balance is 0
      return { found: false };
    }

    // Sum across all token accounts for this mint (normally just 1)
    let total = BigInt(0);
    for (const acc of result.value) {
      const raw = acc.account.data.parsed.info.tokenAmount.amount;
      total += BigInt(raw);
    }
    return { found: true, raw: total };
  } catch {
    return null; // RPC error
  }
}

/** Convert raw USDC amount (6 decimals) to a human-readable number */
export function rawUsdcToNumber(raw: bigint): number {
  return Number(raw) / 1e6;
}

/** Format a USDC balance for display */
export function formatUsdc(raw: bigint): string {
  const usdc = rawUsdcToNumber(raw);
  if (usdc === 0) return '0.00 USDC';
  if (usdc < 0.01) return `${usdc.toFixed(6)} USDC`;
  return `${usdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}
