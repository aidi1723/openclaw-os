export type AgentCoreExecutorLlmConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  label?: string;
};

export type AgentCoreTaskInput = {
  userMessage: string;
};

export type AgentCoreSessionRef = {
  id: string;
};

export type AgentCoreExecutionContext = {
  systemPrompt?: string;
  workspace?: Record<string, unknown> | null;
};

export type AgentCoreSkillId =
  | "memory_recall"
  | "sales_qualification"
  | "outreach_draft"
  | "support_reply"
  | "reality_guard"
  | "knowledge_capture";

export type AgentCoreSkillPolicy = {
  enabled: boolean;
  mode?: "off" | "auto" | "strict";
  preferredProfileId?: string;
  allowedSkillIds?: AgentCoreSkillId[];
  enableMemory?: boolean;
  memoryScope?: string;
  taskLabel?: string;
  maxInstincts?: number;
};

export type AgentCoreExecutionMetadata = {
  requestId: string;
  idempotencyKey?: string;
  source?: string;
};

export type AgentCoreExecutionPolicy = {
  timeoutSeconds: number;
  maxAttempts: number;
  retryBackoffMs: number;
  allowFallbackToOpenClaw: boolean;
};

export type AgentCoreTaskRequest = {
  taskInput: AgentCoreTaskInput;
  session: AgentCoreSessionRef;
  metadata: AgentCoreExecutionMetadata;
  context: AgentCoreExecutionContext;
  skillPolicy: AgentCoreSkillPolicy;
  modelConfig?: AgentCoreExecutorLlmConfig | null;
  fallbackModelConfigs?: AgentCoreExecutorLlmConfig[];
  executionPolicy: AgentCoreExecutionPolicy;
};

export type AgentCoreLegacyTaskRequest = {
  message?: string;
  sessionId?: string;
  requestId?: string;
  idempotencyKey?: string;
  source?: string;
  timeoutSeconds?: number;
  maxAttempts?: number;
  retryBackoffMs?: number;
  allowFallbackToOpenClaw?: boolean;
  systemPrompt?: string;
  useSkills?: boolean;
  skillMode?: "off" | "auto" | "strict";
  skillProfileId?: string;
  allowedSkillIds?: AgentCoreSkillId[] | null;
  enableMemoryV2?: boolean;
  memoryScope?: string;
  taskLabel?: string;
  maxInstincts?: number;
  workspaceContext?: Record<string, unknown> | null;
  llm?: AgentCoreExecutorLlmConfig | null;
  fallbackLlm?: AgentCoreExecutorLlmConfig[] | null;
};

export type AgentCoreTaskTraceAttempt = {
  engine: "agentcore_executor" | "openclaw_cli_fallback";
  candidateKind: "primary" | "fallback" | "legacy";
  provider?: string;
  model?: string;
  attemptNumber: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  success: boolean;
  error?: string;
};

export type AgentCoreSkillPlan = {
  selectedSkillIds: AgentCoreSkillId[];
  plannerReason: string[];
  preferredProfileId?: string;
  memoryScope?: string;
};

export type AgentCoreSkillReceipt = {
  skillId: AgentCoreSkillId;
  phase: "pre" | "post";
  ok: boolean;
  summary: string;
  outputText?: string;
};

export type AgentCoreMemoryTrace = {
  scope?: string;
  recalledInstincts: number;
  storedInstinctId?: string;
};

export type AgentCoreTaskTrace = {
  source?: string;
  engine: "agentcore_executor" | "openclaw_cli_fallback";
  provider?: string;
  model?: string;
  sessionId: string;
  requestId: string;
  idempotencyKey?: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  attemptCount: number;
  fallbackUsed: boolean;
  attempts: AgentCoreTaskTraceAttempt[];
  skillPlan?: AgentCoreSkillPlan;
  skillReceipts: AgentCoreSkillReceipt[];
  memory?: AgentCoreMemoryTrace;
  success: boolean;
  error?: string;
};

function normalizeTimeoutSeconds(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(5, Math.min(600, Math.floor(value)))
    : 60;
}

function normalizeMaxAttempts(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(4, Math.floor(value)))
    : 2;
}

function normalizeRetryBackoffMs(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(5_000, Math.floor(value)))
    : 350;
}

function buildExecutionId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeAgentCoreTaskRequest(
  input: AgentCoreLegacyTaskRequest,
  defaults?: { sessionId?: string; source?: string },
): AgentCoreTaskRequest {
  const message = (input.message ?? "").trim();
  const sessionId = (input.sessionId ?? defaults?.sessionId ?? "webos-spotlight").trim();
  const requestId = (input.requestId ?? "").trim() || buildExecutionId("exec");
  const idempotencyKey = (input.idempotencyKey ?? "").trim();

  return {
    taskInput: {
      userMessage: message,
    },
    session: {
      id: sessionId || defaults?.sessionId || "webos-spotlight",
    },
    metadata: {
      requestId,
      idempotencyKey: idempotencyKey || undefined,
      source: (input.source ?? defaults?.source ?? "").trim() || undefined,
    },
    context: {
      systemPrompt: typeof input.systemPrompt === "string" ? input.systemPrompt : "",
      workspace:
        input.workspaceContext && typeof input.workspaceContext === "object"
          ? input.workspaceContext
          : null,
    },
    skillPolicy: {
      enabled: input.useSkills !== false,
      mode:
        input.skillMode === "off" || input.skillMode === "strict"
          ? input.skillMode
          : "auto",
      preferredProfileId:
        typeof input.skillProfileId === "string" && input.skillProfileId.trim()
          ? input.skillProfileId.trim()
          : undefined,
      allowedSkillIds: Array.isArray(input.allowedSkillIds)
        ? input.allowedSkillIds
            .filter((item): item is AgentCoreSkillId => typeof item === "string")
            .slice(0, 12)
        : undefined,
      enableMemory: input.enableMemoryV2 !== false,
      memoryScope:
        typeof input.memoryScope === "string" && input.memoryScope.trim()
          ? input.memoryScope.trim()
          : undefined,
      taskLabel:
        typeof input.taskLabel === "string" && input.taskLabel.trim()
          ? input.taskLabel.trim()
          : undefined,
      maxInstincts:
        typeof input.maxInstincts === "number" && Number.isFinite(input.maxInstincts)
          ? Math.max(1, Math.min(5, Math.floor(input.maxInstincts)))
          : undefined,
    },
    modelConfig: input.llm ?? null,
    fallbackModelConfigs: Array.isArray(input.fallbackLlm) ? input.fallbackLlm : [],
    executionPolicy: {
      timeoutSeconds: normalizeTimeoutSeconds(input.timeoutSeconds),
      maxAttempts: normalizeMaxAttempts(input.maxAttempts),
      retryBackoffMs: normalizeRetryBackoffMs(input.retryBackoffMs),
      allowFallbackToOpenClaw: input.allowFallbackToOpenClaw === true,
    },
  };
}
