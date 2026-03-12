import { getJsonFromStorage, setJsonToStorage } from "@/lib/storage";
import type { SolutionBlueprint } from "@/lib/solution-blueprints";

export type SavedSolutionBlueprint = {
  id: string;
  starterId: string;
  starterTitle: string;
  starterSummary: string;
  blueprint: SolutionBlueprint;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "openclaw.saved-solution-blueprints.v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:saved-solution-blueprints"));
  }
}

function newId() {
  try {
    return `sb_${crypto.randomUUID()}`;
  } catch {
    return `sb_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function normalize(
  item: Partial<SavedSolutionBlueprint>,
): SavedSolutionBlueprint | null {
  const starterId = String(item.starterId ?? "").trim();
  const starterTitle = String(item.starterTitle ?? "").trim();
  const starterSummary = String(item.starterSummary ?? "").trim();
  const blueprint =
    item.blueprint && typeof item.blueprint === "object"
      ? (item.blueprint as SolutionBlueprint)
      : null;
  if (!starterId || !starterTitle || !blueprint) return null;
  const now = Date.now();
  return {
    id: String(item.id ?? newId()),
    starterId,
    starterTitle,
    starterSummary,
    blueprint,
    createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : now,
    updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : now,
  };
}

export function loadSavedSolutionBlueprints() {
  const raw = getJsonFromStorage<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [] as SavedSolutionBlueprint[];
  return raw
    .map((item) => normalize(item as Partial<SavedSolutionBlueprint>))
    .filter((item): item is SavedSolutionBlueprint => Boolean(item))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 120);
}

export function subscribeSavedSolutionBlueprints(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createSavedSolutionBlueprint(input: {
  starterId: string;
  starterTitle: string;
  starterSummary: string;
  blueprint: SolutionBlueprint;
}) {
  const now = Date.now();
  const next = [
    {
      id: newId(),
      starterId: input.starterId.trim(),
      starterTitle: input.starterTitle.trim(),
      starterSummary: input.starterSummary.trim(),
      blueprint: input.blueprint,
      createdAt: now,
      updatedAt: now,
    } satisfies SavedSolutionBlueprint,
    ...loadSavedSolutionBlueprints(),
  ];
  setJsonToStorage(STORAGE_KEY, next.slice(0, 120));
  emit();
  return next[0];
}

export function deleteSavedSolutionBlueprint(id: string) {
  setJsonToStorage(
    STORAGE_KEY,
    loadSavedSolutionBlueprints().filter((item) => item.id !== id),
  );
  emit();
}
