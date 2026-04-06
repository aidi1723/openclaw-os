"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  KeyRound,
  Palette,
  RefreshCw,
  Settings as SettingsIcon,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import type { AppId, AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useRuntimeDoctorReport } from "@/hooks/useRuntimeDoctorReport";
import { useImBridge } from "@/hooks/useImBridge";
import { useServerBackedSyncStatuses } from "@/hooks/useServerBackedSyncStatuses";
import { useRuntimeSidecar } from "@/hooks/useRuntimeSidecar";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  getPublishConfig,
  refreshPublishConfig,
  savePublishConfig,
  subscribePublishConfig,
} from "@/lib/publish-config";
import {
  type AppCategory,
  appCatalog,
  getAppDisplayName,
  getCategoryMeta,
  listCategoryMetas,
} from "@/lib/app-display";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { listAgentProfiles } from "@/lib/agent-profiles";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import {
  getDesktopRuntimeStatusSummary,
  getRuntimeBridgeConfig,
} from "@/lib/desktop-runtime";
import { getAssistantPromptHint } from "@/lib/language";
import type { AppSettings } from "@/lib/settings";
import {
  defaultSettings,
  getActiveLlmConfig,
  hydrateSettingsFromDesktopBridge,
  loadSettings,
  saveSettings,
  type LlmProviderId,
} from "@/lib/settings";
import type { ImBridgeProviderId } from "@/lib/im-bridge";
import type { SettingsTargetTab } from "@/lib/ui-events";
import {
  getWorkspaceScenario,
  listWorkspaceScenarios,
  workspaceIndustries,
} from "@/lib/workspace-presets";

type TabId = "llm" | "engine" | "remote" | "matrix" | "personalization";

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "llm", label: "大模型与助手", icon: <Bot className="h-4 w-4" /> },
  { id: "engine", label: "引擎核心", icon: <Cpu className="h-4 w-4" /> },
  {
    id: "remote",
    label: "移动端接入",
    icon: <Smartphone className="h-4 w-4" />,
  },
  {
    id: "matrix",
    label: "矩阵账号授权",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: "personalization",
    label: "个性化",
    icon: <Palette className="h-4 w-4" />,
  },
];

type MatrixApp =
  | "xiaohongshu"
  | "douyin"
  | "wechat"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "linkedin"
  | "storefront";

const matrixApps: Array<{ id: MatrixApp; name: string }> = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "wechat", name: "微信公众号" },
  { id: "instagram", name: "Instagram" },
  { id: "tiktok", name: "TikTok" },
  { id: "twitter", name: "X / Twitter" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "storefront", name: "独立站" },
];

function statusDotClass(connected: boolean) {
  return connected ? "bg-emerald-500" : "bg-gray-300";
}

function getImEventStatusMeta(status: string) {
  switch (status) {
    case "completed":
      return { label: "已完成", className: "bg-emerald-100 text-emerald-700" };
    case "failed":
      return { label: "失败", className: "bg-rose-100 text-rose-700" };
    case "ignored":
      return { label: "已忽略", className: "bg-gray-100 text-gray-600" };
    case "unauthorized":
      return { label: "未授权", className: "bg-amber-100 text-amber-700" };
    case "disabled":
      return { label: "未启用", className: "bg-gray-100 text-gray-600" };
    case "blocked":
      return { label: "待配置", className: "bg-sky-100 text-sky-700" };
    case "invalid":
      return { label: "无效", className: "bg-amber-100 text-amber-700" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-600" };
  }
}

export function SettingsAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [activeTab, setActiveTab] = useState<TabId>("llm");
  const [form, setForm] = useState<AppSettings>(() => defaultSettings);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [expandedImEventId, setExpandedImEventId] = useState<string | null>(null);

  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [isTestingEngine, setIsTestingEngine] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState<Record<MatrixApp, boolean>>({
    xiaohongshu: false,
    douyin: false,
    wechat: false,
    instagram: false,
    tiktok: false,
    twitter: false,
    linkedin: false,
    storefront: false,
  });
  const isWindowVisible = state === "open" || state === "opening";

  const { toast, showToast } = useTimedToast(2000);
  const {
    report: runtimeDoctor,
    loading: runtimeDoctorLoading,
    error: runtimeDoctorError,
    refresh: refreshRuntimeDoctor,
  } = useRuntimeDoctorReport(isWindowVisible && activeTab === "engine");
  const syncStatuses = useServerBackedSyncStatuses(isWindowVisible && activeTab === "engine");
  const autosaveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const flushSaveNow = () => {
    if (!isWindowVisible) return;
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    saveSettings(form);
    setSavedAt(Date.now());
  };

  useEffect(() => {
    if (isWindowVisible) {
      setActiveTab("llm");
      setForm(loadSettings());
      setSavedAt(null);
      hydratedRef.current = true;
      void hydrateSettingsFromDesktopBridge().then((hydrated) => {
        if (!hydrated) return;
        setForm(hydrated);
      });
      void refreshPublishConfig().then((matrixAccounts) => {
        setForm((prev) => ({ ...prev, matrixAccounts }));
      });
    }
  }, [isWindowVisible]);

  useEffect(() => {
    if (!isWindowVisible) return;
    const unsubscribe = subscribePublishConfig(() => {
      setForm((prev) => ({ ...prev, matrixAccounts: getPublishConfig() }));
    });
    return () => unsubscribe();
  }, [isWindowVisible]);

  useEffect(() => {
    const onFocusSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: SettingsTargetTab }>).detail;
      if (!detail?.tab) return;
      setActiveTab(detail.tab);
    };
    return addRuntimeEventListener(RuntimeEventNames.settingsFocus, onFocusSettings);
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null)
        window.clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // Auto-save: any change persists to localStorage with debounce.
  useEffect(() => {
    if (!isWindowVisible) return;
    if (!hydratedRef.current) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      saveSettings(form);
      setSavedAt(Date.now());
      autosaveTimerRef.current = null;
    }, 250);
  }, [form, isWindowVisible]);

  const assistantPromptHint = useMemo(() => {
    return getAssistantPromptHint(form.personalization);
  }, [form.personalization]);

  const providerMeta = useMemo(
    () =>
      [
        { id: "kimi" as const, name: "Kimi (Moonshot)", badge: "推荐" },
      ] as const,
    [],
  );
  const expertProfiles = useMemo(() => listAgentProfiles(), []);

  const backgroundOptions = useMemo(
    () => [
      {
        id: "aurora" as const,
        name: "极光紫",
        className:
          "bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(135deg,#0b1220_0%,#1a1f3b_35%,#3a1c63_70%,#0b1220_100%)]",
      },
      {
        id: "ocean" as const,
        name: "海盐蓝",
        className:
          "bg-[radial-gradient(900px_circle_at_25%_15%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(1100px_circle_at_80%_45%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#06131f_0%,#0b3a5a_35%,#0b6aa6_65%,#06131f_100%)]",
      },
      {
        id: "sunset" as const,
        name: "落日橙",
        className:
          "bg-[radial-gradient(1100px_circle_at_20%_10%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(900px_circle_at_85%_35%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#1a0b1a_0%,#6a1b2d_35%,#ff6a00_70%,#1a0b1a_100%)]",
      },
    ],
    [],
  );

  const languageOptions = useMemo(
    () => [
      { id: "zh-CN" as const, label: "中文", desc: "桌面壳和 AI 输出优先中文" },
      { id: "en-US" as const, label: "English", desc: "Shell labels and generated output prefer English" },
      { id: "ja-JP" as const, label: "日本語", desc: "桌面壳与 AI 输出优先日文" },
      { id: "custom" as const, label: "其他", desc: "自定义输出语言名称" },
    ],
    [],
  );

  const workspaceScenarios = useMemo(
    () => listWorkspaceScenarios(form.personalization.activeIndustry),
    [form.personalization.activeIndustry],
  );

  const selectedScenario = useMemo(
    () => getWorkspaceScenario(form.personalization.activeScenarioId),
    [form.personalization.activeScenarioId],
  );
  const runtimeSummary = useMemo(
    () => getDesktopRuntimeStatusSummary(form, runtimeDoctor),
    [form, runtimeDoctor],
  );
  const totalPendingSyncs = useMemo(
    () => syncStatuses.reduce((sum, status) => sum + status.pendingCount, 0),
    [syncStatuses],
  );
  const runtimeBridgeConfig = useMemo(() => getRuntimeBridgeConfig(form), [form]);
  const {
    status: sidecarStatus,
    loading: sidecarLoading,
    actionLoading: sidecarActionLoading,
    error: sidecarError,
    refresh: refreshSidecarStatus,
    sync: syncSidecarConfig,
    boot: bootSidecar,
    stop: stopSidecar,
  } = useRuntimeSidecar(runtimeBridgeConfig, isWindowVisible && activeTab === "engine");
  const {
    config: imBridgeConfig,
    setConfig: setImBridgeConfig,
    health: imBridgeHealth,
    events: imBridgeEvents,
    loading: imBridgeLoading,
    saving: imBridgeSaving,
    testing: imBridgeTesting,
    clearing: imBridgeClearing,
    retryingEventId,
    error: imBridgeError,
    save: saveImBridgeConfig,
    test: testImBridgeConfig,
    clearEvents: clearImBridgeEvents,
    retryEvent: retryImBridgeEvent,
  } = useImBridge(isWindowVisible && activeTab === "remote");

  const appGroups = useMemo(() => {
    return listCategoryMetas(form.personalization.interfaceLanguage)
      .map((meta) => ({
        category: meta.id,
        meta,
        items: appCatalog.filter((item) => item.category === meta.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [form.personalization.interfaceLanguage]);
  const imProviders = useMemo(
    () =>
      [
        {
          id: "generic" as const,
          name: "通用 Webhook",
          desc: "适合通过钉钉/飞书自动化把消息转发成标准 HTTP 请求。",
        },
        {
          id: "feishu" as const,
          name: "飞书",
          desc: "使用飞书机器人或流程自动化，把消息转发到 AgentCore IM Bridge。",
        },
        {
          id: "dingtalk" as const,
          name: "钉钉",
          desc: "使用钉钉机器人或自动化流程，把指令转发到桌面侧回调。",
        },
      ] as const,
    [],
  );
  const imCommandExample = useMemo(() => {
    const prefix = imBridgeConfig.commandPrefix.trim();
    const command = "帮我分析本周销售数据，并生成一份工作汇报提纲。";
    return prefix ? `${prefix} ${command}` : command;
  }, [imBridgeConfig.commandPrefix]);
  const imBridgeExamples = useMemo(() => {
    const callbackUrls = imBridgeHealth?.callbackUrls ?? {
      generic: "https://your-tunnel.example.com/api/im-bridge/inbound/generic",
      feishu: "https://your-tunnel.example.com/api/im-bridge/inbound/feishu",
      dingtalk: "https://your-tunnel.example.com/api/im-bridge/inbound/dingtalk",
    };
    const tokenHint = "<Access Token>";
    return {
      generic: {
        callbackUrl: callbackUrls.generic,
        auth: imBridgeHealth?.authModes?.bearerHeader ?? `Authorization: Bearer ${tokenHint}`,
        body: JSON.stringify(
          {
            text: imCommandExample,
            sessionId: "mobile-demo-user",
          },
          null,
          2,
        ),
      },
      feishu: {
        callbackUrl: callbackUrls.feishu,
        auth: imBridgeHealth?.authModes?.customHeader ?? `X-AgentCore-IM-Token: ${tokenHint}`,
        body: JSON.stringify(
          {
            event: {
              sender: {
                sender_id: {
                  open_id: "ou_mobile_demo",
                },
              },
              message: {
                chat_id: "oc_mobile_demo",
                content: JSON.stringify({ text: imCommandExample }),
              },
            },
          },
          null,
          2,
        ),
      },
      dingtalk: {
        callbackUrl: callbackUrls.dingtalk,
        auth: imBridgeHealth?.authModes?.queryParam ?? `?token=${tokenHint}`,
        body: JSON.stringify(
          {
            conversationId: "cid_mobile_demo",
            senderStaffId: "staff_mobile_demo",
            text: {
              content: imCommandExample,
            },
          },
          null,
          2,
        ),
      },
    };
  }, [imBridgeHealth, imCommandExample]);

  const applyWorkspaceScenario = (scenarioId: string) => {
    const scenario = getWorkspaceScenario(scenarioId);
    if (!scenario) return;
    setForm((prev) => ({
      ...prev,
      personalization: {
        ...prev.personalization,
        activeIndustry: scenario.industryId,
        activeScenarioId: scenario.id,
        useCustomWorkspace: true,
        customDesktopApps: scenario.desktopApps,
        customDockApps: scenario.dockApps,
      },
    }));
    showToast(`已切换到场景：${scenario.title}`, "ok");
  };

  const applyRuntimeProfile = (profile: "desktop_light" | "desktop_dify") => {
    setForm((prev) => ({
      ...prev,
      runtime: {
        ...prev.runtime,
        profile,
        orchestration: profile === "desktop_dify" ? "docker_compose" : "none",
        autoBootLocalStack: profile === "desktop_dify",
      },
    }));
  };

  const handleSyncRuntimeBridge = async () => {
    const result = await syncSidecarConfig();
    showToast(result.message, result.ok ? "ok" : "error");
  };

  const handleBootRuntimeSidecar = async () => {
    const result = await bootSidecar();
    showToast(result.message, result.ok ? "ok" : "error");
    refreshSidecarStatus();
  };

  const handleStopRuntimeSidecar = async () => {
    const result = await stopSidecar();
    showToast(result.message, result.ok ? "ok" : "error");
    refreshSidecarStatus();
  };

  const toggleDesktopApp = (appId: AppId) => {
    setForm((prev) => {
      const current = prev.personalization.customDesktopApps;
      const next = current.includes(appId)
        ? current.filter((id) => id !== appId)
        : [...current, appId];
      return {
        ...prev,
        personalization: {
          ...prev.personalization,
          useCustomWorkspace: true,
          customDesktopApps: next,
        },
      };
    });
  };

  const toggleDockApp = (appId: AppId) => {
    setForm((prev) => {
      const current = prev.personalization.customDockApps;
      const next = current.includes(appId)
        ? current.filter((id) => id !== appId)
        : [...current, appId];
      return {
        ...prev,
        personalization: {
          ...prev.personalization,
          useCustomWorkspace: true,
          customDockApps: next,
        },
      };
    });
  };

  const applyCategorySelection = (
    category: AppCategory,
    target: "desktop" | "dock",
    enabled: boolean,
  ) => {
    const categoryApps = appCatalog
      .filter((item) => item.category === category)
      .map((item) => item.id);
    setForm((prev) => {
      const current =
        target === "desktop"
          ? prev.personalization.customDesktopApps
          : prev.personalization.customDockApps;
      const next = enabled
        ? Array.from(new Set([...current, ...categoryApps]))
        : current.filter((appId) => !categoryApps.includes(appId));
      return {
        ...prev,
        personalization: {
          ...prev.personalization,
          useCustomWorkspace: true,
          customDesktopApps:
            target === "desktop" ? next : prev.personalization.customDesktopApps,
          customDockApps: target === "dock" ? next : prev.personalization.customDockApps,
        },
      };
    });
  };

  const clearCategorySelection = (category: AppCategory) => {
    applyCategorySelection(category, "desktop", false);
    applyCategorySelection(category, "dock", false);
  };

  const handleTestActiveProvider = async () => {
    const active = getActiveLlmConfig(form);
    if (!active.config.apiKey.trim()) {
      showToast("请先填写当前引擎的 API Key", "error");
      return;
    }

    setIsTestingLlm(true);
    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/llm/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: active.config.apiKey,
          baseUrl: active.config.baseUrl,
          model: active.config.model,
          provider: active.id,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        modelFound?: boolean;
      };

      if (!res.ok || !data.ok) {
        showToast(data.error || "连接失败，请检查配置", "error");
        return;
      }
      if (data.modelFound === false) {
        showToast("连接成功，但未找到该模型", "error");
        return;
      }
      showToast("连接成功", "ok");
    } catch {
      showToast("连接失败（网络问题）", "error");
    } finally {
      setIsTestingLlm(false);
    }
  };

  const handleTestEngine = async () => {
    if (!form.openclaw.baseUrl.trim()) {
      showToast("请先填写引擎地址", "error");
      return;
    }

    setIsTestingEngine(true);
    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/openclaw/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.openclaw.baseUrl,
          apiToken: form.openclaw.apiToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        endpoint?: string;
      };

      if (!res.ok || !data.ok) {
        showToast(data.error || "引擎连接失败", "error");
        return;
      }
      showToast(`引擎可用：${data.endpoint ?? "OK"}`, "ok");
    } catch {
      showToast("引擎连接失败（网络问题）", "error");
    } finally {
      setIsTestingEngine(false);
    }
  };

  const handleSaveMatrix = async (appId: MatrixApp) => {
    setMatrixSaving((prev) => ({ ...prev, [appId]: true }));
    try {
      const matrixAccounts = await savePublishConfig(form.matrixAccounts);
      setForm((prev) => ({ ...prev, matrixAccounts }));
      showToast("授权信息已保存到服务端", "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setMatrixSaving((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleSaveImBridge = async () => {
    const result = await saveImBridgeConfig(imBridgeConfig);
    showToast(result.message, result.ok ? "ok" : "error");
  };

  const handleTestImBridge = async (provider?: ImBridgeProviderId) => {
    const result = await testImBridgeConfig(provider);
    showToast(result.message, result.ok ? "ok" : "error");
  };

  const handleClearImBridgeEvents = async () => {
    const result = await clearImBridgeEvents();
    showToast(result.message, result.ok ? "ok" : "error");
  };

  const handleRetryImBridgeEvent = async (eventId: string) => {
    const result = await retryImBridgeEvent(eventId);
    showToast(result.message, result.ok ? "ok" : "error");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="设置"
      icon={SettingsIcon}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.settings"
      onFocus={onFocus}
      onMinimize={() => {
        flushSaveNow();
        onMinimize();
      }}
      onClose={() => {
        flushSaveNow();
        onClose();
      }}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="flex min-h-[560px] flex-col lg:flex-row">
          {/* Left nav */}
          <aside className="w-full border-b border-gray-200 bg-gray-50/60 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="p-5">
              <div className="text-xs font-semibold text-gray-500">
                系统中枢控制台
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">OpenClaw</div>
            </div>

            <nav className="grid grid-cols-1 gap-1 px-2 pb-4 sm:grid-cols-2 lg:grid-cols-1">
              {tabs.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                      active
                        ? "bg-white border border-gray-200 text-gray-900 shadow-sm"
                        : "text-gray-700 hover:bg-white/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-9 w-9 rounded-xl flex items-center justify-center border",
                        active ? "bg-blue-50 border-blue-100" : "bg-white border-gray-200",
                      ].join(" ")}
                    >
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="px-5 pb-5 text-xs text-gray-500 lg:pt-0">
              {savedAt ? `已自动保存：${new Date(savedAt).toLocaleTimeString()}` : "将自动保存到本机"}
            </div>
          </aside>

          {/* Right panel */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === "llm" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">大模型与助手</div>
                  <div className="text-sm text-gray-500 mt-1">
                    配置大模型与全局系统助手（自动保存）。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        Kimi 引擎
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        默认使用 Kimi。只填 API Key 即可测试，Base URL 与 Model 会自动补齐。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestActiveProvider}
                      disabled={isTestingLlm}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
                    >
                      {isTestingLlm ? "测试中..." : "测试连接"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providerMeta.map((p) => {
                      const cfg = form.llm.providers[p.id];
                      const active = form.llm.activeProvider === p.id;
                      return (
                        <div
                          key={p.id}
                          className={[
                            "rounded-2xl border p-4 space-y-3",
                            active ? "border-blue-500 bg-blue-50/40" : "border-gray-200 bg-white",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-gray-900 truncate">
                                  {p.name}
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-900 text-white font-semibold">
                                  {p.badge}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {active ? "当前引擎" : "可一键切换"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  llm: { ...prev.llm, activeProvider: p.id as LlmProviderId },
                                }))
                              }
                              className={[
                                "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors",
                                active
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              {active ? "正在使用" : "设为当前"}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                API Key
                              </label>
                              <div className="relative">
                                <input
                                  type="password"
                                  value={cfg.apiKey}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      llm: {
                                        ...prev.llm,
                                        providers: {
                                          ...prev.llm.providers,
                                          [p.id]: { ...prev.llm.providers[p.id], apiKey: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  placeholder="sk-..."
                                  className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoComplete="off"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                  <KeyRound className="h-4 w-4" />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                  Base URL
                                </label>
                                <input
                                  value={cfg.baseUrl}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      llm: {
                                        ...prev.llm,
                                        providers: {
                                          ...prev.llm.providers,
                                          [p.id]: { ...prev.llm.providers[p.id], baseUrl: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoComplete="off"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                  Model
                                </label>
                                <input
                                  value={cfg.model}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      llm: {
                                        ...prev.llm,
                                        providers: {
                                          ...prev.llm.providers,
                                          [p.id]: { ...prev.llm.providers[p.id], model: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoComplete="off"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      全局系统助手设定
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      用于预设专属助手的身份、语气与行为边界（自动保存）。
                    </div>
                  </div>
                  <textarea
                    value={form.assistant.systemPrompt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assistant: { ...prev.assistant, systemPrompt: e.target.value },
                      }))
                    }
                    placeholder={assistantPromptHint}
                    className="h-40 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">专家角色白名单</div>
                    <div className="text-xs text-gray-500 mt-1">
                      只启用少量高价值数字员工角色。关闭后，请求会退回普通助手模式。建议优先保留销售资格判断、销售跟进、客服回复和 Reality Checker。
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {expertProfiles.map((profile) => {
                      const enabled = form.assistant.expertProfiles[profile.id]?.enabled !== false;
                      return (
                        <label
                          key={profile.id}
                          className={[
                            "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                            enabled ? "border-emerald-200 bg-emerald-50/70" : "border-gray-200 bg-gray-50",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                assistant: {
                                  ...prev.assistant,
                                  expertProfiles: {
                                    ...prev.assistant.expertProfiles,
                                    [profile.id]: { enabled: e.target.checked },
                                  },
                                },
                              }))
                            }
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-gray-900">{profile.title}</div>
                              <span
                                className={[
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                                  enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600",
                                ].join(" ")}
                              >
                                {enabled ? "Enabled" : "Disabled"}
                              </span>
                            </div>
                            <div className="mt-1 text-xs leading-5 text-gray-600">{profile.purpose}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "engine" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">引擎核心</div>
                  <div className="text-sm text-gray-500 mt-1">
                    配置 AgentCore OS 的 API-first 运行模式、本地运行时地址与可选的 Dify sidecar 编排。
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    推荐策略：普通用户选择“轻量桌面运行时 + 纯 API”；只有在需要本地 Dify sidecar 时才启用 Docker Compose。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="text-sm font-semibold text-gray-900">初始化与诊断</div>
                      <div className="text-xs text-gray-500 mt-1 leading-6">
                        AgentCore OS 会把运行模式、云端模型与本地 sidecar 状态统一折算成 readiness。先把这里跑通，再去放大自动化能力。
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={refreshRuntimeDoctor}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                      >
                        <RefreshCw
                          className={[
                            "h-3.5 w-3.5",
                            runtimeDoctorLoading ? "animate-spin" : "",
                          ].join(" ")}
                        />
                        {runtimeDoctorLoading ? "检测中..." : "运行诊断"}
                      </button>
                      {runtimeDoctor &&
                      runtimeDoctor.recommendedProfile !== form.runtime.profile ? (
                        <button
                          type="button"
                          onClick={() => applyRuntimeProfile(runtimeDoctor.recommendedProfile)}
                          className="rounded-xl border border-gray-900 bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                        >
                          应用推荐模式
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">System readiness</div>
                        <div
                          className={[
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
                            runtimeSummary.initializationComplete
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-amber-200 bg-amber-50 text-amber-700",
                          ].join(" ")}
                        >
                          {runtimeSummary.initializationComplete ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                          {runtimeSummary.completedSteps}/{runtimeSummary.totalSteps} ready
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {runtimeSummary.checklist.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                              <div
                                className={[
                                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                  item.status === "ready"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "checking"
                                      ? "bg-sky-100 text-sky-700"
                                      : "bg-amber-100 text-amber-700",
                                ].join(" ")}
                              >
                                {item.status === "ready"
                                  ? "Ready"
                                  : item.status === "checking"
                                    ? "Check"
                                    : "Action"}
                              </div>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-gray-500">
                              {item.detail}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-[linear-gradient(180deg,#fbfdff_0%,#ffffff_100%)] p-4">
                      <div className="text-sm font-semibold text-gray-900">Local diagnostics</div>
                      <div className="mt-2 text-xs leading-5 text-gray-500">
                        这里会告诉你一台全新电脑是否已经具备“安装后即可运行测试”的条件。
                      </div>

                      <div className="mt-4 space-y-2">
                        {[
                          { label: "Local Store", check: runtimeDoctor?.checks.localStore },
                          { label: "Runtime Template", check: runtimeDoctor?.checks.runtimeTemplate },
                          { label: "FFmpeg", check: runtimeDoctor?.checks.ffmpeg },
                          { label: "Docker", check: runtimeDoctor?.checks.docker },
                          { label: "Compose", check: runtimeDoctor?.checks.dockerCompose },
                          { label: "Node", check: runtimeDoctor?.checks.node },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                            <div
                              className={[
                                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                item.check?.ok
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-600",
                              ].join(" ")}
                            >
                              {item.check?.ok
                                ? "Ready"
                                : runtimeDoctorLoading
                                  ? "Checking"
                                  : "Missing"}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {[
                          {
                            label: "Desktop Light",
                            ready: runtimeDoctor?.readiness.desktopLightReady,
                          },
                          {
                            label: "Desktop + Dify",
                            ready: runtimeDoctor?.readiness.desktopDifyReady,
                          },
                          {
                            label: "Creative Studio",
                            ready: runtimeDoctor?.readiness.creativeStudioReady,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                              {item.label}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-gray-900">
                              {item.ready ? "Ready" : runtimeDoctorLoading ? "Checking" : "Not ready"}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs leading-6 text-gray-600">
                        {runtimeDoctorError
                          ? `Diagnostics unavailable: ${runtimeDoctorError}`
                          : runtimeDoctor
                            ? `Recommended profile: ${
                                runtimeDoctor.recommendedProfile === "desktop_light"
                                  ? "Desktop Light Runtime"
                              : "Desktop + Dify Runtime"
                              }. ${runtimeDoctor.nextAction}`
                            : "Run diagnostics to confirm local sidecar readiness."}
                      </div>

                      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-900">核心状态同步</div>
                          <div
                            className={[
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                              totalPendingSyncs > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700",
                            ].join(" ")}
                          >
                            {totalPendingSyncs > 0 ? `${totalPendingSyncs} Pending` : "Healthy"}
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-gray-500">
                          这里监控销售、客服和工作流三条核心状态链路的待同步积压与自动重试情况。
                        </div>

                        <div className="mt-4 space-y-2">
                          {syncStatuses.length > 0 ? (
                            syncStatuses.map((status) => (
                              <div
                                key={status.id}
                                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {status.label}
                                  </div>
                                  <div
                                    className={[
                                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                      status.phase === "idle"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : status.phase === "syncing"
                                          ? "bg-sky-100 text-sky-700"
                                          : "bg-amber-100 text-amber-700",
                                    ].join(" ")}
                                  >
                                    {status.phase === "idle"
                                      ? "Idle"
                                      : status.phase === "syncing"
                                        ? "Syncing"
                                        : "Retrying"}
                                  </div>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-3 text-[11px] text-gray-500">
                                  <div>
                                    <span className="font-semibold text-gray-900">待同步：</span>
                                    {status.pendingCount}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">最近成功：</span>
                                    {status.lastSuccessAt
                                      ? new Date(status.lastSuccessAt).toLocaleTimeString()
                                      : "暂无"}
                                  </div>
                                  <div className="col-span-2">
                                    <span className="font-semibold text-gray-900">最近异常：</span>
                                    {status.lastError || "无"}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-xs leading-6 text-gray-500">
                              同步诊断尚未初始化。
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-900">Backend bridge</div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                            {sidecarLoading
                              ? "Loading"
                              : sidecarStatus?.running
                                ? "Running"
                                : sidecarStatus?.synced
                                  ? "Synced"
                                  : "Unsynced"}
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-gray-500">
                          这里是前后端联动边界。前端只提交配置和动作，真正的 compose 管理在服务端执行。
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleSyncRuntimeBridge}
                            disabled={sidecarActionLoading !== null}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sidecarActionLoading === "sync" ? "同步中..." : "同步到后端"}
                          </button>
                          <button
                            type="button"
                            onClick={handleBootRuntimeSidecar}
                            disabled={
                              sidecarActionLoading !== null ||
                              form.runtime.profile !== "desktop_dify"
                            }
                            className="rounded-xl border border-gray-900 bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sidecarActionLoading === "boot" ? "启动中..." : "静默拉起 sidecar"}
                          </button>
                          <button
                            type="button"
                            onClick={handleStopRuntimeSidecar}
                            disabled={
                              sidecarActionLoading !== null ||
                              form.runtime.profile !== "desktop_dify"
                            }
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sidecarActionLoading === "stop" ? "停止中..." : "停止 sidecar"}
                          </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
                          {sidecarError
                            ? `Bridge error: ${sidecarError}`
                            : sidecarStatus?.lastAction.message
                              ? `Last action: ${sidecarStatus.lastAction.message}`
                              : "Sync the current runtime config so the backend bridge can reuse it later."}
                        </div>

                        {sidecarStatus?.services.length ? (
                          <div className="mt-3 space-y-2">
                            {sidecarStatus.services.map((service) => (
                              <div
                                key={service.service}
                                className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">
                                    {service.service}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {service.statusText}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-semibold text-gray-900">
                                    {service.health || service.state}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {service.publishedPorts.join(", ") || "no ports"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">桌面运行模式</div>
                    <div className="text-xs text-gray-500 mt-1">
                      这决定 AgentCore OS 是作为轻量桌面工作台运行，还是额外挂上本地 sidecar / Dify 编排层。
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {[
                      {
                        id: "desktop_light" as const,
                        title: "轻量桌面运行时（推荐）",
                        desc: "只保留本地 workflow、状态与资产层；所有模型能力走云端 API。",
                      },
                      {
                        id: "desktop_dify" as const,
                        title: "桌面 + Dify Sidecar",
                        desc: "本地额外挂载精简 Dify 栈，用于编排、队列和知识库能力。",
                      },
                    ].map((option) => {
                      const active = form.runtime.profile === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => applyRuntimeProfile(option.id)}
                          className={[
                            "rounded-2xl border p-4 text-left transition-colors",
                            active
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold">{option.title}</div>
                          <div className={["mt-2 text-xs leading-5", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                            {option.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">LLM Strategy</div>
                      <div className="mt-2 text-sm font-semibold text-gray-900">API Only</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        当前桌面版不依赖本地大模型部署，只走 BYOK 云模型调用。
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Shell</div>
                      <div className="mt-2 text-sm font-semibold text-gray-900">
                        {form.runtime.shell === "tauri" ? "Tauri Desktop" : "Browser / Web Shell"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        先保留浏览器壳，后续桌面版迁移时切到 Tauri。
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Orchestration</div>
                      <div className="mt-2 text-sm font-semibold text-gray-900">
                        {form.runtime.orchestration === "docker_compose" ? "Docker Compose" : "None"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        仅在本地 sidecar 模式下启用精简编排层。
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        本地运行时与可选 sidecar
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        OpenClaw / AgentCore runtime 可单独连接；如果你要挂 Dify sidecar，也在这里配置本地地址。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestEngine}
                      disabled={isTestingEngine}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
                    >
                      {isTestingEngine ? "测试中..." : "测试引擎连通性"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Agent Runtime URL
                      </label>
                      <input
                        value={form.openclaw.baseUrl}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            openclaw: { ...prev.openclaw, baseUrl: e.target.value },
                          }))
                        }
                        placeholder="留空：使用本地 video-frames（推荐）；或填写 http://127.0.0.1:18789"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        提示：如果你运行的是本地 gateway / sidecar，这里通常是 `http://127.0.0.1:18789`。
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Agent Runtime Token
                      </label>
                      <input
                        type="password"
                        value={form.openclaw.apiToken}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            openclaw: { ...prev.openclaw, apiToken: e.target.value },
                          }))
                        }
                        placeholder="（可选）"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Local App URL
                      </label>
                      <input
                        value={form.runtime.localAppUrl}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            runtime: { ...prev.runtime, localAppUrl: e.target.value },
                          }))
                        }
                        placeholder="http://127.0.0.1:3000"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sidecar API URL
                      </label>
                      <input
                        value={form.runtime.sidecarApiUrl}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            runtime: { ...prev.runtime, sidecarApiUrl: e.target.value },
                          }))
                        }
                        placeholder="http://127.0.0.1:8080"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        桌面壳模式下，前端会优先把 `/api/*` 请求转发到这里。适合连接 AgentCore 本地运行时。
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dify Base URL
                      </label>
                      <input
                        value={form.runtime.difyBaseUrl}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            runtime: { ...prev.runtime, difyBaseUrl: e.target.value },
                          }))
                        }
                        placeholder="http://127.0.0.1:5001"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Compose Project Name
                      </label>
                      <input
                        value={form.runtime.composeProjectName}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            runtime: { ...prev.runtime, composeProjectName: e.target.value },
                          }))
                        }
                        placeholder="agentcore-runtime"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Launch Behavior
                      </label>
                      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={form.runtime.detectDockerOnLaunch}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                detectDockerOnLaunch: e.target.checked,
                              },
                            }))
                          }
                          className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                          启动时检测 Docker / Compose 环境
                        </span>
                      </label>
                      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={form.runtime.autoBootLocalStack}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              runtime: {
                                ...prev.runtime,
                                autoBootLocalStack: e.target.checked,
                              },
                            }))
                          }
                          className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                          自动拉起本地 sidecar 栈（仅桌面版 / Tauri 模式启用）
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "remote" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">移动端接入</div>
                  <div className="text-sm text-gray-500 mt-1">
                    让手机上的钉钉、飞书等 IM 把远程指令转发到本机 AgentCore OS，由桌面 Agent 执行后再把结果回发到 IM。
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    当前实现是桌面优先的 IM Bridge：桌面 sidecar 负责收消息、调用底层智能体、再通过 webhook 回消息。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Bridge readiness</div>
                      <div className="text-xs text-gray-500 mt-1 leading-6">
                        这层本质上是“远程指令入口”。你只需要准备一个公网回调地址和一个共享 Token，就能把 IM 消息路由到本机 Agent。
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveImBridge}
                        disabled={imBridgeSaving}
                        className="rounded-xl border border-gray-900 bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {imBridgeSaving ? "保存中..." : "保存桥接配置"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestImBridge()}
                        disabled={imBridgeTesting}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {imBridgeTesting ? "测试中..." : "发送测试消息"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          checked={imBridgeConfig.enabled}
                          onChange={(e) =>
                            setImBridgeConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-900">
                            启用移动端远程指令桥
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-gray-500">
                            开启后，桌面 sidecar 会接受来自公网回调的远程指令，并尝试自动回消息。
                          </span>
                        </span>
                      </label>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Public Base URL
                          </label>
                          <input
                            value={imBridgeConfig.publicBaseUrl}
                            onChange={(e) =>
                              setImBridgeConfig((prev) => ({
                                ...prev,
                                publicBaseUrl: e.target.value,
                              }))
                            }
                            placeholder="https://your-tunnel.example.com"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            用 Cloudflare Tunnel / ngrok / FRP 暴露本地 sidecar 后，把公网入口填到这里。
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Access Token
                          </label>
                          <input
                            type="password"
                            value={imBridgeConfig.accessToken}
                            onChange={(e) =>
                              setImBridgeConfig((prev) => ({
                                ...prev,
                                accessToken: e.target.value,
                              }))
                            }
                            placeholder="设置共享令牌"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Command Prefix（可选）
                          </label>
                          <input
                            value={imBridgeConfig.commandPrefix}
                            onChange={(e) =>
                              setImBridgeConfig((prev) => ({
                                ...prev,
                                commandPrefix: e.target.value,
                              }))
                            }
                            placeholder="/agent"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            配置后，仅处理带此前缀的消息，避免群聊噪音误触发。
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-[linear-gradient(180deg,#fbfdff_0%,#ffffff_100%)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">Remote health</div>
                        <div
                          className={[
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                            imBridgeHealth?.configured
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700",
                          ].join(" ")}
                        >
                          {imBridgeLoading ? "Loading" : imBridgeHealth?.configured ? "Ready" : "Action"}
                        </div>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-gray-500">
                        {imBridgeError
                          ? `Bridge error: ${imBridgeError}`
                          : imBridgeHealth?.nextAction ?? "桌面模式下会从 sidecar 加载 IM Bridge 状态。"}
                      </div>

                      <div className="mt-4 space-y-2">
                        {imProviders.map((provider) => {
                          const callbackUrl = imBridgeHealth?.callbackUrls?.[provider.id] ?? "";
                          const replyConfigured = Boolean(imBridgeHealth?.providerStatus?.[provider.id]?.replyConfigured);
                          const authConfigured = Boolean(imBridgeHealth?.providerStatus?.[provider.id]?.authConfigured);
                          const officialApiConfigured = Boolean(
                            imBridgeHealth?.providerStatus?.[provider.id]?.officialApiConfigured,
                          );
                          return (
                            <div
                              key={provider.id}
                              className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-gray-900">{provider.name}</div>
                                <div className="flex flex-wrap gap-2">
                                  <div
                                    className={[
                                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                      replyConfigured ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600",
                                    ].join(" ")}
                                  >
                                    {replyConfigured ? "Reply ready" : "No reply webhook"}
                                  </div>
                                  <div
                                    className={[
                                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                      authConfigured ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-600",
                                    ].join(" ")}
                                  >
                                    {authConfigured ? "Native auth" : "Shared token"}
                                  </div>
                                  <div
                                    className={[
                                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                      officialApiConfigured ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600",
                                    ].join(" ")}
                                  >
                                    {officialApiConfigured ? "Official API" : "Webhook reply"}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-1 text-xs leading-5 text-gray-500">{provider.desc}</div>
                              <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 font-mono text-[11px] leading-5 text-gray-700 break-all">
                                {callbackUrl || "请先填写 Public Base URL 后生成回调地址"}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleTestImBridge(provider.id)}
                                disabled={imBridgeTesting}
                                className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                发测试消息
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">回复通道</div>
                    <div className="text-xs text-gray-500 mt-1">
                      这里填的是“AgentCore 执行完成后，往哪里回消息”。如果暂时不填，也可以先只用 API 回调观察执行结果。
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {imProviders.map((provider) => (
                      <div key={provider.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">{provider.name}</div>
                        <div className="mt-1 text-xs leading-5 text-gray-500">{provider.desc}</div>
                        <div className="mt-3 inline-flex rounded-xl border border-gray-200 bg-white p-1">
                          {[
                            { id: "webhook" as const, label: "Webhook" },
                            { id: "official_api" as const, label: "官方 API" },
                          ].map((mode) => {
                            const active = imBridgeConfig.providers[provider.id].replyMode === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() =>
                                  setImBridgeConfig((prev) => ({
                                    ...prev,
                                    providers: {
                                      ...prev.providers,
                                      [provider.id]: {
                                        ...prev.providers[provider.id],
                                        replyMode: mode.id,
                                      },
                                    },
                                  }))
                                }
                                className={[
                                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                  active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50",
                                ].join(" ")}
                              >
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                        <label className="mt-3 block text-xs font-semibold text-gray-600">
                          Reply Webhook URL
                        </label>
                        <input
                          value={imBridgeConfig.providers[provider.id].replyWebhookUrl}
                          onChange={(e) =>
                            setImBridgeConfig((prev) => ({
                              ...prev,
                              providers: {
                                ...prev.providers,
                                [provider.id]: {
                                  ...prev.providers[provider.id],
                                  replyWebhookUrl: e.target.value,
                                },
                              },
                            }))
                          }
                          placeholder="https://open.feishu.cn/..."
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoComplete="off"
                        />
                        {provider.id === "feishu" || provider.id === "dingtalk" ? (
                          <div className="mt-3 space-y-3">
                            <label className="block text-xs font-semibold text-gray-600">
                              Official API Base URL
                            </label>
                            <input
                              value={imBridgeConfig.providers[provider.id].officialApiBaseUrl}
                              onChange={(e) =>
                                setImBridgeConfig((prev) => ({
                                  ...prev,
                                  providers: {
                                    ...prev.providers,
                                    [provider.id]: {
                                      ...prev.providers[provider.id],
                                      officialApiBaseUrl: e.target.value,
                                    },
                                  },
                                }))
                              }
                              placeholder={provider.id === "feishu" ? "https://open.feishu.cn" : "https://api.dingtalk.com"}
                              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoComplete="off"
                            />
                            <div className="grid grid-cols-1 gap-3">
                              <input
                                value={imBridgeConfig.providers[provider.id].officialAppId}
                                onChange={(e) =>
                                  setImBridgeConfig((prev) => ({
                                    ...prev,
                                    providers: {
                                      ...prev.providers,
                                      [provider.id]: {
                                        ...prev.providers[provider.id],
                                        officialAppId: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                placeholder={provider.id === "feishu" ? "App ID" : "App Key"}
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                              />
                              <input
                                type="password"
                                value={imBridgeConfig.providers[provider.id].officialAppSecret}
                                onChange={(e) =>
                                  setImBridgeConfig((prev) => ({
                                    ...prev,
                                    providers: {
                                      ...prev.providers,
                                      [provider.id]: {
                                        ...prev.providers[provider.id],
                                        officialAppSecret: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                placeholder="App Secret"
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                              />
                              {provider.id === "feishu" ? (
                                <>
                                  <input
                                    value={imBridgeConfig.providers[provider.id].officialTargetIdType}
                                    onChange={(e) =>
                                      setImBridgeConfig((prev) => ({
                                        ...prev,
                                        providers: {
                                          ...prev.providers,
                                          [provider.id]: {
                                            ...prev.providers[provider.id],
                                            officialTargetIdType: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    placeholder="chat_id / open_id / user_id"
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoComplete="off"
                                  />
                                  <input
                                    value={imBridgeConfig.providers[provider.id].officialTargetId}
                                    onChange={(e) =>
                                      setImBridgeConfig((prev) => ({
                                        ...prev,
                                        providers: {
                                          ...prev.providers,
                                          [provider.id]: {
                                            ...prev.providers[provider.id],
                                            officialTargetId: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    placeholder="固定 receive_id（可选）"
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoComplete="off"
                                  />
                                </>
                              ) : (
                                <>
                                  <input
                                    value={imBridgeConfig.providers[provider.id].officialRobotCode}
                                    onChange={(e) =>
                                      setImBridgeConfig((prev) => ({
                                        ...prev,
                                        providers: {
                                          ...prev.providers,
                                          [provider.id]: {
                                            ...prev.providers[provider.id],
                                            officialRobotCode: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    placeholder="Robot Code"
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoComplete="off"
                                  />
                                  <input
                                    value={imBridgeConfig.providers[provider.id].officialConversationId}
                                    onChange={(e) =>
                                      setImBridgeConfig((prev) => ({
                                        ...prev,
                                        providers: {
                                          ...prev.providers,
                                          [provider.id]: {
                                            ...prev.providers[provider.id],
                                            officialConversationId: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    placeholder="固定会话 ID（可选）"
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoComplete="off"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={imBridgeConfig.autoReply}
                      onChange={(e) =>
                        setImBridgeConfig((prev) => ({ ...prev, autoReply: e.target.checked }))
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">自动回消息</span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">
                        开启后，Bridge 会在桌面 Agent 返回结果后立即往对应 IM webhook 推送文本结果。
                      </span>
                    </span>
                  </label>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">原生回调校验</div>
                    <div className="text-xs text-gray-500 mt-1">
                      如果你用的是飞书/钉钉官方机器人回调，可以在这里补上官方风格的校验参数。未填写时，系统仍然使用共享 Access Token 模式。
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">飞书 Verification Token</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        若配置，AgentCore 会校验飞书事件体里的 `token` 字段；适合飞书事件订阅回调。
                      </div>
                      <input
                        value={imBridgeConfig.providers.feishu.verificationToken}
                        onChange={(e) =>
                          setImBridgeConfig((prev) => ({
                            ...prev,
                            providers: {
                              ...prev.providers,
                              feishu: {
                                ...prev.providers.feishu,
                                verificationToken: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="feishu verification token"
                        className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">钉钉 Sign Secret</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        若配置，AgentCore 会按钉钉 `timestamp + sign` 方式校验回调；适合钉钉机器人安全设置。
                      </div>
                      <input
                        type="password"
                        value={imBridgeConfig.providers.dingtalk.signingSecret}
                        onChange={(e) =>
                          setImBridgeConfig((prev) => ({
                            ...prev,
                            providers: {
                              ...prev.providers,
                              dingtalk: {
                                ...prev.providers.dingtalk,
                                signingSecret: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="SEC..."
                        className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
                      飞书原生模式下，除了共享 `Access Token`，还可以要求消息体内 `token` 与这里配置的 Verification Token 一致。
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
                      钉钉原生模式下，除了共享 `Access Token`，还可以要求请求 query 中携带 `timestamp` 和 `sign`，并用 Sign Secret 做 HMAC 校验。
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">接入步骤</div>
                    <div className="text-xs text-gray-500 mt-1">
                      当前最稳的接法不是在手机上直接跑 Agent，而是让飞书 / 钉钉机器人或自动化把消息转成 HTTP 回调，桌面 AgentCore OS 接住后执行。
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    {[
                      {
                        title: "1. 开启桥接",
                        desc: "在这里打开“启用移动端远程指令桥”，并保存 Access Token。",
                      },
                      {
                        title: "2. 暴露桌面回调",
                        desc: "用 Cloudflare Tunnel、ngrok 或 FRP 把本机 sidecar 端口暴露到公网。",
                      },
                      {
                        title: "3. 配置 IM 自动化",
                        desc: "把飞书 / 钉钉的消息转发到 callback URL，并附带 Token。",
                      },
                      {
                        title: "4. 自动回消息",
                        desc: "填好 Reply Webhook URL 后，桌面 Agent 完成任务会把结果自动推回手机。",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-gray-500">{item.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-6 text-blue-900">
                    推荐公网方案：`Cloudflare Tunnel`。它最适合非技术用户，免公网 IP，稳定性也比临时内网穿透更好。
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {imProviders.map((provider) => {
                      const example = imBridgeExamples[provider.id];
                      return (
                        <div
                          key={provider.id}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{provider.name}</div>
                              <div className="mt-1 text-xs leading-5 text-gray-500">{provider.desc}</div>
                            </div>
                            <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                              POST
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                Callback URL
                              </div>
                              <div className="mt-1 rounded-xl bg-white px-3 py-2 font-mono text-[11px] leading-5 text-gray-700 break-all">
                                {example.callbackUrl}
                              </div>
                            </div>

                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                Auth
                              </div>
                              <div className="mt-1 rounded-xl bg-white px-3 py-2 font-mono text-[11px] leading-5 text-gray-700 break-all">
                                {example.auth}
                              </div>
                            </div>

                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                JSON Body
                              </div>
                              <pre className="mt-1 overflow-x-auto rounded-xl bg-[#0b1220] px-3 py-3 text-[11px] leading-5 text-slate-100">
                                {example.body}
                              </pre>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">飞书推荐接法</div>
                      <div className="mt-1 text-xs leading-6 text-gray-500">
                        使用飞书机器人或飞书自动化，把用户消息映射成 `event.message.content`，再 POST 到飞书 callback URL。
                        如果做事件订阅校验，AgentCore 会自动回 `challenge`。
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">钉钉推荐接法</div>
                      <div className="mt-1 text-xs leading-6 text-gray-500">
                        使用钉钉机器人或自动化，把消息文本映射到 `text.content`，并把 Token 放到 Header 或 query 参数里。
                        AgentCore 会按 `conversationId / senderStaffId` 维持会话上下文。
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">最近移动端任务</div>
                      <div className="text-xs text-gray-500 mt-1">
                        这里会记录最近通过钉钉、飞书或 webhook 进入桌面的远程指令，便于排查“消息有没有进来、有没有执行、有没有回发成功”。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImBridgeEvents}
                      disabled={imBridgeClearing || imBridgeLoading}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {imBridgeClearing ? "清空中..." : "清空记录"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {imBridgeEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        暂无移动端任务记录。发送一条测试消息或从手机端触发一次指令后，这里会出现最近记录。
                      </div>
                    ) : (
                      imBridgeEvents.map((event) => {
                        const statusMeta = getImEventStatusMeta(event.status);
                        const expanded = expandedImEventId === event.id;
                        return (
                          <div
                            key={event.id}
                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                                    {event.provider}
                                  </span>
                                  <span
                                    className={[
                                      "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                                      statusMeta.className,
                                    ].join(" ")}
                                  >
                                    {statusMeta.label}
                                  </span>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600">
                                    {event.kind === "test" ? "测试" : "远程指令"}
                                  </span>
                                </div>
                                <div className="mt-3 text-sm font-semibold text-gray-900 break-words">
                                  {event.requestText || "未记录指令内容"}
                                </div>
                                <div className="mt-2 text-xs leading-6 text-gray-500 break-words">
                                  {event.resultPreview || event.error || "暂无执行结果摘要。"}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedImEventId((prev) => (prev === event.id ? null : event.id))
                                    }
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                                  >
                                    {expanded ? "收起详情" : "查看详情"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryImBridgeEvent(event.id)}
                                    disabled={!event.retryable || retryingEventId === event.id}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {retryingEventId === event.id ? "重试中..." : "重试"}
                                  </button>
                                </div>
                              </div>
                              <div className="shrink-0 space-y-2 text-xs text-gray-500 lg:text-right">
                                <div>{new Date(event.createdAt).toLocaleString()}</div>
                                <div>{event.sessionId ? `会话：${event.sessionId}` : "会话：未记录"}</div>
                                <div>{event.delivered ? "回消息：已投递" : "回消息：未投递"}</div>
                              </div>
                            </div>
                            {expanded ? (
                              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                    完整指令
                                  </div>
                                  <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
                                    {event.commandText || event.requestText || "未记录完整指令。"}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                    执行结果
                                  </div>
                                  <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
                                    {event.resultText || event.resultPreview || event.error || "暂无详细结果。"}
                                  </div>
                                  {event.sourceEventId ? (
                                    <div className="mt-3 text-xs text-gray-500">
                                      来源记录：{event.sourceEventId}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "matrix" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">矩阵账号授权</div>
                  <div className="text-sm text-gray-500 mt-1">
                    为不同平台配置 Auth Token（自动保存 + 手动保存按钮）。
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const local = "http://127.0.0.1:8787/webhook/publish";
                      setForm((prev) => ({
                        ...prev,
                        matrixAccounts: {
                          ...prev.matrixAccounts,
                          xiaohongshu: {
                            ...prev.matrixAccounts.xiaohongshu,
                            webhookUrl: local,
                          },
                          douyin: {
                            ...prev.matrixAccounts.douyin,
                            webhookUrl: local,
                          },
                          wechat: {
                            ...prev.matrixAccounts.wechat,
                            webhookUrl: local,
                          },
                          instagram: {
                            ...prev.matrixAccounts.instagram,
                            webhookUrl: local,
                          },
                          tiktok: {
                            ...prev.matrixAccounts.tiktok,
                            webhookUrl: local,
                          },
                          twitter: {
                            ...prev.matrixAccounts.twitter,
                            webhookUrl: local,
                          },
                          linkedin: {
                            ...prev.matrixAccounts.linkedin,
                            webhookUrl: local,
                          },
                        },
                      }));
                      showToast("已填入本地 Connector Webhook", "ok");
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    使用本地 Connector（127.0.0.1:8787）
                  </button>
                  <div className="text-xs text-gray-500">
                    先运行 <span className="font-mono">npm run webhook:dev</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {matrixApps.map((app) => {
                    const token = form.matrixAccounts[app.id].token;
                    const webhookUrl = form.matrixAccounts[app.id].webhookUrl;
                    const connected = Boolean(token.trim());
                    const autoEnabled = Boolean(webhookUrl.trim());
                    const saving = matrixSaving[app.id];
                    return (
                      <div
                        key={app.id}
                        className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                "h-2.5 w-2.5 rounded-full",
                                statusDotClass(connected),
                              ].join(" ")}
                              aria-label={connected ? "已授权" : "未授权"}
                            />
                            <div className="text-sm font-semibold text-gray-900">
                              {app.name}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {connected ? "已配置" : "未配置"}{" "}
                            {autoEnabled ? "· 可自动发布" : "· 手动发布"}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Auth Token
                          </label>
                          <input
                            type="password"
                            value={token}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                matrixAccounts: {
                                  ...prev.matrixAccounts,
                                  [app.id]: {
                                    ...prev.matrixAccounts[app.id],
                                    token: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="token..."
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            说明：Token 仅用于后续自动发布/第三方 webhook；当前发布中心默认安全预演。
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Publish Webhook URL（可选）
                          </label>
                          <input
                            value={webhookUrl}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                matrixAccounts: {
                                  ...prev.matrixAccounts,
                                  [app.id]: {
                                    ...prev.matrixAccounts[app.id],
                                    webhookUrl: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="https://your-service.example.com/webhook/publish"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            填了后「矩阵发布中心」可一键自动发布（由你的服务/脚本执行真实发帖）。
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveMatrix(app.id)}
                          disabled={saving}
                          className="w-full rounded-xl bg-gray-900 text-white font-semibold py-2.5 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? "保存中..." : "保存"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === "personalization" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">个性化</div>
                  <div className="text-sm text-gray-500 mt-1">
                    配置桌面语言、行业工作台和功能按钮配备。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">界面与输出语言</div>
                    <div className="text-xs text-gray-500 mt-1">
                      会影响桌面壳主要文案，以及摘要/晨报/邮件等 AI 输出语言偏好。
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {languageOptions.map((option) => {
                      const selected = form.personalization.interfaceLanguage === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              personalization: {
                                ...prev.personalization,
                                interfaceLanguage: option.id,
                              },
                            }));
                            showToast(`已切换语言：${option.label}`, "ok");
                          }}
                          className={[
                            "rounded-2xl border p-4 text-left transition-colors",
                            selected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-gray-900">{option.label}</div>
                          <div className="mt-1 text-xs text-gray-500">{option.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {form.personalization.interfaceLanguage === "custom" && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        自定义语言名称
                      </label>
                      <input
                        value={form.personalization.customLanguageLabel}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            personalization: {
                              ...prev.personalization,
                              customLanguageLabel: e.target.value,
                            },
                          }))
                        }
                        placeholder="例如：Deutsch / Français / Bahasa Indonesia"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {backgroundOptions.map((bg) => {
                    const selected =
                      form.personalization.desktopBackground === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            personalization: {
                              ...prev.personalization,
                              desktopBackground: bg.id,
                            },
                          }));
                          showToast(`已切换背景：${bg.name}`, "ok");
                        }}
                        className={[
                          "rounded-2xl border overflow-hidden text-left transition-all",
                          selected
                            ? "border-blue-500 ring-4 ring-blue-100"
                            : "border-gray-200 hover:border-gray-300",
                        ].join(" ")}
                      >
                        <div className={["h-28", bg.className].join(" ")} />
                        <div className="p-4 bg-white flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {bg.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {selected ? "当前使用中" : "点击切换"}
                            </div>
                          </div>
                          {selected && (
                            <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <span className="text-xs font-bold">✓</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">行业工作台配置</div>
                      <div className="text-xs text-gray-500 mt-1">
                        先选行业和使用场景，再自由勾选桌面图标与 Dock 按钮。
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <input
                        type="checkbox"
                        checked={form.personalization.useCustomWorkspace}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            personalization: {
                              ...prev.personalization,
                              useCustomWorkspace: e.target.checked,
                              customDesktopApps: e.target.checked
                                ? prev.personalization.customDesktopApps.length > 0
                                  ? prev.personalization.customDesktopApps
                                  : Array.from(
                                      new Set(selectedScenario?.desktopApps ?? []),
                                    )
                                : prev.personalization.customDesktopApps,
                              customDockApps: e.target.checked
                                ? prev.personalization.customDockApps.length > 0
                                  ? prev.personalization.customDockApps
                                  : Array.from(new Set(selectedScenario?.dockApps ?? []))
                                : prev.personalization.customDockApps,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      启用自定义工作台
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    {workspaceIndustries.map((industry) => {
                      const selected = form.personalization.activeIndustry === industry.id;
                      return (
                        <button
                          key={industry.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              personalization: {
                                ...prev.personalization,
                                activeIndustry: industry.id,
                              },
                            }))
                          }
                          className={[
                            "rounded-2xl border p-4 text-left transition-colors",
                            selected
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold">{industry.title}</div>
                          <div className={["mt-1 text-xs", selected ? "text-white/75" : "text-gray-500"].join(" ")}>
                            {industry.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {workspaceScenarios.map((scenario) => {
                      const selected = form.personalization.activeScenarioId === scenario.id;
                      return (
                        <div
                          key={scenario.id}
                          className={[
                            "rounded-2xl border p-4",
                            selected ? "border-blue-500 bg-blue-50/60" : "border-gray-200 bg-gray-50/50",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{scenario.title}</div>
                              <div className="mt-1 text-xs text-gray-500">{scenario.desc}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => applyWorkspaceScenario(scenario.id)}
                              className={[
                                "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                selected
                                  ? "bg-blue-600 text-white"
                                  : "border border-gray-200 bg-white text-gray-900 hover:bg-gray-100",
                              ].join(" ")}
                            >
                              {selected ? "当前场景" : "应用场景"}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                              Desktop {scenario.desktopApps.length}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                              Dock {scenario.dockApps.length}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          当前工作台预览
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {selectedScenario
                            ? `当前场景：${selectedScenario.title}`
                            : "尚未选择场景"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          Desktop {form.personalization.customDesktopApps.length}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          Dock {form.personalization.customDockApps.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedScenario) return;
                            applyWorkspaceScenario(selectedScenario.id);
                          }}
                          disabled={!selectedScenario}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          重置为场景默认
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">App 配备</div>
                      <div className="text-xs text-gray-500 mt-1">
                        你可以按自己的使用场景勾选桌面图标和 Dock 功能按钮。
                      </div>
                    </div>

                    {appGroups.map((group) => {
                      const desktopCount = group.items.filter((item) =>
                        form.personalization.customDesktopApps.includes(item.id),
                      ).length;
                      const dockCount = group.items.filter((item) =>
                        form.personalization.customDockApps.includes(item.id),
                      ).length;

                      return (
                        <div
                          key={group.category}
                          className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-gray-900">
                                  {group.meta.label}
                                </div>
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                                  {group.items.length} 个应用
                                </span>
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                  Desktop {desktopCount}
                                </span>
                                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                                  Dock {dockCount}
                                </span>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-gray-500">
                                {group.meta.description}
                              </div>
                              <div className="mt-1 text-[11px] leading-5 text-gray-400">
                                {group.meta.helper}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyCategorySelection(group.category, "desktop", true)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                全选 Desktop
                              </button>
                              <button
                                type="button"
                                onClick={() => applyCategorySelection(group.category, "dock", true)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                全选 Dock
                              </button>
                              <button
                                type="button"
                                onClick={() => clearCategorySelection(group.category)}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                              >
                                清空本类
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                            {group.items.map((item) => {
                              const desktopEnabled = form.personalization.customDesktopApps.includes(item.id);
                              const dockEnabled = form.personalization.customDockApps.includes(item.id);
                              const statusText = desktopEnabled && dockEnabled
                                ? "已同时加入 Desktop 和 Dock"
                                : desktopEnabled
                                  ? "当前显示在 Desktop"
                                  : dockEnabled
                                    ? "当前固定到 Dock"
                                    : "尚未加入当前工作台";
                              return (
                                <div
                                  key={item.id}
                                  className={[
                                    "rounded-2xl border p-4 transition-colors",
                                    desktopEnabled || dockEnabled
                                      ? "border-blue-100 bg-blue-50/40"
                                      : "border-gray-200 bg-gray-50/70",
                                  ].join(" ")}
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-gray-900">
                                        {getAppDisplayName(
                                          item.id,
                                          item.id,
                                          form.personalization.interfaceLanguage,
                                        )}
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500">
                                        {statusText}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleDesktopApp(item.id)}
                                        className={[
                                          "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                          desktopEnabled
                                            ? "bg-blue-600 text-white hover:bg-blue-700"
                                            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100",
                                        ].join(" ")}
                                      >
                                        {desktopEnabled ? "移出 Desktop" : "加入 Desktop"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleDockApp(item.id)}
                                        className={[
                                          "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                          dockEnabled
                                            ? "bg-violet-600 text-white hover:bg-violet-700"
                                            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100",
                                        ].join(" ")}
                                      >
                                        {dockEnabled ? "移出 Dock" : "加入 Dock"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
