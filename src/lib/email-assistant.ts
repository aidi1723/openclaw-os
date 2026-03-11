export type EmailTone = "professional" | "warm" | "direct";

import type { SalesWorkflowMeta } from "@/lib/sales-workflow";

export type EmailThread = {
  id: string;
  subject: string;
  recipient: string;
  context: string;
  goal: string;
  tone: EmailTone;
  draft: string;
  createdAt: number;
  updatedAt: number;
} & SalesWorkflowMeta;

type Listener = () => void;

const EMAIL_THREADS_KEY = "openclaw.email.threads.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:email-assistant"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as EmailThread[];
  try {
    const raw = window.localStorage.getItem(EMAIL_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EmailThread[]) : [];
  } catch {
    return [];
  }
}

function save(next: EmailThread[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EMAIL_THREADS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getEmailThreads() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createEmailThread(input?: Partial<Omit<EmailThread, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const thread: EmailThread = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    subject: input?.subject?.trim() || "未命名邮件",
    recipient: input?.recipient ?? "",
    context: input?.context ?? "",
    goal: input?.goal ?? "",
    tone: input?.tone ?? "professional",
    draft: input?.draft ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([thread, ...load()]);
  emit();
  return thread.id;
}

export function updateEmailThread(
  threadId: string,
  patch: Partial<Omit<EmailThread, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            ...patch,
            updatedAt: now,
          }
        : thread,
    ),
  );
  emit();
}

export function removeEmailThread(threadId: string) {
  save(load().filter((thread) => thread.id !== threadId));
  emit();
}

export function subscribeEmailThreads(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
