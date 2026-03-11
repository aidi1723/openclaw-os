export type CreatorAssetStatus =
  | "radar"
  | "repurposing"
  | "preflight"
  | "publishing"
  | "completed";

export type CreatorAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  radarItemId?: string;
  repurposerProjectId?: string;
  draftId?: string;
  topic: string;
  audience: string;
  sourceChannels: string;
  primaryAngle: string;
  latestDigest: string;
  latestPack: string;
  latestDraftTitle: string;
  latestDraftBody: string;
  publishTargets: string[];
  publishStatus: string;
  nextAction: string;
  reuseNotes: string;
  status: CreatorAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const CREATOR_ASSETS_KEY = "openclaw.creator-assets.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:creator-assets"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as CreatorAssetRecord[];
  try {
    const raw = window.localStorage.getItem(CREATOR_ASSETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CreatorAssetRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: CreatorAssetRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CREATOR_ASSETS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function subscribeCreatorAssets(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCreatorAssets() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCreatorAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getCreatorAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertCreatorAsset(
  workflowRunId: string,
  patch: Partial<Omit<CreatorAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: CreatorAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "creator-studio",
        radarItemId: patch.radarItemId,
        repurposerProjectId: patch.repurposerProjectId,
        draftId: patch.draftId,
        topic: patch.topic ?? "",
        audience: patch.audience ?? "",
        sourceChannels: patch.sourceChannels ?? "",
        primaryAngle: patch.primaryAngle ?? "",
        latestDigest: patch.latestDigest ?? "",
        latestPack: patch.latestPack ?? "",
        latestDraftTitle: patch.latestDraftTitle ?? "",
        latestDraftBody: patch.latestDraftBody ?? "",
        publishTargets: patch.publishTargets ?? [],
        publishStatus: patch.publishStatus ?? "not_started",
        nextAction: patch.nextAction ?? "",
        reuseNotes: patch.reuseNotes ?? "",
        status: patch.status ?? "radar",
        createdAt: now,
        updatedAt: now,
      };

  const next = existing
    ? current.map((asset) => (asset.workflowRunId === workflowRunId ? nextRecord : asset))
    : [nextRecord, ...current];

  save(next);
  emit();
  return nextRecord;
}
