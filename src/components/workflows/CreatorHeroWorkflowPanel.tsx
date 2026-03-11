"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Sparkles } from "lucide-react";

import {
  getCreatorRuntimeLabel,
  getCreatorStageStateLabel,
  getCreatorTriggerLabel,
  getCreatorWorkflowNextAction,
  getCreatorWorkflowScenario,
} from "@/lib/creator-workflow";
import { getCreatorAssetByWorkflowRunId, subscribeCreatorAssets, type CreatorAssetRecord } from "@/lib/creator-assets";
import { getWorkflowRuns, subscribeWorkflowRuns, type WorkflowRunRecord } from "@/lib/workflow-runs";

type PanelAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary";
};

type CreatorHeroWorkflowPanelProps = {
  workflowRunId?: string;
  title: string;
  description: string;
  emptyHint: string;
  source?: string;
  nextStep?: string;
  actions?: PanelAction[];
};

function getRunClasses(run: WorkflowRunRecord | null) {
  switch (run?.state) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "awaiting_human":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-white/80 text-slate-600";
  }
}

function getStageClasses(state: string) {
  switch (state) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "awaiting_human":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-white/70 text-slate-500";
  }
}

export function CreatorHeroWorkflowPanel({
  workflowRunId,
  title,
  description,
  emptyHint,
  source,
  nextStep,
  actions = [],
}: CreatorHeroWorkflowPanelProps) {
  const [workflowRuns, setWorkflowRuns] = useState(getWorkflowRuns());
  const [asset, setAsset] = useState<CreatorAssetRecord | null>(() => getCreatorAssetByWorkflowRunId(workflowRunId));
  const scenario = useMemo(() => getCreatorWorkflowScenario(), []);

  useEffect(() => {
    const syncRuns = () => setWorkflowRuns(getWorkflowRuns());
    const syncAsset = () => setAsset(getCreatorAssetByWorkflowRunId(workflowRunId));
    syncRuns();
    syncAsset();
    const offRuns = subscribeWorkflowRuns(syncRuns);
    const offAssets = subscribeCreatorAssets(syncAsset);
    const onStorage = () => {
      syncRuns();
      syncAsset();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      offRuns();
      offAssets();
      window.removeEventListener("storage", onStorage);
    };
  }, [workflowRunId]);

  const run = useMemo(
    () => (workflowRunId ? workflowRuns.find((item) => item.id === workflowRunId) ?? null : null),
    [workflowRunId, workflowRuns],
  );

  return (
    <section className="overflow-hidden rounded-[28px] border border-sky-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_rgba(255,255,255,0.98)_36%,_rgba(236,253,245,0.92)_100%)] p-5 shadow-sm shadow-sky-100/40 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            Creator Hero Workflow
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={[
                  "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-xs font-semibold transition-colors",
                  action.tone === "secondary"
                    ? "border border-slate-200 bg-white/90 text-slate-900 hover:bg-white"
                    : "bg-slate-950 text-white hover:bg-black",
                  action.disabled ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <div className={["rounded-full border px-3 py-1 text-xs font-semibold", getRunClasses(run)].join(" ")}>
              {getCreatorRuntimeLabel(run?.state)}
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {getCreatorTriggerLabel(run?.triggerType)}
            </div>
            {run?.updatedAt ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(run.updatedAt).toLocaleString()}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workflow Source</div>
              <div className="mt-2 text-sm leading-6 text-slate-800">{source || "当前还没有内容链上下文来源。"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Next Suggested Action</div>
              <div className="mt-2 text-sm leading-6 text-slate-800">
                {nextStep || asset?.nextAction || getCreatorWorkflowNextAction(run)}
              </div>
            </div>
          </div>

          {run && scenario ? (
            <div className="mt-4 grid gap-3">
              {scenario.workflowStages.map((stage) => {
                const stageRun = run.stageRuns.find((item) => item.id === stage.id);
                const state = stageRun?.state ?? "pending";
                return (
                  <div key={stage.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-slate-400" />
                          <div className="text-sm font-semibold text-slate-900">{stage.title}</div>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{stage.desc}</div>
                      </div>
                      <div className={["rounded-full border px-3 py-1 text-xs font-semibold", getStageClasses(state)].join(" ")}>
                        {getCreatorStageStateLabel(state)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-5 text-sm leading-6 text-slate-500">
              {emptyHint}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-white/70 bg-[#0f172a] p-4 text-white shadow-lg shadow-slate-900/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300">Local Creator Asset</div>
          <div className="mt-3 text-lg font-semibold text-white">{asset?.topic || "还没有内容资产快照"}</div>
          <div className="mt-1 text-sm leading-6 text-slate-300">
            {asset?.audience || "选题、内容包、发布候选稿和复用笔记会逐步沉淀到这里。"}
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">主要角度</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.primaryAngle || "等待 Radar 写入。"} </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">内容包状态</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.publishStatus || "not_started"} </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">发布目标</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">
                {asset?.publishTargets.length ? asset.publishTargets.join(" / ") : "等待 Publisher 预演。"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
