import type { SupportWorkflowMeta } from "@/lib/support-workflow";

export type SupportChannel = "email" | "whatsapp" | "instagram" | "reviews";
export type SupportStatus = "new" | "waiting" | "resolved";

export type SupportTicket = {
  id: string;
  customer: string;
  channel: SupportChannel;
  subject: string;
  message: string;
  status: SupportStatus;
  replyDraft: string;
  createdAt: number;
  updatedAt: number;
} & SupportWorkflowMeta;

type Listener = () => void;

const SUPPORT_KEY = "openclaw.support.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:support"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as SupportTicket[];
  try {
    const raw = window.localStorage.getItem(SUPPORT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SupportTicket[]) : [];
  } catch {
    return [];
  }
}

function save(next: SupportTicket[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPPORT_KEY, JSON.stringify(next.slice(0, 160)));
  } catch {
    // ignore
  }
}

export function getSupportTickets() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createSupportTicket(input?: Partial<Omit<SupportTicket, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const ticket: SupportTicket = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    customer: input?.customer?.trim() || "新客户",
    channel: input?.channel ?? "email",
    subject: input?.subject?.trim() || "未命名工单",
    message: input?.message ?? "",
    status: input?.status ?? "new",
    replyDraft: input?.replyDraft ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  save([ticket, ...load()]);
  emit();
  return ticket.id;
}

export function updateSupportTicket(
  ticketId: string,
  patch: Partial<Omit<SupportTicket, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((ticket) =>
      ticket.id === ticketId
        ? {
            ...ticket,
            ...patch,
            updatedAt: now,
          }
        : ticket,
    ),
  );
  emit();
}

export function removeSupportTicket(ticketId: string) {
  save(load().filter((ticket) => ticket.id !== ticketId));
  emit();
}

export function subscribeSupportTickets(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
