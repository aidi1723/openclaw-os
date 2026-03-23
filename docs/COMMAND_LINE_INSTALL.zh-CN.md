# AgentCore OS 命令行安装说明

如果你希望从源码或开发环境启动 AgentCore OS，这是当前推荐的公开安装方式。

## 基本要求

- Node.js 20+（建议使用稳定版本）
- npm
- macOS 或 Windows

当前推荐版本：`v1.1.1`

## 安装步骤

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

启动后默认访问：

- App UI: `http://localhost:3000/`
- 可选本地 connector UI: `http://127.0.0.1:8787/`

如果你要验证生产构建：

```bash
npm run build
npm run start
```

## 常用命令

```bash
npm run dev
npm run test:stability
npm run build
npm run start
npm run lint
```

## 推荐验收顺序

如果你希望确认当前仓库在你的机器上确实稳定可用，建议按这个顺序执行：

```bash
npm install
npm run test:stability
npm run dev
```

`npm run test:stability` 当前会覆盖：

- 销售链路回归
- 客服链路回归
- Knowledge Vault 复用保护检查
- 发布队列回归
- lint
- build

如需更多环境准备与分轨说明，请结合阅读：

- [README.md](../README.md)
- [当前版本发布说明](releases/v1.1.1.zh-CN.md)
- [冷启动安装验收](COLD_START_VALIDATION.zh-CN.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [CONFIGURATION.md](CONFIGURATION.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
