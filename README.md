# Watson Web UI

Local-first web UI for [Watson](https://github.com/jazzband/Watson), built with TypeScript, Vue, Vite, and Express.

It gives you a phone-friendly dashboard for the active timer, daily reports, project totals, log cleanup, and optional Jira issue titles while keeping Watson itself local on your machine.

## Features

- Current Watson timer with live stopwatch
- Start, stop, and switch-task controls
- Today, week, month, and all-time reports
- Daily breakdowns, totals by project, and log entries
- Permanent removal of saved Watson frames
- Optional Jira Cloud issue summaries for project keys like `PI-491`
- Optional Hubstaff tracked time in reports (per client, cached server-side)
- Installable PWA with a service worker and manual update trigger from the version badge
- Mobile layout with a safe-area-aware bottom stop bar

## Requirements

- Node.js 20.19+ or 22.12+
- Watson CLI 2.1.0 or newer
- Optional: Jira Cloud API token for issue titles

The app shells out to the local `watson` CLI. It never stores Watson data itself.

## Quick Start

```bash
npm install
cp env.example .env   # optional: host/port and Jira settings
npm run build
npm start
```

By default the production server binds to `0.0.0.0:3131` and serves both the web UI and API:

```text
http://localhost:3131
```

Override the production bind with environment variables:

```bash
HOST=127.0.0.1 PORT=8080 npm start
```

or for LAN/Tailscale access:

```bash
HOST=0.0.0.0 PORT=3131 npm start
```

Open:

- Local: `http://localhost:3131`
- Tailscale/LAN: `http://<machine-ip>:3131`

For iPhone PWA/offline support, serve production over HTTPS. HTTPS is opt-in and does not change the default HTTP server unless `SSL_ENABLED=true` or `HTTPS=true` is set.

When enabled, provide either explicit certificate paths or an `SSL_DOMAIN` that matches the standard Let's Encrypt layout:

```text
/etc/letsencrypt/live/<your-domain>/fullchain.pem
/etc/letsencrypt/live/<your-domain>/privkey.pem
```

Use:

```bash
SSL_ENABLED=true SSL_DOMAIN=your-domain.example HOST=0.0.0.0 PORT=3131 npm start
```

Then open:

```text
https://your-domain.example:3131
```

## Development

For local development with Vite hot reload:

```bash
npm run dev
```

Dev mode serves the frontend on `WEB_HOST:WEB_PORT` (`0.0.0.0:5173` by default) and proxies API calls to the Express API on `HOST:PORT` (`0.0.0.0:3131` by default).

## Tailscale Setup

For private phone access, run the app on a machine joined to your tailnet and browse to its Tailscale IP:

```bash
HOST=0.0.0.0 PORT=3131 npm start
```

Then open:

```text
http://<machine-tailscale-ip>:3131
```

This is useful for using the PWA from an iPhone or Android device without exposing the app publicly. The app is still only as private as your tailnet and local machine, so keep Jira credentials in `.env` and do not publish the port outside your trusted network.

## PWA Install and Updates

The production build includes a web app manifest and service worker, so it can be installed from supported browsers:

```bash
npm run build
npm start
```

Open `https://<host>:<port>` and use the browser's install/add-to-home-screen action.

Service workers require a secure context. `localhost` works on the same machine. For phones, use HTTPS. Tailscale works well for private routing, but iOS still requires the page itself to be eligible for service workers.

Tap the version badge in the header to force a PWA update check. It asks the service worker to update, clears this app's cache, and reloads from the network.

## Watson Compatibility

This UI expects Watson `2.1.0` or a compatible newer version.

On startup, the server runs `watson --version` and fails fast if the CLI is missing or too old. It also checks `watson status --help` to see whether `status --json` is supported:

- If supported, `/api/status` uses `watson status --json`.
- If not supported, `/api/status` falls back to `watson log --current --all --json` plus `watson status --elapsed`.

The fallback keeps the app compatible with stock Watson 2.1.0 while upstream JSON status support is tracked in [jazzband/Watson#520](https://github.com/jazzband/Watson/pull/520).

Relevant upstream contracts:

- `watson start <project> +tag` parses project/tags and respects `options.stop_on_start`: [cli.py#L222-L279](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/cli.py#L222-L279)
- `watson status --project`, `--tags`, and `--elapsed` provide structured current-state pieces: [cli.py#L410-L471](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/cli.py#L410-L471)
- `watson log --current --json` includes the synthetic current frame and JSON frame shape: [cli.py#L908-L1074](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/cli.py#L908-L1074), [utils.py#L285-L304](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/utils.py#L285-L304)
- `watson projects` and `watson tags` list known values: [cli.py#L1140-L1185](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/cli.py#L1140-L1185)
- `watson remove --force <id>` permanently removes a saved frame: [cli.py#L1398-L1427](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/cli.py#L1398-L1427)
- Watson boolean config parsing treats `1`, `on`, `true`, and `yes` as true: [config.py#L46-L58](https://github.com/jazzband/Watson/blob/d9de4fcf3ab74f981c92c7391f4f6887971b9707/watson/config.py#L46-L58)

## Jira Integration (optional)

The app can resolve Watson project codes (e.g. `PI-491`) to Jira issue titles. Credentials stay server-side in `.env`.

### 1. Create a read-only API token

1. Open [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Choose **Create API token with scopes** (recommended)
4. Name it e.g. `watson-web-ui-readonly`
5. Select only read scopes for Jira, e.g. **`read:jira-work`**
6. Do **not** select write, delete, or admin scopes
7. Copy the token immediately (you won't see it again)

### 2. Configure `.env`

```bash
cp env.example .env
```

Edit `.env`:

```bash
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your_read_only_token
```

Optional custom JQL for the task picker:

```bash
JIRA_JQL=assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC
```

### 3. Restart the app

```bash
npm run build
npm start
```

Check Jira status:

```bash
curl http://127.0.0.1:3131/api/jira/status
```

## Hubstaff Integration (optional)

Hubstaff tracked time can appear alongside Watson totals in the range header, daily breakdown, and project totals. Credentials stay server-side in `.env` or `clients.config.ts`, matching the per-client Jira pattern.

### 1. Create a read-only personal access token

1. Sign in at [Hubstaff personal access tokens](https://developer.hubstaff.com/personal_access_tokens)
2. Create a token with scope **`hubstaff:read`** only (no write scope needed)
3. Copy the **refresh token** value Hubstaff shows you (not a short-lived access token)

Use a PAT for the Hubstaff user whose time you want in reports. To read another member's time you need a manager/owner role in that organization.

### 2. Configure `.env` or `clients.config.ts`

Single-client setup in `.env`:

```bash
HUBSTAFF_REFRESH_TOKEN=your_personal_refresh_token
HUBSTAFF_ORGANIZATION_ID=12345
# Optional: only include specific Hubstaff projects
# HUBSTAFF_PROJECT_IDS=111,222
```

Multi-client setup mirrors Jira — see `clients.config.example.ts` for `CLIENT_A_HUBSTAFF_*` fields.

Find your organization id in the Hubstaff app URL (`/organizations/{id}/...`) or via `GET /v2/organizations`.

### 3. Restart the app

```bash
npm run build
npm start
```

Check Hubstaff status:

```bash
curl "http://127.0.0.1:3131/api/hubstaff/status"
```

Cached report data is reused for 15 minutes per date range. Hubstaff OAuth tokens are persisted in `.hubstaff-tokens/org-<id>-<hash>.json` (gitignored): clients sharing the same Hubstaff account reuse one token file; separate accounts get separate files. The access token is reused until it expires — `HUBSTAFF_REFRESH_TOKEN` (or per-client `<PREFIX>_HUBSTAFF_REFRESH_TOKEN`) is only the initial seed.

### Security notes

- Never commit `.env` (it is gitignored)
- The token only needs read access; Watson start/stop still uses the local CLI only
- The app only exposes issue key, summary, status, and URL to the browser
