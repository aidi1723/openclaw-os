"use client";

import { useEffect, useRef } from "react";

import { refreshPublishJobs } from "@/lib/publish";

export function PublishQueueRunner() {
  const processingRef = useRef(false);
  const browserTriggerEnabledRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const syncCapability = async () => {
      try {
        const res = await fetch("/api/publish/queue/run", { method: "GET", cache: "no-store" });
        const data = (await res.json().catch(() => null)) as null | { data?: { authRequired?: boolean } };
        browserTriggerEnabledRef.current = !Boolean(data?.data?.authRequired);
      } catch {
        browserTriggerEnabledRef.current = true;
      }
    };

    const runOnce = async () => {
      if (cancelled || processingRef.current) return;
      processingRef.current = true;
      try {
        if (browserTriggerEnabledRef.current) {
          await fetch("/api/publish/queue/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }).catch(() => null);
        }
        await refreshPublishJobs();
      } finally {
        processingRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void runOnce();
    }, 1500);
    const onWake = () => {
      void runOnce();
    };

    window.addEventListener("openclaw:publish", onWake);
    window.addEventListener("focus", onWake);
    void syncCapability().then(runOnce);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("openclaw:publish", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  return null;
}
