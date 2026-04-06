import type { AppId } from "@/apps/types";

export const RuntimeEventNames = {
  settings: "runtime:settings",
  settingsFocus: "runtime:settings-focus",
  openApp: "runtime:open-app",
  windowCommand: "runtime:window-command",
} as const;

const legacyEventAliases: Partial<Record<(typeof RuntimeEventNames)[keyof typeof RuntimeEventNames], string>> = {
  [RuntimeEventNames.settings]: "openclaw:settings",
  [RuntimeEventNames.settingsFocus]: "openclaw:settings-focus",
  [RuntimeEventNames.openApp]: "openclaw:open-app",
  [RuntimeEventNames.windowCommand]: "openclaw:window-command",
};

export function normalizeRuntimeAppId(appId: AppId): AppId {
  if (appId === "openclaw_console") return "runtime_console";
  return appId;
}

export function dispatchRuntimeEvent(type: (typeof RuntimeEventNames)[keyof typeof RuntimeEventNames], detail?: unknown) {
  if (typeof window === "undefined") return;

  const event =
    detail === undefined
      ? new Event(type)
      : new CustomEvent(type, { detail });
  window.dispatchEvent(event);

  const legacyType = legacyEventAliases[type];
  if (!legacyType) return;
  const legacyEvent =
    detail === undefined
      ? new Event(legacyType)
      : new CustomEvent(legacyType, { detail });
  Object.defineProperty(legacyEvent, "__agentcoreCompatLegacy", {
    value: true,
    configurable: true,
  });
  window.dispatchEvent(legacyEvent);
}

export function addRuntimeEventListener(
  type: (typeof RuntimeEventNames)[keyof typeof RuntimeEventNames],
  handler: EventListener,
) {
  if (typeof window === "undefined") return () => undefined;
  const legacyType = legacyEventAliases[type];
  const wrappedHandler: EventListener = (event) => {
    if ((event as { __agentcoreCompatLegacy?: boolean }).__agentcoreCompatLegacy === true) {
      return;
    }
    handler(event);
  };
  window.addEventListener(type, wrappedHandler);
  if (legacyType) {
    window.addEventListener(legacyType, wrappedHandler);
  }
  return () => {
    window.removeEventListener(type, wrappedHandler);
    if (legacyType) {
      window.removeEventListener(legacyType, wrappedHandler);
    }
  };
}
