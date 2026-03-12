import { NextResponse } from "next/server";

import { POST as executeOpenClaw } from "../../openclaw/execute/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const sourceForm = await req.formData();
    const instruction = String(sourceForm.get("instruction") ?? sourceForm.get("prompt") ?? "").trim();
    const video = sourceForm.get("video") ?? sourceForm.get("file");

    if (!video || !(video instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "缺少视频文件" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!instruction) {
      return NextResponse.json(
        { ok: false, error: "缺少处理指令" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const executeForm = new FormData();
    executeForm.append("prompt", instruction);
    executeForm.append("file", video);

    const engineUrl = String(sourceForm.get("engineUrl") ?? "").trim();
    const token = String(sourceForm.get("token") ?? "").trim();
    if (engineUrl) executeForm.append("engineUrl", engineUrl);
    if (token) executeForm.append("token", token);

    const forwarded = new Request(req.url, {
      method: "POST",
      body: executeForm,
      headers: req.headers,
    });

    return executeOpenClaw(forwarded);
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求异常" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
