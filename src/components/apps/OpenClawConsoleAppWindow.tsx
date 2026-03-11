"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Shield, TerminalSquare } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { UnifiedAssetConsole } from "@/components/workflows/UnifiedAssetConsole";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { jumpToAssetTarget } from "@/lib/asset-jumps";
import { loadSettings } from "@/lib/settings";
import { requestOpenSettings } from "@/lib/ui-events";

const DEFAULT_BASE = "http://127.0.0.1:18789";
const DEFAULT_SESSION = "agent:main:main";

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
  const [healthText, setHealthText] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const { toast, showToast } = useTimedToast(2000);
  const isVisible = state === "open" || state === "opening";

  useEffect(() => {
    if (!isVisible) return;
    const syncFromSettings = () => {
      const configured = loadSettings().openclaw.baseUrl.trim();
      setBaseUrl(configured || DEFAULT_BASE);
    };
    syncFromSettings();
    window.addEventListener("openclaw:settings", syncFromSettings);
    window.addEventListener("storage", syncFromSettings);
    return () => {
      window.removeEventListener("openclaw:settings", syncFromSettings);
      window.removeEventListener("storage", syncFromSettings);
    };
  }, [isVisible]);

  const dashboardUrl = useMemo(() => safeUrl(baseUrl, "/"), [baseUrl]);
  const chatUrl = useMemo(
    () => safeUrl(baseUrl, `/chat?session=${encodeURIComponent(session.trim() || DEFAULT_SESSION)}`),
    [baseUrl, session],
  );

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
      const res = await fetch("/api/openclaw/gateway/health", { method: "GET" });
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

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="OpenClaw 控制台"
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

        <UnifiedAssetConsole
          language={loadSettings().personalization.interfaceLanguage}
          onOpenAsset={(target) => jumpToAssetTarget(target)}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 lg:col-span-2">
            <div className="text-sm font-semibold text-gray-900">控制台链接</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OpenClaw Base URL
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
                <li>需要更深的调试/查看会话时，用上面的链接打开 OpenClaw 控制台。</li>
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
