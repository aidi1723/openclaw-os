"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Shield,
  TerminalSquare,
} from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { UnifiedAssetConsole } from "@/components/workflows/UnifiedAssetConsole";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useRuntimeDoctorReport } from "@/hooks/useRuntimeDoctorReport";
import { useServerBackedSyncStatuses } from "@/hooks/useServerBackedSyncStatuses";
import { useRuntimeSidecar } from "@/hooks/useRuntimeSidecar";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { jumpToAssetTarget } from "@/lib/asset-jumps";
import {
  getDesktopRuntimeStatusSummary,
  getRuntimeBridgeConfig,
} from "@/lib/desktop-runtime";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import { loadSettings, type AppSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenSettings } from "@/lib/ui-events";

const DEFAULT_BASE = "http://127.0.0.1:18789";
const DEFAULT_SESSION = "agent:main:main";

type ExecutorSessionSummary = {
  id: string;
  title: string;
  updatedAt: number;
  lastEngine: string;
  lastStatus: "ok" | "error";
  lastMessage: string;
  lastOutputPreview: string;
  turns: Array<{ id: string }>;
};

type ExecutorSessionTurn = {
  id: string;
  createdAt: number;
  durationMs: number;
  source: string;
  engine: string;
  ok: boolean;
  message: string;
  systemPrompt: string;
  useSkills: boolean;
  workspaceContext: Record<string, string | number | boolean>;
  llmProvider: string;
  llmModel: string;
  timeoutSeconds: number;
  outputText?: string;
  error?: string;
};

type ExecutorSessionDetail = Omit<ExecutorSessionSummary, "turns"> & {
  turns: ExecutorSessionTurn[];
};

function safeUrl(base: string, path: string) {
  const trimmed = base.trim().replace(/\/+$/, "") || DEFAULT_BASE;
  return `${trimmed}${path}`;
}

export function OpenClawConsoleAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>("zh-CN");
  const [healthText, setHealthText] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [executorSessions, setExecutorSessions] = useState<ExecutorSessionSummary[]>([]);
  const [executorSessionsLoading, setExecutorSessionsLoading] = useState(false);
  const [executorSessionsError, setExecutorSessionsError] = useState("");
  const [selectedExecutorSessionId, setSelectedExecutorSessionId] = useState("");
  const [selectedExecutorSession, setSelectedExecutorSession] =
    useState<ExecutorSessionDetail | null>(null);
  const [selectedExecutorSessionLoading, setSelectedExecutorSessionLoading] = useState(false);
  const [selectedExecutorSessionError, setSelectedExecutorSessionError] = useState("");
  const executorSessionRequestRef = useRef(0);
  const selectedExecutorSessionIdRef = useRef("");
  const { toast, showToast } = useTimedToast(2000);
  const isVisible = state === "open" || state === "opening";
  const {
    report: runtimeDoctor,
    loading: runtimeDoctorLoading,
    error: runtimeDoctorError,
    refresh: refreshRuntimeDoctor,
  } = useRuntimeDoctorReport(isVisible);
  const syncStatuses = useServerBackedSyncStatuses(isVisible);

  useEffect(() => {
    if (!isVisible) return;
    const syncFromSettings = () => {
      const settings = loadSettings();
      const configured = settings.openclaw.baseUrl.trim();
      setSettings(settings);
      setBaseUrl(configured || DEFAULT_BASE);
      setInterfaceLanguage(settings.personalization.interfaceLanguage);
    };
    syncFromSettings();
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, syncFromSettings);
    window.addEventListener("storage", syncFromSettings);
    return () => {
      removeSettingsListener();
      window.removeEventListener("storage", syncFromSettings);
    };
  }, [isVisible]);

  useEffect(() => {
    selectedExecutorSessionIdRef.current = selectedExecutorSessionId;
  }, [selectedExecutorSessionId]);

  const refreshExecutorSessionDetail = useCallback(async (sessionId: string) => {
    const normalizedId = sessionId.trim();
    if (!normalizedId) {
      setSelectedExecutorSession(null);
      setSelectedExecutorSessionError("");
      setSelectedExecutorSessionId("");
      return;
    }

    const requestId = ++executorSessionRequestRef.current;
    setSelectedExecutorSessionId(normalizedId);
    setSelectedExecutorSessionLoading(true);
    setSelectedExecutorSessionError("");
    try {
      const res = await fetch(
        buildAgentCoreApiUrl(
          `/api/runtime/executor/sessions/${encodeURIComponent(normalizedId)}`,
        ),
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; data?: { session?: ExecutorSessionDetail }; error?: string };
      const session = data?.data?.session ?? null;
      if (executorSessionRequestRef.current !== requestId) return;
      if (!res.ok || !data?.ok || !session) {
        setSelectedExecutorSession(null);
        setSelectedExecutorSessionError(data?.error || "无法加载执行器会话详情");
        return;
      }
      setSelectedExecutorSession(session);
    } catch (error) {
      if (executorSessionRequestRef.current !== requestId) return;
      setSelectedExecutorSession(null);
      setSelectedExecutorSessionError(error instanceof Error ? error.message : "请求异常");
    } finally {
      if (executorSessionRequestRef.current === requestId) {
        setSelectedExecutorSessionLoading(false);
      }
    }
  }, []);

  const refreshExecutorSessions = useCallback(async () => {
    setExecutorSessionsLoading(true);
    setExecutorSessionsError("");
    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/runtime/executor/sessions"), {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; data?: { sessions?: ExecutorSessionSummary[] }; error?: string };
      const sessions = Array.isArray(data?.data?.sessions) ? data.data.sessions : null;
      if (!res.ok || !data?.ok || !sessions) {
        setExecutorSessions([]);
        setExecutorSessionsError(data?.error || "无法加载执行器历史");
        setSelectedExecutorSession(null);
        setSelectedExecutorSessionId("");
        setSelectedExecutorSessionError("");
        return;
      }
      const nextSessions = sessions.slice(0, 8);
      setExecutorSessions(nextSessions);
      const nextSelectedId =
        nextSessions.find((session) => session.id === selectedExecutorSessionIdRef.current)?.id ??
        nextSessions[0]?.id ??
        "";
      if (!nextSelectedId) {
        setSelectedExecutorSession(null);
        setSelectedExecutorSessionId("");
        setSelectedExecutorSessionError("");
        return;
      }
      void refreshExecutorSessionDetail(nextSelectedId);
    } catch (error) {
      setExecutorSessions([]);
      setExecutorSessionsError(error instanceof Error ? error.message : "请求异常");
      setSelectedExecutorSession(null);
      setSelectedExecutorSessionId("");
    } finally {
      setExecutorSessionsLoading(false);
    }
  }, [refreshExecutorSessionDetail]);

  useEffect(() => {
    if (!isVisible) return;
    void refreshExecutorSessions();
  }, [isVisible, refreshExecutorSessions]);

  const dashboardUrl = useMemo(() => safeUrl(baseUrl, "/"), [baseUrl]);
  const chatUrl = useMemo(
    () => safeUrl(baseUrl, `/chat?session=${encodeURIComponent(session.trim() || DEFAULT_SESSION)}`),
    [baseUrl, session],
  );
  const runtimeSummary = useMemo(
    () => getDesktopRuntimeStatusSummary(settings, runtimeDoctor),
    [settings, runtimeDoctor],
  );
  const runtimeBridgeConfig = useMemo(() => getRuntimeBridgeConfig(settings), [settings]);
  const {
    status: sidecarStatus,
    loading: sidecarLoading,
    actionLoading: sidecarActionLoading,
    error: sidecarError,
    refresh: refreshSidecarStatus,
    sync: syncSidecarConfig,
    boot: bootSidecar,
    stop: stopSidecar,
  } = useRuntimeSidecar(runtimeBridgeConfig, isVisible);

  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制链接", "ok");
    } catch {
      showToast("复制失败（浏览器权限）", "error");
    }
  };

  const checkHealth = async () => {
    setIsChecking(true);
    setHealthText("");
    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/runtime/gateway/health"), {
        method: "GET",
      });
      const data = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; health?: unknown; error?: string };
      if (!res.ok || !data?.ok) {
        const err = data?.error || "检查失败";
        setHealthText(err);
        showToast(err, "error");
        return;
      }
      setHealthText(JSON.stringify(data.health ?? {}, null, 2));
      showToast("Gateway 正常", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求异常";
      setHealthText(message);
      showToast(message, "error");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSyncRuntimeBridge = async () => {
    const result = await syncSidecarConfig();
    showToast(result.message, result.ok ? "ok" : "error");
    refreshSidecarStatus();
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

  const totalPendingSyncs = useMemo(
    () => syncStatuses.reduce((sum, status) => sum + status.pendingCount, 0),
    [syncStatuses],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="运行时控制台"
      icon={TerminalSquare}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.openclaw_console"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative space-y-5 bg-white p-4 sm:p-6">
        <AppToast toast={toast} />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900">安全融合模式（推荐）</div>
            <div className="text-sm text-gray-500 mt-1">
              本窗口只提供深度链接与健康检查；不会在 WebOS 内嵌 OpenClaw 页面，避免 CSP/Token 风险。
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              <Shield className="h-4 w-4 text-emerald-600" />
              Token 不下发到前端
            </div>
            <button
              type="button"
              onClick={() => requestOpenSettings("engine")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
            >
              打开设置
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_52%,#eef6ff_100%)] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                <Boxes className="h-3.5 w-3.5" />
                Desktop Runtime Center
              </div>
              <div className="mt-3 text-lg font-semibold text-gray-900">
                {runtimeSummary.profileMeta.title}
              </div>
              <div className="mt-2 text-sm leading-6 text-gray-600">
                {runtimeSummary.profileMeta.desc}
              </div>
            </div>
            <button
              type="button"
              onClick={() => requestOpenSettings("engine")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
            >
              打开运行时设置
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">LLM</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">API Only</div>
              <div className="mt-1 text-xs text-gray-500">
                {runtimeSummary.providerConfigured ? "Provider configured" : "Provider key missing"}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Shell</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {runtimeSummary.shell === "tauri" ? "Tauri Desktop" : "Browser / Web Shell"}
              </div>
              <div className="mt-1 text-xs text-gray-500">桌面版上线后这里会切到 Tauri</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Orchestration</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {runtimeSummary.orchestrationMeta.title}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {runtimeSummary.orchestrationMeta.desc}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Runtime</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {runtimeSummary.initializationComplete ? "Ready" : "Needs setup"}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Local runtime and sidecar addresses can be tuned in settings.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Initialization status</div>
                <div className="mt-2 text-sm leading-6 text-gray-500">
                  当前桌面运行时的可用性，统一按运行模式、云端模型和本地 sidecar 诊断结果判断。
                </div>
              </div>
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
                  runtimeSummary.initializationComplete
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700",
                ].join(" ")}
              >
                {runtimeSummary.initializationComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {runtimeSummary.completedSteps}/{runtimeSummary.totalSteps} ready
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {runtimeSummary.checklist.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
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
                  <div className="mt-2 text-xs leading-5 text-gray-500">{item.detail}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestOpenSettings("llm")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                配置 API Key
              </button>
              <button
                type="button"
                onClick={() => requestOpenSettings("engine")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                调整运行时
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f8fafc_100%)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Runtime diagnostics</div>
                <div className="mt-2 text-xs leading-5 text-gray-500">
                  诊断 API 会检测新机安装测试所需的关键条件，包括本地存储、ffmpeg 和 Docker。
                </div>
              </div>
              <button
                type="button"
                onClick={refreshRuntimeDoctor}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                <RefreshCw
                  className={["h-3.5 w-3.5", runtimeDoctorLoading ? "animate-spin" : ""].join(" ")}
                />
                {runtimeDoctorLoading ? "检测中" : "刷新"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
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
                    {item.check?.ok ? "Ready" : runtimeDoctorLoading ? "Checking" : "Missing"}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
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
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
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
                  : "Diagnostics have not finished yet."}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Runtime bridge</div>
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
                服务端负责保存当前 runtime 配置，并在需要时静默执行 compose 启停。
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSyncRuntimeBridge}
                  disabled={sidecarActionLoading !== null}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sidecarActionLoading === "sync" ? "同步中..." : "同步配置"}
                </button>
                <button
                  type="button"
                  onClick={handleBootRuntimeSidecar}
                  disabled={
                    sidecarActionLoading !== null || settings.runtime.profile !== "desktop_dify"
                  }
                  className="rounded-xl border border-gray-900 bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sidecarActionLoading === "boot" ? "启动中..." : "启动 sidecar"}
                </button>
                <button
                  type="button"
                  onClick={handleStopRuntimeSidecar}
                  disabled={
                    sidecarActionLoading !== null || settings.runtime.profile !== "desktop_dify"
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
                    : "Sync the runtime bridge before the desktop shell starts managing local services."}
              </div>
            </div>
          </div>
        </div>

        <UnifiedAssetConsole
          language={interfaceLanguage}
          onOpenAsset={(target) => jumpToAssetTarget(target)}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">核心状态同步</div>
              <div className="mt-2 text-xs leading-5 text-gray-500">
                这里显示销售、客服、工作流三条核心状态链路的本地同步情况，便于判断是否有待重试任务积压。
              </div>
            </div>
            <div
              className={[
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                totalPendingSyncs > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {totalPendingSyncs > 0 ? `${totalPendingSyncs} pending` : "All synced"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {syncStatuses.length > 0 ? (
              syncStatuses.map((status) => (
                <div
                  key={status.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">{status.label}</div>
                    <div
                      className={[
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        status.phase === "idle"
                          ? "bg-emerald-100 text-emerald-700"
                          : status.phase === "syncing"
                            ? "bg-blue-100 text-blue-700"
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

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-gray-500">
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
                      <span className="font-semibold text-gray-900">下次重试：</span>
                      {status.nextRetryAt
                        ? new Date(status.nextRetryAt).toLocaleTimeString()
                        : "无"}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-white px-3 py-3 text-xs leading-6 text-gray-600">
                    {status.lastError ? (
                      <>
                        <span className="font-semibold text-rose-700">最近异常：</span>
                        {status.lastError}
                      </>
                    ) : status.pendingCount > 0 ? (
                      "当前有待重试同步任务，恢复网络或重新聚焦窗口后会继续补发。"
                    ) : (
                      "当前这条链路没有待同步积压。"
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-xs leading-6 text-gray-500 lg:col-span-3">
                核心状态同步诊断尚未激活。打开销售、客服或工作流相关页面后，这里会开始显示同步状态。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">执行器历史</div>
              <div className="mt-2 text-xs leading-5 text-gray-500">
                这里展示 AgentCore OS 服务端记录的最近执行会话，便于审计、复盘和问题定位。
              </div>
            </div>
            <button
              type="button"
              onClick={refreshExecutorSessions}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
            >
              <RefreshCw
                className={[
                  "h-3.5 w-3.5",
                  executorSessionsLoading ? "animate-spin" : "",
                ].join(" ")}
              />
              {executorSessionsLoading ? "刷新中" : "刷新"}
            </button>
          </div>

          {executorSessionsError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-6 text-rose-700">
              {executorSessionsError}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.85fr)]">
            <div className="space-y-3">
              {executorSessions.length > 0 ? (
                executorSessions.map((sessionItem) => (
                  <button
                    key={sessionItem.id}
                    type="button"
                    onClick={() => void refreshExecutorSessionDetail(sessionItem.id)}
                    className={[
                      "block w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                      sessionItem.id === selectedExecutorSessionId
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">
                          {sessionItem.title || "未命名执行"}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                          {sessionItem.lastEngine}
                        </div>
                      </div>
                      <div
                        className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                          sessionItem.lastStatus === "ok"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700",
                        ].join(" ")}
                      >
                        {sessionItem.lastStatus === "ok" ? "OK" : "Error"}
                      </div>
                    </div>

                    <div className="mt-3 text-xs leading-5 text-gray-600">
                      <span className="font-semibold text-gray-900">最近输入：</span>
                      {sessionItem.lastMessage || "（无）"}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-gray-600">
                      <span className="font-semibold text-gray-900">最近输出：</span>
                      {sessionItem.lastOutputPreview || "（无输出摘要）"}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-500">
                      <div>{new Date(sessionItem.updatedAt).toLocaleString()}</div>
                      <div>{sessionItem.turns.length} turns</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-xs leading-6 text-gray-500">
                  {executorSessionsLoading
                    ? "正在加载最近执行记录..."
                    : "最近还没有服务端执行记录。执行几次主助手任务后，这里会开始沉淀历史。"}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">会话明细</div>
                  <div className="mt-1 text-[11px] leading-5 text-gray-500">
                    查看每轮输入、输出、模型、上下文与耗时。
                  </div>
                </div>
                {selectedExecutorSessionLoading ? (
                  <div className="text-[11px] text-gray-500">加载中...</div>
                ) : null}
              </div>

              {selectedExecutorSessionError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-6 text-rose-700">
                  {selectedExecutorSessionError}
                </div>
              ) : null}

              {selectedExecutorSession ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedExecutorSession.title || "未命名执行"}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-gray-500">
                      <div>
                        <span className="font-semibold text-gray-900">会话 ID：</span>
                        {selectedExecutorSession.id}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">最近引擎：</span>
                        {selectedExecutorSession.lastEngine}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">状态：</span>
                        {selectedExecutorSession.lastStatus === "ok" ? "OK" : "Error"}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">更新时间：</span>
                        {new Date(selectedExecutorSession.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedExecutorSession.turns
                      .slice()
                      .reverse()
                      .map((turn, index) => {
                        const workspaceEntries = Object.entries(turn.workspaceContext ?? {});
                        return (
                          <div
                            key={turn.id}
                            className="rounded-2xl border border-white/80 bg-white px-4 py-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900">
                                第 {selectedExecutorSession.turns.length - index} 轮
                              </div>
                              <div
                                className={[
                                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                  turn.ok
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700",
                                ].join(" ")}
                              >
                                {turn.ok ? "OK" : "Error"}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-gray-500">
                              <div>
                                <span className="font-semibold text-gray-900">时间：</span>
                                {new Date(turn.createdAt).toLocaleString()}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900">耗时：</span>
                                {turn.durationMs} ms
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900">来源：</span>
                                {turn.source}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900">引擎：</span>
                                {turn.engine}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900">模型：</span>
                                {[turn.llmProvider, turn.llmModel].filter(Boolean).join(" / ") ||
                                  "未记录"}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900">技能：</span>
                                {turn.useSkills ? "启用" : "关闭"}
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                输入
                              </div>
                              <div className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-700">
                                {turn.message || "（无）"}
                              </div>
                            </div>

                            {turn.systemPrompt ? (
                              <div className="mt-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                  System Prompt
                                </div>
                                <div className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-700">
                                  {turn.systemPrompt}
                                </div>
                              </div>
                            ) : null}

                            {workspaceEntries.length > 0 ? (
                              <div className="mt-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                  Workspace Context
                                </div>
                                <div className="mt-1 rounded-xl bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-700">
                                  {workspaceEntries.map(([key, value]) => (
                                    <div key={key}>
                                      <span className="font-semibold text-gray-900">{key}:</span>{" "}
                                      {String(value)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                输出
                              </div>
                              <div className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-700">
                                {turn.outputText || turn.error || "（无输出）"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-xs leading-6 text-gray-500">
                  {executorSessionsLoading
                    ? "正在同步执行器明细..."
                    : "选中左侧任意一条执行会话后，这里会显示完整追踪信息。"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 lg:col-span-2">
            <div className="text-sm font-semibold text-gray-900">控制台链接</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Runtime Base URL
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={DEFAULT_BASE}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 text-xs text-gray-500">
                  通常会跟随“设置 → 引擎核心”里的地址；默认使用 {DEFAULT_BASE}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chat Session
                </label>
                <input
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder={DEFAULT_SESSION}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 text-xs text-gray-500">
                  示例：{DEFAULT_SESSION}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => open(dashboardUrl)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                打开控制台
              </button>
              <button
                type="button"
                onClick={() => open(chatUrl)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                打开 Chat 会话
              </button>
              <button
                type="button"
                onClick={() => copy(chatUrl)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                复制 Chat 链接
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
              <div className="font-semibold text-gray-900 mb-2">建议用法</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>在 WebOS 里用 Spotlight / 各 App 发起任务；在 TaskManager 里查看状态。</li>
                <li>需要更深的调试或查看会话时，用上面的链接打开运行时控制台。</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-900">Gateway 健康检查</div>
              <button
                type="button"
                onClick={checkHealth}
                disabled={isChecking}
                className="px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isChecking ? "检查中..." : "检查"}
              </button>
            </div>

            <div className="text-xs text-gray-500">
              该检查通过服务端执行 <span className="font-semibold">openclaw gateway call health</span>，
              不会把 Token 暴露到浏览器。
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 min-h-[240px]">
              {healthText ? (
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800">
                  {healthText}
                </pre>
              ) : (
                <div className="text-xs text-gray-500">
                  点击“检查”查看 Gateway health 输出。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
