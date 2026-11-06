// Global Radar: SEC EDGAR reducer.
//
// GET /api/radar-sec?ticker=AAPL
//
// data.sec.gov sends no CORS headers and requires a User-Agent that identifies the
// requester (https://www.sec.gov/os/accessing-edgar-data). This function:
//   1. resolves the ticker to a CIK using SEC's own ticker file,
//   2. downloads the company's XBRL "company facts",
//   3. returns only the latest annual figures NV displays (a few hundred bytes).
//
// Configuration: SEC_USER_AGENT must be set, e.g. "YourCompany admin@yourdomain.com".
// Without it the function answers 503 {"error":"not_configured"} and the Radar shows
// the SEC figures as unavailable. No fake identity is ever sent.

import type { IncomingMessage, ServerResponse } from 'http';

type FactKey = 'revenue' | 'netIncome' | 'assets' | 'liabilities' | 'equity' | 'debt';

interface Fact {
  value: number;
  unit: string;
  end: string;
  filed: string;
  form: string;
  accn: string;
  tag: string;
}

interface XbrlEntry { start?: string; end: string; val: number; accn: string; fy?: number; fp?: string; form: string; filed: string }
type XbrlFacts = Record<string, Record<string, { units: Record<string, XbrlEntry[]> }>>;

const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']);

// Flow items cover a year; instant items are balance-sheet dates.
const CONCEPTS: Record<FactKey, { flow: boolean; tags: [string, string][] }> = {
  revenue: {
    flow: true,
    tags: [
      ['us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax'], ['us-gaap', 'Revenues'],
      ['us-gaap', 'SalesRevenueNet'], ['us-gaap', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
      ['ifrs-full', 'Revenue'],
    ],
  },
  netIncome: { flow: true, tags: [['us-gaap', 'NetIncomeLoss'], ['us-gaap', 'ProfitLoss'], ['ifrs-full', 'ProfitLoss']] },
  assets: { flow: false, tags: [['us-gaap', 'Assets'], ['ifrs-full', 'Assets']] },
  liabilities: { flow: false, tags: [['us-gaap', 'Liabilities'], ['ifrs-full', 'Liabilities']] },
  equity: {
    flow: false,
    tags: [
      ['us-gaap', 'StockholdersEquity'], ['us-gaap', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
      ['ifrs-full', 'Equity'], ['ifrs-full', 'EquityAttributableToOwnersOfParent'],
    ],
  },
  debt: {
    flow: false,
    tags: [['us-gaap', 'LongTermDebt'], ['us-gaap', 'LongTermDebtNoncurrent'], ['us-gaap', 'DebtAndCapitalLeaseObligations'], ['ifrs-full', 'Borrowings']],
  },
};

let tickerCache: { at: number; map: Map<string, { cik: number; title: string }> } | null = null;

async function secFetch(url: string, ua: string, ms = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCik(ticker: string, ua: string): Promise<{ cik: number; title: string } | null> {
  if (!tickerCache || Date.now() - tickerCache.at > 24 * 3_600_000) {
    const res = await secFetch('https://www.sec.gov/files/company_tickers.json', ua);
    if (!res.ok) throw new Error(`tickers ${res.status}`);
    const json = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    const map = new Map<string, { cik: number; title: string }>();
    for (const r of Object.values(json)) map.set(r.ticker.toUpperCase(), { cik: r.cik_str, title: r.title });
    tickerCache = { at: Date.now(), map };
  }
  return tickerCache.map.get(ticker.toUpperCase()) ?? tickerCache.map.get(ticker.toUpperCase().replace('.', '-')) ?? null;
}

function days(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

function pick(facts: XbrlFacts, key: FactKey): Fact | null {
  const spec = CONCEPTS[key];
  let best: Fact | null = null;
  for (const [ns, tag] of spec.tags) {
    const concept = facts[ns]?.[tag];
    if (!concept) continue;
    const unitNames = Object.keys(concept.units);
    const unit = unitNames.includes('USD') ? 'USD' : unitNames[0];
    if (!unit) continue;
    for (const e of concept.units[unit]) {
      if (!ANNUAL_FORMS.has(e.form)) continue;
      if (spec.flow) {
        if (!e.start) continue;
        const span = days(e.start, e.end);
        if (span < 340 || span > 390) continue;
      }
      const cand: Fact = { value: e.val, unit, end: e.end, filed: e.filed, form: e.form, accn: e.accn, tag: `${ns}:${tag}` };
      if (!best || cand.end > best.end || (cand.end === best.end && cand.filed > best.filed)) best = cand;
    }
  }
  return best;
}

function send(res: ServerResponse, status: number, body: unknown, cache?: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cache) res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const ua = (process.env.SEC_USER_AGENT ?? '').trim();
    if (!ua) return send(res, 503, { error: 'not_configured' });

    const url = new URL(req.url ?? '/', 'http://localhost');
    const ticker = (url.searchParams.get('ticker') ?? '').trim();
    if (!/^[A-Za-z0-9.\-]{1,10}$/.test(ticker)) return send(res, 400, { error: 'bad_ticker' });

    const match = await resolveCik(ticker, ua);
    if (!match) return send(res, 404, { error: 'not_found' });

    const cik10 = String(match.cik).padStart(10, '0');
    const factsRes = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`, ua, 30000);
    if (factsRes.status === 404) return send(res, 404, { error: 'no_facts' });
    if (factsRes.status === 429) return send(res, 429, { error: 'rate_limited' });
    if (!factsRes.ok) return send(res, 502, { error: 'upstream', status: factsRes.status });

    const json = (await factsRes.json()) as { entityName?: string; facts?: XbrlFacts };
    const out: Partial<Record<FactKey, Fact>> = {};
    for (const key of Object.keys(CONCEPTS) as FactKey[]) {
      const f = json.facts ? pick(json.facts, key) : null;
      if (f) out[key] = f;
    }
    return send(
      res,
      200,
      { ticker: ticker.toUpperCase(), cik: cik10, entityName: json.entityName ?? match.title, facts: out },
      'public, s-maxage=86400, stale-while-revalidate=604800',
    );
  } catch (err) {
    const message = (err as Error).message;
    console.error('[radar-sec]', message);
    if ((err as Error).name === 'AbortError') return send(res, 504, { error: 'timeout' });
    // SEC answers 403 when the User-Agent does not identify a real contact.
    if (message.startsWith('tickers 403')) return send(res, 502, { error: 'sec_rejected_user_agent' });
    if (message.startsWith('tickers')) return send(res, 502, { error: 'upstream' });
    return send(res, 500, { error: 'internal' });
  }
}
