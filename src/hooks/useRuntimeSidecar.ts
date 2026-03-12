"use client";

import { useEffect, useState } from "react";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import type {
  RuntimeBridgeConfig,
  RuntimeSidecarAction,
  RuntimeSidecarStatus,
} from "@/lib/desktop-runtime";

type RuntimeSidecarResponse = {
  ok?: boolean;
  status?: RuntimeSidecarStatus;
  error?: string | null;
};

export function useRuntimeSidecar(
  config: RuntimeBridgeConfig,
  enabled = true,
) {
  const [status, setStatus] = useState<RuntimeSidecarStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [actionLoading, setActionLoading] = useState<RuntimeSidecarAction | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(buildAgentCoreApiUrl("/api/runtime/sidecar"), {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as RuntimeSidecarResponse | null;
        if (cancelled) return;
        if (!response.ok || !data?.ok || !data.status) {
          setStatus(null);
          setError(data?.error || "Unable to load runtime sidecar status.");
          return;
        }
        setStatus(data.status);
      } catch (err) {
        if (cancelled) return;
        setStatus(null);
        setError(err instanceof Error ? err.message : "Unable to load runtime sidecar status.");
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

  const runAction = async (action: RuntimeSidecarAction) => {
    setActionLoading(action);
    setError("");
    try {
      const response = await fetch(buildAgentCoreApiUrl("/api/runtime/sidecar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, config }),
      });
      const data = (await response.json().catch(() => null)) as RuntimeSidecarResponse | null;
      if (!response.ok || !data?.status) {
        setStatus(data?.status ?? null);
        setError(data?.error || `Runtime ${action} failed.`);
        return { ok: false, message: data?.error || `Runtime ${action} failed.` };
      }
      setStatus(data.status);
      return {
        ok: true,
        message:
          data.status.lastAction.message ||
          (action === "sync"
            ? "Runtime bridge synced."
            : action === "boot"
              ? "Runtime sidecar started."
              : "Runtime sidecar stopped."),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : `Runtime ${action} failed.`;
      setError(message);
      return { ok: false, message };
    } finally {
      setActionLoading(null);
    }
  };

  return {
    status,
    loading,
    actionLoading,
    error,
    refresh() {
      setRevision((current) => current + 1);
    },
    sync() {
      return runAction("sync");
    },
    boot() {
      return runAction("boot");
    },
    stop() {
      return runAction("stop");
    },
  };
}
