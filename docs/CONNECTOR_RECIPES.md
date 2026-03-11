# Connector Recipes (Reference)

These are **safe, compliant** reference patterns for wiring AgentCore OS to real-world publishing and ops tools.

AgentCore OS emits a publish payload and can dispatch it to a webhook. Your connector should implement actual posting via **official APIs** or approved services.

## Recipe A: Make (Integromat) webhook → scheduler

1. Create a scenario with a **Custom webhook** trigger.
2. Point the platform `Publish Webhook URL` (Settings → Accounts/Publishing) to the webhook URL.
3. Add downstream modules:
   - store payload in a DB/Sheet (audit trail)
   - schedule in an approved publishing tool (if available)
   - notify Slack/Email with the receipt

## Recipe B: Zapier webhook → Google Sheets + notifications

1. Catch Hook (Webhook by Zapier).
2. Create a row in Google Sheets (platform/title/body/dryRun/createdAt).
3. Send notifications (Slack/Email).
4. Optional: add a manual approval step before dispatching to a publisher.

## Recipe C: Buffer/Metricool “approved scheduler” integration

Use your connector as a normalization layer:

- Receive OpenClaw payload
- Convert it to the scheduler’s required fields
- Submit via the scheduler’s API (or supported automation entry points)
- Return `{ ok: true, id }` back to AgentCore OS for receipts

## Recipe D: Internal queue + retries

For reliability, implement:

- durable queue (Redis/SQS/etc.)
- per-platform concurrency limits
- retry with exponential backoff
- idempotency key (so a retry doesn’t double-post)

