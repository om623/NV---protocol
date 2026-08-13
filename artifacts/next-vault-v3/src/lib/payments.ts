// ── Real on-chain payment system for gamification purchases ──────────────
// Sends real USDC/USDT to PAYMENT_WALLET via the connected wallet,
// then verifies the transaction on-chain through the verify-purchase edge function.
// No product is unlocked without server-verified on-chain confirmation.

import { PAYMENT_WALLET } from "./gamification";
import { transferErc20, transferNative, getTokensForNetwork, type Eip1193Provider } from "./arc";
import { DEFAULT_TESTNET } from "../networks";
import { createClient } from "@supabase/supabase-js";

// ── Payment configuration ────────────────────────────────────────────────
// Currently Arc Testnet (chainId 5042002) where USDC is the native gas token.
// To switch to mainnet, change PAYMENT_CHAIN_ID and PAYMENT_RPC_URL.
export const PAYMENT_CHAIN_ID = DEFAULT_TESTNET.chainId; // 5042002
export const PAYMENT_CHAIN_NAME = DEFAULT_TESTNET.name; // "Arc Testnet"
export const PAYMENT_TOKEN_SYMBOL = "USDC";
export const PAYMENT_TOKEN_DECIMALS = DEFAULT_TESTNET.tokens.find(
  (t) => t.symbol === PAYMENT_TOKEN_SYMBOL,
)?.decimals ?? 6;
export const PAYMENT_TOKEN_ADDRESS = DEFAULT_TESTNET.tokens.find(
  (t) => t.symbol === PAYMENT_TOKEN_SYMBOL,
)?.address ?? null;

// ── Supabase client (anon key, no auth) ──────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ── Types ────────────────────────────────────────────────────────────────
export type PurchaseStatus = "idle" | "sending_tx" | "verifying" | "confirmed" | "failed" | "limit_reached";

export interface PurchaseState {
  status: PurchaseStatus;
  txHash: string | null;
  error: string | null;
  productId: string | null;
}

export interface PurchaseRecord {
  id: string;
  wallet_address: string;
  product_id: string;
  product_type: "skin" | "xp";
  amount_usd: number;
  token_symbol: string;
  chain_id: number;
  tx_hash: string;
  status: "pending" | "confirmed" | "failed";
  xp_granted: boolean;
  skin_unlocked: boolean;
  created_at: string;
  confirmed_at: string | null;
}

export interface EntitlementRecord {
  id: string;
  wallet_address: string;
  product_id: string;
  product_type: "skin" | "xp";
  tx_hash: string;
  xp_amount: number;
  created_at: string;
}

// ── Purchase limit definitions ───────────────────────────────────────────
export interface PurchaseLimitConfig {
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
}

export const PURCHASE_LIMITS: Record<string, PurchaseLimitConfig> = {
  "xp-daily": { maxPerDay: 1, maxPerWeek: 5, maxPerMonth: 20 },
  "xp-weekly": { maxPerDay: 1, maxPerWeek: 3, maxPerMonth: 12 },
  "xp-quarterly": { maxPerDay: 1, maxPerWeek: 1, maxPerMonth: 4 },
  "premium-500": { maxPerDay: 1, maxPerWeek: 2, maxPerMonth: 4 },
  "premium-1000": { maxPerDay: 1, maxPerWeek: 1, maxPerMonth: 2 },
};

export interface LimitStatus {
  usedToday: number;
  usedThisWeek: number;
  usedThisMonth: number;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  canBuyNow: boolean;
  nextResetDaily: Date;
  nextResetWeekly: Date;
  nextResetMonthly: Date;
}

// ── Time window helpers ──────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay();
  r.setDate(r.getDate() - day);
  return r;
}

function startOfMonth(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), 1);
  return r;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

// ── Server time (authoritative) ──────────────────────────────────────────
let serverTimeOffset = 0;

export async function syncServerTime(): Promise<void> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-purchase`, {
      method: "OPTIONS",
    });
    const serverDate = res.headers.get("date");
    if (serverDate) {
      serverTimeOffset = new Date(serverDate).getTime() - Date.now();
    }
  } catch {
    // Fall back to local time — server time is only for precision
  }
}

export function getServerTime(): Date {
  return new Date(Date.now() + serverTimeOffset);
}

// ── Purchase limits computation ──────────────────────────────────────────
export async function getLimitStatus(
  walletAddress: string,
  productId: string,
): Promise<LimitStatus> {
  const config = PURCHASE_LIMITS[productId] ?? { maxPerDay: 1, maxPerWeek: 5, maxPerMonth: 20 };
  if (!supabase) {
    return {
      usedToday: 0, usedThisWeek: 0, usedThisMonth: 0,
      maxPerDay: config.maxPerDay, maxPerWeek: config.maxPerWeek, maxPerMonth: config.maxPerMonth,
      canBuyNow: true,
      nextResetDaily: addDays(startOfDay(getServerTime()), 1),
      nextResetWeekly: addDays(startOfWeek(getServerTime()), 7),
      nextResetMonthly: new Date(getServerTime().getFullYear(), getServerTime().getMonth() + 1, 1),
    };
  }

  const now = getServerTime();
  const dayStart = startOfDay(now).toISOString();
  const weekStart = startOfWeek(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  const wallet = walletAddress.toLowerCase();

  const [dayRes, weekRes, monthRes] = await Promise.all([
    supabase
      .from("gamification_purchases")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", wallet)
      .eq("product_id", productId)
      .eq("status", "confirmed")
      .gte("created_at", dayStart),
    supabase
      .from("gamification_purchases")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", wallet)
      .eq("product_id", productId)
      .eq("status", "confirmed")
      .gte("created_at", weekStart),
    supabase
      .from("gamification_purchases")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", wallet)
      .eq("product_id", productId)
      .eq("status", "confirmed")
      .gte("created_at", monthStart),
  ]);

  const usedToday = dayRes.count ?? 0;
  const usedThisWeek = weekRes.count ?? 0;
  const usedThisMonth = monthRes.count ?? 0;

  return {
    usedToday,
    usedThisWeek,
    usedThisMonth,
    maxPerDay: config.maxPerDay,
    maxPerWeek: config.maxPerWeek,
    maxPerMonth: config.maxPerMonth,
    canBuyNow: usedToday < config.maxPerDay && usedThisWeek < config.maxPerWeek && usedThisMonth < config.maxPerMonth,
    nextResetDaily: addDays(startOfDay(now), 1),
    nextResetWeekly: addDays(startOfWeek(now), 7),
    nextResetMonthly: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

// ── Fetch confirmed entitlements for a wallet ────────────────────────────
export async function fetchEntitlements(walletAddress: string): Promise<EntitlementRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gamification_entitlements")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase());
  if (error) {
    console.warn("[payments] Failed to fetch entitlements:", error.message);
    return [];
  }
  return (data ?? []) as EntitlementRecord[];
}

// ── Fetch purchase records for a wallet ──────────────────────────────────
export async function fetchPurchases(walletAddress: string): Promise<PurchaseRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gamification_purchases")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[payments] Failed to fetch purchases:", error.message);
    return [];
  }
  return (data ?? []) as PurchaseRecord[];
}

// ── Core: execute a real on-chain payment + server verification ──────────
export interface ExecutePaymentParams {
  provider: Eip1193Provider;
  walletAddress: string;
  productId: string;
  productType: "skin" | "xp";
  amountUsd: number;
  xpAmount?: number;
}

export interface ExecutePaymentResult {
  success: boolean;
  txHash: string | null;
  verified: boolean;
  error: string | null;
  productId: string;
}

export async function executePayment(params: ExecutePaymentParams): Promise<ExecutePaymentResult> {
  const { provider, walletAddress, productId, productType, amountUsd, xpAmount } = params;

  // Step 1: Send the real on-chain transaction
  let txHash: string;
  try {
    const tokenMap = getTokensForNetwork(DEFAULT_TESTNET);
    const tokenCfg = tokenMap[PAYMENT_TOKEN_SYMBOL];

    if (tokenCfg?.isNative || !tokenCfg?.address) {
      // Native transfer (Arc Testnet: USDC is native gas token, 18 decimals)
      txHash = await transferNative(provider, walletAddress, PAYMENT_WALLET, amountUsd);
    } else {
      // ERC-20 transfer
      txHash = await transferErc20(
        provider,
        walletAddress,
        tokenCfg.address,
        PAYMENT_WALLET,
        amountUsd,
        tokenCfg.decimals,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      txHash: null,
      verified: false,
      error: msg.includes("4001") || msg.includes("User rejected")
        ? "Transaction rejected by wallet"
        : `Failed to send transaction: ${msg}`,
      productId,
    };
  }

  // Step 2: Insert pending purchase record
  if (supabase) {
    await supabase.from("gamification_purchases").insert({
      wallet_address: walletAddress.toLowerCase(),
      product_id: productId,
      product_type: productType,
      amount_usd: amountUsd,
      token_symbol: PAYMENT_TOKEN_SYMBOL,
      chain_id: PAYMENT_CHAIN_ID,
      tx_hash: txHash,
      status: "pending",
    });
  }

  // Step 3: Verify on-chain through the edge function
  const verifyResult = await verifyTransaction({
    txHash,
    walletAddress,
    productId,
    productType,
    amountUsd,
    xpAmount,
  });

  return {
    success: verifyResult.verified,
    txHash,
    verified: verifyResult.verified,
    error: verifyResult.error,
    productId,
  };
}

// ── Verify a transaction through the edge function ───────────────────────
export interface VerifyParams {
  txHash: string;
  walletAddress: string;
  productId: string;
  productType: "skin" | "xp";
  amountUsd: number;
  xpAmount?: number;
}

export interface VerifyResult {
  verified: boolean;
  error: string | null;
  status: string;
}

export async function verifyTransaction(params: VerifyParams): Promise<VerifyResult> {
  if (!supabaseUrl) {
    return { verified: false, error: "Server URL not configured", status: "error" };
  }

  const url = `${supabaseUrl}/functions/v1/verify-purchase`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        txHash: params.txHash,
        walletAddress: params.walletAddress,
        productId: params.productId,
        productType: params.productType,
        amountUsd: params.amountUsd,
        tokenSymbol: PAYMENT_TOKEN_SYMBOL,
        chainId: PAYMENT_CHAIN_ID,
        expectedRecipient: PAYMENT_WALLET,
        xpAmount: params.xpAmount,
      }),
    });

    const data = await res.json() as { verified?: boolean; error?: string; status?: string };

    if (!res.ok && res.status !== 202) {
      return { verified: false, error: data.error ?? `Verification failed (${res.status})`, status: data.status ?? "failed" };
    }

    if (data.verified === true) {
      return { verified: true, error: null, status: "confirmed" };
    }

    // 202 = tx not yet mined, retry pending
    if (res.status === 202) {
      return { verified: false, error: "Transaction pending on-chain", status: "pending" };
    }

    return { verified: false, error: data.error ?? "Verification failed", status: data.status ?? "failed" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { verified: false, error: `Network error: ${msg}`, status: "error" };
  }
}

// ── Retry verification for a pending transaction (e.g. after a refresh) ──
export async function retryVerification(record: PurchaseRecord): Promise<VerifyResult> {
  return verifyTransaction({
    txHash: record.tx_hash,
    walletAddress: record.wallet_address,
    productId: record.product_id,
    productType: record.product_type,
    amountUsd: record.amount_usd,
  });
}
