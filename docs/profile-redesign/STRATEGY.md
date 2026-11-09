# Profile and Nvult redesign: integration strategy

Base: `main` `1e8a958` (includes Global Radar). Working branch: `feat/profile-nvult-redesign`.
Backups: git ref `backup/main-1e8a958-before-profile-redesign`; files in `.nv-backup/profile-redesign-2026-11-07/`
(Profile files from `main`, and both Nvult branches); old uncommitted Arc Studio tree in `git stash` and
`.nv-backup/2026-11-06-arc-studio-uncommitted/`.

## What each branch contributes

| Source | Kept (idea or asset) | Not carried over |
|---|---|---|
| `feat/nvult-nva-prototype` | Original Nvult silhouette (faceted head, twin visor bars, reactor core, jointed limbs); NV insignia emblem; full-body skin previews | Fictional "NvA" currency and purchases; hardcoded Portuguese text; "+250 LVL" reward labels (the engine does not apply `levelGrant`) |
| `feat/nvult-profile-game-ui-v2` | Achievement cards showing progress toward the level that unlocks them | Same hardcoded text; identical `NvultPrototype.tsx` (nothing extra) |
| `main` (current Profile) | All real systems: XP, level, badges, titles, skins, boost, verified on-chain XP/skin purchases, real-only leaderboard | Nothing removed |

## Design rules

1. `ProfileView.tsx` keeps its exact props contract (what `App.tsx` passes). It becomes a thin shell; the new experience lives in `src/profile/`.
2. `lib/gamification.ts`, `useGamification`, `usePurchases` and `lib/payments.ts` are not modified. The real purchase flow is reused, not re-implemented.
3. Nvult parts unlock from the **real level** (same thresholds as badges, titles and skins). There is no coin, no token and no fake purchase.
4. Every area is tagged: **LIVE** (real engine or server-verified), **LOCAL** (saved on this device only), **DEMO / SOON** (not connected).
5. Strings go through the existing i18n (nine languages) in a separate `pf.*` dictionary.
6. Only the Profile changes. The one host-level touch is the content width for the Profile view in `App.tsx`.
