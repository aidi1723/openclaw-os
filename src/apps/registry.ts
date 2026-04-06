"use client";

import {
  Activity,
  Clapperboard,
  HardDrive,
  Shield,
  FileText,
  TerminalSquare,
  Settings,
  Share2,
  BriefcaseBusiness,
  Building2,
  Layers,
  Mic2,
  Newspaper,
  Rss,
  Users,
  Inbox,
  Headphones,
  Brain,
  Mail,
  Briefcase,
  CalendarDays,
  HeartPulse,
  Target,
  Compass,
  RefreshCw,
  UserSearch,
  KanbanSquare,
  SearchCheck,
  Globe2,
  Languages,
} from "lucide-react";
import type { AppManifest, AppId } from "@/apps/types";
import { RecruitingDeskAppWindow } from "@/components/apps/RecruitingDeskAppWindow";
import { ProjectOpsAppWindow } from "@/components/apps/ProjectOpsAppWindow";
import { DeepResearchHubAppWindow } from "@/components/apps/DeepResearchHubAppWindow";
import { FinancialDocumentBotAppWindow } from "@/components/apps/FinancialDocumentBotAppWindow";
import { SocialMediaAutopilotAppWindow } from "@/components/apps/SocialMediaAutopilotAppWindow";
import { WebsiteSeoStudioAppWindow } from "@/components/apps/WebsiteSeoStudioAppWindow";
import { CreativeStudioAppWindow } from "@/components/apps/CreativeStudioAppWindow";
import { AccountCenterAppWindow } from "@/components/apps/AccountCenterAppWindow";
import { MediaOpsAppWindow } from "@/components/apps/MediaOpsAppWindow";
import { KnowledgeVaultAppWindow } from "@/components/apps/KnowledgeVaultAppWindow";
import { OpenClawConsoleAppWindow } from "@/components/apps/OpenClawConsoleAppWindow";
import { SettingsAppWindow } from "@/components/apps/SettingsAppWindow";
import { TaskManagerAppWindow } from "@/components/apps/TaskManagerAppWindow";
import { PublisherAppWindow } from "@/components/apps/PublisherAppWindow";
import { SoloOpsAppWindow } from "@/components/apps/SoloOpsAppWindow";
import { SolutionsHubAppWindow } from "@/components/apps/SolutionsHubAppWindow";
import { MorningBriefAppWindow } from "@/components/apps/MorningBriefAppWindow";
import { MeetingCopilotAppWindow } from "@/components/apps/MeetingCopilotAppWindow";
import { PersonalCRMAppWindow } from "@/components/apps/PersonalCRMAppWindow";
import { InboxDeclutterAppWindow } from "@/components/apps/InboxDeclutterAppWindow";
import { SupportCopilotAppWindow } from "@/components/apps/SupportCopilotAppWindow";
import { SecondBrainAppWindow } from "@/components/apps/SecondBrainAppWindow";
import { EmailAssistantAppWindow } from "@/components/apps/EmailAssistantAppWindow";
import { DealDeskAppWindow } from "@/components/apps/DealDeskAppWindow";
import { FamilyCalendarAppWindow } from "@/components/apps/FamilyCalendarAppWindow";
import { HabitTrackerAppWindow } from "@/components/apps/HabitTrackerAppWindow";
import { HealthTrackerAppWindow } from "@/components/apps/HealthTrackerAppWindow";
import { CreatorRadarAppWindow } from "@/components/apps/CreatorRadarAppWindow";
import { ContentRepurposerAppWindow } from "@/components/apps/ContentRepurposerAppWindow";
import { TechNewsDigestAppWindow } from "@/components/apps/TechNewsDigestAppWindow";
import { IndustryHubAppWindow } from "@/components/apps/IndustryHubAppWindow";
import { LanguageLearningDeskAppWindow } from "@/components/apps/LanguageLearningDeskAppWindow";

const appList: AppManifest[] = [
  {
    id: "industry_hub",
    name: "Industry App Center",
    icon: Building2,
    window: IndustryHubAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "recruiting_desk",
    name: "Recruiting Desk",
    icon: UserSearch,
    window: RecruitingDeskAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "project_ops",
    name: "Project Ops Board",
    icon: KanbanSquare,
    window: ProjectOpsAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "deep_research_hub",
    name: "Deep Research Hub",
    icon: SearchCheck,
    window: DeepResearchHubAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "financial_document_bot",
    name: "Financial Document Bot",
    icon: FileText,
    window: FinancialDocumentBotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "social_media_autopilot",
    name: "Social Media Auto-pilot",
    icon: Share2,
    window: SocialMediaAutopilotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "website_seo_studio",
    name: "Website SEO Studio",
    icon: Globe2,
    window: WebsiteSeoStudioAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "language_learning_desk",
    name: "Language Learning Desk",
    icon: Languages,
    window: LanguageLearningDeskAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "tech_news_digest",
    name: "Tech News Digest",
    icon: Rss,
    window: TechNewsDigestAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "morning_brief",
    name: "Morning Brief",
    icon: Newspaper,
    window: MorningBriefAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "meeting_copilot",
    name: "Meeting Copilot",
    icon: Mic2,
    window: MeetingCopilotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "personal_crm",
    name: "Personal CRM",
    icon: Users,
    window: PersonalCRMAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "inbox_declutter",
    name: "Inbox De-clutter",
    icon: Inbox,
    window: InboxDeclutterAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "support_copilot",
    name: "Support Copilot",
    icon: Headphones,
    window: SupportCopilotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "second_brain",
    name: "Second Brain",
    icon: Brain,
    window: SecondBrainAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "email_assistant",
    name: "Email Assistant",
    icon: Mail,
    window: EmailAssistantAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "deal_desk",
    name: "Deal Desk",
    icon: Briefcase,
    window: DealDeskAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "family_calendar",
    name: "Family Calendar",
    icon: CalendarDays,
    window: FamilyCalendarAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "habit_tracker",
    name: "Habit Tracker",
    icon: Target,
    window: HabitTrackerAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "health_tracker",
    name: "Health Tracker",
    icon: HeartPulse,
    window: HealthTrackerAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "creator_radar",
    name: "Creator Radar",
    icon: Compass,
    window: CreatorRadarAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "content_repurposer",
    name: "Content Repurposer",
    icon: RefreshCw,
    window: ContentRepurposerAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "media_ops",
    name: "AI 文案",
    icon: FileText,
    window: MediaOpsAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "creative_studio",
    name: "AI 视觉工坊",
    icon: Clapperboard,
    window: CreativeStudioAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "knowledge_vault",
    name: "专属知识库",
    icon: HardDrive,
    window: KnowledgeVaultAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "account_center",
    name: "矩阵授权中心",
    icon: Shield,
    window: AccountCenterAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "task_manager",
    name: "任务调度中心",
    icon: Activity,
    window: TaskManagerAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "runtime_console",
    name: "运行时控制台",
    icon: TerminalSquare,
    window: OpenClawConsoleAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "publisher",
    name: "矩阵发布中心",
    icon: Share2,
    window: PublisherAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "solo_ops",
    name: "SoloOps 作战台",
    icon: BriefcaseBusiness,
    window: SoloOpsAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "solutions_hub",
    name: "方案库",
    icon: Layers,
    window: SolutionsHubAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "settings",
    name: "设置",
    icon: Settings,
    window: SettingsAppWindow,
    desktop: true,
    dock: true,
  },
];

export function getApp(appId: AppId) {
  const resolvedId = appId === "openclaw_console" ? "runtime_console" : appId;
  const app = appList.find((a) => a.id === resolvedId);
  if (!app) throw new Error(`Unknown app: ${appId}`);
  return app;
}

export function listApps() {
  return appList;
}
