# macOS 签名与公证说明

本文用于说明 AgentCore OS 当前 macOS 分发包在签名与公证方面的状态。

## 当前状态

如果某一版本尚未完成正式签名 / notarization，GitHub Release 与安装说明应明确标注。

## 对用户的影响

- 未签名 / 未公证的安装包通常仍可手动安装
- 但首次启动时可能被 macOS 安全机制拦截
- 需要用户按系统提示手动放行

## 对发布方的建议

在完成正式 Apple Developer 签名与 notarization 之前：

- 在 release notes 中明确说明状态
- 在 README 与安装文档中给出预期说明
- 不要把“未签名包”描述成“零摩擦正式安装包”

## 配套文档

- [macOS 未签名安装说明](MACOS_UNSIGNED_INSTALL.zh-CN.md)
- [当前版本发布说明](releases/v0.2.0-beta.2.md)
