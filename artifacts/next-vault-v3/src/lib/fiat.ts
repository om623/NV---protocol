// ─── Fiat exchange rates — open.er-api.com (free, CORS-enabled, no key) ───────
// Provides daily reference rates for 20 currencies vs USD.
// Data is updated once per day — clearly identified as a daily reference rate,
// not an intraday or real-time quote.

export interface FiatRate {
  /** ISO 4217 currency code */
  symbol: string;
  name: string;
  /** Rate: 1 USD = X <symbol> */
  ratePerUsd: number;
  /** Inverse: 1 <symbol> = X USD */
  usdPerUnit: number;
  /** ISO date string of the rate e.g. "2026-10-09" */
  rateDate: string;
  /** "daily-reference" — always the same for this provider */
  rateType: 'daily-reference';
  /** ms timestamp of when this data was fetched */
  fetchedAt: number;
}

export interface FiatRateState {
  rates: Map<string, FiatRate>;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  rateDate: string | null;
  fetchedAt: number | null;
  error: string | null;
}

// ─── Currency metadata ────────────────────────────────────────────────────────

export const FIAT_CURRENCIES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  BRL: 'Brazilian Real',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CHF: 'Swiss Franc',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',
  CNY: 'Chinese Yuan',
  HKD: 'Hong Kong Dollar',
  SGD: 'Singapore Dollar',
  MXN: 'Mexican Peso',
  ARS: 'Argentine Peso',
  CLP: 'Chilean Peso',
  COP: 'Colombian Peso',
  INR: 'Indian Rupee',
  KRW: 'South Korean Won',
  TRY: 'Turkish Lira',
  ZAR: 'South African Rand',
};

// ─── API response shape ────────────────────────────────────────────────────────

interface OpenErApiResponse {
  result: 'success' | 'error';
  base_code: string;
  time_last_update_utc?: string;
  rates: Record<string, number>;
}

// ─── Internal store ───────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 3_600_000; // refresh at most once per hour
let lastFetchAt = 0;
const subscribers: Set<() => void> = new Set();

let _state: FiatRateState = {
  rates: new Map(),
  status: 'idle',
  rateDate: null,
  fetchedAt: null,
  error: null,
};

function notify() {
  subscribers.forEach(fn => fn());
}

function setState(patch: Partial<FiatRateState>) {
  _state = { ..._state, ...patch };
  notify();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getFiatState(): FiatRateState {
  return _state;
}

export function subscribeFiat(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Fetch daily reference rates from open.er-api.com.
 * Returns early if called within REFRESH_INTERVAL_MS of the last successful fetch.
 */
export async function fetchFiatRates(): Promise<void> {
  const now = Date.now();
  if (now - lastFetchAt < REFRESH_INTERVAL_MS && _state.status === 'loaded') return;

  setState({ status: 'loading', error: null });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as OpenErApiResponse;
    if (json.result !== 'success') throw new Error('API returned non-success');

    const rates = json.rates;
    // Extract the date from the UTC string e.g. "Fri, 09 Oct 2026 00:00:01 +0000"
    const rateDate = json.time_last_update_utc
      ? new Date(json.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const rateMap = new Map<string, FiatRate>();
    const fetchedAt = Date.now();

    // USD is always 1:1
    rateMap.set('USD', {
      symbol: 'USD',
      name: FIAT_CURRENCIES.USD,
      ratePerUsd: 1,
      usdPerUnit: 1,
      rateDate,
      rateType: 'daily-reference',
      fetchedAt,
    });

    for (const [sym, ratePerUsd] of Object.entries(rates)) {
      if (!(sym in FIAT_CURRENCIES)) continue;
      if (!Number.isFinite(ratePerUsd) || ratePerUsd <= 0) continue;
      rateMap.set(sym, {
        symbol: sym,
        name: FIAT_CURRENCIES[sym],
        ratePerUsd,
        usdPerUnit: 1 / ratePerUsd,
        rateDate,
        rateType: 'daily-reference',
        fetchedAt,
      });
    }

    lastFetchAt = fetchedAt;
    setState({ rates: rateMap, status: 'loaded', rateDate, fetchedAt, error: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    setState({ status: 'error', error: msg });
  } finally {
    clearTimeout(timer);
  }
}

// Auto-fetch on load and every hour
fetchFiatRates();
if (typeof setInterval !== 'undefined') {
  setInterval(() => fetchFiatRates(), REFRESH_INTERVAL_MS);
}
