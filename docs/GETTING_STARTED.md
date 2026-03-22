# Getting Started

AgentCore OS now has three practical setup tracks. Pick the lightest one that matches what you need instead of installing the full desktop toolchain by default.

For the current public release line, the recommended path is still the lightest one:

- clone the repo
- install dependencies
- run from the command line

## Choose your setup track

### 1. Browser-only

Use this if you only want the web workspace and settings UI. This is also the recommended public installation path for the current stable line.

Requirements:

- Node.js `20+` for this repo
- npm

Commands:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

### 2. Desktop shell + local sidecar

Use this if you want to validate the Tauri desktop app, local runtime diagnostics, or IM bridge access, but do not need to build the upstream LobsterAI desktop app itself.

Requirements:

- Node.js `20+` for AgentCore OS
- Rust toolchain for Tauri packaging
- Python `3.11` or `3.12` for the packaged sidecar path

Recommended validation flow:

```bash
npm install
npm run desktop:build-doctor
npm run runtime:doctor
npm run desktop:prepare-sidecar
npm run desktop:smoke-test-sidecar
npm run desktop:package
```

For Windows packaging status and clean-machine validation criteria, see [Windows Desktop Testing](WINDOWS_DESKTOP_TESTING.md).

### 3. Desktop shell + LobsterAI checkout

Use this only if you are also working on the checked-out `lobster-src/` project or validating compatibility with the upstream LobsterAI desktop runtime.

Requirements:

- Everything in track 2
- A separate Node.js `24.x` runtime when entering `lobster-src/`

Important:

- The main AgentCore OS repo still runs on Node `20+`
- `lobster-src/package.json` currently requires Node `>=24 <25`
- Do not assume one Node version works for both repos

Typical flow:

```bash
npm install
cd lobster-src
npm install
```

If you switch between the two repos frequently, use `nvm`, `fnm`, or `mise` so the Node version boundary is explicit.

## Dependency matrix

- `agentcore-os/`: web shell, desktop UI, Tauri packaging, Node `20+`
- `lobster-sidecar/`: Python HTTP adapter used by desktop builds, Python `3.11` or `3.12` recommended
- `lobster-src/`: upstream LobsterAI checkout, Node `24.x`
- `src-tauri/`: desktop shell packaging, Rust toolchain required

## First-run checklist

1. Start with browser-only mode and confirm `npm run dev` works.
2. Open Settings and fill at least one LLM provider.
3. If you need desktop capabilities, run the doctor scripts before packaging.
4. If you need Lobster compatibility, install dependencies in `lobster-src/` with Node `24.x` separately.

## Keyboard shortcuts

- `⌘K` / `Ctrl+K`: toggle Spotlight
- `Esc` or `⌘W` / `Ctrl+W`: close top window
- `⌘M` / `Ctrl+M`: minimize top window
- `⌘⇧M` / `Ctrl+Shift+M`: restore all minimized windows
- `⌘[` / `⌘]` or `Ctrl[` / `Ctrl]`: cycle visible windows
- `⌘⌥←/→/↑/↓` or `Ctrl+Alt+←/→/↑/↓`: tile left/right, maximize, restore

## Optional local services

### Webhook connector

The repo includes a minimal local example connector for publishing workflows:

```bash
npm run webhook:dev
```

Open `http://127.0.0.1:8787/`, then set:

- `Settings -> Accounts/Publishing -> Publish Webhook URL`
- value: `http://127.0.0.1:8787/webhook/publish`

### OpenClaw CLI integration

Some server routes call an external `openclaw` CLI. If it is not installed, those routes fall back gracefully, but a few automation features will stay unavailable.
