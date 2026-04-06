"use client";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import {
  type AgentCoreLegacyTaskRequest,
  type AgentCoreSkillId,
} from "@/lib/executor/contracts";
import {
  buildAgentProfileSystemPrompt,
  buildRealityCheckMessage,
  type AgentProfileId,
} from "@/lib/agent-profiles";
import { getExecutionLlmPlan, loadSettings } from "@/lib/settings";

export type OpenClawAgentRequestInput = {
  message: string;
  sessionId: string;
  timeoutSeconds?: number;
  expertProfileId?: AgentProfileId;
  taskLabel?: string;
  memoryScope?: string;
};

export function buildOpenClawAgentRequest(
  input: OpenClawAgentRequestInput,
): AgentCoreLegacyTaskRequest {
  const settings = loadSettings();
  const executionPlan = getExecutionLlmPlan(settings);
  const enabledExpertProfileId =
    input.expertProfileId &&
    settings.assistant.expertProfiles[input.expertProfileId]?.enabled !== false
      ? input.expertProfileId
      : undefined;
  const systemPromptParts = [settings.assistant.systemPrompt || ""];
  if (enabledExpertProfileId) {
    systemPromptParts.push(buildAgentProfileSystemPrompt(enabledExpertProfileId));
  }
  const systemPrompt = systemPromptParts.filter((part) => part.trim()).join("\n\n");
  const allowedSkillIds: AgentCoreSkillId[] | undefined = settings.assistant.skillRuntime.autoKnowledgeCapture
    ? undefined
    : [
        "memory_recall",
        "sales_qualification",
        "outreach_draft",
        "support_reply",
        "reality_guard",
      ];

  return {
    message: input.message,
    sessionId: input.sessionId,
    timeoutSeconds: input.timeoutSeconds,
    maxAttempts: settings.llm.routing.maxAttempts,
    retryBackoffMs: settings.llm.routing.retryBackoffMs,
    allowFallbackToOpenClaw: false,
    systemPrompt,
    useSkills: true,
    skillMode: settings.assistant.skillRuntime.mode,
    skillProfileId: enabledExpertProfileId,
    allowedSkillIds,
    enableMemoryV2: settings.assistant.skillRuntime.memoryV2Enabled,
    maxInstincts: settings.assistant.skillRuntime.maxInstincts,
    memoryScope:
      input.memoryScope ||
      [
        settings.personalization.activeIndustry,
        settings.personalization.activeScenarioId,
        enabledExpertProfileId || "general",
      ]
        .filter(Boolean)
        .join(":"),
    taskLabel: input.taskLabel || enabledExpertProfileId || "agent-task",
    workspaceContext: {
      activeIndustry: settings.personalization.activeIndustry,
      activeScenarioId: settings.personalization.activeScenarioId,
      runtimeProfile: settings.runtime.profile,
      runtimeShell: settings.runtime.shell,
      expertProfileId: enabledExpertProfileId || "",
    },
    llm: {
      provider: executionPlan.primary.id,
      apiKey: executionPlan.primary.config.apiKey,
      baseUrl: executionPlan.primary.config.baseUrl,
      model: executionPlan.primary.config.model,
    },
    fallbackLlm: [],
  };
}

export async function requestOpenClawAgent(input: OpenClawAgentRequestInput) {
  const res = await fetch(buildAgentCoreApiUrl("/api/agent/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOpenClawAgentRequest(input)),
  });

  const data = (await res.json().catch(() => null)) as
    | null
    | { ok?: boolean; text?: string; error?: string };

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "执行失败，请检查 Kimi 配置是否可用");
  }

  return String(data.text ?? "").trim();
}

export async function requestRealityCheck(input: {
  taskLabel: string;
  sourceContext: string;
  candidateOutput: string;
  sessionId: string;
  timeoutSeconds?: number;
}) {
  const settings = loadSettings();
  if (settings.assistant.expertProfiles.reality_checker?.enabled === false) {
    return "";
  }

  return requestOpenClawAgent({
    message: buildRealityCheckMessage(input),
    sessionId: input.sessionId,
    timeoutSeconds: input.timeoutSeconds,
    expertProfileId: "reality_checker",
    taskLabel: "reality-check",
  });
}
