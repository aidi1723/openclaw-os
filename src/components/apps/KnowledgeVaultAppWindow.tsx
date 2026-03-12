"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload, Folder, HardDrive, Search } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";
import type { KnowledgeVaultPrefill } from "@/lib/ui-events";

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
