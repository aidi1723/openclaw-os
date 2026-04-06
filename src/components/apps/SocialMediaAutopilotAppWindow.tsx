"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, MessageCircleMore, Plus, Send, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  createSocialAutopilotRecord,
  getSocialAutopilotRecords,
  removeSocialAutopilotRecord,
  subscribeSocialAutopilot,
  updateSocialAutopilotRecord,
  type SocialAutopilotRecord,
} from "@/lib/social-media-autopilot";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp } from "@/lib/ui-events";

function buildLocalOutputPack(item: SocialAutopilotRecord) {
  return [
    "【Platform Pack】",
    `- 主题：${item.title || "未填写"}`,
    `- 目标受众：${item.audience || "未填写"}`,
    `- 渠道：${item.channels || "未填写"}`,
    `- 目标：${item.objective || "未填写"}`,
    "",
    "【Post Variants】",
    "- 小红书 / Instagram：先给一个强钩子，再给 3 个简短要点。",
    "- 抖音 / TikTok：用一句强开头 + 3 段节奏化口播。",
    "- X / LinkedIn：压成一条主观点 + 1 个行动 CTA。",
    "",
    "【Publishing Notes】",
    `- 排期备注：${item.scheduleNotes || "先按平台优先级排一轮。"} `,
    "- 优先选 2 个平台先发布，再看反馈决定是否扩散。",
    "",
    "【Reply Queue】",
    `- 评论上下文：${item.commentsContext || "未填写"}`,
    "- 准备 3 条标准回复：解释型、互动型、转化型。",
  ].join("\n");
}

export function SocialMediaAutopilotAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [records, setRecords] = useState<SocialAutopilotRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getSocialAutopilotRecords();
      setRecords(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeSocialAutopilot(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => records.find((item) => item.id === selectedId) ?? null,
    [records, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<SocialAutopilotRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateSocialAutopilotRecord(selected.id, patch);
  };

  const createNew = () => {
    const id = createSocialAutopilotRecord();
    setSelectedId(id);
    showToast("已新增社媒任务", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeSocialAutopilotRecord(selected.id);
    setSelectedId(null);
    showToast("社媒任务已删除", "ok");
  };

  const generateOutputPack = async () => {
    if (!selected) {
      showToast("请先选择任务", "error");
      return;
    }
    if (!selected.sourceContent.trim()) {
      showToast("请先填写源内容", "error");
      return;
    }

    const fallback = buildLocalOutputPack(selected);
    const taskId = createTask({
      name: "Assistant - Social autopilot",
      status: "running",
      detail: selected.title.slice(0, 80),
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Social Media Auto-pilot 助手。请将用户提供的源内容整理成跨平台社媒输出包。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含以下标题：\n" +
        "【Platform Pack】\n【Post Variants】\n【Publishing Notes】\n【Reply Queue】\n" +
        "要求：\n" +
        "1) 覆盖多个平台的改写版本。\n" +
        "2) 给出简短排期建议。\n" +
        "3) 给出评论回复建议，不要空话。\n\n" +
        `主题：${selected.title}\n` +
        `目标受众：${selected.audience || "(未填)"}\n` +
        `渠道：${selected.channels || "(未填)"}\n` +
        `目标：${selected.objective || "(未填)"}\n` +
        `排期备注：${selected.scheduleNotes || "(未填)"}\n` +
        `评论上下文：${selected.commentsContext || "(未填)"}\n` +
        `源内容：\n${selected.sourceContent}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-social-media-autopilot",
        timeoutSeconds: 120,
      });
      patchSelected({ outputPack: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("社媒输出包已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ outputPack: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地输出包", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!selected?.outputPack.trim()) {
      showToast("请先生成输出包", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Social"} Pack`,
      body: selected.outputPack,
      tags: ["social", "autopilot"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToPublisher = () => {
    if (!selected?.outputPack.trim()) {
      showToast("请先生成输出包", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Social"} Publish Pack`,
      body: selected.outputPack,
      tags: ["social", "publish-ready"],
      source: "import",
    });
    requestOpenApp("publisher");
    showToast("已存草稿并打开发布中心", "ok");
  };

  const openSupportCopilot = () => {
    requestOpenApp("support_copilot");
    showToast("已打开 Support Copilot", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Social Media Auto-pilot"
      icon={Send}
      widthClassName="w-[1200px]"
      storageKey="openclaw.window.social_media_autopilot"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Social Media Auto-pilot</div>
              <div className="mt-1 text-sm text-gray-500">
                对应多平台社媒场景：改写内容、整理发布备注，并准备评论回复建议。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              任务 {records.length} 条
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">任务列表</div>
                <button
                  type="button"
                  onClick={createNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {records.length > 0 ? (
                  records.map((item) => {
                    const isActive = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-colors",
                          isActive
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className={["mt-1 text-xs", isActive ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {item.channels || "未填写渠道"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有社媒任务。
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            {selected ? (
              <>
                <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">主题</span>
                      <input
                        value={selected.title}
                        onChange={(event) => patchSelected({ title: event.target.value })}
                        placeholder="如：新品功能上线"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">目标受众</span>
                      <input
                        value={selected.audience}
                        onChange={(event) => patchSelected({ audience: event.target.value })}
                        placeholder="如：创作者 / SaaS 用户 / 电商客户"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">渠道</span>
                      <input
                        value={selected.channels}
                        onChange={(event) => patchSelected({ channels: event.target.value })}
                        placeholder="如：X / LinkedIn / 小红书 / 抖音"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">目标</span>
                      <input
                        value={selected.objective}
                        onChange={(event) => patchSelected({ objective: event.target.value })}
                        placeholder="如：转化 / 曝光 / 预约 / 讨论"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">源内容</span>
                    <textarea
                      value={selected.sourceContent}
                      onChange={(event) => patchSelected({ sourceContent: event.target.value })}
                      placeholder="粘贴主稿、产品更新、长文、脚本或一段核心信息。"
                      rows={8}
                      className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                    />
                  </label>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">排期备注</span>
                      <textarea
                        value={selected.scheduleNotes}
                        onChange={(event) => patchSelected({ scheduleNotes: event.target.value })}
                        placeholder="如：先发 X，再发 LinkedIn，第二天补短视频。"
                        rows={4}
                        className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">评论上下文</span>
                      <textarea
                        value={selected.commentsContext}
                        onChange={(event) => patchSelected({ commentsContext: event.target.value })}
                        placeholder="如：用户会问价格、上线时间、如何使用。"
                        rows={4}
                        className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateOutputPack}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {isGenerating ? "生成中..." : "生成社媒输出包"}
                    </button>
                    <button
                      type="button"
                      onClick={saveDraft}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      <FilePlus2 className="h-4 w-4" />
                      写入草稿
                    </button>
                    <button
                      type="button"
                      onClick={sendToPublisher}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      <Send className="h-4 w-4" />
                      打开发布中心
                    </button>
                    <button
                      type="button"
                      onClick={openSupportCopilot}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      <MessageCircleMore className="h-4 w-4" />
                      打开回复助手
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelected}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
                  <div className="text-sm font-semibold text-gray-900">输出包</div>
                  <pre className="mt-3 min-h-[300px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                    {selected.outputPack || "填写源内容后生成跨平台输出包。"}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                先新建一条社媒任务。
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
