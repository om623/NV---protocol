// ─── Commodities API — real data via Supabase Edge Function proxy ───────────
// Yahoo Finance futures prices proxied through a Supabase Edge Function to
// avoid browser CORS restrictions. No API key required. Falls back to null
// (simulated data) when the proxy is unavailable.

interface CommodityQuote {
  symbol: string;
  price: number;
  changePercent: number;
  volume?: number;
  prevClose?: number;
}

interface ProxyResponse {
  data?: Record<string, CommodityQuote>;
  error?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Fetch real commodity prices from the edge function proxy.
 * Returns a Map of NV-internal symbol → CommodityQuote.
 * Returns an empty Map on any failure (caller falls back to simulated data).
 */
export async function fetchCommodityPrices(symbols: string[]): Promise<Map<string, CommodityQuote>> {
  const map = new Map<string, CommodityQuote>();
  if (symbols.length === 0) return map;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return map;

  const url = `${SUPABASE_URL}/functions/v1/commodities-proxy?symbols=${symbols.join(',')}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'X-Client-Info': 'next-vault-v3',
      },
    });
    if (!res.ok) return map;
    const json = (await res.json()) as ProxyResponse;
    if (!json.data) return map;
    for (const [sym, quote] of Object.entries(json.data)) {
      if (typeof quote.price === 'number' && Number.isFinite(quote.price)) {
        map.set(sym, quote);
      }
    }
  } catch {
    // Network error or timeout — return empty, caller uses fallback
  } finally {
    clearTimeout(timer);
  }

  return map;
}
