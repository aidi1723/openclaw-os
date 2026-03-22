# AgentCore OS（智枢 OS）

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: Apache_2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

AgentCore OS 是一个**本地优先、面向真实工作的 AI 工作底座**。
它不是只会聊天的单点工具，而是把模型、文件、工具、审批、连接器和工作流资产，放进一个可持续积累的本地工作系统里。

我们的目标很直接：

**让更多个人、团队和企业，以更低门槛、更高安全性、更强可控性，真正把 AI 用到日常业务里。**

## 当前定位

AgentCore OS 当前更适合这样理解：

- 一个本地优先的 AI 工作平台
- 一个可承载多行业、多角色、多流程的业务工作台
- 一个可以逐步沉淀企业数字员工 / Agent 工作流资产的基础设施

它适合的方向包括：

- 外贸与销售跟进
- 内容生产与分发
- 客服与知识支持
- 财务与业务辅助
- 运营与增长
- 编程与自动化
- 工厂、仓储与数据流程协同

## 当前稳定版本

当前推荐对外版本：**v1.1.0**

当前稳定产品线聚焦：

- 本地优先
- BYOK / API Key 驱动
- 浏览器壳 + 桌面壳双入口
- 销售跟进、客服处理、知识资产沉淀三条高频闭环
- 内容创作与研究分析作为稳定基础能力

获取源码、版本信息与公开发布说明，请以仓库与 GitHub Releases 页面为准：

- GitHub 仓库：<https://github.com/aidi1723/agentcore-os>
- GitHub Releases：<https://github.com/aidi1723/agentcore-os/releases>
- 当前版本发布说明：[docs/releases/v1.1.0.md](docs/releases/v1.1.0.md)
- 对外分发说明：[docs/EARLY_ACCESS_RELEASE.zh-CN.md](docs/EARLY_ACCESS_RELEASE.zh-CN.md)
- 市场发布文案：[docs/LAUNCH_COPY_v1.1.0.zh-CN.md](docs/LAUNCH_COPY_v1.1.0.zh-CN.md)
- 文档总入口：[docs/DOCUMENTATION_INDEX.zh-CN.md](docs/DOCUMENTATION_INDEX.zh-CN.md)

## 快速开始

### 本地开发体验

```bash
npm install
npm run dev
```

建议本地开发使用 Node.js 22 LTS。

启动后访问：

- App UI：`http://localhost:3000/`
- 可选本地 Connector UI：`http://127.0.0.1:8787/`

### 命令行安装与运行

当前推荐安装方式只有一种：**命令行安装**。

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

如果你要进一步验证桌面壳或本地 sidecar，请看：

- [命令行安装说明](docs/COMMAND_LINE_INSTALL.zh-CN.md)

## 核心能力概览

当前版本已经具备这些基础能力：

- 桌面壳与多窗口交互
- 行业工作区与场景入口
- 多个业务应用集成到同一工作台
- 销售与客服两条高频 Hero Workflow 已可跑通
- 结构化流程资产可入库、编辑、复用、追溯
- 数字员工白名单与 Reality Checker 审核层
- 多语言入口与首次启动引导
- 本地优先的运行方式与可控审批边界

## 文档入口

### 建议先看

- [文档总入口](docs/DOCUMENTATION_INDEX.zh-CN.md)
- [用户指南（中文）](docs/USER_GUIDE.zh-CN.md)
- [当前版本发布说明](docs/releases/v1.1.0.md)
- [对外分发说明](docs/EARLY_ACCESS_RELEASE.zh-CN.md)
- [市场发布文案](docs/LAUNCH_COPY_v1.1.0.zh-CN.md)

### 安装与发布相关

- [命令行安装说明](docs/COMMAND_LINE_INSTALL.zh-CN.md)
- [公开发布说明](docs/PUBLIC_RELEASE.md)

### 其他核心文档

- [快速开始](docs/GETTING_STARTED.md)
- [架构说明](docs/ARCHITECTURE.md)
- [连接器说明](docs/CONNECTORS.md)
- [使用场景](docs/USE_CASES.md)
- [配置说明](docs/CONFIGURATION.md)
- [部署说明](docs/DEPLOYMENT.md)
- [排障说明](docs/TROUBLESHOOTING.md)

## 常用脚本

- `npm run dev`：开发模式启动
- `npm run dev:clean`：清理后启动开发模式
- `npm run build`：生产构建
- `npm run start`：启动生产服务
- `npm run stable`：清理重建并启动稳定版本
- `npm run lint`：运行 lint
- `npm run webhook:dev`：启动本地 webhook connector 示例
- `npm run publish-queue:worker`：运行后台发布队列 worker

## 开源协议

AgentCore OS 采用 **Apache License 2.0** 开源。

请注意：

- **本仓库源代码** 按 Apache-2.0 许可发布
- **Logo、商标、产品名和品牌资产** 不默认随软件许可证一起授权，除非另有明确说明
- 第三方依赖仍遵循各自原有许可证

详见：

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)
