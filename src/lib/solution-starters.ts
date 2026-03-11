import type { AppId } from "@/apps/types";
import type { IndustryId } from "@/lib/industry-solutions";
import {
  requestComposeEmail,
  requestOpenApp,
  requestOpenContentRepurposer,
  requestOpenCreatorRadar,
  requestOpenCrm,
  requestOpenDealDesk,
  requestOpenKnowledgeVault,
  requestOpenMorningBrief,
  requestOpenProjectOps,
  requestOpenPublisher,
  requestOpenRecruitingDesk,
  requestOpenResearchHub,
  requestOpenSupportCopilot,
  type ContentRepurposerPrefill,
  type CreatorRadarPrefill,
  type DealDeskPrefill,
  type EmailAssistantPrefill,
  type KnowledgeVaultPrefill,
  type MorningBriefPrefill,
  type PersonalCrmPrefill,
  type ProjectOpsPrefill,
  type PublisherPrefill,
  type RecruitingDeskPrefill,
  type ResearchHubPrefill,
  type SupportCopilotPrefill,
} from "@/lib/ui-events";
import type { WorkspaceRoleId } from "@/lib/workspace-presets";
import type { WorkflowTriggerType } from "@/lib/workflow-runs";

type SolutionStarterAction =
  | { type: "open_app"; appId: AppId }
  | { type: "deal_desk"; prefill: DealDeskPrefill }
  | { type: "email"; prefill: EmailAssistantPrefill }
  | { type: "crm"; prefill: PersonalCrmPrefill }
  | { type: "morning_brief"; prefill: MorningBriefPrefill }
  | { type: "knowledge_vault"; prefill: KnowledgeVaultPrefill }
  | { type: "support"; prefill: SupportCopilotPrefill }
  | { type: "research"; prefill: ResearchHubPrefill }
  | { type: "project_ops"; prefill: ProjectOpsPrefill }
  | { type: "recruiting"; prefill: RecruitingDeskPrefill }
  | { type: "creator_radar"; prefill: CreatorRadarPrefill }
  | { type: "content_repurposer"; prefill: ContentRepurposerPrefill }
  | { type: "publisher"; prefill: PublisherPrefill };

export type IndustrySolutionStarter = {
  id: string;
  industryId: IndustryId;
  bundleId: string;
  scenarioId: string;
  roleId?: WorkspaceRoleId;
  title: string;
  summary: string;
  triggerLabel: string;
  outcomeLabel: string;
  assets: string[];
  apps: AppId[];
  accent: "blue" | "emerald" | "amber" | "rose" | "slate";
  triggerType: WorkflowTriggerType;
  actions: SolutionStarterAction[];
};

export const industrySolutionStarters: IndustrySolutionStarter[] = [
  {
    id: "sales-inbound-quote",
    industryId: "sales_growth",
    bundleId: "sales-pipeline",
    scenarioId: "sales-pipeline",
    roleId: "sales",
    title: "门窗外贸询盘推进",
    summary: "从海外客户询盘进入资格判断、报价跟进和 CRM 收口，适合外贸销售或渠道拓展团队。",
    triggerLabel: "WhatsApp / 邮件收到新询盘",
    outcomeLabel: "输出资格判断、首轮跟进稿和本地客户资产",
    assets: ["客户偏好", "报价状态", "跟进节奏"],
    apps: ["deal_desk", "email_assistant", "personal_crm"],
    accent: "amber",
    triggerType: "inbound_message",
    actions: [
      {
        type: "deal_desk",
        prefill: {
          company: "Al Noor Facades LLC",
          contact: "Omar Rahman",
          inquiryChannel: "WhatsApp",
          preferredLanguage: "English + Arabic summary",
          productLine: "断桥铝门窗 / Sliding System",
          need: "迪拜住宅项目需要推拉门和三层玻璃系统，重点关注隔热、防腐与 6 周内可出货规格。",
          budget: "USD 28,000 - 35,000",
          timing: "两周内确认方案，下月下首批订单",
          notes: "客户先要英文报价并附阿拉伯语摘要，最关心 MOQ、玻璃配置和交期。",
          stage: "new",
          workflowTriggerType: "inbound_message",
          workflowSource: "来自海外门窗客户的 WhatsApp 询盘",
          workflowNextStep: "先做资格判断，再生成英文跟进和报价说明。",
        },
      },
      { type: "open_app", appId: "email_assistant" },
      { type: "open_app", appId: "personal_crm" },
    ],
  },
  {
    id: "creator-campaign-sprint",
    industryId: "creator_media",
    bundleId: "creator-command",
    scenarioId: "creator-studio",
    roleId: "creator",
    title: "创作者内容增长冲刺",
    summary: "把每日选题、内容改写和发布预演连起来，适合品牌内容团队、自媒体和独立创作者。",
    triggerLabel: "每日内容日历 / 热点信号",
    outcomeLabel: "输出可发布内容包和 Publisher 预演草稿",
    assets: ["Hook 模板", "多平台内容包", "复用脚本"],
    apps: ["creator_radar", "content_repurposer", "publisher"],
    accent: "blue",
    triggerType: "schedule",
    actions: [
      {
        type: "creator_radar",
        prefill: {
          title: "工厂型企业怎么用 AI agents 提升外贸询盘转化",
          channels: "YouTube / X / competitor newsletters / founder notes",
          audience: "跨境制造业老板与增长负责人",
          goal: "今天产出 1 条短视频口播 + 1 条 LinkedIn 帖子",
          notes: "强调真实工作流，不讲空泛 AGI；突出询盘转化、跟进和交付。",
        },
      },
      {
        type: "content_repurposer",
        prefill: {
          title: "AI agents for export teams",
          sourceType: "notes",
          audience: "制造业出海负责人",
          goal: "拆成短视频脚本、社媒帖子和 newsletter 段落",
          sourceContent:
            "核心观点：不要把 AI 当聊天工具，而是把它嵌进询盘判断、邮件跟进、客户资产沉淀这条业务链里。",
          workflowSource: "来自 Creator Starter 的增长选题",
          workflowNextStep: "先产出 3 个平台版本，再挑 1 个版本送进 Publisher 做预演。",
        },
      },
      {
        type: "publisher",
        prefill: {
          title: "AI agents 不是玩具，而是外贸团队的业务操作系统",
          body: "今天先讲一个最实用的切口：把询盘判断、邮件跟进、CRM 收口连成一条业务链。",
          platforms: ["twitter", "linkedin"],
          dispatchMode: "dry-run",
          workflowSource: "来自 Creator Starter 的首轮发布候选稿",
          workflowNextStep: "先在 Publisher 里做预演，确认语气、CTA 和标签后再发。",
        },
      },
    ],
  },
  {
    id: "support-escalation-recovery",
    industryId: "support_success",
    bundleId: "support-ops",
    scenarioId: "support-ops",
    title: "客服升级与客户安抚",
    summary: "从客户投诉、回复草稿到 CRM 留档，适合售后、客服和用户成功团队。",
    triggerLabel: "收到高风险工单 / 差评 / 私信投诉",
    outcomeLabel: "输出回复思路、客户记录和后续跟进动作",
    assets: ["FAQ 片段", "投诉案例", "客户跟进记录"],
    apps: ["support_copilot", "personal_crm", "task_manager"],
    accent: "rose",
    triggerType: "inbound_message",
    actions: [
      {
        type: "support",
        prefill: {
          customer: "Maya Chen",
          channel: "instagram",
          subject: "包裹延误与安装说明不清晰",
          message: "客户反馈包裹延误了 5 天，安装说明不够清晰，已经在 Instagram 私信里表达不满，担心会公开投诉。",
          status: "new",
        },
      },
      {
        type: "crm",
        prefill: {
          name: "Maya Chen",
          company: "North Harbor Retail",
          role: "Support escalation",
          status: "active",
          nextStep: "24 小时内跟进处理结果，并同步补偿方案。",
          notes:
            "渠道：Instagram DM\n问题：包裹延误 + 安装说明不清晰\n客户情绪：焦虑且准备公开投诉\n建议：先致歉，再确认订单号和补偿选项。",
        },
      },
      { type: "open_app", appId: "task_manager" },
    ],
  },
  {
    id: "research-market-scan",
    industryId: "research_strategy",
    bundleId: "research-radar",
    scenarioId: "research-radar",
    roleId: "research",
    title: "竞争情报与市场扫描",
    summary: "围绕研究主题、关键发现和日常决策输入，适合策略、投研、品牌和产品团队。",
    triggerLabel: "每周市场扫描 / 新竞争对手出现",
    outcomeLabel: "输出研究问题框架、长期资料库和晨报决策输入",
    assets: ["观察维度", "资料框架", "决策摘要"],
    apps: ["deep_research_hub", "knowledge_vault", "morning_brief"],
    accent: "slate",
    triggerType: "schedule",
    actions: [
      {
        type: "research",
        prefill: {
          topic: "AI workflow operating system 市场格局",
          sources: "GitHub repos / official docs / product pages / founder interviews",
          angle: "入口结构、自动化深度、资产沉淀、企业交付能力",
          audience: "产品负责人 / founder / strategy lead",
          notes: "重点看谁真正把行业入口、角色入口和 workflow runtime 结合起来，而不是只做 app list。",
        },
      },
      {
        type: "knowledge_vault",
        prefill: {
          query:
            "请整理一份“AI workflow operating system” 竞品观察框架，重点关注入口结构、自动化深度、资产沉淀和企业交付能力。",
        },
      },
      {
        type: "morning_brief",
        prefill: {
          focus: "AI workflow operating system 市场扫描",
          notes: "关注竞品如何把 App、Role、Workflow、Asset 四层打通，并标出最值得借鉴的 3 个设计决策。",
        },
      },
    ],
  },
  {
    id: "recruiting-candidate-loop",
    industryId: "people_hiring",
    bundleId: "recruiting-pipeline-studio",
    scenarioId: "recruiting-pipeline",
    roleId: "people",
    title: "候选人评估与跟进闭环",
    summary: "从面试记录、评分卡到候选人 follow-up，适合 founder、招聘负责人和用人经理。",
    triggerLabel: "完成一轮面试 / 收到候选人资料",
    outcomeLabel: "输出评分卡、下一步动作和跟进邮件",
    assets: ["候选人评分卡", "面试观察", "招聘 follow-up 模板"],
    apps: ["recruiting_desk", "email_assistant", "task_manager"],
    accent: "emerald",
    triggerType: "manual",
    actions: [
      {
        type: "recruiting",
        prefill: {
          role: "Senior Ops Manager",
          candidate: "Lina Zhou",
          stage: "interview",
          profile: "8 年 SaaS / 电商交付运营经验，做过跨部门项目管理、流程优化和团队协同。",
          notes: "亮点：推进节奏清晰，owner 意识强。\n待验证：复杂冲突协调、预算与资源平衡、跨区域协作。",
        },
      },
      {
        type: "email",
        prefill: {
          subject: "关于 Senior Ops Manager 面试的后续安排",
          recipient: "Lina Zhou",
          goal: "同步下一轮面试安排和评估重点",
          tone: "warm",
          context:
            "岗位：Senior Ops Manager\n候选人亮点：有跨团队交付经验，项目推进清晰\n待验证点：复杂冲突协调、预算控制、owner 机制",
        },
      },
      { type: "open_app", appId: "task_manager" },
    ],
  },
  {
    id: "ops-weekly-risk-sync",
    industryId: "operations_delivery",
    bundleId: "project-delivery-desk",
    scenarioId: "project-delivery",
    roleId: "ops",
    title: "项目周报与风险收口",
    summary: "从晨间优先级、项目简报到会议纪要收口，适合项目经理、交付负责人和运营 lead。",
    triggerLabel: "周会前 / 项目有阻塞时",
    outcomeLabel: "输出项目 brief、任务动作和风险同步清单",
    assets: ["项目 brief", "风险清单", "执行动作项"],
    apps: ["morning_brief", "project_ops", "meeting_copilot", "task_manager"],
    accent: "amber",
    triggerType: "schedule",
    actions: [
      {
        type: "morning_brief",
        prefill: {
          focus: "Phoenix 项目周报与风险同步",
          notes: "重点确认 3 个风险：接口延迟、设计确认卡点、owner 不清晰；目标是今天内明确责任人和时间。",
        },
      },
      {
        type: "project_ops",
        prefill: {
          project: "Phoenix Delivery",
          owner: "Annie",
          health: "yellow",
          objective: "本周完成接口联调并明确上线前责任人清单",
          updates: "前端页面已完成 80%\n客户确认了第二版结构\n接口联调开始但仍有字段不稳定",
          blockers: "后端字段延迟\n设计最终稿未完全确认\n测试 owner 尚未明确",
        },
      },
      { type: "open_app", appId: "meeting_copilot" },
      { type: "open_app", appId: "task_manager" },
    ],
  },
];

export function runIndustrySolutionStarterActions(actions: SolutionStarterAction[]) {
  actions.forEach((action, index) => {
    window.setTimeout(() => {
      switch (action.type) {
        case "open_app":
          requestOpenApp(action.appId);
          return;
        case "deal_desk":
          requestOpenDealDesk(action.prefill);
          return;
        case "email":
          requestComposeEmail(action.prefill);
          return;
        case "crm":
          requestOpenCrm(action.prefill);
          return;
        case "morning_brief":
          requestOpenMorningBrief(action.prefill);
          return;
        case "knowledge_vault":
          requestOpenKnowledgeVault(action.prefill);
          return;
        case "support":
          requestOpenSupportCopilot(action.prefill);
          return;
        case "research":
          requestOpenResearchHub(action.prefill);
          return;
        case "project_ops":
          requestOpenProjectOps(action.prefill);
          return;
        case "recruiting":
          requestOpenRecruitingDesk(action.prefill);
          return;
        case "creator_radar":
          requestOpenCreatorRadar(action.prefill);
          return;
        case "content_repurposer":
          requestOpenContentRepurposer(action.prefill);
          return;
        case "publisher":
          requestOpenPublisher(action.prefill);
          return;
      }
    }, index * 120);
  });
}
