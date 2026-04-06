"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, FilePlus2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  createBrainDigest,
  createBrainNote,
  getBrainDigests,
  getBrainNotes,
  removeBrainNote,
  subscribeBrain,
  updateBrainNote,
  type BrainDigest,
  type BrainNote,
} from "@/lib/brain";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenKnowledgeVault } from "@/lib/ui-events";

function buildLocalDigest(notes: BrainNote[], focus: string) {
  const tagCounts = notes.flatMap((note) => note.tags).reduce<Record<string, number>>((acc, tag) => {
    acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag);

  return [
    "【Second Brain Digest】",
    `- 当前关注：${focus.trim() || "整理最近笔记，找出可复用模式。"}`,
    `- 笔记总数：${notes.length}`,
    topTags.length > 0 ? `- 高频标签：${topTags.join(" / ")}` : "- 高频标签：暂无。",
    "",
    "【重点线索】",
    ...(notes.slice(0, 5).map((note) => `- ${note.title}`) || ["- 还没有笔记。"]),
    "",
    "【建议整理】",
    "- 把重复出现的问题沉淀成模板或 SOP。",
    "- 将需要跟进的想法转成任务，避免只停留在记录层。",
    "- 将重要洞察写成草稿，便于后续发布或复盘。",
  ].join("\n");
}

export function SecondBrainAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [notes, setNotes] = useState<BrainNote[]>([]);
  const [digests, setDigests] = useState<BrainDigest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState("");
  const [digest, setDigest] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const nextNotes = getBrainNotes();
      setNotes(nextNotes);
      setDigests(getBrainDigests());
      setSelectedId((current) => current ?? nextNotes[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeBrain(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const patchSelected = (patch: Partial<Omit<BrainNote, "id" | "createdAt" | "updatedAt">>) => {
    if (!selected) return;
    updateBrainNote(selected.id, patch);
  };

  const createNewNote = () => {
    const id = createBrainNote();
    setSelectedId(id);
    showToast("已新增笔记", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeBrainNote(selected.id);
    setSelectedId(null);
    showToast("笔记已删除", "ok");
  };

  const synthesize = async () => {
    const recentNotes = getBrainNotes().slice(0, 10);
    const fallback = buildLocalDigest(recentNotes, focus);
    const taskId = createTask({
      name: "Assistant - Second brain digest",
      status: "running",
      detail: focus.trim().slice(0, 80) || "second-brain",
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Second Brain 助手。请把用户的笔记整理成中文洞察摘要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 提炼 3-5 个主题。\n" +
        "2) 指出其中哪些适合转成 SOP、任务或发布草稿。\n" +
        "3) 输出简洁，避免空话。\n\n" +
        `当前关注：${focus.trim() || "(未填写)"}\n` +
        `笔记列表：\n${
          recentNotes
            .map((note) => `- ${note.title} | tags: ${note.tags.join(", ") || "(无)"}\n${note.body.slice(0, 260)}`)
            .join("\n\n") || "(空)"
        }`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-second-brain",
        timeoutSeconds: 90,
      });
      const nextDigest = text || fallback;
      setDigest(nextDigest);
      createBrainDigest({ focus, content: nextDigest });
      updateTask(taskId, { status: "done" });
      showToast("洞察摘要已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setDigest(fallback);
      createBrainDigest({ focus, content: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地摘要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDigestDraft = () => {
    if (!digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    createDraft({
      title: "Second Brain Digest",
      body: digest,
      tags: ["second-brain", "digest"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToKnowledgeVault = () => {
    const content = digest.trim() || selected?.body.trim() || "";
    if (!content) {
      showToast("请先生成摘要或选择笔记", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query: `请基于以下洞察建议我应该沉淀哪些资料、模板或 SOP：\n${content}`,
    });
    showToast("已发送到知识库", "ok");
  };

  const sendToTaskManager = () => {
    const source = digest.trim() || selected?.body.trim() || selected?.title.trim() || "";
    if (!source) {
      showToast("请先生成摘要或选择笔记", "error");
      return;
    }
    const preview =
      source
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean) || "整理洞察并执行下一步";
    createTask({
      name: `Second Brain - ${selected?.title?.trim() || "Follow-up"}`,
      status: "queued",
      detail: preview.slice(0, 100),
    });
    requestOpenApp("task_manager");
    showToast("已发送到任务中心", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Second Brain"
      icon={Brain}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.second_brain"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Second Brain</div>
              <div className="mt-1 text-sm text-gray-500">
                对应高频的 Second Brain / Knowledge Capture 场景。用于收集碎片笔记，并自动提炼模式、主题和下一步动作。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                笔记 {notes.length} 条
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                摘要 {digests.length} 条
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">笔记列表</div>
                <button
                  type="button"
                  onClick={createNewNote}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {notes.length > 0 ? (
                  notes.map((note) => {
                    const active = note.id === selectedId;
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setSelectedId(note.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{note.title}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {note.tags.join(" / ") || "未打标签"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有笔记。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">最近摘要</div>
              <div className="mt-3 space-y-2">
                {digests.length > 0 ? (
                  digests.slice(0, 5).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        setFocus(record.focus);
                        setDigest(record.content);
                      }}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
                    >
                      <div className="text-xs font-semibold text-gray-900">
                        {new Date(record.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-2 line-clamp-3 text-xs text-gray-500">
                        {record.focus || "未填写关注点"}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有摘要记录。
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              {selected ? (
                <>
                  <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">笔记编辑</div>
                      <div className="mt-1 text-xs text-gray-500">记录想法、观察、会议摘录和需要沉淀的模式。</div>
                    </div>
                    <button
                      type="button"
                      onClick={deleteSelected}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">标题</label>
                      <input
                        value={selected.title}
                        onChange={(e) => patchSelected({ title: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">标签</label>
                      <input
                        value={selected.tags.join(", ")}
                        onChange={(e) =>
                          patchSelected({
                            tags: e.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="例如：创意, 客户, 产品, SOP"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">内容</label>
                      <textarea
                        value={selected.body}
                        onChange={(e) => patchSelected({ body: e.target.value })}
                        className="h-56 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条笔记。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold text-gray-600">本轮关注点</label>
                  <input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="例如：找出最近重复出现的客户问题和可以模板化的动作"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={synthesize}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "整理中..." : "生成洞察摘要"}
                  </button>
                  <button
                    type="button"
                    onClick={saveDigestDraft}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                  <button
                    type="button"
                    onClick={sendToKnowledgeVault}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    发送到知识库
                  </button>
                  <button
                    type="button"
                    onClick={sendToTaskManager}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    发送到任务中心
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {digest ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{digest}</pre>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现 Second Brain 摘要。
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
