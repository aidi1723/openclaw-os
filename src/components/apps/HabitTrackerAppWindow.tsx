"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCheck, FilePlus2, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  completeHabit,
  createHabit,
  getHabits,
  removeHabit,
  subscribeHabits,
  updateHabit,
  type HabitCadence,
  type HabitRecord,
} from "@/lib/habits";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";

function buildLocalReview(habits: HabitRecord[], date: string) {
  const completed = habits.filter((habit) => habit.lastCompletedOn === date);
  return [
    "【Habit Review】",
    `- 今日完成：${completed.length}/${habits.length}`,
    "",
    "【进展】",
    ...(habits.length > 0
      ? habits.map((habit) => `- ${habit.title} | streak ${habit.streak} | ${habit.lastCompletedOn === date ? "已完成" : "未完成"}`)
      : ["- 还没有习惯。"]),
    "",
    "【建议】",
    "- 先稳住 1-2 个关键习惯，不要同时追太多。",
    "- 把阻力最大的习惯拆成更小动作。",
    "- 如果今天没完成，先记录卡点，而不是直接放弃。",
  ].join("\n");
}

export function HabitTrackerAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [review, setReview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getHabits();
      setHabits(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeHabits(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => habits.find((habit) => habit.id === selectedId) ?? null,
    [habits, selectedId],
  );

  const completedCount = useMemo(
    () => habits.filter((habit) => habit.lastCompletedOn === today).length,
    [habits, today],
  );

  const createNew = () => {
    const id = createHabit();
    setSelectedId(id);
    showToast("已新增习惯", "ok");
  };

  const markDone = (habit: HabitRecord) => {
    completeHabit(habit.id, today);
    showToast("已记录完成", "ok");
  };

  const generateReview = async () => {
    const fallback = buildLocalReview(habits, today);
    const taskId = createTask({
      name: "Assistant - Habit review",
      status: "running",
      detail: today,
    });
    setIsGenerating(true);
    try {
      const summary = habits
        .map((habit) => `- ${habit.title} | cadence ${habit.cadence} | streak ${habit.streak} | doneToday ${habit.lastCompletedOn === today ? "yes" : "no"} | notes ${habit.notes}`)
        .join("\n");
      const message =
        "你是 Habit Tracker & Accountability Coach。请基于用户的习惯完成情况输出一份中文复盘。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先给出今天的完成情况。\n" +
        "2) 点出最值得保持和最容易中断的习惯。\n" +
        "3) 给出一个简短的明日建议。\n\n" +
        `日期：${today}\n` +
        `习惯列表：\n${summary || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-habit-tracker",
        timeoutSeconds: 90,
      });
      setReview(text || fallback);
      updateTask(taskId, { status: "done" });
      showToast("习惯复盘已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setReview(fallback);
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地复盘", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveReview = () => {
    if (!review.trim()) {
      showToast("请先生成复盘", "error");
      return;
    }
    createDraft({
      title: `Habit Review ${today}`,
      body: review,
      tags: ["habit", "review"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Habit Tracker"
      icon={Target}
      widthClassName="w-[1160px]"
      storageKey="openclaw.window.habit_tracker"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Habit Tracker & Accountability Coach</div>
              <div className="mt-1 text-sm text-gray-500">
                高频日用场景：记录习惯、打卡、看 streak，并生成简短复盘。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                今日完成 {completedCount}/{habits.length}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">习惯列表</div>
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
                {habits.length > 0 ? (
                  habits.map((habit) => {
                    const active = habit.id === selectedId;
                    return (
                      <button
                        key={habit.id}
                        type="button"
                        onClick={() => setSelectedId(habit.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{habit.title}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          streak {habit.streak} · {habit.cadence}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有习惯。
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
                      <div className="text-sm font-semibold text-gray-900">习惯设置</div>
                      <div className="mt-1 text-xs text-gray-500">记录频率、备注，并完成今天打卡。</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => markDone(selected)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <CheckCheck className="h-4 w-4" />
                        今日完成
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeHabit(selected.id);
                          setSelectedId(null);
                          showToast("习惯已删除", "ok");
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <input
                      value={selected.title}
                      onChange={(e) => updateHabit(selected.id, { title: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={selected.cadence}
                      onChange={(e) => updateHabit(selected.id, { cadence: e.target.value as HabitCadence })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                    </select>
                    <textarea
                      value={selected.notes}
                      onChange={(e) => updateHabit(selected.id, { notes: e.target.value })}
                      className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一个习惯。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold text-gray-600">复盘日期</label>
                  <input
                    type="date"
                    value={today}
                    onChange={(e) => setToday(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateReview}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成复盘"}
                  </button>
                  <button
                    type="button"
                    onClick={saveReview}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {review ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{review}</pre>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现习惯复盘。
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
