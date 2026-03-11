"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";

import { getSalesAssetByWorkflowRunId, subscribeSalesAssets, type SalesAssetRecord } from "@/lib/sales-assets";
import {
  getSalesRuntimeLabel,
  getSalesStageStateLabel,
  getSalesTriggerLabel,
  getSalesWorkflowNextAction,
  getSalesWorkflowScenario,
} from "@/lib/sales-workflow";
import { getWorkflowRuns, subscribeWorkflowRuns, type WorkflowRunRecord } from "@/lib/workflow-runs";

type PanelAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary";
};

type SalesHeroWorkflowPanelProps = {
  workflowRunId?: string;
  title: string;
  description: string;
  emptyHint: string;
  source?: string;
  nextStep?: string;
  actions?: PanelAction[];
};

function getRuntimeClasses(run: WorkflowRunRecord | null) {
  switch (run?.state) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "awaiting_human":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-700";
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
      return "border-slate-200 bg-white/75 text-slate-500";
  }
}

function ActionButton({ action }: { action: PanelAction }) {
  const toneClass =
    action.tone === "secondary"
      ? "border border-slate-200 bg-white/90 text-slate-900 hover:bg-white"
      : "bg-slate-950 text-white hover:bg-black";
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={[
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-xs font-semibold transition-colors",
        toneClass,
        action.disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {action.label}
    </button>
  );
}

export function SalesHeroWorkflowPanel({
  workflowRunId,
  title,
  description,
  emptyHint,
  source,
  nextStep,
  actions = [],
}: SalesHeroWorkflowPanelProps) {
  const [workflowRuns, setWorkflowRuns] = useState(getWorkflowRuns());
  const [asset, setAsset] = useState<SalesAssetRecord | null>(() => getSalesAssetByWorkflowRunId(workflowRunId));
  const scenario = useMemo(() => getSalesWorkflowScenario(), []);

  useEffect(() => {
    const syncRuns = () => setWorkflowRuns(getWorkflowRuns());
    const syncAsset = () => setAsset(getSalesAssetByWorkflowRunId(workflowRunId));
    syncRuns();
    syncAsset();
    const offRuns = subscribeWorkflowRuns(syncRuns);
    const offAssets = subscribeSalesAssets(syncAsset);
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
    <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.26),_rgba(255,255,255,0.98)_38%,_rgba(226,232,240,0.9)_100%)] p-5 shadow-sm shadow-amber-100/40 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
            <Sparkles className="h-3.5 w-3.5" />
            Sales Hero Workflow
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <ActionButton key={action.label} action={action} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="rounded-[24px] border border-white/70 bg-white/80 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <div className={["rounded-full border px-3 py-1 text-xs font-semibold", getRuntimeClasses(run)].join(" ")}>
              {getSalesRuntimeLabel(run?.state)}
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {getSalesTriggerLabel(run?.triggerType)}
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
              <div className="mt-2 text-sm leading-6 text-slate-800">{source || "当前还没有跨应用上下文来源。"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Next Suggested Action</div>
              <div className="mt-2 text-sm leading-6 text-slate-800">
                {nextStep || asset?.nextAction || getSalesWorkflowNextAction(run)}
              </div>
            </div>
          </div>

          {run && scenario ? (
            <div className="mt-4 grid gap-3">
              {scenario.workflowStages.map((stage) => {
                const stageRun = run.stageRuns.find((item) => item.id === stage.id);
                const state = stageRun?.state ?? "pending";
                return (
                  <div
                    key={stage.id}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-slate-400" />
                          <div className="text-sm font-semibold text-slate-900">{stage.title}</div>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{stage.desc}</div>
                      </div>
                      <div className={["rounded-full border px-3 py-1 text-xs font-semibold", getStageClasses(state)].join(" ")}>
                        {getSalesStageStateLabel(state)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                        {stage.mode === "assist" ? "AI 辅助" : stage.mode === "review" ? "人工确认" : stage.mode === "manual" ? "人工执行" : "自动执行"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ArrowRight className="h-3.5 w-3.5" />
                        {stage.appIds.join(" / ")}
                      </span>
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

        <div className="rounded-[24px] border border-white/70 bg-[#111827] p-4 text-white shadow-lg shadow-slate-900/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">Local Sales Asset</div>
          <div className="mt-3 text-lg font-semibold text-white">
            {asset?.company || "还没有资产快照"}
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-300">
            {asset?.contactName || "完成资格判断、邮件审核和 CRM 同步后，这里会逐步沉淀客户偏好与推进规则。"}
          </div>

          <div className="mt-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">触发来源</div>
                <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.inquiryChannel || "等待询盘来源"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">产品线</div>
                <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.productLine || "等待产品归类"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">语言偏好</div>
                <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.preferredLanguage || "等待语言偏好"}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">需求摘要</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.requirementSummary || "等待 Deal Desk 写入。"} </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">客户偏好 / 风险</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.preferenceNotes || "等待 Email Assistant 和 CRM 同步。"} </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">报价状态</div>
                <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  {asset?.quoteStatus || "not_started"}
                </div>
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-200">{asset?.quoteNotes || "等待首轮报价或跟进草稿。"} </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">最近输出</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">
                {asset?.latestDraftSubject || "等待首轮跟进邮件。"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
