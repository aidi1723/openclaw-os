import type { AppId } from "@/apps/types";
import type { WorkspaceIndustryId } from "@/lib/workspace-presets";
import { getJsonFromStorage, setJsonToStorage } from "@/lib/storage";

export type LlmProviderId = "kimi" | "deepseek" | "openai" | "qwen";

export type LlmProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type LlmLibrarySettings = {
  activeProvider: LlmProviderId;
  providers: Record<LlmProviderId, LlmProviderConfig>;
};

export type AssistantSettings = {
  systemPrompt: string;
};

export type OpenClawEngineSettings = {
  baseUrl: string;
  apiToken: string;
};

export type MatrixAccountsSettings = {
  xiaohongshu: { token: string; webhookUrl: string };
  douyin: { token: string; webhookUrl: string };
  instagram: { token: string; webhookUrl: string };
  tiktok: { token: string; webhookUrl: string };
  storefront: { token: string; webhookUrl: string };
};

export type InterfaceLanguage = "zh-CN" | "en-US" | "ja-JP" | "custom";

export type PersonalizationSettings = {
  desktopBackground: "aurora" | "ocean" | "sunset";
  interfaceLanguage: InterfaceLanguage;
  customLanguageLabel: string;
  activeIndustry: WorkspaceIndustryId;
  activeScenarioId: string;
  useCustomWorkspace: boolean;
  customDesktopApps: AppId[];
  customDockApps: AppId[];
};

export type AppSettings = {
  llm: LlmLibrarySettings;
  assistant: AssistantSettings;
  openclaw: OpenClawEngineSettings;
  matrixAccounts: MatrixAccountsSettings;
  personalization: PersonalizationSettings;
};

export const defaultSettings: AppSettings = {
  llm: {
    activeProvider: "kimi",
    providers: {
      kimi: {
        apiKey: "",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k",
      },
      deepseek: {
        apiKey: "",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
      },
      openai: {
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      qwen: {
        apiKey: "",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
      },
    },
  },
  assistant: {
    systemPrompt: "",
  },
  openclaw: {
    // Leave empty by default: local-first. Creative Studio can fallback to local video-frames (ffmpeg).
    baseUrl: "",
    apiToken: "",
  },
  matrixAccounts: {
    xiaohongshu: { token: "", webhookUrl: "" },
    douyin: { token: "", webhookUrl: "" },
    instagram: { token: "", webhookUrl: "" },
    tiktok: { token: "", webhookUrl: "" },
    storefront: { token: "", webhookUrl: "" },
  },
  personalization: {
    desktopBackground: "aurora",
    interfaceLanguage: "zh-CN",
    customLanguageLabel: "",
    activeIndustry: "creator",
    activeScenarioId: "creator-studio",
    useCustomWorkspace: false,
    customDesktopApps: [],
    customDockApps: [],
  },
};

const SETTINGS_KEY = "openclaw.settings.v1";
const MATRIX_ACCOUNT_IDS = ["xiaohongshu", "douyin", "instagram", "tiktok", "storefront"] as const;
const VALID_APP_IDS = new Set<AppId>([
  "tech_news_digest",
  "industry_hub",
  "recruiting_desk",
  "project_ops",
  "deep_research_hub",
  "financial_document_bot",
  "social_media_autopilot",
  "website_seo_studio",
  "language_learning_desk",
  "morning_brief",
  "meeting_copilot",
  "personal_crm",
  "inbox_declutter",
  "support_copilot",
  "second_brain",
  "email_assistant",
  "deal_desk",
  "family_calendar",
  "habit_tracker",
  "health_tracker",
  "creator_radar",
  "content_repurposer",
  "media_ops",
  "creative_studio",
  "knowledge_vault",
  "account_center",
  "task_manager",
  "openclaw_console",
  "publisher",
  "solo_ops",
  "solutions_hub",
  "settings",
]);

function sanitizeAppIds(input: unknown) {
  if (!Array.isArray(input)) return [] as AppId[];
  const seen = new Set<AppId>();
  const result: AppId[] = [];
  for (const value of input) {
    if (typeof value !== "string") continue;
    const appId = value as AppId;
    if (!VALID_APP_IDS.has(appId) || seen.has(appId)) continue;
    seen.add(appId);
    result.push(appId);
  }
  return result;
}

export function normalizeMatrixAccountsSettings(
  saved: Partial<MatrixAccountsSettings> | null | undefined,
): MatrixAccountsSettings {
  const defaults = defaultSettings.matrixAccounts;
  const source = saved ?? {};
  const result = { ...defaults } as MatrixAccountsSettings;

  for (const id of MATRIX_ACCOUNT_IDS) {
    const item = (source as Record<string, unknown>)[id] as
      | undefined
      | { token?: unknown; webhookUrl?: unknown };
    result[id] = {
      token: typeof item?.token === "string" ? item.token : defaults[id].token,
      webhookUrl:
        typeof item?.webhookUrl === "string" ? item.webhookUrl : defaults[id].webhookUrl,
    };
  }

  return result;
}

function mergeSettings(saved: Partial<AppSettings> | null | undefined): AppSettings {
  const savedAny = saved as any;
  const legacyKimi = savedAny?.kimi as
    | undefined
    | { apiKey?: string; baseUrl?: string; model?: string };
  const llmFromSaved = (saved as any)?.llm as Partial<LlmLibrarySettings> | undefined;

  const llmMerged: LlmLibrarySettings = {
    ...defaultSettings.llm,
    ...(llmFromSaved ?? {}),
    providers: {
      ...defaultSettings.llm.providers,
      ...(llmFromSaved?.providers ?? {}),
    },
  };

  // Back-compat: if old `kimi` exists, merge it into llm.providers.kimi
  if (legacyKimi && (!llmFromSaved || !llmFromSaved.providers?.kimi)) {
    llmMerged.providers.kimi = {
      ...llmMerged.providers.kimi,
      ...(legacyKimi as any),
    };
  }

  return {
    ...defaultSettings,
    ...(saved ?? {}),
    llm: llmMerged,
    assistant: { ...defaultSettings.assistant, ...(saved?.assistant ?? {}) },
    openclaw: (() => {
      const merged = { ...defaultSettings.openclaw, ...(saved?.openclaw ?? {}) };
      const legacyDefaults = new Set([
        "http://localhost:7777",
        "http://127.0.0.1:7777",
        "localhost:7777",
        "127.0.0.1:7777",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "127.0.0.1:8000",
        "localhost:8000",
      ]);
      if (legacyDefaults.has((merged.baseUrl ?? "").trim())) {
        return { ...merged, baseUrl: defaultSettings.openclaw.baseUrl };
      }
      return merged;
    })(),
    matrixAccounts: normalizeMatrixAccountsSettings(saved?.matrixAccounts),
    personalization: {
      ...defaultSettings.personalization,
      ...(saved?.personalization ?? {}),
      customDesktopApps: sanitizeAppIds(saved?.personalization?.customDesktopApps),
      customDockApps: sanitizeAppIds(saved?.personalization?.customDockApps),
    },
  };
}

export function loadSettings(): AppSettings {
  const saved = getJsonFromStorage<Partial<AppSettings>>(
    SETTINGS_KEY,
    defaultSettings,
  );
  return mergeSettings(saved);
}

export function hasSavedSettings() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(SETTINGS_KEY));
  } catch {
    return false;
  }
}

export function saveSettings(next: AppSettings) {
  setJsonToStorage(SETTINGS_KEY, {
    ...next,
    // Publish credentials move to the server-backed store and should not be
    // re-persisted into browser localStorage.
    matrixAccounts: defaultSettings.matrixAccounts,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:settings"));
  }
}

export function getActiveLlmConfig(settings: AppSettings) {
  const id = settings.llm.activeProvider;
  return { id, config: settings.llm.providers[id] };
}
