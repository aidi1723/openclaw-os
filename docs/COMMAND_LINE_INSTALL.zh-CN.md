# AgentCore OS 命令行安装说明

如果你希望从源码或开发环境启动 AgentCore OS，可以按以下步骤进行。

## 基本要求

- Node.js 20+（建议使用稳定版本）
- npm
- macOS 或 Windows

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

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
```

如需更多环境准备与分轨说明，请结合阅读：

- [GETTING_STARTED.md](GETTING_STARTED.md)
- [CONFIGURATION.md](CONFIGURATION.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
