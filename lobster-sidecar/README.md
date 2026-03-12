# Lobster Sidecar

This is an independent Python sidecar adapter for AgentCore OS desktop builds.

Why it exists:

- The checked-out `lobster-src/` repo is an Electron desktop app, not a Python HTTP service.
- AgentCore OS desktop mode needs a local HTTP sidecar contract.
- This adapter gives Tauri a stable local backend to talk to first, then you can bridge real Lobster capabilities behind it.

Current responsibilities:

- health check
- heartbeat/self-termination
- runtime diagnostics
- runtime sidecar config persistence
- publish config persistence
- publish queue/job persistence
- IM bridge for DingTalk / Feishu / generic webhook remote commands

Not yet implemented:

- real Lobster task execution bridge
- OpenAI-compatible agent execution
- file asset serving
- OpenClaw engine gateway compatibility beyond basic placeholders

Run in development:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080
```

Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080
```

Recommended build Python:

- prefer Python `3.11` or `3.12` for release sidecar packaging
- Python `3.14+` may work, but the PyInstaller hook chain is less predictable

Package example:

```bash
npm run desktop:prepare-sidecar
npm run desktop:package
```

Notes:

- `desktop:build-sidecar` writes PyInstaller cache into `./.cache/pyinstaller` so it does not depend on the user profile directory.
- `desktop:build-sidecar` can fall back to `python -m PyInstaller` if the standalone launcher is missing from `PATH`.
- `tauri`, `tauri:dev`, and `tauri:build` resolve `cargo` from common install locations such as `~/.cargo/bin` when PATH is incomplete.

## IM bridge endpoints

- `GET /api/im-bridge/config`
- `PUT /api/im-bridge/config`
- `GET /api/im-bridge/health`
- `POST /api/im-bridge/test`
- `POST /api/im-bridge/inbound/{provider}`

Where `provider` is one of:

- `generic`
- `feishu`
- `dingtalk`

The desktop UI exposes these settings under `设置 -> 移动端接入`.
