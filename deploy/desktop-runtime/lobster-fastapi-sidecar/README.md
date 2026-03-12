# Lobster FastAPI Sidecar Contract

This folder contains the AgentCore OS sidecar contract example for a FastAPI-based LobsterAI backend.

Expected runtime environment:

- `HOST`
- `PORT`
- `AGENTCORE_API_BASE_URL`
- `LOBSTER_CORS_ALLOW_ORIGINS`
- `AGENTCORE_HEARTBEAT_PATH`
- `AGENTCORE_HEARTBEAT_TIMEOUT_SECONDS`

Required endpoints:

- `GET /health`
- `POST /_agentcore/heartbeat` or the custom path from `AGENTCORE_HEARTBEAT_PATH`

Behavior contract:

- The sidecar must bind to the injected `PORT`, not a hard-coded port.
- The sidecar must allow Tauri desktop origins from `LOBSTER_CORS_ALLOW_ORIGINS`.
- The sidecar must self-terminate if the heartbeat times out.
- Use `os._exit(0)` for forced teardown if background workers may survive `sys.exit()`.
