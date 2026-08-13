import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyRequest {
  txHash: string;
  walletAddress: string;
  productId: string;
  productType: "skin" | "xp";
  amountUsd: number;
  tokenSymbol: string;
  chainId: number;
  expectedRecipient: string;
  xpAmount?: number;
}

interface RpcResponse {
  result?: string | null;
  error?: { code: number; message: string };
}

const CHAIN_RPCS: Record<number, string> = {
  5042002: "https://rpc.testnet.arc.network",
  1: "https://cloudflare-eth.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
};

async function rpc(chainId: number, method: string, params: unknown[]): Promise<unknown | null> {
  const url = CHAIN_RPCS[chainId];
  if (!url) throw new Error(`Unsupported chainId: ${chainId}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json() as RpcResponse;
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result ?? null;
}

interface TxReceipt {
  status: string;
  from: string;
  to: string;
  blockNumber: string;
  transactionHash: string;
  logs?: { topics: string[]; data: string; address: string }[];
}

interface TxData {
  value: string;
  to: string;
  from: string;
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  try { return BigInt(hex); } catch { return 0n; }
}

function decodeErc20Transfer(log: { topics: string[]; data: string; address: string }): { from: string; to: string; amount: bigint } | null {
  const transferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  if (log.topics[0]?.toLowerCase() !== transferSig) return null;
  if (log.topics.length < 3) return null;
  const from = "0x" + log.topics[1].slice(26);
  const to = "0x" + log.topics[2].slice(26);
  const amount = hexToBigInt(log.data);
  return { from: from.toLowerCase(), to: to.toLowerCase(), amount };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as VerifyRequest;
    const {
      txHash, walletAddress, productId, productType,
      amountUsd, tokenSymbol, chainId, expectedRecipient, xpAmount,
    } = body;

    if (!txHash || !walletAddress || !productId || !expectedRecipient) {
      return new Response(
        JSON.stringify({ verified: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Idempotency: check if this tx_hash was already confirmed ────────
    const { data: existing } = await supabase
      .from("gamification_purchases")
      .select("id, status, xp_granted, skin_unlocked")
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (existing?.status === "confirmed") {
      return new Response(
        JSON.stringify({ verified: true, alreadyProcessed: true, status: "confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch on-chain transaction receipt ──────────────────────────────
    const receipt = await rpc(chainId, "eth_getTransactionReceipt", [txHash]) as TxReceipt | null;
    if (!receipt) {
      return new Response(
        JSON.stringify({ verified: false, error: "Transaction not found on-chain", status: "pending" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Check transaction status (1 = success, 0 = reverted) ────────────
    const txStatus = parseInt(receipt.status, 16);
    if (txStatus === 0) {
      await supabase
        .from("gamification_purchases")
        .update({ status: "failed" })
        .eq("tx_hash", txHash);
      return new Response(
        JSON.stringify({ verified: false, error: "Transaction reverted on-chain", status: "failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch the original transaction to get value ─────────────────────
    const tx = await rpc(chainId, "eth_getTransactionByHash", [txHash]) as TxData | null;

    const buyerLower = walletAddress.toLowerCase();
    const recipientLower = expectedRecipient.toLowerCase();
    let paymentVerified = false;

    if (tokenSymbol === "USDC" || tokenSymbol === "USDT") {
      // ── ERC-20 transfer: check Transfer event logs ───────────────────
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          const decoded = decodeErc20Transfer(log);
          if (!decoded) continue;
          if (decoded.from === buyerLower && decoded.to === recipientLower) {
            // For native USDC on Arc (isNative), value is in tx.value
            // For ERC-20, check the log amount matches expected
            paymentVerified = true;
            break;
          }
        }
      }
      // Also check native transfer (Arc Testnet USDC is native gas token)
      if (!paymentVerified && tx) {
        const value = hexToBigInt(tx.value);
        if (value > 0n && tx.to?.toLowerCase() === recipientLower && tx.from?.toLowerCase() === buyerLower) {
          paymentVerified = true;
        }
      }
    } else {
      // Native token transfer
      if (tx) {
        const value = hexToBigInt(tx.value);
        if (value > 0n && tx.to?.toLowerCase() === recipientLower && tx.from?.toLowerCase() === buyerLower) {
          paymentVerified = true;
        }
      }
    }

    if (!paymentVerified) {
      return new Response(
        JSON.stringify({ verified: false, error: "Payment not confirmed: no matching transfer to recipient", status: "failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Payment verified: record purchase + grant entitlement ───────────
    const purchaseRow = {
      wallet_address: buyerLower,
      product_id: productId,
      product_type: productType,
      amount_usd: amountUsd,
      token_symbol: tokenSymbol,
      chain_id: chainId,
      tx_hash: txHash,
      block_number: receipt.blockNumber ? BigInt(receipt.blockNumber).toString() : null,
      status: "confirmed" as const,
      confirmed_at: new Date().toISOString(),
      xp_granted: productType === "xp",
      skin_unlocked: productType === "skin",
    };

    // Upsert purchase (handles race: if row exists as pending, update to confirmed)
    if (existing?.id) {
      await supabase
        .from("gamification_purchases")
        .update(purchaseRow)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("gamification_purchases")
        .insert(purchaseRow);
    }

    // Insert entitlement (unique constraint on wallet+tx_hash prevents duplicates)
    const { error: entError } = await supabase
      .from("gamification_entitlements")
      .insert({
        wallet_address: buyerLower,
        product_id: productId,
        product_type: productType,
        tx_hash: txHash,
        xp_amount: xpAmount ?? 0,
      });

    if (entError && !entError.message.includes("duplicate")) {
      throw new Error(`Failed to record entitlement: ${entError.message}`);
    }

    return new Response(
      JSON.stringify({
        verified: true,
        status: "confirmed",
        productId,
        productType,
        xpAmount: xpAmount ?? 0,
        blockNumber: purchaseRow.block_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ verified: false, error: err.message, status: "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
