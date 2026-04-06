import { NextResponse } from "next/server";
import { runPublishDispatch, uniqDispatchPlatforms } from "@/lib/server/publish-dispatch";
import type { ServerLlmConfigInput } from "@/lib/server/direct-llm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | {
          title?: string;
          body?: string;
          platforms?: unknown;
          dryRun?: boolean;
          connections?: Record<string, { token?: string; webhookUrl?: string }>;
          timeoutSeconds?: number;
          llm?: ServerLlmConfigInput;
        };

    const title = String(body?.title ?? "").trim();
    const content = String(body?.body ?? "").trim();
    const platforms = uniqDispatchPlatforms(body?.platforms);
    if (!title || !content) {
      return NextResponse.json({ ok: false, error: "缺少 title/body" }, { status: 400 });
    }
    if (platforms.length === 0) {
      return NextResponse.json({ ok: false, error: "请选择至少一个平台" }, { status: 400 });
    }

    const result = await runPublishDispatch({
      title,
      body: content,
      platforms,
      dryRun: body?.dryRun !== false,
      connections: body?.connections && typeof body.connections === "object" ? body.connections : {},
      timeoutSeconds: body?.timeoutSeconds,
      llm: body?.llm,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
