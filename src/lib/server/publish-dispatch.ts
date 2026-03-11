import { runOpenClawAgent } from "@/lib/openclaw-cli";
import type { MatrixAccountsSettings } from "@/lib/settings";

export type DispatchPlatform =
  | "xiaohongshu"
  | "douyin"
  | "wechat"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "storefront";

export function uniqDispatchPlatforms(input: unknown): DispatchPlatform[] {
  const supported = new Set<DispatchPlatform>([
    "xiaohongshu",
    "douyin",
    "wechat",
    "tiktok",
    "instagram",
    "twitter",
    "linkedin",
    "storefront",
  ]);
  if (!Array.isArray(input)) return [];
  const out: DispatchPlatform[] = [];
  for (const value of input) {
    if (typeof value !== "string") continue;
    const id = value.trim() as DispatchPlatform;
    if (!supported.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

function platformHint(id: DispatchPlatform) {
  switch (id) {
    case "xiaohongshu":
      return "小红书：标题 15–25 字；正文多分段；3–8 个 #话题；可加 Emoji。";
    case "douyin":
      return "抖音：前三秒钩子；口播短句；字幕要点；结尾引导关注/评论。";
    case "wechat":
      return "公众号：结构化小标题；引用数据/观点；结尾行动建议。";
    case "tiktok":
      return "TikTok：强钩子 + 快节奏；口语化；单屏字幕；CTA。";
    case "instagram":
      return "Instagram：短段落/列表；封面标题；3–10 个 hashtag。";
    case "twitter":
      return "X(Twitter)：一句结论 + 1–3 条要点；可拆 thread。";
    case "linkedin":
      return "LinkedIn：专业语气；案例/方法论；结尾提问互动。";
    case "storefront":
      return "独立站：产品利益点；FAQ；CTA（下单/咨询）；SEO 关键词。";
  }
}

function extractHashtags(text: string, max = 10) {
  const tags = new Set<string>();
  const re = /#([A-Za-z0-9_\u4e00-\u9fff]{1,40})/g;
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(text))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    tags.add(`#${raw}`);
    if (tags.size >= max) break;
  }
  return Array.from(tags);
}

function truncate(text: string, n: number) {
  const trimmed = text.trim();
  if (trimmed.length <= n) return trimmed;
  return `${trimmed.slice(0, Math.max(1, n - 1))}…`;
}

function fallbackVariants(params: { title: string; body: string; platforms: DispatchPlatform[] }) {
  const baseTags = extractHashtags(`${params.title}\n${params.body}`, 8);
  const variants: Record<string, { title: string; body: string; hashtags: string[]; checklist: string[] }> = {};
  for (const platform of params.platforms) {
    const checklist = [
      platformHint(platform),
      "合规：避免夸大/虚假承诺；如涉及对比/功效加证据。",
      "排版：适当空行、表情、要点列表；首段尽量短。",
    ];
    if (platform === "douyin" || platform === "tiktok") {
      variants[platform] = {
        title: truncate(params.title, 18),
        body:
          "【开场钩子】\n" +
          truncate(params.body, 60) +
          "\n\n【口播要点】\n- 要点 1\n- 要点 2\n- 要点 3\n\n【结尾】关注我，评论区发你清单。",
        hashtags: baseTags,
        checklist,
      };
      continue;
    }
    if (platform === "instagram") {
      variants[platform] = {
        title: truncate(params.title, 40),
        body: `${params.body}\n\n${baseTags.join(" ")}`.trim(),
        hashtags: baseTags,
        checklist,
      };
      continue;
    }
    variants[platform] = {
      title: truncate(params.title, 28),
      body: params.body,
      hashtags: baseTags,
      checklist,
    };
  }
  return variants;
}

export async function runPublishDispatch(params: {
  title: string;
  body: string;
  platforms: DispatchPlatform[];
  dryRun: boolean;
  connections: Partial<MatrixAccountsSettings> | Record<string, { token?: string; webhookUrl?: string }>;
  timeoutSeconds?: number;
}) {
  const title = params.title.trim();
  const content = params.body.trim();
  const platforms = uniqDispatchPlatforms(params.platforms);
  if (!title || !content) {
    return { ok: false as const, error: "缺少 title/body" };
  }
  if (platforms.length === 0) {
    return { ok: false as const, error: "请选择至少一个平台" };
  }

  const dryRun = params.dryRun;
  const connections = params.connections && typeof params.connections === "object" ? params.connections : {};
  const timeoutSeconds =
    typeof params.timeoutSeconds === "number" && Number.isFinite(params.timeoutSeconds)
      ? Math.max(10, Math.min(180, Math.floor(params.timeoutSeconds)))
      : 50;

  const checklist = platforms.map((platform, idx) => `${idx + 1}. ${platformHint(platform)}`).join("\n");
  const openclawMessage =
    "你是社媒发布助手。用户给你一份『原始内容』与『目标平台列表』。\n" +
    "你的任务：为每个平台生成可直接发布的版本，并给出检查清单。\n" +
    "要求：只输出严格 JSON（不要代码块、不要解释）。\n" +
    "JSON schema:\n" +
    "{\n" +
    '  "variants": {\n' +
    '    "<platform>": { "title": string, "body": string, "hashtags": string[], "checklist": string[] }\n' +
    "  }\n" +
    "}\n\n" +
    `平台列表：${platforms.join(", ")}\n` +
    `原始标题：${title}\n` +
    `原始内容：\n${content}\n\n` +
    "平台偏好提示：\n" +
    checklist;

  const openclaw =
    params.timeoutSeconds === 0
      ? ({ ok: false, error: "OpenClaw skipped", raw: null } as const)
      : await runOpenClawAgent({
          sessionId: `webos-publish-${dryRun ? "dry" : "dispatch"}`,
          message: openclawMessage,
          timeoutSeconds,
        });

  const variantsText = openclaw.ok ? openclaw.text : "";
  let variantsJson: any = null;
  try {
    variantsJson = variantsText ? JSON.parse(variantsText) : null;
  } catch {
    variantsJson = null;
  }

  const variants =
    variantsJson?.variants && typeof variantsJson.variants === "object"
      ? (variantsJson.variants as Record<string, any>)
      : fallbackVariants({ title, body: content, platforms });

  const actions = platforms.map((platform) => {
    const conn = (connections as any)?.[platform] as undefined | { token?: string; webhookUrl?: string };
    const webhookUrl = String(conn?.webhookUrl ?? "").trim();
    const token = String(conn?.token ?? "").trim();
    return {
      platform,
      mode: webhookUrl ? "webhook" : "manual",
      connected: Boolean(token),
      webhookUrlConfigured: Boolean(webhookUrl),
    } as const;
  });

  const text =
    `【发布${dryRun ? "预演" : "请求"}】\n` +
    `标题：${title}\n` +
    `平台：${platforms.join(", ")}\n\n` +
    `【内容】\n${content}\n\n` +
    `【平台建议】\n${checklist}\n\n` +
    "说明：若配置了平台 Webhook，将触发自动发布；否则返回手动发布清单。";

  if (dryRun) {
    return { ok: true as const, mode: "dry-run" as const, dryRun, platforms, actions, text, variants, openclaw };
  }

  const results: Array<{
    platform: DispatchPlatform;
    ok: boolean;
    mode: "webhook" | "manual";
    status?: number;
    responseText?: string;
    error?: string;
  }> = [];

  for (const platform of platforms) {
    const conn = (connections as any)?.[platform] as undefined | { token?: string; webhookUrl?: string };
    const webhookUrl = String(conn?.webhookUrl ?? "").trim();
    const token = String(conn?.token ?? "").trim();
    const variant = variants?.[platform] ?? null;
    const payload = {
      platform,
      title: String(variant?.title ?? title),
      body: String(variant?.body ?? content),
      hashtags: Array.isArray(variant?.hashtags) ? variant.hashtags : [],
      token,
      dryRun: false,
    };

    if (!webhookUrl) {
      results.push({
        platform,
        ok: true,
        mode: "manual",
        responseText: "未配置 Webhook，已返回手动发布清单。",
      });
      continue;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseText = await res.text().catch(() => "");
      results.push({
        platform,
        ok: res.ok,
        mode: "webhook",
        status: res.status,
        responseText: responseText.slice(0, 20_000),
        error: res.ok ? undefined : `Webhook 返回失败状态：${res.status}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求异常";
      results.push({ platform, ok: false, mode: "webhook", error: message });
    }
  }

  const allOk = results.every((result) => result.ok);
  return {
    ok: allOk,
    mode: "dispatch" as const,
    dryRun: false as const,
    platforms,
    actions,
    text,
    variants,
    results,
    openclaw,
  };
}
