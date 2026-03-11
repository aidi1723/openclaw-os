"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass, FilePlus2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { CreatorHeroWorkflowPanel } from "@/components/workflows/CreatorHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { upsertCreatorAsset } from "@/lib/creator-assets";
import { buildCreatorWorkflowMeta, getCreatorWorkflowScenario } from "@/lib/creator-workflow";
import { createTask, updateTask } from "@/lib/tasks";
import {
  createCreatorRadarItem,
  getCreatorRadarItems,
  removeCreatorRadarItem,
  subscribeCreatorRadar,
  updateCreatorRadarItem,
  type CreatorRadarRecord,
} from "@/lib/creator-radar";
import {
  requestOpenContentRepurposer,
  requestOpenKnowledgeVault,
  type CreatorRadarPrefill,
} from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  getWorkflowRun,
  startWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";

function buildLocalDigest(item: CreatorRadarRecord) {
  return [
    "【Creator Radar】",
    `- 主题：${item.title || "未填写"}`,
    `- 关注来源：${item.channels || "未填写"}`,
    `- 目标受众：${item.audience || "未填写"}`,
    `- 内容目标：${item.goal || "未填写"}`,
    "",
    "【可优先追的角度】",
    `- 角度 1：围绕「${item.title || "这个主题"}」给出一个更强的开场或对比切入。`,
    "- 角度 2：从常见误区、失败经验或低成本做法切入，更适合高频更新。",
    "- 角度 3：把近期评论、提问、FAQ 整理成一组短内容脚本。",
    "",
    "【下一步】",
    "- 把最值得做的一条内容送进 Content Repurposer。",
    "- 把重复出现的 hook、结构和 FAQ 沉淀到 Knowledge Vault。",
  ].join("\n");
}

function getDefaultTriggerType(item: CreatorRadarRecord): WorkflowTriggerType {
  return item.workflowTriggerType ?? "manual";
}

function extractPrimaryAngle(digest: string, fallback: string) {
  const line = digest
    .split(/\r?\n/)
    .map((item) => item.replace(/^[\-*#【】\s]+/g, "").trim())
    .find(Boolean);
  return line || fallback;
}

export function CreatorRadarAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [items, setItems] = useState<CreatorRadarRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getCreatorRadarItems();
      setItems(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeCreatorRadar(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<CreatorRadarPrefill>).detail;
      const id = createCreatorRadarItem({
        title: detail?.title ?? "",
        channels: detail?.channels ?? "",
        audience: detail?.audience ?? "",
        goal: detail?.goal ?? "",
        notes: detail?.notes ?? "",
        digest: detail?.digest ?? "",
        ...buildCreatorWorkflowMeta(detail),
      });
      setSelectedId(id);
      showToast("已带入 creator radar 上下文", "ok");
    };
    window.addEventListener("openclaw:creator-radar-prefill", onPrefill);
    return () =>
      window.removeEventListener("openclaw:creator-radar-prefill", onPrefill);
  }, [showToast]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const radarItemId = (event as CustomEvent<{ radarItemId?: string }>).detail?.radarItemId;
      if (!radarItemId) return;
      const targetItem = getCreatorRadarItems().find((item) => item.id === radarItemId);
      if (!targetItem) return;
      setSelectedId(targetItem.id);
      showToast("已定位到内容雷达条目", "ok");
    };
    window.addEventListener("openclaw:creator-radar-select", onSelect);
    return () =>
      window.removeEventListener("openclaw:creator-radar-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<CreatorRadarRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateCreatorRadarItem(selected.id, patch);
  };

  const createNew = () => {
    const id = createCreatorRadarItem();
    setSelectedId(id);
    showToast("已新增 creator brief", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeCreatorRadarItem(selected.id);
    setSelectedId(null);
    showToast("creator brief 已删除", "ok");
  };

  const ensureWorkflowForSelected = (triggerType?: WorkflowTriggerType) => {
    if (!selected) return null;
    const resolvedTriggerType = triggerType ?? getDefaultTriggerType(selected);
    if (selected.workflowRunId) return selected.workflowRunId;
    const scenario = getCreatorWorkflowScenario();
    if (!scenario) return null;
    const runId = startWorkflowRun(scenario, resolvedTriggerType);
    patchSelected({
      workflowRunId: runId,
      workflowScenarioId: scenario.id,
      workflowStageId: scenario.workflowStages[0]?.id,
      workflowTriggerType: resolvedTriggerType,
      workflowSource: "来自 Creator Radar 的内容选题录入",
      workflowNextStep: "先生成今日内容雷达摘要，再决定要不要拆成多平台内容包。",
    });
    upsertCreatorAsset(runId, {
      scenarioId: scenario.id,
      radarItemId: selected.id,
      topic: selected.title,
      audience: selected.audience,
      sourceChannels: selected.channels,
      primaryAngle: selected.title,
      latestDigest: selected.digest,
      nextAction: "先生成今日内容雷达摘要，确认今天最值得推进的一条内容。",
      publishStatus: "not_started",
      status: "radar",
    });
    return runId;
  };

  const startCreatorWorkflow = () => {
    if (!selected) {
      showToast("请先选择 brief", "error");
      return;
    }
    const runId = ensureWorkflowForSelected("manual");
    if (!runId) {
      showToast("内容工作流模板不可用", "error");
      return;
    }
    showToast("已启动 Creator Hero Workflow", "ok");
  };

  const generateDigest = async () => {
    if (!selected) {
      showToast("请先选择 brief", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const fallback = buildLocalDigest(selected);
    const taskId = createTask({
      name: "Assistant - Creator radar",
      status: "running",
      detail: selected.title,
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Creator Radar 助手。请根据用户输入的频道、主题和目标，输出一份中文内容雷达摘要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先总结最值得追的 3 个内容角度。\n" +
        "2) 给出适合短视频/社媒的 hook 方向。\n" +
        "3) 明确下一步应该沉淀到 Content Repurposer 还是 Knowledge Vault。\n\n" +
        `主题：${selected.title}\n` +
        `关注来源：${selected.channels || "(未填)"}\n` +
        `目标受众：${selected.audience || "(未填)"}\n` +
        `目标：${selected.goal || "(未填)"}\n` +
        `补充备注：${selected.notes || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-creator-radar",
        timeoutSeconds: 90,
      });
      const nextDigest = text || fallback;
      const run = runId ? getWorkflowRun(runId) : null;
      patchSelected({
        digest: nextDigest,
        workflowRunId: runId ?? selected.workflowRunId,
        workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
        workflowStageId: run?.currentStageId === "radar" ? "repurpose" : selected.workflowStageId,
        workflowSource: "Creator Radar 已完成今日内容雷达",
        workflowNextStep: "把这一条内容送进 Content Repurposer，生成多平台内容包。",
      });
      if (runId) {
        upsertCreatorAsset(runId, {
          scenarioId: "creator-studio",
          radarItemId: selected.id,
          topic: selected.title,
          audience: selected.audience,
          sourceChannels: selected.channels,
          primaryAngle: extractPrimaryAngle(nextDigest, selected.title || "今日内容主线"),
          latestDigest: nextDigest,
          nextAction: "进入 Content Repurposer，把摘要拆成短视频、帖子和 newsletter 版本。",
          publishStatus: "radar_ready",
          status: "repurposing",
        });
        if (run?.currentStageId === "radar") {
          advanceWorkflowRun(runId);
        }
      }
      updateTask(taskId, { status: "done" });
      showToast("内容雷达已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({
        digest: fallback,
        workflowSource: "Creator Radar 本地兜底生成内容雷达",
        workflowNextStep: "建议人工检查后，再送入 Content Repurposer。",
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地摘要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDigest = () => {
    if (!selected?.digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Creator Radar"} Digest`,
      body: selected.digest,
      tags: ["creator-radar", "ideas"],
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

  const sendToRepurposer = () => {
    if (!selected) {
      showToast("请先选择 brief", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const run = runId ? getWorkflowRun(runId) : null;
    const nextStep = "在 Content Repurposer 里生成多平台内容包，再挑 1 个版本进入 Publisher。";
    patchSelected({
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
      workflowStageId: run?.currentStageId === "radar" ? "repurpose" : selected.workflowStageId ?? "repurpose",
      workflowSource: "来自 Creator Radar 的已确认选题",
      workflowNextStep: nextStep,
    });
    if (runId) {
      if (run?.currentStageId === "radar") {
        advanceWorkflowRun(runId);
      }
      upsertCreatorAsset(runId, {
        scenarioId: "creator-studio",
        radarItemId: selected.id,
        topic: selected.title,
        audience: selected.audience,
        sourceChannels: selected.channels,
        primaryAngle: extractPrimaryAngle(selected.digest, selected.title || "今日内容主线"),
        latestDigest: selected.digest,
        nextAction: nextStep,
        publishStatus: "repurpose_pending",
        status: "repurposing",
      });
    }
    requestOpenContentRepurposer({
      title: selected.title || "Repurpose Pack",
      sourceType: "youtube",
      audience: selected.audience,
      goal: selected.goal || "拆成多平台短内容",
      sourceContent: [
        `【主题】\n${selected.title || "未填写"}`,
        selected.digest ? `【Creator Radar 摘要】\n${selected.digest}` : "",
        selected.notes ? `【补充观察】\n${selected.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      workflowSource: "来自 Creator Radar 的选题与内容雷达",
      workflowNextStep: "先生成多平台内容包，再筛出 1 条最适合立即进入 Publisher 的版本。",
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
      workflowStageId: run?.currentStageId === "radar" ? "repurpose" : selected.workflowStageId ?? "repurpose",
      workflowTriggerType: selected.workflowTriggerType ?? "manual",
    });
    showToast("已发送到 Content Repurposer", "ok");
  };

  const sendToVault = () => {
    if (!selected?.digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query: `请基于以下 Creator Radar 摘要，帮我整理成可复用的 hook、FAQ 和素材清单：\n${selected.digest}`,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Creator Radar"
      icon={Compass}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.creator_radar"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Creator Radar / Daily Digest</div>
              <div className="mt-1 text-sm text-gray-500">
                对应高频创作者场景：整理频道动态、选题方向、hook 和下一步内容动作。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              briefs {items.length}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <CreatorHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.title || "未命名选题"} · 内容雷达阶段` : "Creator Radar · Hero Workflow"}
            description="Creator Radar 不再只是选题列表，它负责启动内容增长链，把今天最值得做的一条内容推进到后续拆解和发布。"
            emptyHint="当你从这里启动内容链后，Radar -> Repurposer -> Publisher 会共享同一个工作流运行状态。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: selected?.workflowRunId ? "已绑定内容链" : "按选题启动",
                onClick: startCreatorWorkflow,
                disabled: !selected || Boolean(selected?.workflowRunId),
              },
              {
                label: "生成摘要",
                onClick: generateDigest,
                disabled: !selected || isGenerating,
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">Radar briefs</div>
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
                {items.length > 0 ? (
                  items.map((item) => {
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
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className={["mt-1 text-xs", isActive ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {item.channels || "未填写来源"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有 radar brief。
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
                      <div className="text-sm font-semibold text-gray-900">输入上下文</div>
                      <div className="mt-1 text-xs text-gray-500">
                        填主题、频道或创作者来源，再生成今日内容雷达。
                      </div>
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

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input
                      value={selected.title}
                      onChange={(e) => patchSelected({ title: e.target.value })}
                      placeholder="主题，例如 AI agent for creators"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={selected.audience}
                      onChange={(e) => patchSelected({ audience: e.target.value })}
                      placeholder="目标受众"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={selected.channels}
                      onChange={(e) => patchSelected({ channels: e.target.value })}
                      placeholder="频道/来源，例如 YouTube channels, newsletter, comments"
                      className="md:col-span-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={selected.goal}
                      onChange={(e) => patchSelected({ goal: e.target.value })}
                      placeholder="目标，例如 找到今天最值得做的 3 条短内容"
                      className="md:col-span-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      value={selected.notes}
                      onChange={(e) => patchSelected({ notes: e.target.value })}
                      placeholder="补充：近期观察、评论区问题、竞品变化"
                      className="md:col-span-2 h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  先新建一个 brief。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">今日摘要</div>
                  <div className="mt-1 text-xs text-gray-500">
                    用 OpenClaw 生成内容雷达，不可用时回退本地摘要。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateDigest}
                    disabled={!selected || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成摘要"}
                  </button>
                  <button
                    type="button"
                    onClick={saveDigest}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    存草稿
                  </button>
                  <button
                    type="button"
                    onClick={sendToRepurposer}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    发到 Repurposer
                  </button>
                  <button
                    type="button"
                    onClick={sendToVault}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    发到知识库
                  </button>
                </div>
              </div>

              <textarea
                value={selected?.digest ?? ""}
                onChange={(e) => patchSelected({ digest: e.target.value })}
                placeholder="这里会生成今天最值得跟进的内容角度、hook 和下一步。"
                className="mt-4 h-[320px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </main>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
