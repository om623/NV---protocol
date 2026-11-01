import type { Locale } from '../i18n/types';

export interface InflationQuote {
  countryCode: string;
  value: number;
  year: string;
  source: 'World Bank';
}

const COUNTRY_BY_LOCALE: Record<Locale, { iso2: string; iso3: string }> = {
  'pt-BR': { iso2: 'BR', iso3: 'BRA' },
  en: { iso2: 'US', iso3: 'USA' },
  es: { iso2: 'ES', iso3: 'ESP' },
  fr: { iso2: 'FR', iso3: 'FRA' },
  zh: { iso2: 'CN', iso3: 'CHN' },
  ja: { iso2: 'JP', iso3: 'JPN' },
  ko: { iso2: 'KR', iso3: 'KOR' },
  hi: { iso2: 'IN', iso3: 'IND' },
  ar: { iso2: 'SA', iso3: 'SAU' },
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { quote: InflationQuote; expiresAt: number }>();

/**
 * Latest available annual CPI inflation rate from the World Bank.
 * This is an annual observation, not a live/intraday or monthly estimate.
 * Missing or unavailable data is returned as null; values are never fabricated.
 */
export async function fetchInflation(locale: Locale): Promise<InflationQuote | null> {
  const country = COUNTRY_BY_LOCALE[locale];
  const cached = cache.get(country.iso3);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  const url = `https://api.worldbank.org/v2/country/${country.iso3}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=30&date=2018:2026`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`World Bank HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) return null;

    const observations = payload[1] as Array<{ country?: { id?: string }; date?: string; value?: number | null }>;
    const latest = observations
      .filter(row => row.country?.id === country.iso2 && row.date && row.value !== null && Number.isFinite(row.value))
      .sort((a, b) => Number(b.date) - Number(a.date))[0];

    if (!latest || typeof latest.value !== 'number' || !latest.date) return null;
    const quote: InflationQuote = {
      countryCode: country.iso2,
      value: latest.value,
      year: latest.date,
      source: 'World Bank',
    };
    cache.set(country.iso3, { quote, expiresAt: Date.now() + CACHE_TTL_MS });
    return quote;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
