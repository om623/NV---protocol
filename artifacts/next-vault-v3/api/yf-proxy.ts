// Vercel Serverless Function — Yahoo Finance proxy
//
// Routes: /yf-proxy/* → https://query1.finance.yahoo.com/*
//
// Purpose: Yahoo Finance does not send Access-Control-Allow-Origin headers,
// so browser fetch() calls to it are blocked by CORS. This function runs
// server-side on Vercel, forwards the request to Yahoo, and returns the
// response to the browser — no CORS issue, no API key required.
//
// The Vite dev server proxy (vite.config.ts → server.proxy['/yf-proxy'])
// handles the same routing in development. This file handles it in production.
//
// vercel.json rewrites /yf-proxy/:path* → /api/yf-proxy?path=/:path*
// so all existing fetch('/yf-proxy/...') calls work identically in dev and prod.
//
// Types are inlined to avoid a hard dependency on @vercel/node in the app bundle.

/* eslint-disable @typescript-eslint/no-explicit-any */
type VercelRequest = {
  query: Record<string, string | string[]>;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  send(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const YAHOO_BASE = 'https://query1.finance.yahoo.com';

// Whitelist of query-string params to forward — never forward cookies or auth
const ALLOWED_QUERY = new Set([
  'interval', 'range', 'period1', 'period2', 'events',
  'includePrePost', 'useYfid', 'corsDomain', 'crumb',
]);

// Whitelist of allowed Yahoo Finance API path prefixes
const ALLOWED_PREFIXES = [
  '/v8/finance/chart/',
  '/v7/finance/quote',
  '/v10/finance/',
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Extract path from rewrite: /yf-proxy/v8/finance/chart/AAPL → path=/v8/finance/chart/AAPL
  const rawPath = (req.query['path'] as string | undefined) ?? '';
  if (!rawPath) {
    res.status(400).json({ error: 'missing path parameter' });
    return;
  }

  // Normalise to absolute path
  const safePath = rawPath.startsWith('/') ? rawPath : '/' + rawPath;

  // Security: only forward to known Yahoo Finance API paths
  if (!ALLOWED_PREFIXES.some(p => safePath.startsWith(p))) {
    res.status(403).json({ error: 'path not allowed' });
    return;
  }

  // Build upstream query string from whitelisted params
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (!ALLOWED_QUERY.has(key)) continue;
    if (typeof val === 'string') qs.set(key, val);
  }
  const queryString = qs.toString();
  const upstreamUrl = `${YAHOO_BASE}${safePath}${queryString ? '?' + queryString : ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const upstreamRes = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    const contentType = upstreamRes.headers.get('content-type') ?? 'application/json';
    const body = await upstreamRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstreamRes.status).send(Buffer.from(body));
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'upstream request failed', detail: message });
  }
}
