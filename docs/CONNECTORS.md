# Connectors (Bring Your Own)

This project intentionally keeps “auto publish” as a **connector problem**:

- The UI prepares platform variants and a publish payload
- The server optionally dispatches to your connector webhook
- Your connector implements real posting via **official APIs** or approved services

## Webhook contract

Endpoint (example):

`POST https://your-connector.example.com/webhook/publish`

Payload (JSON):

```json
{
  "platform": "xiaohongshu",
  "title": "…",
  "body": "…",
  "hashtags": ["#tag1", "#tag2"],
  "token": "optional",
  "dryRun": false
}
```

Response:

```json
{ "ok": true, "id": "…" }
```

## Local example connector

This repo includes a small local server:

- `scripts/webhook-connector/server.mjs`
- Run with `npm run webhook:dev`
- UI at `http://127.0.0.1:8787/`

It only logs receipts — it does not post anywhere.

## Recommended real-world options

- Official platform APIs (preferred)
- Approved third-party schedulers (Buffer/Metricool/Make/Zapier)
- Internal tooling with explicit user consent and ToS compliance

## Mobile IM Bridge

AgentCore OS desktop builds now include a local `IM Bridge` in the Python sidecar so mobile users can trigger the desktop agent from DingTalk, Feishu, or any webhook-capable IM automation.

Recommended path:

- keep AgentCore OS running on the desktop
- expose the sidecar through `Cloudflare Tunnel`, `ngrok`, or `FRP`
- configure an `Access Token` in Settings -> `移动端接入`
- forward IM messages to:
  - `POST /api/im-bridge/inbound/generic`
  - `POST /api/im-bridge/inbound/feishu`
  - `POST /api/im-bridge/inbound/dingtalk`

Supported auth modes:

- `Authorization: Bearer <Access Token>`
- `X-AgentCore-IM-Token: <Access Token>`
- query string: `?token=<Access Token>`

Native-style provider checks now supported:

- Feishu: optional request-body `token` verification
- DingTalk: optional `timestamp + sign` verification with signing secret

Minimal generic payload:

```json
{
  "text": "帮我分析这份数据并生成汇报提纲",
  "sessionId": "mobile-demo-user"
}
```

Minimal DingTalk-style payload:

```json
{
  "conversationId": "cid_mobile_demo",
  "senderStaffId": "staff_mobile_demo",
  "text": {
    "content": "帮我做一份本周工作汇报 PPT"
  }
}
```

Minimal Feishu-style payload:

```json
{
  "event": {
    "sender": {
      "sender_id": {
        "open_id": "ou_mobile_demo"
      }
    },
    "message": {
      "chat_id": "oc_mobile_demo",
      "content": "{\"text\":\"帮我分析这份销售周报\"}"
    }
  }
}
```

When `Reply Webhook URL` is configured for the provider, AgentCore OS will push the execution result back to the IM channel after the desktop agent completes the task.
