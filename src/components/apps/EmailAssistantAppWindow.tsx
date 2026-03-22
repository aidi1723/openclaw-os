"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Mail, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { SalesHeroWorkflowPanel } from "@/components/workflows/SalesHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createEmailThread,
  getEmailThreads,
  removeEmailThread,
  subscribeEmailThreads,
  updateEmailThread,
  type EmailThread,
  type EmailTone,
} from "@/lib/email-assistant";
import { requestOpenClawAgent, requestRealityCheck } from "@/lib/openclaw-agent-client";
import { upsertSalesAsset } from "@/lib/sales-assets";
import { createTask, updateTask } from "@/lib/tasks";
import type { EmailAssistantPrefill } from "@/lib/ui-events";
import { requestOpenCrm } from "@/lib/ui-events";
import { getWorkflowRun, setWorkflowRunAwaitingHuman, advanceWorkflowRun } from "@/lib/workflow-runs";

const tones: Array<{ value: EmailTone; label: string }> = [
  { value: "professional", label: "专业" },
  { value: "warm", label: "温和" },
  { value: "direct", label: "直接" },
];

function buildLocalDraft(thread: EmailThread) {
  const salutation = thread.recipient.trim() ? `你好 ${thread.recipient.trim()}，` : "你好，";
  return [
    salutation,
    "",
    `关于「${thread.subject || "当前事项"}」，我想先同步一下进展。`,
    thread.context.trim() || "这里补充背景和上下文。",
    "",
    `接下来希望达成的目标是：${thread.goal.trim() || "确认下一步和时间安排。"}。`,
    "如果你方便，也欢迎直接回复你更合适的时间或补充信息。",
    "",
    "谢谢。",
  ].join("\n");
}

function extractContextValue(context: string, label: string) {
  const row = context
    .split("\n")
    .find((line) => line.trim().startsWith(`${label}：`) || line.trim().startsWith(`${label}:`));
  if (!row) return "";
  return row.split(/[:：]/).slice(1).join(":").trim();
}

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function EmailAssistantAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getEmailThreads();
      setThreads(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeEmailThreads(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<EmailAssistantPrefill>).detail;
      const id = createEmailThread({
        subject: detail?.subject ?? "",
        recipient: detail?.recipient ?? "",
        context: detail?.context ?? "",
        goal: detail?.goal ?? "",
        tone: detail?.tone ?? "professional",
        draft: detail?.draft ?? "",
        workflowRunId: detail?.workflowRunId,
        workflowScenarioId: detail?.workflowScenarioId,
        workflowStageId: detail?.workflowStageId,
        workflowSource: detail?.workflowSource,
        workflowNextStep: detail?.workflowNextStep,
        workflowTriggerType: detail?.workflowTriggerType,
      });
      setSelectedId(id);
      showToast("已带入邮件上下文", "ok");
    };
    window.addEventListener("openclaw:email-assistant-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:email-assistant-prefill", onPrefill);
  }, [showToast]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const threadId = (event as CustomEvent<{ threadId?: string }>).detail?.threadId;
      if (!threadId) return;
      const targetThread = getEmailThreads().find((thread) => thread.id === threadId);
      if (!targetThread) return;
      setSelectedId(targetThread.id);
      showToast("已定位到邮件线程", "ok");
    };
    window.addEventListener("openclaw:email-assistant-select", onSelect);
    return () =>
      window.removeEventListener("openclaw:email-assistant-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? null,
    [threads, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<EmailThread, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateEmailThread(selected.id, patch);
  };

  const createNew = () => {
    const id = createEmailThread();
    setSelectedId(id);
    showToast("已新增邮件草稿", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeEmailThread(selected.id);
    setSelectedId(null);
    showToast("邮件草稿已删除", "ok");
  };

  const generateDraft = async () => {
    if (!selected) {
      showToast("请先选择邮件项", "error");
      return;
    }
    const fallback = buildLocalDraft(selected);
    const taskId = createTask({
      name: "Assistant - Email draft",
      status: "running",
      detail: selected.subject,
    });
    setIsGenerating(true);
    try {
      const message =
        "请根据用户信息生成一封可直接人工审核的邮件草稿。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 结构清楚，结尾要有清晰下一步。\n" +
        "2) 语气按照指定风格。\n" +
        "3) 不得编造价格、折扣、交期、MOQ、规格或合同承诺。\n" +
        "4) 如果关键事实缺失，使用待确认表达，不要自行补全。\n" +
        "5) 输出只能是邮件正文，不要附加解释。\n\n" +
        `主题：${selected.subject}\n` +
        `收件人：${selected.recipient || "(未填)"}\n` +
        `风格：${selected.tone}\n` +
        `背景：${selected.context || "(未填)"}\n` +
        `目标：${selected.goal || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-email-assistant",
        timeoutSeconds: 90,
        expertProfileId: "outreach_draft_specialist",
      });
      const nextDraft = text || fallback;
      let reviewNotes = "";
      try {
        reviewNotes = await requestRealityCheck({
          taskLabel: "销售跟进邮件草稿",
          sourceContext: [
            `主题：${selected.subject}`,
            `收件人：${selected.recipient || "(未填)"}`,
            `风格：${selected.tone}`,
            `背景：${selected.context || "(未填)"}`,
            `目标：${selected.goal || "(未填)"}`,
          ].join("\n"),
          candidateOutput: nextDraft,
          sessionId: "webos-email-assistant-review",
          timeoutSeconds: 45,
        });
      } catch {
        reviewNotes = "";
      }
      patchSelected({
        draft: nextDraft,
        reviewNotes,
        workflowStageId: selected.workflowRunId ? "outreach" : selected.workflowStageId,
        workflowSource: selected.workflowSource || "Email Assistant 已接收销售跟进上下文",
        workflowNextStep: "人工检查邮件语气、报价边界和 CTA，确认后再同步到 Personal CRM。",
      });
      if (selected.workflowRunId) {
        upsertSalesAsset(selected.workflowRunId, {
          scenarioId: "sales-pipeline",
          emailThreadId: selected.id,
          company: extractContextValue(selected.context, "公司"),
          contactName: selected.recipient,
          inquiryChannel: extractContextValue(selected.context, "询盘来源"),
          preferredLanguage: extractContextValue(selected.context, "语言偏好"),
          productLine: extractContextValue(selected.context, "产品线"),
          requirementSummary: extractContextValue(selected.context, "需求"),
          preferenceNotes: extractContextValue(selected.context, "预算") || extractContextValue(selected.context, "时间"),
          objectionNotes: extractContextValue(selected.context, "当前判断"),
          nextAction: "人工审核这封跟进邮件，然后把结果同步到 Personal CRM。",
          latestDraftSubject: selected.subject,
          latestDraftBody: nextDraft,
          quoteStatus: "drafted",
          status: "awaiting_review",
        });
        setWorkflowRunAwaitingHuman(selected.workflowRunId);
      }
      updateTask(taskId, { status: "done" });
      showToast("邮件草稿已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({
        draft: fallback,
        reviewNotes: "",
        workflowSource: selected.workflowSource || "Email Assistant 本地兜底生成邮件草稿",
        workflowNextStep: "建议人工检查后，再继续同步到 CRM。",
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地草稿", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAsDraft = () => {
    if (!selected?.draft.trim()) {
      showToast("请先生成邮件草稿", "error");
      return;
    }
    createDraft({
      title: selected.subject || "邮件草稿",
      body: selected.draft,
      tags: ["email", selected.tone],
      source: "import",
      workflowSource: selected.workflowSource,
      workflowNextStep: selected.workflowNextStep,
    });
    showToast("已保存到草稿", "ok");
  };

  const syncToCrm = () => {
    if (!selected) {
      showToast("请先选择邮件项", "error");
      return;
    }
    const company = extractContextValue(selected.context, "公司");
    const need = extractContextValue(selected.context, "需求");
    const nextStep = "等待客户回复，并根据回复安排下一次沟通或报价。";
    if (selected.workflowRunId) {
      const run = getWorkflowRun(selected.workflowRunId);
      if (run?.currentStageId === "outreach") {
        advanceWorkflowRun(selected.workflowRunId);
      }
      upsertSalesAsset(selected.workflowRunId, {
        scenarioId: "sales-pipeline",
        emailThreadId: selected.id,
        company,
        contactName: selected.recipient,
        inquiryChannel: extractContextValue(selected.context, "询盘来源"),
        preferredLanguage: extractContextValue(selected.context, "语言偏好"),
        productLine: extractContextValue(selected.context, "产品线"),
        requirementSummary: need,
        preferenceNotes: selected.context,
        objectionNotes: extractContextValue(selected.context, "当前判断"),
        nextAction: nextStep,
        latestDraftSubject: selected.subject,
        latestDraftBody: selected.draft,
        quoteStatus: "reviewed",
        status: "crm_syncing",
      });
    }
    patchSelected({
      workflowStageId: selected.workflowRunId ? "meeting" : selected.workflowStageId,
      workflowSource: "Email Assistant 已完成人工审核，准备同步 CRM",
      workflowNextStep: "在 Personal CRM 记录最近触达、客户偏好和下一步动作，完成本轮销售闭环。",
    });
    requestOpenCrm({
      name: selected.recipient,
      company,
      role: "客户联系人",
      status: "active",
      lastTouch: getTodayDateInputValue(),
      nextStep,
      notes: [
        `邮件主题：${selected.subject || "(未填)"}`,
        need ? `需求：${need}` : "",
        selected.draft ? `已审核草稿：\n${selected.draft}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "sales-pipeline",
      workflowStageId: "meeting",
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: "来自 Email Assistant 的已审核跟进邮件",
      workflowNextStep: "把触达记录、客户偏好和后续动作写入 CRM，然后完成本轮销售工作流。",
    });
    showToast("已发送到 Personal CRM", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Email Assistant"
      icon={Mail}
      widthClassName="w-[1160px]"
      storageKey="openclaw.window.email_assistant"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Email Assistant</div>
              <div className="mt-1 text-sm text-gray-500">
                用于写首封、跟进、回复和重写邮件。优先调用 OpenClaw，不可用时回退本地草稿。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              邮件条目 {threads.length}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <SalesHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.subject || "未命名邮件"} · 跟进审核阶段` : "Email Assistant · Hero Workflow"}
            description="这里承担销售链路里最关键的人机协作边界: AI 起草，人工审核，再交给 CRM 做客户推进收口。"
            emptyHint="当邮件是从 Deal Desk 送过来时，这里会自动显示所属销售 Hero Workflow。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: "生成邮件",
                onClick: generateDraft,
                disabled: !selected || isGenerating,
              },
              {
                label: "审核后同步 CRM",
                onClick: syncToCrm,
                disabled: !selected,
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">邮件列表</div>
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
                {threads.length > 0 ? (
                  threads.map((thread) => {
                    const active = thread.id === selectedId;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedId(thread.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{thread.subject}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {thread.recipient || "未填写收件人"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有邮件条目。
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
                      <div className="mt-1 text-xs text-gray-500">填写邮件背景、目标和语气。</div>
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
                      <label className="mb-2 block text-xs font-semibold text-gray-600">主题</label>
                      <input
                        value={selected.subject}
                        onChange={(e) => patchSelected({ subject: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">收件人</label>
                      <input
                        value={selected.recipient}
                        onChange={(e) => patchSelected({ recipient: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">目标</label>
                      <input
                        value={selected.goal}
                        onChange={(e) => patchSelected({ goal: e.target.value })}
                        placeholder="例如：约个时间确认方案 / 催进度 / 跟进报价"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">背景上下文</label>
                      <textarea
                        value={selected.context}
                        onChange={(e) => patchSelected({ context: e.target.value })}
                        className="h-32 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">语气</label>
                      <select
                        value={selected.tone}
                        onChange={(e) => patchSelected({ tone: e.target.value as EmailTone })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {tones.map((tone) => (
                          <option key={tone.value} value={tone.value}>
                            {tone.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一个邮件条目。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">邮件草稿</div>
                  <div className="mt-1 text-xs text-gray-500">生成后可继续手改，也可保存到通用草稿箱。</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateDraft}
                    disabled={!selected || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成邮件"}
                  </button>
                  <button
                    type="button"
                    onClick={saveAsDraft}
                    disabled={!selected}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {selected?.draft ? (
                  <textarea
                    value={selected.draft}
                    onChange={(e) => patchSelected({ draft: e.target.value, reviewNotes: "" })}
                    className="h-[280px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-7 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现邮件草稿。
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
