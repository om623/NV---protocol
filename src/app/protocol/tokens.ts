/**
 * ─── NV Protocol — Token constants & helpers ─────────────────────────────────
 * Single source of truth for tokens, mock balances, exchange rates and the
 * initial transaction list. Shared by the ProtocolProvider (logic) and the
 * dashboard render (UI) so there is no duplicated data anywhere.
 */

export interface Transaction {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  time: string;
  status: string;
}

export interface PendingSwap {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
}

export const TOKENS = [
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'EURC', name: 'Euro Coin' },
  { symbol: 'ETH',  name: 'Ethereum' },
];

export const MOCK_BALANCES: Record<string, number> = { USDC: 5420.18, EURC: 3200.50, ETH: 12.48 };

export const EXCHANGE_RATES: Record<string, number> = {
  'USDC-EURC': 0.92, 'USDC-ETH': 0.000311,
  'EURC-USDC': 1.087, 'EURC-ETH': 0.000338,
  'ETH-USDC': 3215.84, 'ETH-EURC': 2960.50,
};

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: '1', fromToken: 'USDC', toToken: 'EURC', fromAmount: 500, toAmount: 460.0, time: '2 min ago', status: 'Success' },
  { id: '2', fromToken: 'EURC', toToken: 'USDC', fromAmount: 200, toAmount: 217.4, time: '1 hr ago', status: 'Success' },
  { id: '3', fromToken: 'USDC', toToken: 'ETH', fromAmount: 1000, toAmount: 0.3112, time: '3 hrs ago', status: 'Success' },
];

export const getRate = (from: string, to: string): number =>
  from === to ? 1.0 : (EXCHANGE_RATES[`${from}-${to}`] || 0);

export const getUsdRate = (token: string): number => (token === 'ETH' ? 3215.84 : 1.0);

export const formatRate = (rate: number): string =>
  rate < 0.01 ? rate.toFixed(6) : rate < 1 ? rate.toFixed(4) : rate.toFixed(2);

