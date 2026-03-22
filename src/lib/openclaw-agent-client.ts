"use client";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import {
  buildAgentProfileSystemPrompt,
  buildRealityCheckMessage,
  type AgentProfileId,
} from "@/lib/agent-profiles";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";

export type OpenClawAgentRequestInput = {
  message: string;
  sessionId: string;
  timeoutSeconds?: number;
  expertProfileId?: AgentProfileId;
};

export function buildOpenClawAgentRequest(input: OpenClawAgentRequestInput) {
  const settings = loadSettings();
  const { id, config } = getActiveLlmConfig(settings);
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

  return {
    message: input.message,
    sessionId: input.sessionId,
    timeoutSeconds: input.timeoutSeconds,
    systemPrompt,
    useSkills: true,
    workspaceContext: {
      activeIndustry: settings.personalization.activeIndustry,
      activeScenarioId: settings.personalization.activeScenarioId,
      runtimeProfile: settings.runtime.profile,
      runtimeShell: settings.runtime.shell,
      expertProfileId: enabledExpertProfileId || "",
    },
    llm: {
      provider: id,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    },
  };
}

export async function requestOpenClawAgent(input: OpenClawAgentRequestInput) {
  const res = await fetch(buildAgentCoreApiUrl("/api/openclaw/agent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOpenClawAgentRequest(input)),
  });

  const data = (await res.json().catch(() => null)) as
    | null
    | { ok?: boolean; text?: string; error?: string };

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "执行失败，请检查 OpenClaw 是否运行");
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
  });
}
