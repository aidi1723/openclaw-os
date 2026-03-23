# AgentCore OS 对外分发说明

当前建议对外分发的公开版本为 `v1.1.1`。

当前推荐安装方式：**命令行安装 / 从源码运行**。

当前对外入口建议：

- 主仓库 GitHub：<https://github.com/aidi1723/agentcore-os>
- 国内镜像 CNB：<https://cnb.cool/aidiyangyu/agentcore-os>

## 适用场景

适合以下对象：

- 想先体验 AgentCore OS 的个人用户
- 需要评估本地优先 AI 工作流的团队
- 想验证桌面版安装与运行路径的外部测试者
- 想评估企业数字员工 / Agent 工作流定制基础设施的潜在合作方

## 当前对外口径

- 当前推荐公开版本：`v1.1.1`
- 中文版本说明：`docs/releases/v1.1.1.zh-CN.md`
- GitHub / CNB 发布正文：`docs/releases/v1.1.1-github-release.zh-CN.md`
- 当前推荐安装方式：`docs/COMMAND_LINE_INSTALL.zh-CN.md`
- 冷启动安装验收：`docs/COLD_START_VALIDATION.zh-CN.md`
- README 与安装说明都应围绕此版本展开

当前已经明确验收通过的主线为：

- 命令行安装
- 从源码运行
- 浏览器模式
- `desktop_light`

当前不建议把以下内容一起打包宣传为“默认稳定能力”：

- `desktop_dify`
- Docker 依赖路径
- DMG / EXE 安装包分发

## 分发建议

1. 对海外或公开分发，优先使用 GitHub 仓库与 GitHub Release 页面
2. 对国内用户，优先使用 CNB 镜像仓库与中文文档入口
3. 让 README 保持与当前推荐版本一致
4. 对中文用户，优先给出本文档、中文总入口和命令行安装说明
5. 不再以 DMG / EXE 安装包作为当前默认分发口径

## 对外说明建议

可以这样描述：

> AgentCore OS 是一个本地优先、面向真实工作的 AI 工作底座，支持在个人与企业场景下将模型、文件、工具、审批和工作流资产连接起来。当前推荐体验版本为 `v1.1.1`，推荐通过命令行方式安装和运行。
