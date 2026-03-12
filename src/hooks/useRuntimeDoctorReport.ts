"use client";

import { useEffect, useState } from "react";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import type { RuntimeDoctorReport } from "@/lib/runtime-doctor";

export function useRuntimeDoctorReport(enabled = true) {
  const [report, setReport] = useState<RuntimeDoctorReport | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(buildAgentCoreApiUrl("/api/runtime/doctor"), {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as
          | null
          | { ok?: boolean; report?: RuntimeDoctorReport; error?: string };
        if (cancelled) return;
        if (!response.ok || !data?.ok || !data.report) {
          setReport(null);
          setError(data?.error || "Runtime diagnostics failed.");
          return;
        }
        setReport(data.report);
      } catch (err) {
        if (cancelled) return;
        setReport(null);
        setError(err instanceof Error ? err.message : "Runtime diagnostics failed.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, revision]);

  return {
    report,
    loading,
    error,
    refresh() {
      setRevision((current) => current + 1);
    },
  };
}
