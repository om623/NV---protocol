// ─── NV EVM Wallet Context ────────────────────────────────────────────────────
// Provides read-only EVM wallet state to any component in the tree, without
// prop-drilling from App.tsx.
//
// Rules:
//   • Read-only. Nothing here signs transactions.
//   • Set by App.tsx via NVEvmWalletProvider.
//   • Consumed by NVIntelligence → NVAgentPanel.

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface NVEvmWalletState {
  address: string | null;
  networkName: string | null;
  chainId: number | null;
  /** USDC balance as a display string (e.g. "12.50") or null */
  usdcBalance: string | null;
}

const defaultState: NVEvmWalletState = {
  address: null,
  networkName: null,
  chainId: null,
  usdcBalance: null,
};

interface NVEvmWalletContextValue {
  evmWallet: NVEvmWalletState;
  setEvmWallet: (s: NVEvmWalletState) => void;
}

const NVEvmWalletCtx = createContext<NVEvmWalletContextValue>({
  evmWallet: defaultState,
  setEvmWallet: () => {},
});

export function NVEvmWalletProvider({ children }: { children: ReactNode }) {
  const [evmWallet, _setEvmWallet] = useState<NVEvmWalletState>(defaultState);
  const setEvmWallet = useCallback((s: NVEvmWalletState) => _setEvmWallet(s), []);
  return (
    <NVEvmWalletCtx.Provider value={{ evmWallet, setEvmWallet }}>
      {children}
    </NVEvmWalletCtx.Provider>
  );
}

export function useNVEvmWallet(): NVEvmWalletState {
  return useContext(NVEvmWalletCtx).evmWallet;
}

export function useSetNVEvmWallet(): (s: NVEvmWalletState) => void {
  return useContext(NVEvmWalletCtx).setEvmWallet;
}
