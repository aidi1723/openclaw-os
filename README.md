# AgentCore OS（智枢 OS）V1.0 正式开源

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: Apache_2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

AgentCore OS（智枢 OS）是一个**本地优先、开箱即用的 AI 业务操作系统**。
它不是又一个聊天壳，而是一个真正面向“干活”的桌面底座：让模型、流程、文件、工具调用和人工确认边界，在你的电脑上协同工作。

我们的目标很明确：

**让 AI 不只停留在对话框里，而是真正进入个人与企业的真实工作流。**
让个人拥有企业级的数字生产力，让团队拥有更低门槛、更安全、更可控的本地 AI 落地系统。

## 支持多场景 AI 落地，而不是单点工具

AgentCore OS 的定位，不是只服务某一个岗位，也不是只适合某一个行业。
它是一个能够承接**多角色、多流程、多业务场景**的本地 AI 工作底座。

目前已经覆盖并持续落地的方向包括：

- **办公协同**：资料整理、任务流转、会议辅助、知识沉淀
- **设计与内容生产**：素材整理、内容生成、改写加工、多平台分发
- **客服与支持**：问题归类、回复辅助、知识调用、服务流程协同
- **财务与经营辅助**：文档整理、表单处理、流程支持、经营信息辅助处理
- **运营与增长**：选题提炼、内容加工、渠道分发、数据与流程衔接
- **销售与外贸**：询盘整理、客户背调、跟进内容生成、客户资产沉淀
- **编程与自动化**：自然语言描述需求，推动代码、脚本与本地执行链路落地
- **工厂生产管理**：生产信息整理、流程衔接、任务追踪、制造场景协同
- **仓库管理**：库存信息处理、出入库流程辅助、记录与流转协同
- **数据分析**：数据整理、结构化处理、分析辅助与结果沉淀

也就是说，它不是“只能做一件事的 AI 工具”，
而是一个能把不同岗位、不同流程逐步接入同一套本地工作体系的操作底座。

## 已经体现出来的落地方式

我们不想只讲愿景，更想强调已经跑起来的方向。

### 销售 / 外贸
- 询盘接入与整理
- 客户初步背调
- 基于本地产品资料和历史资产生成跟进内容
- 将结果回写到本地客户资产与流程记录中

### 编程 / 自动化
- 用自然语言描述需求
- 驱动代码生成、调试、修正与脚本落地
- 让创客、个人用户和小团队更容易把想法变成可运行工具

### 内容 / 运营
- 从素材整理到内容生成
- 从内容加工到分发与记录沉淀
- 把一次性输出逐步变成可复用流程

### 工厂 / 仓库 / 数据流程
- 围绕生产、仓储、数据处理等环节，逐步把信息整理、流程协同、记录沉淀和分析辅助接入 AI 工作流

这些场景背后的重点不是“AI 回答了一个问题”，
而是**AI 开始进入真实流程，并持续产生产物。**

## 核心特点

- **本地优先，更安全**  
  工作区、文件资产和执行链路围绕本地环境组织。敏感动作可以设置人工确认边界，避免 AI 越界执行。

- **支持 macOS 和 Windows**  
  面向真实桌面使用场景设计，不只是网页里“聊一聊”，而是能在本机真正进入工作流。

- **开箱即用，小白也能上手**  
  不希望用户先被 Docker、Python 环境、复杂命令行劝退。我们希望专业用户能做深，普通用户也能先跑起来。

- **支持国内外主流模型协同**  
  通过 BYOK（自带密钥）方式，可按需接入 GPT、Claude，以及 Kimi、DeepSeek、GLM、Qwen 等模型，把模型能力真正放进业务流程里。

- **既能做广，也能做深**  
  它既能承接办公、设计、客服、财务、运营、销售、编程、生产、仓储、数据分析等多类场景，也适合继续向具体行业和具体工作流深入扩展。

## 项目现状

当前 `main` 分支可以视为一个持续演进中的发布候选版本，现阶段已经具备这些基础能力：

- 桌面壳与多窗口交互可用
- 行业工作区与场景入口可用
- 多个打包业务应用已接入
- 一个跨应用 Hero Workflow 已能跑通
- 多语言入口与首次引导已接入
- 生产级加固仍在持续推进

## 当前产品结构

AgentCore OS 当前的产品结构可以概括为：

- `industry`：决定用户所处的业务上下文
- `role`：决定默认打开的工作台与职责入口
- `workflow`：决定标准动作顺序、人工审核边界与结果资产路径
- `apps`：作为工作流中的执行组件，而不是唯一主角

当前代表性示例：

- `Sales Desk`  
  `客户询盘 / 手动录入 -> Deal Desk -> Email Assistant -> Personal CRM -> 本地销售资产沉淀`

## 快速开始

```bash
npm install
npm run dev
```

可选环境模板：
- [`.env.example`](.env.example)

启动后可访问：
- App UI: `http://localhost:3000/`
- 可选本地连接器 UI: `http://127.0.0.1:8787/`

### 可选本地连接器

运行本地 connector 示例：

```bash
npm run webhook:dev
```

可选：不依赖浏览器标签页，单独运行 publish queue worker：

```bash
npm run publish-queue:worker
```

生产部署示例位于 [`deploy/`](deploy/)。
模板说明位于 [`deploy/README.md`](deploy/README.md)。

## 主要脚本

- `npm run dev` — 开发模式启动
- `npm run dev:clean` — 清理 `.next-dev` 后启动开发环境
- `npm run build` — 生产构建
- `npm run start` — 启动生产服务
- `npm run stable` — 干净重建并启动稳定版本
- `npm run lint` — 运行 lint
- `npm run webhook:dev` — 启动本地 webhook connector 示例
- `npm run publish-queue:worker` — 运行后台 publish queue worker

## 文档入口

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

## 仓库结构

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

## 安全与合规

如果你要构建“自动发布”类能力，请通过：
- 官方平台 API，或
- 合规的第三方服务（如 Buffer / Metricool / Make / Zapier），或
- 具备明确用户授权的自有内部工具

这个仓库的目标是成为一个务实的 AI 工作底座，而不是绕过平台规则的漏洞工具。

## 开源前检查

在对外发布前建议：
- 检查 [docs/OPEN_SOURCE_CHECKLIST.md](docs/OPEN_SOURCE_CHECKLIST.md)
- 确认未提交 secrets、私有标识信息或构建产物
- 运行 `npm run lint` 与 `npm run build`

## Open Source License

AgentCore OS is open source under the **Apache License 2.0**.

We chose Apache-2.0 to support broad adoption across individual, startup, and enterprise use cases, while providing a clear patent grant and permissive redistribution terms.

Please note:

- **Source code** in this repository is licensed under Apache-2.0.
- **Logos, trademarks, product names, and brand assets** are **not** granted under the software license unless explicitly stated otherwise.
- Third-party dependencies remain under their own respective licenses.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
