import { NextResponse } from "next/server";

import { writePublishConfig, readPublishConfig } from "@/lib/server/publish-config-store";

export const runtime = "nodejs";

export async function GET() {
  const matrixAccounts = await readPublishConfig();
  return NextResponse.json(
    { ok: true, data: { matrixAccounts } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { matrixAccounts?: unknown };
    const matrixAccounts = await writePublishConfig((body?.matrixAccounts ?? {}) as any);
    return NextResponse.json(
      { ok: true, data: { matrixAccounts } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
