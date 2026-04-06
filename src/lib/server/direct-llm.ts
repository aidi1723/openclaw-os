import { normalizeBaseUrl } from "@/lib/url-utils";

export type ServerLlmConfigInput = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

const DEFAULT_PROVIDER = "kimi";
const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.cn/v1";
const DEFAULT_KIMI_MODEL = "moonshot-v1-8k";

function chatCompletionsUrl(baseUrl: string) {
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

export function resolveServerLlmConfig(input?: ServerLlmConfigInput | null) {
  const provider = String(input?.provider ?? DEFAULT_PROVIDER).trim().toLowerCase() || DEFAULT_PROVIDER;
  const apiKey = String(input?.apiKey ?? "").trim();
  const baseUrl = normalizeBaseUrl(String(input?.baseUrl ?? "").trim() || DEFAULT_KIMI_BASE_URL);
  const model = String(input?.model ?? "").trim() || DEFAULT_KIMI_MODEL;

  return {
    provider,
    apiKey,
    baseUrl,
    model,
  };
}

export async function requestServerLlmText(params: {
  llm?: ServerLlmConfigInput | null;
  systemPrompt?: string;
  userPrompt: string;
  timeoutMs?: number;
  temperature?: number;
}) {
  const config = resolveServerLlmConfig(params.llm);
  if (!config.apiKey) {
    return { ok: false as const, error: "缺少 Kimi API Key" };
  }
  if (!config.baseUrl || !config.model) {
    return { ok: false as const, error: "缺少 Kimi Base URL 或 Model" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(5_000, params.timeoutMs ?? 60_000));

  try {
    const upstream = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        temperature: typeof params.temperature === "number" ? params.temperature : 0.3,
        messages: [
          ...(params.systemPrompt?.trim()
            ? [{ role: "system" as const, content: params.systemPrompt.trim() }]
            : []),
          { role: "user" as const, content: params.userPrompt },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const json = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const error =
        (json &&
        typeof json === "object" &&
        "error" in json &&
        json.error &&
        typeof json.error === "object" &&
        "message" in json.error
          ? String((json.error as { message?: unknown }).message ?? "")
          : "") || `${upstream.status} ${upstream.statusText}`;
      return { ok: false as const, error, raw: json };
    }

    const text = String((json as any)?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return { ok: false as const, error: "模型未返回文本结果", raw: json };
    }

    return { ok: true as const, text, raw: json };
  } catch (err) {
    const error = err instanceof Error ? err.message : "请求异常";
    return { ok: false as const, error };
  } finally {
    clearTimeout(timeoutId);
  }
}
