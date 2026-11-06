// World Bank Open Data (https://data.worldbank.org). Public API, CORS enabled, no key.
// One request per indicator returns the last few years for every country; the latest
// non-empty value is used.

import type { CountryIndicators, IndicatorKey } from '../types';
import { KNOWN_A2 } from '../data/countries';
import { cacheGet, cacheSet, dedupe, fetchJson, DAY } from './http';

export const WB_INDICATORS: Record<IndicatorKey, string> = {
  gdp: 'NY.GDP.MKTP.CD',
  gdpGrowth: 'NY.GDP.MKTP.KD.ZG',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  population: 'SP.POP.TOTL',
  inflation: 'FP.CPI.TOTL.ZG',
  unemployment: 'SL.UEM.TOTL.ZS',
  fdi: 'BX.KLT.DINV.CD.WD',
  manufacturing: 'NV.IND.MANF.ZS',
};

export const WB_SOURCE = 'World Bank Open Data';
export const wbIndicatorUrl = (key: IndicatorKey) => `https://data.worldbank.org/indicator/${WB_INDICATORS[key]}`;

type WbRow = { country: { id: string }; value: number | null; date: string };
type WbMeta = { pages?: number };
type WbResponse = [WbMeta, WbRow[] | null];

const CACHE_KEY = 'wb.all.v2';

/**
 * Some indicators ignore the "most recent value" switch and return every year, so the
 * request is bounded to the last 7 years and the latest non-empty value per country is
 * picked here. Extra pages are followed (at most 4).
 */
async function fetchIndicator(key: IndicatorKey): Promise<Record<string, { value: number | null; year: string }>> {
  const code = WB_INDICATORS[key];
  const y = new Date().getFullYear();
  const base = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&date=${y - 6}:${y}&per_page=2000`;
  const out: Record<string, { value: number | null; year: string }> = {};
  let pages = 1;
  for (let page = 1; page <= Math.min(pages, 4); page++) {
    const json = await fetchJson<WbResponse>(`${base}&page=${page}`, { timeoutMs: 25000 });
    if (!Array.isArray(json)) break;
    pages = json[0]?.pages ?? 1;
    for (const r of json[1] ?? []) {
      const a2 = r.country?.id;
      if (!a2 || !KNOWN_A2.has(a2) || r.value === null || r.value === undefined) continue;
      if (!out[a2] || r.date > out[a2].year) out[a2] = { value: r.value, year: r.date };
    }
  }
  return out;
}

export type AllCountryIndicators = Record<string, CountryIndicators>;

/** Latest indicators for every country, cached for 24 h. Individual indicator failures are tolerated. */
export function fetchAllCountryIndicators(): Promise<AllCountryIndicators> {
  const cached = cacheGet<AllCountryIndicators>(CACHE_KEY, DAY);
  if (cached) return Promise.resolve(cached);
  return dedupe(CACHE_KEY, async () => {
    const keys = Object.keys(WB_INDICATORS) as IndicatorKey[];
    const settled = await Promise.allSettled(keys.map((k) => fetchIndicator(k)));
    const result: AllCountryIndicators = {};
    let ok = 0;
    settled.forEach((s, i) => {
      if (s.status !== 'fulfilled') return;
      ok++;
      const key = keys[i];
      for (const [a2, v] of Object.entries(s.value)) {
        (result[a2] ??= {})[key] = { id: WB_INDICATORS[key], value: v.value, year: v.year };
      }
    });
    if (ok === 0) throw new Error('World Bank unavailable');
    cacheSet(CACHE_KEY, result);
    return result;
  });
}
