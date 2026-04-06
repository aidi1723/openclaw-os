"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { getOutputLanguageInstruction } from "@/lib/language";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";
import { createDraft } from "@/lib/drafts";

type Platform = "xiaohongshu" | "wechat" | "shortvideo";

const platformOptions: Array<{ value: Platform; label: string }> = [
  { value: "xiaohongshu", label: "小红书风格" },
  { value: "wechat", label: "微信公众号风格" },
  { value: "shortvideo", label: "短视频脚本" },
];

const systemPromptByPlatform: Record<Platform, string> = {
  xiaohongshu:
    "你是内容写作助手。请生成适合小红书发布的内容：大量使用 Emoji，排版有空行，标题和开头要抓人；输出包含：标题（1-3 个备选）、正文、标签（# 话题），整体可直接发布。",
  wechat:
    "你是写作助手。请生成适合公众号发布的文章：结构清晰、适合深度阅读；输出包含：标题、摘要、正文（分级小标题）、结论与行动建议。",
  shortvideo:
    "你是脚本生成助手。请输出节奏快、口语化的短视频脚本，包含：开场 3 秒钩子、镜头/画面提示、口播文案、字幕要点、结尾关注引导。",
};

export function MediaOpsAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [platform, setPlatform] = useState<Platform>("xiaohongshu");
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const { toast, showToast } = useTimedToast(2000);
  const taskIdRef = useRef<TaskId | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      if (abortRef.current) abortRef.current.abort();
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const flushPending = () => {
    if (!mountedRef.current) {
      pendingRef.current = "";
      rafRef.current = null;
      return;
    }
    if (!pendingRef.current) {
      rafRef.current = null;
      return;
    }
    const chunk = pendingRef.current;
    pendingRef.current = "";
    setResult((prev) => prev + chunk);
    rafRef.current = null;
  };

  const appendStreamingText = (text: string, runId: number) => {
    if (runId !== runIdRef.current || !mountedRef.current) return;
    if (!text) return;
    pendingRef.current += text;
    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(flushPending);
    }
  };

  const resetStreamBuffer = () => {
    pendingRef.current = "";
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const typewriter = async (text: string, runId: number) => {
    const full = text ?? "";
    resetStreamBuffer();
    if (runId !== runIdRef.current || !mountedRef.current) return;
    setResult("");
    const chunkSize = 6;
    for (let i = 0; i < full.length; i += chunkSize) {
      if (runId !== runIdRef.current || !mountedRef.current) return;
      appendStreamingText(full.slice(i, i + chunkSize), runId);
      await new Promise((r) => window.setTimeout(r, 18));
    }
    if (runId !== runIdRef.current || !mountedRef.current) return;
    flushPending();
  };

  const handleGenerate = async () => {
    if (!content.trim()) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    const settings = loadSettings();
    const active = getActiveLlmConfig(settings);
    const apiKey = active.config.apiKey.trim();
    const baseUrl = active.config.baseUrl.trim();
    const model = active.config.model.trim();
    const hasDirectLlm = Boolean(apiKey && baseUrl && model);

    taskIdRef.current = createTask({
      name: "Assistant - Generate copy",
      status: "running",
      detail: platformOptions.find((p) => p.value === platform)?.label ?? platform,
    });

    if (!hasDirectLlm) {
      showToast("请先在『设置』中填入 Kimi API Key", "error");
    }

    resetStreamBuffer();
    setIsGenerating(true);
    setResult("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const openclawRes = await fetch(buildAgentCoreApiUrl("/api/agent/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: platform,
          topic: content,
          llm: {
            provider: active.id,
            apiKey,
            baseUrl,
            model,
          },
        }),
      });
      const openclawData = (await openclawRes.json().catch(() => null)) as
        | null
        | { ok?: boolean; text?: string; error?: string };
      if (openclawRes.ok && openclawData?.ok) {
        await typewriter(String(openclawData.text ?? ""), runId);
        if (runId !== runIdRef.current || !mountedRef.current) return;
        showToast("生成完成（Kimi）", "ok");
        if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
        return;
      }

      if (hasDirectLlm) {
        resetStreamBuffer();
        const systemPrompt = `${systemPromptByPlatform[platform]}\n${getOutputLanguageInstruction()}`;
        const res = await fetch(buildAgentCoreApiUrl("/api/llm/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            baseUrl,
            model,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content },
            ],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (runId !== runIdRef.current || !mountedRef.current) return;
          showToast("生成失败，请检查网络或配置", "error");
          setResult(text || "生成失败，请检查网络或配置。");
          if (taskIdRef.current) updateTask(taskIdRef.current, { status: "error" });
          return;
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("text/event-stream") || !res.body) {
          const json = (await res.json().catch(() => null)) as any;
          const fullText =
            json?.choices?.[0]?.message?.content ??
            json?.choices?.[0]?.text ??
            "";
          if (runId !== runIdRef.current || !mountedRef.current) return;
          setResult(String(fullText || ""));
          showToast("生成完成", "ok");
          if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") {
              done = true;
              break;
            }

            try {
              const json = JSON.parse(payload) as any;
              const delta = json?.choices?.[0]?.delta?.content ?? "";
              appendStreamingText(String(delta), runId);
            } catch {
              // ignore malformed chunks
            }
          }
        }

        if (runId !== runIdRef.current || !mountedRef.current) return;
        flushPending();
        showToast("生成完成", "ok");
        if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
        return;
      }

      // 3) Last resort: local template generator (pure WebOS)
      const fallback = await fetch(buildAgentCoreApiUrl("/api/copy/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: platform, topic: content }),
      });
      const fallbackData = (await fallback.json().catch(() => null)) as
        | null
        | { ok?: boolean; error?: string; text?: string };
      if (!fallback.ok || !fallbackData?.ok) {
        const error = openclawData?.error || fallbackData?.error || "生成失败，请检查 Kimi 配置";
        if (runId !== runIdRef.current || !mountedRef.current) return;
        setResult(error);
        showToast("生成失败", "error");
        if (taskIdRef.current) updateTask(taskIdRef.current, { status: "error", detail: error });
        return;
      }
      await typewriter(String(fallbackData.text ?? ""), runId);
      if (runId !== runIdRef.current || !mountedRef.current) return;
      showToast("已生成（本地模板）", "ok");
      if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (runId !== runIdRef.current || !mountedRef.current) return;
      showToast("生成失败，请检查网络或配置", "error");
      setResult("生成失败，请检查网络或配置。");
      if (taskIdRef.current) {
        updateTask(taskIdRef.current, { status: "error", detail: "生成失败" });
      }
    } finally {
      if (runId === runIdRef.current && mountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="AI 文案"
      icon={FileText}
      storageKey="openclaw.window.media_ops"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative space-y-5 bg-white p-6">
        <AppToast toast={toast} />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            选择风格
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {platformOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            输入卖点/话题
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入今天想写的产品卖点或话题..."
            className="h-28 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!content.trim() || isGenerating}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-semibold text-white transition-all hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "生成中..." : "🚀 一键生成文案"}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!result.trim()}
            onClick={() => {
              const title =
                platformOptions.find((p) => p.value === platform)?.label ?? platform;
              createDraft({
                title: `${title} · ${content.trim().slice(0, 18) || "草稿"}`,
                body: result,
                tags: [platform],
                source: "media_ops",
              });
              showToast("已保存到内容库", "ok");
            }}
            className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            保存到内容库
          </button>
          <button
            type="button"
            disabled={!result.trim()}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result);
                showToast("已复制到剪贴板", "ok");
              } catch {
                showToast("复制失败（浏览器权限）", "error");
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => {
              setResult("");
              showToast("已清空结果", "ok");
            }}
            className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            清空
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            生成结果
          </label>
          <textarea
            readOnly
            value={result}
            placeholder="AI 生成的内容将在这里显示..."
            className="h-40 w-full resize-none whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:outline-none"
          />
        </div>
      </div>
    </AppWindowShell>
  );
}
