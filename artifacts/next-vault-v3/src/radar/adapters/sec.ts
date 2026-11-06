// SEC EDGAR (official US filings). data.sec.gov sends no CORS headers and requires a
// declared User-Agent, so the browser talks to NV's own server function (/api/radar-sec),
// which also reduces the multi-megabyte XBRL file to a handful of annual figures.

import type { Metrics, MetricKey } from '../types';
import { computeStatus } from '../format';
import { cacheGet, cacheSet, dedupe, fetchJson, DAY } from './http';

export const SEC_SOURCE = 'SEC EDGAR (XBRL)';

export interface SecFact {
  value: number;
  unit: string;
  end: string;
  filed: string;
  form: string;
  accn: string;
  tag: string;
}

export interface SecResponse {
  ticker: string;
  cik: string;
  entityName: string;
  facts: Partial<Record<'revenue' | 'netIncome' | 'assets' | 'liabilities' | 'equity' | 'debt', SecFact>>;
}

export async function fetchSecMetrics(ticker: string): Promise<{ metrics: Metrics; entityName: string; cik: string }> {
  const key = `sec.${ticker}.v1`;
  const cached = cacheGet<{ metrics: Metrics; entityName: string; cik: string }>(key, DAY);
  if (cached) return cached;
  return dedupe(key, async () => {
    const res = await fetchJson<SecResponse>(`/api/radar-sec?ticker=${encodeURIComponent(ticker)}`, { timeoutMs: 40000 });
    const metrics: Metrics = {};
    const now = new Date().toISOString();
    for (const [k, f] of Object.entries(res.facts) as [MetricKey, SecFact][]) {
      if (!f) continue;
      const cikNum = String(Number(res.cik));
      metrics[k] = {
        status: computeStatus(f.end),
        value: f.value,
        asOf: f.end,
        currency: f.unit,
        source: `${SEC_SOURCE} · ${f.form}`,
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cikNum}/${f.accn.replace(/-/g, '')}/`,
        retrievedAt: now,
      };
    }
    const out = { metrics, entityName: res.entityName, cik: res.cik };
    cacheSet(key, out);
    return out;
  });
}
