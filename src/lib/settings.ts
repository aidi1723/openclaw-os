import type { AppId } from "@/apps/types";
import type { AgentProfileId } from "@/lib/agent-profiles";
import { dispatchRuntimeEvent, RuntimeEventNames } from "@/lib/runtime-events";
import type { WorkspaceIndustryId } from "@/lib/workspace-presets";
import { getJsonFromStorage, setJsonToStorage } from "@/lib/storage";

declare global {
  interface Window {
    __AGENTCORE_API_BASE_URL__?: string;
    __AGENTCORE_BOOTSTRAP_SETTINGS__?: Partial<AppSettings> | null;
    __AGENTCORE_DESKTOP_SHELL__?: boolean;
  }
}

export type LlmProviderId = "kimi" | "deepseek" | "openai" | "anthropic" | "qwen";

export type LlmProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type LlmRoutingStrategy =
  | "manual"
  | "balanced"
  | "quality_first"
  | "speed_first";

export type LlmRoutingSettings = {
  strategy: LlmRoutingStrategy;
  fallbackProviderOrder: LlmProviderId[];
  allowOpenClawFallback: boolean;
  maxAttempts: number;
  retryBackoffMs: number;
};

export type LlmLibrarySettings = {
  activeProvider: LlmProviderId;
  providers: Record<LlmProviderId, LlmProviderConfig>;
  routing: LlmRoutingSettings;
};

export type AssistantSettings = {
  systemPrompt: string;
  expertProfiles: Record<AgentProfileId, { enabled: boolean }>;
  skillRuntime: {
    mode: "off" | "auto" | "strict";
    memoryV2Enabled: boolean;
    maxInstincts: number;
    autoKnowledgeCapture: boolean;
  };
};

export type OpenClawEngineSettings = {
  baseUrl: string;
  apiToken: string;
};

export type DesktopRuntimeProfile = "desktop_light" | "desktop_dify";
export type DesktopRuntimeOrchestration = "none" | "docker_compose";
export type DesktopRuntimeShell = "browser" | "tauri";

export type DesktopRuntimeSettings = {
  shell: DesktopRuntimeShell;
  llmStrategy: "api_only";
  profile: DesktopRuntimeProfile;
  orchestration: DesktopRuntimeOrchestration;
  composeProjectName: string;
  localAppUrl: string;
  localRuntimeUrl: string;
  sidecarApiUrl: string;
  difyBaseUrl: string;
  autoBootLocalStack: boolean;
  detectDockerOnLaunch: boolean;
};

export type MatrixAccountsSettings = {
  xiaohongshu: { token: string; webhookUrl: string };
  douyin: { token: string; webhookUrl: string };
  wechat: { token: string; webhookUrl: string };
  instagram: { token: string; webhookUrl: string };
  tiktok: { token: string; webhookUrl: string };
  twitter: { token: string; webhookUrl: string };
  linkedin: { token: string; webhookUrl: string };
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
  runtime: DesktopRuntimeSettings;
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
      anthropic: {
        apiKey: "",
        baseUrl: "https://api.anthropic.com",
        model: "claude-3-5-sonnet-latest",
      },
      qwen: {
        apiKey: "",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
      },
    },
    routing: {
      strategy: "manual",
      fallbackProviderOrder: [],
      allowOpenClawFallback: false,
      maxAttempts: 2,
      retryBackoffMs: 350,
    },
  },
  assistant: {
    systemPrompt: "",
    expertProfiles: {
      sales_qualification_specialist: { enabled: true },
      outreach_draft_specialist: { enabled: true },
      support_reply_specialist: { enabled: true },
      reality_checker: { enabled: true },
      knowledge_asset_editor: { enabled: true },
    },
    skillRuntime: {
      mode: "auto",
      memoryV2Enabled: true,
      maxInstincts: 2,
      autoKnowledgeCapture: true,
    },
  },
  openclaw: {
    // Leave empty by default: local-first. Creative Studio can fallback to local video-frames (ffmpeg).
    baseUrl: "",
    apiToken: "",
  },
  runtime: {
    shell: "browser",
    llmStrategy: "api_only",
    profile: "desktop_light",
    orchestration: "none",
    composeProjectName: "agentcore-runtime",
    localAppUrl: "http://127.0.0.1:3000",
    localRuntimeUrl: "http://127.0.0.1:18789",
    sidecarApiUrl: "http://127.0.0.1:8080",
    difyBaseUrl: "http://127.0.0.1:5001",
    autoBootLocalStack: false,
    detectDockerOnLaunch: true,
  },
  matrixAccounts: {
    xiaohongshu: { token: "", webhookUrl: "" },
    douyin: { token: "", webhookUrl: "" },
    wechat: { token: "", webhookUrl: "" },
    instagram: { token: "", webhookUrl: "" },
    tiktok: { token: "", webhookUrl: "" },
    twitter: { token: "", webhookUrl: "" },
    linkedin: { token: "", webhookUrl: "" },
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
const MATRIX_ACCOUNT_IDS = [
  "xiaohongshu",
  "douyin",
  "wechat",
  "instagram",
  "tiktok",
  "twitter",
  "linkedin",
  "storefront",
] as const;
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
  "runtime_console",
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
    const appId = (value === "openclaw_console" ? "runtime_console" : value) as AppId;
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

type LegacySettings = Partial<AppSettings> & {
  kimi?: { apiKey?: string; baseUrl?: string; model?: string };
};

function mergeSettings(saved: Partial<AppSettings> | null | undefined): AppSettings {
  const savedLegacy = (saved ?? {}) as LegacySettings;
  const legacyKimi = savedLegacy.kimi;
  const llmFromSaved = savedLegacy.llm as Partial<LlmLibrarySettings> | undefined;

  const llmMerged: LlmLibrarySettings = {
    ...defaultSettings.llm,
    ...(llmFromSaved ?? {}),
    providers: {
      ...defaultSettings.llm.providers,
      ...(llmFromSaved?.providers ?? {}),
    },
    routing: {
      ...defaultSettings.llm.routing,
      ...(llmFromSaved?.routing ?? {}),
      fallbackProviderOrder: Array.isArray(llmFromSaved?.routing?.fallbackProviderOrder)
        ? (llmFromSaved?.routing?.fallbackProviderOrder.filter(
            (item): item is LlmProviderId =>
              typeof item === "string" && item in defaultSettings.llm.providers,
          ) as LlmProviderId[])
        : defaultSettings.llm.routing.fallbackProviderOrder,
    },
  };

  llmMerged.activeProvider = "kimi";
  llmMerged.routing = {
    ...llmMerged.routing,
    strategy: "manual",
    fallbackProviderOrder: [],
    allowOpenClawFallback: false,
  };

  // Back-compat: if old `kimi` exists, merge it into llm.providers.kimi
  if (legacyKimi && (!llmFromSaved || !llmFromSaved.providers?.kimi)) {
    llmMerged.providers.kimi = {
      ...llmMerged.providers.kimi,
      apiKey: typeof legacyKimi.apiKey === "string" ? legacyKimi.apiKey : llmMerged.providers.kimi.apiKey,
      baseUrl: typeof legacyKimi.baseUrl === "string" ? legacyKimi.baseUrl : llmMerged.providers.kimi.baseUrl,
      model: typeof legacyKimi.model === "string" ? legacyKimi.model : llmMerged.providers.kimi.model,
    };
  }

  return {
    ...defaultSettings,
    ...(saved ?? {}),
    llm: llmMerged,
    assistant: {
      ...defaultSettings.assistant,
      ...(saved?.assistant ?? {}),
      expertProfiles: {
        ...defaultSettings.assistant.expertProfiles,
        ...(saved?.assistant?.expertProfiles ?? {}),
      },
      skillRuntime: {
        ...defaultSettings.assistant.skillRuntime,
        ...(saved?.assistant?.skillRuntime ?? {}),
      },
    },
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
    runtime: { ...defaultSettings.runtime, ...(saved?.runtime ?? {}) },
    matrixAccounts: normalizeMatrixAccountsSettings(saved?.matrixAccounts),
    personalization: {
      ...defaultSettings.personalization,
      ...(saved?.personalization ?? {}),
      customDesktopApps: sanitizeAppIds(saved?.personalization?.customDesktopApps),
      customDockApps: sanitizeAppIds(saved?.personalization?.customDockApps),
    },
  };
}

function isDesktopShell() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__AGENTCORE_DESKTOP_SHELL__);
}

function getDesktopApiBaseUrl() {
  if (typeof window === "undefined") return "";
  return String(window.__AGENTCORE_API_BASE_URL__ || "").trim().replace(/\/+$/, "");
}

function getBootstrapSettings() {
  if (typeof window === "undefined") return null;
  const value = window.__AGENTCORE_BOOTSTRAP_SETTINGS__;
  return value && typeof value === "object" ? value : null;
}

function buildDesktopSettingsPayload(next: AppSettings) {
  return {
    ...next,
    matrixAccounts: defaultSettings.matrixAccounts,
  };
}

export function loadSettings(): AppSettings {
  const bootstrap = getBootstrapSettings();
  if (bootstrap) {
    return mergeSettings(bootstrap);
  }
  const saved = getJsonFromStorage<Partial<AppSettings>>(
    SETTINGS_KEY,
    defaultSettings,
  );
  return mergeSettings(saved);
}

export function hasSavedSettings() {
  if (getBootstrapSettings()) return true;
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(SETTINGS_KEY));
  } catch {
    return false;
  }
}

export function saveSettings(next: AppSettings) {
  const payload = buildDesktopSettingsPayload(next);
  setJsonToStorage(SETTINGS_KEY, payload);
  if (typeof window !== "undefined") {
    window.__AGENTCORE_BOOTSTRAP_SETTINGS__ = payload;
    if (isDesktopShell()) {
      const apiBase = getDesktopApiBaseUrl();
      if (apiBase) {
        void fetch(`${apiBase}/api/desktop/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null);
      }
    }
    dispatchRuntimeEvent(RuntimeEventNames.settings);
  }
}

export async function hydrateSettingsFromDesktopBridge() {
  if (!isDesktopShell()) return null;

  const apiBase = getDesktopApiBaseUrl();
  if (!apiBase) return null;

  try {
    const response = await fetch(`${apiBase}/api/desktop/settings`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | null
      | { ok?: boolean; data?: { settings?: Partial<AppSettings> | null } };
    const settings = data?.data?.settings;
    if (!response.ok || !data?.ok || !settings || typeof settings !== "object") {
      return null;
    }

    const merged = mergeSettings(settings);
    const payload = buildDesktopSettingsPayload(merged);
    window.__AGENTCORE_BOOTSTRAP_SETTINGS__ = payload;
    setJsonToStorage(SETTINGS_KEY, payload);
    dispatchRuntimeEvent(RuntimeEventNames.settings);
    return merged;
  } catch {
    return null;
  }
}

export function getActiveLlmConfig(settings: AppSettings) {
  const id: LlmProviderId = "kimi";
  return { id, config: settings.llm.providers[id] };
}

export function getExecutionLlmPlan(settings: AppSettings) {
  const active: LlmProviderId = "kimi";

  return {
    primary: {
      id: active,
      config: settings.llm.providers[active],
    },
    fallbacks: [],
    routing: {
      ...settings.llm.routing,
      strategy: "manual",
      fallbackProviderOrder: [],
      allowOpenClawFallback: false,
    },
  };
}
