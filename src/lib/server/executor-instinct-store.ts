import { readJsonFile, readModifyWrite } from "@/lib/server/json-store";

const FILE_NAME = "executor-instincts.json";
const MAX_INSTINCTS = 240;

export type ExecutorInstinctRecord = {
  id: string;
  scope: string;
  profileId: string;
  taskLabel: string;
  title: string;
  instinct: string;
  evidence: string;
  sourceSessionId: string;
  sourceRequestId: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  successCount: number;
};

function clipText(value: string, limit: number) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(1, limit - 1))}…`;
}

function normalizeInstinct(input: unknown): ExecutorInstinctRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  if (!id) return null;
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : createdAt;
  return {
    id,
    scope: typeof item.scope === "string" ? clipText(item.scope, 240) : "general",
    profileId: typeof item.profileId === "string" ? clipText(item.profileId, 120) : "general",
    taskLabel: typeof item.taskLabel === "string" ? clipText(item.taskLabel, 160) : "agent-task",
    title: typeof item.title === "string" ? clipText(item.title, 240) : "Untitled instinct",
    instinct: typeof item.instinct === "string" ? clipText(item.instinct, 800) : "",
    evidence: typeof item.evidence === "string" ? clipText(item.evidence, 800) : "",
    sourceSessionId:
      typeof item.sourceSessionId === "string" ? clipText(item.sourceSessionId, 160) : "",
    sourceRequestId:
      typeof item.sourceRequestId === "string" ? clipText(item.sourceRequestId, 160) : "",
    createdAt,
    updatedAt,
    usageCount:
      typeof item.usageCount === "number" && Number.isFinite(item.usageCount)
        ? Math.max(0, Math.floor(item.usageCount))
        : 0,
    successCount:
      typeof item.successCount === "number" && Number.isFinite(item.successCount)
        ? Math.max(1, Math.floor(item.successCount))
        : 1,
  };
}

async function readAllInstincts() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return raw
    .map(normalizeInstinct)
    .filter((item): item is ExecutorInstinctRecord => Boolean(item))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_INSTINCTS);
}

function buildInstinctId(scope: string, profileId: string, taskLabel: string) {
  return `${scope}::${profileId || "general"}::${taskLabel || "agent-task"}`.slice(0, 220);
}

export async function listRelevantExecutorInstincts(input: {
  scope?: string;
  profileId?: string;
  limit?: number;
}): Promise<ExecutorInstinctRecord[]> {
  const instincts = await readAllInstincts();
  const scope = (input.scope ?? "").trim();
  const profileId = (input.profileId ?? "").trim();
  const limit = Math.max(1, Math.min(5, input.limit ?? 2));

  const ranked = instincts
    .filter((instinct) => {
      if (scope && instinct.scope !== scope) return false;
      if (profileId && instinct.profileId !== profileId && instinct.profileId !== "general") {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      if (right.usageCount !== left.usageCount) return right.usageCount - left.usageCount;
      if (right.successCount !== left.successCount) return right.successCount - left.successCount;
      return right.updatedAt - left.updatedAt;
    })
    .slice(0, limit);

  return ranked;
}

export async function markExecutorInstinctsUsed(instinctIds: string[]) {
  const ids = Array.from(new Set(instinctIds.filter(Boolean)));
  if (ids.length === 0) return [];

  let updated: ExecutorInstinctRecord[] = [];
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const next = current
      .map(normalizeInstinct)
      .filter((item): item is ExecutorInstinctRecord => Boolean(item))
      .map((instinct) => {
        if (!ids.includes(instinct.id)) return instinct;
        const patched = {
          ...instinct,
          usageCount: instinct.usageCount + 1,
          updatedAt: Date.now(),
        };
        updated.push(patched);
        return patched;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_INSTINCTS);
    return next;
  });

  return updated;
}

function deriveInstinctContent(input: {
  profileId?: string;
  taskLabel?: string;
  requestMessage: string;
  outputText: string;
}) {
  const profileId = (input.profileId ?? "").trim();
  const title = profileId
    ? `${profileId} operating instinct`
    : `${input.taskLabel || "agent-task"} operating instinct`;
  const instinct =
    profileId === "sales_qualification_specialist"
      ? `优先保留缺失信息、阻塞点和明确下一步，不要把销售建议写成泛泛鼓励。模式：${clipText(input.outputText, 260)}`
      : profileId === "outreach_draft_specialist"
        ? `邮件类输出要先承认上下文，再给出清晰 CTA，并避免编造价格或交期。模式：${clipText(input.outputText, 260)}`
        : profileId === "support_reply_specialist"
          ? `客服类输出要先确认问题、再给处理路径，并把未知项显式标成待确认。模式：${clipText(input.outputText, 260)}`
          : profileId === "knowledge_asset_editor"
            ? `资产沉淀要提炼成下次可复用的结构，而不是重复原文。模式：${clipText(input.outputText, 260)}`
            : `在类似任务里，保持结构化、边界清楚、下一步明确。模式：${clipText(input.outputText, 260)}`;
  return {
    title,
    instinct,
    evidence: `Trigger: ${clipText(input.requestMessage, 180)}\nEvidence: ${clipText(input.outputText, 240)}`,
  };
}

export async function storeExecutorInstinct(input: {
  scope?: string;
  profileId?: string;
  taskLabel?: string;
  requestMessage: string;
  outputText: string;
  sourceSessionId: string;
  sourceRequestId: string;
}): Promise<ExecutorInstinctRecord | null> {
  const scope = (input.scope ?? "").trim();
  if (!scope || !input.outputText.trim()) return null;

  const profileId = (input.profileId ?? "").trim() || "general";
  const taskLabel = (input.taskLabel ?? "").trim() || "agent-task";
  const now = Date.now();
  const id = buildInstinctId(scope, profileId, taskLabel);
  const derived = deriveInstinctContent({
    profileId,
    taskLabel,
    requestMessage: input.requestMessage,
    outputText: input.outputText,
  });

  let stored: ExecutorInstinctRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const instincts = current
      .map(normalizeInstinct)
      .filter((item): item is ExecutorInstinctRecord => Boolean(item));
    const existing = instincts.find((item) => item.id === id);
    const nextRecord: ExecutorInstinctRecord = {
      id,
      scope,
      profileId,
      taskLabel,
      title: derived.title,
      instinct: derived.instinct,
      evidence: derived.evidence,
      sourceSessionId: input.sourceSessionId,
      sourceRequestId: input.sourceRequestId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      usageCount: existing?.usageCount ?? 0,
      successCount: (existing?.successCount ?? 0) + 1,
    };
    stored = nextRecord;
    return [nextRecord, ...instincts.filter((item) => item.id !== id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_INSTINCTS);
  });

  return stored;
}
