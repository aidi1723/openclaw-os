# AgentCore OS 企业级执行层升级方案

Last updated: 2026-04-06

## 背景

近期外部 Agent 项目里，真正值得借鉴的不是“多几个子智能体”这种表层能力，而是更底层的 harness 思路：

- `claw-code`
  当前公开仓库更强调 clean-room 移植、模型无关和可替换后端。
- `everything-claude-code`
  当前公开仓库更强调 hooks、memory persistence、continuous learning、model routing 与 agent safety。

对 AgentCore OS 来说，这意味着下一阶段的重点不该继续放在“再加多少应用”，而应该集中到：

1. 执行治理
2. 失败隔离
3. 记忆与审计
4. 安全护栏
5. 运维可观测性

## 当前判断

AgentCore OS 已经具备：

- 本地优先工作台
- browser / desktop / sidecar 多形态运行
- 自有 executor core 与 session store
- 销售 / 客服 / 研究 / 创作等多条业务工作流

但距离企业级标准，当前短板主要在执行治理层，而不在 UI 层：

- 模型调用仍偏单路执行，缺少正式的候选路由语义
- 执行 trace 粒度不足，难以复盘每次重试 / 降级
- 执行历史缺少面向运维的健康总览
- 本地持久化对敏感信息缺少系统性脱敏
- 幂等、记忆提炼、策略学习仍处于早期

## 本轮已落地

本次升级先完成一批不会破坏现有产品面、但能明显提高企业可用性的底层能力：

### 1. Executor Contract 升级

执行 contract 现在正式包含：

- `metadata.requestId`
- `metadata.idempotencyKey`
- `executionPolicy.maxAttempts`
- `executionPolicy.retryBackoffMs`
- `executionPolicy.allowFallbackToOpenClaw`
- `fallbackModelConfigs`
- `trace.attempts`
- `trace.fallbackUsed`

这让执行层不再只是“打一枪出一个结果”，而是具备了治理语义。

### 2. 模型重试与候选路由

执行器现在支持：

- 同一模型的多次重试
- primary -> fallback model 路由
- 在无模型配置或显式允许时降级到 `openclaw` CLI

这部分是向 external harness 里“model routing”思路靠齐，但保留了 AgentCore OS 自己的 contract 和 trace。

### 3. 审计脱敏

执行历史和审计存储现在会对典型敏感值做脱敏：

- `Bearer ...`
- `apiKey=...`
- `token=...`
- `secret=...`
- OpenAI / Anthropic 风格 key

这一步非常重要。企业级系统不能把 operator 在 prompt、上下文、输出里误贴的密钥原样写入本地 trace。

### 4. 运维健康面

新增执行器健康摘要接口：

- `GET /api/runtime/executor/health`

当前会输出：

- 总执行次数
- 成功 / 失败数量
- fallback 次数
- 近 24 小时失败率
- 近 24 小时 fallback rate
- 平均耗时与 p95 耗时
- 最近失败时间
- 最近使用的 provider 列表

这让“系统是否稳定”第一次有了执行层视角，而不只是 docker / sidecar 视角。

## 下一阶段建议

### Phase 1. 把执行治理做成正式控制面

目标：

- 给设置中心增加 provider pool / fallback policy 配置
- 按工作流族定义默认路由策略
- 区分 cost-first / latency-first / quality-first 三种执行策略

建议模块：

- `src/lib/executor/policy.ts`
- `src/lib/settings.ts`
- `src/components/apps/SettingsAppWindow.tsx`

### Phase 2. 做真正的 Skill Runtime

当前 `useSkills` 仍然偏策略开关，下一阶段要进入可审计调度：

- `Skill Catalog`
- `Skill Planner`
- `Skill Runner`
- `Skill Receipt`

重点先做四类高价值技能：

- 销售资格判断
- 客服答复生成
- 事实核验
- 知识资产沉淀

### Phase 3. 做 Memory V2

不要把“会话历史”误当成“记忆系统”。

下一阶段的 Memory V2 应该分三层：

- `raw session history`
- `workflow artifact memory`
- `distilled operating instincts`

其中第三层才是真正接近 external harness 里 persistent memory / instinct 的部分。

建议先在销售和客服两条 Hero Workflow 里做：

- 常见 objection pattern 抽取
- 高成功率回复结构抽取
- 失败案例边界沉淀

### Phase 4. 做 AgentShield 风格安全层

企业级可用不只看成功率，也看“错的时候怎么错”。

建议补一层统一安全校验：

- 高风险工具执行前置确认
- 本地敏感文件路径规则
- prompt / output 泄密扫描
- destructive action policy
- connector outbound boundary audit

### Phase 5. 做 SLO 与回放

当执行链变复杂后，系统必须能回答这些问题：

- 过去 24 小时哪条工作流最不稳定
- 哪个 provider 的失败率最高
- 哪类任务最常触发 fallback
- 哪次 session 出问题时到底经过了几次 attempt

这需要：

- execution replay
- per-workflow metrics
- per-provider SLO
- regression snapshots

## 项目结构建议

建议把接下来的工作聚焦到这几个目录，而不是继续扩散在 app surface：

- `src/lib/executor/*`
- `src/lib/server/executor-*`
- `src/app/api/runtime/executor/*`
- `scripts/regression/workflows.mjs`

产品层原则：

- 少加新 app
- 多做强工作流
- 所有“更智能”的能力都先沉到执行层和记忆层

## 结论

如果说以前的 AgentCore OS 更像“带很多应用的 AI 工作台”，那么下一阶段应该把它收敛成：

**有执行治理、有可追溯 memory、有安全护栏、有运维健康面的本地优先 Agent Operating System。**

这才是走向企业级使用标准的正确方向。
