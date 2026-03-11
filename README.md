# AgentCore OS — Business Solution Operating System

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**From AI Tools Desktop to Business Solution Operating System.**

AgentCore OS is a Next.js + Tailwind **business solution operating system** that runs in the browser.

It combines a desktop shell, industry workspaces, role-based desks, scenario packages, local-first state,
and AI-powered workflow apps into a single operational entry point.

The project is no longer just a UI shell or an AI tools desktop. It is now aimed at giving teams and
non-technical users a faster way to enter real-world business workflows through packaged solutions,
workspaces, and workflow-driven apps.

## Project status

**Status:** `main` is ahead of `v0.2.0-alpha.1` and currently represents a release candidate state.

Current repository state:
- the desktop shell is usable
- industry workspace selection is available
- multiple packaged scenario apps are included
- one cross-app hero workflow is now runnable for `Sales Desk`
- language-first onboarding is included
- production hardening is **not** complete yet

## What’s new in current `main`

- Industry App Center: switch by industry and scenario instead of browsing isolated tools
- Solutions Hub: packaged mature workflows mapped from real-world use cases
- Multi-language entry: top-level language switcher + first-launch language onboarding
- Packaged business apps: research, content, CRM, meeting, operations, SEO, finance, learning
- Desktop UX: resizable windows + keyboard tiling/restore shortcuts
- Playbooks: local-first SOP install/save/export/import
- Publisher: dry-run and queued dispatch with connector-based publishing
- Publisher config/jobs: file-backed server storage for queue state and connector credentials
- Publisher queue runner: server-side execution path via `/api/publish/queue/run`
- Sales Hero Workflow: `Deal Desk -> Email Assistant -> Personal CRM` now shares runtime state, trigger metadata, and local asset write-back
- Structured inquiry intake: Sales Desk now captures inquiry channel, language preference, product line, and includes a sample inbound lead for first-run demo
- Multi-industry starters: Industry Hub now includes one-click solution starters for sales, creator, support, research, recruiting, and delivery workflows

## Current product positioning

AgentCore OS is now positioned as a **business solution operating system**, not just a browser desktop full of AI apps.

Current product spine:

- `industry` decides which business context the user belongs to
- `role` decides which desk and default working surface should open first
- `workflow` decides the standard sequence, trigger, human review boundary, and result asset path
- `apps` are execution components inside that workflow, not the primary product story

Current flagship example:

- `Sales Desk`
  `客户询盘 / 手动录入 -> Deal Desk -> Email Assistant -> Personal CRM -> 本地销售资产沉淀`

## What it includes

- Window manager: z-order, focus, minimize/restore, drag, snap, position persistence
- Spotlight launcher: app search + command execution
- Local-first storage: settings, drafts, tasks, publish history, app records
- Industry App Center: industry bundles and custom workspace builder
- Solutions Hub: curated real-world workflows you can install as Playbooks
- Playbooks: local-first SOP library (export/import as JSON)
- Multi-language shell: Chinese, English, Japanese, custom language label
- Publishing hub: safe-by-default dispatch with bring-your-own connectors
- Example local webhook connector with receipts UI (`npm run webhook:dev`)
- API routes for LLM / OpenClaw / publish dispatch workflows

## Packaged app areas

- Content and media
  - Tech News Digest
  - Creator Radar
  - Content Repurposer
  - Social Media Auto-pilot
  - Website SEO Studio
- Business operations
  - Personal CRM
  - Email Assistant
  - Deal Desk
  - Meeting Copilot
  - Project Ops Board
  - Financial Document Bot
- Research and knowledge
  - Deep Research Hub
  - Knowledge Vault
  - Second Brain
  - Morning Brief
- People and recruiting
  - Recruiting Desk
  - Task Manager
- Personal productivity
  - Family Calendar
  - Habit Tracker
  - Health Tracker
  - Language Learning Desk

## What it does **not** do

- No scraping-based social automation
- No unofficial posting flows against platforms
- No built-in auth / multi-tenant security model
- No production-grade secret storage or auth model by default

## Quick start

```bash
npm install
npm run dev
```

Optional env template:
- [`.env.example`](/Users/aidi/agent桌面/agentcore-os/.env.example)

Open:
- App UI: `http://localhost:3000/`
- Optional local connector UI: `http://127.0.0.1:8787/`

## Optional webhook connector

Run the local connector example:

```bash
npm run webhook:dev
```

Optional: run the publish queue worker without relying on an open browser tab:

```bash
npm run publish-queue:worker
```

Production examples for PM2, `systemd`, and `launchd` live under [`deploy/`](/Users/aidi/agent桌面/agentcore-os/deploy).
Template placeholders and replacement instructions are in [`deploy/README.md`](/Users/aidi/agent桌面/agentcore-os/deploy/README.md).

Then in **Settings → Accounts/Publishing**, set a platform's `Publish Webhook URL` to:

`http://127.0.0.1:8787/webhook/publish`

This example connector only records receipts locally. It does **not** publish to any external platform.

## Documentation

### Start here
- [Getting Started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Solution OS Direction](docs/SOLUTION_OS.md)
- [Hero Workflow Strategy](docs/HERO_WORKFLOW.md)
- [Connectors](docs/CONNECTORS.md)
- [Connector Recipes](docs/CONNECTOR_RECIPES.md)
- [Use Cases](docs/USE_CASES.md)
- [Privacy](docs/PRIVACY.md)

### Operational docs
- [Configuration](docs/CONFIGURATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Next Steps](docs/NEXT_STEPS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Open Source Checklist](docs/OPEN_SOURCE_CHECKLIST.md)
- [Releasing](RELEASING.md)

### Release notes
- [v0.1.0](docs/releases/v0.1.0.md)
- [v0.2.0-alpha.1](docs/releases/v0.2.0-alpha.1.md)
- [v0.2.0 (draft)](docs/releases/v0.2.0-draft.md)

## Repository structure

```text
src/
  app/            Next.js App Router pages and API routes
  components/     Desktop shell and app window components
  lib/            Local-first state and helper modules
scripts/
  webhook-connector/   Local example connector
docs/
deploy/
```

## Safety & compliance

If you build “auto publish” features, do it via:
- official platform APIs, or
- approved third-party services (Buffer / Metricool / Make / Zapier), or
- your own internal tooling with explicit user consent and ToS compliance

This repository is meant to be a practical AI workspace foundation, not a loophole for bypassing platform rules.

## Scripts

- `npm run dev` — run the app in development mode
- `npm run dev:clean` — clear `.next-dev` and start dev server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run stable` — rebuild cleanly and run production server on port 3000
- `npm run lint` — lint
- `npm run webhook:dev` — run local webhook connector example
- `npm run publish-queue:worker` — poll `/api/publish/queue/run` as a background worker

Queue deployment examples:
- [`deploy/pm2/ecosystem.config.cjs`](/Users/aidi/agent桌面/agentcore-os/deploy/pm2/ecosystem.config.cjs)
- [`deploy/systemd/openclaw-publish-queue-worker.service`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-worker.service)
- [`deploy/systemd/openclaw-publish-queue-trigger.service`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-trigger.service)
- [`deploy/systemd/openclaw-publish-queue-worker.timer`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-worker.timer)
- [`deploy/launchd/com.openclaw.publish-queue-worker.plist`](/Users/aidi/agent桌面/agentcore-os/deploy/launchd/com.openclaw.publish-queue-worker.plist)

## Open-source hygiene

Before publishing changes:
- review [docs/OPEN_SOURCE_CHECKLIST.md](docs/OPEN_SOURCE_CHECKLIST.md)
- make sure no secrets, private identifiers, or build artifacts are committed
- run `npm run lint` and `npm run build`

## License

MIT. See [LICENSE](LICENSE).
