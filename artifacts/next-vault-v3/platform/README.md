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


## Cloudflare Workers deployment adapter

The Cloudflare entrypoint is `../src/worker.ts`, configured by
`../wrangler.jsonc`. It serves the existing Vite output from
`../dist/public` and adapts the seven existing root API handlers without
rewriting their business logic.

For the Cloudflare Workers Builds dashboard, keep the project root at
`artifacts/next-vault-v3` and use:

- Build command: `pnpm run build`
- Deploy command: `pnpm dlx wrangler@4.166.0 deploy`

The explicit pnpm command avoids Wrangler's npm auto-configuration, which
cannot parse this workspace's `catalog:` and `workspace:*` dependency
protocols.

Configure `SEC_USER_AGENT` as a Worker secret only when a real SEC contact
identity is available. Do not put the value in source control. The Supabase
Edge Functions remain hosted by Supabase; this adapter does not migrate them.
