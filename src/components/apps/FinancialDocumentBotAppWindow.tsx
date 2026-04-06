"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, FileText, Plus, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { createTask, updateTask } from "@/lib/tasks";
import {
  createFinancialDocument,
  getFinancialDocuments,
  removeFinancialDocument,
  subscribeFinancialDocuments,
  updateFinancialDocument,
  type FinancialDocumentRecord,
  type FinancialDocumentType,
} from "@/lib/financial-documents";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { requestOpenKnowledgeVault, requestOpenApp } from "@/lib/ui-events";

const documentTypeOptions: Array<{ id: FinancialDocumentType; label: string }> = [
  { id: "invoice", label: "发票 / Invoice" },
  { id: "receipt", label: "收据 / Receipt" },
  { id: "bill", label: "账单 / Bill" },
  { id: "expense", label: "报销 / Expense" },
];

function guessAmount(text: string) {
  const match = text.match(/(?:USD|RMB|CNY|\$|¥)\s?([0-9]+(?:[.,][0-9]{1,2})?)/i);
  return match?.[1] ?? "";
}

function guessDate(text: string) {
  const match = text.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
  return match?.[1] ?? "";
}

function buildLocalExtraction(item: FinancialDocumentRecord) {
  const amount = guessAmount(item.rawText);
  const date = guessDate(item.rawText);
  const firstLine =
    item.rawText
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "未提取到供应商";

  return [
    "【Document Summary】",
    `- 标题：${item.title || "未填写"}`,
    `- 类型：${documentTypeOptions.find((option) => option.id === item.documentType)?.label ?? item.documentType}`,
    `- 可能供应商：${firstLine}`,
    `- 可能金额：${amount || "未识别"}`,
    `- 可能日期：${date || "未识别"}`,
    "",
    "【Extracted Fields】",
    "- 建议核对供应商、税号、金额、币种和到期日。",
    "- 若用于报销，请补充成本中心、付款方式和凭证编号。",
    "",
    "【Next Actions】",
    "- 将结构化结果沉淀到知识库或财务台账。",
    "- 如果存在待付款项，创建一条明确的跟进任务。",
    "- 对于缺失字段，回到原文档补齐关键信息。",
  ].join("\n");
}

function extractNextActions(text: string) {
  const sectionMatch = text.match(/【Next Actions】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : text;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function FinancialDocumentBotAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [documents, setDocuments] = useState<FinancialDocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getFinancialDocuments();
      setDocuments(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeFinancialDocuments(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<FinancialDocumentRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateFinancialDocument(selected.id, patch);
  };

  const createNew = () => {
    const id = createFinancialDocument();
    setSelectedId(id);
    showToast("已新增财务文档", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeFinancialDocument(selected.id);
    setSelectedId(null);
    showToast("财务文档已删除", "ok");
  };

  const generateExtraction = async () => {
    if (!selected) {
      showToast("请先选择文档", "error");
      return;
    }
    if (!selected.rawText.trim()) {
      showToast("请先粘贴文档文本", "error");
      return;
    }

    const fallback = buildLocalExtraction(selected);
    const taskId = createTask({
      name: "Assistant - Financial document parse",
      status: "running",
      detail: selected.title.slice(0, 80),
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Financial Document Bot。请将用户提供的财务文档文本整理成结构化提取结果。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含以下标题：\n" +
        "【Document Summary】\n【Extracted Fields】\n【Next Actions】\n" +
        "要求：\n" +
        "1) 提取可能的供应商、金额、日期、币种、付款状态、文档编号。\n" +
        "2) 明确哪些字段需要人工复核。\n" +
        "3) 输出简洁，不要编造未出现的字段。\n\n" +
        `文档标题：${selected.title}\n` +
        `文档类型：${selected.documentType}\n` +
        `文档文本：\n${selected.rawText}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-financial-document-bot",
        timeoutSeconds: 120,
      });
      patchSelected({ extracted: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("财务文档已提取", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ extracted: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地提取", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!selected?.extracted.trim()) {
      showToast("请先生成提取结果", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Financial Document"} Extract`,
      body: selected.extracted,
      tags: ["finance", "document"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToVault = () => {
    if (!selected?.extracted.trim()) {
      showToast("请先生成提取结果", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query: `请基于以下财务文档提取结果，整理成可归档字段和后续台账结构：\n${selected.extracted}`,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  const sendToTaskManager = () => {
    if (!selected?.extracted.trim()) {
      showToast("请先生成提取结果", "error");
      return;
    }
    const nextActions = extractNextActions(selected.extracted);
    if (nextActions.length === 0) {
      showToast("没有可写入的后续动作", "error");
      return;
    }
    nextActions.forEach((item) => {
      createTask({
        name: `Finance - ${selected.title || "Document"}`,
        status: "queued",
        detail: item,
      });
    });
    requestOpenApp("task_manager");
    showToast(`已写入 ${nextActions.length} 个任务`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Financial Document Bot"
      icon={FileText}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.financial_document_bot"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Financial Document Bot</div>
              <div className="mt-1 text-sm text-gray-500">
                对应财务文档识别场景：把发票、收据、账单文本整理成结构化字段和后续动作。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              文档 {documents.length} 份
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">文档列表</div>
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
                {documents.length > 0 ? (
                  documents.map((item) => {
                    const activeItem = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-colors",
                          activeItem
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className={["mt-1 text-xs", activeItem ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {documentTypeOptions.find((option) => option.id === item.documentType)?.label}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有财务文档。
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            {selected ? (
              <>
                <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">文档标题</span>
                      <input
                        value={selected.title}
                        onChange={(event) => patchSelected({ title: event.target.value })}
                        placeholder="如：AWS March Invoice"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">文档类型</span>
                      <select
                        value={selected.documentType}
                        onChange={(event) =>
                          patchSelected({ documentType: event.target.value as FinancialDocumentType })
                        }
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      >
                        {documentTypeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">文档文本</span>
                    <textarea
                      value={selected.rawText}
                      onChange={(event) => patchSelected({ rawText: event.target.value })}
                      placeholder="把 OCR 结果、PDF 文本或账单正文粘贴到这里。"
                      rows={12}
                      className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateExtraction}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {isGenerating ? "提取中..." : "提取结构化字段"}
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
                      onClick={sendToTaskManager}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      发送到任务中心
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
                  <div className="text-sm font-semibold text-gray-900">提取结果</div>
                  <pre className="mt-3 min-h-[280px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                    {selected.extracted || "粘贴文档文本后生成结构化提取结果。"}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                先新建一份财务文档。
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
