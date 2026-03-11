export type ContactStatus = "lead" | "warm" | "active" | "watch";

import type { SalesWorkflowMeta } from "@/lib/sales-workflow";

export type ContactRecord = {
  id: string;
  name: string;
  company: string;
  role: string;
  status: ContactStatus;
  lastTouch: string;
  nextStep: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
} & SalesWorkflowMeta;

type Listener = () => void;

const CONTACTS_KEY = "openclaw.crm.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:crm"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as ContactRecord[];
  try {
    const raw = window.localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ContactRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: ContactRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getContacts() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createContact(input?: Partial<Omit<ContactRecord, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const contact: ContactRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    name: input?.name?.trim() || "新联系人",
    company: input?.company ?? "",
    role: input?.role ?? "",
    status: input?.status ?? "lead",
    lastTouch: input?.lastTouch ?? "",
    nextStep: input?.nextStep ?? "",
    notes: input?.notes ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([contact, ...load()]);
  emit();
  return contact.id;
}

export function updateContact(
  contactId: string,
  patch: Partial<Omit<ContactRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((contact) =>
      contact.id === contactId
        ? {
            ...contact,
            ...patch,
            updatedAt: now,
          }
        : contact,
    ),
  );
  emit();
}

export function removeContact(contactId: string) {
  save(load().filter((contact) => contact.id !== contactId));
  emit();
}

export function subscribeContacts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
