# AgentCore OS — Business Solution Operating System

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: Apache_2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## 🚀 AgentCore OS (智枢 OS) V1.0 正式开源：赋予每个人和团队的本地化 AI 生产力底座

过去两年，我们都在和网页里的对话框“聊天”。

但真实的商业世界需要的不是聊天，而是“干活”——是能把非结构化的大模型算力，变成实实在在的跨国订单、自动运行的脚本、和结构化的企业资产。

今天，我们正式开源 **AgentCore OS（智枢 OS）V1.0**。

这不是又一个套壳的 Chat 客户端，而是一个基于 **Tauri 边车架构**打造的、真正跑在你本地电脑上的 **AI 操作系统**。

## 🎯 我们的愿景与终极目标

**打破云端算力垄断，让“超级数字员工”回归每一个人的桌面。**

我们打造 AgentCore OS 的初衷极其纯粹：无论你是想自己写个独立工具的普通创客、每天驱车往返于工厂与客户之间的外贸老兵，还是管理着复杂订单链条的业务负责人，都能以极低的门槛，拥有一个绝对安全、数据私有、且能全自动流转业务链条的生产力底座。

它赋予个体企业级的力量，赋予企业极客级的敏捷。

## 🛡️ 极致安全：全球最让人安心的本地防线

- **100% 数据不出域：** 系统的运行大脑和资产数据库全部驻留在你的本地设备上。没有偷偷上传的遥测数据，你的核心客户名单、财务报价永远只留在你自己的硬盘里。
- **纯粹的 BYOK（自带密钥）：** 无论出海拓展无缝接入 GPT、Claude 等国际顶尖大模型，还是深耕本土调用智谱 GLM、通义千问、Kimi、DeepSeek 等合规模型，系统都能完美适配，实现真正的算力自由。
- **“琥珀色”终极防火墙：** 凡涉及修改本地文件、发送对外邮件等敏感操作，系统都会悬停等待。没有你的物理点击授权，AI 无法越雷池一步。

## 💼 真实落地：经过实战检验的成熟场景

- **🤝 销售与外贸：** 自动监控跨国询盘，瞬间完成背调，结合本地门窗等产品规格库与历史报价单，自动生成多语种跟进邮件。
- **💻 普通人与创客：** 用大白话描述想法，底层的编程 Agent 自动在本地编写代码、调试查错，生成可运行的自动化脚本。
- **🏭 工业与车间：** 打通生产计划与采购单，追踪供应链交期预警；将工业设备图纸转化为互动式排障指南。
- **🚀 运营与增长：** 监控竞品动态，抓取痛点、提炼选题，裂变生成多平台、多语种的 SEO 内容矩阵。

## 🛠️ 工业级架构，小白级体验

- **开箱即用：** 告别黑框命令行和 Docker，提供标准 `.exe` 和 `.dmg` 安装包，双击即可运行。
- **硬件极度包容：** 无论是强悍的 M 芯片主机，还是 N100/N97 迷你主机集群，都能顺滑驱动。
- **去线留白的沉浸式 UI：** 摒弃极客连线图，采用最符合直觉的卡片式 UI 和业务时间轴。

## 🌍 Apache 2.0 开源与 Open Core 商业愿景

AgentCore OS 基于 **Apache 2.0** 协议 **100% 开源**。我们欢迎所有个人与团队免费使用、修改并集成到商业产品中。

**让算力回归本地，让 AI 真正下地干活。**

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

## Open Source License

AgentCore OS is open source under the **Apache License 2.0**.

We chose Apache-2.0 to support broad adoption across individual, startup, and enterprise use cases, while providing a clear patent grant and permissive redistribution terms.

Please note:

- **Source code** in this repository is licensed under Apache-2.0.
- **Logos, trademarks, product names, and brand assets** are **not** granted under the software license unless explicitly stated otherwise.
- Third-party dependencies remain under their own respective licenses.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
