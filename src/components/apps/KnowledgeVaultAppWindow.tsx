"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload, Folder, HardDrive, Search } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { jumpToAssetTarget } from "@/lib/asset-jumps";
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
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";
import {
  requestOpenDealDesk,
  requestOpenSupportCopilot,
  type KnowledgeVaultPrefill,
} from "@/lib/ui-events";

type VaultFolderId = "trade_products" | "social_assets" | "contracts";

type VaultFile = {
  id: string;
  folderId: VaultFolderId;
  name: string;
  size: number;
  addedAt: number;
};

const VAULT_KEY = "openclaw.vault.v1";

function loadVault(): VaultFile[] {
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VaultFile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVault(files: VaultFile[]) {
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(files));
}

const folders: Array<{ id: VaultFolderId; name: string }> = [
  { id: "trade_products", name: "产品资料库" },
  { id: "social_assets", name: "内容素材" },
  { id: "contracts", name: "文档归档" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeFolder, setActiveFolder] = useState<VaultFolderId>("trade_products");
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [assetRevision, setAssetRevision] = useState(0);
  const [assetStatusFilter, setAssetStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [editingScene, setEditingScene] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [query, setQuery] = useState("");
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const taskIdRef = useRef<TaskId | null>(null);
  const { toast, showToast } = useTimedToast(2000);

  useEffect(() => {
    if (state === "open" || state === "opening") {
      setFiles(loadVault());
    }
  }, [state]);

  useEffect(() => {
    const bump = () => setAssetRevision((value) => value + 1);
    const off = subscribeKnowledgeAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (state === "open" || state === "opening") {
      saveVault(files);
    }
  }, [files, state]);

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

  const fileCount = files.length;

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => f.folderId === activeFolder)
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [files, activeFolder, query]);

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

  const reuseKnowledgeAsset = (asset: KnowledgeAssetRecord) => {
    incrementKnowledgeAssetReuse(asset.id);
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

  const onAddFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const now = Date.now();
    const next: VaultFile[] = Array.from(list).map((f, idx) => ({
      id: `${now}-${idx}-${Math.random().toString(16).slice(2)}`,
      folderId: activeFolder,
      name: f.name,
      size: f.size,
      addedAt: now,
    }));
    setFiles((prev) => [...next, ...prev]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onAddFiles(e.dataTransfer.files);
  };

  const folderName = folders.find((f) => f.id === activeFolder)?.name ?? "专属知识库";

  const askAssistant = async () => {
    const q = ask.trim();
    if (!q || isAsking) return;

    setIsAsking(true);
    setAnswer("");
    taskIdRef.current = createTask({
      name: "Assistant - Vault query",
      status: "running",
      detail: q.slice(0, 80),
    });

    try {
      const inFolder = files.filter((f) => f.folderId === activeFolder);
      const settings = loadSettings();
      const activeLlm = getActiveLlmConfig(settings);
      const res = await fetch(buildAgentCoreApiUrl("/api/openclaw/vault/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          folderName,
          files: inFolder,
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
        | { ok?: boolean; text?: string; error?: string };

      if (!res.ok || !data?.ok) {
        const error = data?.error || "检索失败，请检查 OpenClaw 是否运行";
        setAnswer(error);
        showToast(error, "error");
        if (taskIdRef.current) updateTask(taskIdRef.current, { status: "error", detail: error });
        return;
      }

      setAnswer(String(data.text ?? ""));
      showToast("已返回建议（OpenClaw）", "ok");
      if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "请求异常";
      setAnswer(errorMessage);
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
                当前文件：<span className="font-semibold">{fileCount}</span> 份 {" | "}
                <span className="font-semibold text-emerald-700">OpenClaw 已接入</span>
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
                  拖拽上传文件，然后在右上角提问（当前仅基于文件名初步检索）。
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索文件..."
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

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => onAddFiles(e.target.files)}
            />

            <div
              className={[
                "rounded-2xl border border-dashed p-6 transition-colors cursor-pointer",
                isDragging
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:bg-gray-50",
              ].join(" ")}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200">
                  <CloudUpload className="h-6 w-6 text-gray-700" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    拖拽上传文件
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    支持多文件 · 仅记录文件名（后续接入向量化/索引）
                  </div>
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

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">文件列表</div>
                <div className="text-xs text-gray-500">{filteredFiles.length} 项</div>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredFiles.length === 0 ? (
                  <div className="px-5 py-10 text-sm text-gray-500">
                    暂无文件，拖拽上传开始构建知识库。
                  </div>
                ) : (
                  filteredFiles.map((f) => (
                    <div key={f.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {f.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatSize(f.size)} · 添加于{" "}
                          {new Date(f.addedAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((x) => x.id !== f.id))
                        }
                        className="shrink-0 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs font-semibold hover:bg-gray-50 transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {answer && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-emerald-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-emerald-900">建议</div>
                  <button
                    type="button"
                    onClick={() => setAnswer("")}
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
