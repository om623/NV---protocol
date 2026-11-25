// Global Radar: GDELT news proxy.
// GET /api/radar-news?q=<gdelt query>&timespan=3months&max=8
// GDELT allows one request per 5 s and may omit CORS headers on errors, so the browser
// asks this function instead. Successful answers are cached at the CDN for 30 minutes.

import type { IncomingMessage, ServerResponse } from 'http';

const TIMESPANS = new Set(['1week', '1month', '3months']);

function send(res: ServerResponse, status: number, body: unknown, cache?: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cache) res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const q = (url.searchParams.get('q') ?? '').trim();
  const timespan = url.searchParams.get('timespan') ?? '3months';
  const max = Math.min(Math.max(Number(url.searchParams.get('max') ?? 8) || 8, 1), 25);
  if (q.length < 2 || q.length > 220) return send(res, 400, { error: 'bad_query' });
  if (!TIMESPANS.has(timespan)) return send(res, 400, { error: 'bad_timespan' });

  const upstream =
    'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc' +
    `&maxrecords=${max * 2}&timespan=${timespan}&query=${encodeURIComponent(q)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(upstream, { signal: ctrl.signal, headers: { 'User-Agent': 'NVProtocolRadar/1.0' } });
    if (r.status === 429) return send(res, 429, { error: 'rate_limited' });
    if (!r.ok) return send(res, 502, { error: 'upstream', status: r.status });
    const text = await r.text();
    // GDELT answers plain text (not JSON) when a query has no results
    let json: { articles?: Record<string, string>[] };
    try { json = JSON.parse(text); } catch { return send(res, 200, { articles: [] }, 'public, s-maxage=900'); }
    const articles = (json.articles ?? []).slice(0, max * 2).map((a) => ({
      url: a.url, title: a.title, seendate: a.seendate, domain: a.domain, language: a.language,
    }));
    return send(res, 200, { articles }, 'public, s-maxage=1800, stale-while-revalidate=86400');
  } catch (err) {
    return send(res, (err as Error).name === 'AbortError' ? 504 : 502, { error: 'upstream' });
  } finally {
    clearTimeout(timer);
  }
}
