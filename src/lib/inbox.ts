import type { SupportWorkflowMeta } from "@/lib/support-workflow";

export type InboxSource = "newsletter" | "client" | "internal";

export type InboxItem = {
  id: string;
  source: InboxSource;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
} & SupportWorkflowMeta;

export type InboxDigest = {
  id: string;
  focus: string;
  content: string;
  createdAt: number;
};

type Listener = () => void;

const ITEMS_KEY = "openclaw.inbox.items.v1";
const DIGESTS_KEY = "openclaw.inbox.digests.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:inbox"));
  }
}

function loadItems() {
  if (typeof window === "undefined") return [] as InboxItem[];
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InboxItem[]) : [];
  } catch {
    return [];
  }
}

function saveItems(next: InboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ITEMS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

function loadDigests() {
  if (typeof window === "undefined") return [] as InboxDigest[];
  try {
    const raw = window.localStorage.getItem(DIGESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InboxDigest[]) : [];
  } catch {
    return [];
  }
}

function saveDigests(next: InboxDigest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIGESTS_KEY, JSON.stringify(next.slice(0, 40)));
  } catch {
    // ignore
  }
}

export function getInboxItems() {
  return loadItems().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createInboxItem(input: {
  source: InboxSource;
  title: string;
  body: string;
} & SupportWorkflowMeta) {
  const now = Date.now();
  const item: InboxItem = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    source: input.source,
    title: input.title.trim() || "未命名邮件",
    body: input.body,
    workflowRunId: input.workflowRunId,
    workflowScenarioId: input.workflowScenarioId,
    workflowStageId: input.workflowStageId,
    workflowSource: input.workflowSource?.trim() || undefined,
    workflowNextStep: input.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  saveItems([item, ...loadItems()]);
  emit();
  return item.id;
}

export function updateInboxItem(
  itemId: string,
  patch: Partial<Omit<InboxItem, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  saveItems(
    loadItems().map((item) =>
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

export function removeInboxItem(itemId: string) {
  saveItems(loadItems().filter((item) => item.id !== itemId));
  emit();
}

export function getInboxDigests() {
  return loadDigests().slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function createInboxDigest(input: {
  focus: string;
  content: string;
}) {
  const digest: InboxDigest = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    focus: input.focus,
    content: input.content,
  };
  saveDigests([digest, ...loadDigests()]);
  emit();
  return digest.id;
}

export function subscribeInbox(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
