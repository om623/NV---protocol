import { fetchInflation } from '../src/lib/inflation';
import type { Locale } from '../src/i18n/types';

const expected: Array<[Locale, string, string]> = [
  ['pt-BR', 'BR', 'BRA'],
  ['ko', 'KR', 'KOR'],
  ['hi', 'IN', 'IND'],
  ['ar', 'AE', 'ARE'],
];

let passed = 0;
const failures: string[] = [];
const assert = (condition: boolean, label: string) => {
  if (condition) passed++;
  else failures.push(label);
};

const originalFetch = globalThis.fetch;
try {
  for (const [locale, iso2, iso3] of expected) {
    let requestedUrl = '';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify([
        { pages: 1 },
        [
          { country: { id: iso2 }, date: '2024', value: 4.1 },
          { country: { id: iso2 }, date: '2025', value: 3.2 },
          { country: { id: iso2 }, date: '2026', value: null },
        ],
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const quote = await fetchInflation(locale);
    assert(requestedUrl.includes(`/country/${iso3}/indicator/FP.CPI.TOTL.ZG`), `${locale} requests ${iso3}`);
    assert(quote?.countryCode === iso2, `${locale} returns ISO2 ${iso2}`);
    assert(quote?.year === '2025' && quote.value === 3.2, `${locale} selects latest non-null observation`);
    assert(quote?.source === 'World Bank', `${locale} preserves source attribution`);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`${passed} assertions passed, ${failures.length} failed`);
for (const failure of failures) console.error('FAIL', failure);
if (failures.length) process.exit(1);
