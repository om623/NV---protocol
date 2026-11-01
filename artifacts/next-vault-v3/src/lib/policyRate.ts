import type { Locale } from '../i18n/types';

export interface PolicyRateQuote { countryCode: string; value: number; date: string; source: 'BIS'; }

const COUNTRY_BY_LOCALE: Record<Locale, { countryCode: string; bisCode: string }> = {
  'pt-BR': { countryCode: 'BR', bisCode: 'BR' },
  en: { countryCode: 'US', bisCode: 'US' },
  es: { countryCode: 'ES', bisCode: 'XM' },
  fr: { countryCode: 'FR', bisCode: 'XM' },
  zh: { countryCode: 'CN', bisCode: 'CN' },
  ja: { countryCode: 'JP', bisCode: 'JP' },
  ko: { countryCode: 'KR', bisCode: 'KR' },
  hi: { countryCode: 'IN', bisCode: 'IN' },
  ar: { countryCode: 'SA', bisCode: 'SA' },
};

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { quote: PolicyRateQuote; expiresAt: number }>();

/** Latest published central-bank policy rate from the BIS WS_CBPOL dataset. */
export async function fetchPolicyRate(locale: Locale): Promise<PolicyRateQuote | null> {
  const country = COUNTRY_BY_LOCALE[locale];
  const cached = cache.get(country.bisCode);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  const url = `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.${country.bisCode}?lastNObservations=10`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/vnd.sdmx.data+json;version=1.0.0' } });
    if (!response.ok) throw new Error(`BIS HTTP ${response.status}`);
    const payload = await response.json();
    const structure = payload?.data?.structures?.[0];
    const dataset = payload?.data?.dataSets?.[0];
    const seriesMap = dataset?.series as Record<string, { observations?: Record<string, unknown[]> }> | undefined;
    const series = seriesMap ? Object.values(seriesMap)[0] : undefined;
    const observations = series?.observations;
    const dimensions = structure?.dimensions?.observation as Array<{ id?: string; values?: Array<{ id?: string; name?: string }> }> | undefined;
    const timeDimension = dimensions?.find(dimension => dimension.id === 'TIME_PERIOD') ?? dimensions?.[0];
    const periods = timeDimension?.values;
    if (!observations || !periods?.length) return null;
    const valid = Object.entries(observations).map(([index, values]) => ({
      period: periods[Number(index)]?.id ?? periods[Number(index)]?.name ?? '',
      value: Number(values?.[0]),
    })).filter(item => item.period && Number.isFinite(item.value)).sort((a, b) => a.period.localeCompare(b.period));
    const latest = valid[valid.length - 1];
    if (!latest) return null;
    const quote: PolicyRateQuote = { countryCode: country.countryCode, value: latest.value, date: latest.period, source: 'BIS' };
    cache.set(country.bisCode, { quote, expiresAt: Date.now() + CACHE_TTL_MS });
    return quote;
  } catch { return null; }
  finally { clearTimeout(timeout); }
}
