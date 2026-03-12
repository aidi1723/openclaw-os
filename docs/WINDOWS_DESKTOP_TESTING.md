# Windows Desktop Testing

## Current status

AgentCore OS is now **prepared for internal Windows packaging validation**, but it is **not yet fully verified** as "install on a brand-new Windows machine and use immediately" in production terms.

What is already in place:

- Tauri desktop shell
- bundled Python sidecar flow
- dynamic localhost port assignment
- CORS contract for desktop origin
- sidecar heartbeat / zombie-process cleanup
- desktop settings persisted through local sidecar storage
- Windows installer path aligned to `NSIS`
- WebView2 install mode aligned to Tauri's `offlineInstaller`

What is still missing before we can honestly claim true Windows out-of-box readiness:

- a real Windows build in CI or on a physical Windows machine
- installer smoke test on a clean Windows environment
- first-run validation for sidecar boot, settings save, and workflow execution
- confirmation that optional media/runtime dependencies behave correctly on Windows

## Target Windows deliverable

Current packaging direction for Windows:

- installer type: `NSIS .exe`
- runtime webview: bundled `WebView2 offline installer`
- app mode: desktop shell + packaged sidecar + static Next.js frontend
- local packaging command: `npm run desktop:package`

This avoids relying on MSI defaults and reduces first-run failure risk on fresh Windows machines.

## What "out of the box" means today

The current intended baseline is:

1. install AgentCore OS with the Windows `.exe`
2. launch the desktop app without installing Python or Node.js
3. enter a model API key in Settings
4. run the `desktop_light` workflow path immediately

This baseline does **not** yet mean every advanced local capability is zero-dependency.

## Optional capabilities and their dependencies

- `desktop_light`
  works without Docker; this is the main target for non-technical users
- `desktop_dify`
  still requires Docker Desktop and the slim local runtime stack
- `creative_studio`
  may require `ffmpeg` for local media processing flows
- `IM Bridge`
  requires simple webhook / tunnel configuration when exposing the desktop agent to DingTalk, Feishu, or similar tools

## Recommended Windows validation checklist

Run these in order on a real Windows machine:

1. `npm install`
2. `npm run desktop:build-doctor`
3. `npm run lint`
4. `npm run build`
5. `npm run desktop:prepare-sidecar`
6. `npm run desktop:smoke-test-sidecar`
7. `npm run desktop:package`
8. install the generated `NSIS .exe`
9. launch the installed app on a fresh user profile
10. enter an API key and verify:
   - settings persist after restart
   - sidecar starts and passes health check
   - runtime doctor reports `desktopLightReady`
   - Sales Desk or another primary workflow can execute

## Known risk areas

- Windows Defender or endpoint security may delay the first sidecar launch
- WebView2 installation behavior still needs real-device confirmation
- local firewall prompts may appear when IM Bridge or webhook-based integrations are enabled
- media tooling such as `ffmpeg` is not guaranteed on clean machines

## Release gate

Do not label the Windows build as fully "开箱即用" until all of the following are true:

- clean-machine install has been tested
- first-run onboarding succeeds
- API-key-only workflow succeeds
- uninstall / reinstall path is clean
- no orphaned sidecar process remains after app shutdown
