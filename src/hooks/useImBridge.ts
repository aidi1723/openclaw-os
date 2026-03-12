"use client";

import { useCallback, useEffect, useState } from "react";
import { buildAgentCoreApiUrl, isAgentCoreDesktopShell } from "@/lib/app-api";
import {
  defaultImBridgeConfig,
  type ImBridgeConfig,
  type ImBridgeEvent,
  type ImBridgeHealth,
  type ImBridgeProviderId,
} from "@/lib/im-bridge";

type ImBridgeConfigResponse = {
  ok?: boolean;
  data?: ImBridgeConfig;
  error?: string;
};

type ImBridgeHealthResponse = {
  ok?: boolean;
  data?: ImBridgeHealth;
  error?: string;
};

type ImBridgeTestResponse = {
  ok?: boolean;
  data?: { delivered?: boolean; provider?: ImBridgeProviderId; text?: string };
  error?: string;
};

type ImBridgeEventsResponse = {
  ok?: boolean;
  data?: { events?: ImBridgeEvent[] };
  error?: string;
};

type ImBridgeRetryResponse = {
  ok?: boolean;
  data?: { event?: ImBridgeEvent };
  error?: string;
};

export function useImBridge(enabled = true) {
  const [config, setConfig] = useState<ImBridgeConfig>(defaultImBridgeConfig);
  const [health, setHealth] = useState<ImBridgeHealth | null>(null);
  const [events, setEvents] = useState<ImBridgeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [retryingEventId, setRetryingEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !isAgentCoreDesktopShell()) {
      setConfig(defaultImBridgeConfig);
      setHealth(null);
      setEvents([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [configResponse, healthResponse, eventsResponse] = await Promise.all([
        fetch(buildAgentCoreApiUrl("/api/im-bridge/config"), { method: "GET" }),
        fetch(buildAgentCoreApiUrl("/api/im-bridge/health"), { method: "GET" }),
        fetch(buildAgentCoreApiUrl("/api/im-bridge/events?limit=20"), { method: "GET" }),
      ]);

      const configData = (await configResponse.json().catch(() => null)) as ImBridgeConfigResponse | null;
      const healthData = (await healthResponse.json().catch(() => null)) as ImBridgeHealthResponse | null;
      const eventsData = (await eventsResponse.json().catch(() => null)) as ImBridgeEventsResponse | null;

      if (!configResponse.ok || !configData?.ok || !configData.data) {
        throw new Error(configData?.error || "Unable to load IM bridge config.");
      }
      if (!healthResponse.ok || !healthData?.ok || !healthData.data) {
        throw new Error(healthData?.error || "Unable to load IM bridge health.");
      }
      if (!eventsResponse.ok || !eventsData?.ok) {
        throw new Error(eventsData?.error || "Unable to load IM bridge events.");
      }

      setConfig(configData.data);
      setHealth(healthData.data);
      setEvents(Array.isArray(eventsData.data?.events) ? eventsData.data.events : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load IM bridge config.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (nextConfig: ImBridgeConfig) => {
    if (!enabled || !isAgentCoreDesktopShell()) {
      return { ok: false, message: "IM Bridge 仅桌面模式可用。" };
    }

    setSaving(true);
    try {
      const response = await fetch(buildAgentCoreApiUrl("/api/im-bridge/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });
      const data = (await response.json().catch(() => null)) as ImBridgeConfigResponse | null;
      if (!response.ok || !data?.ok || !data.data) {
        return { ok: false, message: data?.error || "保存 IM Bridge 配置失败。" };
      }

      setConfig(data.data);
      await refresh();
      return { ok: true, message: "IM Bridge 配置已保存。" };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "保存 IM Bridge 配置失败。",
      };
    } finally {
      setSaving(false);
    }
  }, [enabled, refresh]);

  const test = useCallback(async (provider?: ImBridgeProviderId) => {
    if (!enabled || !isAgentCoreDesktopShell()) {
      return { ok: false, message: "IM Bridge 仅桌面模式可用。" };
    }

    setTesting(true);
    try {
      const response = await fetch(buildAgentCoreApiUrl("/api/im-bridge/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider ? { provider } : {}),
      });
      const data = (await response.json().catch(() => null)) as ImBridgeTestResponse | null;
      if (!response.ok || !data?.ok) {
        return { ok: false, message: data?.error || "IM Bridge 测试失败。" };
      }

      await refresh();
      return {
        ok: true,
        message: data.data?.delivered
          ? `测试消息已发送到 ${data.data?.provider ?? provider ?? "通道"}。`
          : "测试已执行，但未实际投递（未配置 reply webhook）。",
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "IM Bridge 测试失败。",
      };
    } finally {
      setTesting(false);
    }
  }, [enabled, refresh]);

  const clearEvents = useCallback(async () => {
    if (!enabled || !isAgentCoreDesktopShell()) {
      return { ok: false, message: "IM Bridge 仅桌面模式可用。" };
    }

    setClearing(true);
    try {
      const response = await fetch(buildAgentCoreApiUrl("/api/im-bridge/events"), {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        return { ok: false, message: data?.error || "清空记录失败。" };
      }
      await refresh();
      return { ok: true, message: "已清空最近移动端任务记录。" };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "清空记录失败。",
      };
    } finally {
      setClearing(false);
    }
  }, [enabled, refresh]);

  const retryEvent = useCallback(async (eventId: string) => {
    if (!enabled || !isAgentCoreDesktopShell()) {
      return { ok: false, message: "IM Bridge 仅桌面模式可用。" };
    }

    setRetryingEventId(eventId);
    try {
      const response = await fetch(buildAgentCoreApiUrl(`/api/im-bridge/events/${eventId}/retry`), {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as ImBridgeRetryResponse | null;
      if (!response.ok || !data?.ok) {
        return { ok: false, message: data?.error || "重试执行失败。" };
      }
      await refresh();
      return { ok: true, message: "已重新执行这条移动端任务。" };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "重试执行失败。",
      };
    } finally {
      setRetryingEventId(null);
    }
  }, [enabled, refresh]);

  return {
    config,
    setConfig,
    health,
    events,
    loading,
    saving,
    testing,
    clearing,
    retryingEventId,
    error,
    refresh,
    save,
    test,
    clearEvents,
    retryEvent,
  };
}
