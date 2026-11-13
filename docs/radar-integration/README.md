# Radar integration evidence (Phase 1)

Screenshots taken in headless Chromium (software WebGL) against the integration branch
`integration/global-radar-on-main` (base `d4fb79a`). Full results: `docs/reconciliation-report.md`, Phase 1 section.

- `screenshots/radar/` overview, company (live Yahoo + Wikipedia + Wikidata), country (World Bank + BCB), compare, trends, sources, Arabic RTL, Chinese, Portuguese, mobile 390 px
- `screenshots/navigation/` every step of the Radar <-> existing-modules round trip, plus Japanese after reload
- `screenshots/failure-suite/` S1 module load failure, S2 refused canvas, S3 GPU draw error + retry, S4 context restored, S5 map blocked then retried
- `screenshots/market-data/` Mercado Global with Yahoo working (integration) vs failing (pristine main in dev)
- `screenshots/baseline-main/` pristine `main` views for comparison
