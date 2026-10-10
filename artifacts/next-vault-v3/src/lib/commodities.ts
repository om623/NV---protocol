// ─── Commodities — real data via Vite dev proxy → Yahoo Finance ──────────────
// Uses the /yf-proxy path configured in vite.config.ts which rewrites to
// https://query1.finance.yahoo.com — no API key, no CORS restriction.
// Falls back to Coinbase for precious metals (XAU, XAG, XPT, XPD) since
// Coinbase supports CORS natively.

export interface CommodityQuote {
  /** NV-internal symbol (e.g. "XAU", "WTI") */
  symbol: string;
  price: number;
  /** USD unless stated otherwise */
  currency: string;
  /** Human-readable unit e.g. "USD/troy oz", "USD/bbl", "USX/bu" */
  unit: string;
  /** % change vs previous close; null if unavailable */
  changePercent: number | null;
  prevClose: number | null;
  volume?: number;
  /** Exchange name from Yahoo */
  exchange?: string;
  /** ms timestamp of data */
  dataTimestamp: number;
  /** true = live quote from API, false = could not fetch */
  isLive: boolean;
}

// ─── Yahoo Finance symbol mapping ─────────────────────────────────────────────
// NV symbol → { yahooSymbol, unit }
const YF_MAP: Record<string, { yfSym: string; unit: string; currency: string }> = {
  // Metals via YF futures (also have Coinbase fallback)
  XAU:   { yfSym: 'GC=F',      unit: 'USD/troy oz',   currency: 'USD' },
  XAG:   { yfSym: 'SI=F',      unit: 'USD/troy oz',   currency: 'USD' },
  XPT:   { yfSym: 'PL=F',      unit: 'USD/troy oz',   currency: 'USD' },
  XPD:   { yfSym: 'PA=F',      unit: 'USD/troy oz',   currency: 'USD' },
  // Energy
  WTI:   { yfSym: 'CL=F',      unit: 'USD/bbl',       currency: 'USD' },
  BRENT: { yfSym: 'BZ=F',      unit: 'USD/bbl',       currency: 'USD' },
  NG:    { yfSym: 'NG=F',      unit: 'USD/MMBtu',     currency: 'USD' },
  // Base metals
  COP:   { yfSym: 'HG=F',      unit: 'USD/lb',        currency: 'USD' },
  // Agricultural — note YF returns these in USX (US cents); we convert to USD
  ZC:    { yfSym: 'ZC=F',      unit: 'USD/bu',        currency: 'USD' },
  ZW:    { yfSym: 'ZW=F',      unit: 'USD/bu',        currency: 'USD' },
  ZS:    { yfSym: 'ZS=F',      unit: 'USD/bu',        currency: 'USD' },
};

// Symbols whose YF price is in USX (US cents) and must be divided by 100
const USX_SYMBOLS = new Set(['ZC', 'ZW', 'ZS']);

// Coinbase fallback for precious metals (CORS-friendly, no proxy needed)
const COINBASE_MAP: Partial<Record<string, string>> = {
  XAU: 'XAU',
  XAG: 'XAG',
  XPT: 'XPT',
  XPD: 'XPD',
};

// ─── Yahoo Finance fetch ───────────────────────────────────────────────────────

interface YFChartResult {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        chartPreviousClose: number;
        currency: string;
        exchangeName: string;
        regularMarketVolume?: number;
        regularMarketTime?: number;
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}

async function fetchYFQuote(
  nvSym: string,
  yfSym: string,
  unit: string,
): Promise<CommodityQuote | null> {
  const encoded = encodeURIComponent(yfSym);
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
    const rawPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    // Convert USX → USD for agricultural contracts
    const divisor = USX_SYMBOLS.has(nvSym) ? 100 : 1;
    const price = rawPrice / divisor;
    const prev = prevClose / divisor;
    const changePercent = prev > 0 ? ((price - prev) / prev) * 100 : null;
    return {
      symbol: nvSym,
      price,
      currency: divisor === 100 ? 'USD' : (meta.currency ?? 'USD'),
      unit,
      changePercent,
      prevClose: prev,
      volume: meta.regularMarketVolume,
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

// ─── Coinbase fetch (CORS-friendly) ───────────────────────────────────────────

interface CoinbaseSpotResponse {
  data: { amount: string; base: string; currency: string };
}

async function fetchCoinbaseSpot(nvSym: string, cbBase: string): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${cbBase}-USD/spot`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CoinbaseSpotResponse;
    const val = parseFloat(json?.data?.amount ?? '');
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch real commodity prices for the given NV-internal symbols.
 * Returns a Map of symbol → CommodityQuote.
 * Symbols not in YF_MAP or whose fetch fails are absent from the map.
 */
export async function fetchCommodityPrices(
  symbols: string[],
): Promise<Map<string, CommodityQuote>> {
  const map = new Map<string, CommodityQuote>();
  if (symbols.length === 0) return map;

  // Fetch all known symbols in parallel
  const tasks = symbols
    .filter(s => s in YF_MAP)
    .map(async (nvSym) => {
      const { yfSym, unit } = YF_MAP[nvSym];
      const quote = await fetchYFQuote(nvSym, yfSym, unit);
      if (quote) {
        map.set(nvSym, quote);
        return;
      }
      // Fallback: Coinbase for precious metals
      const cbBase = COINBASE_MAP[nvSym];
      if (cbBase) {
        const cbPrice = await fetchCoinbaseSpot(nvSym, cbBase);
        if (cbPrice !== null) {
          map.set(nvSym, {
            symbol: nvSym,
            price: cbPrice,
            currency: 'USD',
            unit: YF_MAP[nvSym].unit,
            changePercent: null, // Coinbase spot doesn't give change %
            prevClose: null,
            exchange: 'Coinbase',
            dataTimestamp: Date.now(),
            isLive: true,
          });
        }
      }
    });

  await Promise.allSettled(tasks);
  return map;
}
