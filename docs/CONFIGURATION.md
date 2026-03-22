# Configuration

This project now has multiple runtime layers, so the easiest way to avoid setup friction is to configure it in stages instead of front-loading every integration.

## Recommended setup order

### Stage 1. Make the workspace usable

Configure these first in `Settings -> 大模型与助手`:

- one active LLM provider
- base URL, API key, and model
- optional assistant prompt preference

If this stage is incomplete, the desktop shell may still open, but many assistant workflows will feel broken.

### Stage 2. Add publish and webhook flows

Configure these only if you need content publishing or external automation:

- publishing webhook URL
- publishing connector token or provider credentials
- queue runner secret if the publish queue is triggered remotely

### Stage 3. Add desktop runtime features

Configure these if you need:

- Tauri desktop packaging
- local sidecar diagnostics
- IM bridge remote access from Feishu, DingTalk, or generic webhook

### Stage 4. Add LobsterAI compatibility work

Configure this only if you are actively touching `lobster-src/`:

- switch Node runtime to `24.x` before installing dependencies there
- keep the AgentCore repo on Node `20+`
- re-run desktop smoke tests after any Lobster upstream sync

## Runtime and storage map

### Browser local storage

Key:

- `openclaw.settings.v1`

Contains:

- LLM provider config
- engine base URL and token
- personalization such as wallpaper and desktop layout

### Local file-backed server store

Files:

- `.openclaw-data/publish-config.json`
- `.openclaw-data/publish-jobs.json`

Contains:

- publish webhook URLs and connector tokens
- publish queue state
- queued draft snapshots for server-side publish execution
- publish results and retry metadata

## Reset paths

### Reset browser-side settings

In browser devtools:

- `Application -> Local Storage -> openclaw.settings.v1`

### Reset publish state

Delete:

- `.openclaw-data/publish-config.json`
- `.openclaw-data/publish-jobs.json`

Use this when webhook credentials, publish retries, or queue state become inconsistent.

## Common configuration paths

### I only want the web workspace

You only need:

- LLM provider settings
- optional OpenClaw engine endpoint
- Node.js `20+`

You do not need:

- Python sidecar
- Rust/Tauri packaging
- LobsterAI checkout

### I want desktop runtime validation

You need:

- the base web workspace config
- Python `3.11` or `3.12`
- Rust for Tauri
- `npm run desktop:build-doctor`
- `npm run runtime:doctor`

You probably do not need:

- a full LobsterAI build

### I want mobile or IM remote access

You need:

- desktop sidecar running
- IM bridge configured in `Settings -> 移动端接入`
- one inbound provider token or tunnel URL

### I am working on LobsterAI integration

You need:

- separate Node `24.x` in `lobster-src/`
- a fresh install in both repos after switching versions
- a desktop smoke test after sync

Current practical advice:

- update docs and compatibility assumptions first
- only bump the bundled Lobster checkout after smoke-testing the sidecar contract

## Connector webhooks

For local auto-publish dispatch:

1. Run `npm run webhook:dev`
2. In `Settings -> Accounts/Publishing`, set `Publish Webhook URL` to `http://127.0.0.1:8787/webhook/publish`

For production, replace the endpoint with your own connector service.

## Queue execution secret

If you want the publish queue runner route to require authentication, set:

- `OPENCLAW_QUEUE_SECRET`

Clients calling `/api/publish/queue/run` should send one of:

- `Authorization: Bearer <secret>`
- `x-openclaw-queue-secret: <secret>`

The bundled worker `npm run publish-queue:worker` supports this automatically.

Operational examples are available under:

- [`deploy/pm2/`](../deploy/pm2)
- [`deploy/systemd/`](../deploy/systemd)
- [`deploy/launchd/`](../deploy/launchd)

Base environment variable examples are in [`.env.example`](../.env.example).

## Security note

The local file-backed store is good enough for local development and single-operator testing, but it is not a production-grade secret management system.

For real deployments:

- move secrets to managed server-side storage
- add auth and per-user isolation
- lock down file access and backups
