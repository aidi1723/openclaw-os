import type { ResearchWorkflowMeta } from "@/lib/research-workflow";

export type ResearchReportRecord = {
  id: string;
  topic: string;
  sources: string;
  angle: string;
  audience: string;
  notes: string;
  report: string;
  createdAt: number;
  updatedAt: number;
} & ResearchWorkflowMeta;

type Listener = () => void;

const REPORTS_KEY = "openclaw.research_hub.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:research-hub"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as ResearchReportRecord[];
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ResearchReportRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: ResearchReportRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function getResearchReports() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createResearchReport(
  input?: Partial<Omit<ResearchReportRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const record: ResearchReportRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    topic: input?.topic?.trim() || "未命名研究主题",
    sources: input?.sources ?? "",
    angle: input?.angle ?? "",
    audience: input?.audience ?? "",
    notes: input?.notes ?? "",
    report: input?.report ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([record, ...load()]);
  emit();
  return record.id;
}

export function updateResearchReport(
  reportId: string,
  patch: Partial<Omit<ResearchReportRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((record) =>
      record.id === reportId
        ? {
            ...record,
            ...patch,
            updatedAt: now,
          }
        : record,
    ),
  );
  emit();
}

export function removeResearchReport(reportId: string) {
  save(load().filter((record) => record.id !== reportId));
  emit();
}

export function subscribeResearchReports(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
