import { NextResponse } from "next/server";

import { createPublishJobRecord, listPublishJobs } from "@/lib/server/publish-job-store";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await listPublishJobs();
  return NextResponse.json({ ok: true, data: { jobs } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | {
          draftId?: string;
          draftTitle?: string;
          draftBody?: string;
          platforms?: unknown;
          mode?: "dry-run" | "dispatch";
          status?: "queued" | "running" | "done" | "error" | "stopped";
          maxAttempts?: number;
        };

    const draftTitle = String(body?.draftTitle ?? "").trim();
    if (!draftTitle) {
      return NextResponse.json({ ok: false, error: "缺少 draftTitle" }, { status: 400 });
    }

    const job = await createPublishJobRecord({
      draftId: typeof body?.draftId === "string" ? body.draftId : undefined,
      draftTitle,
      draftBody: typeof body?.draftBody === "string" ? body.draftBody : "",
      platforms: Array.isArray(body?.platforms) ? (body.platforms as any) : [],
      mode: body?.mode,
      status: body?.status,
      maxAttempts: typeof body?.maxAttempts === "number" ? body.maxAttempts : undefined,
    });
    return NextResponse.json({ ok: true, data: { job } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
