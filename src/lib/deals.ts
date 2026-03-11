export type DealStage = "new" | "qualified" | "proposal" | "blocked" | "won";

import type { SalesWorkflowMeta } from "@/lib/sales-workflow";

export type DealRecord = {
  id: string;
  company: string;
  contact: string;
  inquiryChannel: string;
  preferredLanguage: string;
  productLine: string;
  need: string;
  budget: string;
  timing: string;
  stage: DealStage;
  notes: string;
  brief: string;
  createdAt: number;
  updatedAt: number;
} & SalesWorkflowMeta;

type Listener = () => void;

const DEALS_KEY = "openclaw.deals.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:deals"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as DealRecord[];
  try {
    const raw = window.localStorage.getItem(DEALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DealRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: DealRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEALS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getDeals() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createDeal(input?: Partial<Omit<DealRecord, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const deal: DealRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    company: input?.company?.trim() || "新线索",
    contact: input?.contact ?? "",
    inquiryChannel: input?.inquiryChannel ?? "",
    preferredLanguage: input?.preferredLanguage ?? "",
    productLine: input?.productLine ?? "",
    need: input?.need ?? "",
    budget: input?.budget ?? "",
    timing: input?.timing ?? "",
    stage: input?.stage ?? "new",
    notes: input?.notes ?? "",
    brief: input?.brief ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([deal, ...load()]);
  emit();
  return deal.id;
}

export function updateDeal(
  dealId: string,
  patch: Partial<Omit<DealRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((deal) =>
      deal.id === dealId
        ? {
            ...deal,
            ...patch,
            updatedAt: now,
          }
        : deal,
    ),
  );
  emit();
}

export function removeDeal(dealId: string) {
  save(load().filter((deal) => deal.id !== dealId));
  emit();
}

export function subscribeDeals(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
