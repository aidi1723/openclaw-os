"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenText, FilePlus2, Plus, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { ResearchHeroWorkflowPanel } from "@/components/workflows/ResearchHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { upsertResearchAsset } from "@/lib/research-assets";
import { buildResearchWorkflowMeta, getResearchWorkflowScenario } from "@/lib/research-workflow";
import {
  createResearchReport,
  getResearchReports,
  removeResearchReport,
  subscribeResearchReports,
  updateResearchReport,
  type ResearchReportRecord,
} from "@/lib/research-hub";
import { createTask, updateTask } from "@/lib/tasks";
import {
  requestOpenKnowledgeVault,
  requestOpenMorningBrief,
  type ResearchHubPrefill,
} from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  getWorkflowRun,
  startWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";

function buildLocalResearchReport(item: ResearchReportRecord) {
  return [
    "【Research Brief】",
    `- 主题：${item.topic || "未填写"}`,
    `- 来源范围：${item.sources || "未填写"}`,
    `- 研究角度：${item.angle || "未填写"}`,
    `- 输出对象：${item.audience || "未填写"}`,
    "",
    "【关键发现】",
    "- 先找 3 个最重要的变化或分歧，而不是堆砌信息。",
    "- 标注哪些结论已经有足够依据，哪些只是待验证假设。",
    "- 把真正影响执行的变化单独拎出来。",
    "",
    "【对比与判断】",
    "- 对比不同来源是否一致，是否存在信息冲突。",
    "- 给出你当前最可信的一条判断，并说明依据。",
    "",
    "【下一步】",
    "- 把长期有效的资料整理进 Knowledge Vault。",
    "- 把今天必须关注的变化带入 Morning Brief。",
    "- 若需要继续深挖，补充新的来源和验证问题。",
  ].join("\n");
}

function getDefaultTriggerType(item: ResearchReportRecord): WorkflowTriggerType {
  return item.workflowTriggerType ?? "web_form";
}

export function DeepResearchHubAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [reports, setReports] = useState<ResearchReportRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getResearchReports();
      setReports(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeResearchReports(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<ResearchHubPrefill>).detail;
      const id = createResearchReport({
        topic: detail?.topic ?? "",
        sources: detail?.sources ?? "",
        angle: detail?.angle ?? "",
        audience: detail?.audience ?? "",
        notes: detail?.notes ?? "",
        report: detail?.report ?? "",
        ...buildResearchWorkflowMeta(detail),
      });
      setSelectedId(id);
      showToast("已带入研究场景上下文", "ok");
    };
    window.addEventListener("openclaw:research-hub-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:research-hub-prefill", onPrefill);
  }, [showToast]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const reportId = (event as CustomEvent<{ reportId?: string }>).detail?.reportId;
      if (!reportId) return;
      const targetReport = getResearchReports().find((item) => item.id === reportId);
      if (!targetReport) return;
      setSelectedId(targetReport.id);
      showToast("已定位到研究条目", "ok");
    };
    window.addEventListener("openclaw:research-hub-select", onSelect);
    return () =>
      window.removeEventListener("openclaw:research-hub-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => reports.find((item) => item.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<ResearchReportRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateResearchReport(selected.id, patch);
  };

  const createNew = () => {
    const id = createResearchReport();
    setSelectedId(id);
    showToast("已新增研究条目", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeResearchReport(selected.id);
    setSelectedId(null);
    showToast("研究条目已删除", "ok");
  };

  const ensureWorkflowForSelected = (triggerType?: WorkflowTriggerType) => {
    if (!selected) return null;
    const resolvedTriggerType = triggerType ?? getDefaultTriggerType(selected);
    if (selected.workflowRunId) return selected.workflowRunId;
    const scenario = getResearchWorkflowScenario();
    if (!scenario) return null;
    const runId = startWorkflowRun(scenario, resolvedTriggerType);
    patchSelected({
      workflowRunId: runId,
      workflowScenarioId: scenario.id,
      workflowStageId: scenario.workflowStages[0]?.id,
      workflowTriggerType: resolvedTriggerType,
      workflowSource: "来自 Deep Research Hub 的研究任务录入",
      workflowNextStep: "先生成结构化研究简报，再决定哪些洞察要送进知识库和晨报。",
    });
    upsertResearchAsset(runId, {
      scenarioId: scenario.id,
      reportId: selected.id,
      topic: selected.topic,
      audience: selected.audience,
      angle: selected.angle,
      sources: selected.sources,
      latestReport: selected.report,
      nextAction: "先输出结构化研究简报，避免研究停留在原始资料层。",
      status: "capture",
    });
    return runId;
  };

  const generateReport = async () => {
    if (!selected) {
      showToast("请先选择研究条目", "error");
      return;
    }

    const runId = ensureWorkflowForSelected();
    const fallback = buildLocalResearchReport(selected);
    const taskId = createTask({
      name: "Assistant - Deep research",
      status: "running",
      detail: selected.topic.slice(0, 80),
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Deep Research Hub 助手。请围绕用户给出的研究主题、来源和角度，输出一份结构化研究简报。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含以下标题：\n" +
        "【Research Brief】\n【关键发现】\n【对比与判断】\n【下一步】\n" +
        "要求：\n" +
        "1) 重点提炼差异、趋势、争议点。\n" +
        "2) 指出哪些结论可信、哪些需要继续验证。\n" +
        "3) 保持简洁，避免空话。\n\n" +
        `研究主题：${selected.topic}\n` +
        `来源范围：${selected.sources || "(未填)"}\n` +
        `研究角度：${selected.angle || "(未填)"}\n` +
        `输出对象：${selected.audience || "(未填)"}\n` +
        `补充说明：\n${selected.notes || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-deep-research-hub",
        timeoutSeconds: 120,
      });
      const nextReport = text || fallback;
      const run = runId ? getWorkflowRun(runId) : null;
      patchSelected({
        report: nextReport,
        workflowRunId: runId ?? selected.workflowRunId,
        workflowScenarioId: selected.workflowScenarioId ?? "research-radar",
        workflowStageId: run?.currentStageId === "capture" ? "synthesize" : selected.workflowStageId,
        workflowSource: "Deep Research Hub 已输出结构化研究简报",
        workflowNextStep: "把研究洞察送进 Knowledge Vault 或 Morning Brief，形成可被决策使用的摘要。",
      });
      if (runId) {
        upsertResearchAsset(runId, {
          scenarioId: "research-radar",
          reportId: selected.id,
          topic: selected.topic,
          audience: selected.audience,
          angle: selected.angle,
          sources: selected.sources,
          latestReport: nextReport,
          nextAction: "把研究结论路由到知识库或晨报，而不是停留在 research hub 里。",
          status: "synthesizing",
        });
        if (run?.currentStageId === "capture") {
          advanceWorkflowRun(runId);
        }
      }
      updateTask(taskId, { status: "done" });
      showToast("研究简报已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({
        report: fallback,
        workflowSource: "Deep Research Hub 本地兜底生成研究简报",
        workflowNextStep: "建议人工检查后，再送入知识库或晨报。",
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地研究简报", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!selected?.report.trim()) {
      showToast("请先生成研究简报", "error");
      return;
    }
    createDraft({
      title: `${selected.topic || "Research"} Brief`,
      body: selected.report,
      tags: ["research", "brief"],
      source: "import",
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: selected.workflowStageId,
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: selected.workflowSource,
      workflowNextStep: selected.workflowNextStep,
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToVault = () => {
    if (!selected?.report.trim()) {
      showToast("请先生成研究简报", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const run = runId ? getWorkflowRun(runId) : null;
    const nextStep = "把沉淀下来的研究洞察压成 Morning Brief 或任务指令，避免只存不用。";
    patchSelected({
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "research-radar",
      workflowStageId: run?.currentStageId === "synthesize" ? "route" : selected.workflowStageId ?? "route",
      workflowSource: "Deep Research Hub 已把洞察送往 Knowledge Vault",
      workflowNextStep: nextStep,
    });
    if (runId) {
      if (run?.currentStageId === "synthesize") {
        advanceWorkflowRun(runId);
      }
      upsertResearchAsset(runId, {
        scenarioId: "research-radar",
        reportId: selected.id,
        topic: selected.topic,
        audience: selected.audience,
        angle: selected.angle,
        sources: selected.sources,
        latestReport: selected.report,
        vaultQuery: `请基于以下研究简报，整理长期可复用的观察维度、资料清单和后续跟踪框架：\n${selected.report}`,
        nextAction: nextStep,
        status: "routing",
      });
    }
    requestOpenKnowledgeVault({
      query: `请基于以下研究简报，整理长期可复用的观察维度、资料清单和后续跟踪框架：\n${selected.report}`,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  const sendToBrief = () => {
    if (!selected?.report.trim()) {
      showToast("请先生成研究简报", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const run = runId ? getWorkflowRun(runId) : null;
    const nextStep = "在 Morning Brief 里把研究结论压成今天可执行的判断与动作。";
    patchSelected({
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "research-radar",
      workflowStageId: run?.currentStageId === "synthesize" ? "route" : selected.workflowStageId ?? "route",
      workflowSource: "Deep Research Hub 已准备把研究结论送进 Morning Brief",
      workflowNextStep: nextStep,
    });
    if (runId) {
      if (run?.currentStageId === "synthesize") {
        advanceWorkflowRun(runId);
      }
      upsertResearchAsset(runId, {
        scenarioId: "research-radar",
        reportId: selected.id,
        topic: selected.topic,
        audience: selected.audience,
        angle: selected.angle,
        sources: selected.sources,
        latestReport: selected.report,
        nextAction: nextStep,
        status: "routing",
      });
    }
    requestOpenMorningBrief({
      focus: selected.topic || "研究主题",
      notes: selected.report,
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "research-radar",
      workflowStageId: run?.currentStageId === "synthesize" ? "route" : selected.workflowStageId ?? "route",
      workflowTriggerType: selected.workflowTriggerType ?? "web_form",
      workflowSource: "来自 Deep Research Hub 的研究结论",
      workflowNextStep: "把研究洞察压成今天可执行的摘要，并完成本轮研究资产沉淀。",
    });
    showToast("已发送到 Morning Brief", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Deep Research Hub"
      icon={BookOpenText}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.deep_research_hub"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Deep Research Hub</div>
              <div className="mt-1 text-sm text-gray-500">
                对应高频研究场景：整理主题、来源、研究角度，并输出可执行研究简报。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              研究记录 {reports.length} 条
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <ResearchHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.topic || "未命名研究"} · 研究输入阶段` : "Deep Research Hub · Hero Workflow"}
            description="Deep Research Hub 负责把分散的资料、来源和研究问题先压成结构化研究简报，让后续知识沉淀和晨报分发有稳定输入。"
            emptyHint="当你从这里启动研究链后，Deep Research -> Knowledge Vault -> Morning Brief 会共享同一条工作流状态。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: "生成研究简报",
                onClick: generateReport,
                disabled: !selected || isGenerating,
              },
              {
                label: "发到晨报",
                onClick: sendToBrief,
                disabled: !selected || !selected?.report.trim(),
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">研究列表</div>
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
                {reports.length > 0 ? (
                  reports.map((item) => {
                    const active = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.topic}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {item.angle || "未填写研究角度"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有研究条目。
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
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">研究主题</span>
                      <input
                        value={selected.topic}
                        onChange={(event) => patchSelected({ topic: event.target.value })}
                        placeholder="如：AI coding agents 对独立开发者工作流的影响"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">输出对象</span>
                      <input
                        value={selected.audience}
                        onChange={(event) => patchSelected({ audience: event.target.value })}
                        placeholder="如：founder / PM / content lead"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">来源范围</span>
                    <input
                      value={selected.sources}
                      onChange={(event) => patchSelected({ sources: event.target.value })}
                      placeholder="如：GitHub / docs / blogs / podcasts / X lists"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                    />
                  </label>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">研究角度</span>
                    <input
                      value={selected.angle}
                      onChange={(event) => patchSelected({ angle: event.target.value })}
                      placeholder="如：产品差异 / 分发策略 / 商业模式 / 风险"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                    />
                  </label>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">补充说明</span>
                    <textarea
                      value={selected.notes}
                      onChange={(event) => patchSelected({ notes: event.target.value })}
                      placeholder="写下待验证问题、已知信息、对比维度或你关心的结论。"
                      rows={8}
                      className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateReport}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {isGenerating ? "生成中..." : "生成研究简报"}
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
                      onClick={sendToVault}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      发到知识库
                    </button>
                    <button
                      type="button"
                      onClick={sendToBrief}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      发到晨报
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
                  <div className="text-sm font-semibold text-gray-900">研究输出</div>
                  <pre className="mt-3 min-h-[320px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                    {selected.report || "填写研究信息后生成结构化研究简报。"}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                先新建一条研究任务。
              </div>
            )}
          </main>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
