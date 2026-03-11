import type { AppId } from "@/apps/types";

export type WorkspaceIndustryId =
  | "general"
  | "creator"
  | "sales"
  | "support"
  | "research"
  | "people"
  | "operations"
  | "personal";

export type WorkspaceRoleId =
  | "ceo"
  | "creator"
  | "sales"
  | "ops"
  | "research"
  | "people";

export type WorkspaceScenario = {
  id: string;
  industryId: WorkspaceIndustryId;
  title: string;
  desc: string;
  desktopApps: AppId[];
  dockApps: AppId[];
  triggers: Array<{
    id: string;
    title: string;
    type: "manual" | "schedule" | "inbound_message" | "web_form";
    desc: string;
  }>;
  workflowTitle: string;
  workflowStages: Array<{
    id: string;
    title: string;
    desc: string;
    mode: "auto" | "assist" | "review" | "manual";
    appIds: AppId[];
  }>;
  resultAssets: string[];
};

export type WorkspaceRoleDesk = {
  id: WorkspaceRoleId;
  title: string;
  desc: string;
  scenarioId: string;
  focus: string[];
};

export const workspaceIndustries: Array<{
  id: WorkspaceIndustryId;
  title: string;
  desc: string;
}> = [
  {
    id: "general",
    title: "通用团队",
    desc: "适合 founder、运营负责人或需要多场景切换的通用工作台。",
  },
  {
    id: "creator",
    title: "内容与创作者",
    desc: "适合内容团队、自媒体、品牌增长和创作者工作流。",
  },
  {
    id: "sales",
    title: "销售与商务",
    desc: "适合线索跟进、外联、提案和客户关系推进。",
  },
  {
    id: "support",
    title: "客服与用户运营",
    desc: "适合工单、私信、评论区和 FAQ 回答场景。",
  },
  {
    id: "research",
    title: "研究与策略",
    desc: "适合情报、研究、竞争观察和长期洞察沉淀。",
  },
  {
    id: "people",
    title: "招聘与人才",
    desc: "适合招聘筛选、面试记录、候选人评分和跟进。",
  },
  {
    id: "operations",
    title: "项目与运营",
    desc: "适合项目推进、周报、风险同步和执行跟踪。",
  },
  {
    id: "personal",
    title: "个人与家庭",
    desc: "适合习惯、健康、家庭节奏、语言学习和个人生活管理。",
  },
];

export const workspaceRoleDesks: WorkspaceRoleDesk[] = [
  {
    id: "ceo",
    title: "CEO Desk",
    desc: "看摘要、抓风险、盯推进，用最少入口判断今天最重要的事。",
    scenarioId: "founder-command",
    focus: ["晨报摘要", "关键推进", "会后闭环", "风险与决策"],
  },
  {
    id: "creator",
    title: "Creator Desk",
    desc: "围绕选题、改写、分发和复盘的内容增长桌面。",
    scenarioId: "creator-studio",
    focus: ["选题雷达", "内容改写", "发布预演", "资产沉淀"],
  },
  {
    id: "sales",
    title: "Sales Desk",
    desc: "聚焦线索判断、邮件推进、CRM 跟进和成交闭环。",
    scenarioId: "sales-pipeline",
    focus: ["线索筛选", "跟进邮件", "CRM 推进", "成交机会"],
  },
  {
    id: "ops",
    title: "Ops Desk",
    desc: "让任务、周报、风险同步和执行状态更可见。",
    scenarioId: "project-delivery",
    focus: ["任务收口", "项目节奏", "风险同步", "执行追踪"],
  },
  {
    id: "research",
    title: "Research Desk",
    desc: "从研究输入、情报摘要到观点沉淀的一体化工作台。",
    scenarioId: "research-radar",
    focus: ["情报摄取", "研究摘要", "观点沉淀", "内容转化"],
  },
  {
    id: "people",
    title: "People Desk",
    desc: "围绕岗位筛选、面试记录、候选人推进和后续动作。",
    scenarioId: "recruiting-pipeline",
    focus: ["候选人筛选", "面试记录", "邮件跟进", "招聘闭环"],
  },
];

export const workspaceScenarios: WorkspaceScenario[] = [
  {
    id: "founder-command",
    industryId: "general",
    title: "Founder Command Center",
    desc: "信息摄取、晨报、会议、CRM、邮件和知识沉淀放在一张桌面上。",
    desktopApps: [
      "website_seo_studio",
      "tech_news_digest",
      "morning_brief",
      "meeting_copilot",
      "personal_crm",
      "email_assistant",
      "deal_desk",
      "second_brain",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "website_seo_studio",
      "morning_brief",
      "task_manager",
      "personal_crm",
      "email_assistant",
      "knowledge_vault",
      "settings",
    ],
    triggers: [
      { id: "manual", title: "手动开机", type: "manual", desc: "Founder 主动进入工作台，启动今天的经营节奏。" },
      { id: "daily-brief", title: "每日晨报", type: "schedule", desc: "定时拉起今日摘要与关键推进信号。" },
    ],
    workflowTitle: "从信号摄取到经营推进的单人指挥链",
    workflowStages: [
      {
        id: "signals",
        title: "摄取信号",
        desc: "先把外部信息、站点动态和晨报压缩成今天的判断输入。",
        mode: "assist",
        appIds: ["website_seo_studio", "tech_news_digest", "morning_brief"],
      },
      {
        id: "priorities",
        title: "判断优先级",
        desc: "把今天真正要推进的线索、会议和任务收口成少量主线。",
        mode: "review",
        appIds: ["morning_brief", "deal_desk", "task_manager"],
      },
      {
        id: "execution",
        title: "推进执行",
        desc: "围绕客户、邮件和会议结论进入真正的业务动作。",
        mode: "assist",
        appIds: ["meeting_copilot", "personal_crm", "email_assistant"],
      },
      {
        id: "assets",
        title: "沉淀资产",
        desc: "把结论、模板和复用框架写入长期资产层。",
        mode: "manual",
        appIds: ["second_brain", "knowledge_vault"],
      },
    ],
    resultAssets: ["决策摘要", "跟进模板", "联系人推进规则", "长期知识条目"],
  },
  {
    id: "creator-studio",
    industryId: "creator",
    title: "Creator Studio",
    desc: "从 Tech Digest、Creator Radar 到 Repurposer、发布中心的一条龙内容工作台。",
    desktopApps: [
      "tech_news_digest",
      "website_seo_studio",
      "social_media_autopilot",
      "creator_radar",
      "content_repurposer",
      "media_ops",
      "creative_studio",
      "publisher",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "website_seo_studio",
      "creator_radar",
      "social_media_autopilot",
      "content_repurposer",
      "media_ops",
      "creative_studio",
      "publisher",
      "settings",
    ],
    triggers: [
      { id: "manual", title: "手动选题", type: "manual", desc: "内容负责人主动开始今天的内容生产链。" },
      { id: "content-schedule", title: "内容日历", type: "schedule", desc: "按日更/周更节奏拉起内容工作流。" },
    ],
    workflowTitle: "从选题、改写到分发和复盘的内容增长链",
    workflowStages: [
      {
        id: "radar",
        title: "发现选题",
        desc: "从 Tech Digest 和 Creator Radar 里筛出今天最值得推进的一条内容。",
        mode: "assist",
        appIds: ["tech_news_digest", "creator_radar"],
      },
      {
        id: "repurpose",
        title: "生成内容包",
        desc: "把长内容或摘要拆成短视频、帖子和 newsletter 等可执行版本。",
        mode: "assist",
        appIds: ["content_repurposer", "media_ops", "creative_studio"],
      },
      {
        id: "preflight",
        title: "发布前检查",
        desc: "检查标题、CTA、平台匹配度和自动化条件，必要时先做修正版。",
        mode: "review",
        appIds: ["publisher"],
      },
      {
        id: "publish-loop",
        title: "发布与复用",
        desc: "进入预演/分发，再把有效版本和经验沉淀成可复用资产。",
        mode: "assist",
        appIds: ["publisher", "knowledge_vault", "task_manager"],
      },
    ],
    resultAssets: ["平台文案模板", "高表现内容结构", "发布候选稿", "复盘笔记"],
  },
  {
    id: "sales-pipeline",
    industryId: "sales",
    title: "Sales Pipeline Desk",
    desc: "聚焦线索判断、CRM、邮件跟进和会后闭环。",
    desktopApps: [
      "morning_brief",
      "meeting_copilot",
      "deal_desk",
      "personal_crm",
      "email_assistant",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "deal_desk",
      "personal_crm",
      "email_assistant",
      "task_manager",
      "settings",
    ],
    triggers: [
      { id: "inquiry", title: "客户询盘", type: "inbound_message", desc: "收到新询盘邮件、WhatsApp 或私信后触发。" },
      { id: "followup", title: "定时跟进", type: "schedule", desc: "到达跟进时间，系统拉起下一轮销售动作。" },
      { id: "manual", title: "手动录入线索", type: "web_form", desc: "销售主动录入来自展会、名片或线下渠道的新线索。" },
    ],
    workflowTitle: "从线索筛选到成交跟进的销售推进链",
    workflowStages: [
      {
        id: "qualify",
        title: "筛选线索",
        desc: "先判断机会优先级，不把所有线索都当成同一类处理。",
        mode: "assist",
        appIds: ["deal_desk", "morning_brief"],
      },
      {
        id: "outreach",
        title: "生成跟进",
        desc: "基于客户背景和阶段生成更贴近推进目标的邮件或话术。",
        mode: "review",
        appIds: ["email_assistant", "personal_crm"],
      },
      {
        id: "meeting",
        title: "会后收口",
        desc: "把会议结论和下一步推进动作同步到 CRM 与任务里。",
        mode: "assist",
        appIds: ["meeting_copilot", "personal_crm", "task_manager"],
      },
      {
        id: "assetize",
        title: "沉淀打法",
        desc: "把高效话术、 objection handling 和推进节奏沉淀成资产。",
        mode: "manual",
        appIds: ["knowledge_vault"],
      },
    ],
    resultAssets: ["客户画像结构", "跟进邮件节奏", "销售话术模板", "机会推进规则"],
  },
  {
    id: "support-ops",
    industryId: "support",
    title: "Support Ops Desk",
    desc: "统一收件箱、客服回复、知识库和任务跟进。",
    desktopApps: [
      "morning_brief",
      "inbox_declutter",
      "support_copilot",
      "personal_crm",
      "knowledge_vault",
      "task_manager",
      "email_assistant",
      "settings",
    ],
    dockApps: [
      "inbox_declutter",
      "support_copilot",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    triggers: [
      { id: "ticket", title: "收到问题", type: "inbound_message", desc: "新的工单、私信或评论进入后触发。" },
      { id: "manual", title: "人工补录", type: "manual", desc: "客服手动拉起一条高风险或特殊问题处理链。" },
    ],
    workflowTitle: "从收件、回复到 FAQ 和任务收口的客服链",
    workflowStages: [
      {
        id: "capture",
        title: "收拢问题",
        desc: "把私信、评论和工单先做意图归类和轻量整理。",
        mode: "assist",
        appIds: ["inbox_declutter", "morning_brief"],
      },
      {
        id: "reply",
        title: "建议回复",
        desc: "先给出建议回复，再由人工确认敏感内容或高风险动作。",
        mode: "review",
        appIds: ["support_copilot", "email_assistant"],
      },
      {
        id: "followup",
        title: "跟进处理",
        desc: "对需要持续跟进的问题转成任务或联系人动作。",
        mode: "assist",
        appIds: ["personal_crm", "task_manager"],
      },
      {
        id: "faq",
        title: "沉淀 FAQ",
        desc: "把高频问题和标准回复写回知识层。",
        mode: "manual",
        appIds: ["knowledge_vault"],
      },
    ],
    resultAssets: ["标准回复模板", "FAQ 知识条目", "升级处理规则"],
  },
  {
    id: "research-radar",
    industryId: "research",
    title: "Research Radar",
    desc: "围绕 digest、brief、知识沉淀和观点输出的一体化工作台。",
    desktopApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "creator_radar",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "second_brain",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    triggers: [
      { id: "research-request", title: "研究任务", type: "web_form", desc: "收到新的主题、竞品或决策研究需求后触发。" },
      { id: "digest", title: "定时情报摘要", type: "schedule", desc: "按固定频率拉取并整理研究输入。" },
    ],
    workflowTitle: "从研究输入到观点输出和业务分发的研究链",
    workflowStages: [
      {
        id: "capture",
        title: "摄取研究输入",
        desc: "先收集新闻、资料、主题和研究方向。",
        mode: "assist",
        appIds: ["deep_research_hub", "tech_news_digest"],
      },
      {
        id: "synthesize",
        title: "形成摘要",
        desc: "把复杂输入压成可以被决策和执行使用的摘要。",
        mode: "review",
        appIds: ["morning_brief", "second_brain"],
      },
      {
        id: "route",
        title: "分发洞察",
        desc: "把研究结论送给内容、任务或知识系统。",
        mode: "assist",
        appIds: ["knowledge_vault", "creator_radar", "task_manager"],
      },
      {
        id: "assetize",
        title: "沉淀框架",
        desc: "把研究方法和分析框架保留下来，供后续复用。",
        mode: "manual",
        appIds: ["second_brain", "knowledge_vault"],
      },
    ],
    resultAssets: ["研究摘要模板", "分析框架", "观点资产", "后续执行清单"],
  },
  {
    id: "recruiting-pipeline",
    industryId: "people",
    title: "Recruiting Pipeline",
    desc: "适合岗位筛选、候选人评分、面试跟进和后续动作收口。",
    desktopApps: [
      "industry_hub",
      "recruiting_desk",
      "meeting_copilot",
      "email_assistant",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "recruiting_desk",
      "email_assistant",
      "task_manager",
      "settings",
    ],
    triggers: [
      { id: "candidate", title: "新候选人", type: "inbound_message", desc: "收到新简历或候选人资料时触发。" },
      { id: "manual", title: "手动发起面试流程", type: "manual", desc: "招聘负责人主动发起一条候选人推进链。" },
    ],
    workflowTitle: "从候选人筛选到面试反馈和后续动作的招聘链",
    workflowStages: [
      {
        id: "screen",
        title: "筛选候选人",
        desc: "先把简历和岗位需求做基础匹配，不让后续面试失焦。",
        mode: "assist",
        appIds: ["recruiting_desk"],
      },
      {
        id: "interview",
        title: "整理面试",
        desc: "把纪要、优缺点和判断点统一落成可比对结果。",
        mode: "review",
        appIds: ["meeting_copilot", "recruiting_desk"],
      },
      {
        id: "followup",
        title: "跟进推进",
        desc: "把候选人后续动作和邮件推进做成明确清单。",
        mode: "assist",
        appIds: ["email_assistant", "task_manager"],
      },
      {
        id: "playbook",
        title: "沉淀招聘打法",
        desc: "把评分标准、问题库和流程节奏写成长期 SOP。",
        mode: "manual",
        appIds: ["knowledge_vault"],
      },
    ],
    resultAssets: ["面试评分框架", "岗位问题库", "招聘流程 SOP"],
  },
  {
    id: "project-delivery",
    industryId: "operations",
    title: "Project Delivery Board",
    desc: "适合项目周报、风险同步、任务推进和跨团队执行收口。",
    desktopApps: [
      "industry_hub",
      "project_ops",
      "morning_brief",
      "meeting_copilot",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "project_ops",
      "task_manager",
      "morning_brief",
      "settings",
    ],
    triggers: [
      { id: "daily-sync", title: "每日同步", type: "schedule", desc: "按天拉起项目状态和风险同步。" },
      { id: "manual", title: "手动复盘", type: "manual", desc: "运营负责人主动收口项目与团队执行状态。" },
    ],
    workflowTitle: "从状态同步到风险收口和执行跟踪的运营链",
    workflowStages: [
      {
        id: "status",
        title: "汇总状态",
        desc: "先把任务、项目和日程状态做成统一视图。",
        mode: "assist",
        appIds: ["project_ops", "morning_brief"],
      },
      {
        id: "risk",
        title: "识别风险",
        desc: "把阻塞点和跨团队问题从状态里提出来。",
        mode: "review",
        appIds: ["meeting_copilot", "project_ops"],
      },
      {
        id: "execute",
        title: "推进执行",
        desc: "把行动项写入任务系统并持续跟踪。",
        mode: "assist",
        appIds: ["task_manager", "project_ops"],
      },
      {
        id: "retro",
        title: "沉淀复盘",
        desc: "把风险经验和流程改进写回知识层。",
        mode: "manual",
        appIds: ["knowledge_vault"],
      },
    ],
    resultAssets: ["项目复盘", "风险清单", "执行模板", "团队 SOP"],
  },
  {
    id: "personal-rhythm",
    industryId: "personal",
    title: "Personal Rhythm",
    desc: "适合个人和家庭：晨报、日历、习惯、健康和长期记录。",
    desktopApps: [
      "morning_brief",
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "language_learning_desk",
      "second_brain",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "language_learning_desk",
      "task_manager",
      "settings",
    ],
    triggers: [
      { id: "morning", title: "晨间启动", type: "schedule", desc: "每天固定时间拉起个人节奏工作流。" },
      { id: "manual", title: "手动复盘", type: "manual", desc: "用户主动回看自己的节奏与状态。" },
    ],
    workflowTitle: "从晨间安排到习惯、健康和长期记录的个人节奏链",
    workflowStages: [
      {
        id: "start",
        title: "晨间起步",
        desc: "先看今天重点，再决定个人节奏安排。",
        mode: "assist",
        appIds: ["morning_brief", "task_manager"],
      },
      {
        id: "track",
        title: "记录状态",
        desc: "把日历、习惯和健康状态持续记下来。",
        mode: "manual",
        appIds: ["family_calendar", "habit_tracker", "health_tracker"],
      },
      {
        id: "improve",
        title: "微调节奏",
        desc: "根据记录结果调整学习、健康和生活节奏。",
        mode: "review",
        appIds: ["language_learning_desk", "second_brain"],
      },
      {
        id: "archive",
        title: "沉淀长期记录",
        desc: "把有效做法写成自己的长期模式。",
        mode: "manual",
        appIds: ["second_brain"],
      },
    ],
    resultAssets: ["个人节奏模板", "习惯复盘", "健康观察记录"],
  },
  {
    id: "language-immersion",
    industryId: "personal",
    title: "Language Immersion Desk",
    desc: "适合翻译、口语练习、短句库沉淀和周期性复习。",
    desktopApps: [
      "language_learning_desk",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "language_learning_desk",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    triggers: [
      { id: "practice", title: "开始练习", type: "manual", desc: "用户主动开始一轮语言训练。" },
      { id: "review", title: "到达复习时间", type: "schedule", desc: "按复习计划自动提醒并拉起练习链。" },
    ],
    workflowTitle: "从输入、练习到复习和沉淀的语言学习链",
    workflowStages: [
      {
        id: "input",
        title: "输入素材",
        desc: "先选场景和素材，不把练习做得过散。",
        mode: "manual",
        appIds: ["language_learning_desk"],
      },
      {
        id: "practice",
        title: "生成练习",
        desc: "把翻译、口语和表达练习变成可立即执行的小包。",
        mode: "assist",
        appIds: ["language_learning_desk", "morning_brief"],
      },
      {
        id: "review",
        title: "安排复习",
        desc: "把重点表达和下次复习安排明确化。",
        mode: "review",
        appIds: ["task_manager", "knowledge_vault"],
      },
      {
        id: "asset",
        title: "沉淀表达库",
        desc: "保留真正会重复使用的表达和场景模板。",
        mode: "manual",
        appIds: ["knowledge_vault", "second_brain"],
      },
    ],
    resultAssets: ["表达模板", "复习清单", "场景化练习包"],
  },
];

export function getWorkspaceScenario(scenarioId: string) {
  return workspaceScenarios.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function listWorkspaceScenarios(industryId: WorkspaceIndustryId) {
  return workspaceScenarios.filter((scenario) => scenario.industryId === industryId);
}

export function getWorkspaceRoleDesk(roleId: WorkspaceRoleId) {
  return workspaceRoleDesks.find((role) => role.id === roleId) ?? null;
}
