import { loadSettings } from "@/lib/settings";

declare global {
  interface Window {
    __AGENTCORE_API_BASE_URL__?: string;
    __AGENTCORE_DESKTOP_SHELL__?: boolean;
  }
}

function trimBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getAgentCoreApiBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_AGENTCORE_API_BASE_URL?.trim() || "";
  }

  const injected = trimBase(window.__AGENTCORE_API_BASE_URL__ || "");
  if (injected) return injected;

  try {
    const settings = loadSettings();
    const configured = trimBase(settings.runtime.sidecarApiUrl || "");
    if (configured) return configured;
  } catch {
    // ignore
  }

  const envBase = trimBase(process.env.NEXT_PUBLIC_AGENTCORE_API_BASE_URL || "");
  if (envBase) return envBase;

  return "";
}

export function buildAgentCoreApiUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const base = getAgentCoreApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function isAgentCoreDesktopShell() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__AGENTCORE_DESKTOP_SHELL__);
}
