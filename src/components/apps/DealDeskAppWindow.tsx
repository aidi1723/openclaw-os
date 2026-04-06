"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, FilePlus2, MessageSquareQuote, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import { SalesHeroWorkflowPanel } from "@/components/workflows/SalesHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createDeal,
  getDeals,
  removeDeal,
  subscribeDeals,
  updateDeal,
  type DealRecord,
  type DealStage,
} from "@/lib/deals";
import { requestOpenClawAgent, requestRealityCheck } from "@/lib/openclaw-agent-client";
import {
  getSalesAssetByWorkflowRunId,
  subscribeSalesAssets,
  upsertSalesAsset,
} from "@/lib/sales-assets";
import {
  buildSalesWorkflowMeta,
  getSalesWorkflowScenario,
} from "@/lib/sales-workflow";
import { createTask, updateTask } from "@/lib/tasks";
import { buildDealDeskSurfaceRecommendation } from "@/lib/workflow-surface-recommendation";
import {
  requestComposeEmail,
  type DealDeskPrefill,
} from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  getWorkflowRun,
  startWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";

const stages: Array<{ value: DealStage; label: string }> = [
  { value: "new", label: "新线索" },
  { value: "qualified", label: "已判断" },
  { value: "proposal", label: "提案中" },
  { value: "blocked", label: "阻塞" },
  { value: "won", label: "已成交" },
];

const inquiryChannels = ["Email", "WhatsApp", "Website Form", "Expo", "Referral"];

const sampleInquiry: DealDeskPrefill = {
  company: "Al Noor Facades LLC",
  contact: "Omar Rahman",
  inquiryChannel: "WhatsApp",
  preferredLanguage: "English + Arabic summary",
  productLine: "断桥铝门窗 / Sliding System",
  need:
    "迪拜住宅项目需要断桥铝推拉门和三层玻璃系统，优先考虑隔热、海边防腐和 6 周内可出货的规格。",
  budget: "USD 28,000 - 35,000",
  timing: "两周内确认方案，下月进入首批下单",
  notes:
    "客户希望先收到英文报价，附阿拉伯语摘要。最关注交期、玻璃配置和最小起订量，接受视频会议进一步确认尺寸。",
  stage: "new",
  workflowTriggerType: "inbound_message",
  workflowSource: "来自 WhatsApp 的海外门窗询盘",
  workflowNextStep: "先确认尺寸、玻璃配置、交期和 MOQ，再生成英文报价跟进邮件。",
};

function buildLocalBrief(deal: DealRecord) {
  return [
    "【Deal Brief】",
    `- 公司：${deal.company || "未填写"}`,
    `- 联系人：${deal.contact || "未填写"}`,
    `- 来源：${deal.inquiryChannel || "未填写"}`,
    `- 产品：${deal.productLine || "未填写"}`,
    `- 语言：${deal.preferredLanguage || "未填写"}`,
    `- 需求：${deal.need || "未填写"}`,
    `- 预算：${deal.budget || "未填写"}`,
    `- 时间：${deal.timing || "未填写"}`,
    "",
    "【判断】",
    "- 先确认需求是否明确、预算是否匹配、时间是否可执行。",
    "",
    "【下一步建议】",
    "- 如果信息不足，先补预算、目标和关键决策人。",
    "- 如果匹配度高，尽快安排方案会或发送提案。",
    "- 如果当前阻塞，明确卡点并设置跟进时间。",
  ].join("\n");
}

function getDefaultTriggerType(deal: DealRecord): WorkflowTriggerType {
  return deal.workflowTriggerType ?? "web_form";
}

export function DealDeskAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetRevision, setAssetRevision] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getDeals();
      setDeals(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeDeals(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const bump = () => setAssetRevision((value) => value + 1);
    const off = subscribeSalesAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<DealDeskPrefill>).detail;
      const id = createDeal({
        company: detail?.company ?? "",
        contact: detail?.contact ?? "",
        inquiryChannel: detail?.inquiryChannel ?? "",
        preferredLanguage: detail?.preferredLanguage ?? "",
        productLine: detail?.productLine ?? "",
        need: detail?.need ?? "",
        budget: detail?.budget ?? "",
        timing: detail?.timing ?? "",
        notes: detail?.notes ?? "",
        stage: detail?.stage ?? "new",
        ...buildSalesWorkflowMeta(detail),
      });
      setSelectedId(id);
      showToast("已带入线索上下文", "ok");
    };
    window.addEventListener("openclaw:deal-desk-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:deal-desk-prefill", onPrefill);
  }, [showToast]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const dealId = (event as CustomEvent<{ dealId?: string }>).detail?.dealId;
      if (!dealId) return;
      const targetDeal = getDeals().find((deal) => deal.id === dealId);
      if (!targetDeal) return;
      setSelectedId(targetDeal.id);
      showToast("已定位到线索记录", "ok");
    };
    window.addEventListener("openclaw:deal-desk-select", onSelect);
    return () => window.removeEventListener("openclaw:deal-desk-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => deals.find((deal) => deal.id === selectedId) ?? null,
    [deals, selectedId],
  );
  const currentSalesAsset = useMemo(() => {
    void assetRevision;
    return getSalesAssetByWorkflowRunId(selected?.workflowRunId);
  }, [assetRevision, selected?.workflowRunId]);
  const surfaceRecommendation = useMemo(
    () => buildDealDeskSurfaceRecommendation({ deal: selected, asset: currentSalesAsset }),
    [currentSalesAsset, selected],
  );

  const patchSelected = (
    patch: Partial<Omit<DealRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateDeal(selected.id, patch);
  };

  const createNew = () => {
    const id = createDeal();
    setSelectedId(id);
    showToast("已新增线索", "ok");
  };

  const createSampleInquiry = () => {
    const id = createDeal({
      company: sampleInquiry.company,
      contact: sampleInquiry.contact,
      inquiryChannel: sampleInquiry.inquiryChannel,
      preferredLanguage: sampleInquiry.preferredLanguage,
      productLine: sampleInquiry.productLine,
      need: sampleInquiry.need,
      budget: sampleInquiry.budget,
      timing: sampleInquiry.timing,
      notes: sampleInquiry.notes,
      stage: sampleInquiry.stage,
      ...buildSalesWorkflowMeta(sampleInquiry),
    });
    setSelectedId(id);
    showToast("已导入样板询盘", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeDeal(selected.id);
    setSelectedId(null);
    showToast("线索已删除", "ok");
  };

  const ensureWorkflowForSelected = (triggerType?: WorkflowTriggerType) => {
    if (!selected) return null;
    const resolvedTriggerType = triggerType ?? getDefaultTriggerType(selected);
    if (selected.workflowRunId) return selected.workflowRunId;
    const scenario = getSalesWorkflowScenario();
    if (!scenario) return null;
    const runId = startWorkflowRun(scenario, resolvedTriggerType);
    patchSelected({
      workflowRunId: runId,
      workflowScenarioId: scenario.id,
      workflowStageId: scenario.workflowStages[0]?.id,
      workflowTriggerType: resolvedTriggerType,
      workflowSource: "来自 Deal Desk 的销售询盘录入",
      workflowNextStep: "先完成线索资格判断，再决定是否进入跟进邮件生成。",
    });
    upsertSalesAsset(runId, {
      scenarioId: scenario.id,
      dealId: selected.id,
      company: selected.company,
      contactName: selected.contact,
      inquiryChannel: selected.inquiryChannel,
      preferredLanguage: selected.preferredLanguage,
      productLine: selected.productLine,
      requirementSummary: selected.need,
      preferenceNotes: selected.notes,
      quoteStatus: "not_started",
      nextAction: "先完成资格判断，确认是否值得推进。",
      status: "qualifying",
    });
    return runId;
  };

  const startInquiryWorkflow = () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    const runId = ensureWorkflowForSelected("inbound_message");
    if (!runId) {
      showToast("销售流程模板不可用", "error");
      return;
    }
    showToast("已启动销售 Hero Workflow", "ok");
  };

  const qualifyDeal = async () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const fallback = buildLocalBrief(selected);
    const taskId = createTask({
      name: "Assistant - Deal qualification",
      status: "running",
      detail: selected.company,
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "sales-pipeline",
      workflowStageId: "qualify",
      workflowSource: selected.workflowSource ?? "Deal Desk 生成销售资格判断简报",
      workflowNextStep: "确认是否值得推进，再进入报价和跟进阶段。",
      workflowTriggerType: selected.workflowTriggerType ?? "manual",
    });
    setIsGenerating(true);
    try {
      const message =
        "请根据当前线索信息输出一份中文资格判断简报。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 严格基于已给信息判断，不要编造预算、规格、交期、MOQ 或客户意图。\n" +
        "2) 如果信息不足，明确指出还缺哪些关键字段。\n" +
        "3) 输出必须使用以下标题：\n" +
        "【是否值得推进】\n【判断理由】\n【缺失信息】\n【风险点】\n【建议下一步】\n\n" +
        `公司：${selected.company}\n` +
        `联系人：${selected.contact || "(未填)"}\n` +
        `询盘来源：${selected.inquiryChannel || "(未填)"}\n` +
        `产品线：${selected.productLine || "(未填)"}\n` +
        `语言偏好：${selected.preferredLanguage || "(未填)"}\n` +
        `需求：${selected.need || "(未填)"}\n` +
        `预算：${selected.budget || "(未填)"}\n` +
        `时间：${selected.timing || "(未填)"}\n` +
        `备注：${selected.notes || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-deal-desk",
        timeoutSeconds: 90,
        expertProfileId: "sales_qualification_specialist",
      });
      const nextBrief = text || fallback;
      let reviewNotes = "";
      try {
        reviewNotes = await requestRealityCheck({
          taskLabel: "销售资格判断简报",
          sourceContext: [
            `公司：${selected.company}`,
            `联系人：${selected.contact || "(未填)"}`,
            `询盘来源：${selected.inquiryChannel || "(未填)"}`,
            `产品线：${selected.productLine || "(未填)"}`,
            `语言偏好：${selected.preferredLanguage || "(未填)"}`,
            `需求：${selected.need || "(未填)"}`,
            `预算：${selected.budget || "(未填)"}`,
            `时间：${selected.timing || "(未填)"}`,
            `备注：${selected.notes || "(未填)"}`,
          ].join("\n"),
          candidateOutput: nextBrief,
          sessionId: "webos-deal-desk-review",
          timeoutSeconds: 45,
        });
      } catch {
        reviewNotes = "";
      }
      const run = runId ? getWorkflowRun(runId) : null;
      patchSelected({
        brief: nextBrief,
        reviewNotes,
        stage: selected.stage === "new" ? "qualified" : selected.stage,
        workflowRunId: runId ?? selected.workflowRunId,
        workflowScenarioId: selected.workflowScenarioId ?? "sales-pipeline",
        workflowStageId: run?.currentStageId === "qualify" ? "outreach" : selected.workflowStageId,
        workflowSource: "Deal Desk 已完成线索资格判断",
        workflowNextStep: "把这条线索送到 Email Assistant 生成首轮跟进邮件，并进行人工审核。",
      });
      if (runId) {
        upsertSalesAsset(runId, {
          scenarioId: "sales-pipeline",
          dealId: selected.id,
          company: selected.company,
          contactName: selected.contact,
          inquiryChannel: selected.inquiryChannel,
          preferredLanguage: selected.preferredLanguage,
          productLine: selected.productLine,
          requirementSummary: selected.need || nextBrief,
          preferenceNotes: selected.notes,
          nextAction: "进入 Email Assistant 生成并审核首轮跟进邮件。",
          quoteNotes: nextBrief,
          quoteStatus: "drafted",
          status: "qualifying",
        });
        if (run?.currentStageId === "qualify") {
          advanceWorkflowRun(runId);
        }
      }
      updateTask(taskId, { status: "done" });
      showToast("线索简报已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({
        brief: fallback,
        reviewNotes: "",
        workflowSource: "Deal Desk 本地兜底生成资格判断",
        workflowNextStep: "建议检查判断内容后，再把线索送入邮件跟进阶段。",
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地简报", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const queueFollowUp = () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    createTask({
      name: `Deal - ${selected.company}`,
      status: "queued",
      detail: selected.need || "安排下一步沟通",
    });
    showToast("已加入任务中心", "ok");
  };

  const saveBriefDraft = () => {
    if (!selected?.brief.trim()) {
      showToast("请先生成线索简报", "error");
      return;
    }
    createDraft({
      title: `${selected.company} Deal Brief`,
      body: selected.brief,
      tags: ["deal", selected.stage],
      source: "import",
      workflowSource: selected.workflowSource,
      workflowNextStep: selected.workflowNextStep,
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToEmailAssistant = () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const run = runId ? getWorkflowRun(runId) : null;
    const nextStep = "在 Email Assistant 生成首轮跟进稿，人工确认后再同步到 Personal CRM。";
    patchSelected({
      workflowRunId: runId ?? selected.workflowRunId,
      workflowStageId: run?.currentStageId === "qualify" ? "outreach" : selected.workflowStageId ?? "outreach",
      workflowSource: "来自 Deal Desk 的已判断线索",
      workflowNextStep: nextStep,
    });
    if (runId) {
      upsertSalesAsset(runId, {
        scenarioId: "sales-pipeline",
        dealId: selected.id,
        company: selected.company,
        contactName: selected.contact,
        requirementSummary: selected.need || selected.brief,
        preferenceNotes: selected.notes,
        nextAction: nextStep,
        status: "awaiting_review",
      });
    }
    requestComposeEmail({
      subject: `关于 ${selected.company || "合作"} 的下一步沟通`,
      recipient: selected.contact,
      goal: "确认需求匹配度并推进下一次沟通",
      tone: "professional",
      context: [
        `公司：${selected.company || "(未填)"}`,
        `联系人：${selected.contact || "(未填)"}`,
        `询盘来源：${selected.inquiryChannel || "(未填)"}`,
        `产品线：${selected.productLine || "(未填)"}`,
        `语言偏好：${selected.preferredLanguage || "(未填)"}`,
        `需求：${selected.need || "(未填)"}`,
        `预算：${selected.budget || "(未填)"}`,
        `时间：${selected.timing || "(未填)"}`,
        selected.brief ? `当前判断：\n${selected.brief}` : "",
        selected.reviewNotes ? `Reality Checker 复核：\n${selected.reviewNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: "sales-pipeline",
      workflowStageId: "outreach",
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: "来自 Deal Desk 的已判断线索",
      workflowNextStep: nextStep,
    });
    showToast("已发送到 Email Assistant", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Deal Desk"
      icon={Briefcase}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.deal_desk"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Lead Qualification / Deal Desk</div>
              <div className="mt-1 text-sm text-gray-500">
                用于判断线索是否值得推进，找缺失信息、风险点，并形成下一步提案动作。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              线索 {deals.length} 条
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <SalesHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.company || "未命名线索"} · 销售推进总览` : "Sales Desk · Hero Workflow"}
            description="把线索判断、邮件跟进和 CRM 收口变成一条可追踪的销售主线，而不是分散的单点操作。"
            emptyHint="先绑定一条线索，再从客户询盘或手动录入启动销售 Hero Workflow。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: selected?.workflowRunId ? "已绑定询盘流程" : "按客户询盘启动",
                onClick: startInquiryWorkflow,
                disabled: !selected || Boolean(selected?.workflowRunId),
              },
              {
                label: "导入样板询盘",
                onClick: createSampleInquiry,
                tone: "secondary",
              },
              {
                label: "送入 Email Assistant",
                onClick: sendToEmailAssistant,
                disabled: !selected,
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">线索列表</div>
                <button
                  type="button"
                  onClick={createNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>
              <button
                type="button"
                onClick={createSampleInquiry}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
              >
                <MessageSquareQuote className="h-4 w-4" />
                导入样板询盘
              </button>

              <div className="mt-3 space-y-2">
                {deals.length > 0 ? (
                  deals.map((deal) => {
                    const active = deal.id === selectedId;
                    return (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => setSelectedId(deal.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{deal.company}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {deal.contact || "未填写联系人"} · {deal.inquiryChannel || "未标注来源"} · {deal.stage}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有线索。
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
                      <div className="text-sm font-semibold text-gray-900">线索信息</div>
                      <div className="mt-1 text-xs text-gray-500">填需求、预算、时间，生成判断简报。</div>
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
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">公司</label>
                      <input
                        value={selected.company}
                        onChange={(e) => patchSelected({ company: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">联系人</label>
                      <input
                        value={selected.contact}
                        onChange={(e) => patchSelected({ contact: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">询盘来源</label>
                      <select
                        value={selected.inquiryChannel}
                        onChange={(e) => patchSelected({ inquiryChannel: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">请选择来源</option>
                        {inquiryChannels.map((channel) => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">语言偏好</label>
                      <input
                        value={selected.preferredLanguage}
                        onChange={(e) => patchSelected({ preferredLanguage: e.target.value })}
                        placeholder="例如：English / Arabic summary"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">产品线 / 场景</label>
                      <input
                        value={selected.productLine}
                        onChange={(e) => patchSelected({ productLine: e.target.value })}
                        placeholder="例如：Sliding System / Casement Window / Curtain Wall"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">预算</label>
                      <input
                        value={selected.budget}
                        onChange={(e) => patchSelected({ budget: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">时间</label>
                      <input
                        value={selected.timing}
                        onChange={(e) => patchSelected({ timing: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">需求</label>
                      <textarea
                        value={selected.need}
                        onChange={(e) => patchSelected({ need: e.target.value })}
                        className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">备注</label>
                      <textarea
                        value={selected.notes}
                        onChange={(e) => patchSelected({ notes: e.target.value })}
                        className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">阶段</label>
                      <select
                        value={selected.stage}
                        onChange={(e) => patchSelected({ stage: e.target.value as DealStage })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {stages.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Inquiry Snapshot</div>
                      <div className="mt-2 grid gap-2 text-sm text-blue-950 md:grid-cols-3">
                        <div>
                          <div className="text-[11px] font-semibold text-blue-600">来源</div>
                          <div className="mt-1">{selected.inquiryChannel || "待补充"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-blue-600">产品线</div>
                          <div className="mt-1">{selected.productLine || "待补充"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-blue-600">语言偏好</div>
                          <div className="mt-1">{selected.preferredLanguage || "待补充"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条线索。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">线索判断简报</div>
                  <div className="mt-1 text-xs text-gray-500">输出判断、风险点和下一步建议。</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={qualifyDeal}
                    disabled={!selected || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "分析中..." : "生成简报"}
                  </button>
                  <button
                    type="button"
                    onClick={queueFollowUp}
                    disabled={!selected}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    加入待办
                  </button>
                  <button
                    type="button"
                    onClick={saveBriefDraft}
                    disabled={!selected}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                  <button
                    type="button"
                    onClick={sendToEmailAssistant}
                    disabled={!selected}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    转到 Email Assistant
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                <RecommendationResultBody
                  recommendation={surfaceRecommendation}
                  tone="blue"
                  actionTitle="执行建议"
                  actionButtonLabel="查看当前线索"
                  maxHitsPerSection={2}
                />
                {selected?.brief ? (
                  <textarea
                    value={selected.brief}
                    onChange={(e) => patchSelected({ brief: e.target.value, reviewNotes: "" })}
                    className="mt-4 h-[280px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-7 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现线索判断简报。
                  </div>
                )}
              </div>

              {selected?.reviewNotes ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Reality Checker
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
                    {selected.reviewNotes}
                  </pre>
                </div>
              ) : null}
            </div>
          </main>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
