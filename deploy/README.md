# Deploy Templates

This folder contains ready-to-edit deployment examples for the publish queue worker.

## Before use

Replace these placeholders wherever they appear:

- `__OPENCLAW_APP_DIR__`
  absolute path to this repository on the target machine
- `__OPENCLAW_APP_URL__`
  the URL your worker should call, for example `http://127.0.0.1:3000`
- `__OPENCLAW_QUEUE_SECRET__`
  same secret configured in the app environment
- `__OPENCLAW_LOG_DIR__`
  writable directory for logs, for example `/tmp` or `/var/log/openclaw`

## Files

- `pm2/ecosystem.config.cjs`
  runs the Next.js app and the queue worker as long-running PM2 processes
- `systemd/openclaw-publish-queue-worker.service`
  long-running worker service
- `systemd/openclaw-publish-queue-trigger.service`
  single queue trigger request
- `systemd/openclaw-publish-queue-worker.timer`
  timer that invokes the trigger service
- `launchd/com.openclaw.publish-queue-worker.plist`
  macOS LaunchAgent example

## Environment setup

The repository root includes:

- `.env.example`

Use that file as the source of truth for:

- `PORT`
- `OPENCLAW_APP_URL`
- `OPENCLAW_QUEUE_INTERVAL_MS`
- `OPENCLAW_QUEUE_SECRET`

For PM2, copy values into the `env` block.
For `systemd`, put them in `Environment=` or an `EnvironmentFile=`.
For `launchd`, put them in `EnvironmentVariables`.
