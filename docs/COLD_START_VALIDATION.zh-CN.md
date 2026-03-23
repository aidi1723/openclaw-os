# AgentCore OS 冷启动安装验收

本文档记录当前公开主仓库在**全新目录 / 命令行安装 / 源码运行 / `desktop_light`** 主线上的实际验收结果。

## 当前结论

截至 `2026-03-23`，AgentCore OS 已经完成一轮基于 GitHub 主仓库的真实冷启动安装验收。

当前可以明确承诺的稳定范围是：

- 命令行安装
- 从源码运行
- 浏览器模式
- `desktop_light` 运行主线

当前**不在本次“已验证稳定”承诺范围**内的内容包括：

- `desktop_dify`
- Docker 依赖路径
- DMG / EXE 安装包分发
- 所有平台的零差异 out-of-box 体验

## 验收对象

- 仓库来源：GitHub 主仓库 `aidi1723/agentcore-os`
- 验收提交：`d6f6a37`
- 验收日期：`2026-03-23`
- 验收方式：在 `/tmp` 中重新 `git clone` 干净副本后执行

## 实际执行结果

在全新克隆目录中，以下步骤已通过：

1. `git clone --depth 1 https://github.com/aidi1723/agentcore-os.git`
2. `npm install`
3. `npm run test:stability`
4. `npm run runtime:doctor`
5. `npm run dev`
6. `HEAD /` 返回 `200`
7. `GET /api/runtime/doctor` 返回 `200`

## 本次稳定性门禁

当前主线推荐使用以下命令作为最小门禁：

```bash
npm install
npm run test:stability
npm run dev
```

其中：

- `npm run test:core-workflows`
  验证销售、客服、知识资产、发布队列四条高频链路
- `npm run lint`
  验证静态检查
- `npm run build`
  验证生产构建
- `npm run runtime:doctor`
  验证当前机器是否满足 `desktop_light` / `desktop_dify` / Creative Studio 的基础条件

## 当前机器上的运行时判断

本次冷启动验收环境中：

- `desktopLightReady = true`
- `desktopDifyReady = false`
- `creativeStudioReady = true`

这意味着：

- 只要填入可用的模型 API Key，当前主线已经可以继续验证和使用
- 如果要使用 `desktop_dify`，仍然需要 Docker Desktop / Compose

## 对外推荐口径

当前更准确的描述方式是：

> AgentCore OS 当前已经验证了命令行安装 / 源码运行 / `desktop_light` 主线，可作为公开稳定体验入口继续使用和分发。

不建议当前对外描述为：

- 所有模式都已完全成熟
- 所有平台都已零配置即装即用
- 安装包分发已经成为默认稳定路径

## 建议后续维护动作

- 每次涉及安装、运行时、发布队列或核心工作流改动时，至少再跑一遍 `npm run test:stability`
- 重要发版前，建议重新做一次全新目录冷启动验收
- 如果未来把 `desktop_dify` 作为默认宣传能力，需要单独补一轮 Docker 路径验收
