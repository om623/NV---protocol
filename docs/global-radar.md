# Global Radar

An interactive 3D globe of global business activity, with a company directory, country
panels, comparison, sector trends and a source registry. Every figure shows where it came
from and how old it is. Nothing is simulated.

## What it does

- 3D globe (three.js) built from real Natural Earth borders: drag/touch to rotate, scroll
  or pinch to zoom, click a country, click a cluster to zoom in, slow auto-rotation that
  pauses while you interact or read a panel.
- Directory of 286 well-known public and private companies across all seven regions and
  30 sectors. Search by name, ticker, country, continent, sector or Wikidata segment;
  filter by size class, listing and minimum USD revenue (only for companies already loaded).
- Company panel: live quote and 1M/3M change, summary (Wikipedia, in your language when
  available), founders, parent, website, financial figures, subsidiaries and countries of
  presence, recent headlines.
- Country panel: World Bank indicators (and Banco Central do Brasil for Brazil), companies
  in the directory.
- Compare up to four companies, favorites, query history (stored on the device only).
- Trends: sector price momentum (derived, labelled as analysis) and on-request headlines
  by theme (mergers, expansion, regulation). The Radar never produces projections or
  recommendations.
- All text exists in the nine NV languages.

## Data honesty

Each value is one of: available (with source and date), outdated (older than ~18 months,
still shown and flagged), not disclosed (private company without public figures) or
unavailable (the source did not answer or has no figure). Amounts keep their own currency
and are never converted or added together.

## Sources

| Source | Used for | State |
| --- | --- | --- |
| World Bank | Country indicators | Live |
| Banco Central do Brasil (SGS) | Brazil policy rate and inflation | Live |
| Wikidata | Company facts, dated financial statements, subsidiaries | Live |
| Wikipedia | Company summaries | Live |
| Yahoo Finance (via `/yf-proxy`) | Quotes and returns | Live |
| SEC EDGAR | Annual filings of US filers and ADRs | Live, needs `SEC_USER_AGENT` |
| GDELT (via `/api/radar-news`) | News | Live, rate-limited by the provider |
| Companies House, CVM, B3, other central banks, national registries | Planned | Not connected |

## Configuration

`SEC_USER_AGENT` (server environment variable, also read from the repo `.env` in dev):
a real contact identity, for example `YourCompany [REDACTED_EMAIL]`. SEC rejects requests
without one. Without it the SEC figures show as unavailable and the Sources tab says so.
On Vercel, add it under Project Settings, Environment Variables, then redeploy.

## Layout of the code

- `src/radar/RadarView.tsx` page, state and layout; `src/radar/globe/` three.js engine.
- `src/radar/data/` countries, sectors, cities, company seed, source registry and
  `verified.ts` (generated: Wikidata item and price symbol per company).
- `src/radar/adapters/` one file per source, sharing cache, de-duplication, timeouts and a
  spaced queue (`http.ts`).
- `api/radar-sec.ts`, `api/radar-news.ts` server functions (served by Vite in dev).
- `supabase/migrations/20261105040000_create_global_radar_schema.sql` prepared database
  structure (not applied; the app does not depend on it).

## Adding or changing companies

Edit the table in `src/radar/data/companies.ts`, then run
`bun run scripts/radar-verify.ts`. It matches each company to a Wikidata item (label,
description, country and prominence must agree), checks every price symbol and rewrites
`verified.ts`. Anything ambiguous is printed for manual review and left without a
Wikidata item rather than guessed.

## Tests

- `pnpm --filter @workspace/next-vault-v3 run test:radar` runs 87 logic assertions
  (geometry, HQ coordinates against country borders, filters, clustering, data-state
  rules, translation completeness for all nine languages).
- The browser pass (globe, selection, search, compare, locales, mobile) was run with
  headless Chromium and software WebGL; it is not part of the repository.

## Known limits

- The directory is curated, not exhaustive. Private-company figures exist only when
  Wikidata has them.
- Company sizes are an editorial class (mega, large, mid/small), not a measured value.
- Wikidata financials can lag the latest filings; the panel shows the date.
- GDELT limits requests per source; headlines may need a retry.
- Small territories without an ISO code in the geodata (for example Kosovo) cannot be
  selected on the globe.
