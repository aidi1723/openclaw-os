import type { CreatorWorkflowMeta } from "@/lib/creator-workflow";

export type CreatorRadarRecord = {
  id: string;
  title: string;
  channels: string;
  audience: string;
  goal: string;
  notes: string;
  digest: string;
  createdAt: number;
  updatedAt: number;
} & CreatorWorkflowMeta;

type Listener = () => void;

const CREATOR_RADAR_KEY = "openclaw.creator-radar.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:creator-radar"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as CreatorRadarRecord[];
  try {
    const raw = window.localStorage.getItem(CREATOR_RADAR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CreatorRadarRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: CreatorRadarRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CREATOR_RADAR_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getCreatorRadarItems() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createCreatorRadarItem(
  input?: Partial<Omit<CreatorRadarRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const item: CreatorRadarRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "New creator brief",
    channels: input?.channels ?? "",
    audience: input?.audience ?? "",
    goal: input?.goal ?? "",
    notes: input?.notes ?? "",
    digest: input?.digest ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([item, ...load()]);
  emit();
  return item.id;
}

export function updateCreatorRadarItem(
  itemId: string,
  patch: Partial<Omit<CreatorRadarRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((item) =>
      item.id === itemId
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

export function removeCreatorRadarItem(itemId: string) {
  save(load().filter((item) => item.id !== itemId));
  emit();
}

export function subscribeCreatorRadar(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
