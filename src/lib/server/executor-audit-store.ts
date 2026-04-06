import type { AgentCoreTaskTraceAttempt } from "@/lib/executor/contracts";
import { redactSensitiveText } from "@/lib/executor/redaction";
import { readJsonFile, readModifyWrite } from "@/lib/server/json-store";

const FILE_NAME = "executor-audit-runs.json";
const MAX_RUNS = 400;

export type ExecutorAuditRunRecord = {
  requestId: string;
  idempotencyKey?: string;
  sessionId: string;
  source: string;
  createdAt: number;
  finishedAt: number;
  durationMs: number;
  engine: string;
  ok: boolean;
  provider: string;
  model: string;
  attemptCount: number;
  fallbackUsed: boolean;
  messagePreview: string;
  outputPreview: string;
  error?: string;
  attempts: AgentCoreTaskTraceAttempt[];
};

export type ExecutorAuditOverview = {
  generatedAt: string;
  status: "healthy" | "degraded" | "failing";
  totals: {
    runs: number;
    ok: number;
    error: number;
    fallback: number;
  };
  recent24h: {
    runs: number;
    ok: number;
    error: number;
    failureRate: number;
    fallbackRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
  };
  latestFailureAt: number | null;
  providers: string[];
};

function clipText(value: string, limit: number) {
  const trimmed = redactSensitiveText(value).trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(1, limit - 1))}…`;
}

function normalizeAttempts(input: unknown): AgentCoreTaskTraceAttempt[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .slice(-12)
    .map((item, index) => {
      const startedAt =
        typeof item.startedAt === "number" && Number.isFinite(item.startedAt)
          ? item.startedAt
          : Date.now();
      const finishedAt =
        typeof item.finishedAt === "number" && Number.isFinite(item.finishedAt)
          ? item.finishedAt
          : startedAt;
      return {
        engine:
          item.engine === "openclaw_cli_fallback"
            ? "openclaw_cli_fallback"
            : "agentcore_executor",
        candidateKind:
          item.candidateKind === "fallback"
            ? "fallback"
            : item.candidateKind === "legacy"
              ? "legacy"
              : "primary",
        provider:
          typeof item.provider === "string" && item.provider.trim()
            ? clipText(item.provider, 120)
            : undefined,
        model:
          typeof item.model === "string" && item.model.trim()
            ? clipText(item.model, 240)
            : undefined,
        attemptNumber:
          typeof item.attemptNumber === "number" && Number.isFinite(item.attemptNumber)
            ? Math.max(1, Math.floor(item.attemptNumber))
            : index + 1,
        startedAt,
        finishedAt,
        durationMs:
          typeof item.durationMs === "number" && Number.isFinite(item.durationMs)
            ? Math.max(0, Math.floor(item.durationMs))
            : Math.max(0, finishedAt - startedAt),
        success: Boolean(item.success),
        error:
          typeof item.error === "string" && item.error.trim()
            ? clipText(item.error, 2_000)
            : undefined,
      };
    });
}

function normalizeRun(input: unknown): ExecutorAuditRunRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const requestId =
    typeof item.requestId === "string" && item.requestId.trim() ? item.requestId.trim() : null;
  if (!requestId) return null;

  return {
    requestId,
    idempotencyKey:
      typeof item.idempotencyKey === "string" && item.idempotencyKey.trim()
        ? clipText(item.idempotencyKey, 200)
        : undefined,
    sessionId:
      typeof item.sessionId === "string" && item.sessionId.trim()
        ? clipText(item.sessionId, 160)
        : "unknown-session",
    source:
      typeof item.source === "string" && item.source.trim()
        ? clipText(item.source, 120)
        : "agentcore",
    createdAt:
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now(),
    finishedAt:
      typeof item.finishedAt === "number" && Number.isFinite(item.finishedAt)
        ? item.finishedAt
        : Date.now(),
    durationMs:
      typeof item.durationMs === "number" && Number.isFinite(item.durationMs)
        ? Math.max(0, Math.floor(item.durationMs))
        : 0,
    engine:
      typeof item.engine === "string" && item.engine.trim()
        ? clipText(item.engine, 120)
        : "unknown",
    ok: Boolean(item.ok),
    provider:
      typeof item.provider === "string" && item.provider.trim()
        ? clipText(item.provider, 120)
        : "",
    model:
      typeof item.model === "string" && item.model.trim()
        ? clipText(item.model, 240)
        : "",
    attemptCount:
      typeof item.attemptCount === "number" && Number.isFinite(item.attemptCount)
        ? Math.max(1, Math.floor(item.attemptCount))
        : Math.max(1, normalizeAttempts(item.attempts).length || 1),
    fallbackUsed: Boolean(item.fallbackUsed),
    messagePreview:
      typeof item.messagePreview === "string" ? clipText(item.messagePreview, 600) : "",
    outputPreview:
      typeof item.outputPreview === "string" ? clipText(item.outputPreview, 800) : "",
    error:
      typeof item.error === "string" && item.error.trim()
        ? clipText(item.error, 3_000)
        : undefined,
    attempts: normalizeAttempts(item.attempts),
  };
}

async function readAllRuns() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return raw
    .map(normalizeRun)
    .filter((item): item is ExecutorAuditRunRecord => Boolean(item))
    .sort((left, right) => right.finishedAt - left.finishedAt)
    .slice(0, MAX_RUNS);
}

export async function appendExecutorAuditRun(input: ExecutorAuditRunRecord) {
  const normalized = normalizeRun(input);
  if (!normalized) return null;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const runs = current
      .map(normalizeRun)
      .filter((item): item is ExecutorAuditRunRecord => Boolean(item))
      .filter((item) => item.requestId !== normalized.requestId);
    return [normalized, ...runs]
      .sort((left, right) => right.finishedAt - left.finishedAt)
      .slice(0, MAX_RUNS);
  });

  return normalized;
}

export async function getExecutorAuditOverview(): Promise<ExecutorAuditOverview> {
  const runs = await readAllRuns();
  const now = Date.now();
  const windowStart = now - 24 * 60 * 60 * 1000;
  const recent = runs.filter((run) => run.finishedAt >= windowStart);
  const ok = recent.filter((run) => run.ok).length;
  const error = recent.length - ok;
  const fallback = recent.filter((run) => run.fallbackUsed).length;
  const durations = recent.map((run) => run.durationMs).sort((a, b) => a - b);
  const p95Index = durations.length > 0 ? Math.min(durations.length - 1, Math.floor(durations.length * 0.95)) : -1;
  const failureRate = recent.length > 0 ? error / recent.length : 0;
  const fallbackRate = recent.length > 0 ? fallback / recent.length : 0;
  const latestFailure = runs.find((run) => !run.ok)?.finishedAt ?? null;
  const providers = Array.from(
    new Set(
      runs
        .map((run) => run.provider || run.engine)
        .filter(Boolean)
        .slice(0, 8),
    ),
  );

  const status =
    recent.length === 0 || failureRate <= 0.15
      ? "healthy"
      : failureRate <= 0.4
        ? "degraded"
        : "failing";

  return {
    generatedAt: new Date(now).toISOString(),
    status,
    totals: {
      runs: runs.length,
      ok: runs.filter((run) => run.ok).length,
      error: runs.filter((run) => !run.ok).length,
      fallback: runs.filter((run) => run.fallbackUsed).length,
    },
    recent24h: {
      runs: recent.length,
      ok,
      error,
      failureRate,
      fallbackRate,
      avgDurationMs:
        recent.length > 0
          ? Math.round(recent.reduce((sum, run) => sum + run.durationMs, 0) / recent.length)
          : 0,
      p95DurationMs: p95Index >= 0 ? durations[p95Index] ?? 0 : 0,
    },
    latestFailureAt: latestFailure,
    providers,
  };
}
