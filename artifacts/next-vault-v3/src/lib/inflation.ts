import type { Locale } from '../i18n/types';
import { cacheGet, cacheSet, dedupe, fetchJson, HOUR } from '../radar/adapters/http';

export interface InflationQuote {
  countryCode: string;
  value: number;
  year: string;
  source: 'World Bank';
}

interface InflationCountry {
  iso2: string;
  iso3: string;
}

/**
 * Dashboard's default economic market by locale.
 * Kept separate from translation metadata so geography can later become
 * an explicit user preference without changing the app's language.
 */
const INFLATION_COUNTRY_BY_LOCALE: Record<Locale, InflationCountry> = {
  'pt-BR': { iso2: 'BR', iso3: 'BRA' },
  en: { iso2: 'US', iso3: 'USA' },
  es: { iso2: 'ES', iso3: 'ESP' },
  fr: { iso2: 'FR', iso3: 'FRA' },
  zh: { iso2: 'CN', iso3: 'CHN' },
  ja: { iso2: 'JP', iso3: 'JPN' },
  ko: { iso2: 'KR', iso3: 'KOR' },
  hi: { iso2: 'IN', iso3: 'IND' },
  // Arabic dashboard market: United Arab Emirates (Dubai), not Saudi Arabia.
  ar: { iso2: 'AE', iso3: 'ARE' },
};

type WbRow = {
  country?: { id?: string };
  date?: string;
  value?: number | null;
};
type WbResponse = [{ pages?: number }, WbRow[] | null] | null;

const CACHE_TTL_MS = 6 * HOUR;
const cacheKey = (iso2: string) => `dashboard.inflation.${iso2}.v1`;

/**
 * Latest available annual CPI inflation rate from World Bank Open Data.
 * Annual observations are not live/monthly estimates. Missing values remain null.
 */
export async function fetchInflation(locale: Locale): Promise<InflationQuote | null> {
  const country = INFLATION_COUNTRY_BY_LOCALE[locale];
  const key = cacheKey(country.iso2);
  const cached = cacheGet<InflationQuote>(key, CACHE_TTL_MS);
  if (cached) return cached;

  return dedupe(key, async () => {
    const secondRead = cacheGet<InflationQuote>(key, CACHE_TTL_MS);
    if (secondRead) return secondRead;

    const currentYear = new Date().getFullYear();
    const url = `https://api.worldbank.org/v2/country/${country.iso3}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=30&date=2018:${currentYear}`;

    try {
      const payload = await fetchJson<WbResponse>(url, { timeoutMs: 20000, retries: 2 });
      if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
        console.warn('[NV Dashboard] World Bank returned an unexpected inflation payload', country.iso2);
        return null;
      }

      const latest = payload[1]
        .filter((row) =>
          row.country?.id === country.iso2 &&
          typeof row.date === 'string' &&
          row.value !== null &&
          row.value !== undefined &&
          Number.isFinite(row.value),
        )
        .sort((a, b) => Number(b.date) - Number(a.date))[0];

      if (!latest || typeof latest.value !== 'number' || !latest.date) {
        console.warn('[NV Dashboard] World Bank has no annual inflation observation for', country.iso2);
        return null;
      }

      const quote: InflationQuote = {
        countryCode: country.iso2,
        value: latest.value,
        year: latest.date,
        source: 'World Bank',
      };
      cacheSet(key, quote);
      return quote;
    } catch (error) {
      console.warn('[NV Dashboard] Inflation request failed', {
        country: country.iso2,
        error,
      });
      return null;
    }
  });
}
