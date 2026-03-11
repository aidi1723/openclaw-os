export type ResearchAssetStatus =
  | "capture"
  | "synthesizing"
  | "routing"
  | "completed";

export type ResearchAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  reportId?: string;
  briefId?: string;
  topic: string;
  audience: string;
  angle: string;
  sources: string;
  latestReport: string;
  latestBrief: string;
  vaultQuery: string;
  nextAction: string;
  status: ResearchAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const RESEARCH_ASSETS_KEY = "openclaw.research-assets.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:research-assets"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as ResearchAssetRecord[];
  try {
    const raw = window.localStorage.getItem(RESEARCH_ASSETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ResearchAssetRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: ResearchAssetRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESEARCH_ASSETS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function subscribeResearchAssets(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getResearchAssets() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getResearchAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getResearchAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertResearchAsset(
  workflowRunId: string,
  patch: Partial<Omit<ResearchAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: ResearchAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "research-radar",
        reportId: patch.reportId,
        briefId: patch.briefId,
        topic: patch.topic ?? "",
        audience: patch.audience ?? "",
        angle: patch.angle ?? "",
        sources: patch.sources ?? "",
        latestReport: patch.latestReport ?? "",
        latestBrief: patch.latestBrief ?? "",
        vaultQuery: patch.vaultQuery ?? "",
        nextAction: patch.nextAction ?? "",
        status: patch.status ?? "capture",
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
