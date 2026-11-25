// Vercel Serverless Function — official B3 public index-statistics endpoint.
// Returns the year matrix for one allowlisted B3 index. This is a daily-close
// source (not an intraday feed); the client validates the latest trading date.
import type { IncomingMessage, ServerResponse } from 'http';

type Req = IncomingMessage & { query: Record<string, string | string[]> };
type Res = ServerResponse & {
  status(code: number): Res;
  json(body: unknown): void;
  end(body?: Buffer | string): void;
  setHeader(name: string, value: string | number | readonly string[]): void;
};

const ALLOWED = new Set(['ICON', 'IFNC', 'IMAT', 'IMOB', 'INDX', 'UTIL', 'IFIX', 'SMLL']);

export default async function handler(req: Req, res: Res): Promise<void> {
  const raw = req.query['symbol'];
  const symbol = typeof raw === 'string' ? raw.toUpperCase() : '';
  if (!ALLOWED.has(symbol)) {
    res.status(400).json({ error: 'unsupported B3 index' });
    return;
  }

  const payload = Buffer.from(JSON.stringify({
    language: 'pt-br',
    index: symbol,
    year: String(new Date().getFullYear()),
  })).toString('base64');

  try {
    const upstream = await fetch(
      `https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/${payload}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; NVProtocolMarketData/1.0)',
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    const body = await upstream.arrayBuffer();
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status).end(Buffer.from(body));
  } catch (error) {
    res.status(502).json({
      error: 'B3 official index-statistics source unavailable',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
