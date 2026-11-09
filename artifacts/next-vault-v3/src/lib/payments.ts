// ── NV Shop: Arc-native, on-chain payments (no Supabase dependency) ──────────
import {
  createPublicClient, createWalletClient, custom, http, parseAbi, parseEventLogs,
  parseUnits, formatUnits, keccak256, toBytes, type Address, type Hash,
} from "viem";
import type { Eip1193Provider } from "./arc";
import { NETWORKS_CONFIG } from "../networks";

const ARC = NETWORKS_CONFIG.find((network) => network.chainId === 5042)!;
const SHOP_ADDRESS = (import.meta.env.VITE_NV_SHOP_ADDRESS ?? "") as Address;
const DEPLOYMENT_BLOCK = BigInt(import.meta.env.VITE_NV_SHOP_DEPLOYMENT_BLOCK ?? "0");
// Official NV receiving wallet, recovered from the original Profile/Shop payment configuration.
// Keep the on-chain immutable treasury and deployment environment aligned with this address.
const OFFICIAL_TREASURY_ADDRESS = "0xAd397122941D03450c70d0076379e079334D434f" as Address;
const TREASURY_ADDRESS = (import.meta.env.VITE_NV_SHOP_TREASURY || OFFICIAL_TREASURY_ADDRESS) as Address;

export const PAYMENT_CHAIN_ID = 5042;
export const PAYMENT_CHAIN_NAME = "Arc";
export const PAYMENT_TOKEN_SYMBOL = "USDC";
export const PAYMENT_TOKEN_DECIMALS = 18;
export const PAYMENT_TOKEN_ADDRESS = null;

const SHOP_ABI = parseAbi([
  "function purchase(bytes32 productId) payable",
  "function treasury() view returns (address)",
  "function products(bytes32 productId) view returns (uint256 price, uint32 xpAmount, uint32 maxPerDay, uint32 maxPerWeek, uint32 maxPer30Days, uint8 productType, bool active)",
  "function ownsSkin(address buyer, bytes32 productId) view returns (bool)",
  "function totalPurchases(address buyer, bytes32 productId) view returns (uint256)",
  "function getPurchaseWindow(address buyer, bytes32 productId) view returns (uint32 dayCount, uint32 weekCount, uint32 thirtyDayCount)",
  "event PurchaseCompleted(address indexed buyer, bytes32 indexed productId, uint8 productType, uint256 amount, uint32 xpAmount, uint256 timestamp)",
]);

const publicClient = createPublicClient({ chain: {
  id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC.rpcUrl] } },
}, transport: http(ARC.rpcUrl) });

const PRODUCT_CONFIG: Record<string, { type: "skin" | "xp"; price: number; xp: number; limits: PurchaseLimitConfig }> = {
  "xp-daily": { type: "xp", price: 0.2, xp: 30, limits: { maxPerDay: 1, maxPerWeek: 5, maxPerMonth: 20 } },
  "xp-weekly": { type: "xp", price: 0.5, xp: 60, limits: { maxPerDay: 1, maxPerWeek: 3, maxPerMonth: 12 } },
  "xp-quarterly": { type: "xp", price: 1, xp: 300, limits: { maxPerDay: 1, maxPerWeek: 1, maxPerMonth: 4 } },
  "premium-500": { type: "skin", price: 10, xp: 0, limits: { maxPerDay: 1, maxPerWeek: 2, maxPerMonth: 4 } },
  "premium-1000": { type: "skin", price: 20, xp: 0, limits: { maxPerDay: 1, maxPerWeek: 1, maxPerMonth: 2 } },
};

function productKey(id: string): `0x${string}` { return keccak256(toBytes(id)); }

export function getServerPaymentWallet(): string | null {
  return TREASURY_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(TREASURY_ADDRESS) ? TREASURY_ADDRESS : null;
}
export function isServerConfigLoaded(): boolean { return Boolean(SHOP_ADDRESS && getServerPaymentWallet()); }

export interface ServerProductInfo { id: string; productType: "skin" | "xp"; priceUsd: number; xpAmount: number; }
export async function fetchServerPaymentConfig(): Promise<void> {
  if (!isServerConfigLoaded()) console.warn("[NV Shop] Configure VITE_NV_SHOP_ADDRESS and VITE_NV_SHOP_TREASURY before enabling purchases.");
}
export async function fetchServerProducts(): Promise<ServerProductInfo[]> {
  return Object.entries(PRODUCT_CONFIG).map(([id, p]) => ({ id, productType: p.type, priceUsd: p.price, xpAmount: p.xp }));
}

export type PurchaseStatus = "idle" | "sending_tx" | "verifying" | "confirmed" | "failed" | "limit_reached";
export interface PurchaseState { status: PurchaseStatus; txHash: string | null; error: string | null; productId: string | null; }
let _currentPaymentState: PurchaseState = { status: "idle", txHash: null, error: null, productId: null };
const _paymentListeners: Array<(s: PurchaseState) => void> = [];
export function getPaymentState(): PurchaseState { return _currentPaymentState; }
export function notifyPaymentState(state: PurchaseState): void {
  _currentPaymentState = state;
  for (const listener of _paymentListeners) { try { listener(state); } catch { /* isolated listener */ } }
}
export function subscribePaymentState(fn: (s: PurchaseState) => void): () => void {
  _paymentListeners.push(fn);
  return () => { const index = _paymentListeners.indexOf(fn); if (index >= 0) _paymentListeners.splice(index, 1); };
}

export interface PurchaseRecord {
  id: string; wallet_address: string; product_id: string; product_type: "skin" | "xp";
  amount_usd: number; token_symbol: string; chain_id: number; tx_hash: string;
  status: "pending" | "confirmed" | "failed"; xp_granted: boolean; skin_unlocked: boolean;
  created_at: string; confirmed_at: string | null;
}
export interface EntitlementRecord {
  id: string; wallet_address: string; product_id: string; product_type: "skin" | "xp";
  tx_hash: string; xp_amount: number; created_at: string;
}
export interface PurchaseLimitConfig { maxPerDay: number; maxPerWeek: number; maxPerMonth: number; }
export const PURCHASE_LIMITS: Record<string, PurchaseLimitConfig> = Object.fromEntries(
  Object.entries(PRODUCT_CONFIG).map(([id, product]) => [id, product.limits]),
);
export interface LimitStatus {
  usedToday: number; usedThisWeek: number; usedThisMonth: number;
  maxPerDay: number; maxPerWeek: number; maxPerMonth: number; canBuyNow: boolean;
  nextResetDaily: Date; nextResetWeekly: Date; nextResetMonthly: Date;
}
let serverTimeOffset = 0;
export async function syncServerTime(): Promise<void> {
  try { const block = await publicClient.getBlock(); serverTimeOffset = Number(block.timestamp) * 1000 - Date.now(); } catch { serverTimeOffset = 0; }
}
export function getServerTime(): Date { return new Date(Date.now() + serverTimeOffset); }

function assertShopConfigured(): void {
  if (!SHOP_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(SHOP_ADDRESS) || !TREASURY_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(TREASURY_ADDRESS) || DEPLOYMENT_BLOCK === 0n) {
    throw new Error("NV Shop ainda não está totalmente configurada (contrato, treasury e bloco de deploy). Nenhum pagamento foi enviado.");
  }
}
function periodKeys(nowSeconds: number) {
  const day = Math.floor(nowSeconds / 86400);
  const week = Math.floor(nowSeconds / 604800);
  const thirtyDay = Math.floor(nowSeconds / 2592000);
  return { day, week, thirtyDay };
}
export async function getLimitStatus(walletAddress: string, productId: string): Promise<LimitStatus> {
  const config = PURCHASE_LIMITS[productId] ?? { maxPerDay: 1, maxPerWeek: 5, maxPerMonth: 20 };
  const now = getServerTime();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  let usedToday = 0, usedThisWeek = 0, usedThisMonth = 0;
  if (SHOP_ADDRESS) {
    const [day, week, thirty] = await publicClient.readContract({
      address: SHOP_ADDRESS, abi: SHOP_ABI, functionName: "getPurchaseWindow",
      args: [walletAddress as Address, productKey(productId)],
    });
    usedToday = Number(day); usedThisWeek = Number(week); usedThisMonth = Number(thirty);
  }
  const keys = periodKeys(nowSeconds);
  return {
    usedToday, usedThisWeek, usedThisMonth,
    maxPerDay: config.maxPerDay, maxPerWeek: config.maxPerWeek, maxPerMonth: config.maxPerMonth,
    canBuyNow: usedToday < config.maxPerDay && usedThisWeek < config.maxPerWeek && usedThisMonth < config.maxPerMonth,
    nextResetDaily: new Date((keys.day + 1) * 86400 * 1000),
    nextResetWeekly: new Date((keys.week + 1) * 604800 * 1000),
    nextResetMonthly: new Date((keys.thirtyDay + 1) * 2592000 * 1000),
  };
}

let cachedLogs: { wallet: string; block: bigint; logs: any[] } | null = null;
async function readPurchaseLogs(walletAddress: string) {
  if (!SHOP_ADDRESS || DEPLOYMENT_BLOCK === 0n) return [];
  const latest = await publicClient.getBlockNumber();
  if (cachedLogs && cachedLogs.wallet === walletAddress.toLowerCase() && cachedLogs.block === latest) return cachedLogs.logs;
  const logs: any[] = [];
  // Public RPC providers impose block-range limits; scan in conservative chunks.
  for (let from = DEPLOYMENT_BLOCK; from <= latest; from += 2000n) {
    const to = from + 1999n > latest ? latest : from + 1999n;
    const batch = await publicClient.getLogs({
      address: SHOP_ADDRESS,
      event: parseAbi(["event PurchaseCompleted(address indexed buyer, bytes32 indexed productId, uint8 productType, uint256 amount, uint32 xpAmount, uint256 timestamp)"])[0],
      args: { buyer: walletAddress as Address },
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...batch);
  }
  cachedLogs = { wallet: walletAddress.toLowerCase(), block: latest, logs };
  return logs;
}
function recordsFromLogs(walletAddress: string, logs: Awaited<ReturnType<typeof readPurchaseLogs>>) {
  return logs.map((log) => {
    const args = (log as any).args;
    const productId = Object.keys(PRODUCT_CONFIG).find((id) => productKey(id).toLowerCase() === String(args.productId).toLowerCase()) ?? "unknown";
    const config = PRODUCT_CONFIG[productId];
    const timestamp = Number(args.timestamp);
    const date = new Date(timestamp * 1000).toISOString();
    const hash = String(log.transactionHash);
    const type: "skin" | "xp" = Number(args.productType) === 0 ? "skin" : "xp";
    return {
      purchase: { id: hash, wallet_address: walletAddress.toLowerCase(), product_id: productId, product_type: type,
        amount_usd: Number(formatUnits(args.amount, 18)), token_symbol: "USDC", chain_id: PAYMENT_CHAIN_ID,
        tx_hash: hash, status: "confirmed" as const, xp_granted: type === "xp", skin_unlocked: type === "skin",
        created_at: date, confirmed_at: date },
      entitlement: { id: hash, wallet_address: walletAddress.toLowerCase(), product_id: productId,
        product_type: type, tx_hash: hash, xp_amount: Number(args.xpAmount), created_at: date },
    };
  }).filter((item) => item.purchase.product_id !== "unknown" && Boolean(item.purchase.tx_hash));
}
export async function fetchEntitlements(walletAddress: string): Promise<EntitlementRecord[]> {
  const logs = await readPurchaseLogs(walletAddress);
  return recordsFromLogs(walletAddress, logs).map((item) => item.entitlement);
}
export async function fetchPurchases(walletAddress: string): Promise<PurchaseRecord[]> {
  const logs = await readPurchaseLogs(walletAddress);
  return recordsFromLogs(walletAddress, logs).map((item) => item.purchase).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface ExecutePaymentParams {
  provider: Eip1193Provider; walletAddress: string; productId: string;
  productType: "skin" | "xp"; amountUsd: number; xpAmount?: number;
}
export interface ExecutePaymentResult { success: boolean; txHash: string | null; verified: boolean; error: string | null; productId: string; }

export async function executePayment(params: ExecutePaymentParams): Promise<ExecutePaymentResult> {
  const { provider, walletAddress, productId, productType, amountUsd, xpAmount } = params;
  try {
    assertShopConfigured();
    const product = PRODUCT_CONFIG[productId];
    if (!product) throw new Error("Produto não reconhecido pelo catálogo NV.");
    if (product.type !== productType || product.price !== amountUsd || (productType === "xp" && product.xp !== xpAmount)) {
      throw new Error("Os dados do produto não correspondem ao catálogo oficial da loja.");
    }
    const chainId = await provider.request({ method: "eth_chainId" });
    const currentChain = typeof chainId === "string" ? Number.parseInt(chainId, 16) : Number(chainId);
    if (currentChain !== PAYMENT_CHAIN_ID) {
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13b2" }] });
      } catch (switchError) {
        if ((switchError as { code?: number })?.code === 4902) {
          await provider.request({ method: "wallet_addEthereumChain", params: [{
            chainId: "0x13b4", chainName: "Arc",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC.rpcUrl], blockExplorerUrls: [ARC.explorerUrl],
          }] });
        } else { throw switchError; }
      }
    }
    const [onChainPrice, onChainXp, onChainDay, onChainWeek, onChain30Days, onChainType, active] = await publicClient.readContract({
      address: SHOP_ADDRESS, abi: SHOP_ABI, functionName: "products", args: [productKey(productId)],
    });
    const configuredTreasury = await publicClient.readContract({ address: SHOP_ADDRESS, abi: SHOP_ABI, functionName: "treasury" });
    if (!active || Number(onChainType) !== (productType === "skin" ? 0 : 1) || onChainPrice !== parseUnits(String(product.price), 18) || Number(onChainXp) !== product.xp || Number(onChainDay) !== product.limits.maxPerDay || Number(onChainWeek) !== product.limits.maxPerWeek || Number(onChain30Days) !== product.limits.maxPerMonth) {
      throw new Error("A configuração on-chain do produto não corresponde ao catálogo esperado. Compra bloqueada.");
    }
    if (configuredTreasury.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
      throw new Error("A carteira treasury configurada não corresponde à carteira imutável do contrato.");
    }
    const walletClient = createWalletClient({ account: walletAddress as Address, chain: {
      id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: [ARC.rpcUrl] } },
    }, transport: custom(provider as any) });
    const hash = await walletClient.writeContract({
      address: SHOP_ADDRESS, abi: SHOP_ABI, functionName: "purchase",
      args: [productKey(productId)], value: parseUnits(String(product.price), 18),
      account: walletAddress as Address,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error("A transação foi revertida na Arc.");
    const decoded = parseEventLogs({ abi: SHOP_ABI, logs: receipt.logs, eventName: "PurchaseCompleted", strict: true });
    const event = decoded.find((entry) =>
      entry.args.buyer.toLowerCase() === walletAddress.toLowerCase() &&
      entry.args.productId.toLowerCase() === productKey(productId).toLowerCase() &&
      entry.args.amount === parseUnits(String(product.price), 18)
    );
    if (!event) throw new Error("A transação foi confirmada, mas não contém o evento de compra esperado. Contate o suporte com o hash.");
    return { success: true, txHash: hash, verified: true, error: null, productId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, txHash: null, verified: false, error: message, productId };
  }
}
export interface VerifyParams { txHash: string; walletAddress: string; productId: string; }
export interface VerifyResult { verified: boolean; error: string | null; status: string; }
export async function verifyTransaction(params: VerifyParams): Promise<VerifyResult> {
  try {
    assertShopConfigured();
    const receipt = await publicClient.getTransactionReceipt({ hash: params.txHash as Hash });
    if (receipt.status !== "success") return { verified: false, error: "Transaction reverted", status: "failed" };
    const events = parseEventLogs({ abi: SHOP_ABI, logs: receipt.logs, eventName: "PurchaseCompleted", strict: true });
    const valid = events.some((event) => event.args.buyer.toLowerCase() === params.walletAddress.toLowerCase()
      && event.args.productId.toLowerCase() === productKey(params.productId).toLowerCase());
    return valid ? { verified: true, error: null, status: "confirmed" } : { verified: false, error: "Purchase event not found", status: "failed" };
  } catch (err) { return { verified: false, error: err instanceof Error ? err.message : String(err), status: "error" }; }
}
export async function retryVerification(record: PurchaseRecord): Promise<VerifyResult> {
  return verifyTransaction({ txHash: record.tx_hash, walletAddress: record.wallet_address, productId: record.product_id });
}
