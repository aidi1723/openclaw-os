import type { AppId, ModeId } from "@/apps/types";
import type { InterfaceLanguage } from "@/lib/settings";

export type AppCategory =
  | "insight"
  | "workflow"
  | "content"
  | "relationship"
  | "personal"
  | "system";

type CopySet = {
  zh: string;
  en: string;
  ja: string;
};

type CategoryCopy = {
  label: CopySet;
  description: CopySet;
  helper: CopySet;
};

const appNames: Record<AppId, CopySet> = {
  industry_hub: { zh: "行业应用中心", en: "Industry App Center", ja: "業界アプリセンター" },
  recruiting_desk: { zh: "招聘工作台", en: "Recruiting Desk", ja: "採用デスク" },
  project_ops: { zh: "项目运营台", en: "Project Ops Board", ja: "プロジェクト運営ボード" },
  deep_research_hub: { zh: "深度研究台", en: "Deep Research Hub", ja: "ディープリサーチハブ" },
  financial_document_bot: { zh: "财务文档助手", en: "Financial Document Bot", ja: "財務ドキュメントボット" },
  social_media_autopilot: { zh: "社媒自动驾驶台", en: "Social Media Auto-pilot", ja: "SNSオートパイロット" },
  website_seo_studio: { zh: "网站 SEO 工作室", en: "Website SEO Studio", ja: "WebサイトSEOスタジオ" },
  language_learning_desk: { zh: "语言学习台", en: "Language Learning Desk", ja: "語学学習デスク" },
  tech_news_digest: { zh: "科技情报摘要", en: "Tech News Digest", ja: "テックニュース要約" },
  morning_brief: { zh: "晨报", en: "Morning Brief", ja: "モーニングブリーフ" },
  meeting_copilot: { zh: "会议助手", en: "Meeting Copilot", ja: "会議コパイロット" },
  personal_crm: { zh: "个人 CRM", en: "Personal CRM", ja: "パーソナルCRM" },
  inbox_declutter: { zh: "收件箱清理", en: "Inbox Declutter", ja: "受信箱整理" },
  support_copilot: { zh: "客服助手", en: "Support Copilot", ja: "サポートコパイロット" },
  second_brain: { zh: "第二大脑", en: "Second Brain", ja: "セカンドブレイン" },
  email_assistant: { zh: "邮件助手", en: "Email Assistant", ja: "メールアシスタント" },
  deal_desk: { zh: "商机判断台", en: "Deal Desk", ja: "ディールデスク" },
  family_calendar: { zh: "家庭日历", en: "Family Calendar", ja: "ファミリーカレンダー" },
  habit_tracker: { zh: "习惯追踪", en: "Habit Tracker", ja: "習慣トラッカー" },
  health_tracker: { zh: "健康记录", en: "Health Tracker", ja: "ヘルストラッカー" },
  creator_radar: { zh: "创作者雷达", en: "Creator Radar", ja: "クリエイターレーダー" },
  content_repurposer: { zh: "内容重组器", en: "Content Repurposer", ja: "コンテンツ再利用" },
  media_ops: { zh: "AI 文案", en: "AI Copy Studio", ja: "AIライティング" },
  creative_studio: { zh: "AI 视觉工坊", en: "Creative Studio", ja: "クリエイティブスタジオ" },
  knowledge_vault: { zh: "知识库", en: "Knowledge Vault", ja: "ナレッジボールト" },
  account_center: { zh: "授权中心", en: "Account Center", ja: "アカウントセンター" },
  task_manager: { zh: "任务中心", en: "Task Manager", ja: "タスクマネージャー" },
  openclaw_console: { zh: "OpenClaw 控制台", en: "OpenClaw Console", ja: "OpenClawコンソール" },
  publisher: { zh: "发布中心", en: "Publisher", ja: "パブリッシャー" },
  solo_ops: { zh: "SoloOps 作战台", en: "SoloOps", ja: "SoloOps" },
  solutions_hub: { zh: "方案库", en: "Solutions Hub", ja: "ソリューションハブ" },
  settings: { zh: "设置", en: "Settings", ja: "設定" },
};

const modeNames: Record<ModeId, CopySet> = {
  default: { zh: "默认桌面", en: "Default", ja: "デフォルト" },
  creator: { zh: "创作模式", en: "Creator", ja: "クリエイター" },
  solo: { zh: "工作流模式", en: "Workflow", ja: "ワークフロー" },
};

const shellLabels = {
  search: { zh: "搜索", en: "Search", ja: "検索" },
  settings: { zh: "设置", en: "Settings", ja: "設定" },
  workspace: { zh: "工作台", en: "Workspace", ja: "ワークスペース" },
  switchMode: { zh: "切换桌面模式", en: "Switch Desktop Mode", ja: "デスクトップモード切替" },
  engine: { zh: "引擎", en: "Engine", ja: "エンジン" },
  current: { zh: "当前", en: "Current", ja: "現在" },
  interfaceLanguage: { zh: "界面语言", en: "Interface Language", ja: "表示言語" },
  customLanguage: { zh: "更多语言", en: "More languages", ja: "その他の言語" },
  customLanguageSet: { zh: "自定义", en: "Custom", ja: "カスタム" },
  openSettings: { zh: "打开设置", en: "Open settings", ja: "設定を開く" },
  windowManager: { zh: "窗口管理", en: "Windows", ja: "ウィンドウ" },
  runningWindows: { zh: "运行中的窗口", en: "Open Windows", ja: "開いているウィンドウ" },
  noWindows: { zh: "暂无窗口", en: "No windows", ja: "ウィンドウなし" },
  close: { zh: "关闭", en: "Close", ja: "閉じる" },
  restore: { zh: "还原", en: "Restore", ja: "復元" },
  minimize: { zh: "最小化", en: "Minimize", ja: "最小化" },
  shortcuts: { zh: "快捷键", en: "Shortcuts", ja: "ショートカット" },
  running: { zh: "运行中", en: "Running", ja: "実行中" },
  minimized: { zh: "已最小化", en: "Minimized", ja: "最小化済み" },
  closing: { zh: "关闭中", en: "Closing", ja: "終了中" },
  closed: { zh: "已关闭", en: "Closed", ja: "終了" },
} as const;

export const appCatalog: Array<{ id: AppId; category: AppCategory }> = [
  { id: "industry_hub", category: "workflow" },
  { id: "recruiting_desk", category: "relationship" },
  { id: "project_ops", category: "workflow" },
  { id: "deep_research_hub", category: "insight" },
  { id: "financial_document_bot", category: "workflow" },
  { id: "social_media_autopilot", category: "content" },
  { id: "website_seo_studio", category: "content" },
  { id: "language_learning_desk", category: "personal" },
  { id: "tech_news_digest", category: "insight" },
  { id: "creator_radar", category: "insight" },
  { id: "knowledge_vault", category: "insight" },
  { id: "morning_brief", category: "workflow" },
  { id: "meeting_copilot", category: "workflow" },
  { id: "task_manager", category: "workflow" },
  { id: "solo_ops", category: "workflow" },
  { id: "solutions_hub", category: "workflow" },
  { id: "content_repurposer", category: "content" },
  { id: "media_ops", category: "content" },
  { id: "creative_studio", category: "content" },
  { id: "publisher", category: "content" },
  { id: "deal_desk", category: "relationship" },
  { id: "personal_crm", category: "relationship" },
  { id: "email_assistant", category: "relationship" },
  { id: "inbox_declutter", category: "relationship" },
  { id: "support_copilot", category: "relationship" },
  { id: "family_calendar", category: "personal" },
  { id: "habit_tracker", category: "personal" },
  { id: "health_tracker", category: "personal" },
  { id: "second_brain", category: "personal" },
  { id: "account_center", category: "system" },
  { id: "openclaw_console", category: "system" },
  { id: "settings", category: "system" },
];

const categoryOrder: AppCategory[] = [
  "workflow",
  "insight",
  "content",
  "relationship",
  "personal",
  "system",
];

const categoryCopyMap: Record<AppCategory, CategoryCopy> = {
  insight: {
    label: { zh: "信息与洞察", en: "Insight", ja: "インサイト" },
    description: {
      zh: "聚合研究、情报扫描和知识沉淀，适合需要持续查看的新信息入口。",
      en: "Research, signal scanning, and knowledge capture for staying on top of new information.",
      ja: "調査、シグナル監視、知識蓄積をまとめた継続閲覧向けカテゴリです。",
    },
    helper: {
      zh: "建议优先放在桌面主区，方便持续追踪。",
      en: "Best placed on the desktop for continuous monitoring.",
      ja: "継続確認しやすいよう、デスクトップ常駐向きです。",
    },
  },
  workflow: {
    label: { zh: "流程与执行", en: "Workflow", ja: "ワークフロー" },
    description: {
      zh: "覆盖任务推进、会议协同和运营执行，是最适合日常高频打开的工作区。",
      en: "Task execution, meeting coordination, and day-to-day operations.",
      ja: "タスク推進、会議連携、日常運用を担う高頻度ワークスペースです。",
    },
    helper: {
      zh: "推荐同时放入 Desktop 和 Dock，便于快速切换。",
      en: "Usually worth pinning to both the desktop and the dock.",
      ja: "Desktop と Dock の両方に置くと切り替えやすくなります。",
    },
  },
  content: {
    label: { zh: "内容与发布", en: "Content", ja: "コンテンツ" },
    description: {
      zh: "负责写作、视觉制作、内容改写和分发，适合围绕产出链路集中排布。",
      en: "Writing, creative production, repurposing, and publishing in one lane.",
      ja: "執筆、制作、再利用、配信をまとめたアウトプット向けカテゴリです。",
    },
    helper: {
      zh: "建议按创作流程摆放，减少来回跳转。",
      en: "Arrange these in creation order to reduce context switching.",
      ja: "制作フロー順に並べると往復が減ります。",
    },
  },
  relationship: {
    label: { zh: "客户与沟通", en: "Relationship", ja: "コミュニケーション" },
    description: {
      zh: "面向客户、线索、邮件和服务沟通，适合与执行类应用搭配使用。",
      en: "Customer, lead, email, and support tools that pair well with execution apps.",
      ja: "顧客、リード、メール、サポート連携向けのコミュニケーションカテゴリです。",
    },
    helper: {
      zh: "Dock 保留高频入口，桌面保留需要持续处理的应用即可。",
      en: "Keep high-frequency entry points in the dock and only persistent work on the desktop.",
      ja: "高頻度入口は Dock、継続処理が必要なものだけ Desktop に残すのが適切です。",
    },
  },
  personal: {
    label: { zh: "个人与家庭", en: "Personal", ja: "パーソナル" },
    description: {
      zh: "涵盖学习、习惯、健康和家庭安排，适合做轻量常驻区。",
      en: "Learning, habits, health, and family routines in a lighter personal zone.",
      ja: "学習、習慣、健康、家族予定を扱う軽量常駐カテゴリです。",
    },
    helper: {
      zh: "桌面保留 1-2 个真正常用入口即可。",
      en: "Usually one or two always-visible apps are enough here.",
      ja: "常駐は 1〜2 個に絞ると見通しが保てます。",
    },
  },
  system: {
    label: { zh: "系统与设置", en: "System", ja: "システム" },
    description: {
      zh: "包含账号、授权、控制台和系统设置，主要承担管理入口职责。",
      en: "Account, authorization, console, and settings entry points.",
      ja: "アカウント、認証、コンソール、設定など管理入口をまとめます。",
    },
    helper: {
      zh: "通常保留在 Dock 即可，避免占用主桌面。",
      en: "These usually belong in the dock instead of the main desktop.",
      ja: "通常はメインデスクトップより Dock 配置が向いています。",
    },
  },
};

const appCategoryMap = new Map(appCatalog.map((item) => [item.id, item.category]));

export function getDisplayLanguage(language: InterfaceLanguage) {
  if (language === "zh-CN") return "zh";
  if (language === "ja-JP") return "ja";
  return "en";
}

export function getAppDisplayName(
  appId: AppId,
  fallback: string,
  language: InterfaceLanguage,
) {
  const copy = appNames[appId];
  if (!copy) return fallback;
  const displayLanguage = getDisplayLanguage(language);
  return copy[displayLanguage];
}

export function getModeDisplayName(
  modeId: ModeId,
  fallback: string,
  language: InterfaceLanguage,
) {
  const copy = modeNames[modeId];
  if (!copy) return fallback;
  const displayLanguage = getDisplayLanguage(language);
  return copy[displayLanguage];
}

export function getShellLabel(
  key: keyof typeof shellLabels,
  language: InterfaceLanguage,
) {
  const copy = shellLabels[key];
  const displayLanguage = getDisplayLanguage(language);
  return copy[displayLanguage];
}

export function getCategoryLabel(
  category: AppCategory,
  language: InterfaceLanguage = "zh-CN",
) {
  const displayLanguage = getDisplayLanguage(language);
  return categoryCopyMap[category].label[displayLanguage];
}

export function getAppCategory(appId: AppId): AppCategory {
  return appCategoryMap.get(appId) ?? "workflow";
}

export function getCategoryMeta(
  category: AppCategory,
  language: InterfaceLanguage = "zh-CN",
) {
  const displayLanguage = getDisplayLanguage(language);
  const copy = categoryCopyMap[category];
  return {
    id: category,
    label: copy.label[displayLanguage],
    description: copy.description[displayLanguage],
    helper: copy.helper[displayLanguage],
  };
}

export function listCategoryMetas(language: InterfaceLanguage = "zh-CN") {
  return categoryOrder.map((category) => getCategoryMeta(category, language));
}

export function resolveLanguageLocale(language: InterfaceLanguage) {
  if (language === "zh-CN") return "zh-CN";
  if (language === "ja-JP") return "ja-JP";
  return "en-US";
}
