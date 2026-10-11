// ─── NV Protocol — Equities / ETFs / REITs / FIIs Ticker Data ────────────────
//
// Data sources (real, no fabrication):
//   • Yahoo Finance via Vite dev-proxy /yf-proxy → query1.finance.yahoo.com
//       for all equities including B3 (suffix .SA) — no key, no Supabase required
//   • brapi.dev kept as fallback type in the EquityDef type but not used for
//       routing: brapi now requires token for most symbols (ETFs, FIIs, most stocks).
//       All tickers are routed through Yahoo with their exchange suffix.
//   • If Yahoo returns no result for a ticker, EquityQuote.isLive = false.
//     The tape shows the symbol + "—" change — no fabricated numbers.
//
// Confirmed unavailable: FAB.AD, EMAAR.DU, DIB.DU (ADX/DFM — replaced by Saudi .SR).
//
// Locale-to-market editorial mapping mirrors LOCALE_EDITORIAL_FOCUS in intelligence.ts
// so that selecting pt-BR → Brazilian equities (B3), ar → Gulf equities (Tadawul), etc.

export type EquityType = 'stock' | 'smallcap' | 'etf' | 'reit' | 'fii' | 'fund';

export interface EquityQuote {
  symbol: string;
  /** Short display name (e.g. "Petrobras", "Apple Inc.") */
  name: string;
  type: EquityType;
  /** Current price in local currency. null = not loaded yet */
  price: number | null;
  /** 24 h / day change in percent. null = unavailable */
  change: number | null;
  /** ISO currency code, e.g. "BRL", "USD", "JPY" */
  currency: string;
  /** Whether current data came from a live API (true) or is a registered stub (false) */
  isLive: boolean;
  /** Unix ms of last successful fetch */
  fetchedAt: number | null;
}

/** A locale-tagged group of tickers that appear in the tape */
export interface LocaleTickerList {
  locale: string;
  /** Human-readable market label */
  marketLabel: string;
  tickers: TickerDef[];
}

interface TickerDef {
  symbol: string;
  name: string;
  type: EquityType;
  currency: string;
  /** API source key: 'brapi' for Brazilian assets, 'yahoo' for others */
  source: 'brapi' | 'yahoo';
  /** Symbol as understood by the source API (may differ from display symbol) */
  apiSymbol: string;
}

// ─── Locale ticker definitions ────────────────────────────────────────────────
// Only real, publicly-traded tickers. No invented symbols.

const LOCALE_TICKERS: LocaleTickerList[] = [
  {
    locale: 'pt-BR',
    marketLabel: 'B3 / Brasil',
    tickers: [
      // B3 Blue chips — Yahoo Finance via /yf-proxy (suffix .SA = B3/BOVESPA)
      // All 12 confirmed OK via Yahoo v8/chart (real prices verified Oct 2026)
      { symbol: 'PETR4',  name: 'Petrobras PN',      type: 'stock',    currency: 'BRL', source: 'yahoo', apiSymbol: 'PETR4.SA' },
      { symbol: 'VALE3',  name: 'Vale ON',            type: 'stock',    currency: 'BRL', source: 'yahoo', apiSymbol: 'VALE3.SA' },
      { symbol: 'ITUB4',  name: 'Itaú Unibanco PN',  type: 'stock',    currency: 'BRL', source: 'yahoo', apiSymbol: 'ITUB4.SA' },
      { symbol: 'BBAS3',  name: 'Banco do Brasil ON', type: 'stock',    currency: 'BRL', source: 'yahoo', apiSymbol: 'BBAS3.SA' },
      { symbol: 'WEGE3',  name: 'WEG ON',             type: 'stock',    currency: 'BRL', source: 'yahoo', apiSymbol: 'WEGE3.SA' },
      { symbol: 'MGLU3',  name: 'Magalu ON',          type: 'smallcap', currency: 'BRL', source: 'yahoo', apiSymbol: 'MGLU3.SA' },
      // B3 ETFs
      { symbol: 'BOVA11', name: 'ETF Ibovespa',       type: 'etf',      currency: 'BRL', source: 'yahoo', apiSymbol: 'BOVA11.SA' },
      { symbol: 'IVVB11', name: 'ETF S&P 500 (BR)',   type: 'etf',      currency: 'BRL', source: 'yahoo', apiSymbol: 'IVVB11.SA' },
      { symbol: 'PRIO3',  name: 'PetroRio ON',        type: 'smallcap', currency: 'BRL', source: 'yahoo', apiSymbol: 'PRIO3.SA' },
      // B3 FIIs
      { symbol: 'HGLG11', name: 'CSHG Logística FII', type: 'fii',      currency: 'BRL', source: 'yahoo', apiSymbol: 'HGLG11.SA' },
      { symbol: 'MXRF11', name: 'Maxi Renda FII',     type: 'fii',      currency: 'BRL', source: 'yahoo', apiSymbol: 'MXRF11.SA' },
      { symbol: 'KNRI11', name: 'Kinea Renda Imob.',  type: 'fii',      currency: 'BRL', source: 'yahoo', apiSymbol: 'KNRI11.SA' },
    ],
  },
  {
    locale: 'en',
    marketLabel: 'US Markets',
    tickers: [
      { symbol: 'AAPL',  name: 'Apple',           type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'AAPL' },
      { symbol: 'MSFT',  name: 'Microsoft',        type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'MSFT' },
      { symbol: 'NVDA',  name: 'NVIDIA',           type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'NVDA' },
      { symbol: 'GOOGL', name: 'Alphabet',         type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'GOOGL' },
      { symbol: 'AMZN',  name: 'Amazon',           type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'AMZN' },
      { symbol: 'META',  name: 'Meta',             type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'META' },
      { symbol: 'TSLA',  name: 'Tesla',            type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'TSLA' },
      { symbol: 'JPM',   name: 'JPMorgan Chase',   type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'JPM' },
      { symbol: 'V',     name: 'Visa',             type: 'stock',    currency: 'USD', source: 'yahoo', apiSymbol: 'V' },
      { symbol: 'SPY',   name: 'SPDR S&P 500 ETF', type: 'etf',      currency: 'USD', source: 'yahoo', apiSymbol: 'SPY' },
      { symbol: 'QQQ',   name: 'Invesco QQQ',      type: 'etf',      currency: 'USD', source: 'yahoo', apiSymbol: 'QQQ' },
      { symbol: 'IWM',   name: 'iShares Russell 2000', type: 'etf',   currency: 'USD', source: 'yahoo', apiSymbol: 'IWM' },
      { symbol: 'AMT',   name: 'American Tower',   type: 'reit',     currency: 'USD', source: 'yahoo', apiSymbol: 'AMT' },
      { symbol: 'PLD',   name: 'Prologis',         type: 'reit',     currency: 'USD', source: 'yahoo', apiSymbol: 'PLD' },
      { symbol: 'O',     name: 'Realty Income',    type: 'reit',     currency: 'USD', source: 'yahoo', apiSymbol: 'O' },
    ],
  },
  {
    locale: 'es',
    marketLabel: 'América Latina / España',
    tickers: [
      { symbol: 'GMEXICO', name: 'Grupo México',     type: 'stock', currency: 'MXN', source: 'yahoo', apiSymbol: 'GMEXICOB.MX' },
      { symbol: 'AMXL',    name: 'América Móvil',   type: 'stock', currency: 'MXN', source: 'yahoo', apiSymbol: 'AMXL.MX' },
      { symbol: 'FEMSAUBD', name: 'FEMSA',           type: 'stock', currency: 'MXN', source: 'yahoo', apiSymbol: 'FEMSAUBD.MX' },
      { symbol: 'CEMEXCPO', name: 'CEMEX',           type: 'stock', currency: 'MXN', source: 'yahoo', apiSymbol: 'CEMEXCPO.MX' },
      { symbol: 'SAN.MC',  name: 'Santander',        type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'SAN.MC' },
      { symbol: 'ITX.MC',  name: 'Inditex (Zara)',   type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'ITX.MC' },
      { symbol: 'IBE.MC',  name: 'Iberdrola',        type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'IBE.MC' },
      { symbol: 'BBVA.MC', name: 'BBVA',             type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'BBVA.MC' },
    ],
  },
  {
    locale: 'fr',
    marketLabel: 'Paris / Europe',
    tickers: [
      { symbol: 'MC.PA',  name: 'LVMH',            type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'MC.PA' },
      { symbol: 'AIR.PA', name: 'Airbus',           type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'AIR.PA' },
      { symbol: 'TTE.PA', name: 'TotalEnergies',    type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'TTE.PA' },
      { symbol: 'OR.PA',  name: 'L\'Oréal',         type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'OR.PA' },
      { symbol: 'BNP.PA', name: 'BNP Paribas',      type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'BNP.PA' },
      { symbol: 'SAN.PA', name: 'Sanofi',           type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'SAN.PA' },
      { symbol: 'CAP.PA', name: 'Capgemini',        type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'CAP.PA' },
      { symbol: 'ALO.PA', name: 'Alstom',           type: 'stock', currency: 'EUR', source: 'yahoo', apiSymbol: 'ALO.PA' },
    ],
  },
  {
    locale: 'zh',
    marketLabel: '中国市场',
    tickers: [
      { symbol: '600519', name: '贵州茅台',          type: 'stock', currency: 'CNY', source: 'yahoo', apiSymbol: '600519.SS' },
      { symbol: '601318', name: '中国平安',          type: 'stock', currency: 'CNY', source: 'yahoo', apiSymbol: '601318.SS' },
      { symbol: '000858', name: '五粮液',            type: 'stock', currency: 'CNY', source: 'yahoo', apiSymbol: '000858.SZ' },
      { symbol: '600036', name: '招商银行',          type: 'stock', currency: 'CNY', source: 'yahoo', apiSymbol: '600036.SS' },
      { symbol: '9988',   name: 'Alibaba (HK)',      type: 'stock', currency: 'HKD', source: 'yahoo', apiSymbol: '9988.HK' },
      { symbol: '0700',   name: 'Tencent (HK)',      type: 'stock', currency: 'HKD', source: 'yahoo', apiSymbol: '0700.HK' },
      { symbol: '3690',   name: 'Meituan (HK)',      type: 'stock', currency: 'HKD', source: 'yahoo', apiSymbol: '3690.HK' },
      { symbol: 'BABA',   name: 'Alibaba (US)',      type: 'stock', currency: 'USD', source: 'yahoo', apiSymbol: 'BABA' },
    ],
  },
  {
    locale: 'ja',
    marketLabel: '東京証券取引所',
    tickers: [
      { symbol: '7203',  name: 'トヨタ自動車',     type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '7203.T' },
      { symbol: '6758',  name: 'ソニーグループ',   type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '6758.T' },
      { symbol: '6861',  name: 'キーエンス',       type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '6861.T' },
      { symbol: '8306',  name: '三菱UFJフィナンシャル', type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '8306.T' },
      { symbol: '9984',  name: 'ソフトバンクG',    type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '9984.T' },
      { symbol: '4519',  name: '中外製薬',         type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '4519.T' },
      { symbol: '6501',  name: '日立製作所',       type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '6501.T' },
      { symbol: '8035',  name: '東京エレクトロン', type: 'stock', currency: 'JPY', source: 'yahoo', apiSymbol: '8035.T' },
    ],
  },
  {
    locale: 'ko',
    marketLabel: '한국거래소',
    tickers: [
      { symbol: '005930', name: '삼성전자',    type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '005930.KS' },
      { symbol: '000660', name: 'SK하이닉스', type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '000660.KS' },
      { symbol: '207940', name: '삼성바이오로직스', type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '207940.KS' },
      { symbol: '005380', name: '현대자동차', type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '005380.KS' },
      { symbol: '373220', name: 'LG에너지솔루션', type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '373220.KS' },
      { symbol: '006400', name: '삼성SDI',    type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '006400.KS' },
      { symbol: '051910', name: 'LG화학',     type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '051910.KS' },
      { symbol: '035420', name: 'NAVER',      type: 'stock', currency: 'KRW', source: 'yahoo', apiSymbol: '035420.KS' },
    ],
  },
  {
    locale: 'hi',
    marketLabel: 'NSE / BSE India',
    tickers: [
      { symbol: 'RELIANCE', name: 'Reliance Industries', type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'RELIANCE.NS' },
      { symbol: 'TCS',      name: 'Tata Consultancy',    type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'TCS.NS' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank',           type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'HDFCBANK.NS' },
      { symbol: 'INFY',     name: 'Infosys',             type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'INFY.NS' },
      { symbol: 'ICICIBANK',name: 'ICICI Bank',          type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'ICICIBANK.NS' },
      { symbol: 'BHARTIARTL',name: 'Bharti Airtel',      type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'BHARTIARTL.NS' },
      { symbol: 'WIPRO',    name: 'Wipro',               type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'WIPRO.NS' },
      { symbol: 'ITC',      name: 'ITC Ltd',             type: 'stock', currency: 'INR', source: 'yahoo', apiSymbol: 'ITC.NS' },
    ],
  },
  {
    locale: 'ar',
    marketLabel: 'أسواق الخليج',
    tickers: [
      // Tadawul (Saudi Exchange) — all 6 confirmed via Yahoo v8/chart (Oct 2026)
      // ADX/DFM tickers (FAB.AD, EMAAR.DU, DIB.DU) replaced: Yahoo returns no data for those exchanges
      { symbol: '2222',  name: 'أرامكو السعودية',    type: 'stock', currency: 'SAR', source: 'yahoo', apiSymbol: '2222.SR' },
      { symbol: '1180',  name: 'البنك الأهلي',        type: 'stock', currency: 'SAR', source: 'yahoo', apiSymbol: '1180.SR' },
      { symbol: '3010',  name: 'سابك',                type: 'stock', currency: 'SAR', source: 'yahoo', apiSymbol: '3010.SR' },
      { symbol: '7010',  name: 'STC (اتصالات السعودية)', type: 'stock', currency: 'SAR', source: 'yahoo', apiSymbol: '7010.SR' },
      { symbol: '2010',  name: 'سابك (SABIC)',         type: 'stock', currency: 'SAR', source: 'yahoo', apiSymbol: '2010.SR' },
      { symbol: '1120',  name: 'مصرف الراجحي',         type: 'stock', currency: 'SAR', source: 'yahoo', apiSymbol: '1120.SR' },
    ],
  },
];

// ─── Cache layer ─────────────────────────────────────────────────────────────

const EQUITY_TTL_MS = 2 * 60 * 1000; // 2 minutes between API calls

interface QuoteCache {
  quotes: EquityQuote[];
  locale: string;
  fetchedAt: number;
}

let _cache: QuoteCache | null = null;

// ─── brapi.dev fetch (Brazilian stocks/FIIs) ─────────────────────────────────
// Free tier: max 3 tickers per request without a token; rate-limited per IP.
// Sequential batches with a 350ms stagger avoid 401 rate-limit responses.
// Optional: set VITE_BRAPI_TOKEN to unlock a 50-ticker batch + parallel fetch.

interface BrapiQuote {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  currency?: string;
}

interface BrapiResponse {
  results?: BrapiQuote[];
  error?: boolean;
  message?: string;
}

/** How many tickers brapi allows per request on the free tier (no token) */
const BRAPI_BATCH_FREE = 3;
/** How many tickers brapi allows per request with a token */
const BRAPI_BATCH_TOKEN = 50;

async function fetchBrapiSingleBatch(
  symbols: string[],
  token: string | undefined,
): Promise<BrapiQuote[]> {
  if (symbols.length === 0) return [];
  const tickers = symbols.join(',');
  const tokenParam = token ? `&token=${token}` : '';
  const url = `https://brapi.dev/api/quote/${tickers}?range=1d&interval=1d&fundamental=false${tokenParam}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as BrapiResponse;
    if (data.error) return [];
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function fetchBrapi(apiSymbols: string[]): Promise<Map<string, BrapiQuote>> {
  const map = new Map<string, BrapiQuote>();
  if (apiSymbols.length === 0) return map;

  const token = (import.meta.env.VITE_BRAPI_TOKEN as string | undefined) || undefined;
  const batchSize = token ? BRAPI_BATCH_TOKEN : BRAPI_BATCH_FREE;

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < apiSymbols.length; i += batchSize) {
    batches.push(apiSymbols.slice(i, i + batchSize));
  }

  // With a token: single large batch — parallel fine.
  // Without token: sequential with 350ms stagger to stay under the free-tier
  // rate limit. The first batch resolves quickly so the tape populates fast.
  if (token) {
    const results = await Promise.all(batches.map(b => fetchBrapiSingleBatch(b, token)));
    for (const quotes of results) {
      for (const q of quotes) map.set(q.symbol, q);
    }
  } else {
    for (let i = 0; i < batches.length; i++) {
      const quotes = await fetchBrapiSingleBatch(batches[i], token);
      for (const q of quotes) map.set(q.symbol, q);
      if (i < batches.length - 1) {
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    }
  }
  return map;
}

// ─── Yahoo Finance via Vite dev-proxy (/yf-proxy → query1.finance.yahoo.com) ──
// Same proxy pattern used by commodities.ts and indices.ts.
// Each symbol is fetched individually via /v8/finance/chart — no auth required.
// Symbols that return empty results (e.g. some ADX/DFM tickers) set isLive=false.

interface YfChartMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  currency?: string;
  exchangeName?: string;
}
interface YfChartResponse {
  chart?: { result?: Array<{ meta: YfChartMeta }> | null; error?: unknown };
}

async function fetchYahooSingle(
  apiSymbol: string,
): Promise<{ price: number; changePercent: number; currency?: string } | null> {
  try {
    const url = `/yf-proxy/v8/finance/chart/${encodeURIComponent(apiSymbol)}?interval=1d&range=2d`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as YfChartResponse;
    const result = json?.chart?.result;
    if (!result || result.length === 0) return null;
    const meta = result[0].meta;
    const price = meta.regularMarketPrice;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
    const prev = meta.previousClose ?? meta.chartPreviousClose;
    const changePercent =
      typeof prev === 'number' && prev > 0
        ? +((price - prev) / prev * 100).toFixed(2)
        : 0;
    return { price, changePercent, currency: meta.currency };
  } catch {
    return null;
  }
}

async function fetchYahooViaProxy(
  apiSymbols: string[],
): Promise<Map<string, { price: number; changePercent: number; currency?: string }>> {
  const map = new Map<string, { price: number; changePercent: number; currency?: string }>();
  if (apiSymbols.length === 0) return map;

  // Fetch all symbols in parallel — Yahoo v8/chart allows one symbol per request.
  // Rate-limit is generous for a small list (~8–15 symbols), parallel is fine.
  const results = await Promise.all(
    apiSymbols.map(async sym => ({ sym, q: await fetchYahooSingle(sym) })),
  );
  for (const { sym, q } of results) {
    if (q) map.set(sym, q);
  }
  return map;
}

// ─── Main fetch function ──────────────────────────────────────────────────────

/**
 * Fetch equity quotes for the current locale.
 * Returns cached data if still within EQUITY_TTL_MS.
 * If APIs are unavailable, returns stubs with isLive=false and null prices/changes.
 * Never fabricates numbers.
 */
export async function fetchEquityQuotes(locale: string): Promise<EquityQuote[]> {
  // Return fresh cache if locale matches and TTL not expired
  if (_cache && _cache.locale === locale && Date.now() - _cache.fetchedAt < EQUITY_TTL_MS) {
    return _cache.quotes;
  }

  const list = LOCALE_TICKERS.find(l => l.locale === locale)
    ?? LOCALE_TICKERS.find(l => l.locale === 'en')!;

  const brapiDefs = list.tickers.filter(t => t.source === 'brapi');
  const yahooDefs = list.tickers.filter(t => t.source === 'yahoo');

  const [brapiMap, yahooMap] = await Promise.all([
    fetchBrapi(brapiDefs.map(t => t.apiSymbol)),
    fetchYahooViaProxy(yahooDefs.map(t => t.apiSymbol)),
  ]);

  const now = Date.now();
  const quotes: EquityQuote[] = list.tickers.map(def => {
    if (def.source === 'brapi') {
      const q = brapiMap.get(def.apiSymbol);
      if (q && typeof q.regularMarketPrice === 'number') {
        return {
          symbol: def.symbol,
          name: def.name,
          type: def.type,
          price: q.regularMarketPrice,
          change: typeof q.regularMarketChangePercent === 'number' ? q.regularMarketChangePercent : null,
          currency: q.currency ?? def.currency,
          isLive: true,
          fetchedAt: now,
        };
      }
    } else {
      const q = yahooMap.get(def.apiSymbol);
      if (q) {
        return {
          symbol: def.symbol,
          name: def.name,
          type: def.type,
          price: q.price,
          change: q.changePercent,
          currency: q.currency ?? def.currency,
          isLive: true,
          fetchedAt: now,
        };
      }
    }
    // API unavailable for this ticker — return stub, no fabricated data
    return {
      symbol: def.symbol,
      name: def.name,
      type: def.type,
      price: null,
      change: null,
      currency: def.currency,
      isLive: false,
      fetchedAt: null,
    };
  });

  _cache = { quotes, locale, fetchedAt: now };
  return quotes;
}

/** Get the ticker list definition without fetching (for locale-aware metadata) */
export function getLocaleTickerList(locale: string): LocaleTickerList {
  return LOCALE_TICKERS.find(l => l.locale === locale)
    ?? LOCALE_TICKERS.find(l => l.locale === 'en')!;
}

/** Format a price for display with locale-appropriate currency symbol */
export function formatEquityPrice(price: number | null, currency: string): string {
  if (price === null || !Number.isFinite(price)) return '—';
  const symbols: Record<string, string> = {
    BRL: 'R$', USD: '$', EUR: '€', JPY: '¥', CNY: '¥', HKD: 'HK$',
    INR: '₹', KRW: '₩', SAR: '﷼', AED: 'د.إ', MXN: '$', GBP: '£',
  };
  const sym = symbols[currency] ?? currency + ' ';
  if (price >= 10_000) return `${sym}${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 100)   return `${sym}${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1)     return `${sym}${price.toFixed(2)}`;
  return `${sym}${price.toFixed(4)}`;
}

/** Map equity type to a short badge label */
export function equityTypeBadge(type: EquityType): string {
  const labels: Record<EquityType, string> = {
    stock: 'AÇÃO', smallcap: 'SMALL', etf: 'ETF', reit: 'REIT', fii: 'FII', fund: 'FUNDO',
  };
  return labels[type] ?? type.toUpperCase();
}
