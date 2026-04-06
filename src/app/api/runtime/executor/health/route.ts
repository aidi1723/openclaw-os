import { NextResponse } from "next/server";

import { getExecutorAuditOverview } from "@/lib/server/executor-audit-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const overview = await getExecutorAuditOverview();
    return NextResponse.json(
      { ok: true, data: { overview } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load executor health overview.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
