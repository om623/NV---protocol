import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── RPC endpoints by chain ID ───────────────────────────────────────────
const CHAIN_RPCS: Record<number, string> = {
  8453: "https://mainnet.base.org",
};

// ─── Request interface (only txHash, walletAddress, productId are trusted) ──
interface VerifyRequest {
  txHash: string;
  walletAddress: string;
  productId: string;
  // All other fields from the client are IGNORED for verification.
  amountUsd?: number;
  tokenSymbol?: string;
  chainId?: number;
  expectedRecipient?: string;
  xpAmount?: number;
  productType?: string;
}

interface RpcResponse {
  result?: string | null;
  error?: { code: number; message: string };
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
  input?: string;
}

interface ServerProduct {
  id: string;
  type: "skin" | "xp";
  priceUsd: number;
  xpAmount: number;
  isActive: boolean;
}

interface PaymentConfig {
  paymentWallet: string;
  minConfirmations: number;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenAddress: string | null;
  chainId: number;
}

// ─── Load server-side config from database (authoritative) ───────────────
async function loadPaymentConfig(supabase: ReturnType<typeof createClient>): Promise<PaymentConfig> {
  const { data, error } = await supabase
    .from("payment_config")
    .select("key, value");

  if (error) throw new Error(`Failed to load payment config: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Payment config table is empty");

  const cfg = new Map<string, string>();
  for (const row of data) {
    cfg.set(row.key, row.value);
  }

  const paymentWallet = cfg.get("payment_wallet");
  if (!paymentWallet) throw new Error("payment_wallet not configured in payment_config table");

  const minConfirmations = parseInt(cfg.get("min_confirmations") ?? "1", 10);
  const tokenSymbol = cfg.get("token_symbol") ?? "USDC";
  const tokenDecimals = parseInt(cfg.get("token_decimals") ?? "6", 10);
  const tokenAddressRaw = cfg.get("token_address") ?? "";
  const tokenAddress = tokenAddressRaw.trim() === "" ? null : tokenAddressRaw.trim();
  const chainId = parseInt(cfg.get("chain_id") ?? "8453", 10);

  return { paymentWallet, minConfirmations, tokenSymbol, tokenDecimals, tokenAddress, chainId };
}

// ─── Load product from database (authoritative) ──────────────────────────
async function loadProduct(
  supabase: ReturnType<typeof createClient>,
  productId: string,
): Promise<ServerProduct> {
  const { data, error } = await supabase
    .from("gamification_products")
    .select("id, product_type, price_usd, xp_amount, is_active")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load product: ${error.message}`);
  if (!data) throw new Error(`Unknown product: ${productId}`);
  if (!data.is_active) throw new Error(`Product is not active: ${productId}`);

  return {
    id: data.id,
    type: data.product_type as "skin" | "xp",
    priceUsd: parseFloat(data.price_usd),
    xpAmount: parseFloat(data.xp_amount),
    isActive: data.is_active as boolean,
  };
}

async function rpc(chainId: number, method: string, params: unknown[]): Promise<unknown | null> {
  const url = CHAIN_RPCS[chainId];
  if (!url) throw new Error(`No RPC configured for chain ${chainId}`);
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

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  try { return BigInt(hex); } catch { return 0n; }
}

const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function decodeErc20Transfer(log: { topics: string[]; data: string; address: string }): {
  from: string; to: string; amount: bigint; tokenContract: string;
} | null {
  if (log.topics[0]?.toLowerCase() !== TRANSFER_SIG) return null;
  if (log.topics.length < 3) return null;
  const from = "0x" + log.topics[1].slice(26);
  const to = "0x" + log.topics[2].slice(26);
  const amount = hexToBigInt(log.data);
  return {
    from: from.toLowerCase(),
    to: to.toLowerCase(),
    amount,
    tokenContract: log.address.toLowerCase(),
  };
}

function expectedAmountBase(priceUsd: number, decimals: number): bigint {
  const priceStr = priceUsd.toString();
  const [whole, frac = ""] = priceStr.split(".");
  const paddedFrac = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + paddedFrac);
}

function failResponse(error: string, status = 400) {
  return new Response(
    JSON.stringify({ verified: false, error, status: "failed" }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── Config endpoint: return non-sensitive payment config to frontend ──
  // The payment wallet address is public on-chain — this endpoint just makes
  // it available to the frontend so it knows where to send the tx. The server
  // uses its OWN copy from the database for verification, not this response.
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("config") === "1") {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const config = await loadPaymentConfig(supabase);
        return new Response(
          JSON.stringify({
            paymentWallet: config.paymentWallet,
            chainId: config.chainId,
            tokenSymbol: config.tokenSymbol,
            tokenDecimals: config.tokenDecimals,
            tokenAddress: config.tokenAddress,
            minConfirmations: config.minConfirmations,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Load server-side config (authoritative) ─────────────────────────
    const config = await loadPaymentConfig(supabase);

    const body = await req.json() as VerifyRequest;
    const { txHash, walletAddress, productId } = body;

    if (!txHash || !walletAddress || !productId) {
      return failResponse("Missing required fields: txHash, walletAddress, productId");
    }

    // ── Lookup product in server-side database catalog ──────────────────
    const product = await loadProduct(supabase, productId);

    const expectedPriceUsd = product.priceUsd;
    const expectedXpAmount = product.xpAmount;
    const expectedProductType = product.type;

    // ── Idempotency: check if this tx_hash was already confirmed ────────
    const { data: existing } = await supabase
      .from("gamification_purchases")
      .select("id, status")
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (existing?.status === "confirmed") {
      return new Response(
        JSON.stringify({ verified: true, alreadyProcessed: true, status: "confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch on-chain transaction receipt ──────────────────────────────
    const receipt = await rpc(config.chainId, "eth_getTransactionReceipt", [txHash]) as TxReceipt | null;
    if (!receipt) {
      return new Response(
        JSON.stringify({ verified: false, error: "Transaction not found on-chain", status: "pending" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Verify transaction status (1 = success, 0 = reverted) ────────
    const txStatus = parseInt(receipt.status, 16);
    if (txStatus === 0) {
      if (existing?.id) {
        await supabase.from("gamification_purchases")
          .update({ status: "failed" }).eq("id", existing.id);
      }
      return failResponse("Transaction reverted on-chain");
    }

    // ── 2. Verify minimum block confirmations ───────────────────────────
    const txBlockNumber = hexToBigInt(receipt.blockNumber);
    if (txBlockNumber > 0n) {
      const currentBlockHex = await rpc(config.chainId, "eth_blockNumber", []) as string;
      const currentBlock = hexToBigInt(currentBlockHex);
      const confirmations = currentBlock - txBlockNumber;
      if (confirmations < BigInt(config.minConfirmations)) {
        return new Response(
          JSON.stringify({
            verified: false,
            error: `Insufficient confirmations: ${confirmations}/${config.minConfirmations}`,
            status: "pending",
            confirmations: Number(confirmations),
            required: config.minConfirmations,
          }),
          { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Fetch the original transaction ──────────────────────────────────
    const tx = await rpc(config.chainId, "eth_getTransactionByHash", [txHash]) as TxData | null;
    if (!tx) {
      return failResponse("Transaction data not found on-chain");
    }

    const buyerLower = walletAddress.toLowerCase();
    const recipientLower = config.paymentWallet.toLowerCase();

    // ── 3. Verify sender (from) ──────────────────────────────────────────
    if (tx.from?.toLowerCase() !== buyerLower) {
      return failResponse(`Sender mismatch: tx.from=${tx.from} expected=${buyerLower}`);
    }

    // ── 4. Compute expected amount in base units ────────────────────────
    const expectedBase = expectedAmountBase(expectedPriceUsd, config.tokenDecimals);

    let paymentVerified = false;

    if (config.tokenAddress === null) {
      // ── Native token transfer ──────────────────────────────────────────
      if (tx.to?.toLowerCase() !== recipientLower) {
        return failResponse(`Recipient mismatch: tx.to=${tx.to} expected=${recipientLower}`);
      }

      const actualAmountBase = hexToBigInt(tx.value);

      if (actualAmountBase !== expectedBase) {
        return failResponse(
          `Amount mismatch: transferred=${actualAmountBase} expected=${expectedBase} (${expectedPriceUsd} USD * 10^${config.tokenDecimals})`,
        );
      }

      paymentVerified = true;
    } else {
      // ── ERC-20 transfer: check Transfer event logs ─────────────────────
      const expectedContractLower = config.tokenAddress.toLowerCase();

      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          const decoded = decodeErc20Transfer(log);
          if (!decoded) continue;

          if (decoded.tokenContract !== expectedContractLower) continue;
          if (decoded.from !== buyerLower) continue;
          if (decoded.to !== recipientLower) continue;
          if (decoded.amount !== expectedBase) {
            return failResponse(
              `Amount mismatch: transferred=${decoded.amount} expected=${expectedBase} (${expectedPriceUsd} USD * 10^${config.tokenDecimals})`,
            );
          }

          paymentVerified = true;
          break;
        }
      }

      if (!paymentVerified) {
        return failResponse("No matching ERC-20 Transfer event to payment wallet with correct token contract and amount");
      }
    }

    // ── Payment fully verified: record purchase + grant entitlement ─────
    const purchaseRow = {
      wallet_address: buyerLower,
      product_id: productId,
      product_type: expectedProductType,
      amount_usd: expectedPriceUsd,
      token_symbol: config.tokenSymbol,
      chain_id: config.chainId,
      tx_hash: txHash,
      block_number: receipt.blockNumber ? BigInt(receipt.blockNumber).toString() : null,
      status: "confirmed" as const,
      confirmed_at: new Date().toISOString(),
      xp_granted: expectedProductType === "xp",
      skin_unlocked: expectedProductType === "skin",
    };

    if (existing?.id) {
      await supabase.from("gamification_purchases")
        .update(purchaseRow).eq("id", existing.id);
    } else {
      await supabase.from("gamification_purchases").insert(purchaseRow);
    }

    const { error: entError } = await supabase
      .from("gamification_entitlements")
      .insert({
        wallet_address: buyerLower,
        product_id: productId,
        product_type: expectedProductType,
        tx_hash: txHash,
        xp_amount: expectedXpAmount,
      });

    if (entError && !entError.message.includes("duplicate")) {
      throw new Error(`Failed to record entitlement: ${entError.message}`);
    }

    return new Response(
      JSON.stringify({
        verified: true,
        status: "confirmed",
        productId,
        productType: expectedProductType,
        xpAmount: expectedXpAmount,
        amountUsd: expectedPriceUsd,
        blockNumber: purchaseRow.block_number,
        confirmations: config.minConfirmations,
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
