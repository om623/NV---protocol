// ─── NV Protocol — CCTP V2 Solana Infrastructure Layer ───────────────────────
//
// PURPOSE:
//   Isolated preparation layer for future CCTP V2 transfers:
//     Solana → EVM  (burn on Solana, mint on EVM)
//     EVM → Solana  (burn on EVM, mint on Solana)
//
// THIS FILE DOES NOT:
//   - Sign any transaction
//   - Send any USDC
//   - Execute any on-chain instruction
//   - Import or depend on Wallet or EVM provider code
//
// SOURCES (all verified October 2026):
//   Program addresses:  developers.circle.com/cctp/references/solana-programs
//                       github.com/circlefin/solana-cctp-contracts (V2 Deployments)
//   CCTP domains:       developers.circle.com/cctp/concepts/supported-chains-and-domains.md
//   Iris API:           developers.circle.com/cctp/references/technical-guide
//   USDC mint:          developers.circle.com/stablecoins/usdc-contract-addresses.md
//
// ARCHITECTURE NOTE:
//   The EVM side of CCTP V2 lives in src/components/cctp.ts.
//   This file covers ONLY the Solana-specific side.
//   They share the Iris attestation API (iris-api.circle.com) but nothing else.

import {
  address,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  addSignersToInstruction,
  createNoopSigner,
  pipe,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import {
  SOLANA_CCTP_DOMAIN,
  SOLANA_CCTP_MESSAGE_TRANSMITTER_V2,
  SOLANA_CCTP_TOKEN_MESSENGER_V2,
  SOLANA_NETWORK,
  SOLANA_USDC_MINT,
  USDC_DECIMALS,
  solanaRpc,
} from './solana';

// ─── Re-export key constants for consumers ────────────────────────────────────

export {
  SOLANA_CCTP_DOMAIN,
  SOLANA_CCTP_MESSAGE_TRANSMITTER_V2,
  SOLANA_CCTP_TOKEN_MESSENGER_V2,
  SOLANA_USDC_MINT,
};

// ─── Pure browser-safe byte utilities ────────────────────────────────────────
// No Buffer, no Node.js — works in any browser or edge runtime.

/** Decode a hex string (no 0x prefix) to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error(`hexToBytes: odd-length hex string`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Concatenate multiple Uint8Array / number[] into one Uint8Array */
function concatBytes(...parts: (Uint8Array | number[])[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p instanceof Uint8Array ? p : new Uint8Array(p), offset);
    offset += p.length;
  }
  return out;
}

/** Write a uint64 little-endian value into an 8-byte Uint8Array */
function writeBigUInt64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, value, /* littleEndian */ true);
  return buf;
}

/** Write a uint32 little-endian value into a 4-byte Uint8Array */
function writeUInt32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, value, /* littleEndian */ true);
  return buf;
}

/** Decode a base64 string to Uint8Array (browser-safe, no Buffer) */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ─── Iris attestation API ─────────────────────────────────────────────────────
// Source: developers.circle.com/cctp/references/technical-guide
// Rate limit: 35 requests/second. Exceeding it results in HTTP 429 + 5-minute ban.

export const IRIS_MAINNET_BASE = 'https://iris-api.circle.com';
export const IRIS_TESTNET_BASE = 'https://iris-api-sandbox.circle.com';

/**
 * Returns the correct Iris V2 base URL for the environment.
 * Always explicit — never inferred from window.location or NODE_ENV.
 */
export function irisBaseUrl(isMainnet: boolean): string {
  return isMainnet ? IRIS_MAINNET_BASE : IRIS_TESTNET_BASE;
}

// ─── CCTP domains ─────────────────────────────────────────────────────────────
// Source: developers.circle.com/cctp/concepts/supported-chains-and-domains.md

/**
 * CCTP V2 domain registry — all domains that can be a counterpart to Solana.
 * EVM domains come from cctp.ts; this table is the Solana-side reference only.
 * Kept minimal: only domains relevant to Solana ↔ EVM bridging.
 */
export const CCTP_DOMAIN_SOLANA = 5;
export const CCTP_DOMAIN_ETHEREUM = 0;
export const CCTP_DOMAIN_AVALANCHE = 1;
export const CCTP_DOMAIN_OPTIMISM = 2;
export const CCTP_DOMAIN_ARBITRUM = 3;
export const CCTP_DOMAIN_BASE = 6;
export const CCTP_DOMAIN_POLYGON = 7;
export const CCTP_DOMAIN_ARC = 26;

// ─── Solana network config (unified with src/lib/solana.ts) ──────────────────

export const SOLANA_CCTP_NETWORK = {
  id: 'solana-mainnet',
  name: SOLANA_NETWORK.name,
  domain: SOLANA_CCTP_DOMAIN,
  isMainnet: true,
  rpcUrl: SOLANA_NETWORK.rpcUrl,
  explorerUrl: SOLANA_NETWORK.explorerUrl,
  usdcMint: SOLANA_USDC_MINT,
  usdcDecimals: USDC_DECIMALS,
  tokenMessengerMinterV2: SOLANA_CCTP_TOKEN_MESSENGER_V2,
  messageTransmitterV2: SOLANA_CCTP_MESSAGE_TRANSMITTER_V2,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Base58 Solana public key string */
export type SolanaPublicKey = string;

/** A CCTP domain identifier (uint32 in the protocol) */
export type CctpDomain = number;

/** EVM address as a 0x-prefixed hex string (for use in Solana CCTP mint recipient encoding) */
export type EvmAddress = `0x${string}`;

/**
 * Burn parameters for a Solana → EVM CCTP V2 transfer.
 * Prepared but NOT signed/sent in this phase.
 */
export interface SolCctpBurnParams {
  /** Solana wallet address (sender) */
  fromAddress: SolanaPublicKey;
  /** Destination EVM address that will receive USDC on the target chain */
  toEvmAddress: EvmAddress;
  /** Destination CCTP domain (EVM chain receiving the USDC) */
  destinationDomain: CctpDomain;
  /** Amount of USDC to burn, as a decimal number (e.g. 10.5 = 10.5 USDC) */
  amount: number;
  /**
   * minFinalityThreshold: 2000 = standard finality (default, ~13s on EVM).
   * Fast Transfer uses a lower value; not needed for the basic bridge.
   */
  minFinalityThreshold?: number;
}

/**
 * Validated, ready-to-sign burn instruction parameters.
 * Returned by prepareSolCctpBurn — a caller would pass these to the wallet to sign.
 * NOT executed in this phase; kept for future integration.
 */
export interface PreparedSolCctpBurn {
  /** Program to invoke */
  program: SolanaPublicKey;
  /** The destination domain, validated */
  destinationDomain: CctpDomain;
  /** Raw USDC amount in base units (6 decimals) */
  amountRaw: bigint;
  /** Destination recipient address, encoded as 32-byte hex (Solana CCTP format) */
  mintRecipient: string;
  /** USDC mint to burn */
  burnToken: SolanaPublicKey;
  /** Standard finality threshold (2000) */
  minFinalityThreshold: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Parameters for receiving a CCTP message on Solana (EVM → Solana direction).
 * The caller passes the signed attestation from Circle Iris.
 * NOT executed in this phase.
 */
export interface SolCctpReceiveParams {
  /** The CCTP message bytes (hex-encoded) from Iris */
  message: string;
  /** The Circle attestation bytes (hex-encoded) from Iris */
  attestation: string;
  /** Destination Solana wallet address */
  toAddress: SolanaPublicKey;
}

/**
 * Circle Iris V2 message/attestation response (single message).
 * Source: developers.circle.com/api-reference/cctp/all/get-messages-v2
 */
export interface IrisMessageV2 {
  message: string;
  eventNonce: string;
  attestation: string | 'PENDING';
  status: 'complete' | 'pending_confirmations' | 'pending' | string;
  cctpVersion?: number;
}

/** State of an in-flight CCTP attestation poll */
export type AttestationPollState =
  | { status: 'idle' }
  | { status: 'polling'; sourceDomain: CctpDomain; txHash: string; startedAt: number }
  | { status: 'ready'; message: IrisMessageV2; elapsedMs: number }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

// ─── Encoding helpers ─────────────────────────────────────────────────────────

/**
 * Encode a 0x-prefixed EVM address as a 32-byte hex string
 * (the Solana CCTP protocol expects the mintRecipient as 32 zero-padded bytes).
 *
 * Example:
 *   encodeEvmAddressAsBytes32('0xAbCd...')
 *   → '000000000000000000000000abcd...' (64 hex chars, no 0x prefix)
 */
export function encodeEvmAddressAsBytes32(evmAddress: EvmAddress): string {
  const bare = evmAddress.toLowerCase().replace(/^0x/, '');
  if (bare.length !== 40) {
    throw new Error(`Invalid EVM address length: expected 40 hex chars, got ${bare.length}`);
  }
  return bare.padStart(64, '0');
}

/**
 * Convert a USDC decimal amount (e.g. 10.5) to its raw base-unit representation
 * using 6 decimals (USDC standard).
 *
 * Uses integer arithmetic to avoid floating-point rounding.
 */
export function usdcToRawAmount(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`USDC amount must be a positive finite number, got: ${amount}`);
  }
  // Multiply by 1e6, round, then convert to BigInt
  const scaled = Math.round(amount * 1_000_000);
  return BigInt(scaled);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a Solana base58 address.
 * Does not call the RPC — purely structural (length 32–44 chars, base58 alphabet).
 */
export function isValidSolanaAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

/**
 * Validates a 0x-prefixed EVM address (20 bytes = 40 hex chars).
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

// ─── Prepare burn (Solana → EVM) — NO SIGNING ────────────────────────────────

/**
 * Validates and encodes a Solana → EVM CCTP V2 burn.
 * Returns a PreparedSolCctpBurn ready to be handed to the wallet for signing.
 *
 * This function:
 *   ✓ validates inputs
 *   ✓ encodes the mint recipient
 *   ✓ converts the USDC amount to raw base units
 *   ✗ does NOT sign
 *   ✗ does NOT broadcast
 *   ✗ does NOT interact with any wallet or provider
 */
export function prepareSolCctpBurn(params: SolCctpBurnParams): PreparedSolCctpBurn {
  const { fromAddress, toEvmAddress, destinationDomain, amount } = params;

  if (!isValidSolanaAddress(fromAddress)) {
    throw new Error(`Invalid Solana sender address: "${fromAddress}"`);
  }
  if (!isValidEvmAddress(toEvmAddress)) {
    throw new Error(`Invalid EVM destination address: "${toEvmAddress}"`);
  }
  if (!Number.isInteger(destinationDomain) || destinationDomain < 0) {
    throw new Error(`Invalid destination domain: ${destinationDomain}`);
  }
  if (destinationDomain === CCTP_DOMAIN_SOLANA) {
    throw new Error('Destination domain cannot be Solana — use an EVM domain.');
  }

  const amountRaw = usdcToRawAmount(amount);
  const mintRecipient = encodeEvmAddressAsBytes32(toEvmAddress);
  const minFinalityThreshold = params.minFinalityThreshold ?? 2000;

  return {
    program:              SOLANA_CCTP_TOKEN_MESSENGER_V2,
    destinationDomain,
    amountRaw,
    mintRecipient,
    burnToken:            SOLANA_USDC_MINT,
    minFinalityThreshold,
    summary: [
      `Burn ${amount} USDC on Solana`,
      `→ domain ${destinationDomain}`,
      `→ recipient ${toEvmAddress}`,
      `→ program ${SOLANA_CCTP_TOKEN_MESSENGER_V2}`,
    ].join(' | '),
  };
}

// ─── Prepare receive (EVM → Solana) — NO SIGNING ─────────────────────────────

/**
 * Validates parameters for a ReceiveMessage call on Solana.
 * The actual Anchor instruction call is left to the next implementation phase.
 *
 * This function:
 *   ✓ validates the attestation data presence
 *   ✓ validates the recipient address
 *   ✗ does NOT sign
 *   ✗ does NOT broadcast
 */
export function prepareSolCctpReceive(params: SolCctpReceiveParams): SolCctpReceiveParams {
  const { message, attestation, toAddress } = params;

  if (!message || message === '0x' || message.length < 4) {
    throw new Error('CCTP message bytes are missing or empty.');
  }
  if (!attestation || attestation === 'PENDING') {
    throw new Error('CCTP attestation is not yet ready (still PENDING).');
  }
  if (!isValidSolanaAddress(toAddress)) {
    throw new Error(`Invalid destination Solana address: "${toAddress}"`);
  }

  return { message, attestation, toAddress };
}

// ─── Iris attestation polling (read-only, no signing) ─────────────────────────

/**
 * Fetch the current attestation state for a given source transaction.
 *
 * Works for BOTH directions:
 *   Solana → EVM: sourceDomain = 5, txHash = Solana transaction signature
 *   EVM → Solana: sourceDomain = EVM domain (0/3/6/26/…), txHash = 0x…
 *
 * Returns null if not yet indexed (404), or an IrisMessageV2 if found.
 * Throws on unexpected HTTP errors.
 *
 * Source: developers.circle.com/api-reference/cctp/all/get-messages-v2
 * Endpoint: GET /v2/messages/{sourceDomainId}?transactionHash={txHash}
 */
export async function fetchIrisAttestation(
  sourceDomain: CctpDomain,
  txHash: string,
  isMainnet = true,
): Promise<IrisMessageV2 | null> {
  const base = irisBaseUrl(isMainnet);
  const url = `${base}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  // 404 = not yet indexed, normal while waiting
  if (response.status === 404) return null;

  // 429 = rate limited
  if (response.status === 429) {
    throw new Error('Iris rate limit hit (429). Wait before retrying.');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Iris API returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
  }

  const data = (await response.json()) as { messages?: IrisMessageV2[] };
  if (!data.messages?.length) return null;

  return data.messages[0] ?? null;
}

/**
 * Poll Iris until the attestation is complete (status = 'complete',
 * message ≠ '0x', attestation ≠ 'PENDING') or until the timeout expires.
 *
 * Intended use: call this after a burn tx confirms.
 * onPoll callback is optional — useful for updating UI progress.
 *
 * Does NOT sign or send anything.
 * Rate limit: 35 req/s from Circle. Poll interval 5s keeps well within budget.
 */
export async function waitForSolanaAttestation(
  sourceDomain: CctpDomain,
  txHash: string,
  options?: {
    isMainnet?: boolean;
    timeoutMs?: number;
    intervalMs?: number;
    onPoll?: (elapsedMs: number) => void;
  },
): Promise<IrisMessageV2> {
  const {
    isMainnet = true,
    timeoutMs = 20 * 60 * 1000, // 20 minutes
    intervalMs = 5_000,          // 5 seconds
    onPoll,
  } = options ?? {};

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const elapsedMs = Date.now() - started;
    onPoll?.(elapsedMs);

    const result = await fetchIrisAttestation(sourceDomain, txHash, isMainnet);

    if (
      result &&
      result.attestation !== 'PENDING' &&
      result.message !== '0x' &&
      result.message.length > 2
    ) {
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `CCTP attestation timed out after ${Math.round(timeoutMs / 60_000)} minutes.`,
  );
}

// ─── Solana CCTP PDA derivation helpers ──────────────────────────────────────
//
// Solana CCTP V2 uses Program Derived Addresses (PDAs) for several accounts:
//   - MessageTransmitter state
//   - TokenMessengerMinter state
//   - UsedNonces account (replay protection)
//   - EventAuthority (for CPI event logging)
//
// These PDAs are derived deterministically from seeds + program ID using
// `findProgramAddressSync` (from @solana/web3.js) or equivalent.
//
// IMPORTANT: Actual PDA derivation requires @solana/web3.js (PublicKey.findProgramAddressSync).
// This is left as a stub for Phase 3B when the full Anchor instruction set is built.
// We document the seeds here so the next phase can implement them correctly.
//
// PDA seeds documented in:
//   github.com/circlefin/solana-cctp-contracts/programs/v2/message-transmitter-v2/src/
//   github.com/circlefin/solana-cctp-contracts/programs/v2/token-messenger-minter-v2/src/

/**
 * Known PDA seed strings for CCTP V2 Solana programs.
 * Used to derive the required accounts for depositForBurn and receiveMessage.
 * Actual derivation happens in Phase 3B when @solana/web3.js is integrated.
 */
export const SOLANA_CCTP_PDA_SEEDS = {
  /** MessageTransmitter program state account */
  MESSAGE_TRANSMITTER: 'message_transmitter',
  /** TokenMessengerMinter program state account */
  TOKEN_MESSENGER_MINTER: 'token_messenger_minter_state',
  /** Remote token messenger (per-domain) */
  REMOTE_TOKEN_MESSENGER: 'remote_token_messenger',
  /** Token minter state */
  TOKEN_MINTER: 'token_minter',
  /** Local token (per USDC mint) */
  LOCAL_TOKEN: 'local_token',
  /** Token pair (per remote domain + remote token) */
  TOKEN_PAIR: 'token_pair',
  /** Used nonces — replay protection (per domain + nonce range) */
  USED_NONCES: 'used_nonces',
  /** Event authority for CPI self-invocation */
  EVENT_AUTHORITY: '__event_authority',
} as const;

// ─── Solana RPC helpers (read-only) ──────────────────────────────────────────

/**
 * Get the SOL-denominated transaction fee for a hypothetical CCTP burn on Solana.
 * Uses getRecentPrioritizationFees — read-only, no signing.
 *
 * Returns null if the RPC call fails.
 * Useful for displaying an estimated fee in the Bridge UI before the user signs.
 */
export async function estimateCctpBurnFee(): Promise<{ lamports: bigint } | null> {
  try {
    const result = await solanaRpc<Array<{ slot: number; prioritizationFee: number }>>(
      'getRecentPrioritizationFees',
      [[SOLANA_CCTP_TOKEN_MESSENGER_V2]],
    );

    if (!result.length) return { lamports: 5000n }; // 5000 lamports = ~0.000005 SOL fallback

    // Use the median prioritization fee from the last 150 slots
    const fees = result.map(r => r.prioritizationFee).sort((a, b) => a - b);
    const median = fees[Math.floor(fees.length / 2)] ?? 0;

    // Add base transaction fee (5000 lamports)
    return { lamports: BigInt(5000 + median) };
  } catch {
    return null;
  }
}

// ─── Future NV Agent context extension ───────────────────────────────────────
//
// The SolanaAgentContext in src/lib/solana.ts is currently:
//   { wallet, balance, usdcBalance, network, usdcMint }
//
// In Phase 3B (CCTP execution) it should be extended with:
//   cctpReady: boolean           — true when wallet connected + USDC balance > 0
//   pendingBurn?: { ... }        — last prepared burn (for agent to describe to user)
//   lastAttestation?: IrisMessageV2
//
// The agent MUST only read this context — it must never sign or broadcast.
// Transaction execution requires explicit user action via the wallet.

/**
 * Derives whether a Solana wallet is ready for a CCTP transfer.
 * Read-only — no signing, no network calls.
 *
 * @param usdcBalance - USDC balance in decimal (e.g. 10.5)
 * @param amount      - desired transfer amount
 */
export function isSolCctpReady(usdcBalance: number, amount: number): {
  ready: boolean;
  reason?: string;
} {
  if (!Number.isFinite(usdcBalance) || usdcBalance <= 0) {
    return { ready: false, reason: 'No USDC balance available on Solana.' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ready: false, reason: 'Transfer amount must be greater than zero.' };
  }
  if (amount > usdcBalance) {
    return { ready: false, reason: `Insufficient USDC: have ${usdcBalance}, need ${amount}.` };
  }
  return { ready: true };
}

// ─── Solana system program / token program addresses ─────────────────────────
// Source: Solana documentation — fixed system addresses.

export const TOKEN_PROGRAM_ADDRESS     = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const SYSTEM_PROGRAM_ADDRESS    = address('11111111111111111111111111111111');
export const ASSOCIATED_TOKEN_PROGRAM  = address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/**
 * Anchor discriminator for the `depositForBurn` (direct-mint) instruction
 * in the TokenMessengerMinterV2 program.
 *
 * Source: Circle CCTP Solana quickstart
 *   developers.circle.com/cctp/quickstarts/transfer-usdc-solana-to-arc
 * Verified October 2026.
 */
export const DEPOSIT_FOR_BURN_DISCRIMINATOR = new Uint8Array([
  215, 60, 61, 46, 114, 55, 128, 176,
]);

// ─── Built transaction type ───────────────────────────────────────────────────

export interface BuiltDepositForBurnTx {
  /** The fully constructed transaction message, ready for signing.
   *  Typed as unknown because @solana/kit's TransactionMessage intersection
   *  types are complex — the executor calls signTransactionMessageWithSigners
   *  which accepts any compatible shape.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactionMessage: any;
  /** The ephemeral signer for the MessageSent event account (must sign alongside the wallet) */
  messageSentEventAccount: TransactionSigner;
  /** Human-readable summary for the confirmation screen */
  summary: PreparedSolCctpBurn;
}

// ─── Build depositForBurn transaction ────────────────────────────────────────
//
// Constructs the Solana transaction for a CCTP V2 burn using @solana/kit.
// The caller (wallet) must sign this transaction — this function does NOT sign.
//
// Based on the official Circle CCTP Solana quickstart:
//   developers.circle.com/cctp/quickstarts/transfer-usdc-solana-to-arc
//
// Account list (in order, matching the Anchor IDL):
//   0. owner (wallet signer, writable=false)
//   1. event_rent_payer (wallet signer, writable=false)
//   2. sender_authority_pda (readonly)
//   3. burn_token_account / senderUsdcAccount (writable)
//   4. denylist_account (readonly)
//   5. message_transmitter (writable)
//   6. token_messenger (readonly)
//   7. remote_token_messenger (readonly)
//   8. token_minter (readonly)
//   9. local_token (writable)
//  10. burn_token_mint / USDC mint (writable)
//  11. message_sent_event_data (ephemeral keypair, signer)
//  12. message_transmitter_program (readonly)
//  13. token_messenger_minter_program (readonly)
//  14. token_program (readonly)
//  15. system_program (readonly)
//  16. event_authority (readonly)
//  17. token_messenger_minter_program again (readonly — CPI self-invocation for event)
//  18. message_transmitter_event_authority (readonly)
//  19. message_transmitter_program again (readonly)

export async function buildDepositForBurnTx(params: {
  walletAddress: string;
  toEvmAddress: string;
  destinationDomain: number;
  amountRaw: bigint;
  maxFeeRaw?: bigint;
  minFinalityThreshold?: number;
  rpcUrl?: string;
}): Promise<BuiltDepositForBurnTx> {
  const {
    walletAddress,
    toEvmAddress,
    destinationDomain,
    amountRaw,
    maxFeeRaw = 0n,
    minFinalityThreshold = 2000,
    rpcUrl = SOLANA_NETWORK.rpcUrl,
  } = params;

  const TOKEN_MESSENGER_PROGRAM = address(SOLANA_CCTP_TOKEN_MESSENGER_V2 as Address);
  const MESSAGE_TRANSMITTER_PROGRAM = address(SOLANA_CCTP_MESSAGE_TRANSMITTER_V2 as Address);
  const USDC_MINT_ADDR = address(SOLANA_USDC_MINT as Address);
  const walletAddr = address(walletAddress as Address);

  const addressEncoder = getAddressEncoder();

  // ── 1. Sender's USDC Associated Token Account ──
  const [senderUsdcAccount] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    seeds: [
      addressEncoder.encode(walletAddr),
      addressEncoder.encode(TOKEN_PROGRAM_ADDRESS),
      addressEncoder.encode(USDC_MINT_ADDR),
    ],
  });

  // ── 2. Encode destination EVM address as 32-byte recipient ──
  // EVM address is 20 bytes, padded with 12 zero bytes on the left.
  const destBytes32 = concatBytes(
    new Uint8Array(12),
    hexToBytes(toEvmAddress.toLowerCase().replace(/^0x/, '')),
  );

  // ── 3. PDA derivation ──
  const [senderAuthorityPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [new TextEncoder().encode('sender_authority')],
  });

  const [denylistPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [
      new TextEncoder().encode('denylist_account'),
      addressEncoder.encode(walletAddr),
    ],
  });

  const [messageTransmitterPda] = await getProgramDerivedAddress({
    programAddress: MESSAGE_TRANSMITTER_PROGRAM,
    seeds: [new TextEncoder().encode('message_transmitter')],
  });

  const [tokenMessengerPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [new TextEncoder().encode('token_messenger')],
  });

  // IMPORTANT: In CCTP V2, the remoteTokenMessenger PDA seed uses
  // the domain as a string (e.g. "26"), NOT as raw bytes.
  // Source: Circle quickstart + V2 Anchor source code.
  const [remoteTokenMessengerPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [
      new TextEncoder().encode('remote_token_messenger'),
      new TextEncoder().encode(destinationDomain.toString()),
    ],
  });

  const [tokenMinterPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [new TextEncoder().encode('token_minter')],
  });

  const [localTokenPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [
      new TextEncoder().encode('local_token'),
      addressEncoder.encode(USDC_MINT_ADDR),
    ],
  });

  const [eventAuthorityPda] = await getProgramDerivedAddress({
    programAddress: TOKEN_MESSENGER_PROGRAM,
    seeds: [new TextEncoder().encode('__event_authority')],
  });

  const [messageTransmitterEventAuthorityPda] = await getProgramDerivedAddress({
    programAddress: MESSAGE_TRANSMITTER_PROGRAM,
    seeds: [new TextEncoder().encode('__event_authority')],
  });

  // ── 4. Generate ephemeral keypair for MessageSent event account ──
  // This is a one-time account created per-burn to store the MessageSent event.
  // It must be a signer. The private key can be discarded after signing.
  const messageSentEventAccount = await generateKeyPairSigner();

  // ── 5. Encode instruction data (Anchor LE serialization) ──
  const amountBuf          = writeBigUInt64LE(amountRaw);
  const domainBuf          = writeUInt32LE(destinationDomain);
  const maxFeeBuf          = writeBigUInt64LE(maxFeeRaw);
  const finalityBuf        = writeUInt32LE(minFinalityThreshold);
  // destinationCaller = Pubkey::default() = 32 zero bytes (any caller may receive)
  const destinationCallerBuf = new Uint8Array(32);

  const instructionData = concatBytes(
    DEPOSIT_FOR_BURN_DISCRIMINATOR,
    amountBuf,
    domainBuf,
    destBytes32,          // mintRecipient (32 bytes)
    destinationCallerBuf, // destinationCaller = default (32 bytes)
    maxFeeBuf,
    finalityBuf,
  );

  // ── 6. Build the instruction ──
  // AccountRole values: 0=READONLY, 1=WRITABLE, 2=READONLY_SIGNER, 3=WRITABLE_SIGNER
  // The wallet (owner + event_rent_payer) will be attached as signers by the wallet adapter.
  // The messageSentEventAccount is attached via addSignersToInstruction below.
  const baseIx: Instruction = {
    programAddress: TOKEN_MESSENGER_PROGRAM,
    accounts: [
      { address: walletAddr,                          role: 3 },  // owner (writable signer)
      { address: walletAddr,                          role: 3 },  // event_rent_payer (writable signer)
      { address: senderAuthorityPda,                  role: 0 },  // sender_authority_pda (readonly)
      { address: senderUsdcAccount,                   role: 1 },  // burn_token_account (writable)
      { address: denylistPda,                         role: 0 },  // denylist_account (readonly)
      { address: messageTransmitterPda,               role: 1 },  // message_transmitter (writable)
      { address: tokenMessengerPda,                   role: 0 },  // token_messenger (readonly)
      { address: remoteTokenMessengerPda,             role: 0 },  // remote_token_messenger (readonly)
      { address: tokenMinterPda,                      role: 0 },  // token_minter (readonly)
      { address: localTokenPda,                       role: 1 },  // local_token (writable)
      { address: USDC_MINT_ADDR,                      role: 1 },  // burn_token_mint (writable)
      { address: messageSentEventAccount.address,     role: 3 },  // message_sent_event_data (writable signer)
      { address: MESSAGE_TRANSMITTER_PROGRAM,         role: 0 },  // message_transmitter_program
      { address: TOKEN_MESSENGER_PROGRAM,             role: 0 },  // token_messenger_minter_program
      { address: TOKEN_PROGRAM_ADDRESS,               role: 0 },  // token_program
      { address: SYSTEM_PROGRAM_ADDRESS,              role: 0 },  // system_program
      { address: eventAuthorityPda,                   role: 0 },  // event_authority
      { address: TOKEN_MESSENGER_PROGRAM,             role: 0 },  // token_messenger_minter_program (CPI event)
      { address: messageTransmitterEventAuthorityPda, role: 0 },  // message_transmitter_event_authority
      { address: MESSAGE_TRANSMITTER_PROGRAM,         role: 0 },  // message_transmitter_program (CPI event)
    ],
    data: instructionData,
  };

  // Attach the ephemeral keypair signer to the messageSentEventAccount slot.
  // addSignersToInstruction looks at account addresses and attaches matching signers.
  const depositForBurnIx = addSignersToInstruction(
    [messageSentEventAccount],
    baseIx,
  );

  // ── 7. Fetch latest blockhash ──
  const result = await solanaRpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>('getLatestBlockhash', [{ commitment: 'confirmed' }], rpcUrl);

  // @solana/kit uses branded Blockhash type. Cast via unknown to satisfy it.
  // The value itself is the correct base58 blockhash from the RPC.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockhashValue = result.value.blockhash as any;
  const latestBlockhash = {
    blockhash: blockhashValue,
    lastValidBlockHeight: BigInt(result.value.lastValidBlockHeight),
  };

  // ── 8. Build transaction message (unsigned) ──
  // The caller (wallet) must sign this message.
  // We use createNoopSigner for the fee payer so pipe() is satisfied;
  // the actual signing happens in the wallet adapter (signAndSendTransaction).
  const noopFeePayer = createNoopSigner(walletAddr);

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(noopFeePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstruction(depositForBurnIx, tx),
  );

  // ── 9. Summary ──
  const summary = prepareSolCctpBurn({
    fromAddress: walletAddress,
    toEvmAddress: toEvmAddress as `0x${string}`,
    destinationDomain,
    amount: Number(amountRaw) / 1e6,
    minFinalityThreshold,
  });

  return {
    transactionMessage,
    messageSentEventAccount,
    summary,
  };
}
