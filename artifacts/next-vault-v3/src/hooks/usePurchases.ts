import { useState, useCallback, useEffect, useRef } from "react";
import {
  type PurchaseState,
  type PurchaseRecord,
  type EntitlementRecord,
  type LimitStatus,
  type PurchaseStatus,
  executePayment,
  fetchEntitlements,
  fetchPurchases,
  fetchServerPaymentConfig,
  getLimitStatus,
  syncServerTime,
  retryVerification,
} from "../lib/payments";

interface UsePurchasesParams {
  walletAddress: string | null;
  onSkinUnlocked: (skinId: string) => void;
  onXpGranted: (xpAmount: number, txHash: string) => void;
}

export function usePurchases({ walletAddress, onSkinUnlocked, onXpGranted }: UsePurchasesParams) {
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({
    status: "idle",
    txHash: null,
    error: null,
    productId: null,
  });
  const [entitlements, setEntitlements] = useState<EntitlementRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [limits, setLimits] = useState<Record<string, LimitStatus>>({});
  const [syncing, setSyncing] = useState(false);

  // Prevent duplicate in-flight purchases for the same product
  const inflightRef = useRef<Set<string>>(new Set());

  // Sync entitlements + purchases + server time when wallet connects
  const syncAll = useCallback(async (addr: string) => {
    if (!addr) return;
    setSyncing(true);
    try {
      await Promise.all([
        syncServerTime(),
        fetchServerPaymentConfig(),
      ]);
      const [ents, purs] = await Promise.all([
        fetchEntitlements(addr),
        fetchPurchases(addr),
      ]);
      setEntitlements(ents);
      setPurchases(purs);

      // Retry verification for any pending purchases
      const pending = purs.filter((p) => p.status === "pending");
      for (const p of pending) {
        retryVerification(p).then((result) => {
          if (result.verified) {
            // Re-sync to pick up the new entitlement
            fetchEntitlements(addr).then(setEntitlements);
            fetchPurchases(addr).then(setPurchases);
          }
        });
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      syncAll(walletAddress);
    } else {
      setEntitlements([]);
      setPurchases([]);
      setLimits({});
    }
  }, [walletAddress, syncAll]);

  // Check if a skin is owned (from server entitlements)
  const isSkinOwned = useCallback(
    (skinId: string): boolean => {
      if (!walletAddress) return false;
      return entitlements.some(
        (e) => e.product_type === "skin" && e.product_id === skinId,
      );
    },
    [walletAddress, entitlements],
  );

  // Check if an XP purchase tx was already credited
  const isXpTxHashCredited = useCallback(
    (txHash: string): boolean => {
      return entitlements.some(
        (e) => e.product_type === "xp" && e.tx_hash === txHash,
      );
    },
    [entitlements],
  );

  // Get the limit status for a product
  const getLimit = useCallback(
    async (productId: string): Promise<LimitStatus> => {
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }
      const status = await getLimitStatus(walletAddress, productId);
      setLimits((prev) => ({ ...prev, [productId]: status }));
      return status;
    },
    [walletAddress],
  );

  // Execute a real purchase
  const buyProduct = useCallback(
    async (params: {
      provider: unknown;
      productId: string;
      productType: "skin" | "xp";
      amountUsd: number;
      xpAmount?: number;
    }): Promise<{ success: boolean; error: string | null }> => {
      if (!walletAddress) {
        return { success: false, error: "Wallet not connected" };
      }

      // Prevent double-click / multi-tab race
      if (inflightRef.current.has(params.productId)) {
        return { success: false, error: "Purchase already in progress" };
      }
      inflightRef.current.add(params.productId);

      setPurchaseState({
        status: "sending_tx",
        txHash: null,
        error: null,
        productId: params.productId,
      });

      try {
        const result = await executePayment({
          provider: params.provider as Parameters<typeof executePayment>[0]["provider"],
          walletAddress,
          productId: params.productId,
          productType: params.productType,
          amountUsd: params.amountUsd,
          xpAmount: params.xpAmount,
        });

        if (!result.success) {
          setPurchaseState({
            status: "failed",
            txHash: result.txHash,
            error: result.error,
            productId: params.productId,
          });
          return { success: false, error: result.error };
        }

        // Payment verified on-chain
        setPurchaseState({
          status: "confirmed",
          txHash: result.txHash,
          error: null,
          productId: params.productId,
        });

        // Grant the entitlement through the gamification system
        if (params.productType === "skin") {
          onSkinUnlocked(params.productId);
        } else if (params.productType === "xp" && params.xpAmount) {
          onXpGranted(params.xpAmount, result.txHash!);
        }

        // Re-sync to pick up the new server-side records
        await syncAll(walletAddress);

        return { success: true, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPurchaseState({
          status: "failed",
          txHash: null,
          error: msg,
          productId: params.productId,
        });
        return { success: false, error: msg };
      } finally {
        inflightRef.current.delete(params.productId);
        // Reset to idle after a delay so UI can show the result
        setTimeout(() => {
          setPurchaseState((prev) =>
            prev.productId === params.productId
              ? { status: "idle", txHash: null, error: null, productId: null }
              : prev,
          );
        }, 5000);
      }
    },
    [walletAddress, onSkinUnlocked, onXpGranted, syncAll],
  );

  const resetState = useCallback(() => {
    setPurchaseState({ status: "idle", txHash: null, error: null, productId: null });
  }, []);

  return {
    purchaseState,
    entitlements,
    purchases,
    limits,
    syncing,
    isSkinOwned,
    isXpTxHashCredited,
    getLimit,
    buyProduct,
    syncAll,
    resetState,
  };
}

export type UsePurchasesReturn = ReturnType<typeof usePurchases>;
export type { PurchaseStatus };
