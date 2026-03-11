import type { CreatorWorkflowMeta } from "@/lib/creator-workflow";

export type RepurposeSourceType =
  | "youtube"
  | "podcast"
  | "webinar"
  | "article"
  | "notes";

export type ContentRepurposerProject = {
  id: string;
  title: string;
  sourceType: RepurposeSourceType;
  audience: string;
  goal: string;
  sourceContent: string;
  contentPack: string;
  workflowSource?: string;
  workflowNextStep?: string;
  createdAt: number;
  updatedAt: number;
} & CreatorWorkflowMeta;

type Listener = () => void;

const CONTENT_REPURPOSER_KEY = "openclaw.content-repurposer.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:content-repurposer"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as ContentRepurposerProject[];
  try {
    const raw = window.localStorage.getItem(CONTENT_REPURPOSER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ContentRepurposerProject[]) : [];
  } catch {
    return [];
  }
}

function save(next: ContentRepurposerProject[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTENT_REPURPOSER_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getContentRepurposerProjects() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createContentRepurposerProject(
  input?: Partial<Omit<ContentRepurposerProject, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const project: ContentRepurposerProject = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "New repurpose pack",
    sourceType: input?.sourceType ?? "youtube",
    audience: input?.audience ?? "",
    goal: input?.goal ?? "",
    sourceContent: input?.sourceContent ?? "",
    contentPack: input?.contentPack ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([project, ...load()]);
  emit();
  return project.id;
}

export function updateContentRepurposerProject(
  projectId: string,
  patch: Partial<Omit<ContentRepurposerProject, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((project) =>
      project.id === projectId
        ? {
            ...project,
            ...patch,
            updatedAt: now,
          }
        : project,
    ),
  );
  emit();
}

export function removeContentRepurposerProject(projectId: string) {
  save(load().filter((project) => project.id !== projectId));
  emit();
}

export function subscribeContentRepurposer(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
