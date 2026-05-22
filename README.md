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

Open `http://<host>:<port>` and use the browser's install/add-to-home-screen action.

Service workers require a secure context. `localhost` works on the same machine. For phones, use HTTPS or a browser/environment that treats your private setup as eligible. Tailscale works well for private routing, but browser install/update behavior can still vary by platform.

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

### Security notes

- Never commit `.env` (it is gitignored)
- The token only needs read access; Watson start/stop still uses the local CLI only
- The app only exposes issue key, summary, status, and URL to the browser
