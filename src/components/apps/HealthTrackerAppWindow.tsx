"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, HeartPulse, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createHealthLog,
  getHealthLogs,
  removeHealthLog,
  subscribeHealth,
  updateHealthLog,
  type HealthLog,
} from "@/lib/health";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";

function buildLocalSummary(logs: HealthLog[]) {
  const recent = logs.slice(0, 7);
  const avgEnergy =
    recent.length > 0
      ? (recent.reduce((sum, log) => sum + log.energy, 0) / recent.length).toFixed(1)
      : "0";
  return [
    "【Health Summary】",
    `- 最近记录：${recent.length} 天`,
    `- 平均精力：${avgEnergy}/5`,
    "",
    "【观察】",
    ...(recent.length > 0
      ? recent.map((log) => `- ${log.date} | sleep ${log.sleepHours || "-"}h | energy ${log.energy} | symptom ${log.symptom || "无"}`)
      : ["- 还没有健康记录。"]),
    "",
    "【提醒】",
    "- 这里只做记录与整理，不替代专业医疗建议。",
    "- 如果症状持续、恶化或明显异常，请尽快线下就医。",
  ].join("\n");
}

export function HealthTrackerAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getHealthLogs();
      setLogs(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeHealth(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => logs.find((log) => log.id === selectedId) ?? null,
    [logs, selectedId],
  );

  const createNew = () => {
    const id = createHealthLog();
    setSelectedId(id);
    showToast("已新增健康记录", "ok");
  };

  const generateSummary = async () => {
    const fallback = buildLocalSummary(logs);
    const taskId = createTask({
      name: "Assistant - Health summary",
      status: "running",
      detail: "health-tracker",
    });
    setIsGenerating(true);
    try {
      const content = logs
        .slice(0, 10)
        .map((log) => `- ${log.date} | sleep ${log.sleepHours || "-"}h | energy ${log.energy} | symptom ${log.symptom || "无"} | medication ${log.medication || "无"} | notes ${log.notes || "无"}`)
        .join("\n");
      const message =
        "你是 Health & Symptom Tracker 助手。请基于用户记录输出一份中文整理摘要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 只总结模式和变化，不做诊断。\n" +
        "2) 提醒用户什么时候应该考虑线下就医。\n" +
        "3) 输出里明确说明这不是医疗建议。\n\n" +
        `记录：\n${content || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-health-tracker",
        timeoutSeconds: 90,
      });
      setSummary(text || fallback);
      updateTask(taskId, { status: "done" });
      showToast("健康摘要已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setSummary(fallback);
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地摘要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSummary = () => {
    if (!summary.trim()) {
      showToast("请先生成健康摘要", "error");
      return;
    }
    createDraft({
      title: "Health Summary",
      body: summary,
      tags: ["health", "symptom"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Health Tracker"
      icon={HeartPulse}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.health_tracker"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Health & Symptom Tracker</div>
              <div className="mt-1 text-sm text-gray-500">
                高频个人场景：记录睡眠、精力、症状和药物，仅用于整理，不替代医疗建议。
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              仅记录与整理，不替代医疗建议
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">健康记录</div>
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
                {logs.length > 0 ? (
                  logs.map((log) => {
                    const active = log.id === selectedId;
                    return (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => setSelectedId(log.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{log.date}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          energy {log.energy}/5 {log.symptom ? `· ${log.symptom}` : ""}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有健康记录。
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
                      <div className="text-sm font-semibold text-gray-900">记录详情</div>
                      <div className="mt-1 text-xs text-gray-500">记录变化即可，不做诊断。</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeHealthLog(selected.id);
                        setSelectedId(null);
                        showToast("健康记录已删除", "ok");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input
                      type="date"
                      value={selected.date}
                      onChange={(e) => updateHealthLog(selected.id, { date: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={selected.sleepHours}
                      onChange={(e) => updateHealthLog(selected.id, { sleepHours: e.target.value })}
                      placeholder="睡眠小时，例如 7.5"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={String(selected.energy)}
                      onChange={(e) => updateHealthLog(selected.id, { energy: Number(e.target.value) })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          energy {value}/5
                        </option>
                      ))}
                    </select>
                    <input
                      value={selected.medication}
                      onChange={(e) => updateHealthLog(selected.id, { medication: e.target.value })}
                      placeholder="药物 / 补剂"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={selected.symptom}
                      onChange={(e) => updateHealthLog(selected.id, { symptom: e.target.value })}
                      placeholder="症状"
                      className="md:col-span-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      value={selected.notes}
                      onChange={(e) => updateHealthLog(selected.id, { notes: e.target.value })}
                      placeholder="备注"
                      className="md:col-span-2 h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条健康记录。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">健康摘要</div>
                  <div className="mt-1 text-xs text-gray-500">只整理模式，不做诊断。</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateSummary}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成摘要"}
                  </button>
                  <button
                    type="button"
                    onClick={saveSummary}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {summary ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{summary}</pre>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现健康摘要。
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
