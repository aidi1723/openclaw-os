"use client";

import { useEffect } from "react";

import { buildAgentCoreApiUrl, isAgentCoreDesktopShell } from "@/lib/app-api";

const HEARTBEAT_INTERVAL_MS = 3000;

export function useSidecarHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const sendHeartbeat = () => {
      if (cancelled) return;
      if (!isAgentCoreDesktopShell()) return;
      void fetch(buildAgentCoreApiUrl("/_agentcore/heartbeat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ts: Date.now(),
          source: "agentcore-desktop-shell",
        }),
        keepalive: true,
      }).catch(() => null);
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };

    const onUnload = () => {
      try {
        navigator.sendBeacon(
          buildAgentCoreApiUrl("/_agentcore/heartbeat"),
          JSON.stringify({
            ts: Date.now(),
            source: "agentcore-desktop-shell",
            final: true,
          }),
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);
}
