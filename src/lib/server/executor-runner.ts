import {
  runAgentCoreTask,
} from "@/lib/executor/core";
import {
  normalizeAgentCoreTaskRequest,
  type AgentCoreLegacyTaskRequest,
  type AgentCoreTaskRequest,
} from "@/lib/executor/contracts";
import { appendExecutorAuditRun } from "@/lib/server/executor-audit-store";
import { appendExecutorSessionTurn } from "@/lib/server/executor-session-store";

export async function executeAgentCoreTask(
  request: (AgentCoreTaskRequest | AgentCoreLegacyTaskRequest) & { source?: string },
) {
  const normalizedRequest =
    "executionPolicy" in request &&
    "session" in request &&
    "taskInput" in request &&
    "context" in request &&
    "skillPolicy" in request
      ? request
      : {
          ...normalizeAgentCoreTaskRequest(request, {
            source: request.source,
          }),
        };
  const normalizedSource =
    normalizedRequest.metadata.source ?? request.source ?? "api/openclaw/agent";
  const startedAt = Date.now();
  const result = await runAgentCoreTask(normalizedRequest);
  const finishedAt = Date.now();

  await appendExecutorSessionTurn({
    sessionId: normalizedRequest.session.id,
    requestId: normalizedRequest.metadata.requestId,
    idempotencyKey: normalizedRequest.metadata.idempotencyKey,
    source: normalizedSource,
    engine: result.trace.engine,
    ok: result.ok,
    attemptCount: result.trace.attemptCount,
    fallbackUsed: result.trace.fallbackUsed,
    skillPlan: result.trace.skillPlan,
    skillReceipts: result.trace.skillReceipts,
    memory: result.trace.memory,
    message: normalizedRequest.taskInput.userMessage,
    systemPrompt: normalizedRequest.context.systemPrompt ?? "",
    useSkills: normalizedRequest.skillPolicy.enabled,
    workspaceContext: normalizedRequest.context.workspace ?? null,
    llmProvider: normalizedRequest.modelConfig?.provider ?? "",
    llmModel: normalizedRequest.modelConfig?.model ?? "",
    timeoutSeconds: normalizedRequest.executionPolicy.timeoutSeconds,
    attempts: result.trace.attempts,
    outputText: result.ok ? result.text : undefined,
    error: result.ok ? undefined : result.trace.error,
    durationMs: finishedAt - startedAt,
    createdAt: startedAt,
  });

  await appendExecutorAuditRun({
    requestId: normalizedRequest.metadata.requestId,
    idempotencyKey: normalizedRequest.metadata.idempotencyKey,
    sessionId: normalizedRequest.session.id,
    source: normalizedSource,
    createdAt: result.trace.startedAt,
    finishedAt: result.trace.finishedAt,
    durationMs: result.trace.durationMs,
    engine: result.trace.engine,
    ok: result.ok,
    provider: result.trace.provider ?? "",
    model: result.trace.model ?? "",
    attemptCount: result.trace.attemptCount,
    fallbackUsed: result.trace.fallbackUsed,
    messagePreview: normalizedRequest.taskInput.userMessage,
    outputPreview: result.ok ? result.text : result.trace.error ?? "",
    error: result.ok ? undefined : result.trace.error,
    attempts: result.trace.attempts,
  });

  return result;
}
