# Deploy Templates

This folder contains ready-to-edit deployment examples for the publish queue worker and the upcoming AgentCore desktop runtime sidecar.

## Before use

Replace these placeholders wherever they appear:

- `__OPENCLAW_APP_DIR__`
  absolute path to this repository on the target machine
- `__OPENCLAW_APP_URL__`
  the URL your worker should call, for example `http://127.0.0.1:3000`
- `__OPENCLAW_QUEUE_SECRET__`
  same secret configured in the app environment
- `__OPENCLAW_LOG_DIR__`
  writable directory for logs, for example `/tmp` or `/var/log/agentcore`

## Files

- `pm2/ecosystem.config.cjs`
  runs the Next.js app and the queue worker as long-running PM2 processes
- `systemd/agentcore-publish-queue-worker.service`
  long-running worker service
- `systemd/agentcore-publish-queue-trigger.service`
  single queue trigger request
- `systemd/agentcore-publish-queue-worker.timer`
  timer that invokes the trigger service
- `launchd/com.agentcore.publish-queue-worker.plist`
  macOS LaunchAgent example
- `desktop-runtime/docker-compose.agentcore-runtime.example.yml`
  placeholder compose template for a slim AgentCore + Dify sidecar stack
- `desktop-runtime/.env.agentcore-runtime.example`
  example local environment values for the desktop sidecar stack

## Environment setup

The repository root includes:

- `.env.example`

Use that file as the source of truth for:

- `PORT`
- `OPENCLAW_APP_URL`
- `OPENCLAW_QUEUE_INTERVAL_MS`
- `OPENCLAW_QUEUE_SECRET`
- `AGENTCORE_RUNTIME_PROFILE`
- `AGENTCORE_RUNTIME_APP_URL`
- `AGENTCORE_RUNTIME_URL`
- `AGENTCORE_DIFY_BASE_URL`
- `AGENTCORE_COMPOSE_PROJECT`

For PM2, copy values into the `env` block.
For `systemd`, put them in `Environment=` or an `EnvironmentFile=`.
For `launchd`, put them in `EnvironmentVariables`.

## Desktop Runtime Notes

The desktop runtime examples intentionally avoid bundling any local LLM.

Recommended strategy:

- desktop shell: `Tauri`
- inference: cloud APIs only
- local orchestration: optional `docker compose`
- local services: Redis / Postgres / vector store / slim Dify-compatible sidecar

The compose example uses placeholders on purpose. Replace image names and secrets to match the exact Dify version you pin in your own release process.
