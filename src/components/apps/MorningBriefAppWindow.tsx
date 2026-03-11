"use client";

import { useEffect, useMemo, useState } from "react";
import { Newspaper, PenSquare, Sparkles, SquarePen } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { ResearchHeroWorkflowPanel } from "@/components/workflows/ResearchHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { getBriefs, createBrief, subscribeBriefs, type BriefRecord } from "@/lib/briefs";
import { getDrafts, subscribeDrafts } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { upsertResearchAsset } from "@/lib/research-assets";
import { getTasks, subscribeTasks, createTask, updateTask } from "@/lib/tasks";
import type { WorkflowTriggerType } from "@/lib/workflow-runs";
import { completeWorkflowRun } from "@/lib/workflow-runs";
import { requestOpenApp, type MorningBriefPrefill } from "@/lib/ui-events";

function buildLocalBrief(input: {
  focus: string;
  notes: string;
  tasks: ReturnType<typeof getTasks>;
  drafts: ReturnType<typeof getDrafts>;
}) {
  const running = input.tasks.filter((task) => task.status === "running").length;
  const pending = input.tasks.filter((task) => task.status === "queued").length;
  const topTasks = input.tasks.slice(0, 4);
  const recentDrafts = input.drafts.slice(0, 3);

  return [
    "【今日晨报】",
    `- 今日主线：${input.focus.trim() || "先明确 1 个最重要产出，再开始并行任务。"}`,
    `- 系统状态：运行中 ${running} 个任务，待处理 ${pending} 个任务。`,
    input.notes.trim() ? `- 昨夜补充：${input.notes.trim()}` : "- 昨夜补充：暂无。",
    "",
    "【优先事项】",
    ...(topTasks.length > 0
      ? topTasks.map((task, index) => `- P${index + 1}: ${task.name}${task.detail ? ` | ${task.detail}` : ""}`)
      : ["- 当前任务池为空，建议先把今天的目标拆成 2-3 个任务。"]),
    "",
    "【草稿动态】",
    ...(recentDrafts.length > 0
      ? recentDrafts.map((draft) => `- ${draft.title} (${draft.source})`)
      : ["- 还没有最新草稿，可从 AI 文案或发布中心开始生成。"]),
    "",
    "【建议动作】",
    "- 先完成 1 个高价值产出，再处理中断性沟通。",
    "- 把需要协作的事项转成明确待办，放入任务调度中心。",
    "- 如果今天有会议，建议会后立即写入 Meeting Copilot，避免行动项丢失。",
  ].join("\n");
}

export function MorningBriefAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [brief, setBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefs, setBriefs] = useState<BriefRecord[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [workflowRunId, setWorkflowRunId] = useState<string | undefined>();
  const [workflowScenarioId, setWorkflowScenarioId] = useState<string | undefined>();
  const [workflowStageId, setWorkflowStageId] = useState<string | undefined>();
  const [workflowSource, setWorkflowSource] = useState("");
  const [workflowNextStep, setWorkflowNextStep] = useState("");
  const [workflowTriggerType, setWorkflowTriggerType] = useState<WorkflowTriggerType | undefined>();
  const { toast, showToast } = useTimedToast(2000);

  function applyBriefRecord(item: BriefRecord) {
    setFocus(item.focus);
    setNotes(item.notes);
    setBrief(item.content);
    setWorkflowRunId(item.workflowRunId);
    setWorkflowScenarioId(item.workflowScenarioId);
    setWorkflowStageId(item.workflowStageId);
    setWorkflowSource(item.workflowSource ?? "");
    setWorkflowNextStep(item.workflowNextStep ?? "");
    setWorkflowTriggerType(item.workflowTriggerType);
  }

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      setBriefs(getBriefs());
      setTaskCount(getTasks().length);
      setDraftCount(getDrafts().length);
    };
    sync();
    const unsubBriefs = subscribeBriefs(sync);
    const unsubTasks = subscribeTasks(sync);
    const unsubDrafts = subscribeDrafts(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsubBriefs();
      unsubTasks();
      unsubDrafts();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<MorningBriefPrefill>).detail;
      if (detail?.focus) setFocus(detail.focus);
      if (detail?.notes) {
        setNotes((current) => (current ? `${current}\n\n${detail.notes}` : detail.notes || ""));
      }
      setWorkflowRunId(detail?.workflowRunId);
      setWorkflowScenarioId(detail?.workflowScenarioId);
      setWorkflowStageId(detail?.workflowStageId);
      setWorkflowSource(detail?.workflowSource ?? "");
      setWorkflowNextStep(detail?.workflowNextStep ?? "");
      setWorkflowTriggerType(detail?.workflowTriggerType);
      showToast("已带入晨报上下文", "ok");
    };
    window.addEventListener("openclaw:morning-brief-prefill", onPrefill);
    return () =>
      window.removeEventListener("openclaw:morning-brief-prefill", onPrefill);
  }, [showToast]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const briefId = (event as CustomEvent<{ briefId?: string }>).detail?.briefId;
      if (!briefId) return;
      const targetBrief = getBriefs().find((item) => item.id === briefId);
      if (!targetBrief) return;
      applyBriefRecord(targetBrief);
      showToast("已恢复该次晨报", "ok");
    };
    window.addEventListener("openclaw:morning-brief-select", onSelect);
    return () =>
      window.removeEventListener("openclaw:morning-brief-select", onSelect);
  }, [showToast]);

  const latestBriefAt = briefs[0]?.createdAt ?? null;

  const generateBrief = async () => {
    const tasks = getTasks();
    const drafts = getDrafts();
    const fallback = buildLocalBrief({ focus, notes, tasks, drafts });
    const taskId = createTask({
      name: "Assistant - Morning brief",
      status: "running",
      detail: focus.trim().slice(0, 80) || "daily-brief",
    });

    setIsGenerating(true);
    try {
      const taskLines = tasks
        .slice(0, 8)
        .map((task) => `- ${task.name} | ${task.status}${task.detail ? ` | ${task.detail}` : ""}`)
        .join("\n");
      const draftLines = drafts
        .slice(0, 5)
        .map((draft) => `- ${draft.title} | ${draft.source}`)
        .join("\n");
      const message =
        "你是 Morning Brief 助手。请基于用户提供的任务、草稿和补充说明，输出一份中文晨报。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先给出今天主线。\n" +
        "2) 给出 3-5 条优先事项，按先后顺序排列。\n" +
        "3) 给出风险提醒与建议动作。\n" +
        "4) 输出简洁，不要空话。\n\n" +
        `今日重点：${focus.trim() || "(未填写)"}\n` +
        `补充说明：${notes.trim() || "(无)"}\n` +
        `任务列表：\n${taskLines || "(空)"}\n` +
        `最近草稿：\n${draftLines || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-morning-brief",
        timeoutSeconds: 90,
      });
      const nextBrief = text || fallback;
      setBrief(nextBrief);
      const briefId = createBrief({
        focus,
        notes,
        content: nextBrief,
        workflowRunId,
        workflowScenarioId,
        workflowStageId,
        workflowSource,
        workflowNextStep,
        workflowTriggerType,
      });
      if (workflowRunId) {
        setWorkflowStageId("assetize");
        setWorkflowSource("Morning Brief 已完成研究洞察摘要");
        setWorkflowNextStep("本轮研究链已完成，可把分析框架、观察维度和分发模板继续复用。");
        upsertResearchAsset(workflowRunId, {
          scenarioId: workflowScenarioId ?? "research-radar",
          briefId,
          topic: focus,
          latestBrief: nextBrief,
          nextAction: "本轮研究摘要已完成，可以继续复用沉淀下来的框架。",
          status: "completed",
        });
        completeWorkflowRun(workflowRunId);
      }
      updateTask(taskId, { status: "done" });
      showToast("晨报已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setBrief(fallback);
      createBrief({
        focus,
        notes,
        content: fallback,
        workflowRunId,
        workflowScenarioId,
        workflowStageId,
        workflowSource,
        workflowNextStep,
        workflowTriggerType,
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地晨报", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      { label: "任务池", value: `${taskCount} 项` },
      { label: "最新草稿", value: `${draftCount} 份` },
      {
        label: "最近晨报",
        value: latestBriefAt ? new Date(latestBriefAt).toLocaleString() : "暂无",
      },
    ],
    [draftCount, latestBriefAt, taskCount],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Morning Brief"
      icon={Newspaper}
      widthClassName="w-[1120px]"
      storageKey="openclaw.window.morning_brief"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Daily Operating Brief</div>
              <div className="mt-1 text-sm text-gray-500">
                对应 awesome-openclaw-usecases 里的 Morning Brief。把任务、草稿、重点事项压缩成一份可执行晨报。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {card.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900">{card.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {workflowRunId || workflowScenarioId === "research-radar" ? (
            <ResearchHeroWorkflowPanel
              workflowRunId={workflowRunId}
              title={focus ? `${focus} · 研究摘要与收口阶段` : "Morning Brief · Research Workflow"}
              description="Morning Brief 在研究链里负责把研究结论压成今天真正可执行的判断和动作，让洞察不再停留在长文报告里。"
              emptyHint="当晨报是从 Deep Research Hub 送过来时，这里会显示所属 Research Hero Workflow。"
              source={workflowSource}
              nextStep={workflowNextStep}
              actions={[
                {
                  label: "生成晨报",
                  onClick: generateBrief,
                  disabled: isGenerating,
                },
              ]}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SquarePen className="h-4 w-4" />
                输入今日上下文
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">
                    今日重点
                  </label>
                  <textarea
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="例如：上午完成客户提案，下午推进短视频脚本与投放准备。"
                    className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">
                    补充说明
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="例如：昨晚客户新增需求；今天 16:00 有周会；需要同步供应商交付。"
                    className="h-32 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={generateBrief}
                  disabled={isGenerating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "生成中..." : "生成晨报"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">最近晨报</div>
              <div className="mt-3 space-y-2">
                {briefs.length > 0 ? (
                  briefs.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyBriefRecord(item)}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
                    >
                      <div className="text-xs font-semibold text-gray-900">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {item.focus.trim() || "未填写重点"}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有晨报记录。
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">晨报结果</div>
                <div className="mt-1 text-xs text-gray-500">
                  优先调用 OpenClaw，不可用时退回本地模板。
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestOpenApp("knowledge_vault")}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
              >
                <PenSquare className="h-4 w-4" />
                打开知识库补充上下文
              </button>
            </div>

            <div className="min-h-[460px] pt-4">
              {brief ? (
                <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
                  {brief}
                </pre>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  生成后，这里会出现今日晨报。
                </div>
              )}
            </div>
          </main>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
