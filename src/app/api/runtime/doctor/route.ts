import { NextResponse } from "next/server";

import { getRuntimeDoctorReport } from "@/lib/runtime-doctor";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      {
        ok: true,
        report: getRuntimeDoctorReport(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to inspect local runtime.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
