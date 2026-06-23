# Integrations

Shared integration modules used by the Express server and Vue frontend.

## Folder convention

| File | Role |
|------|------|
| `definition.ts` | Config types, normalize/isConfigured, metadata, shared helpers (e.g. issue keys) |
| `legacy-config.ts` | Env-based global config (server-only; excluded from frontend tsconfig) |
| `server.ts` | Express route registration |
| `service.ts` | API calls, caching, tokens |
| `client.ts` | Vue loader factory (`createLoader`) |

Watson is local-only: `definition.ts` + `client.ts` only. Core Watson routes stay in `server/index.ts`.

## Manifests

- `definitions.ts` — configurable integration metadata (Jira, Hubstaff)
- `client-manifest.ts` — frontend loader exports only
- `server-manifest.ts` — server route mounting and client flag helpers

Server-only resolution lives in `server/client-resolution.ts` and `server/config-helpers.ts`.

## Imports

- Frontend: `#integrations/*` path alias
- Server: relative paths with `.js` extensions (NodeNext)
