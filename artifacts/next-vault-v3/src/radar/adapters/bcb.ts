// Banco Central do Brasil, SGS time series (https://api.bcb.gov.br). Official, CORS enabled, no key.
// 432   = Selic target rate set by Copom (% p.a.)
// 13522 = IPCA, accumulated over 12 months (%)

import { cacheGet, cacheSet, dedupe, fetchJson, HOUR } from './http';

export interface BcbPoint {
  value: number;
  /** ISO date (YYYY-MM-DD) of the observation */
  date: string;
  seriesId: number;
}

export interface BcbSnapshot {
  policyRate: BcbPoint | null;
  inflation12m: BcbPoint | null;
}

export const BCB_SOURCE = 'Banco Central do Brasil (SGS)';
export const bcbSeriesUrl = (id: number) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${id}/dados/ultimos/1?formato=json`;

async function last(id: number): Promise<BcbPoint | null> {
  const rows = await fetchJson<{ data: string; valor: string }[]>(bcbSeriesUrl(id));
  const r = rows?.[0];
  if (!r) return null;
  const [d, m, y] = r.data.split('/');
  const value = Number.parseFloat(r.valor);
  if (!Number.isFinite(value) || !y) return null;
  return { value, date: `${y}-${m}-${d}`, seriesId: id };
}

export function fetchBcbSnapshot(): Promise<BcbSnapshot> {
  const key = 'bcb.snapshot.v1';
  const cached = cacheGet<BcbSnapshot>(key, 6 * HOUR);
  if (cached) return Promise.resolve(cached);
  return dedupe(key, async () => {
    const [a, b] = await Promise.allSettled([last(432), last(13522)]);
    const snap: BcbSnapshot = {
      policyRate: a.status === 'fulfilled' ? a.value : null,
      inflation12m: b.status === 'fulfilled' ? b.value : null,
    };
    if (!snap.policyRate && !snap.inflation12m) throw new Error('BCB unavailable');
    cacheSet(key, snap);
    return snap;
  });
}
