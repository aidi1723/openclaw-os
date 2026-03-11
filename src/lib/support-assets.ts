export type SupportAssetStatus =
  | "capture"
  | "replying"
  | "followup"
  | "faq"
  | "completed";

export type SupportAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  inboxItemId?: string;
  ticketId?: string;
  customer: string;
  channel: string;
  issueSummary: string;
  latestDigest: string;
  latestReply: string;
  escalationTask: string;
  faqDraft: string;
  nextAction: string;
  status: SupportAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const SUPPORT_ASSETS_KEY = "openclaw.support-assets.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:support-assets"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as SupportAssetRecord[];
  try {
    const raw = window.localStorage.getItem(SUPPORT_ASSETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SupportAssetRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: SupportAssetRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPPORT_ASSETS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function subscribeSupportAssets(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSupportAssets() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSupportAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getSupportAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertSupportAsset(
  workflowRunId: string,
  patch: Partial<Omit<SupportAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: SupportAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "support-ops",
        inboxItemId: patch.inboxItemId,
        ticketId: patch.ticketId,
        customer: patch.customer ?? "",
        channel: patch.channel ?? "",
        issueSummary: patch.issueSummary ?? "",
        latestDigest: patch.latestDigest ?? "",
        latestReply: patch.latestReply ?? "",
        escalationTask: patch.escalationTask ?? "",
        faqDraft: patch.faqDraft ?? "",
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
