"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Square } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import {
  cancelTask,
  clearFinishedTasks,
  getTasks,
  removeTask,
  subscribeTasks,
  type TaskRecord,
  type TaskStatus,
} from "@/lib/tasks";

function statusBadge(status: TaskStatus) {
  switch (status) {
    case "running":
      return {
        text: "🔄 执行中",
        className: "border-emerald-200 bg-emerald-50 text-gray-900",
      };
    case "queued":
      return {
        text: "⏳ 排队中",
        className: "border-sky-200 bg-sky-50 text-gray-900",
      };
    case "stopped":
      return {
        text: "⛔ 已停止",
        className: "border-red-200 bg-red-50 text-gray-900",
      };
    case "done":
      return {
        text: "✅ 已完成",
        className: "border-violet-200 bg-violet-50 text-gray-900",
      };
    case "error":
      return {
        text: "❌ 失败",
        className: "border-red-200 bg-red-50 text-gray-900",
      };
  }
}

export function TaskManagerAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>(() => getTasks());

  const runningCount = useMemo(
    () => tasks.filter((t) => t.status === "running").length,
    [tasks],
  );

  useEffect(() => {
    if (state === "minimized" || state === "closing") return;
    setTasks(getTasks());
    return subscribeTasks(() => setTasks(getTasks()));
  }, [state]);

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="任务调度中心"
      icon={Activity}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.task_manager"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="bg-white text-gray-900">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold tracking-tight">
                活动监视器
              </div>
              <div className="mt-1 text-sm text-gray-600">
                当前运行中：{runningCount} 个 AI 任务
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">系统</div>
              <div className="mt-1 font-mono text-sm text-gray-900">
                task runtime
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <div className="text-sm font-semibold text-gray-900">任务列表</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">{tasks.length} 项</div>
                <button
                  type="button"
                  onClick={() => clearFinishedTasks()}
                  disabled={!tasks.some((task) => task.status !== "running" && task.status !== "queued")}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  清理已结束
                </button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-sm font-semibold text-gray-900">还没有任务</div>
                <div className="mt-2 text-xs text-gray-500">
                  从 Spotlight、AI 文案、视觉工坊或发布中心触发动作后，这里会出现任务记录。
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tasks.map((task) => {
                  const badge = statusBadge(task.status);
                  return (
                    <div key={task.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-gray-900">
                            {task.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={[
                                "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold",
                                badge.className,
                              ].join(" ")}
                            >
                              {badge.text}
                              {task.status === "running" && typeof task.progress === "number"
                                ? ` ${task.progress}%`
                                : ""}
                            </span>
                            {task.status === "running" && (
                              <span className="text-xs text-gray-500">
                                | pipeline: agentcore
                              </span>
                            )}
                            {task.status === "error" && task.detail && (
                              <span className="text-xs text-red-600">
                                | {task.detail}
                              </span>
                            )}
                          </div>
                        </div>

                        {task.status === "running" ? (
                          <button
                            type="button"
                            onClick={() => cancelTask(task.id)}
                            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-semibold hover:bg-red-500/20 transition-colors"
                            title="停止任务"
                          >
                            <Square className="h-4 w-4" />
                            停止
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeTask(task.id)}
                            className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                          >
                            移除
                          </button>
                        )}
                      </div>

                      {task.status === "running" && typeof task.progress === "number" && (
                        <div className="mt-3">
                          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-500"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div className="mt-2 font-mono text-xs text-gray-500">
                            ETA: {Math.max(1, Math.round((100 - task.progress) / 2))}s
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="font-mono text-xs text-gray-500">
            任务记录会同步到运行状态层，便于统一追踪与回看。
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
