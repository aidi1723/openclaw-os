"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Globe2, Plus, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import {
  createWebsiteSeoRecord,
  getWebsiteSeoRecords,
  removeWebsiteSeoRecord,
  subscribeWebsiteSeo,
  updateWebsiteSeoRecord,
  type WebsitePageType,
  type WebsiteSeoRecord,
} from "@/lib/website-seo-studio";
import { requestOpenApp, requestOpenKnowledgeVault } from "@/lib/ui-events";

const pageTypeOptions: Array<{ id: WebsitePageType; label: string }> = [
  { id: "homepage", label: "首页" },
  { id: "landing", label: "落地页" },
  { id: "blog", label: "博客文章" },
  { id: "product", label: "产品页" },
  { id: "service", label: "服务页" },
];

function buildLocalBlueprint(item: WebsiteSeoRecord) {
  return [
    "【Site Blueprint】",
    `- 品牌 / 网站：${item.brand || "未填写"}`,
    `- 页面类型：${pageTypeOptions.find((option) => option.id === item.pageType)?.label ?? item.pageType}`,
    `- 目标受众：${item.audience || "未填写"}`,
    `- 核心关键词：${item.primaryKeywords || "未填写"}`,
    `- 核心转化目标：${item.offer || "未填写"}`,
    "",
    "【SEO Strategy】",
    "- 先锁定一个主关键词和 3-5 个辅助关键词，避免一页承载过多目标。",
    "- 标题、首屏文案、H2 和 FAQ 都要围绕搜索意图展开。",
    "- 对比竞品时优先看信息架构、标题口径和 CTA 布局。",
    "",
    "【Page Outline】",
    "- Hero：一句话价值 + 可信证明 + 主 CTA。",
    "- 问题场景：说明用户当前卡点。",
    "- 解决方案：给出产品/服务如何解决。",
    "- FAQ：补足搜索长尾和异议处理。",
    "",
    "【Meta Pack】",
    "- SEO Title：控制在可读范围内，优先核心关键词 + 价值。",
    "- Meta Description：说明对象、问题、结果和 CTA。",
    "",
    "【Next Actions】",
    "- 先确定首屏标题、主 CTA 和 3 个核心板块。",
    "- 把 FAQ 和内链建议写入知识库，方便后续扩页。",
    "- 把页面制作和文案拆成明确任务推进。",
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

export function WebsiteSeoStudioAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [records, setRecords] = useState<WebsiteSeoRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getWebsiteSeoRecords();
      setRecords(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeWebsiteSeo(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => records.find((item) => item.id === selectedId) ?? null,
    [records, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<WebsiteSeoRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateWebsiteSeoRecord(selected.id, patch);
  };

  const createNew = () => {
    const id = createWebsiteSeoRecord();
    setSelectedId(id);
    showToast("已新增网站 SEO 项目", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeWebsiteSeoRecord(selected.id);
    setSelectedId(null);
    showToast("网站 SEO 项目已删除", "ok");
  };

  const generateBlueprint = async () => {
    if (!selected) {
      showToast("请先选择项目", "error");
      return;
    }
    const fallback = buildLocalBlueprint(selected);
    const taskId = createTask({
      name: "Assistant - Website SEO",
      status: "running",
      detail: selected.brand.slice(0, 80),
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Website SEO Studio 助手。请根据用户提供的网站信息，输出一份可执行的网站结构与 SEO 优化方案。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含以下标题：\n" +
        "【Site Blueprint】\n【SEO Strategy】\n【Page Outline】\n【Meta Pack】\n【Next Actions】\n" +
        "要求：\n" +
        "1) 明确页面结构、SEO 标题方向、内容块和 FAQ 建议。\n" +
        "2) 兼顾网站制作与自动 SEO 优化。\n" +
        "3) 输出简洁、可执行，不要空话。\n\n" +
        `品牌 / 网站：${selected.brand}\n` +
        `页面类型：${selected.pageType}\n` +
        `目标受众：${selected.audience || "(未填)"}\n` +
        `核心关键词：${selected.primaryKeywords || "(未填)"}\n` +
        `核心转化目标：${selected.offer || "(未填)"}\n` +
        `竞品参考：${selected.competitors || "(未填)"}\n` +
        `补充说明：\n${selected.notes || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-website-seo-studio",
        timeoutSeconds: 120,
      });
      patchSelected({ blueprint: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("网站 SEO 方案已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ blueprint: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地方案", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!selected?.blueprint.trim()) {
      showToast("请先生成方案", "error");
      return;
    }
    createDraft({
      title: `${selected.brand || "Website"} SEO Blueprint`,
      body: selected.blueprint,
      tags: ["website", "seo"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToVault = () => {
    if (!selected?.blueprint.trim()) {
      showToast("请先生成方案", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query: `请基于以下网站 SEO 方案，整理可复用的页面模板、FAQ、关键词分组和内链结构：\n${selected.blueprint}`,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  const sendToTasks = () => {
    if (!selected?.blueprint.trim()) {
      showToast("请先生成方案", "error");
      return;
    }
    const items = extractNextActions(selected.blueprint);
    if (items.length === 0) {
      showToast("没有可写入的动作项", "error");
      return;
    }
    items.forEach((item) => {
      createTask({
        name: `Website SEO - ${selected.brand || "Website"}`,
        status: "queued",
        detail: item,
      });
    });
    requestOpenApp("task_manager");
    showToast(`已写入 ${items.length} 个任务`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Website SEO Studio"
      icon={Globe2}
      widthClassName="w-[1200px]"
      storageKey="openclaw.window.website_seo_studio"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Website SEO Studio</div>
              <div className="mt-1 text-sm text-gray-500">
                把网站制作和自动 SEO 优化收口到一个工作台里，输出页面结构、Meta、FAQ 和下一步执行清单。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              项目 {records.length} 个
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">SEO 项目</div>
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
                {records.length > 0 ? (
                  records.map((item) => {
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
                        <div className="text-sm font-semibold">{item.brand}</div>
                        <div className={["mt-1 text-xs", activeItem ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {pageTypeOptions.find((option) => option.id === item.pageType)?.label}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有网站 SEO 项目。
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
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">品牌 / 网站</span>
                      <input
                        value={selected.brand}
                        onChange={(event) => patchSelected({ brand: event.target.value })}
                        placeholder="如：AgentCore Studio"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">目标受众</span>
                      <input
                        value={selected.audience}
                        onChange={(event) => patchSelected({ audience: event.target.value })}
                        placeholder="如：SaaS founder / 独立开发者 / 电商品牌"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">页面类型</span>
                      <select
                        value={selected.pageType}
                        onChange={(event) => patchSelected({ pageType: event.target.value as WebsitePageType })}
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      >
                        {pageTypeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">核心转化目标</span>
                      <input
                        value={selected.offer}
                        onChange={(event) => patchSelected({ offer: event.target.value })}
                        placeholder="如：预约 Demo / 留资 / 试用注册 / 购买"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">核心关键词</span>
                    <input
                      value={selected.primaryKeywords}
                      onChange={(event) => patchSelected({ primaryKeywords: event.target.value })}
                      placeholder="如：AI workflow OS, creator automation, website SEO studio"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                    />
                  </label>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">竞品参考</span>
                      <textarea
                        value={selected.competitors}
                        onChange={(event) => patchSelected({ competitors: event.target.value })}
                        placeholder="写下竞品站点、标题口径、结构或你想参考的对象。"
                        rows={5}
                        className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">补充说明</span>
                      <textarea
                        value={selected.notes}
                        onChange={(event) => patchSelected({ notes: event.target.value })}
                        placeholder="写下业务背景、已有页面、想强调的信息架构或 SEO 方向。"
                        rows={5}
                        className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateBlueprint}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {isGenerating ? "生成中..." : "生成网站 SEO 方案"}
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
                      onClick={sendToTasks}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                    >
                      发到任务中心
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
                  <div className="text-sm font-semibold text-gray-900">输出方案</div>
                  <pre className="mt-3 min-h-[320px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                    {selected.blueprint || "填写项目信息后生成网站结构与 SEO 优化方案。"}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                先新建一个网站 SEO 项目。
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
