# AgentCore OS 使用指南

这是一份面向实际用户的使用手册，覆盖以下内容：

- 如何启动 AgentCore OS
- 如何配置大模型 API Key
- 如何配置本地运行时与桌面 sidecar
- 如何把飞书、钉钉或通用 Webhook 机器人接入 AgentCore OS
- 如何配置发布 Connector 与矩阵账号
- 如何做首轮自测和常见排障

## 1. AgentCore OS 是什么

AgentCore OS 是一个面向业务流程的桌面工作台。

它把：

- 多个 AI 工作应用
- 行业工作区
- 桌面 sidecar
- 本地运行时
- 机器人回调桥
- 发布 Connector

放到同一个桌面式入口里，方便你用一个界面完成从“输入指令”到“执行任务”再到“回传结果”的完整流程。

## 2. 使用前准备

你可以按两种方式使用：

### 2.1 浏览器模式

适合本地开发和快速体验。

```bash
npm install
npm run dev
```

打开：

- `http://localhost:3000/`

### 2.2 桌面模式

适合实际测试、对接移动端机器人、验证 sidecar 和本地运行时。

如果你已经有打好的桌面包：

- macOS：直接打开 `.app` 或安装 `.dmg`
- Windows：安装 `NSIS .exe`

当前公开稳定版本：`1.0.0`

- GitHub Releases：<https://github.com/aidi1723/agentcore-os/releases>
- 当前版本发布说明：[docs/releases/v1.0.0.md](releases/v1.0.0.md)

如果你要自己本地验证桌面构建链：

```bash
npm run desktop:build-doctor
npm run runtime:doctor
npm run desktop:prepare-sidecar
npm run desktop:smoke-test-sidecar
npm run desktop:package
```

## 3. 首次使用的最小路径

如果你只想尽快跑通系统，建议按这个顺序：

1. 打开 `设置`
2. 进入 `大模型与助手`
3. 选择一个模型提供方
4. 填入 `API Key`
5. 点击 `测试连接`
6. 回到主界面，先运行一个核心应用
7. 如果你使用桌面包，再进入 `设置 -> 引擎核心` 检查 sidecar 与运行时状态

对大多数新用户，推荐先用：

- 运行模式：`desktop_light`
- LLM 策略：`api_only`
- 不依赖 Docker

## 4. 设置页总览

设置页分为 5 个区域：

- `大模型与助手`
- `引擎核心`
- `移动端接入`
- `矩阵账号授权`
- `个性化`

下面按这 5 个区域说明。

## 5. 大模型与助手

这个页面负责配置模型服务。

当前内置提供方包括：

- Kimi
- DeepSeek
- OpenAI
- Anthropic
- 通义千问

每个提供方都可以单独保存：

- `API Key`
- `Base URL`
- `Model`

系统会自动保存，并允许你一键切换当前生效的模型。

### 5.1 推荐填写方式

#### OpenAI

- `API Key`：你的 OpenAI Key
- `Base URL`：`https://api.openai.com/v1`
- `Model`：例如 `gpt-4o-mini`

#### DeepSeek

- `API Key`：你的 DeepSeek Key
- `Base URL`：`https://api.deepseek.com`
- `Model`：例如 `deepseek-chat`

#### Kimi

- `API Key`：你的 Moonshot Key
- `Base URL`：`https://api.moonshot.cn/v1`
- `Model`：例如 `moonshot-v1-8k`

#### Anthropic

- `API Key`：你的 Anthropic Key
- `Base URL`：`https://api.anthropic.com`
- `Model`：例如 `claude-3-5-sonnet-latest`

#### 通义千问

- `API Key`：你的 DashScope Key
- `Base URL`：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- `Model`：例如 `qwen-plus`

### 5.2 如何确认配置成功

在 `大模型与助手` 页面点击：

- `测试连接`

成功时会提示：

- `连接成功`

如果失败，优先检查：

- Key 是否正确
- Base URL 是否正确
- Model 是否存在
- 当前网络是否能访问对应服务

## 6. 引擎核心

这个页面负责配置本地运行时、桌面 sidecar 和可选的外部 Agent Runtime。

### 6.1 关键字段说明

#### Agent Runtime URL

用于连接本地或远程 Agent Runtime。

常见写法：

- 留空：优先走本地轻量路径
- `http://127.0.0.1:18789`：连接本地 runtime gateway

#### Agent Runtime Token

- 可选
- 当你的 runtime 需要 token 鉴权时填写

#### Local App URL

默认：

- `http://127.0.0.1:3000`

通常浏览器模式下才需要关注。

#### Sidecar API URL

默认：

- `http://127.0.0.1:8080`

桌面壳模式下，前端会优先把 `/api/*` 请求转发到这里。

#### Dify Base URL

默认：

- `http://127.0.0.1:5001`

只有你要接本地 Dify runtime 时才需要配置。

#### Compose Project Name

默认：

- `agentcore-runtime`

用于 Docker Compose 相关编排。

### 6.2 推荐配置

#### 普通用户 / 首轮测试

推荐：

- `profile = desktop_light`
- `orchestration = none`
- `autoBootLocalStack = false`

这条路径只要求：

- 本地可写目录正常
- 你已配置模型 API Key

#### 需要本地 Dify / Docker 编排

再切到：

- `profile = desktop_dify`
- `orchestration = docker_compose`

同时确保：

- Docker Desktop 可用
- `docker compose` 可用
- 运行时模板文件存在

### 6.3 运行时检查

你可以通过：

- `npm run runtime:doctor`

或在设置页查看运行时状态。

运行时检查会重点判断：

- Node 是否可用
- ffmpeg 是否可用
- Docker 是否可用
- Docker Compose 是否可用
- 本地数据目录是否可写

其中：

- `desktopLightReady = true` 表示最小桌面路径可用
- `desktopDifyReady = true` 表示本地 Dify / Docker 路径可用
- `creativeStudioReady = true` 表示本地媒体处理所需的 ffmpeg 可用

## 7. 移动端接入：对接机器人

这是 AgentCore OS 的远程指令入口。

核心思路不是“在手机上跑 Agent”，而是：

1. 让飞书 / 钉钉 / 自动化平台把消息转成 HTTP 请求
2. 请求发到你的桌面 sidecar
3. 桌面 Agent 执行任务
4. 再把结果通过 Webhook 或官方 API 回发到聊天工具

### 7.1 最小接入前提

你至少需要准备：

- AgentCore OS 桌面版正在运行
- `移动端接入` 已启用
- 一个 `Public Base URL`
- 一个 `Access Token`
- 一个能把外部请求转发到本机的公网入口

推荐的公网转发工具：

- Cloudflare Tunnel
- ngrok
- FRP

### 7.2 先配置这 4 项

进入：

- `设置 -> 移动端接入`

填写：

#### 启用移动端远程指令桥

- 勾选开启

#### Public Base URL

例如：

- `https://your-tunnel.example.com`

这里不是本地地址，而是你的公网入口地址。

#### Access Token

- 设置一个共享令牌
- 用于保护回调接口

#### Command Prefix（可选）

例如：

- `/agent`

如果填写了前缀，系统只处理带此前缀的消息，适合群聊环境，避免误触发。

### 7.3 三类回调入口

配置好 `Public Base URL` 后，系统会生成这三类入口：

- `/api/im-bridge/inbound/generic`
- `/api/im-bridge/inbound/feishu`
- `/api/im-bridge/inbound/dingtalk`

完整形式通常是：

- `https://你的公网域名/api/im-bridge/inbound/generic`
- `https://你的公网域名/api/im-bridge/inbound/feishu`
- `https://你的公网域名/api/im-bridge/inbound/dingtalk`

### 7.4 鉴权方式

系统支持三种共享 Token 鉴权方式：

- `Authorization: Bearer <Access Token>`
- `X-AgentCore-IM-Token: <Access Token>`
- `?token=<Access Token>`

### 7.5 最推荐的接法：通用 Webhook

如果你只是要先跑通闭环，优先用通用 Webhook。

请求地址：

- `POST /api/im-bridge/inbound/generic`

请求体最小示例：

```json
{
  "text": "帮我分析本周销售数据，并生成一份工作汇报提纲。",
  "sessionId": "mobile-demo-user"
}
```

适用场景：

- 飞书自动化
- 钉钉自动化
- 企业微信中转
- 自己的 webhook 机器人
- Make / Zapier / n8n / 自研脚本

### 7.6 飞书接入

回调入口：

- `POST /api/im-bridge/inbound/feishu`

最小消息体：

```json
{
  "event": {
    "sender": {
      "sender_id": {
        "open_id": "ou_mobile_demo"
      }
    },
    "message": {
      "chat_id": "oc_mobile_demo",
      "content": "{\"text\":\"帮我分析这份销售周报\"}"
    }
  }
}
```

可选增强项：

- `Reply Webhook URL`
- `Official API Base URL`
- `App ID`
- `App Secret`
- `officialTargetIdType`
- `officialTargetId`
- `Verification Token`

如果你启用了飞书官方事件订阅，建议在：

- `原生回调校验 -> 飞书 Verification Token`

里补上 token，用于校验事件体里的 `token` 字段。

### 7.7 钉钉接入

回调入口：

- `POST /api/im-bridge/inbound/dingtalk`

最小消息体：

```json
{
  "conversationId": "cid_mobile_demo",
  "senderStaffId": "staff_mobile_demo",
  "text": {
    "content": "帮我做一份本周工作汇报 PPT"
  }
}
```

可选增强项：

- `Reply Webhook URL`
- `Official API Base URL`
- `App Key / App Secret`
- `Robot Code`
- `officialConversationId`
- `Sign Secret`

如果你使用钉钉机器人的签名校验，建议在：

- `原生回调校验 -> 钉钉 Sign Secret`

里填入签名密钥。

### 7.8 回复通道怎么选

每个 IM 提供方都支持两种回复方式：

- `Webhook`
- `官方 API`

#### 选 Webhook

适合：

- 先快速打通
- 你已经有机器人或自动化平台的回调地址

你只需要填：

- `Reply Webhook URL`

#### 选官方 API

适合：

- 你要让 AgentCore 直接调用飞书/钉钉官方接口回复消息

这时需要再填写：

- `Official API Base URL`
- `App ID / App Key`
- `App Secret`
- 飞书的 `Target ID Type / Target ID`
- 钉钉的 `Robot Code / Conversation ID`

### 7.9 自动回消息

在 `移动端接入` 页面中可以开启：

- `自动回消息`

开启后，桌面 Agent 完成任务，会自动把结果推回到对应 IM。

### 7.10 测试接入是否成功

在 `移动端接入` 页面中：

1. 先点 `保存桥接配置`
2. 再点 `发送测试消息`
3. 观察 `Remote health`
4. 查看事件列表是否有 `completed`

如果失败，优先检查：

- AgentCore OS 是否仍在运行
- `Public Base URL` 是否能从公网访问
- `Access Token` 是否一致
- Reply Webhook 或官方 API 参数是否正确

## 8. 矩阵账号授权与发布 Connector

这一页主要用于“把生成内容交给你的发布系统”。

进入：

- `设置 -> 矩阵账号授权`

每个平台可以单独填写：

- `Auth Token`
- `Publish Webhook URL（可选）`

已内置的平台包括：

- 小红书
- 抖音
- Instagram
- TikTok
- 独立站

### 8.1 这两个字段分别做什么

#### Auth Token

用于后续自动发布或第三方 webhook 鉴权。

#### Publish Webhook URL

用于把生成好的内容推送到你的发布服务。

如果不填：

- 仍然可以手动使用内容
- 只是不能直接自动发布

如果填写了：

- “矩阵发布中心”可以一键把 payload 交给你的 connector

### 8.2 最简单的本地测试方式

项目内置了一个本地示例 Connector。

先运行：

```bash
npm run webhook:dev
```

然后在设置页点：

- `使用本地 Connector（127.0.0.1:8787）`

它会自动把多个平台的 `Publish Webhook URL` 填为：

- `http://127.0.0.1:8787/webhook/publish`

注意：

- 这个示例 Connector 只记录回执
- 它不会真实发帖

### 8.3 真实发布建议

推荐只用以下方式接真实发布：

- 官方平台 API
- 合规的第三方调度服务
- 你自己的内部发布服务

不建议依赖非官方、规避规则的发帖链路。

## 9. 个性化

你可以在 `个性化` 页面配置：

- 桌面背景
- 界面语言
- 行业工作区
- 默认场景包
- 自定义桌面应用
- 自定义 Dock 应用

这部分不影响系统可用性，但会影响首屏体验和默认工作流。

## 10. 推荐的首轮测试清单

如果你是第一次部署，建议按这个顺序测试：

1. 打开应用
2. 配置一个可用的大模型 API Key
3. 测试模型连接
4. 打开一个主应用，例如 Sales Desk
5. 完成一次真实任务
6. 重启应用，确认设置仍然保留
7. 如果你要做移动端接入，再配置 IM Bridge
8. 发送一次测试消息
9. 如果你要做自动发布，再配置 Connector 并跑一次 dry-run

## 11. 数据存储位置

### 11.1 浏览器 / 前端本地设置

保存在：

- `localStorage`
- key 为 `openclaw.settings.v1`

主要包含：

- LLM 配置
- 引擎地址
- 个性化设置

### 11.2 服务端本地文件

发布相关状态存放在：

- `.openclaw-data/publish-config.json`
- `.openclaw-data/publish-jobs.json`

用于保存：

- 平台 connector token
- webhook 地址
- 发布任务状态

## 12. 重置与清理

### 12.1 重置前端设置

删除浏览器本地存储：

- `openclaw.settings.v1`

### 12.2 重置发布相关状态

删除：

- `.openclaw-data/publish-config.json`
- `.openclaw-data/publish-jobs.json`

## 13. 常见问题

### 13.1 模型连接失败

先检查：

- API Key 是否正确
- Base URL 是否正确
- Model 是否正确
- 当前网络是否能访问模型服务

### 13.2 桌面版能打开，但工作流跑不动

先检查：

- `设置 -> 引擎核心`
- sidecar 是否已启动
- `Sidecar API URL` 是否仍为默认值
- 本地数据目录是否可写

### 13.3 移动端机器人收不到回执

先检查：

- `自动回消息` 是否开启
- `Reply Webhook URL` 是否正确
- 机器人平台本身是否允许外部回调
- 公网 tunnel 是否仍在线

### 13.4 通用 Webhook 能收到，但飞书 / 钉钉不行

通常是：

- 官方签名/校验参数没配对
- 平台事件格式不匹配
- Access Token 不一致

此时建议先退回：

- `generic` 通用 Webhook 路径

先打通，再升级到原生平台模式。

## 14. 安全提醒

当前版本适合：

- 本地测试
- 内部验证
- 小范围试运行

不建议把它直接当成生产级密钥管理系统。

如果你要正式部署，建议补上：

- 服务端鉴权
- 多用户隔离
- 受控密钥存储
- 审计日志
- 备份与访问控制

## 15. 一句话建议

如果你是第一次上手，按这个顺序最稳：

1. 先配好一个大模型 API Key
2. 跑通 `desktop_light`
3. 再接移动端机器人
4. 最后再接发布 Connector

这样最容易定位问题，也最接近真实用户使用路径。
