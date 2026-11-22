# NV platform mirror (copy/paste experiment)

This directory is an isolated copy of support code that currently lives outside
`artifacts/next-vault-v3`. The active application source remains in
`src/` and the original workspace files remain at repository root.

## Copied areas

- `backend/api/`: copies of the root `api/` handlers and their API tsconfig.
- `backend/supabase/`: Supabase functions, migrations and config.
- `shared/lib/`: shared workspace libraries.
- `tooling/scripts/`: repository scripts.
- `workspace-config/`: root package/workspace and TypeScript configuration snapshots.

## Safety boundary

This is a structural mirror only. No imports, runtime routes, package scripts,
workspace settings, deployment settings, or existing NV modules were changed.
The original files remain authoritative. Do not point a deployment at this
mirror until the workspace is deliberately made self-contained and validated.

## Next validation

1. Compare every mirrored file with its original.
2. Rewire workspace dependencies and API routes only after dependency mapping.
3. Run typecheck, production build, WalletConnect, Bridge and module regression
   checks before any merge.
