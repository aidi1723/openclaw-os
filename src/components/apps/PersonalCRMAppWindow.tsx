"use client";

import { useEffect, useMemo, useState } from "react";
import { MailPlus, Plus, Sparkles, Trash2, Users } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { SalesHeroWorkflowPanel } from "@/components/workflows/SalesHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  createContact,
  getContacts,
  removeContact,
  subscribeContacts,
  updateContact,
  type ContactRecord,
  type ContactStatus,
} from "@/lib/crm";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { upsertKnowledgeAsset } from "@/lib/knowledge-assets";
import {
  getSalesAssetByWorkflowRunId,
  subscribeSalesAssets,
  upsertSalesAsset,
} from "@/lib/sales-assets";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenKnowledgeVault } from "@/lib/ui-events";
import type { PersonalCrmPrefill } from "@/lib/ui-events";
import { completeWorkflowRun } from "@/lib/workflow-runs";

const statusOptions: Array<{ value: ContactStatus; label: string }> = [
  { value: "lead", label: "线索" },
  { value: "warm", label: "升温中" },
  { value: "active", label: "推进中" },
  { value: "watch", label: "观察中" },
];

function buildLocalOutreach(contact: ContactRecord) {
  return [
    `给 ${contact.name || "这位联系人"} 的下一步建议：`,
    `1. 先引用最近上下文：${contact.notes.trim() || "上次沟通内容 / 当前需求"}`,
    `2. 明确下一步动作：${contact.nextStep.trim() || "确认需求、约时间、推进下一次沟通"}`,
    "3. 保持短句、低压、可回复。",
    "",
    "示例消息：",
    `你好 ${contact.name || ""}，上次关于 ${contact.company || "项目"} 的沟通我已经整理了下一步方案。` +
      `如果你这周方便，我可以把 ${contact.nextStep.trim() || "具体方案"} 发你确认，看看是否继续推进。`,
  ].join("\n");
}

function isOverdue(contact: ContactRecord) {
  if (!contact.lastTouch) return false;
  const lastTouch = new Date(contact.lastTouch).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Number.isFinite(lastTouch) && Date.now() - lastTouch > sevenDays;
}

export function PersonalCRMAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [assetRevision, setAssetRevision] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getContacts();
      setContacts(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeContacts(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<PersonalCrmPrefill>).detail;
      const id = createContact({
        name: detail?.name ?? "",
        company: detail?.company ?? "",
        role: detail?.role ?? "",
        status: detail?.status ?? "lead",
        lastTouch: detail?.lastTouch ?? "",
        nextStep: detail?.nextStep ?? "",
        notes: detail?.notes ?? "",
        workflowRunId: detail?.workflowRunId,
        workflowScenarioId: detail?.workflowScenarioId,
        workflowStageId: detail?.workflowStageId,
        workflowSource: detail?.workflowSource,
        workflowNextStep: detail?.workflowNextStep,
        workflowTriggerType: detail?.workflowTriggerType,
      });
      setSelectedId(id);
      showToast("已带入 CRM 上下文", "ok");
    };
    window.addEventListener("openclaw:crm-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:crm-prefill", onPrefill);
  }, [showToast]);

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
    const onSelect = (event: Event) => {
      const contactId = (event as CustomEvent<{ contactId?: string }>).detail?.contactId;
      if (!contactId) return;
      const targetContact = getContacts().find((contact) => contact.id === contactId);
      if (!targetContact) return;
      setSelectedId(targetContact.id);
      showToast("已定位到 CRM 记录", "ok");
    };
    window.addEventListener("openclaw:crm-select", onSelect);
    return () => window.removeEventListener("openclaw:crm-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) ?? null,
    [contacts, selectedId],
  );
  const currentSalesAsset = useMemo(() => {
    void assetRevision;
    return getSalesAssetByWorkflowRunId(selected?.workflowRunId);
  }, [assetRevision, selected?.workflowRunId]);

  const stats = useMemo(
    () => ({
      total: contacts.length,
      overdue: contacts.filter(isOverdue).length,
    }),
    [contacts],
  );

  const patchSelected = (patch: Partial<Omit<ContactRecord, "id" | "createdAt" | "updatedAt">>) => {
    if (!selected) return;
    updateContact(selected.id, patch);
  };

  const createNewContact = () => {
    const id = createContact();
    setSelectedId(id);
    showToast("已新增联系人", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeContact(selected.id);
    setSuggestion("");
    setSelectedId((current) => (current === selected.id ? null : current));
    showToast("联系人已删除", "ok");
  };

  const generateOutreach = async () => {
    if (!selected) {
      showToast("请先选择联系人", "error");
      return;
    }
    const fallback = buildLocalOutreach(selected);
    const taskId = createTask({
      name: "Assistant - CRM outreach",
      status: "running",
      detail: selected.name,
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Personal CRM 助手。请根据联系人信息，输出一段中文关系推进建议。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先给出下一步策略。\n" +
        "2) 再给出一段可直接发送的消息草稿。\n" +
        "3) 语气自然，不要太营销。\n\n" +
        `联系人：${selected.name}\n` +
        `公司：${selected.company || "(未填)"}\n` +
        `角色：${selected.role || "(未填)"}\n` +
        `状态：${selected.status}\n` +
        `最近沟通：${selected.lastTouch || "(未填)"}\n` +
        `下一步：${selected.nextStep || "(未填)"}\n` +
        `备注：${selected.notes || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-personal-crm",
        timeoutSeconds: 90,
      });
      if (selected.workflowRunId) {
        upsertSalesAsset(selected.workflowRunId, {
          scenarioId: "sales-pipeline",
          contactId: selected.id,
          company: selected.company,
          contactName: selected.name,
          preferredLanguage: selected.notes.includes("Arabic") ? "English + Arabic summary" : "",
          requirementSummary: selected.nextStep,
          preferenceNotes: selected.notes,
          objectionNotes: text || fallback,
          nextAction: "根据 CRM 建议安排下一次联系，并确认是否完成这一轮销售流程。",
          quoteStatus: "crm_logged",
          status: "crm_syncing",
        });
      }
      setSuggestion(text || fallback);
      updateTask(taskId, { status: "done" });
      showToast("触达建议已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setSuggestion(fallback);
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地建议", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const addFollowUpTask = () => {
    if (!selected) {
      showToast("请先选择联系人", "error");
      return;
    }
    createTask({
      name: `CRM - Follow up ${selected.name}`,
      status: "queued",
      detail: selected.nextStep.trim() || "安排下一次联系",
    });
    showToast("已加入任务中心", "ok");
  };

  const saveSuggestionToDraft = () => {
    if (!selected || !suggestion.trim()) {
      showToast("请先生成触达建议", "error");
      return;
    }
    createDraft({
      title: `${selected.name} 跟进消息`,
      body: suggestion,
      tags: ["crm", selected.status],
      source: "import",
      workflowSource: selected.workflowSource,
      workflowNextStep: selected.workflowNextStep,
    });
    showToast("已保存到草稿", "ok");
  };

  const completeSalesWorkflow = async () => {
    if (!selected) {
      showToast("请先选择联系人", "error");
      return;
    }
    let assetDraft = "";
    try {
      assetDraft = await requestOpenClawAgent({
        message: [
          "请把下面这轮销售推进结果整理成一份可复用的销售资产草稿。",
          `${getOutputLanguageInstruction()}`,
          "要求：",
          "1) 使用以下标题输出：",
          "【适用场景】",
          "【客户画像与偏好】",
          "【有效跟进策略】",
          "【禁忌与风险】",
          "【下次可复用模板】",
          "2) 严格基于已知信息，不要编造客户背景或成交结果。",
          "",
          `联系人：${selected.name}`,
          `公司：${selected.company || "(未填)"}`,
          `角色：${selected.role || "(未填)"}`,
          `状态：${selected.status}`,
          `最近联系：${selected.lastTouch || "(未填)"}`,
          `下一步：${selected.nextStep || "(未填)"}`,
          `备注：${selected.notes || "(未填)"}`,
          `当前建议：${suggestion || "(未生成)"}`,
        ].join("\n"),
        sessionId: "webos-personal-crm-assetize",
        timeoutSeconds: 60,
        expertProfileId: "knowledge_asset_editor",
      });
    } catch {
      assetDraft = "";
    }
    patchSelected({
      workflowSource: "Personal CRM 已完成本轮客户推进记录",
      workflowNextStep: "本轮流程已完成，可复用沉淀的话术、偏好和推进规则。",
      workflowStageId: selected.workflowRunId ? "assetize" : selected.workflowStageId,
    });
    if (selected.workflowRunId) {
      upsertSalesAsset(selected.workflowRunId, {
        scenarioId: "sales-pipeline",
        contactId: selected.id,
        company: selected.company,
        contactName: selected.name,
        requirementSummary: selected.nextStep,
        preferenceNotes: selected.notes,
        objectionNotes: suggestion,
        nextAction: "当前轮次已完成，下一次可按客户反馈重新启动跟进。",
        latestDraftBody: suggestion,
        assetDraft,
        quoteStatus: "completed",
        status: "completed",
      });
      completeWorkflowRun(selected.workflowRunId);
    }
    if (assetDraft.trim()) {
      requestOpenKnowledgeVault({
        query: assetDraft,
      });
    }
    showToast("已完成销售 Hero Workflow", "ok");
  };

  const saveSalesAssetToVault = () => {
    if (!selected?.workflowRunId) {
      showToast("请先完成一轮销售流程", "error");
      return;
    }
    const salesAsset = getSalesAssetByWorkflowRunId(selected.workflowRunId);
    const sourceKey = `sales:${selected.workflowRunId}`;
    const body =
      salesAsset?.assetDraft ||
      [
      `联系人：${selected.name || "(未填)"}`,
      `公司：${selected.company || "(未填)"}`,
      `角色：${selected.role || "(未填)"}`,
      `下一步：${selected.nextStep || "(未填)"}`,
      `备注：${selected.notes || "(未填)"}`,
      suggestion ? `当前推进建议：\n${suggestion}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    upsertKnowledgeAsset(sourceKey, {
      title: `${selected.company || selected.name || "销售"} · 跟进资产`,
      body,
      sourceApp: "personal_crm",
      scenarioId: selected.workflowScenarioId ?? "sales-pipeline",
      workflowRunId: selected.workflowRunId,
      assetType: "sales_playbook",
      status: "active",
      tags: ["sales", "crm", "followup", "playbook"],
      applicableScene: "销售跟进 / CRM 收口 / 下次客户推进复用",
      sourceJumpTarget: {
        kind: "record",
        appId: "personal_crm",
        eventName: "openclaw:crm-select",
        eventDetail: { contactId: selected.id },
      },
    });
    requestOpenKnowledgeVault({
      query: selected.company || selected.name || "销售资产",
    });
    showToast("销售资产已确认入库", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Personal CRM"
      icon={Users}
      widthClassName="w-[1160px]"
      storageKey="openclaw.window.personal_crm"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Personal CRM</div>
              <div className="mt-1 text-sm text-gray-500">
                对应 awesome-openclaw-usecases 里的 Personal CRM。维护联系人、跟进状态，并快速生成下一步触达建议。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                联系人 {stats.total} 个
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                超 7 天未跟进 {stats.overdue} 个
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <SalesHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.name || "未命名联系人"} · CRM 收口阶段` : "Personal CRM · Hero Workflow"}
            description="CRM 不只是联系人列表，它是销售 Hero Workflow 的资产落点，用来保留偏好、节奏和下一步规则。"
            emptyHint="当联系人是从销售链路同步过来时，这里会显示运行状态和已经沉淀的销售资产。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: "生成跟进建议",
                onClick: generateOutreach,
                disabled: isGenerating || !selected,
              },
              {
                label: "完成本轮流程",
                onClick: completeSalesWorkflow,
                disabled: !selected,
                tone: "secondary",
              },
              {
                label: "确认入库",
                onClick: saveSalesAssetToVault,
                disabled: !selected?.workflowRunId,
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">联系人列表</div>
                <button
                  type="button"
                  onClick={createNewContact}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {contacts.length > 0 ? (
                  contacts.map((contact) => {
                    const active = contact.id === selectedId;
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedId(contact.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">
                          {contact.name || "未命名联系人"}
                        </div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {[contact.company, contact.role].filter(Boolean).join(" · ") || "待补充资料"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有联系人，先新建一个。
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
                      <div className="text-sm font-semibold text-gray-900">联系人详情</div>
                      <div className="mt-1 text-xs text-gray-500">
                        这些信息会被用来生成下一步推进建议。
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
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        姓名
                      </label>
                      <input
                        value={selected.name}
                        onChange={(e) => patchSelected({ name: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        公司
                      </label>
                      <input
                        value={selected.company}
                        onChange={(e) => patchSelected({ company: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        角色 / 关系
                      </label>
                      <input
                        value={selected.role}
                        onChange={(e) => patchSelected({ role: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        状态
                      </label>
                      <select
                        value={selected.status}
                        onChange={(e) => patchSelected({ status: e.target.value as ContactStatus })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        最近联系日期
                      </label>
                      <input
                        type="date"
                        value={selected.lastTouch}
                        onChange={(e) => patchSelected({ lastTouch: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">
                        下一步
                      </label>
                      <input
                        value={selected.nextStep}
                        onChange={(e) => patchSelected({ nextStep: e.target.value })}
                        placeholder="例如：约 Demo / 发方案 / 跟进预算"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold text-gray-600">
                      备注
                    </label>
                    <textarea
                      value={selected.notes}
                      onChange={(e) => patchSelected({ notes: e.target.value })}
                      placeholder="记录对方需求、背景、偏好、最近沟通结果。"
                      className="h-32 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一个联系人。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">AI 跟进建议</div>
                  <div className="mt-1 text-xs text-gray-500">
                    适合做客户跟进、合作推进、关系维护的短消息草稿。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateOutreach}
                    disabled={isGenerating || !selected}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成建议"}
                  </button>
                  <button
                    type="button"
                    onClick={addFollowUpTask}
                    disabled={!selected}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MailPlus className="h-4 w-4" />
                    加入待办
                  </button>
                  <button
                    type="button"
                    onClick={saveSuggestionToDraft}
                    disabled={!selected}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    保存草稿
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {suggestion ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
                    {suggestion}
                  </pre>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现跟进策略和消息草稿。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">销售资产草稿</div>
                  <div className="mt-1 text-xs text-gray-500">
                    这里是 Knowledge Asset Editor 整理出的销售沉淀草稿。你可以先编辑，再确认入库。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveSalesAssetToVault}
                  disabled={!selected?.workflowRunId || !currentSalesAsset?.assetDraft?.trim()}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  确认入库
                </button>
              </div>

              <div className="pt-4">
                {currentSalesAsset?.assetDraft ? (
                  <textarea
                    value={currentSalesAsset.assetDraft}
                    onChange={(e) => {
                      if (!selected?.workflowRunId) return;
                      upsertSalesAsset(selected.workflowRunId, {
                        assetDraft: e.target.value,
                      });
                    }}
                    className="h-[220px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-7 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    完成本轮流程后，这里会出现可编辑的销售资产草稿。
                  </div>
                )}
              </div>
            </div>
          </main>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
