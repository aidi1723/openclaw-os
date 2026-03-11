"use client";

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Radio,
  UserCheck,
} from "lucide-react";

import { getAppDisplayName, getDisplayLanguage } from "@/lib/app-display";
import type { InterfaceLanguage } from "@/lib/settings";
import type { WorkspaceScenario } from "@/lib/workspace-presets";
import type {
  WorkflowRunRecord,
  WorkflowStageRunState,
  WorkflowTriggerType,
} from "@/lib/workflow-runs";

function getRunStateMeta(run: WorkflowRunRecord | null) {
  switch (run?.state) {
    case "running":
      return {
        label: "自动处理中",
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "awaiting_human":
      return {
        label: "等待人工确认",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "completed":
      return {
        label: "已完成",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "error":
      return {
        label: "异常",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    default:
      return {
        label: "未启动",
        className: "border-slate-200 bg-white text-slate-600",
      };
  }
}

function getTriggerTypeLabel(triggerType: WorkflowTriggerType) {
  switch (triggerType) {
    case "schedule":
      return "定时触发";
    case "inbound_message":
      return "事件触发";
    case "web_form":
      return "表单触发";
    case "manual":
    default:
      return "手动触发";
  }
}

function getStageStateMeta(state: WorkflowStageRunState) {
  switch (state) {
    case "completed":
      return {
        label: "已完成",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        dotClassName: "bg-emerald-500",
      };
    case "awaiting_human":
      return {
        label: "待确认",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        dotClassName: "bg-amber-500",
      };
    case "running":
      return {
        label: "执行中",
        className: "border-sky-200 bg-sky-50 text-sky-700",
        dotClassName: "bg-sky-500",
      };
    case "error":
      return {
        label: "失败",
        className: "border-rose-200 bg-rose-50 text-rose-700",
        dotClassName: "bg-rose-500",
      };
    default:
      return {
        label: "待开始",
        className: "border-slate-200 bg-slate-50 text-slate-500",
        dotClassName: "bg-slate-300",
      };
  }
}

function getModeMeta(mode: WorkspaceScenario["workflowStages"][number]["mode"]) {
  switch (mode) {
    case "auto":
      return {
        label: "自动执行",
        icon: Bot,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "assist":
      return {
        label: "AI 辅助",
        icon: Bot,
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "review":
      return {
        label: "人工确认",
        icon: UserCheck,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "manual":
    default:
      return {
        label: "人工执行",
        icon: UserCheck,
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
  }
}

function getCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "en") {
    return {
      triggerTitle: "Event Trigger Center",
      triggerDesc:
        "The workflow should not wait for someone to hunt for apps. These are the concrete events that can wake the chain up.",
      fire: "Fire trigger",
      timelineTitle: "Workflow Timeline",
      timelineDesc:
        "Make the machine state visible: what started, where it is now, and which node still needs human approval.",
      current: "Current stage",
      progress: "Progress",
      noRun: "No run yet. Fire one trigger to see the full state path.",
    };
  }
  if (displayLanguage === "ja") {
    return {
      triggerTitle: "Event Trigger Center",
      triggerDesc:
        "ワークフローは App 探しを待つべきではありません。ここで業務を起動する具体的なイベントを定義します。",
      fire: "トリガー起動",
      timelineTitle: "Workflow Timeline",
      timelineDesc:
        "何が起動し、今どこまで進み、どのノードで人の判断が必要かを見える化します。",
      current: "現在のステージ",
      progress: "進行",
      noRun: "まだ実行がありません。まず 1 つトリガーを起動してください。",
    };
  }
  return {
    triggerTitle: "Event Trigger Center",
    triggerDesc:
      "工作流不该等用户先去找 App。这里把真正能拉起业务链的触发事件放到台前。",
    fire: "模拟触发",
    timelineTitle: "Workflow Timeline",
    timelineDesc:
      "把机器状态显性化：因什么启动、现在卡在哪、哪一步还需要人确认。",
    current: "当前阶段",
    progress: "流程进度",
    noRun: "还没有运行记录，先触发一次事件就能看到完整状态链。",
  };
}

export function WorkflowSignalCenter({
  language,
  scenario,
  run,
  onFireTrigger,
}: {
  language: InterfaceLanguage;
  scenario: WorkspaceScenario | null;
  run: WorkflowRunRecord | null;
  onFireTrigger: (triggerId: string) => void;
}) {
  const copy = getCopy(language);

  if (!scenario) return null;

  const completedCount = run?.stageRuns.filter((stage) => stage.state === "completed").length ?? 0;
  const progressLabel = `${completedCount}/${scenario.workflowStages.length}`;
  const currentStage =
    scenario.workflowStages.find((stage) => stage.id === run?.currentStageId) ?? null;
  const stateMeta = getRunStateMeta(run);

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="rounded-[28px] border border-white/10 bg-black/12 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {copy.triggerTitle}
            </div>
            <div className="mt-2 text-sm leading-6 text-white/70">{copy.triggerDesc}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75">
            {scenario.triggers.length} triggers
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {scenario.triggers.map((trigger) => (
            <div
              key={`${scenario.id}:${trigger.id}`}
              className="rounded-[24px] border border-white/10 bg-white/8 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-white">{trigger.title}</div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                      {getTriggerTypeLabel(trigger.type)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/65">{trigger.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onFireTrigger(trigger.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <Radio className="h-3.5 w-3.5" />
                  {copy.fire}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {copy.timelineTitle}
            </div>
            <div className="mt-2 text-sm leading-6 text-white/70">{copy.timelineDesc}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                stateMeta.className,
              ].join(" ")}
            >
              {stateMeta.label}
            </div>
            {run?.updatedAt ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/75">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(run.updatedAt).toLocaleString()}
              </div>
            ) : null}
          </div>
        </div>

        {run ? (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/14 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {copy.current}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {currentStage?.title || "流程已收口"}
                </div>
                <div className="mt-2 text-xs leading-5 text-white/60">
                  {currentStage?.desc || "当前运行已完成，下一次可由新的 trigger 重新拉起。"}
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/14 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {copy.progress}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-sm font-semibold text-white">{progressLabel}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white/80"
                      style={{
                        width: `${(completedCount / Math.max(1, scenario.workflowStages.length)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2 text-xs leading-5 text-white/60">
                  Latest trigger: {getTriggerTypeLabel(run.triggerType)}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {scenario.workflowStages.map((stage, index) => {
                const stageRun =
                  run.stageRuns.find((item) => item.id === stage.id) ?? null;
                const stageState = getStageStateMeta(stageRun?.state ?? "pending");
                const modeMeta = getModeMeta(stage.mode);
                const ModeIcon = modeMeta.icon;
                return (
                  <div
                    key={stage.id}
                    className="rounded-[24px] border border-white/10 bg-black/14 p-4"
                  >
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={[
                            "mt-1 h-3 w-3 rounded-full",
                            stageState.dotClassName,
                          ].join(" ")}
                        />
                        {index < scenario.workflowStages.length - 1 ? (
                          <div className="mt-2 h-full min-h-12 w-px bg-white/10" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-2xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-white">
                                {stage.title}
                              </div>
                              <span
                                className={[
                                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                  stageState.className,
                                ].join(" ")}
                              >
                                {stageState.label}
                              </span>
                              <span
                                className={[
                                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                  modeMeta.className,
                                ].join(" ")}
                              >
                                <ModeIcon className="h-3.5 w-3.5" />
                                {modeMeta.label}
                              </span>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-white/65">
                              {stage.desc}
                            </div>
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/70">
                            Step {index + 1}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {stage.appIds.map((appId) => (
                            <span
                              key={`${stage.id}:${appId}`}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80"
                            >
                              <ArrowRight className="h-3 w-3" />
                              {getAppDisplayName(appId, appId, language)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-black/14 p-5 text-sm leading-6 text-white/60">
            {copy.noRun}
          </div>
        )}
      </div>
    </div>
  );
}
