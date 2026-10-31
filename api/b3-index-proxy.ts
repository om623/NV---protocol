// Vercel Serverless Function — public B3 index daily-close proxy.
// Only forwards the eight supported B3 sector/segment index symbols to Dados B3.
import type { IncomingMessage, ServerResponse } from 'http';

type Req = IncomingMessage & { query: Record<string, string | string[]> };
type Res = ServerResponse & {
  status(code: number): Res;
  json(body: unknown): void;
  end(body?: Buffer | string): void;
  setHeader(name: string, value: string | number | readonly string[]): void;
};

const ALLOWED = new Set(['ICON','IFNC','IMAT','IMOB','INDX','UTIL','IFIX','SMLL']);
export default async function handler(req: Req, res: Res): Promise<void> {
  const raw = req.query['symbol'];
  const symbol = typeof raw === 'string' ? raw.toUpperCase() : '';
  if (!ALLOWED.has(symbol)) { res.status(400).json({ error: 'unsupported B3 index' }); return; }
  try {
    const upstream = await fetch(`https://dadosb3.com/indices/${symbol}/precos`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
    });
    const body = await upstream.arrayBuffer();
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status).end(Buffer.from(body));
  } catch (error) {
    res.status(502).json({ error: 'B3 daily index source unavailable', detail: error instanceof Error ? error.message : String(error) });
  }
}
