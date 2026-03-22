import type { AssetJumpTarget } from "@/lib/asset-jumps";

export type KnowledgeAssetType = "sales_playbook" | "support_faq";
export type KnowledgeAssetStatus = "active" | "archived";

export type KnowledgeAssetRecord = {
  id: string;
  sourceKey: string;
  title: string;
  body: string;
  sourceApp: "personal_crm" | "support_copilot";
  scenarioId: string;
  workflowRunId?: string;
  assetType: KnowledgeAssetType;
  status: KnowledgeAssetStatus;
  tags: string[];
  applicableScene: string;
  reuseCount: number;
  sourceJumpTarget?: AssetJumpTarget;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const KNOWLEDGE_ASSETS_KEY = "openclaw.knowledge-assets.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:knowledge-assets"));
  }
}

function load(): KnowledgeAssetRecord[] {
  if (typeof window === "undefined") return [] as KnowledgeAssetRecord[];
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_ASSETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => {
        const record = item as KnowledgeAssetRecord;
        return {
          ...record,
          status: record.status === "archived" ? "archived" : "active",
          tags: Array.isArray(record.tags)
            ? record.tags.filter((tag) => typeof tag === "string" && tag.trim())
            : [],
        } satisfies KnowledgeAssetRecord;
      });
  } catch {
    return [];
  }
}

function save(next: KnowledgeAssetRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KNOWLEDGE_ASSETS_KEY, JSON.stringify(next.slice(0, 160)));
  } catch {
    // ignore
  }
}

export function subscribeKnowledgeAssets(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getKnowledgeAssets() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertKnowledgeAsset(
  sourceKey: string,
  patch: Omit<KnowledgeAssetRecord, "id" | "sourceKey" | "createdAt" | "updatedAt" | "reuseCount"> & {
    reuseCount?: number;
  },
) {
  const now = Date.now();
  const current = load();
  const existing = current.find((item) => item.sourceKey === sourceKey);
  const nextRecord: KnowledgeAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        sourceKey,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        sourceKey,
        title: patch.title,
        body: patch.body,
        sourceApp: patch.sourceApp,
        scenarioId: patch.scenarioId,
        workflowRunId: patch.workflowRunId,
        assetType: patch.assetType,
        status: patch.status,
        tags: patch.tags,
        applicableScene: patch.applicableScene,
        reuseCount: patch.reuseCount ?? 0,
        sourceJumpTarget: patch.sourceJumpTarget,
        createdAt: now,
        updatedAt: now,
      };

  const next = existing
    ? current.map((item) => (item.sourceKey === sourceKey ? nextRecord : item))
    : [nextRecord, ...current];
  save(next);
  emit();
  return nextRecord;
}

export function incrementKnowledgeAssetReuse(assetId: string) {
  const now = Date.now();
  save(
    load().map((item) =>
      item.id === assetId
        ? { ...item, reuseCount: item.reuseCount + 1, updatedAt: now }
        : item,
    ),
  );
  emit();
}

export function updateKnowledgeAsset(
  assetId: string,
  patch: Partial<Pick<KnowledgeAssetRecord, "title" | "body" | "tags" | "applicableScene">>,
) {
  const now = Date.now();
  save(
    load().map((item) =>
      item.id === assetId
        ? {
            ...item,
            ...patch,
            updatedAt: now,
          }
        : item,
    ),
  );
  emit();
}

export function removeKnowledgeAsset(assetId: string) {
  save(load().filter((item) => item.id !== assetId));
  emit();
}

export function setKnowledgeAssetStatus(assetId: string, status: KnowledgeAssetStatus) {
  const now = Date.now();
  save(
    load().map((item) =>
      item.id === assetId ? { ...item, status, updatedAt: now } : item,
    ),
  );
  emit();
}
