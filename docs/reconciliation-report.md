# NV Protocol: reconciliation report (read-only audit)

Date: 2026-11-06. No merge, commit, push, reset or checkout was performed.

## 1. Which version is loaded in Arc Studio

| Item | Value |
|---|---|
| Arc Studio HEAD | `7e37227` (2026-10-14) "fix: send proxy response as Buffer..." |
| GitHub `main` (real, fetched today) | `d4fb79a` (2026-11-05) "Updated translations.ts" |
| Stale ref found in Arc Studio | `origin/main` was `b2c50f6` ("D2"); it only reflected the clone time |
| Relationship | Arc Studio HEAD is a **direct ancestor** of `main`. 0 commits only here, **178 commits only on `main`** |
| Remote branches | 67. 46 have commits not reachable from `main`; 7 are fully integrated by content |
| Uncommitted work in Arc Studio | 11 tracked files modified + 57 new files (never committed, on **no** branch) |

Consequence: `main` is strictly newer than the committed Arc Studio code, and the Arc Studio working tree holds a large body of work that exists nowhere in git.

Housekeeping done by this audit (non-destructive): all remote branches were fetched into `refs/audit/*` (git also advanced `origin/*` tracking refs); a verified backup of the uncommitted work is in `.nv-backup/2026-11-06-arc-studio-uncommitted/` (patch + archive + sha256 manifest, git-excluded via `.git/info/exclude`).

## 2. Global Radar: three separate lineages

| | A. Arc Studio working tree (the one approved in Preview) | B. `main` | C. Branches `feat/global-radar-foundation` and `feat/radar-global-visual-rebuild` |
|---|---|---|---|
| Files | `src/radar/` 36 files (4,890 lines) + `i18n/radar` + `public/radar/countries-50m.json` | `components/GlobalRadar.tsx` (371), `components/radar/RadarGlobe.tsx` (256), `lib/radar/*` (463) | `components/RadarView.tsx` (330). Both branch tips are identical |
| Globe | Real 3D WebGL (three.js), Natural Earth borders, 50m, picking by point-in-polygon, clustering, hub arcs | 2D canvas pseudo-3D, hand-drawn "simplified continent outlines" | Earlier prototype |
| Companies | **286** (285 with verified Wikidata ID, 259 listed / 27 private, 256 Yahoo symbols, 130 SEC tickers, 47 countries, 30 sectors) | **30**, with hardcoded `marketCapUsd` / `employees` marked `dataStatus: 'available'` | n/a |
| Live data | World Bank, Wikidata (SPARQL + entities), Wikipedia, Yahoo (quotes), SEC EDGAR (server fn), GDELT (server fn), BCB | none (static catalogue; source links only) | none |
| Reachable in app | Yes (sidebar item after Help) | **No**: `GlobalRadar.tsx` is not imported anywhere; `SidebarView` has no `radar`. Added in the last commit only | Yes in its own branch |
| i18n | 228 keys x 9 locales, tested | own `lib/radar/i18n.ts` (336 lines, separate mechanism) | uses main translations |
| Tests | 87 logic assertions + 40 browser checks + 17 fault checks + 17 regression checks | none | none |

Present locally and verified by code/measurement: 286 records, 3D globe, Yahoo, Wikidata, World Bank, SEC, GDELT (and BCB, Wikipedia). **None of these exist in any of the 67 remote branches** (searched for `query.wikidata.org`, `countries-50m`, `from 'three'`, `companyfacts`: zero hits).

## 3. Module comparison

| Module | Arc Studio (committed base + uncommitted) | `main` | Gap / note |
|---|---|---|---|
| NV Agent | `agentApi.ts` **rewritten** to 288 lines (base 745) with a new `agentQuery(ctx, q)` signature; adds intents market_asset/category/news, history/settings/help/swap_info | 1,084-line `agentApi.ts` plus `nvAgentCore`, `agentMemory`, `agentPayments`, `agentUtterances`, `nvVoiceClient`, `NVAgentOrb`, CLI policy, CRE `nv-autonomous-payments`, LLM endpoints | **My rewrite drops base functionality (`AgentQueryOptions`, overloads) and must not replace main's.** Port only the 7 extra intents on top of main's |
| WalletConnect | Uncommitted: SDK-based (`@walletconnect/ethereum-provider` 2.26.0, `qrcode`), non-blocking QR panel, 16 keys x 9 locales, env `VITE_WALLETCONNECT_PROJECT_ID` | **Absent** (`walletDiscovery.ts`: "intentionally not fabricated") | Branch `feat/reown-appkit-walletconnect` has a CDN-loaded variant with a **hardcoded fallback Project ID** in source |
| Swap | Sidebar shortcut to the dashboard card (no LI.FI) | `swap` view, `lifiSwap.ts`, `lifiTokens.ts`, `testnetV3Swap.ts` (real DEX on testnets) | main is ahead |
| Bridge / CCTP | unchanged from base | `BridgeView.tsx` +55 lines; `cctp.ts` unchanged | Branch `feat/cctp-third-party-erc20` (CCTPx panel + executor, 2 files) is **unmerged** |
| Solana | unchanged | unchanged (`cctpSolana*.ts` identical to base) | no gap |
| Mercado Global | base fixes (copper HG, real sparks) | kept those fixes and extended: `marketData` +166, `indices` +125, `MarketGrid` +232, B3 proxies, policy rate, inflation | main ahead; Arc Studio has no Mercado changes uncommitted |
| TVL | base `tvl.ts` | `tvl.ts` rewritten (319 lines changed) and zero-TVL fix | main ahead |
| Histórico / Relatórios / Config / Ajuda | uncommitted `HistoryView`, `SettingsView`, `HelpView` (+ `txHistory.ts`; nothing writes to the store yet) | `ProtocolModules.tsx` (History/Reports/Settings/Help) fed by `activityLog.ts` | Two parallel implementations. main's is wired and is the reference |
| Consulte | **absent** (still `carteira`) | `ConsulteView.tsx` replaces `carteira`; `consulte` view | Arc Studio lacks Consulte entirely |
| Pools / simulation | `pools` view removed, `PoolsView.tsx` left as dead file | `PoolsView.tsx` and `SimAdvancedMetrics.tsx` **deleted**; `pools`/`simulacao` removed | main completed it |
| CI | none | `.github/workflows/nv-protocol-validation.yml` (typecheck+build, CRE config check) | |

## 4. Exists only in Arc Studio (uncommitted)

New files (57): `src/radar/**` (36), `src/i18n/radar/*` (6), `public/radar/countries-50m.json`, `api/radar-sec.ts`, `api/radar-news.ts`, `src/lib/walletConnect.ts`, `src/components/WalletConnectPanel.tsx`, `src/components/{History,Settings,Help}View.tsx`, `src/lib/txHistory.ts`, `scripts/radar-tests.ts`, `scripts/radar-verify.ts`, `supabase/migrations/20261105040000_create_global_radar_schema.sql`, `docs/{global-radar,walletconnect,nv-progress}.md`.
Modified tracked files (11): `package.json`, `App.tsx`, `NVIntelligence.tsx`, `WalletPickerModal.tsx`, `translations.ts`, `index.css`, `agentApi.ts`, `intelligence.ts`, `vite.config.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
**No path collisions**: none of the 57 new files exists on `main`.

## 5. Exists on `main` and missing in Arc Studio (70 files: 39 added, 29 modified, 2 deleted)

Added (selection): `ConsulteView`, `ProtocolModules`, `DashboardConverter`, `NVAgentOrb`, `GlobalRadar` + `radar/RadarGlobe`, `lib/radar/*`, `nvAgentCore`, `agentMemory`, `agentPayments`, `agentUtterances`, `nvVoiceClient`, `activityLog`, `inflation`, `policyRate`, `lifiSwap`, `lifiTokens`, `testnetV3Swap`; serverless `api/b3-index-proxy`, `api/b3-official-index`, `api/fed-brief`, `api/tech-trends`, `artifacts/.../api/nv-agent-{chat,localize,understand}`; CRE `nv-autonomous-payments`; CLI `nv-agent-policy.mjs`; CI workflow; docs; one Supabase migration.
Heavily modified: `App.tsx` (+735/-1197), `IntelligenceColumn`, `ExecutiveDashboard`, `MarketGrid`, `NVIntelligence` (+468), `agentApi` (+443), `intelligence`, `tvl`, `marketData`, `indices`, `walletDiscovery`.
Deleted: `PoolsView.tsx`, `SimAdvancedMetrics.tsx`.
Health: `main` typechecks cleanly on its own (`tsc --noEmit` exit 0).

## 6. Exists only on branches (never reached `main`)

`CctpXPanel.tsx` + `cctpXExecutor.ts` (CCTPx), `GlobalAssetMarkets.tsx`, `RadarView.tsx` (earlier Radar), `NVWorkspaceModules.tsx`, `NvultPrototype.tsx` (Nvult profile game), `walletConnect.ts` (CDN variant), `agentActionOrchestrator.ts`, `RwaMarketsView.tsx`, and two docs. 46 branches carry commits outside `main`; most are superseded by squash but must be reviewed individually before deletion. `standalone-vite-conversion` is an older, structurally different layout (46 files) and should **not** be merged.

## 7. Merge forecast (dry run in git's object store)

Overlapping tracked files: 8. **6 conflict (20 hunks)**, 2 merge cleanly.

| File | Hunks | What collides |
|---|---|---|
| `src/App.tsx` | 11 | imports; `SidebarView` (`carteira`/`pools`/`simulacao` vs `consulte`/`swap`); valid-view list; wallet connect/disconnect (my WalletConnect vs main's session ref); main container class; History vs Dashboard blocks; right column |
| `src/lib/agentApi.ts` | 5 | two unrelated implementations |
| `NVIntelligence.tsx`, `translations.ts`, `intelligence.ts`, `package.json` | 1 each | |
| `WalletPickerModal.tsx`, `vite.config.ts` | 0 | clean |
| `index.css`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | n/a | untouched by `main` (lockfile must be regenerated) |

## 8. Regression risks (highest first)

1. **Uncommitted work exists only in this sandbox.** Radar, WalletConnect and the views are in no commit. (Backup taken.)
2. **`agentApi.ts`:** taking my version would delete main's NV Agent (1,084 lines, memory, payments, voice). Taking main's would drop my 7 intents and require reverting my `NVIntelligence` call site.
3. **`App.tsx`:** main removed `carteira`, `pools`, `simulacao` and added `consulte`/`swap`. My WalletConnect, Radar nav and History/Help wiring reference the old structure.
4. **Duplicate modules:** my `HistoryView`/`SettingsView`/`HelpView` vs main's `ProtocolModules`; main's `GlobalRadar` vs my Radar (two sidebar `radar` entries and two `nav.radar` meanings if both land).
5. **Serverless location:** main's frontend calls `/api/nv-agent-chat|understand|localize`, but those functions live only in `artifacts/next-vault-v3/api/`. A repo-root Vercel deployment (what served `yf-proxy`) will not deploy them. Mirror them into root `api/` or set the Root Directory.
6. **Data-integrity regression on main:** the catalogue's hardcoded market caps and employees labelled "available" conflict with the no-invented-data rule.
7. **WalletConnect:** the branch variant hardcodes a fallback Project ID and pulls code from public CDNs; mine needs `VITE_WALLETCONNECT_PROJECT_ID` and the `pnpm-workspace.yaml` `allowBuilds` entry.
8. **Dependencies:** my branch adds `three`, `topojson-client`, `world-atlas`, `qrcode`, `@walletconnect/ethereum-provider`; main adds none. Lockfile merge must be regenerated, not hand-merged.
9. **Translations:** `translations.ts` is shared; main reworked locale dictionaries (anti-leakage fixes). My additions must be re-applied on top, then re-run the 9-locale checks.

## 9. Recommended integration order (not executed)

1. Keep the backup; do not reset anything.
2. Create an integration branch from `origin/main`.
3. Add the 57 collision-free files (Radar, i18n/radar, api/radar-*, scripts, docs, migration).
4. Hand-apply onto main's files: sidebar `radar` entry + lazy boundary in `App.tsx`; Radar-width container and right-column rule; merge `translations.ts` by union; `package.json` deps union; regenerate lockfile.
5. `agentApi.ts`/`NVIntelligence.tsx`/`intelligence.ts`: take main; optionally port history/settings/help/swap_info/market_news intents as additions.
6. Decide WalletConnect: SDK variant (mine) re-targeted to Consulte/header, with no hardcoded ID; drop the CDN variant.
7. Decide History/Help: keep main's modules; drop or archive my duplicates.
8. Retire main's orphan `GlobalRadar` once the approved Radar is confirmed.
9. Fix function locations for `nv-agent-*`; run typecheck, build, `test:radar`, and the browser suites.
10. Review the 13 branch-only artifacts one by one (CCTPx first).

## 10. Decisions needed from you

- Confirm the Radar in the Arc Studio Preview (lineage A) is the one to keep.
- WalletConnect: SDK (mine) or CDN variant, and who supplies the Project ID.
- Keep main's History/Reports/Settings/Help (recommended) or mine.
- Whether CCTPx and the other branch-only modules should join the integration.

---

# PHASE 1: Global Radar integrated on `main` (d4fb79a)

Status: **MERGED** (see section 10). The Radar was committed and merged into the updated `main` lineage; it is **not pushed** and **not exposed in the Preview**.
`origin/main` (GitHub state as fetched), the local `main` and the Arc Studio working folder are unchanged.

## 1. Where it lives

| Item | Value |
|---|---|
| Branch | `integration/global-radar-on-main` (still points at `d4fb79a`: nothing committed) |
| Worktree | `/home/user/app/.nv-integration` (git-excluded; separate from the Preview tree) |
| Pristine reference | `/home/user/app/.nv-main-ref` (detached `d4fb79a`, used only for before/after comparisons) |
| Safety exports | `.nv-backup/phase1-integration-2026-11-06/` (patch + new-files archive + sha256; dry-run restore onto pristine `d4fb79a` verified) and the older `.nv-backup/2026-11-06-arc-studio-uncommitted/` (WalletConnect and everything else from the old tree) |
| Evidence | `docs/radar-integration/screenshots/` (34 images) |

## 2. What was incorporated (49 new files, 6 modified)

New: `src/radar/**` (36 files: 3D globe engine, 7 panels, 8 live-data adapters, 286-company dataset, store, filters), `src/i18n/radar/*` (6; 229 keys x 9 languages), `public/radar/countries-50m.json`, `api/radar-sec.ts`, `api/radar-news.ts`, `scripts/radar-tests.ts`, `scripts/radar-verify.ts`, the Supabase schema migration (not applied) and `docs/global-radar.md`.

Modified (surgical edits, nothing replaced wholesale):

| File | Change |
|---|---|
| `src/App.tsx` | +33/-12: lazy Radar + error boundary, `radar` view after Help, purple pulsing nav style, full-width container, Intelligence column hidden only inside the Radar |
| `src/i18n/translations.ts` | +13: import and merge of the nine Radar dictionaries (only `nav.radar` overlapped, same value) |
| `src/index.css` | +35: Radar glow classes |
| `vite.config.ts` | +34/-2: dev middleware serving `/api/radar-*`, optimizer pre-bundling for `three`/`topojson-client`, **and the `/yf-proxy` fix (see 6)** |
| `package.json` | +8/-1: `three`, `topojson-client`, `world-atlas` and their 3 type packages, plus `test:radar` |
| `pnpm-lock.yaml` | +103, regenerated from main's lockfile; `--frozen-lockfile` passes |

Left byte-identical to `main` (verified): `agentApi.ts`, `NVIntelligence.tsx`, `intelligence.ts`, `ConsulteView.tsx`, `ProtocolModules.tsx` (History/Reports/Settings/Help), `BridgeView.tsx`, `cctp.ts`, `cctpSolana.ts`, `lifiSwap.ts`, `tvl.ts`, `marketData.ts`, `WalletPickerModal.tsx`.
Excluded on purpose (Phase 2): WalletConnect (no dependency, env var, UI or build setting), CCTPx, my History/Settings/Help views, `txHistory.ts`, the rewritten `agentApi.ts`.

## 3. The six predicted conflicts, resolved

None materialized as textual conflicts because only Radar lines were applied onto `main`'s files: `App.tsx` (11 hunks) and `package.json` hand-merged; `translations.ts` union; `agentApi.ts`, `NVIntelligence.tsx`, `intelligence.ts` taken as `main` (my rewrite discarded); `WalletPickerModal.tsx` and `vite.config.ts` merged cleanly.

## 4. Test results (all on the integration branch)

| Suite | Result |
|---|---|
| Typecheck (app) / Typecheck (`api/`) | pass / pass |
| `pnpm install --frozen-lockfile` (what Vercel runs) | pass |
| Production build | pass (see bundle impact) |
| Radar logic (`test:radar`) | 87 / 87 |
| Radar browser: desktop + mobile | pass (globe, 27 clusters, country picking, panels, compare, trends, saved, sources) |
| Nine languages (no raw keys, Arabic RTL, no JS errors) | 19 / 19 |
| Navigation across all modules (Radar <-> Swap, Consulte, Bridge, Solana, Dashboard, Help, Intelligence, History; Japanese after reload) | 33 / 33 |
| Failure suite (module load failure, refused canvas, GPU draw errors, context loss/restore, map blocked/missing/retry) | 17 / 17 (S3-S5 from the first full run, S1-S2 re-run after fixing my own test criteria: 7 / 7) |
| Existing-module sweep vs pristine `main` (11 modules) | same content size and same errors as `main`; Radar adds 0 new errors |
| Mercado Global / TVL probe | integration: Yahoo 104 ok / 0 failed, no stale markers; pristine `main` in dev: 0 ok / 105 failed (see 6) |

Bundle impact: always-loaded JS 1,747 kB -> 1,828 kB (+81 kB, +32 kB gzip, mostly the nine-language strings); CSS +13 kB. Loaded only when the Radar opens: engine 686 kB (183 kB gzip) and map 756 kB (233 kB gzip).

## 5. Pre-existing on `main` (not caused by the Radar)

1. **`/yf-proxy` dev proxy is broken** (wrong regex copied from the B3 block): 404 in dev and Preview, so Yahoo-based Mercado Global data fails there. Production is unaffected (Vercel rewrite).
2. **`nv-agent-chat`, `-understand`, `-localize` are not published on Vercel**: they live in `artifacts/next-vault-v3/api/`, but the deployment root is the repo root (live check: GET returns the SPA HTML and POST behaves like a non-existent path; `tech-trends`, `yf-proxy`, `b3-*`, `fed-brief` respond). They also 404 in dev.
3. **Embedded YouTube player** throws `this.api.isExternalMethodAvailable is not a function` and a `compute-pressure` permissions-policy message (third-party iframe).
4. **Duplicate React keys** (`USD`, `0-USD`, `1-USD`) in a currency list; reproduced on pristine `main` once data loads.
5. Third-party noise on the baseline: CoinGecko CORS/429, an RSS aggregator returning 422 for one Korean feed, assorted 401/403/404.
6. The orphan 2D Radar (`GlobalRadar.tsx`, `components/radar/RadarGlobe.tsx`, `lib/radar/*`, ~1,100 lines) is dead code with hardcoded market caps and headcounts marked "available".
7. The NV Agent orb is a fixed floating widget above every view, including the globe; it passes over markers and its button is clickable.

## 6. The `/yf-proxy` correction (isolated)

One line in `vite.config.ts`: `rewrite: path.replace(/^\/b3-index-proxy/, '')` -> `path.replace(/^\/yf-proxy/, '')`. It exists only as an uncommitted edit in `.nv-integration`. Verified: `origin/main`, the integration branch tip and the pristine reference all still contain the original line; the only other occurrence is the correct one for `/b3-index-proxy`. It is needed because the Radar's company prices and Mercado Global both use that route in dev/Preview. It is easy to drop if you prefer to fix it separately.

## 7. Introduced by the Radar

- **Regressions found: none.** No existing module changed behavior, content size or error profile.
- New surface: one sidebar entry; two Vercel functions (7 functions in total at the repo root); two new static/lazy assets; three runtime dependencies.
- Requires setup to be complete: `SEC_USER_AGENT` (a real contact, server-side) for SEC financials; without it SEC figures show as unavailable.
- Limits: GDELT news is rate-limited (this sandbox's IP is blocked most of the time, so only the error state was seen); the Supabase schema is not applied.

## 8. Not tested

Real wallet transactions (Swap, Bridge, CCTP, Solana), the NV Agent against live LLM endpoints (not available in dev or Vercel today), real GPUs, Safari/Firefox, iOS/Android devices, a real Vercel preview deployment.

## 9. Decisions waiting on you

1. Authorize making the integration visible in the Preview (nothing has been switched).
2. Keep or drop the `/yf-proxy` fix inside this integration.
3. Publish the three `nv-agent-*` functions (mirror into root `api/`) in a separate step?
4. Retire the orphan 2D Radar files once you are satisfied?
5. Provide the `SEC_USER_AGENT` contact when you want SEC data live.

## 10. Merge executed

| Item | Value |
|---|---|
| Radar commit | `862c7b0` on `integration/global-radar-on-main` (parent `d4fb79a`); 55 files, +6,216 / -15 |
| Merge commit | `1e8a958` on **`main-with-global-radar`**, parents `d4fb79a` (updated main) and `862c7b0`; **0 conflicts** |
| Where | `/home/user/app/.nv-main-ref` (clean worktree). The merged tree is byte-identical to the integration tip |
| Not touched | `origin/main` = `d4fb79a`; local `main` = `7e37227` (still checked out in the Arc Studio folder with its 11 modified files and uncommitted work); nothing pushed |
| Portable copy | `.nv-backup/phase1-integration-2026-11-06/main-with-global-radar.bundle` (verified; requires only `d4fb79a`) |

Why a branch called `main-with-global-radar` and not `main` itself: the local `main` is checked out in the Arc Studio folder, which still holds uncommitted work. Moving that ref would silently rewrite the folder under the Preview, which you asked me not to do. The new branch descends directly from the updated `main`, so publishing it as `main` is a plain fast-forward.

### Validation of the merged result

| Check | Result |
|---|---|
| Scope vs `d4fb79a` | 55 files: 6 modified (`package.json`, `App.tsx`, `translations.ts`, `index.css`, `vite.config.ts`, lockfile), 49 new, 0 deleted |
| 22 protected files (NV Agent core, Consulte, History/Reports/Settings/Help module, Swap, LI.FI, Bridge, CCTP, Solana, Mercado Global, TVL, Dashboard, wallet picker) | all byte-identical to `main` |
| WalletConnect / CCTPx / Reown / qrcode in the added code | none |
| `/yf-proxy` fix | present (`/^\/yf-proxy/`), only in the merge |
| Typecheck app / `api/` | pass / pass |
| Production build (merged tree, Vite) | pass; output hashes identical to the integration build (`RadarView-C5MpZGKR`, `index-Bgqho6-x`) |
| Official `pnpm run build` + `pnpm install --frozen-lockfile` (integration worktree, identical tree) | pass / pass (running pnpm inside the reference worktree is refused because its `node_modules` is a symlink; this is a pnpm safety check, not a build error) |
| Radar logic (`test:radar`) | 87 / 87 |
| Navigation round trip (Radar <-> every module) | 33 / 33 |
| Radar browser suite: desktop, nine languages (Arabic RTL), mobile | 40 / 40 |
| Existing-module sweep vs pristine `main` | content within 1% for all 11 modules, same error profile, NV Agent probe unchanged |

During validation the first navigation run on the merged tree was killed by the kernel out-of-memory killer (the headless browser, not the app). After freeing memory it passed 33 / 33.

Pre-existing issues (unchanged, section 5): the `isExternalMethodAvailable` YouTube-embed error, the duplicate "USD" key warning, unpublished `nv-agent-*` functions, the orphan 2D Radar files, third-party CORS/429 noise, the tooltip sourcemap build message.

### To publish (not executed)

From a clone with GitHub access (or from this folder with credentials): fetch the bundle or push the branch, then fast-forward `main`:
`git fetch <path-to>/main-with-global-radar.bundle main-with-global-radar:main-with-global-radar && git push origin main-with-global-radar:main`

To make the Preview show it, the Arc Studio folder must move to this lineage. That rewrites its working files, so it needs your explicit go-ahead; the old uncommitted work is preserved in `.nv-backup/2026-11-06-arc-studio-uncommitted/`.

