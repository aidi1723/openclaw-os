"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, FilePlus2, Languages, Plus, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createLanguageLearningRecord,
  getLanguageLearningRecords,
  removeLanguageLearningRecord,
  subscribeLanguageLearning,
  updateLanguageLearningRecord,
  type LanguageLearningLevel,
  type LanguageLearningRecord,
} from "@/lib/language-learning";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenKnowledgeVault } from "@/lib/ui-events";

const levelOptions: Array<{ id: LanguageLearningLevel; label: string }> = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

const focusSuggestions = [
  "daily conversation",
  "travel",
  "meeting communication",
  "customer support",
  "sales outreach",
  "job interview",
];

function buildLocalLessonPack(item: LanguageLearningRecord) {
  return [
    "【Learning Snapshot】",
    `- Topic：${item.title || "未填写"}`,
    `- Native language：${item.nativeLanguage || "未填写"}`,
    `- Target language：${item.targetLanguage || "未填写"}`,
    `- Level：${item.level}`,
    `- Focus：${item.focus || "未填写"}`,
    "",
    "【Quick Translation】",
    item.sourceText?.trim()
      ? `- 把这段内容先拆成 3-5 个重点表达，再逐句理解：${item.sourceText.slice(0, 180)}`
      : "- 先围绕当前主题生成一段简短对话，再做逐句理解。",
    "",
    "【Key Phrases】",
    "- 准备 5 个最常用表达，每个表达配 1 句场景句子。",
    "- 明确哪些句子适合直接背，哪些需要替换关键词使用。",
    "",
    "【Roleplay Drill】",
    "- 先做 1 轮慢速跟读，再做 1 轮不看稿复述。",
    "- 把自己最容易卡住的 2 句话单独拿出来重复练。",
    "",
    "【Speaking Feedback】",
    "- 优先纠正最影响理解的发音或语序问题。",
    "- 如果表达不完整，先保证意思传达到位，再优化自然度。",
    "",
    "【Next Actions】",
    "- 今天只记住 5 个核心表达。",
    "- 明天重复一轮角色扮演，并增加 1 个新场景。",
    "- 把高频表达沉淀到 Knowledge Vault，形成自己的短句库。",
  ].join("\n");
}

function extractNextActions(text: string) {
  const sectionMatch = text.match(/【Next Actions】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : text;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function LanguageLearningDeskAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [records, setRecords] = useState<LanguageLearningRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getLanguageLearningRecords();
      setRecords(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeLanguageLearning(sync);
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
    patch: Partial<Omit<LanguageLearningRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateLanguageLearningRecord(selected.id, patch);
  };

  const createNew = () => {
    const id = createLanguageLearningRecord();
    setSelectedId(id);
    showToast("已新增语言练习项目", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeLanguageLearningRecord(selected.id);
    setSelectedId(null);
    showToast("语言练习项目已删除", "ok");
  };

  const generateLessonPack = async () => {
    if (!selected) {
      showToast("请先选择练习项目", "error");
      return;
    }
    const fallback = buildLocalLessonPack(selected);
    const taskId = createTask({
      name: "Assistant - Language Learning Desk",
      status: "running",
      detail: `${selected.targetLanguage} / ${selected.title}`.slice(0, 80),
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Language Learning Desk 助手。请根据用户给出的语言目标，生成一份可直接练习的学习包。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 说明和反馈使用当前输出语言。\n" +
        "2) 目标语言例句、角色扮演和练习句必须使用目标语言。\n" +
        "3) 输出必须包含以下标题：\n" +
        "【Learning Snapshot】\n【Quick Translation】\n【Key Phrases】\n【Roleplay Drill】\n【Speaking Feedback】\n【Next Actions】\n" +
        "4) 内容简洁、可执行，适合马上练习。\n\n" +
        `练习主题：${selected.title}\n` +
        `母语：${selected.nativeLanguage}\n` +
        `目标语言：${selected.targetLanguage}\n` +
        `当前水平：${selected.level}\n` +
        `使用场景：${selected.focus}\n` +
        `学习目标：${selected.goal || "(未填)"}\n` +
        `原文 / 练习素材：\n${selected.sourceText || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-language-learning-desk",
        timeoutSeconds: 120,
      });
      patchSelected({ lessonPack: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("语言学习包已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ lessonPack: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地练习包", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveLessonDraft = () => {
    if (!selected?.lessonPack.trim()) {
      showToast("请先生成学习包", "error");
      return;
    }
    createDraft({
      title: `${selected.targetLanguage} - ${selected.title || "Practice Pack"}`,
      body: selected.lessonPack,
      tags: ["language-learning", selected.targetLanguage.toLowerCase()],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToVault = () => {
    if (!selected?.lessonPack.trim()) {
      showToast("请先生成学习包", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query:
        `请基于以下语言学习包，整理成一个可持续复习的短句库、场景模板和复习清单：\n` +
        selected.lessonPack,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  const sendToTasks = () => {
    if (!selected?.lessonPack.trim()) {
      showToast("请先生成学习包", "error");
      return;
    }
    const items = extractNextActions(selected.lessonPack);
    if (items.length === 0) {
      showToast("没有可写入的练习动作", "error");
      return;
    }
    items.forEach((item) => {
      createTask({
        name: `Language Practice - ${selected.targetLanguage}`,
        status: "queued",
        detail: item,
      });
    });
    requestOpenApp("task_manager");
    showToast(`已写入 ${items.length} 个练习任务`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Language Learning Desk"
      icon={Languages}
      widthClassName="w-[1220px]"
      storageKey="openclaw.window.language_learning_desk"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Language Learning Desk</div>
              <div className="mt-1 text-sm text-gray-500">
                把翻译、重点表达、角色扮演和复习动作收口到一个语言学习工作台里。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              练习项目 {records.length} 个
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">Practice sessions</div>
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
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          isActive
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.title || "Language practice"}</div>
                        <div
                          className={[
                            "mt-1 text-xs",
                            isActive ? "text-white/70" : "text-gray-500",
                          ].join(" ")}
                        >
                          {item.nativeLanguage} {"->"} {item.targetLanguage}
                        </div>
                        <div
                          className={[
                            "mt-2 text-[11px]",
                            isActive ? "text-white/60" : "text-gray-400",
                          ].join(" ")}
                        >
                          {item.focus || "daily conversation"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有语言练习项目，先新建一个。
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <Languages className="h-4 w-4" />
                    高频场景
                  </div>
                  <div className="mt-2 text-xs leading-5 text-blue-900/80">
                    旅行沟通、会议表达、客服回复、销售外联、面试准备。
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <BookOpenCheck className="h-4 w-4" />
                    推荐流程
                  </div>
                  <div className="mt-2 text-xs leading-5 text-emerald-900/80">
                    先生成练习包，再沉淀短句库，最后把复习动作写进任务中心。
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            {selected ? (
              <>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="rounded-3xl border border-gray-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Learning brief</div>
                        <div className="mt-1 text-sm text-gray-500">
                          录入目标语言、使用场景和素材，生成可直接练的学习包。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={deleteSelected}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        aria-label="删除项目"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Topic
                        </span>
                        <input
                          value={selected.title}
                          onChange={(e) => patchSelected({ title: e.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                          placeholder="例如：旅行英语 / Japanese for customer support"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Goal
                        </span>
                        <input
                          value={selected.goal}
                          onChange={(e) => patchSelected({ goal: e.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                          placeholder="例如：在 2 周内能完成基本点餐和问路"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Native language
                        </span>
                        <input
                          value={selected.nativeLanguage}
                          onChange={(e) => patchSelected({ nativeLanguage: e.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                          placeholder="中文"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Target language
                        </span>
                        <input
                          value={selected.targetLanguage}
                          onChange={(e) => patchSelected({ targetLanguage: e.target.value })}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                          placeholder="English / 日本語 / Deutsch"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Level
                        </span>
                        <select
                          value={selected.level}
                          onChange={(e) =>
                            patchSelected({ level: e.target.value as LanguageLearningLevel })
                          }
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                        >
                          {levelOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Focus
                        </span>
                        <input
                          value={selected.focus}
                          onChange={(e) => patchSelected({ focus: e.target.value })}
                          list="language-learning-focus"
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                          placeholder="daily conversation"
                        />
                        <datalist id="language-learning-focus">
                          {focusSuggestions.map((item) => (
                            <option key={item} value={item} />
                          ))}
                        </datalist>
                      </label>
                    </div>

                    <label className="mt-4 block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Source text or notes
                      </span>
                      <textarea
                        value={selected.sourceText}
                        onChange={(e) => patchSelected({ sourceText: e.target.value })}
                        rows={9}
                        className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                        placeholder="贴一段你想翻译/练习的文本，或者写下想练的场景。"
                      />
                    </label>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-5 text-gray-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Lesson pack</div>
                        <div className="mt-1 text-sm text-gray-600">
                          输出翻译重点、场景表达、角色扮演和下一步练习动作。
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI + local fallback
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={generateLessonPack}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isGenerating ? "生成中..." : "生成学习包"}
                      </button>
                      <button
                        type="button"
                        onClick={saveLessonDraft}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                      >
                        <FilePlus2 className="h-4 w-4" />
                        保存草稿
                      </button>
                      <button
                        type="button"
                        onClick={sendToVault}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                      >
                        <BookOpenCheck className="h-4 w-4" />
                        沉淀短句库
                      </button>
                      <button
                        type="button"
                        onClick={sendToTasks}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                      >
                        <Languages className="h-4 w-4" />
                        写入复习任务
                      </button>
                    </div>

                    <div className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4">
                      <pre className="max-h-[540px] overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-gray-900">
                        {selected.lessonPack.trim() ||
                          "点击“生成学习包”后，这里会出现翻译重点、短句、角色扮演和复习动作。"}
                      </pre>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[32px] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                先新建一个语言练习项目，再开始生成学习包。
              </div>
            )}
          </section>
        </div>
      </div>
    </AppWindowShell>
  );
}
