import type { AppId } from "@/apps/types";
import type { PlaybookAction } from "@/lib/playbooks";

export type SourceUseCaseCoverage = "ready" | "partial";

export type SourceUseCaseApp = {
  id: string;
  name: string;
  desc: string;
  coverage: SourceUseCaseCoverage;
  mappedApps: AppId[];
  workflowActions: PlaybookAction[];
};

export type SourceUseCaseIndustry = {
  industry: string;
  apps: SourceUseCaseApp[];
};

export const sourceUseCaseIndustries: SourceUseCaseIndustry[] = [
  {
    industry: "Content & Media",
    apps: [
      {
        id: "yt-pipeline",
        name: "YouTube Content Factory",
        desc: "自动选题、大纲生成、脚本撰写及数据追踪",
        coverage: "ready",
        mappedApps: ["creator_radar", "content_repurposer", "publisher", "tech_news_digest"],
        workflowActions: [
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
        ],
      },
      {
        id: "social-manager",
        name: "Social Media Auto-pilot",
        desc: "多平台推文自动改写、定时发布与评论回复",
        coverage: "ready",
        mappedApps: ["social_media_autopilot", "publisher", "support_copilot", "task_manager"],
        workflowActions: [
          { type: "open_app", appId: "social_media_autopilot", label: "打开 Social Media Auto-pilot" },
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
        ],
      },
      {
        id: "podcast-transcribe",
        name: "Podcast Studio",
        desc: "音视频自动转录、摘要提取及关键点笔记",
        coverage: "ready",
        mappedApps: ["meeting_copilot", "content_repurposer", "knowledge_vault"],
        workflowActions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
    ],
  },
  {
    industry: "Business Operations",
    apps: [
      {
        id: "crm-agent",
        name: "AI CRM Assistant",
        desc: "自动分析邮件意图、提取联系人、更新 Lead 状态",
        coverage: "ready",
        mappedApps: ["personal_crm", "email_assistant", "deal_desk"],
        workflowActions: [
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        id: "meeting-sync",
        name: "Meeting Companion",
        desc: "会议纪要实时转任务（Jira/Notion 同步）",
        coverage: "ready",
        mappedApps: ["meeting_copilot", "task_manager", "knowledge_vault"],
        workflowActions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        id: "invoice-parser",
        name: "Financial Document Bot",
        desc: "PDF 账单/发票自动识别与数据入库",
        coverage: "ready",
        mappedApps: ["financial_document_bot", "knowledge_vault", "task_manager"],
        workflowActions: [
          { type: "open_app", appId: "financial_document_bot", label: "打开 Financial Document Bot" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
  },
  {
    industry: "IT & DevOps",
    apps: [
      {
        id: "self-healing-server",
        name: "Self-Healing Server",
        desc: "SSH 监控、自动日志诊断、故障自我修复",
        coverage: "partial",
        mappedApps: ["runtime_console", "task_manager", "morning_brief"],
        workflowActions: [
          { type: "open_app", appId: "runtime_console", label: "打开 运行时控制台" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
      {
        id: "pr-reviewer",
        name: "Git Co-pilot",
        desc: "自动 Pull Request 审查、代码风格纠错与建议",
        coverage: "partial",
        mappedApps: ["runtime_console", "knowledge_vault", "task_manager"],
        workflowActions: [
          { type: "open_app", appId: "runtime_console", label: "打开 运行时控制台" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        id: "cloud-optimizer",
        name: "Cost Watcher",
        desc: "云服务账单分析与闲置资源清理建议",
        coverage: "partial",
        mappedApps: ["runtime_console", "morning_brief", "task_manager"],
        workflowActions: [
          { type: "open_app", appId: "runtime_console", label: "打开 运行时控制台" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
  },
  {
    industry: "Personal Productivity",
    apps: [
      {
        id: "research-assistant",
        name: "Deep Research Hub",
        desc: "联网搜寻多维度信息、生成对比报告",
        coverage: "ready",
        mappedApps: ["deep_research_hub", "tech_news_digest", "second_brain", "knowledge_vault", "morning_brief"],
        workflowActions: [
          { type: "open_app", appId: "deep_research_hub", label: "打开 Deep Research Hub" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        id: "personal-tutor",
        name: "Language Learning Desk",
        desc: "实时翻译窗口与口语练习反馈",
        coverage: "ready",
        mappedApps: ["language_learning_desk", "knowledge_vault", "task_manager"],
        workflowActions: [
          { type: "open_app", appId: "language_learning_desk", label: "打开 Language Learning Desk" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
  },
  {
    industry: "Website & SEO",
    apps: [
      {
        id: "website-seo-studio",
        name: "Website SEO Studio",
        desc: "网站结构规划、页面文案框架、Meta 优化与 SEO 承接页设计",
        coverage: "ready",
        mappedApps: ["website_seo_studio", "knowledge_vault", "task_manager", "media_ops"],
        workflowActions: [
          { type: "open_app", appId: "website_seo_studio", label: "打开 Website SEO Studio" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
  },
];
