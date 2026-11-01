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
  /** 5-day daily close prices for mini-chart — empty if unavailable */
  spark: number[];
  source?: string;
  isDelayed?: boolean;
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
  // Global coverage aligned with NV's supported language markets.
  { symbol: 'MERV',  name: 'S&P MERVAL',              yfSymbol: '^MERV',     currency: 'ARS' },
  { symbol: 'MXX',   name: 'S&P/BMV IPC',             yfSymbol: '^MXX',      currency: 'MXN' },
  { symbol: 'KOSPI', name: 'KOSPI',                   yfSymbol: '^KS11',     currency: 'KRW' },
  { symbol: 'NIFTY', name: 'NIFTY 50',                yfSymbol: '^NSEI',     currency: 'INR' },
  { symbol: 'SENSEX',name: 'BSE SENSEX',              yfSymbol: '^BSESN',    currency: 'INR' },
  { symbol: 'TASI',  name: 'Tadawul All Share',       yfSymbol: '^TASI.SR',  currency: 'SAR' },
  { symbol: 'EGX30', name: 'EGX 30',                  yfSymbol: '^CASE30',   currency: 'EGP' },
  { symbol: 'STOXX50',name:'EURO STOXX 50',           yfSymbol: '^STOXX50E', currency: 'EUR' },
  { symbol: 'IBEX',  name: 'IBEX 35',                 yfSymbol: '^IBEX',     currency: 'EUR' },
  { symbol: 'AEX',   name: 'AEX',                     yfSymbol: '^AEX',      currency: 'EUR' },
  { symbol: 'TAIEX', name: 'Taiwan Weighted',         yfSymbol: '^TWII',     currency: 'TWD' },
  { symbol: 'ASX200',name: 'S&P/ASX 200',             yfSymbol: '^AXJO',     currency: 'AUD' },
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
      indicators: {
        quote: Array<{ close: (number | null)[] }>;
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}

interface B3DailyResponse {
  indice?: string;
  fonte?: string;
  serie?: Array<{ data: string; fechamento: number }>;
}
interface B3YearMatrix { results?: Array<Record<string, string | number | null>>; }
function latestExpectedB3SessionDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [year, month, day] = parts.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 1 ? 3 : weekday === 0 ? 2 : weekday === 6 ? 1 : 1));
  return date.toISOString().slice(0, 10);
}
function isFreshB3Close(date: string): boolean { return date >= latestExpectedB3SessionDate(); }
function parsePtBrIndexValue(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
async function fetchB3OfficialIndex(def: IndexDef): Promise<IndexQuote | null> {
  try {
    const res = await fetch(`/b3-official-index/${encodeURIComponent(def.symbol)}`, { signal: AbortSignal.timeout(13000) });
    if (!res.ok) return null;
    const json = await res.json() as B3YearMatrix;
    const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date());
    const series: Array<{ data: string; fechamento: number }> = [];
    for (const row of json.results ?? []) {
      const day = Number(row.day);
      if (!Number.isInteger(day) || day < 1 || day > 31) continue;
      for (let month = 1; month <= 12; month++) {
        const value = parsePtBrIndexValue(row[`rateValue${month}`]);
        if (value == null) continue;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const valid = new Date(`${date}T12:00:00Z`);
        if (valid.getUTCFullYear() !== Number(year) || valid.getUTCMonth() !== month - 1 || valid.getUTCDate() !== day) continue;
        series.push({ data: date, fechamento: value });
      }
    }
    series.sort((a, b) => a.data.localeCompare(b.data));
    if (!series.length) return null;
    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const prevClose = previous?.fechamento ?? null;
    return {
      symbol: def.symbol, name: def.name, yfSymbol: def.yfSymbol, price: latest.fechamento,
      changePercent: prevClose ? ((latest.fechamento - prevClose) / prevClose) * 100 : null,
      prevClose, currency: def.currency,
      dataTimestamp: Date.parse(`${latest.data}T21:00:00-03:00`),
      isLive: isFreshB3Close(latest.data), spark: series.slice(-5).map(point => point.fechamento),
      source: 'B3 — estatísticas de índices (portal oficial)', isDelayed: true,
    };
  } catch { return null; }
}

/**
 * B3 sector indices are not consistently exposed by Yahoo Finance.
 * Dados B3 republishes B3 official daily closing statistics as a small public JSON sample.
 * This is a daily close feed, not an intraday quote; the UI must retain its source/date.
 */
const B3_DAILY_SYMBOLS = new Set(['ICON','IFNC','IMAT','IMOB','INDX','UTIL','IFIX','SMLL']);
async function fetchDadosB3Index(def: IndexDef): Promise<IndexQuote | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`/b3-index-proxy/indices/${encodeURIComponent(def.symbol)}/precos`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json() as B3DailyResponse;
    const series = (json.serie ?? []).filter(p => Number.isFinite(p.fechamento) && p.fechamento > 0).sort((a,b) => a.data.localeCompare(b.data));
    if (!series.length) return null;
    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const price = latest.fechamento;
    const prevClose = previous?.fechamento ?? null;
    const changePercent = prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
    const timestamp = Date.parse(`${latest.data}T21:00:00-03:00`);
    return {
      symbol: def.symbol, name: def.name, yfSymbol: def.yfSymbol, price,
      changePercent, prevClose, currency: def.currency,
      dataTimestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      isLive: isFreshB3Close(latest.data), spark: series.slice(-5).map(p => p.fechamento),
      source: json.fonte ?? 'B3 — estatísticas oficiais (via Dados B3)',
      isDelayed: true,
    };
  } catch {
    return null;
  } finally { clearTimeout(timer); }
}

async function fetchB3DailyIndex(def: IndexDef): Promise<IndexQuote | null> {
  // Probe both independent routes; choose the newest dated close, never the
  // response that merely arrived last.
  const [official, mirror] = await Promise.all([fetchB3OfficialIndex(def), fetchDadosB3Index(def)]);
  if (official && mirror) return official.dataTimestamp >= mirror.dataTimestamp ? official : mirror;
  return official ?? mirror;
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
    // Extract 5-day daily close prices for mini-chart
    const rawCloses = result.indicators?.quote?.[0]?.close ?? [];
    const spark = rawCloses
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .slice(-24); // cap at 24 points
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
      spark,
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
 * Fetch global index quotes; B3 sector indices use B3-sourced daily closes.
 * Skips if called within REFRESH_INTERVAL_MS of the last successful fetch.
 */
export async function fetchAllIndices(): Promise<Map<string, IndexQuote>> {
  const now = Date.now();
  if (now - lastFetchAt < REFRESH_INTERVAL_MS && _state.status === 'loaded') {
    return _state.quotes;
  }

  setState({ status: 'loading', error: null });

  const results = await Promise.allSettled(
    INDEX_DEFINITIONS.map(def => B3_DAILY_SYMBOLS.has(def.symbol) ? fetchB3DailyIndex(def) : fetchYFIndex(def)),
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
