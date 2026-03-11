import type { ResearchWorkflowMeta } from "@/lib/research-workflow";

export type BriefRecord = {
  id: string;
  focus: string;
  notes: string;
  content: string;
  createdAt: number;
} & ResearchWorkflowMeta;

type Listener = () => void;

const BRIEFS_KEY = "openclaw.briefs.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:briefs"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as BriefRecord[];
  try {
    const raw = window.localStorage.getItem(BRIEFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BriefRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: BriefRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRIEFS_KEY, JSON.stringify(next.slice(0, 24)));
  } catch {
    // ignore
  }
}

export function getBriefs() {
  return load().slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function createBrief(input: Omit<BriefRecord, "id" | "createdAt">) {
  const brief: BriefRecord = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    ...input,
  };
  save([brief, ...load()]);
  emit();
  return brief.id;
}

export function subscribeBriefs(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
