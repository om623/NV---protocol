// ─── Global indices — real data via Vite dev proxy → Yahoo Finance ────────────
// Uses the /yf-proxy path in vite.config.ts (rewrites → query1.finance.yahoo.com).
// No API key required. Returns the latest regular market price, previous close,
// and % change for each index. Data may be delayed per Yahoo Finance terms.

export interface IndexQuote {
  /** NV-internal symbol e.g. "SPX", "IBOV" */
  symbol: string;
  name: string;
  /** Yahoo Finance ticker e.g. "^GSPC" */
  yfSymbol: string;
  /** Index level */
  price: number;
  /** % change vs previous close; null if unavailable */
  changePercent: number | null;
  prevClose: number | null;
  /** ISO 4217 currency code of the index */
  currency: string;
  /** Exchange/market e.g. "SNP", "PCX" */
  exchange?: string;
  /** ms timestamp from Yahoo */
  dataTimestamp: number;
  /** true = fetched from API this session */
  isLive: boolean;
}

// ─── Index configuration ──────────────────────────────────────────────────────

export interface IndexDef {
  symbol: string;
  name: string;
  yfSymbol: string;
  currency: string;
}

export const INDEX_DEFINITIONS: IndexDef[] = [
  { symbol: 'IBOV',  name: 'Ibovespa',              yfSymbol: '^BVSP',     currency: 'BRL' },
  { symbol: 'SPX',   name: 'S&P 500',               yfSymbol: '^GSPC',     currency: 'USD' },
  { symbol: 'NDX',   name: 'Nasdaq Composite',       yfSymbol: '^IXIC',     currency: 'USD' },
  { symbol: 'DJI',   name: 'Dow Jones',              yfSymbol: '^DJI',      currency: 'USD' },
  { symbol: 'RUT',   name: 'Russell 2000',           yfSymbol: '^RUT',      currency: 'USD' },
  { symbol: 'DAX',   name: 'DAX',                   yfSymbol: '^GDAXI',    currency: 'EUR' },
  { symbol: 'FTSE',  name: 'FTSE 100',              yfSymbol: '^FTSE',     currency: 'GBP' },
  { symbol: 'CAC',   name: 'CAC 40',                yfSymbol: '^FCHI',     currency: 'EUR' },
  { symbol: 'N225',  name: 'Nikkei 225',            yfSymbol: '^N225',     currency: 'JPY' },
  { symbol: 'HSI',   name: 'Hang Seng',             yfSymbol: '^HSI',      currency: 'HKD' },
  { symbol: 'SHCOMP',name: 'Shanghai Composite',    yfSymbol: '000001.SS', currency: 'CNY' },
];

// ─── Yahoo Finance chart API response ─────────────────────────────────────────

interface YFChartResult {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        chartPreviousClose: number;
        currency: string;
        exchangeName: string;
        regularMarketTime?: number;
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}

async function fetchYFIndex(def: IndexDef): Promise<IndexQuote | null> {
  const encoded = encodeURIComponent(def.yfSymbol);
  const url = `/yf-proxy/v8/finance/chart/${encoded}?interval=1d&range=5d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as YFChartResult;
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
    return {
      symbol: def.symbol,
      name: def.name,
      yfSymbol: def.yfSymbol,
      price,
      changePercent,
      prevClose,
      currency: meta.currency ?? def.currency,
      exchange: meta.exchangeName,
      dataTimestamp: (meta.regularMarketTime ?? 0) * 1000 || Date.now(),
      isLive: true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Internal store ───────────────────────────────────────────────────────────

export interface IndexState {
  quotes: Map<string, IndexQuote>;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  fetchedAt: number | null;
  error: string | null;
}

const REFRESH_INTERVAL_MS = 60_000; // 1 minute
let lastFetchAt = 0;
const subscribers: Set<() => void> = new Set();

let _state: IndexState = {
  quotes: new Map(),
  status: 'idle',
  fetchedAt: null,
  error: null,
};

function notify() {
  subscribers.forEach(fn => fn());
}

function setState(patch: Partial<IndexState>) {
  _state = { ..._state, ...patch };
  notify();
}

export function getIndexState(): IndexState {
  return _state;
}

export function subscribeIndices(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Fetch all 11 index quotes in parallel via the Vite proxy.
 * Skips if called within REFRESH_INTERVAL_MS of the last successful fetch.
 */
export async function fetchAllIndices(): Promise<Map<string, IndexQuote>> {
  const now = Date.now();
  if (now - lastFetchAt < REFRESH_INTERVAL_MS && _state.status === 'loaded') {
    return _state.quotes;
  }

  setState({ status: 'loading', error: null });

  const results = await Promise.allSettled(
    INDEX_DEFINITIONS.map(def => fetchYFIndex(def)),
  );

  const quotes = new Map<string, IndexQuote>();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      quotes.set(result.value.symbol, result.value);
    }
  }

  const fetchedAt = Date.now();
  lastFetchAt = fetchedAt;

  if (quotes.size === 0) {
    setState({ status: 'error', error: 'No index data available', fetchedAt });
  } else {
    setState({ quotes, status: 'loaded', fetchedAt, error: null });
  }

  return quotes;
}

// Auto-fetch on load
fetchAllIndices();
if (typeof setInterval !== 'undefined') {
  setInterval(() => fetchAllIndices(), REFRESH_INTERVAL_MS);
}
