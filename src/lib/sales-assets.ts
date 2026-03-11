export type SalesAssetStatus =
  | "qualifying"
  | "awaiting_review"
  | "crm_syncing"
  | "completed";

export type SalesAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  dealId?: string;
  emailThreadId?: string;
  contactId?: string;
  company: string;
  contactName: string;
  inquiryChannel: string;
  preferredLanguage: string;
  productLine: string;
  requirementSummary: string;
  preferenceNotes: string;
  objectionNotes: string;
  nextAction: string;
  quoteNotes: string;
  quoteStatus: string;
  latestDraftSubject: string;
  latestDraftBody: string;
  status: SalesAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const SALES_ASSETS_KEY = "openclaw.sales-assets.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:sales-assets"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as SalesAssetRecord[];
  try {
    const raw = window.localStorage.getItem(SALES_ASSETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SalesAssetRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: SalesAssetRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SALES_ASSETS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function subscribeSalesAssets(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSalesAssets() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSalesAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getSalesAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertSalesAsset(
  workflowRunId: string,
  patch: Partial<Omit<SalesAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: SalesAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "sales-pipeline",
        dealId: patch.dealId,
        emailThreadId: patch.emailThreadId,
        contactId: patch.contactId,
        company: patch.company ?? "",
        contactName: patch.contactName ?? "",
        inquiryChannel: patch.inquiryChannel ?? "",
        preferredLanguage: patch.preferredLanguage ?? "",
        productLine: patch.productLine ?? "",
        requirementSummary: patch.requirementSummary ?? "",
        preferenceNotes: patch.preferenceNotes ?? "",
        objectionNotes: patch.objectionNotes ?? "",
        nextAction: patch.nextAction ?? "",
        quoteNotes: patch.quoteNotes ?? "",
        quoteStatus: patch.quoteStatus ?? "not_started",
        latestDraftSubject: patch.latestDraftSubject ?? "",
        latestDraftBody: patch.latestDraftBody ?? "",
        status: patch.status ?? "qualifying",
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
