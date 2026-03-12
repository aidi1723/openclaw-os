# Getting Started

## Requirements

- Node.js 18+ (recommended: latest LTS)
- npm

## Install

```bash
npm install
```

## Run the app

```bash
npm run dev
```

Open `http://localhost:3000/`.

## Desktop build track

If you are validating the desktop shell instead of the browser-only app, use:

```bash
npm run desktop:build-doctor
npm run runtime:doctor
npm run desktop:prepare-sidecar
npm run desktop:smoke-test-sidecar
npm run desktop:package
```

For Windows packaging status and clean-machine validation criteria, see [Windows Desktop Testing](WINDOWS_DESKTOP_TESTING.md).

## Keyboard shortcuts

- `⌘K` / `Ctrl+K`: toggle Spotlight
- `Esc` or `⌘W` / `Ctrl+W`: close top window
- `⌘M` / `Ctrl+M`: minimize top window
- `⌘⇧M` / `Ctrl+Shift+M`: restore all minimized windows
- `⌘[` / `⌘]` (or `Ctrl[` / `Ctrl]`): cycle visible windows
- `⌘⌥←/→/↑/↓` (or `Ctrl+Alt+←/→/↑/↓`): tile left/right, maximize, restore

## Optional: local webhook connector

The app supports “bring-your-own” webhook connectors for publishing workflows.
This repo includes a minimal local example connector:

```bash
npm run webhook:dev
```

Open `http://127.0.0.1:8787/`.

In WebOS: **Settings → Accounts/Publishing** set `Publish Webhook URL` to:

`http://127.0.0.1:8787/webhook/publish`

## Optional: OpenClaw integration

Some server routes call an external CLI (`openclaw`) to generate outputs.
If the CLI is not installed/available, these routes will fail gracefully and some features will fall back.
