const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface YahooMeta {
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  shortName?: string;
  chartPreviousClose?: number;
}

interface YahooResponse {
  chart?: {
    result?: Array<{ meta: YahooMeta }>;
    error?: { code: number; description: string };
  };
}

interface CommodityResult {
  symbol: string;
  price: number;
  changePercent: number;
  volume?: number;
  prevClose?: number;
}

const SYMBOL_MAP: Record<string, string> = {
  // Commodities
  XAU: "GC=F",
  XAG: "SI=F",
  WTI: "CL=F",
  BRENT: "BZ=F",
  NG: "NG=F",
  COP: "HG=F",
  PL: "PL=F",
  PA: "PA=F",
  AL: "ALI=F",
  ZC: "ZC=F",
  ZW: "ZW=F",
  ZS: "ZS=F",
  KC: "KC=F",
  SB: "SB=F",
  CT: "CT=F",
  CC: "CC=F",
  OJ: "OJ=F",
  LE: "LE=F",
  HE: "HE=F",
  // Indices
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  RUT: "^RUT",
  VIX: "^VIX",
  FTSE: "^FTSE",
  DAX: "^GDAXI",
  CAC: "^FCHI",
  N225: "^N225",
  HSI: "^HSI",
  IBOV: "^BVSP",
  DXY: "DX-Y.NYB",
};

async function fetchOne(yahooSymbol: string): Promise<CommodityResult | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NVProtocol/1.0)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as YahooResponse;
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  return {
    symbol: yahooSymbol,
    price: meta.regularMarketPrice,
    changePercent: meta.regularMarketChangePercent ?? 0,
    volume: meta.regularMarketVolume,
    prevClose: meta.chartPreviousClose,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const requestedSyms = url.searchParams.get("symbols");
    if (!requestedSyms) {
      return new Response(JSON.stringify({ error: "Missing 'symbols' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const symbols = requestedSyms.split(",").map((s) => s.trim()).filter(Boolean);
    const yahooSyms: Array<{ nvSymbol: string; yahooSymbol: string }> = [];
    for (const sym of symbols) {
      const yahooSymbol = SYMBOL_MAP[sym];
      if (yahooSymbol) {
        yahooSyms.push({ nvSymbol: sym, yahooSymbol });
      }
    }

    const results = await Promise.all(
      yahooSyms.map(async (entry) => {
        const result = await fetchOne(entry.yahooSymbol);
        if (!result) return null;
        return { ...result, symbol: entry.nvSymbol };
      }),
    );

    const data: Record<string, CommodityResult> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r) data[yahooSyms[i].nvSymbol] = r;
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
