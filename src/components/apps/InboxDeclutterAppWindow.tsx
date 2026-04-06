"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Inbox, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import { SupportHeroWorkflowPanel } from "@/components/workflows/SupportHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { upsertSupportAsset } from "@/lib/support-assets";
import { buildSupportWorkflowMeta, getSupportWorkflowScenario } from "@/lib/support-workflow";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createInboxDigest,
  createInboxItem,
  getInboxDigests,
  getInboxItems,
  removeInboxItem,
  subscribeInbox,
  updateInboxItem,
  type InboxDigest,
  type InboxItem,
  type InboxSource,
} from "@/lib/inbox";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { buildInboxDeclutterSurfaceRecommendation } from "@/lib/workflow-surface-recommendation";
import { requestComposeEmail, requestOpenSupportCopilot } from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  getWorkflowRun,
  startWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";

const sourceOptions: Array<{ value: InboxSource; label: string }> = [
  { value: "newsletter", label: "Newsletter" },
  { value: "client", label: "客户邮件" },
  { value: "internal", label: "内部沟通" },
];

function buildLocalDigest(items: InboxItem[], focus: string) {
  const sourceCount = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.source] = (acc[item.source] ?? 0) + 1;
    return acc;
  }, {});

  return [
    "【Inbox Digest】",
    `- 当前重点：${focus.trim() || "先处理最重要的 2-3 封邮件。"}`,
    `- 收件箱汇总：${items.length} 封，Newsletter ${sourceCount.newsletter ?? 0} / 客户 ${sourceCount.client ?? 0} / 内部 ${sourceCount.internal ?? 0}`,
    "",
    "【优先处理】",
    ...(items.slice(0, 5).map((item) => `- ${item.title} (${item.source})`) || [
      "- 当前收件箱为空。",
    ]),
    "",
    "【建议动作】",
    "- 先处理直接影响收入或交付的客户邮件。",
    "- 将可转发或可批量处理的信息整理成草稿。",
    "- 不重要的 newsletter 归并成统一 digest，避免频繁切换。",
  ].join("\n");
}

export function InboxDeclutterAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [source, setSource] = useState<InboxSource>("newsletter");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [focus, setFocus] = useState("");
  const [digest, setDigest] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [digests, setDigests] = useState<InboxDigest[]>([]);
  const { toast, showToast } = useTimedToast(2000);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      setItems(getInboxItems());
      setDigests(getInboxDigests());
    };
    sync();
    const unsub = subscribeInbox(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const itemId = (event as CustomEvent<{ itemId?: string }>).detail?.itemId;
      if (!itemId) return;
      const targetItem = getInboxItems().find((item) => item.id === itemId);
      if (!targetItem) return;
      updateInboxItem(targetItem.id, {});
      setSource(targetItem.source);
      setTitle(targetItem.title);
      setBody(targetItem.body);
      setFocus(targetItem.title);
      showToast("已定位到收件箱条目", "ok");
    };
    window.addEventListener("openclaw:inbox-select", onSelect);
    return () => window.removeEventListener("openclaw:inbox-select", onSelect);
  }, [showToast]);

  const activeWorkflowItem = useMemo(
    () => items.find((item) => item.workflowRunId) ?? null,
    [items],
  );
  const surfaceRecommendation = useMemo(
    () =>
      buildInboxDeclutterSurfaceRecommendation({
        items,
        digests,
        digest,
        activeItem: activeWorkflowItem,
      }),
    [activeWorkflowItem, digest, digests, items],
  );

  const getLatestItemById = (itemId: string) => getInboxItems().find((item) => item.id === itemId) ?? null;

  const ensureWorkflowForItem = (item: InboxItem, triggerType?: WorkflowTriggerType) => {
    const latest = getLatestItemById(item.id) ?? item;
    const resolvedTriggerType = triggerType ?? latest.workflowTriggerType ?? "inbound_message";
    if (latest.workflowRunId) return latest.workflowRunId;
    const scenario = getSupportWorkflowScenario();
    if (!scenario) return null;
    const runId = startWorkflowRun(scenario, resolvedTriggerType);
    updateInboxItem(item.id, {
      workflowRunId: runId,
      workflowScenarioId: scenario.id,
      workflowStageId: scenario.workflowStages[0]?.id,
      workflowTriggerType: resolvedTriggerType,
      workflowSource: "来自 Inbox Declutter 的客户消息收拢",
      workflowNextStep: "先把客户问题送进 Support Copilot，生成建议回复并做人审。",
    });
    upsertSupportAsset(runId, {
      scenarioId: scenario.id,
      inboxItemId: item.id,
      customer: item.title,
      channel: item.source,
      issueSummary: item.body.slice(0, 220),
      latestDigest: digest,
      nextAction: "把这一条客户消息送进 Support Copilot，生成可发送回复。",
      status: "capture",
    });
    return runId;
  };

  const addItem = () => {
    if (!body.trim()) {
      showToast("请先输入邮件内容", "error");
      return;
    }
    createInboxItem({ source, title, body });
    setTitle("");
    setBody("");
    showToast("已加入收件箱", "ok");
  };

  const generateDigest = async () => {
    const recentItems = getInboxItems().slice(0, 8);
    const fallback = buildLocalDigest(recentItems, focus);
    const taskId = createTask({
      name: "Assistant - Inbox digest",
      status: "running",
      detail: focus.trim().slice(0, 80) || "inbox-digest",
      workflowRunId: activeWorkflowItem?.workflowRunId,
      workflowScenarioId: activeWorkflowItem?.workflowScenarioId,
      workflowStageId: activeWorkflowItem?.workflowStageId,
      workflowSource: activeWorkflowItem?.workflowSource,
      workflowNextStep: activeWorkflowItem?.workflowNextStep,
      workflowTriggerType: activeWorkflowItem?.workflowTriggerType,
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Inbox De-clutter 助手。请把用户给出的邮件/消息列表整理成中文 digest。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 给出收件箱摘要。\n" +
        "2) 按优先级列出 3-5 条需要先处理的事项。\n" +
        "3) 给出归档、延后或转成任务的建议。\n\n" +
        `当前重点：${focus.trim() || "(未填写)"}\n` +
        `收件箱条目：\n${
          recentItems
            .map((item) => `- [${item.source}] ${item.title}\n${item.body.slice(0, 280)}`)
            .join("\n\n") || "(空)"
        }`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-inbox-digest",
        timeoutSeconds: 90,
      });
      setDigest(text || fallback);
      createInboxDigest({ focus, content: text || fallback });
      if (activeWorkflowItem?.workflowRunId) {
        upsertSupportAsset(activeWorkflowItem.workflowRunId, {
          scenarioId: activeWorkflowItem.workflowScenarioId ?? "support-ops",
          inboxItemId: activeWorkflowItem.id,
          customer: activeWorkflowItem.title,
          channel: activeWorkflowItem.source,
          issueSummary: activeWorkflowItem.body.slice(0, 220),
          latestDigest: text || fallback,
          nextAction: "从 Digest 中挑一条最优先的客户问题，送进 Support Copilot。",
          status: "capture",
        });
      }
      updateTask(taskId, { status: "done" });
      showToast("Digest 已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setDigest(fallback);
      createInboxDigest({ focus, content: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地 digest", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDigestDraft = () => {
    if (!digest.trim()) {
      showToast("请先生成 digest", "error");
      return;
    }
    createDraft({
      title: "Inbox Digest",
      body: digest,
      tags: ["inbox", "digest"],
      source: "import",
      workflowRunId: activeWorkflowItem?.workflowRunId,
      workflowScenarioId: activeWorkflowItem?.workflowScenarioId,
      workflowStageId: activeWorkflowItem?.workflowStageId,
      workflowTriggerType: activeWorkflowItem?.workflowTriggerType,
      workflowSource: activeWorkflowItem?.workflowSource,
      workflowNextStep: activeWorkflowItem?.workflowNextStep,
    });
    showToast("已保存到草稿", "ok");
  };

  const sendItemToEmail = (item: InboxItem) => {
    requestComposeEmail({
      subject: item.title || "邮件跟进",
      context: item.body,
      goal: item.source === "client" ? "回复并推进下一步" : "整理并转发关键信息",
      tone: item.source === "client" ? "professional" : "warm",
    });
    showToast("已发送到 Email Assistant", "ok");
  };

  const sendItemToSupport = (item: InboxItem) => {
    const runId = ensureWorkflowForItem(item, "inbound_message");
    const latest = getLatestItemById(item.id) ?? item;
    const run = runId ? getWorkflowRun(runId) : null;
    if (runId) {
      upsertSupportAsset(runId, {
        scenarioId: latest.workflowScenarioId ?? "support-ops",
        inboxItemId: item.id,
        customer: item.title,
        channel: item.source,
        issueSummary: item.body.slice(0, 220),
        latestDigest: digest,
        nextAction: "在 Support Copilot 里生成建议回复，人工确认后再转任务或沉淀 FAQ。",
        status: "replying",
      });
      if (run?.currentStageId === "capture") {
        advanceWorkflowRun(runId);
      }
      updateInboxItem(item.id, {
        workflowRunId: runId,
        workflowScenarioId: latest.workflowScenarioId ?? "support-ops",
        workflowStageId: run?.currentStageId === "capture" ? "reply" : latest.workflowStageId ?? "reply",
        workflowTriggerType: latest.workflowTriggerType ?? "inbound_message",
        workflowSource: "Inbox Declutter 已完成消息收拢，准备进入 Support Copilot",
        workflowNextStep: "先生成建议回复，再决定是否升级成任务或 FAQ。",
      });
    }
    requestOpenSupportCopilot({
      customer: item.title || "客户消息",
      channel:
        item.source === "client"
          ? "email"
          : item.source === "internal"
            ? "whatsapp"
            : "instagram",
      subject: item.title,
      message: item.body,
      status: "new",
      ...buildSupportWorkflowMeta({
        workflowRunId: runId ?? latest.workflowRunId,
        workflowScenarioId: latest.workflowScenarioId ?? "support-ops",
        workflowStageId: run?.currentStageId === "capture" ? "reply" : latest.workflowStageId ?? "reply",
        workflowTriggerType: latest.workflowTriggerType ?? "inbound_message",
        workflowSource: "来自 Inbox Declutter 的已收拢客户问题",
        workflowNextStep: "在 Support Copilot 生成建议回复，并进行人工审核。",
      }),
    });
    showToast("已发送到 Support Copilot", "ok");
  };

  const summary = useMemo(
    () => ({
      total: items.length,
      newsletters: items.filter((item) => item.source === "newsletter").length,
      client: items.filter((item) => item.source === "client").length,
    }),
    [items],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Inbox De-clutter"
      icon={Inbox}
      widthClassName="w-[1140px]"
      storageKey="openclaw.window.inbox_declutter"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Inbox De-clutter</div>
              <div className="mt-1 text-sm text-gray-500">
                对应 use case 里的 Inbox De-clutter。把 newsletter、客户邮件、内部沟通压成一份 digest。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                共 {summary.total} 封
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                Newsletter {summary.newsletters}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                客户 {summary.client}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <SupportHeroWorkflowPanel
            workflowRunId={activeWorkflowItem?.workflowRunId}
            title={activeWorkflowItem ? `${activeWorkflowItem.title || "未命名问题"} · 消息收拢阶段` : "Inbox Declutter · Support Workflow"}
            description="Inbox 在这条客服链里承担的是事件入口和收拢层，让分散在私信、邮件和评论里的问题先变成可推进的单一上下文。"
            emptyHint="当你把客户消息送进 Support Copilot 后，这里会显示 Support Hero Workflow 的阶段状态和资产快照。"
            source={activeWorkflowItem?.workflowSource}
            nextStep={activeWorkflowItem?.workflowNextStep}
            actions={[
              {
                label: "生成 Digest",
                onClick: generateDigest,
                disabled: isGenerating,
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">录入邮件 / 消息</div>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">来源</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as InboxSource)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">标题</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：客户询价 / 每日 newsletter"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">内容</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="粘贴邮件正文或消息摘要。"
                    className="h-36 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
                >
                  加入收件箱
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">最近条目</div>
              <div className="mt-3 space-y-2">
                {items.length > 0 ? (
                  items.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                          <div className="mt-1 text-xs text-gray-500">{item.source}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.source === "client" ? (
                            <button
                              type="button"
                              onClick={() => sendItemToSupport(item)}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              送 Support
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => sendItemToEmail(item)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            写邮件
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInboxItem(item.id)}
                            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有收件箱内容。
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold text-gray-600">当前重点</label>
                  <input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="例如：优先处理客户询价和本周投放相关邮件"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateDigest}
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "整理中..." : "生成 Digest"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Digest 结果</div>
                  <div className="mt-1 text-xs text-gray-500">支持保存到草稿，供后续转发或整理。</div>
                </div>
                <button
                  type="button"
                  onClick={saveDigestDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                >
                  <FilePlus2 className="h-4 w-4" />
                  保存草稿
                </button>
              </div>
              <div className="min-h-[360px] pt-4">
                <RecommendationResultBody
                  recommendation={surfaceRecommendation}
                  tone="emerald"
                  actionTitle="执行建议"
                  actionButtonLabel="查看当前消息"
                  maxHitsPerSection={2}
                />
                {digest ? (
                  <pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-800">{digest}</pre>
                ) : (
                  <div className="mt-4 flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会显示 inbox digest。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">最近 Digest</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {digests.length > 0 ? (
                  digests.slice(0, 4).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        setFocus(record.focus);
                        setDigest(record.content);
                      }}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
                    >
                      <div className="text-xs font-semibold text-gray-900">
                        {new Date(record.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-2 line-clamp-3 text-xs text-gray-500">{record.focus || "未填写重点"}</div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有 digest 记录。
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
