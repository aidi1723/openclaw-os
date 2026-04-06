import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type AppId =
  | "industry_hub"
  | "recruiting_desk"
  | "project_ops"
  | "deep_research_hub"
  | "financial_document_bot"
  | "social_media_autopilot"
  | "website_seo_studio"
  | "language_learning_desk"
  | "tech_news_digest"
  | "morning_brief"
  | "meeting_copilot"
  | "personal_crm"
  | "inbox_declutter"
  | "support_copilot"
  | "second_brain"
  | "email_assistant"
  | "deal_desk"
  | "family_calendar"
  | "habit_tracker"
  | "health_tracker"
  | "creator_radar"
  | "content_repurposer"
  | "media_ops"
  | "creative_studio"
  | "knowledge_vault"
  | "account_center"
  | "task_manager"
  | "runtime_console"
  | "openclaw_console"
  | "publisher"
  | "solo_ops"
  | "solutions_hub"
  | "settings";

export type AppWindowState = "opening" | "open" | "minimized" | "closing";
export type AppState = AppWindowState | "closed";

export type AppWindowProps = {
  state: AppWindowState;
  zIndex: number;
  active?: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

export type AppManifest = {
  id: AppId;
  name: string;
  icon: LucideIcon;
  window: ComponentType<AppWindowProps>;
  desktop: boolean;
  dock: boolean;
};

export type ModeId = "default" | "creator" | "solo";

export type ModeManifest = {
  id: ModeId;
  name: string;
  desktopApps: AppId[];
  dockApps: AppId[];
};
