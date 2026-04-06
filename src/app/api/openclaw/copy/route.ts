import { NextResponse } from "next/server";
import { requestServerLlmText, type ServerLlmConfigInput } from "@/lib/server/direct-llm";

export const runtime = "nodejs";

type Style = "xiaohongshu" | "wechat" | "shortvideo";

const systemPromptByStyle: Record<Style, string> = {
  xiaohongshu:
    "你是内容写作助手。请生成适合小红书发布的内容：大量使用 Emoji，排版要有空行，标题和开头要抓人；输出包含：标题（1-3 个备选）、正文、标签（# 话题），整体可直接发布。",
  wechat:
    "你是写作助手。请生成适合公众号发布的文章：结构严谨、逻辑清晰、适合深度阅读；输出包含：标题、摘要、正文（分级小标题）、结论与行动建议。",
  shortvideo:
    "你是脚本生成助手。请输出节奏快、口语化的短视频脚本，包含：开场 3 秒钩子、镜头/画面提示、口播文案、字幕要点、结尾关注引导。",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { style?: Style; topic?: string; llm?: ServerLlmConfigInput };

    const style = (body?.style ?? "xiaohongshu") as Style;
    const topic = (body?.topic ?? "").trim();
    if (!topic) {
      return NextResponse.json({ ok: false, error: "缺少输入内容" }, { status: 400 });
    }

    const systemPrompt =
      (systemPromptByStyle[style] ?? systemPromptByStyle.xiaohongshu) +
      "\n只输出最终文案本身，不要解释你的思考过程。";
    const r = await requestServerLlmText({
      llm: body?.llm,
      systemPrompt,
      userPrompt: topic,
      timeoutMs: 90_000,
      temperature: 0.7,
    });
    if (!r.ok) return NextResponse.json(r, { status: 502 });

    return NextResponse.json(
      { ok: true, text: r.text, raw: r.raw },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
