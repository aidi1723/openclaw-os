import {
  type AgentCoreLegacyTaskRequest,
  type AgentCoreTaskRequest,
  type AgentCoreTaskTrace,
  type AgentCoreTaskTraceAttempt,
  normalizeAgentCoreTaskRequest,
} from "@/lib/executor/contracts";
import {
  buildExecutionCandidates,
  normalizeExecutionPolicy,
  type ResolvedAgentCoreLlmConfig,
} from "@/lib/executor/policy";
import { buildSkillPlan } from "@/lib/executor/skills/planner";
import {
  runPostExecutionSkills,
  runPreExecutionSkills,
} from "@/lib/executor/skills/runtime";
import { normalizeBaseUrl } from "@/lib/url-utils";

type AgentCoreTaskOk = {
  ok: true;
  text: string;
  raw: unknown;
};

type AgentCoreTaskErr = {
  ok: false;
  error: string;
  raw?: unknown;
};

export type AgentCoreTaskResult = (AgentCoreTaskOk | AgentCoreTaskErr) & {
  engine: "agentcore_executor";
  trace: AgentCoreTaskTrace;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

function detectProvider(
  config: Required<Pick<ResolvedAgentCoreLlmConfig, "provider" | "baseUrl" | "model">>,
) {
  const provider = config.provider.trim().toLowerCase();
  const baseUrl = config.baseUrl.trim().toLowerCase();
  const model = config.model.trim().toLowerCase();

  if (provider === "anthropic") return "anthropic";
  if (baseUrl.includes("anthropic")) return "anthropic";
  if (model.startsWith("claude")) return "anthropic";
  return "openai_compatible";
}

function buildWorkspaceContextText(context?: Record<string, unknown> | null) {
  if (!context || typeof context !== "object") return "";

  const entries = Object.entries(context)
    .filter(
      ([, value]) =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    )
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .filter((entry) => !entry.endsWith("="));

  return entries.length > 0 ? entries.join(", ") : "";
}

export function buildAgentCoreSystemPrompt(request: AgentCoreTaskRequest) {
  const parts: string[] = [];
  const explicit = String(request.context.systemPrompt ?? "").trim();
  if (explicit) parts.push(explicit);

  parts.push(
    "You are AgentCore OS, an execution-focused business operating system.",
    "Prioritize stability, precision, and efficiency.",
    "Return concrete, reviewable outputs that can be used directly in a business workflow.",
  );

  const workspaceText = buildWorkspaceContextText(request.context.workspace);
  if (workspaceText) {
    parts.push(`Workspace context: ${workspaceText}`);
  }

  if (request.skillPolicy.enabled) {
    parts.push(
      "Use the available AgentCore OS operating context to produce structured, execution-ready outputs.",
      "Do not invent facts, policies, prices, timelines, or workflow state that were not provided.",
      "If key information is missing, say so explicitly and request the missing fields.",
    );
  }

  return parts.filter(Boolean).join("\n\n").trim();
}

function shouldUseMaxCompletionTokens(model: string) {
  const normalized = model.trim().toLowerCase();
  const parts = normalized.split("/");
  const resolved = parts[parts.length - 1] || normalized;
  return (
    resolved.startsWith("gpt-5") ||
    resolved.startsWith("o1") ||
    resolved.startsWith("o3") ||
    resolved.startsWith("o4")
  );
}

function buildOpenAiCompatibleChatUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";
  if (normalized.endsWith("/chat/completions")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function buildAnthropicMessagesUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";
  if (normalized.endsWith("/v1/messages")) return normalized;
  return `${normalized.replace(/\/+$/, "")}/v1/messages`;
}

async function callOpenAiCompatibleModel(
  config: ResolvedAgentCoreLlmConfig,
  messages: ChatMessage[],
  timeoutSeconds: number,
) {
  const url = buildOpenAiCompatibleChatUrl(config.baseUrl);
  if (!url) {
    throw new Error("缺少可用的模型 Base URL");
  }

  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: false,
  };

  if (shouldUseMaxCompletionTokens(config.model)) {
    payload.max_completion_tokens = 4096;
  } else {
    payload.max_tokens = 4096;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | null
      | {
          choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
          error?: unknown;
        };

    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "error" in data
          ? JSON.stringify(data.error)
          : `${response.status} ${response.statusText}`;
      throw new Error(`模型接口调用失败：${detail}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const text = content
        .map((item) => (typeof item?.text === "string" ? item.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) return text;
    }
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAnthropicModel(
  config: ResolvedAgentCoreLlmConfig,
  userMessage: string,
  systemPrompt: string,
  timeoutSeconds: number,
) {
  const url = buildAnthropicMessagesUrl(config.baseUrl);
  if (!url) {
    throw new Error("缺少可用的模型 Base URL");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | null
      | { content?: Array<{ type?: string; text?: string }>; error?: unknown };

    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "error" in data
          ? JSON.stringify(data.error)
          : `${response.status} ${response.statusText}`;
      throw new Error(`模型接口调用失败：${detail}`);
    }

    const text = Array.isArray(data?.content)
      ? data.content
          .map((item) =>
            item?.type === "text" && typeof item.text === "string" ? item.text : "",
          )
          .filter(Boolean)
          .join("\n")
          .trim()
      : "";
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

function waitMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFinalTrace(input: {
  request: AgentCoreTaskRequest;
  engine: "agentcore_executor";
  provider?: string;
  model?: string;
  startedAt: number;
  finishedAt: number;
  success: boolean;
  error?: string;
  attempts: AgentCoreTaskTraceAttempt[];
  fallbackUsed: boolean;
  skillPlan?: AgentCoreTaskTrace["skillPlan"];
  skillReceipts?: AgentCoreTaskTrace["skillReceipts"];
  memory?: AgentCoreTaskTrace["memory"];
}) {
  const { request, attempts } = input;
  return {
    source: request.metadata.source,
    engine: input.engine,
    provider: input.provider,
    model: input.model,
    sessionId: request.session.id,
    requestId: request.metadata.requestId,
    idempotencyKey: request.metadata.idempotencyKey,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: Math.max(0, input.finishedAt - input.startedAt),
    attemptCount: attempts.length,
    fallbackUsed: input.fallbackUsed,
    attempts,
    skillPlan: input.skillPlan,
    skillReceipts: input.skillReceipts ?? [],
    memory: input.memory,
    success: input.success,
    error: input.error,
  } satisfies AgentCoreTaskTrace;
}

async function attemptModelCandidate(input: {
  candidateKind: "primary" | "fallback";
  config: ResolvedAgentCoreLlmConfig;
  request: AgentCoreTaskRequest;
  systemPrompt: string;
  attempts: AgentCoreTaskTraceAttempt[];
  executionPolicy: ReturnType<typeof normalizeExecutionPolicy>;
}) {
  const provider = detectProvider(input.config);
  const messages: ChatMessage[] = [
    ...(input.systemPrompt
      ? ([{ role: "system", content: input.systemPrompt }] as ChatMessage[])
      : []),
    { role: "user", content: input.request.taskInput.userMessage },
  ];

  for (let attemptIndex = 0; attemptIndex < input.executionPolicy.maxAttempts; attemptIndex += 1) {
    const startedAt = Date.now();
    try {
      const text =
        provider === "anthropic"
          ? await callAnthropicModel(
              input.config,
              input.request.taskInput.userMessage,
              input.systemPrompt,
              input.executionPolicy.timeoutSeconds,
            )
          : await callOpenAiCompatibleModel(
              input.config,
              messages,
              input.executionPolicy.timeoutSeconds,
            );

      const finishedAt = Date.now();
      input.attempts.push({
        engine: "agentcore_executor",
        candidateKind: input.candidateKind,
        provider,
        model: input.config.model,
        attemptNumber: input.attempts.length + 1,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - startedAt),
        success: true,
      });

      return {
        ok: true as const,
        text,
        provider,
        model: input.config.model,
      };
    } catch (error) {
      const finishedAt = Date.now();
      const message = error instanceof Error ? error.message : "执行失败";
      input.attempts.push({
        engine: "agentcore_executor",
        candidateKind: input.candidateKind,
        provider,
        model: input.config.model,
        attemptNumber: input.attempts.length + 1,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - startedAt),
        success: false,
        error: message,
      });

      if (
        attemptIndex + 1 < input.executionPolicy.maxAttempts &&
        input.executionPolicy.retryBackoffMs > 0
      ) {
        await waitMs(input.executionPolicy.retryBackoffMs * (attemptIndex + 1));
      }
    }
  }

  return {
    ok: false as const,
    provider,
    model: input.config.model,
    error: input.attempts[input.attempts.length - 1]?.error || "执行失败",
  };
}

export async function runAgentCoreTask(
  request: AgentCoreTaskRequest | AgentCoreLegacyTaskRequest,
): Promise<AgentCoreTaskResult> {
  const normalizedRequest =
    "executionPolicy" in request &&
    "session" in request &&
    "taskInput" in request &&
    "context" in request &&
    "skillPolicy" in request &&
    "metadata" in request
      ? request
      : normalizeAgentCoreTaskRequest(request);
  const sessionId = normalizedRequest.session.id;
  const userMessage = normalizedRequest.taskInput.userMessage;
  const startedAt = Date.now();
  const attempts: AgentCoreTaskTraceAttempt[] = [];
  const candidates = buildExecutionCandidates(
    normalizedRequest.modelConfig ?? null,
    normalizedRequest.fallbackModelConfigs ?? [],
  );
  const executionPolicy = normalizeExecutionPolicy(normalizedRequest.executionPolicy, {
    hasPrimaryModel: candidates.length > 0,
  });
  const skillPlan = buildSkillPlan(normalizedRequest);
  const preSkill = await runPreExecutionSkills({
    request: normalizedRequest,
    skillPlan,
  });
  const systemPrompt = [
    buildAgentCoreSystemPrompt(normalizedRequest),
    ...preSkill.promptFragments,
  ]
    .filter(Boolean)
    .join("\n\n");

  for (const candidate of candidates) {
    const result = await attemptModelCandidate({
      candidateKind: candidate.kind,
      config: candidate.config,
      request: normalizedRequest,
      systemPrompt,
      attempts,
      executionPolicy,
    });

    if (result.ok) {
      const finishedAt = Date.now();
      const postSkill = await runPostExecutionSkills({
        request: normalizedRequest,
        skillPlan,
        outputText: result.text.trim(),
        success: true,
      });
      return {
        ok: true,
        text: result.text.trim(),
        raw: {
          provider: result.provider,
          sessionId,
          requestId: normalizedRequest.metadata.requestId,
          attempts,
          skillPlan,
        },
        engine: "agentcore_executor",
        trace: buildFinalTrace({
          request: normalizedRequest,
          engine: "agentcore_executor",
          provider: result.provider,
          model: result.model,
          startedAt,
          finishedAt,
          success: true,
          attempts,
          fallbackUsed: candidate.kind !== "primary",
          skillPlan,
          skillReceipts: [...preSkill.receipts, ...postSkill.receipts],
          memory: {
            scope: skillPlan.memoryScope,
            recalledInstincts: preSkill.memory.recalledInstincts,
            storedInstinctId: postSkill.memory.storedInstinctId,
          },
        }),
      };
    }
  }

  const finishedAt = Date.now();
  const lastAttempt = attempts[attempts.length - 1];
  const failedPostSkill = await runPostExecutionSkills({
    request: normalizedRequest,
    skillPlan,
    outputText: "",
    success: false,
  });
  return {
    ok: false,
    error:
      lastAttempt?.error ||
      (candidates.length === 0 ? "缺少可用的 Kimi 配置，请先在设置中填写 API Key。" : "执行失败"),
    engine: "agentcore_executor",
    trace: buildFinalTrace({
      request: normalizedRequest,
      engine: "agentcore_executor",
      provider: lastAttempt?.provider,
      model: lastAttempt?.model,
      startedAt,
      finishedAt,
      success: false,
      error:
        lastAttempt?.error ||
        (candidates.length === 0 ? "缺少可用的 Kimi 配置，请先在设置中填写 API Key。" : "执行失败"),
      attempts,
      fallbackUsed: attempts.some((attempt) => attempt.candidateKind !== "primary"),
      skillPlan,
      skillReceipts: [...preSkill.receipts, ...failedPostSkill.receipts],
      memory: {
        scope: skillPlan.memoryScope,
        recalledInstincts: preSkill.memory.recalledInstincts,
      },
    }),
  };
}
