"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, KanbanSquare, Sparkles } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  getProjectOpsRecords,
  subscribeProjectOpsRecords,
  upsertProjectOpsRecord,
  type ProjectHealth,
  type ProjectOpsRecord,
} from "@/lib/project-ops";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenMorningBrief, type ProjectOpsPrefill } from "@/lib/ui-events";

const healthOptions: Array<{ id: ProjectHealth; label: string }> = [
  { id: "green", label: "健康" },
  { id: "yellow", label: "有风险" },
  { id: "red", label: "阻塞" },
];

function buildLocalProjectBrief(input: {
  project: string;
  owner: string;
  health: ProjectHealth;
  objective: string;
  updates: string;
  blockers: string;
}) {
  const updateLines = input.updates
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  const blockerLines = input.blockers
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return [
    "【项目状态】",
    `- 项目：${input.project.trim() || "未命名项目"}`,
    `- 负责人：${input.owner.trim() || "未填写"}`,
    `- 健康度：${healthOptions.find((item) => item.id === input.health)?.label ?? input.health}`,
    `- 当前目标：${input.objective.trim() || "请补充本期目标。"}`,
    "",
    "【本周进展】",
    ...(updateLines.length > 0 ? updateLines.map((line) => `- ${line}`) : ["- 暂无明确进展记录。"]),
    "",
    "【风险与阻塞】",
    ...(blockerLines.length > 0 ? blockerLines.map((line) => `- ${line}`) : ["- 暂无明确阻塞项。"]),
    "",
    "【下一步】",
    "- 明确一位 owner 和一个截止时间。",
    "- 先清掉最影响推进的一项阻塞。",
    "- 将今天必须推进的动作写入任务中心。",
  ].join("\n");
}

function extractActionItems(brief: string) {
  const sectionMatch = brief.match(/【下一步】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : brief;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function ProjectOpsAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [project, setProject] = useState("");
  const [owner, setOwner] = useState("");
  const [health, setHealth] = useState<ProjectHealth>("green");
  const [objective, setObjective] = useState("");
  const [updates, setUpdates] = useState("");
  const [blockers, setBlockers] = useState("");
  const [brief, setBrief] = useState("");
  const [recordId, setRecordId] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [records, setRecords] = useState<ProjectOpsRecord[]>([]);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => setRecords(getProjectOpsRecords());
    sync();
    const unsub = subscribeProjectOpsRecords(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<ProjectOpsPrefill>).detail;
      setRecordId(undefined);
      setProject(detail?.project ?? "");
      setOwner(detail?.owner ?? "");
      setHealth(detail?.health ?? "green");
      setObjective(detail?.objective ?? "");
      setUpdates(detail?.updates ?? "");
      setBlockers(detail?.blockers ?? "");
      setBrief(detail?.brief ?? "");
      showToast("已带入项目交付场景", "ok");
    };
    window.addEventListener("openclaw:project-ops-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:project-ops-prefill", onPrefill);
  }, [showToast]);

  const generateBrief = async () => {
    if (!project.trim()) {
      showToast("请先填写项目名称", "error");
      return;
    }

    const fallback = buildLocalProjectBrief({ project, owner, health, objective, updates, blockers });
    const taskId = createTask({
      name: "Assistant - Project ops brief",
      status: "running",
      detail: project.trim().slice(0, 80),
    });

    setIsGenerating(true);
    try {
      const message =
        "你是 Project Ops 助手。请把项目更新整理成一份可执行的项目运营 brief。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含：\n" +
        "【项目状态】\n【本周进展】\n【风险与阻塞】\n【下一步】\n" +
        "要求简洁、偏执行，直接指出风险和下一步动作。\n\n" +
        `项目：${project.trim()}\n` +
        `负责人：${owner.trim() || "未填写"}\n` +
        `健康度：${health}\n` +
        `目标：${objective.trim() || "(空)"}\n` +
        `进展：\n${updates.trim() || "(空)"}\n` +
        `阻塞：\n${blockers.trim() || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-project-ops",
        timeoutSeconds: 120,
      });
      const nextBrief = text || fallback;
      setBrief(nextBrief);
      setRecordId(
        upsertProjectOpsRecord({
          id: recordId,
          project,
          owner,
          health,
          objective,
          updates,
          blockers,
          brief: nextBrief,
        }),
      );
      updateTask(taskId, { status: "done" });
      showToast("项目 brief 已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setBrief(fallback);
      setRecordId(
        upsertProjectOpsRecord({
          id: recordId,
          project,
          owner,
          health,
          objective,
          updates,
          blockers,
          brief: fallback,
        }),
      );
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已生成本地项目 brief", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!brief.trim()) {
      showToast("请先生成项目 brief", "error");
      return;
    }
    createDraft({
      title: `${project.trim() || "Project"} - Ops Brief`,
      body: brief,
      tags: ["project", "ops"],
      source: "import",
    });
    showToast("已写入草稿", "ok");
  };

  const pushTasks = () => {
    const items = extractActionItems(brief);
    if (items.length === 0) {
      showToast("没有可写入的动作项", "error");
      return;
    }
    items.forEach((item) => {
      createTask({
        name: `Project - ${project.trim() || "Follow-up"}`,
        status: "queued",
        detail: item,
      });
    });
    showToast(`已写入 ${items.length} 个任务`, "ok");
  };

  const sendToBrief = () => {
    requestOpenMorningBrief({
      focus: project.trim() || "项目推进",
      notes: brief.trim() || blockers.trim(),
    });
    showToast("已带入 Morning Brief", "ok");
  };

  const stats = useMemo(
    () => ({
      records: records.length,
      nextSteps: extractActionItems(brief).length,
      latest: records[0]?.updatedAt ?? null,
    }),
    [records, brief],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Project Ops Board"
      icon={KanbanSquare}
      widthClassName="w-[1140px]"
      storageKey="openclaw.window.project_ops"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Project Ops Board</div>
              <div className="mt-1 text-sm text-gray-500">
                按项目与运营场景封装的执行面板。适合周报、风险同步、阻塞收口和项目推进。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestOpenApp("task_manager")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                打开任务中心
              </button>
              <button
                type="button"
                onClick={() => requestOpenApp("meeting_copilot")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                打开会议助手
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">项目记录</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{stats.records} 个</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">下一步</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{stats.nextSteps} 项</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">最近更新</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {stats.latest ? new Date(stats.latest).toLocaleString() : "暂无"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">项目名称</span>
                  <input
                    value={project}
                    onChange={(event) => setProject(event.target.value)}
                    placeholder="如：OpenClaw Growth Site"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">负责人</span>
                  <input
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                    placeholder="Owner / 负责人"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">健康度</span>
                  <select
                    value={health}
                    onChange={(event) => setHealth(event.target.value as ProjectHealth)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                  >
                    {healthOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">本期目标</span>
                  <input
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder="这一阶段的核心目标是什么"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">最新进展</span>
                <textarea
                  value={updates}
                  onChange={(event) => setUpdates(event.target.value)}
                  placeholder="记录本周完成项、上线内容、关键结果。"
                  rows={8}
                  className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <label className="mt-4 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">风险与阻塞</span>
                <textarea
                  value={blockers}
                  onChange={(event) => setBlockers(event.target.value)}
                  placeholder="记录依赖、延期、风险和需要协调的事项。"
                  rows={8}
                  className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateBrief}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "生成中..." : "生成项目 Brief"}
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  <ClipboardList className="h-4 w-4" />
                  写入草稿
                </button>
                <button
                  type="button"
                  onClick={pushTasks}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  同步到任务中心
                </button>
                <button
                  type="button"
                  onClick={sendToBrief}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  带入 Morning Brief
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">项目输出</div>
              <pre className="mt-3 min-h-[360px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                {brief || "在左侧填写项目更新后生成可执行 brief。"}
              </pre>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">最近项目</div>
              <div className="mt-3 space-y-3">
                {records.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRecordId(item.id);
                      setProject(item.project);
                      setOwner(item.owner);
                      setHealth(item.health);
                      setObjective(item.objective);
                      setUpdates(item.updates);
                      setBlockers(item.blockers);
                      setBrief(item.brief);
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:bg-gray-100"
                  >
                    <div className="text-sm font-semibold text-gray-900">{item.project}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.owner || "未填写负责人"}</div>
                    <div className="mt-2 text-xs text-gray-600">
                      {healthOptions.find((healthItem) => healthItem.id === item.health)?.label}
                    </div>
                  </button>
                ))}
                {records.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有项目记录。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
