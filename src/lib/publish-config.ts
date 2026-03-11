import { defaultSettings, loadSettings, normalizeMatrixAccountsSettings, type MatrixAccountsSettings } from "@/lib/settings";

type Listener = () => void;

const listeners = new Set<Listener>();

let configCache: MatrixAccountsSettings = defaultSettings.matrixAccounts;
let bootstrapped = false;

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:publish-config"));
  }
}

function bootstrapClientFallback() {
  if (typeof window === "undefined") return;
  configCache = normalizeMatrixAccountsSettings(loadSettings().matrixAccounts);
  bootstrapped = true;
}

function hasConfigValue(config: MatrixAccountsSettings) {
  return Object.values(config).some((item) => item.token.trim() || item.webhookUrl.trim());
}

export function subscribePublishConfig(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPublishConfig() {
  if (typeof window !== "undefined" && !bootstrapped) {
    bootstrapClientFallback();
  }
  return configCache;
}

export async function refreshPublishConfig() {
  if (typeof window === "undefined") return configCache;
  try {
    const res = await fetch("/api/publish/config", { method: "GET", cache: "no-store" });
    const data = (await res.json().catch(() => null)) as
      | null
      | { ok?: boolean; data?: { matrixAccounts?: Partial<MatrixAccountsSettings> } };
    if (!res.ok || !data?.ok) return configCache;
    const next = normalizeMatrixAccountsSettings(data.data?.matrixAccounts);
    if (!hasConfigValue(next) && hasConfigValue(configCache)) {
      return configCache;
    }
    configCache = next;
    bootstrapped = true;
    emit();
    return configCache;
  } catch {
    return configCache;
  }
}

export async function savePublishConfig(next: MatrixAccountsSettings) {
  if (typeof window === "undefined") return configCache;
  const res = await fetch("/api/publish/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matrixAccounts: next }),
  });
  const data = (await res.json().catch(() => null)) as
    | null
    | { ok?: boolean; data?: { matrixAccounts?: Partial<MatrixAccountsSettings> }; error?: string };
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "保存失败");
  }
  configCache = normalizeMatrixAccountsSettings(data.data?.matrixAccounts);
  bootstrapped = true;
  emit();
  return configCache;
}
