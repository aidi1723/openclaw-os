import type { WorkspaceScenario } from "@/lib/workspace-presets";

export type WorkflowTriggerType = "manual" | "schedule" | "inbound_message" | "web_form";

export type WorkflowRunState = "idle" | "running" | "awaiting_human" | "completed" | "error";

export type WorkflowStageRunState = "pending" | "running" | "awaiting_human" | "completed" | "error";

export type WorkflowStageRun = {
  id: string;
  title: string;
  mode: WorkspaceScenario["workflowStages"][number]["mode"];
  state: WorkflowStageRunState;
};

export type WorkflowRunRecord = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  triggerType: WorkflowTriggerType;
  state: WorkflowRunState;
  currentStageId?: string;
  stageRuns: WorkflowStageRun[];
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const STORAGE_KEY = "openclaw.workflow-runs.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:workflow-runs"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as WorkflowRunRecord[];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WorkflowRunRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: WorkflowRunRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

function sortRuns(items: WorkflowRunRecord[]) {
  return items.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function subscribeWorkflowRuns(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWorkflowRuns() {
  return sortRuns(load());
}

export function getWorkflowRun(runId: string) {
  return getWorkflowRuns().find((run) => run.id === runId) ?? null;
}

export function getLatestWorkflowRunForScenario(scenarioId: string) {
  return getWorkflowRuns().find((run) => run.scenarioId === scenarioId) ?? null;
}

export function startWorkflowRun(
  scenario: WorkspaceScenario,
  triggerType: WorkflowTriggerType,
) {
  const now = Date.now();
  const stageRuns: WorkflowStageRun[] = scenario.workflowStages.map((stage, index) => ({
    id: stage.id,
    title: stage.title,
    mode: stage.mode,
    state:
      index === 0
        ? stage.mode === "review" || stage.mode === "manual"
          ? "awaiting_human"
          : "running"
        : "pending",
  }));

  const run: WorkflowRunRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    triggerType,
    state: stageRuns[0]?.state === "awaiting_human" ? "awaiting_human" : "running",
    currentStageId: stageRuns[0]?.id,
    stageRuns,
    createdAt: now,
    updatedAt: now,
  };

  save([run, ...load().filter((item) => item.scenarioId !== scenario.id)]);
  emit();
  return run.id;
}

export function advanceWorkflowRun(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  const next = load().map((run) => {
    if (run.id !== runId) return run;
    const currentIndex = run.stageRuns.findIndex((stage) => stage.id === run.currentStageId);
    if (currentIndex === -1) return run;
    const nextIndex = currentIndex + 1;
    const stageRuns: WorkflowStageRun[] = run.stageRuns.map((stage, index) => {
      if (index === currentIndex) return { ...stage, state: "completed" as const };
      if (index === nextIndex) {
        return {
          ...stage,
          state: (stage.mode === "review" || stage.mode === "manual" ? "awaiting_human" : "running") as WorkflowStageRunState,
        };
      }
      return stage;
    });
    const nextStage = stageRuns[nextIndex];
    updated = {
      ...run,
      stageRuns,
      currentStageId: nextStage?.id,
      state: nextStage ? (nextStage.state === "awaiting_human" ? "awaiting_human" : "running") : "completed",
      updatedAt: now,
    };
    return updated;
  });
  save(next);
  emit();
  return updated;
}

export function setWorkflowRunAwaitingHuman(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  const next = load().map((run) => {
    if (run.id !== runId) return run;
    const stageRuns = run.stageRuns.map((stage) =>
      stage.id === run.currentStageId ? { ...stage, state: "awaiting_human" as const } : stage,
    );
    updated = {
      ...run,
      stageRuns,
      state: "awaiting_human",
      updatedAt: now,
    };
    return updated;
  });
  save(next);
  emit();
  return updated;
}

export function completeWorkflowRun(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  const next = load().map((run) => {
    if (run.id !== runId) return run;
    updated = {
      ...run,
      state: "completed",
      stageRuns: run.stageRuns.map((stage) =>
        stage.state === "completed" ? stage : { ...stage, state: "completed" as const },
      ),
      currentStageId: undefined,
      updatedAt: now,
    };
    return updated;
  });
  save(next);
  emit();
  return updated;
}

export function failWorkflowRun(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  const next = load().map((run) => {
    if (run.id !== runId) return run;
    updated = {
      ...run,
      state: "error",
      stageRuns: run.stageRuns.map((stage) =>
        stage.id === run.currentStageId ? { ...stage, state: "error" as const } : stage,
      ),
      updatedAt: now,
    };
    return updated;
  });
  save(next);
  emit();
  return updated;
}
