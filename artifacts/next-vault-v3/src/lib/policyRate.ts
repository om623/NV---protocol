import type { Locale } from '../i18n/types';

export interface PolicyRateQuote {
  countryCode: string;
  value: number;
  date: string;
  source: 'BIS';
}

const COUNTRY_BY_LOCALE: Record<Locale, { countryCode: string; bisCode: string }> = {
  'pt-BR': { countryCode: 'BR', bisCode: 'M.BR' },
  en: { countryCode: 'US', bisCode: 'M.US' },
  es: { countryCode: 'ES', bisCode: 'M.XM' },
  fr: { countryCode: 'FR', bisCode: 'M.XM' },
  zh: { countryCode: 'CN', bisCode: 'M.CN' },
  ja: { countryCode: 'JP', bisCode: 'M.JP' },
  ko: { countryCode: 'KR', bisCode: 'M.KR' },
  hi: { countryCode: 'IN', bisCode: 'M.IN' },
  ar: { countryCode: 'SA', bisCode: 'M.SA' },
};

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { quote: PolicyRateQuote; expiresAt: number }>();

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function parseBisCsv(csv: string, countryCode: string): PolicyRateQuote | null {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headerIndex = lines.findIndex(line => {
    const columns = parseCsvLine(line).map(column => column.trim().toUpperCase());
    return columns.includes('TIME_PERIOD') && columns.includes('OBS_VALUE');
  });
  if (headerIndex < 0) return null;

  const headers = parseCsvLine(lines[headerIndex]).map(column => column.trim().toUpperCase());
  const timeIndex = headers.indexOf('TIME_PERIOD');
  const valueIndex = headers.indexOf('OBS_VALUE');
  const observations = lines.slice(headerIndex + 1).map(line => {
    const columns = parseCsvLine(line);
    return {
      date: columns[timeIndex]?.trim() ?? '',
      value: Number(columns[valueIndex]),
    };
  }).filter(item => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(item.date) && columnsAreNumeric(item.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = observations[observations.length - 1];
  return latest ? { countryCode, value: latest.value, date: latest.date, source: 'BIS' } : null;
}

function columnsAreNumeric(value: number): boolean {
  return Number.isFinite(value);
}

/** Latest published central-bank policy rate from the BIS WS_CBPOL monthly series. */
export async function fetchPolicyRate(locale: Locale): Promise<PolicyRateQuote | null> {
  const country = COUNTRY_BY_LOCALE[locale];
  const cached = cache.get(country.bisCode);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  // Ask BIS explicitly for SDMX-CSV: its v2 API does not return the
  // SDMX-JSON 1.0 object shape used by the previous parser by default.
  const url = `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/${country.bisCode}?lastNObservations=10&format=csv`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.sdmx.data+csv;version=1.0.0' },
    });
    if (!response.ok) throw new Error(`BIS HTTP ${response.status}`);
    const csv = await response.text();
    const quote = parseBisCsv(csv, country.countryCode);
    if (!quote) return null;

    cache.set(country.bisCode, { quote, expiresAt: Date.now() + CACHE_TTL_MS });
    return quote;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
