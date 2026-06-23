# Integrations

External services plug in through two kinds of modules:

- **`issue-tracker/`** — project/issue metadata for the timer picker and log labels (Jira today; Asana would live here)
- **`time-tracker/`** — tracked time shown alongside Watson reports (Hubstaff today; Clockify would live here)

## Server layout

Each integration is a folder with three files:

| File | Role |
| --- | --- |
| `config.ts` | Env + `clients.config` normalization, legacy global config, `isConfigured` |
| `service.ts` | API client, caching, per-client resolution |
| `routes.ts` | Express routes under `/api/<id>/...` |

Register new integrations in `registry.ts`:

```typescript
export const asanaIntegration: ServerIntegration<ClientAsanaConfig> = {
  id: "asana",
  kind: "issue-tracker",
  label: "Asana",
  configKey: "asana",
  enabledCountKey: "asanaEnabledClientCount",
  clientConfiguredKey: "asanaConfigured",
  normalizeConfig: normalizeAsanaConfig,
  legacyGlobalConfig: legacyGlobalAsanaConfig,
  isConfigured: isAsanaConfigured,
  readClientConfig: (client) => client.asana,
  registerRoutes: registerAsanaRoutes
};
```

Then append it to `integrations`, extend `ClientConfig` / `ClientOption` / `IntegrationEnabledCounts`, and add env keys to `env.example`.

Shared helpers:

- `client-resolution.ts` — resolve config for a Watson client (same rules as Jira/Hubstaff)
- `registry.ts` — mount all routes, normalize client entries, enabled counts for `/api/options`

## Frontend layout

Mirror the server under `src/integrations/`:

| Path | Role |
| --- | --- |
| `registry.ts` | Client-side integration metadata (`apiPrefix`, flag keys) |
| `client-selection.ts` | `shouldLoadIntegration`, `buildIntegrationEndpoint` |
| `issue-tracker/<id>.ts` | `createJiraIntegration()` loader composable |
| `time-tracker/<id>.ts` | `createHubstaffIntegration()` loader composable |
| `useReportIntegrations.ts` | Orchestrates all loaders for the dashboard |

Adding Asana (issue tracker):

1. Copy `issue-tracker/jira/` pattern on the server
2. Add `issue-tracker/asana.ts` with `createAsanaIntegration()`
3. Wire it in `useReportIntegrations.ts` and `src/integrations/registry.ts`
4. Extend picker UI to use the new integration (same hooks as Jira)

Adding Clockify (time tracker):

1. Copy `time-tracker/hubstaff/` pattern on the server
2. Add `time-tracker/clockify.ts` with `createClockifyIntegration()`
3. Wire report sections through `useReportIntegrations` (same hooks as Hubstaff)

## Per-client config

Same shape as Jira/Hubstaff in `clients.config.ts`:

```typescript
{
  key: "client-a",
  tag: "client-a",
  jira: { /* ... */ },
  hubstaff: { /* ... */ },
  // asana: { /* ... */ },
  // clockify: { /* ... */ },
}
```

When multiple clients configure the same integration, select a specific client in the UI — the “All clients” view only auto-loads an integration if exactly one client has it configured.
