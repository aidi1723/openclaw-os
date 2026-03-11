export type SolutionBlueprint = {
  positioning: string;
  playbook: string[];
  sop: Array<{
    step: string;
    owner: string;
    automation: string;
    exit: string;
  }>;
  kpis: Array<{
    label: string;
    target: string;
    note: string;
  }>;
  guardrails: string[];
};

export const solutionBlueprints: Record<string, SolutionBlueprint> = {
  "sales-inbound-quote": {
    positioning:
      "把外贸询盘从碎片化聊天，升级成一条可复制的资格判断 -> 跟进 -> CRM 收口链。",
    playbook: [
      "先在 10 分钟内完成询盘资格判断，不让高意向客户停留在原始消息里。",
      "报价和首轮跟进必须带着语言偏好、MOQ、交期和关键规格一起推进。",
      "每一次推进都要写回 CRM，沉淀成下一次可复用的话术和偏好资产。",
    ],
    sop: [
      {
        step: "询盘进入 Deal Desk",
        owner: "销售 / 渠道负责人",
        automation: "自动抽取客户、产品、预算、时间和语言偏好",
        exit: "形成可判断的线索卡片",
      },
      {
        step: "Email Assistant 生成首轮跟进",
        owner: "AI 起草 + 人工审核",
        automation: "自动生成英文主稿和补充说明",
        exit: "确认可发送的报价跟进草稿",
      },
      {
        step: "Personal CRM 完成资产回写",
        owner: "销售",
        automation: "自动带入联系人、下一步动作和偏好信息",
        exit: "形成持续跟进节奏和客户画像",
      },
    ],
    kpis: [
      {
        label: "首响时间",
        target: "< 15 分钟",
        note: "高价值询盘不要停在收件箱或聊天工具里。",
      },
      {
        label: "资格判断完成率",
        target: "> 90%",
        note: "确保每条线索都被归类，而不是只凭感觉推进。",
      },
      {
        label: "CRM 回写率",
        target: "100%",
        note: "没有资产沉淀的销售流程，无法形成可复制打法。",
      },
    ],
    guardrails: [
      "正式报价、合同和关键商务承诺必须人工确认后外发。",
      "客户偏好和敏感商务信息只在本地资产层保留，不做公开分发。",
    ],
  },
  "creator-campaign-sprint": {
    positioning:
      "把内容生产从单点写稿，升级成选题 -> 内容包 -> 发布预演 -> 复用资产的增长链。",
    playbook: [
      "先做今日最值得推进的一条主题，不让团队被多个选题分散。",
      "长内容必须拆成多平台内容包，让一次研究服务多个发布出口。",
      "发布前先做预演和平台适配，避免内容直接停在草稿层。",
    ],
    sop: [
      {
        step: "Creator Radar 确认今日主选题",
        owner: "内容负责人",
        automation: "自动整理热点、竞品和用户问题",
        exit: "确定一个主角度和目标受众",
      },
      {
        step: "Content Repurposer 生成内容包",
        owner: "AI 辅助 + 内容编辑",
        automation: "自动拆成口播、帖子、newsletter 等版本",
        exit: "得到可投放的多平台内容块",
      },
      {
        step: "Publisher 做发布预演",
        owner: "运营 / 创作者",
        automation: "自动检查 hook、CTA、平台适配和分发模式",
        exit: "确认排期或进入人工发布",
      },
    ],
    kpis: [
      {
        label: "一稿多拆率",
        target: "> 3 个平台版本",
        note: "不是多做内容，而是提高单次内容生产的复用效率。",
      },
      {
        label: "发布前预演覆盖率",
        target: "100%",
        note: "避免内容未经平台适配直接上线。",
      },
      {
        label: "资产复用率",
        target: "> 40%",
        note: "高表现 hook、结构和脚本要被持续复用。",
      },
    ],
    guardrails: [
      "自动发布只用于低风险渠道，品牌账号和敏感内容默认需要人工确认。",
      "最终对外版本必须允许运营修改，不让 AI 直接锁死表达方式。",
    ],
  },
  "support-escalation-recovery": {
    positioning:
      "把多渠道投诉和升级问题，统一收口成可追踪的安抚、处理和 FAQ 沉淀链。",
    playbook: [
      "先统一客户上下文，再做回复，不让客服在不同渠道里重复找信息。",
      "回复草稿和补偿边界要分层，AI 给建议，人负责最终承诺。",
      "问题处理完不是结束，必须沉淀成 FAQ、升级规则和 CRM 历史。",
    ],
    sop: [
      {
        step: "Inbox / Support Copilot 收拢问题",
        owner: "客服",
        automation: "自动提取问题摘要、客户情绪和渠道来源",
        exit: "形成单一可处理工单",
      },
      {
        step: "生成建议回复并人工确认",
        owner: "AI 起草 + 客服主管",
        automation: "自动生成专业回复和升级动作建议",
        exit: "确认可发送回复与补偿边界",
      },
      {
        step: "回写 CRM 与 FAQ",
        owner: "客服运营",
        automation: "自动沉淀客户记录、FAQ 和后续跟进",
        exit: "形成下一次可复用知识资产",
      },
    ],
    kpis: [
      {
        label: "首次安抚时长",
        target: "< 20 分钟",
        note: "客户情绪问题越拖越难收口。",
      },
      {
        label: "升级问题闭环率",
        target: "> 95%",
        note: "确保高风险问题最终进入处理完成态，而不是停在回复草稿。",
      },
      {
        label: "FAQ 沉淀率",
        target: "> 60%",
        note: "重复问题必须转成知识，不然团队永远重复劳动。",
      },
    ],
    guardrails: [
      "补偿、退款和对外承诺必须人工确认后才能发送。",
      "高情绪和高传播风险问题不允许纯自动回复。",
    ],
  },
  "research-market-scan": {
    positioning:
      "把市场扫描从单次研究，升级成研究输入 -> 结构化判断 -> 晨报摘要 -> 长期知识沉淀链。",
    playbook: [
      "研究先做观察框架，不先堆资料，确保每次扫描围绕同一套决策问题展开。",
      "输出必须从长报告压到决策摘要，研究结果要能进入经营节奏。",
      "长期有效的分析框架和观察维度要写入知识层，不让结论只停在一次性报告里。",
    ],
    sop: [
      {
        step: "Deep Research Hub 采集与归纳",
        owner: "研究 / 策略负责人",
        automation: "自动收敛来源、角度和关键发现",
        exit: "形成结构化研究简报",
      },
      {
        step: "Knowledge Vault 沉淀框架",
        owner: "研究团队",
        automation: "自动记录长期有效的观察维度与结论",
        exit: "形成可复用研究框架",
      },
      {
        step: "Morning Brief 压缩成决策输入",
        owner: "CEO / 产品 / 策略负责人",
        automation: "自动提炼当天真正需要关注的判断和动作",
        exit: "进入日常经营和决策节奏",
      },
    ],
    kpis: [
      {
        label: "研究转晨报率",
        target: "> 70%",
        note: "研究不是为了归档，而是为了进入真实决策。",
      },
      {
        label: "框架复用率",
        target: "> 50%",
        note: "说明系统开始形成稳定的方法论，而不是每次从零开始。",
      },
      {
        label: "扫描周期",
        target: "每周固定完成",
        note: "研究能力要进入运营节奏，而不是临时冲刺。",
      },
    ],
    guardrails: [
      "未经验证的外部结论必须明确标注假设性质，不能直接作为确定性判断分发。",
      "最终决策建议由负责人确认，不把 AI 摘要直接当成正式战略结论。",
    ],
  },
  "recruiting-candidate-loop": {
    positioning:
      "把招聘流程从简历与面试记录，升级成评分、跟进和招聘 SOP 的持续闭环。",
    playbook: [
      "每轮面试都必须落成结构化评分，不让印象判断主导推进。",
      "候选人沟通要和评估信息联动，避免面试官与招聘方信息断层。",
      "高表现岗位问题库和评分框架要持续沉淀，形成招聘方法论资产。",
    ],
    sop: [
      {
        step: "Recruiting Desk 录入候选人上下文",
        owner: "招聘负责人",
        automation: "自动整理候选人资料和面试观察",
        exit: "形成统一候选人卡片",
      },
      {
        step: "评分与下一轮安排",
        owner: "用人经理 + 招聘",
        automation: "自动提示待验证项和推荐下一步",
        exit: "明确推进、淘汰或补充面试动作",
      },
      {
        step: "Email Assistant 跟进",
        owner: "招聘",
        automation: "自动起草候选人 follow-up 邮件",
        exit: "形成标准化招聘沟通节奏",
      },
    ],
    kpis: [
      {
        label: "评分卡覆盖率",
        target: "100%",
        note: "避免关键岗位只靠主观判断推进。",
      },
      {
        label: "候选人反馈时效",
        target: "< 24 小时",
        note: "招聘体验直接影响候选人转化和雇主品牌。",
      },
      {
        label: "岗位问题库复用率",
        target: "> 60%",
        note: "招聘能力要沉淀成标准方法，而不是依赖个别面试官。",
      },
    ],
    guardrails: [
      "录用、拒绝和薪资沟通必须人工确认后再外发。",
      "候选人个人隐私信息只用于招聘流程内部，不做跨场景扩散。",
    ],
  },
  "ops-weekly-risk-sync": {
    positioning:
      "把项目周报、风险同步和任务收口，升级成稳定的项目运营节奏系统。",
    playbook: [
      "先统一项目健康度和阻塞，再开会，不让周会变成信息交换会。",
      "所有风险都要落到 owner、时间和动作，不接受只有描述没有责任人。",
      "每周输出 brief、动作项和复盘，形成项目治理资产。",
    ],
    sop: [
      {
        step: "Morning Brief 压缩本周重点",
        owner: "项目负责人",
        automation: "自动整理待确认风险和本周最重要目标",
        exit: "明确会议主线",
      },
      {
        step: "Project Ops 更新健康度与阻塞",
        owner: "交付 / 运营 lead",
        automation: "自动归纳进展、阻塞和 owner 缺口",
        exit: "形成结构化项目 brief",
      },
      {
        step: "Meeting Copilot 收口动作项",
        owner: "项目经理",
        automation: "自动生成会议记录和后续待办",
        exit: "动作项进入任务系统并可追踪",
      },
    ],
    kpis: [
      {
        label: "风险 owner 明确率",
        target: "100%",
        note: "所有高风险事项必须有 owner 和时间点。",
      },
      {
        label: "会后动作项回写率",
        target: "100%",
        note: "周会价值不在讨论，而在动作项落地。",
      },
      {
        label: "健康度更新频率",
        target: "每周固定",
        note: "项目系统感来自稳定节奏，而不是临时救火。",
      },
    ],
    guardrails: [
      "项目对外承诺和上线节点必须由负责人最终确认。",
      "高风险延期和资源调整不能仅靠 AI 建议自动执行。",
    ],
  },
};

export function getSolutionBlueprint(starterId: string) {
  return solutionBlueprints[starterId] ?? null;
}
