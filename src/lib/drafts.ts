import type { WorkflowContextMeta } from "@/lib/workflow-context";

export type DraftId = string;

export type DraftSource =
  | "media_ops"
  | "publisher"
  | "import";

export type DraftRecord = {
  id: DraftId;
  title: string;
  body: string;
  tags?: string[];
  source: DraftSource;
  workflowSource?: string;
  workflowNextStep?: string;
  createdAt: number;
  updatedAt: number;
} & WorkflowContextMeta;

type Listener = () => void;

const DRAFTS_KEY = "openclaw.drafts.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:drafts"));
  }
}

function load(): DraftRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DraftRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: DraftRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function subscribeDrafts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDrafts() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createDraft(input: {
  title: string;
  body: string;
  tags?: string[];
  source?: DraftSource;
  workflowRunId?: string;
  workflowScenarioId?: string;
  workflowStageId?: string;
  workflowSource?: string;
  workflowNextStep?: string;
  workflowTriggerType?: import("@/lib/workflow-runs").WorkflowTriggerType;
}) {
  const now = Date.now();
  const draft: DraftRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input.title.trim() || "未命名草稿",
    body: input.body,
    tags: input.tags,
    source: input.source ?? "publisher",
    workflowRunId: input.workflowRunId,
    workflowScenarioId: input.workflowScenarioId,
    workflowStageId: input.workflowStageId,
    workflowSource: input.workflowSource?.trim() || undefined,
    workflowNextStep: input.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  const next = [draft, ...load()];
  save(next);
  emit();
  return draft.id;
}

export function updateDraft(
  draftId: DraftId,
  patch: Partial<
    Pick<
      DraftRecord,
      | "title"
      | "body"
      | "tags"
      | "workflowRunId"
      | "workflowScenarioId"
      | "workflowStageId"
      | "workflowSource"
      | "workflowNextStep"
      | "workflowTriggerType"
    >
  >,
) {
  const now = Date.now();
  const next = load().map((d) =>
    d.id === draftId ? { ...d, ...patch, updatedAt: now } : d,
  );
  save(next);
  emit();
}

export function removeDraft(draftId: DraftId) {
  const next = load().filter((d) => d.id !== draftId);
  save(next);
  emit();
}
