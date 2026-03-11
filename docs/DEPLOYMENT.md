# Deployment

AgentCore OS is a standard Next.js app, but the Publisher queue now has an extra operational requirement:
if you want queued publish jobs to keep moving after the browser closes, you should run a background worker
or a scheduler that calls `/api/publish/queue/run`.

## Deployment modes

### Mode A: Preview / UI-only

Good for:
- quick demos
- UI review
- local feature development

Run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

In this mode, the browser can still help trigger the queue as long as `OPENCLAW_QUEUE_SECRET` is not set.

### Mode B: Single server + local worker

Good for:
- one-person usage
- self-hosted demos
- practical local publishing workflows

Run:

```bash
npm install
npm run build
npm run start
```

Then start the queue worker in another process:

```bash
npm run publish-queue:worker
```

### Mode C: App server + external scheduler

Good for:
- Vercel or other managed web hosting
- container deployments
- environments where you prefer cron/PM2/systemd/launchd over a long-running Node worker

Instead of running the bundled polling worker, call:

```text
POST /api/publish/queue/run
```

If `OPENCLAW_QUEUE_SECRET` is set, include either:

- `Authorization: Bearer <secret>`
- `x-openclaw-queue-secret: <secret>`

## Required runtime assumptions

### 1. Persist `.openclaw-data/`

The Publisher now stores server-side state in:

- `.openclaw-data/publish-config.json`
- `.openclaw-data/publish-jobs.json`

If your host uses ephemeral storage, publish config and queue state will be lost after restart or redeploy.

### 2. Decide how the queue will run

Use one of:

- browser-triggered queue for local demos only
- `npm run publish-queue:worker`
- cron calling `/api/publish/queue/run`
- PM2
- systemd timer
- launchd

### 3. Protect the queue route in real deployments

Recommended:

```bash
OPENCLAW_QUEUE_SECRET=replace-with-a-long-random-secret
```

When this env var is present:

- browser-side queue triggering is disabled
- your worker or scheduler must authenticate

## Environment variables

### App runtime

- `PORT`
  default: framework/default port
- `OPENCLAW_APP_URL`
  used by the bundled worker to call the app
  example: `http://127.0.0.1:3000`

### Queue runtime

- `OPENCLAW_QUEUE_INTERVAL_MS`
  worker polling interval
  default: `3000`
- `OPENCLAW_QUEUE_SECRET`
  optional shared secret for `/api/publish/queue/run`

Template reference:

- copy values from [`.env.example`](/Users/aidi/agent桌面/agentcore-os/.env.example)
- edit deploy templates in [`deploy/`](/Users/aidi/agent桌面/agentcore-os/deploy)

## Quick production start

### App server

```bash
npm install
npm run build
PORT=3000 npm run start
```

### Queue worker

```bash
OPENCLAW_APP_URL=http://127.0.0.1:3000 \
OPENCLAW_QUEUE_SECRET=replace-with-a-long-random-secret \
OPENCLAW_QUEUE_INTERVAL_MS=3000 \
npm run publish-queue:worker
```

## Scheduler options

## 1. Built-in Node worker

Use:

```bash
npm run publish-queue:worker
```

Best when:
- the app and worker run on the same machine
- you want the simplest practical setup

Tradeoff:
- it is a long-running process, so you still need PM2/systemd/launchd/supervisor in production

## 2. Cron with `curl`

Best when:
- your web server is already deployed
- you want a very small operational surface

Example cron entry:

```cron
* * * * * curl -fsS -X POST \
  -H "Authorization: Bearer YOUR_SECRET" \
  https://your-domain.example/api/publish/queue/run >/dev/null 2>&1
```

If you need faster pickup, call it every 15 or 30 seconds using your platform scheduler instead of classic cron.

## 3. PM2

Example file:

- [`deploy/pm2/ecosystem.config.cjs`](/Users/aidi/agent桌面/agentcore-os/deploy/pm2/ecosystem.config.cjs)

Run:

```bash
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
```

This template runs:

- the Next.js app
- the publish queue worker

Before running it, replace placeholders described in [`deploy/README.md`](/Users/aidi/agent桌面/agentcore-os/deploy/README.md).

## 4. systemd

Example files:

- [`deploy/systemd/openclaw-publish-queue-worker.service`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-worker.service)
- [`deploy/systemd/openclaw-publish-queue-trigger.service`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-trigger.service)
- [`deploy/systemd/openclaw-publish-queue-worker.timer`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-worker.timer)

Two common patterns:

- `service` only: keep the bundled worker running continuously
- `timer` + authenticated `curl`: wake up on schedule and hit `/api/publish/queue/run`

This repository includes the continuous worker example by default.

## 5. launchd (macOS)

Example file:

- [`deploy/launchd/com.openclaw.publish-queue-worker.plist`](/Users/aidi/agent桌面/agentcore-os/deploy/launchd/com.openclaw.publish-queue-worker.plist)

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.openclaw.publish-queue-worker.plist
launchctl start com.openclaw.publish-queue-worker
```

## Template cleanup before use

The example files in [`deploy/`](/Users/aidi/agent桌面/agentcore-os/deploy) now use placeholders on purpose.
Replace them exactly as described in [`deploy/README.md`](/Users/aidi/agent桌面/agentcore-os/deploy/README.md).

## Vercel notes

Vercel is still fine for preview deployments, but note the operational limits:

- local file storage is not durable unless you mount or replace it with external persistence
- the bundled worker is not something Vercel runs for you
- if `OPENCLAW_QUEUE_SECRET` is enabled, you need an external scheduler to call the queue route

Recommended Vercel pattern:

1. host the Next.js app on Vercel
2. move publish state to durable storage later
3. run queue triggering from GitHub Actions, Cron-job.org, a VPS cron, or another scheduler

## Connector and webhook notes

For local testing:

```bash
npm run webhook:dev
```

Then set a platform webhook to:

```text
http://127.0.0.1:8787/webhook/publish
```

The bundled connector is a receipt demo. It does not publish to external platforms.

## Recommended practical setup

For a stable self-hosted first version:

1. run the app with `npm run start`
2. set `OPENCLAW_QUEUE_SECRET`
3. run the worker under PM2 or systemd
4. persist `.openclaw-data/`
5. keep connector endpoints private, authenticated, and rate-limited

That setup is enough for a serious single-node deployment before moving to a database-backed queue.
