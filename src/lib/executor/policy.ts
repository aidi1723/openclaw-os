import {
  type AgentCoreExecutionPolicy,
  type AgentCoreExecutorLlmConfig,
} from "@/lib/executor/contracts";
import { normalizeBaseUrl } from "@/lib/url-utils";

export type ResolvedAgentCoreLlmConfig = Required<
  Pick<AgentCoreExecutorLlmConfig, "provider" | "apiKey" | "baseUrl" | "model">
> & {
  label: string;
};

export type AgentCoreExecutionCandidate = {
  kind: "primary" | "fallback";
  config: ResolvedAgentCoreLlmConfig;
};

export function hasUsableLlmConfig(
  config?: AgentCoreExecutorLlmConfig | null,
): config is Required<Pick<AgentCoreExecutorLlmConfig, "provider" | "apiKey" | "baseUrl" | "model">> {
  return Boolean(
    config?.apiKey?.trim() &&
      normalizeBaseUrl(config?.baseUrl ?? "") &&
      config?.model?.trim(),
  );
}

export function resolveLlmConfig(
  config?: AgentCoreExecutorLlmConfig | null,
): ResolvedAgentCoreLlmConfig | null {
  const rawLabel = String(config?.label ?? "").trim();
  if (!hasUsableLlmConfig(config)) return null;
  return {
    provider: String(config.provider ?? "openai").trim() || "openai",
    apiKey: config.apiKey.trim(),
    baseUrl: normalizeBaseUrl(config.baseUrl),
    model: config.model.trim(),
    label: rawLabel,
  };
}

export function buildExecutionCandidates(
  primary?: AgentCoreExecutorLlmConfig | null,
  fallbacks?: AgentCoreExecutorLlmConfig[] | null,
) {
  const candidates: AgentCoreExecutionCandidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (
    kind: "primary" | "fallback",
    config?: AgentCoreExecutorLlmConfig | null,
  ) => {
    const resolved = resolveLlmConfig(config);
    if (!resolved) return;
    const dedupeKey = [
      resolved.provider.toLowerCase(),
      resolved.baseUrl.toLowerCase(),
      resolved.model.toLowerCase(),
    ].join("::");
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    candidates.push({ kind, config: resolved });
  };

  pushCandidate("primary", primary);
  for (const config of fallbacks ?? []) {
    pushCandidate("fallback", config);
  }

  return candidates;
}

export function normalizeExecutionPolicy(
  policy: AgentCoreExecutionPolicy,
  options?: { hasPrimaryModel: boolean },
): AgentCoreExecutionPolicy {
  return {
    timeoutSeconds:
      typeof policy.timeoutSeconds === "number" && Number.isFinite(policy.timeoutSeconds)
        ? Math.max(5, Math.min(600, Math.floor(policy.timeoutSeconds)))
        : 60,
    maxAttempts:
      typeof policy.maxAttempts === "number" && Number.isFinite(policy.maxAttempts)
        ? Math.max(1, Math.min(4, Math.floor(policy.maxAttempts)))
        : 2,
    retryBackoffMs:
      typeof policy.retryBackoffMs === "number" && Number.isFinite(policy.retryBackoffMs)
        ? Math.max(0, Math.min(5_000, Math.floor(policy.retryBackoffMs)))
        : 350,
    allowFallbackToOpenClaw: policy.allowFallbackToOpenClaw === true && options?.hasPrimaryModel === true,
  };
}
