"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Cpu,
  KeyRound,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import type { AppId, AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  getPublishConfig,
  refreshPublishConfig,
  savePublishConfig,
  subscribePublishConfig,
} from "@/lib/publish-config";
import {
  appCatalog,
  getAppDisplayName,
  getCategoryLabel,
} from "@/lib/app-display";
import { getAssistantPromptHint } from "@/lib/language";
import type { AppSettings } from "@/lib/settings";
import {
  defaultSettings,
  getActiveLlmConfig,
  loadSettings,
  saveSettings,
  type LlmProviderId,
} from "@/lib/settings";
import type { SettingsTargetTab } from "@/lib/ui-events";
import {
  getWorkspaceScenario,
  listWorkspaceScenarios,
  workspaceIndustries,
} from "@/lib/workspace-presets";

type TabId = "llm" | "engine" | "matrix" | "personalization";

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "llm", label: "大模型与助手", icon: <Bot className="h-4 w-4" /> },
  { id: "engine", label: "引擎核心", icon: <Cpu className="h-4 w-4" /> },
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

type MatrixApp = "xiaohongshu" | "douyin" | "instagram" | "tiktok" | "storefront";

const matrixApps: Array<{ id: MatrixApp; name: string }> = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "instagram", name: "Instagram" },
  { id: "tiktok", name: "TikTok" },
  { id: "storefront", name: "独立站" },
];

function statusDotClass(connected: boolean) {
  return connected ? "bg-emerald-500" : "bg-gray-300";
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

  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [isTestingEngine, setIsTestingEngine] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState<Record<MatrixApp, boolean>>({
    xiaohongshu: false,
    douyin: false,
    instagram: false,
    tiktok: false,
    storefront: false,
  });

  const { toast, showToast } = useTimedToast(2000);
  const autosaveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const isWindowVisible = state === "open" || state === "opening";

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
    window.addEventListener("openclaw:settings-focus", onFocusSettings);
    return () => window.removeEventListener("openclaw:settings-focus", onFocusSettings);
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
        { id: "deepseek" as const, name: "DeepSeek", badge: "高速" },
        { id: "openai" as const, name: "OpenAI", badge: "通用" },
        { id: "qwen" as const, name: "通义千问", badge: "国产" },
      ] as const,
    [],
  );

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

  const appGroups = useMemo(() => {
    const grouped = new Map<string, typeof appCatalog>();
    for (const item of appCatalog) {
      const group = grouped.get(item.category) ?? [];
      group.push(item);
      grouped.set(item.category, group);
    }
    return Array.from(grouped.entries());
  }, []);

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

  const handleTestActiveProvider = async () => {
    const active = getActiveLlmConfig(form);
    if (!active.config.apiKey.trim()) {
      showToast("请先填写当前引擎的 API Key", "error");
      return;
    }

    setIsTestingLlm(true);
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: active.config.apiKey,
          baseUrl: active.config.baseUrl,
          model: active.config.model,
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
      const res = await fetch("/api/openclaw/test", {
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
                        模型库列表
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        为不同引擎分别保存 Key / Base URL / Model，并一键切换当前引擎。
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
              </section>
            )}

            {activeTab === "engine" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">引擎核心</div>
                  <div className="text-sm text-gray-500 mt-1">
                    配置本地 OpenClaw 引擎地址与 Token（自动保存）。
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    提示：如果你运行的是 openclaw-gateway，API 端口可能不是 8000（例如
                    18791）。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        OpenClaw 引擎连接
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        默认：{defaultSettings.openclaw.baseUrl}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        引擎地址
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Token
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
                          instagram: {
                            ...prev.matrixAccounts.instagram,
                            webhookUrl: local,
                          },
                          tiktok: {
                            ...prev.matrixAccounts.tiktok,
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

                    {appGroups.map(([category, items]) => (
                      <div key={category} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">
                          {getCategoryLabel(category as any)}
                        </div>
                        <div className="divide-y divide-gray-100">
                          {items.map((item) => {
                            const desktopEnabled = form.personalization.customDesktopApps.includes(item.id);
                            const dockEnabled = form.personalization.customDockApps.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="text-sm font-medium text-gray-900">
                                  {getAppDisplayName(
                                    item.id,
                                    item.id,
                                    form.personalization.interfaceLanguage,
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-700">
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={desktopEnabled}
                                      onChange={() => toggleDesktopApp(item.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Desktop
                                  </label>
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={dockEnabled}
                                      onChange={() => toggleDockApp(item.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Dock
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
