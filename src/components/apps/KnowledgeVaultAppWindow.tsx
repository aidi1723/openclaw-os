"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Folder, HardDrive, RefreshCw, Search } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import {
  useRuntimeHeroWorkflowSummary,
  type HeroRecommendationFamily,
} from "@/components/workflows/useRuntimeHeroWorkflowSummary";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { jumpToAssetTarget } from "@/lib/asset-jumps";
import { subscribeCreatorAssets, type CreatorAssetRecord } from "@/lib/creator-assets";
import {
  getKnowledgeAssets,
  incrementKnowledgeAssetReuse,
  removeKnowledgeAsset,
  setKnowledgeAssetStatus,
  subscribeKnowledgeAssets,
  updateKnowledgeAsset,
  type KnowledgeAssetRecord,
} from "@/lib/knowledge-assets";
import {
  buildDealDeskPrefillFromKnowledgeAsset,
  buildSupportPrefillFromKnowledgeAsset,
} from "@/lib/knowledge-asset-reuse";
import type { RecommendationResult } from "@/lib/recommendation-contract";
import { subscribeResearchAssets } from "@/lib/research-assets";
import { subscribeSalesAssets } from "@/lib/sales-assets";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";
import { subscribeSupportAssets } from "@/lib/support-assets";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";
import {
  requestOpenDealDesk,
  requestOpenSupportCopilot,
  type KnowledgeVaultPrefill,
} from "@/lib/ui-events";
import type { VaultMixedQueryStructuredResult } from "@/lib/vault-mixed-query";

type VaultFolderId = "trade_products" | "social_assets" | "contracts";

const folders: Array<{ id: VaultFolderId; name: string }> = [
  { id: "trade_products", name: "产品资料库" },
  { id: "social_assets", name: "内容素材" },
  { id: "contracts", name: "文档归档" },
];

function formatTimestamp(value?: number) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString();
}

export function KnowledgeVaultAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [activeFolder, setActiveFolder] = useState<VaultFolderId>("trade_products");
  const [assetRevision, setAssetRevision] = useState(0);
  const [assetStatusFilter, setAssetStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [editingScene, setEditingScene] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [query, setQuery] = useState("");
  const [creatorSliceAssets, setCreatorSliceAssets] = useState<CreatorAssetRecord[]>([]);
  const [creatorSliceLoading, setCreatorSliceLoading] = useState(false);
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState("");
  const [structuredAnswer, setStructuredAnswer] = useState<VaultMixedQueryStructuredResult | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [heroRecommendationRevision, setHeroRecommendationRevision] = useState(0);
  const taskIdRef = useRef<TaskId | null>(null);
  const { toast, showToast } = useTimedToast(2000);

  useEffect(() => {
    const bump = () => setAssetRevision((value) => value + 1);
    const offKnowledge = subscribeKnowledgeAssets(bump);
    const offCreator = subscribeCreatorAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      offKnowledge();
      offCreator();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const bump = () => setHeroRecommendationRevision((value) => value + 1);
    const offSales = subscribeSalesAssets(bump);
    const offSupport = subscribeSupportAssets(bump);
    const offResearch = subscribeResearchAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      offSales();
      offSupport();
      offResearch();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<KnowledgeVaultPrefill>).detail;
      setAsk(detail?.query ?? "");
      setAnswer("");
      showToast("已带入知识库问题", "ok");
    };
    window.addEventListener("openclaw:vault-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:vault-prefill", onPrefill);
  }, [showToast]);

  const filteredAssets = useMemo<KnowledgeAssetRecord[]>(() => {
    void assetRevision;
    const q = query.trim().toLowerCase();
    return getKnowledgeAssets()
      .filter((item) => (assetStatusFilter === "all" ? true : item.status === assetStatusFilter))
      .filter((item) =>
        q
          ? [item.title, item.body, item.applicableScene, item.sourceApp, item.assetType, item.status, item.tags.join(" ")]
              .join("\n")
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [assetRevision, assetStatusFilter, query]);

  useEffect(() => {
    if (state !== "open" && state !== "opening") return;
    if (activeFolder !== "social_assets") {
      setCreatorSliceAssets([]);
      return;
    }

    let cancelled = false;
    setCreatorSliceLoading(true);
    void fetch(buildAgentCoreApiUrl("/api/runtime/state/creator-assets/query"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        q: query.trim(),
        sort: query.trim() ? "reviewed" : "success_signal",
        filter: "all",
        limit: 6,
      }),
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled) return;
        const payload = data as
          | null
          | { ok?: boolean; data?: { creatorAssets?: CreatorAssetRecord[] } };
        setCreatorSliceAssets(
          Array.isArray(payload?.data?.creatorAssets) ? payload.data.creatorAssets : [],
        );
      })
      .catch(() => {
        if (!cancelled) setCreatorSliceAssets([]);
      })
      .finally(() => {
        if (!cancelled) setCreatorSliceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFolder, assetRevision, query, state]);
  const {
    recommendations: heroRecommendations,
    phase: heroRecommendationPhase,
    error: heroRecommendationError,
    syncedAt: heroRecommendationSyncedAt,
    refresh: refreshHeroRecommendations,
    refreshKey: heroRecommendationRefreshKey,
  } = useRuntimeHeroWorkflowSummary({
    enabled: state === "open" || state === "opening",
    unavailableMessage: "当前无法加载业务链建议。",
    refreshToken: `${state}:${heroRecommendationRevision}`,
  });

  const reuseKnowledgeAsset = (asset: KnowledgeAssetRecord) => {
    if (asset.assetType === "sales_playbook") {
      requestOpenDealDesk(buildDealDeskPrefillFromKnowledgeAsset(asset));
      return;
    }
    requestOpenSupportCopilot(buildSupportPrefillFromKnowledgeAsset(asset));
  };

  const startEditingAsset = (asset: KnowledgeAssetRecord) => {
    setEditingAssetId(asset.id);
    setEditingTitle(asset.title);
    setEditingTags(asset.tags.join(", "));
    setEditingScene(asset.applicableScene);
    setEditingBody(asset.body);
  };

  const cancelEditingAsset = () => {
    setEditingAssetId(null);
    setEditingTitle("");
    setEditingTags("");
    setEditingScene("");
    setEditingBody("");
  };

  const saveEditingAsset = () => {
    if (!editingAssetId) return;
    const title = editingTitle.trim();
    const body = editingBody.trim();
    if (!title || !body) {
      showToast("标题和正文不能为空", "error");
      return;
    }
    const applicableScene = editingScene.trim() || "未指定场景";
    const tags = editingTags
      .split(/[,\n，]/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 12);
    updateKnowledgeAsset(editingAssetId, {
      title,
      body,
      tags,
      applicableScene,
    });
    cancelEditingAsset();
    showToast("流程资产已更新", "ok");
  };

  const folderName = folders.find((f) => f.id === activeFolder)?.name ?? "专属知识库";
  const visibleHeroRecommendations = useMemo(
    () => {
      const items: Array<{
        family: HeroRecommendationFamily;
        label: string;
        recommendation: RecommendationResult | null;
      }> = [
        { family: "sales", label: "销售", recommendation: heroRecommendations.sales },
        { family: "creator", label: "内容", recommendation: heroRecommendations.creator },
        { family: "support", label: "客服", recommendation: heroRecommendations.support },
        { family: "research", label: "研究", recommendation: heroRecommendations.research },
      ];
      return items.filter(
        (item): item is {
          family: HeroRecommendationFamily;
          label: string;
          recommendation: RecommendationResult;
        } => Boolean(item.recommendation),
      );
    },
    [
      heroRecommendations.creator,
      heroRecommendations.research,
      heroRecommendations.sales,
      heroRecommendations.support,
    ],
  );
  const heroRecommendationStatusLabel =
    heroRecommendationPhase === "loading"
      ? "同步中"
      : heroRecommendationPhase === "error"
        ? "同步失败"
        : "已同步";

  const askAssistant = async () => {
    const q = ask.trim();
    if (!q || isAsking) return;

    setIsAsking(true);
    setAnswer("");
    setStructuredAnswer(null);
    taskIdRef.current = createTask({
      name: "Assistant - Vault query",
      status: "running",
      detail: q.slice(0, 80),
    });

    try {
      const knowledgeContext = filteredAssets.slice(0, 6).map((asset) => ({
        id: asset.id,
        title: asset.title,
        assetType: asset.assetType,
        status: asset.status,
        applicableScene: asset.applicableScene,
        tags: asset.tags,
        body: asset.body,
        reuseCount: asset.reuseCount,
      }));
      const creatorContext =
        activeFolder === "social_assets"
          ? creatorSliceAssets.slice(0, 6).map((asset) => ({
              id: asset.id,
              topic: asset.topic,
              primaryAngle: asset.primaryAngle,
              publishStatus: asset.publishStatus,
              latestPublishFeedback: asset.latestPublishFeedback,
              nextAction: asset.nextAction,
              publishTargets: asset.publishTargets,
              successfulPlatforms: asset.successfulPlatforms,
              retryablePlatforms: asset.retryablePlatforms,
            }))
          : [];
      const settings = loadSettings();
      const activeLlm = getActiveLlmConfig(settings);
      const res = await fetch(buildAgentCoreApiUrl("/api/knowledge/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          folderName,
          knowledgeAssets: knowledgeContext,
          creatorAssets: creatorContext,
          llm: {
            provider: activeLlm.id,
            apiKey: activeLlm.config.apiKey,
            baseUrl: activeLlm.config.baseUrl,
            model: activeLlm.config.model,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; text?: string; error?: string; structured?: VaultMixedQueryStructuredResult };

      if (!res.ok || !data?.ok) {
        const error = data?.error || "检索失败，请检查 Kimi 配置是否可用";
        setAnswer(error);
        setStructuredAnswer(null);
        showToast(error, "error");
        if (taskIdRef.current) updateTask(taskIdRef.current, { status: "error", detail: error });
        return;
      }

      setAnswer(String(data.text ?? ""));
      setStructuredAnswer(data.structured ?? null);
      showToast("已返回建议（Kimi）", "ok");
      if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "请求异常";
      setAnswer(errorMessage);
      setStructuredAnswer(null);
      showToast(errorMessage, "error");
      if (taskIdRef.current) updateTask(taskIdRef.current, { status: "error", detail: errorMessage });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="专属知识库"
      icon={HardDrive}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.knowledge_vault"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="flex min-h-[560px] flex-col lg:flex-row">
          <aside className="w-full border-b border-gray-200 bg-gray-50/60 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="p-5">
              <div className="text-xs font-semibold text-gray-500">
                Knowledge Vault
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">专属知识库</div>
              <div className="mt-3 text-xs text-gray-600">
                当前资产：<span className="font-semibold">{filteredAssets.length}</span> 项 {" | "}
                <span className="font-semibold text-emerald-700">服务端资产已接入</span>
              </div>
            </div>

            <nav className="grid grid-cols-1 gap-1 px-2 pb-4 sm:grid-cols-2 lg:grid-cols-1">
              {folders.map((f) => {
                const active = f.id === activeFolder;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFolder(f.id)}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                      active
                        ? "bg-white border border-gray-200 text-gray-900 shadow-sm"
                        : "text-gray-700 hover:bg-white/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-9 w-9 rounded-xl flex items-center justify-center border",
                        active ? "bg-blue-50 border-blue-100" : "bg-white border-gray-200",
                      ].join(" ")}
                    >
                      <Folder className="h-4 w-4" />
                    </span>
                    <span className="truncate">{f.name}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 space-y-4 p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {folderName}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  这里仅展示已入库的流程资产与业务链建议，不再暴露本地临时文件。
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索流程资产..."
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-[220px]"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <Search className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={ask}
                    onChange={(e) => setAsk(e.target.value)}
                    placeholder="提问…"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-[260px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") askAssistant();
                    }}
                  />
                  <button
                    type="button"
                    onClick={askAssistant}
                    disabled={!ask.trim() || isAsking}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAsking ? "检索中..." : "检索"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">流程资产</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                    {[
                      { id: "all" as const, label: "全部" },
                      { id: "active" as const, label: "启用中" },
                      { id: "archived" as const, label: "已归档" },
                    ].map((item) => {
                      const active = assetStatusFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAssetStatusFilter(item.id)}
                          className={[
                            "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                            active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-white",
                          ].join(" ")}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-gray-500">{filteredAssets.length} 项</div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredAssets.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-gray-500">
                    暂无流程资产。完成销售或客服闭环后，可把结构化资产草稿确认入库。
                  </div>
                ) : (
                  filteredAssets.map((asset) => (
                    <div key={asset.id} className="px-5 py-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          {editingAssetId === asset.id ? (
                            <div className="space-y-3">
                              <input
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="资产标题"
                              />
                              <input
                                value={editingScene}
                                onChange={(e) => setEditingScene(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="适用场景"
                              />
                              <input
                                value={editingTags}
                                onChange={(e) => setEditingTags(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
                                placeholder="标签，使用逗号分隔"
                              />
                            </div>
                          ) : (
                            <div className="text-sm font-semibold text-gray-900">{asset.title}</div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              {asset.assetType === "sales_playbook" ? "销售资产" : "FAQ 资产"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              状态：{asset.status === "active" ? "启用中" : "已归档"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              来源：{asset.sourceApp === "personal_crm" ? "Personal CRM" : "Support Copilot"}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              场景：{asset.applicableScene}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                              复用 {asset.reuseCount} 次
                            </span>
                            {asset.tags.map((tag) => (
                              <span
                                key={`${asset.id}-${tag}`}
                                className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                            <span>轮次：{asset.workflowRunId || "未绑定"}</span>
                            <span>资产键：{asset.sourceKey}</span>
                            <span>创建于 {formatTimestamp(asset.createdAt)}</span>
                            <span>更新于 {formatTimestamp(asset.updatedAt)}</span>
                          </div>
                          {editingAssetId === asset.id ? (
                            <textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              className="mt-3 min-h-[220px] w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                              {asset.body}
                            </pre>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {editingAssetId === asset.id ? (
                            <>
                              <button
                                type="button"
                                onClick={saveEditingAsset}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingAsset}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                              >
                                取消
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => jumpToAssetTarget(asset.sourceJumpTarget)}
                            disabled={!asset.sourceJumpTarget}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            回到来源
                          </button>
                          <button
                            type="button"
                            onClick={() => incrementKnowledgeAssetReuse(asset.id)}
                            disabled={editingAssetId === asset.id}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            标记已复用
                          </button>
                          <button
                            type="button"
                            onClick={() => reuseKnowledgeAsset(asset)}
                            disabled={editingAssetId === asset.id}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            一键复用
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingAsset(asset)}
                            disabled={editingAssetId !== null && editingAssetId !== asset.id}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setKnowledgeAssetStatus(
                                asset.id,
                                asset.status === "active" ? "archived" : "active",
                              )
                            }
                            disabled={editingAssetId === asset.id}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                          >
                            {asset.status === "active" ? "归档" : "恢复"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeKnowledgeAsset(asset.id)}
                            disabled={editingAssetId === asset.id}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {activeFolder === "social_assets" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 overflow-hidden">
                <div className="px-5 py-3 border-b border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-emerald-950">内容工作流切片</div>
                    <div className="mt-1 text-xs text-emerald-900/70">
                      来自 Creator Studio 的本地可复用内容资产。当前按 {query.trim() ? "复盘时间" : "成功信号"} 排序。
                    </div>
                  </div>
                  <div className="text-xs text-emerald-900/70">
                    {creatorSliceLoading ? "更新中..." : `${creatorSliceAssets.length} 项`}
                  </div>
                </div>
                <div className="divide-y divide-emerald-100">
                  {creatorSliceAssets.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-emerald-950/75">
                      {creatorSliceLoading
                        ? "正在读取内容资产切片..."
                        : "当前没有匹配的 creator assets。试试搜索选题、平台或发布反馈关键词。"}
                    </div>
                  ) : (
                    creatorSliceAssets.map((asset) => (
                      <div key={asset.id} className="px-5 py-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-emerald-950">
                              {asset.topic || asset.latestDraftTitle || "内容增长资产"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-emerald-900/75">
                              <span className="rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1">
                                状态：{asset.publishStatus}
                              </span>
                              {asset.publishTargets.length > 0 ? (
                                <span className="rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1">
                                  平台：{asset.publishTargets.join(" / ")}
                                </span>
                              ) : null}
                              {asset.lastReviewedAt ? (
                                <span className="rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1">
                                  复盘于 {formatTimestamp(asset.lastReviewedAt)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-emerald-950/85">
                              {asset.latestPublishFeedback || asset.nextAction || "当前还没有结构化发布反馈。"}
                            </div>
                            {asset.successfulPlatforms.length > 0 || asset.retryablePlatforms.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                {asset.successfulPlatforms.map((platform) => (
                                  <span
                                    key={`${asset.id}-success-${platform}`}
                                    className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-emerald-800"
                                  >
                                    OK · {platform}
                                  </span>
                                ))}
                                {asset.retryablePlatforms.map((platform) => (
                                  <span
                                    key={`${asset.id}-retry-${platform}`}
                                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800"
                                  >
                                    Retry · {platform}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={!asset.draftId}
                              onClick={() =>
                                jumpToAssetTarget(
                                  asset.draftId
                                    ? {
                                        kind: "publisher",
                                        prefill: {
                                          draftId: asset.draftId,
                                          workflowRunId: asset.workflowRunId,
                                          workflowScenarioId: asset.scenarioId,
                                        },
                                      }
                                    : null,
                                )
                              }
                              className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              打开发布稿
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-amber-950">当前业务链建议</div>
                  <div className="mt-1 text-xs text-amber-900/70">
                    从 runtime 层汇总销售、内容、客服、研究四条业务链的最新推荐动作，方便在知识库里直接判断下一步该回哪条链路。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      heroRecommendationPhase === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : heroRecommendationPhase === "loading"
                          ? "border-amber-300 bg-white text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700",
                    ].join(" ")}
                  >
                    {heroRecommendationStatusLabel}
                  </div>
                  <button
                    type="button"
                    onClick={refreshHeroRecommendations}
                    disabled={heroRecommendationPhase === "loading"}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={["h-3.5 w-3.5", heroRecommendationPhase === "loading" ? "animate-spin" : ""].join(" ")} />
                    刷新
                  </button>
                </div>
              </div>
              <div className="px-5 py-3 text-xs text-amber-900/70 border-b border-amber-100 bg-white/40">
                最近同步：{heroRecommendationSyncedAt ? new Date(heroRecommendationSyncedAt).toLocaleString() : "暂无"}
                {heroRecommendationPhase === "error" && heroRecommendationError ? (
                  <span className="ml-3 text-rose-700">{heroRecommendationError}</span>
                ) : null}
              </div>
              {visibleHeroRecommendations.length > 0 ? (
                <div className={["p-4 grid gap-3", visibleHeroRecommendations.length > 1 ? "xl:grid-cols-3" : ""].join(" ")}>
                  {visibleHeroRecommendations.map((item) => (
                    <div key={`vault-hero-${item.family}`} className="rounded-2xl border border-amber-100 bg-white/85 p-4">
                      <div className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-100/60 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                        {item.label}
                      </div>
                      <RecommendationResultBody
                        recommendation={item.recommendation}
                        tone="amber"
                        maxHitsPerSection={1}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-sm text-amber-950/75">
                  {heroRecommendationPhase === "error"
                    ? "当前无法读取业务链建议，请稍后重试。"
                    : heroRecommendationPhase === "loading"
                      ? "正在同步业务链建议..."
                      : "runtime 层暂时还没有返回可展示的业务链建议。"}
                </div>
              )}
            </div>

            {structuredAnswer && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-blue-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-blue-950">结构化结果</div>
                  <div className="text-xs text-blue-900/70">{structuredAnswer.query}</div>
                </div>
                <RecommendationResultBody
                  recommendation={structuredAnswer}
                  tone="blue"
                  actionTitle="推荐动作"
                  className="px-5 py-4"
                />
              </div>
            )}

            {answer && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-emerald-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-emerald-900">建议</div>
                  <button
                    type="button"
                    onClick={() => {
                      setAnswer("");
                      setStructuredAnswer(null);
                    }}
                    className="text-xs font-semibold text-emerald-900/80 hover:text-emerald-900"
                  >
                    清空
                  </button>
                </div>
                <div className="px-5 py-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-950/90">
                    {answer}
                  </pre>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
