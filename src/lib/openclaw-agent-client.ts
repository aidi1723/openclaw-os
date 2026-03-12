"use client";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";

export type OpenClawAgentRequestInput = {
  message: string;
  sessionId: string;
  timeoutSeconds?: number;
};

export function buildOpenClawAgentRequest(input: OpenClawAgentRequestInput) {
  const settings = loadSettings();
  const { id, config } = getActiveLlmConfig(settings);

  return {
    ...input,
    systemPrompt: settings.assistant.systemPrompt || "",
    useSkills: true,
    workspaceContext: {
      activeIndustry: settings.personalization.activeIndustry,
      activeScenarioId: settings.personalization.activeScenarioId,
      runtimeProfile: settings.runtime.profile,
      runtimeShell: settings.runtime.shell,
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
