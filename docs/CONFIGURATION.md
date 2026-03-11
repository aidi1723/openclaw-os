# Configuration

## Settings storage

The app now uses two storage layers:

### 1. Browser localStorage

Key:
- `openclaw.settings.v1`

This currently includes:
- LLM provider config (API key/base URL/model)
- Engine base URL/token
- UI personalization (wallpaper)

### 2. Server-side local file store

AgentCore OS now stores publish-specific state under:

- `.openclaw-data/publish-config.json`
- `.openclaw-data/publish-jobs.json`

This currently includes:
- publishing connector tokens and webhook URLs
- publish queue/job state
- queued draft snapshots used for server-side publish execution
- publish results and retry metadata

## Reset settings

In your browser devtools:
- Application → Local Storage → delete `openclaw.settings.v1`

To reset publish connector state and publish jobs:
- delete `.openclaw-data/publish-config.json`
- delete `.openclaw-data/publish-jobs.json`

## Connector webhooks

For “auto publish” dispatch:

1) Run the example connector: `npm run webhook:dev`
2) In Settings → Accounts/Publishing set `Publish Webhook URL` to:
   `http://127.0.0.1:8787/webhook/publish`

For production, replace with your own connector endpoint.

## Important

The file-backed server store is a step up from browser-only storage for publish flows, but it is still not a production-grade secret management system.

For real deployments:
- move secrets to managed server-side storage
- add auth and per-user isolation
- restrict file access and backups appropriately

## Queue execution secret

If you want the publish queue runner route to require a secret, set:

- `OPENCLAW_QUEUE_SECRET`

Clients that call `/api/publish/queue/run` should then send either:
- `Authorization: Bearer <secret>`
- `x-openclaw-queue-secret: <secret>`

The bundled worker script `npm run publish-queue:worker` supports this automatically.

Operational examples for PM2, `systemd`, and `launchd` are available under:

- [`deploy/pm2/`](/Users/aidi/agent桌面/agentcore-os/deploy/pm2)
- [`deploy/systemd/`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd)
- [`deploy/launchd/`](/Users/aidi/agent桌面/agentcore-os/deploy/launchd)

Base environment variable examples are in:

- [`.env.example`](/Users/aidi/agent桌面/agentcore-os/.env.example)
