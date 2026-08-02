/**
 * ─── NV Protocol — Protocol barrel ───────────────────────────────────────────
 * Central export point for the global state (ProtocolProvider + useProtocol).
 */
export { ProtocolProvider, useProtocol } from './ProtocolProvider';
export type { ProtocolContextValue } from './ProtocolProvider';
export { TOKENS, MOCK_BALANCES, EXCHANGE_RATES, INITIAL_TRANSACTIONS, getRate, getUsdRate, formatRate } from './tokens';
export type { Transaction, PendingSwap } from './tokens';
export {
  PIPELINE_STEPS,
  CONSOLE_SCRIPT,
  BADGES,
  SIM_TOTAL_MS,
  ROI_START_MS,
  ROI_DURATION_MS,
  ROI_TARGET,
  getNextSimId,
  formatDateTime,
  generateReportHtml,
} from './simulation';
export type { SimHistoryItem, RoiPoint } from './simulation';

