# AgentCore OS V1.0 Open Source Release

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: Apache_2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

AgentCore OS is a **local-first AI productivity foundation built for real work**.
It is designed to help more people — from business owners and makers to complete computer beginners and workflow operators — use AI with a lower barrier, stronger privacy, and clearer control on their own machines.

Our goal is simple:

**Give more people a secure, privacy-first, low-friction local AI system that can do real work and steadily accumulate operational assets.**
That means moving AI beyond the chat box and into actual personal and business workflows, where models, files, tools, approvals, and reusable workflow assets can work together.

## Built for multi-scenario AI adoption, not a single-point tool

AgentCore OS is not designed for only one role or one industry.
It is a local AI work platform that can support **multiple roles, workflows, and business scenarios**.

Current and actively developing directions include:

- **Office collaboration**: document organization, task routing, meeting assistance, knowledge capture
- **Design and content production**: asset organization, content generation, rewriting, multi-platform distribution
- **Customer service and support**: issue classification, reply assistance, knowledge retrieval, service workflow coordination
- **Finance and business support**: document sorting, form processing, workflow assistance, operational information handling
- **Operations and growth**: topic extraction, content processing, channel distribution, data and workflow linkage
- **Sales and foreign trade**: inquiry organization, customer background research, follow-up content generation, customer asset accumulation
- **Programming and automation**: turning natural-language requirements into code, scripts, and local execution chains
- **Factory production management**: production information organization, workflow coordination, task tracking, manufacturing collaboration
- **Warehouse management**: inventory processing, in/outbound assistance, record and handoff collaboration
- **Data analysis**: data preparation, structuring, analysis assistance, and result capture

In other words, this is not an AI tool that can do only one thing.
It is an operating foundation that can gradually connect different roles and workflows into one local working system.

## What real-world adoption already looks like

We do not want to talk only about vision. We want to highlight the directions that are already running.

### Sales / Foreign Trade
- Intake and organization of inquiries
- Initial customer background research
- Generate follow-up content based on local product materials and historical assets
- Write results back into local customer assets and workflow records

### Programming / Automation
- Describe requirements in natural language
- Drive code generation, debugging, fixing, and script delivery
- Help makers, individual users, and small teams turn ideas into working tools more easily

### Content / Operations
- From source material organization to content generation
- From content processing to distribution and recordkeeping
- Turn one-off output into reusable workflows over time

### Factory / Warehouse / Data Flows
- Around production, warehousing, and data-processing steps, gradually connect information organization, process collaboration, record capture, and analysis assistance into AI workflows

The key is not that AI answered a question.
The key is that **AI starts participating in real workflows and continuously produces usable outputs.**

## Core characteristics

- **Local-first, safer by design**  
  Workspaces, file assets, and execution chains are organized around the local environment. Sensitive actions can be placed behind explicit human approval boundaries.

- **Supports macOS and Windows**  
  Designed for real desktop use, not just web chat. It is meant to enter actual workflows on the local machine.

- **Out of the box, beginner-friendly**  
  Users should not be blocked by Docker, Python environments, or complicated command lines before they can start. Advanced users can go deep; ordinary users can get running quickly.

- **Works with major domestic and international models**  
  Through BYOK (Bring Your Own Key), you can connect models such as GPT, Claude, Kimi, DeepSeek, GLM, and Qwen as needed, and place model capability into real workflows.

- **Broad enough and deep enough**  
  It can support office work, design, customer service, finance, operations, sales, programming, manufacturing, warehousing, and analytics, while still being extensible into specific industries and deeper workflows.

## Project status

The current `main` branch can be treated as an evolving release-candidate line. At this stage, it already includes these foundational capabilities:

- Desktop shell and multi-window interaction are available
- Industry workspaces and scenario entry points are available
- Multiple packaged business apps are integrated
- One cross-application Hero Workflow is already running end to end
- Multilingual entry points and first-run onboarding are integrated
- Production hardening is still in progress

## Current product structure

The current AgentCore OS product structure can be summarized as:

- `industry`: determines the business context the user is operating in
- `role`: determines the default desk and responsibility entry point
- `workflow`: determines standard action order, human review boundaries, and result asset paths
- `apps`: execution components inside a workflow, not the only protagonist

Representative example:

- `Sales Desk`  
  `Customer inquiry / manual input -> Deal Desk -> Email Assistant -> Personal CRM -> local sales asset accumulation`

## Quick start

```bash
npm install
npm run dev
```

Optional environment template:
- [`.env.example`](.env.example)

After startup, you can access:
- App UI: `http://localhost:3000/`
- Optional local connector UI: `http://127.0.0.1:8787/`

### Optional local connector

Run the local connector example:

```bash
npm run webhook:dev
```

Optional: run the publish queue worker separately without depending on a browser tab:

```bash
npm run publish-queue:worker
```

Production deployment examples are located in [`deploy/`](deploy/).
Template notes are in [`deploy/README.md`](deploy/README.md).

## Main scripts

- `npm run dev` — start in development mode
- `npm run dev:clean` — clean `.next-dev` and start development
- `npm run build` — production build
- `npm run start` — start production service
- `npm run stable` — clean rebuild and start stable version
- `npm run lint` — run lint
- `npm run webhook:dev` — start the local webhook connector example
- `npm run publish-queue:worker` — run the background publish queue worker

## Documentation entry points

### Start here
- [Getting Started](docs/GETTING_STARTED.md)
- [User Guide (ZH)](docs/USER_GUIDE.zh-CN.md)
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

## Security and compliance

If you want to build automated publishing capabilities, use:
- official platform APIs, or
- compliant third-party services (such as Buffer / Metricool / Make / Zapier), or
- internal tools with explicit user authorization

The goal of this repository is to be a practical AI work platform, not a loophole tool for bypassing platform rules.

## Pre-open-source checklist

Before publishing externally, we recommend:
- Check [docs/OPEN_SOURCE_CHECKLIST.md](docs/OPEN_SOURCE_CHECKLIST.md)
- Confirm that no secrets, private identifiers, or build artifacts are committed
- Run `npm run lint` and `npm run build`

## Open Source License

AgentCore OS is open source under the **Apache License 2.0**.

We chose Apache-2.0 to support broad adoption across individual, startup, and enterprise use cases, while providing a clear patent grant and permissive redistribution terms.

Please note:

- **Source code** in this repository is licensed under Apache-2.0.
- **Logos, trademarks, product names, and brand assets** are **not** granted under the software license unless explicitly stated otherwise.
- Third-party dependencies remain under their own respective licenses.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
