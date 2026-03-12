import type {
  AppSettings,
  DesktopRuntimeOrchestration,
  DesktopRuntimeProfile,
} from "@/lib/settings";
import type { RuntimeDoctorReport } from "@/lib/runtime-doctor";
import { defaultSettings as runtimeDefaults } from "@/lib/settings";

export type RuntimeBridgeConfig = {
  profile: DesktopRuntimeProfile;
  orchestration: DesktopRuntimeOrchestration;
  composeProjectName: string;
  localAppUrl: string;
  localRuntimeUrl: string;
  sidecarApiUrl: string;
  difyBaseUrl: string;
  autoBootLocalStack: boolean;
};

export type RuntimeSidecarAction = "sync" | "boot" | "stop";

export type RuntimeSidecarServiceStatus = {
  service: string;
  state: string;
  health: string | null;
  statusText: string;
  publishedPorts: string[];
};

export type RuntimeSidecarStatus = {
  synced: boolean;
  canManage: boolean;
  bootable: boolean;
  running: boolean;
  ready: boolean;
  config: RuntimeBridgeConfig;
  composeFilePath: string;
  envFilePath: string;
  services: RuntimeSidecarServiceStatus[];
  doctor: RuntimeDoctorReport;
  nextAction: string;
  lastAction: {
    type: RuntimeSidecarAction | null;
    at: string | null;
    ok: boolean | null;
    message: string | null;
  };
};

export type RuntimeSetupChecklistItem = {
  id: "profile" | "provider" | "runtime";
  title: string;
  detail: string;
  status: "ready" | "attention" | "checking";
};

export function getDesktopRuntimeProfileMeta(profile: DesktopRuntimeProfile) {
  switch (profile) {
    case "desktop_dify":
      return {
        title: "Desktop + Dify Runtime",
        desc:
          "Use AgentCore OS as the shell and workflow desk, with an optional local Dify core stack for team-style orchestration and retrieval.",
      };
    case "desktop_light":
    default:
      return {
        title: "Desktop Light Runtime",
        desc:
          "Recommended for non-technical users. Cloud APIs handle model inference; local runtime only manages workflow, state, and assets.",
      };
  }
}

export function getDesktopRuntimeOrchestrationMeta(
  orchestration: DesktopRuntimeOrchestration,
) {
  switch (orchestration) {
    case "docker_compose":
      return {
        title: "Docker Compose",
        desc:
          "Use a local compose project to boot Redis/Postgres/vector store and a slim Dify-compatible sidecar.",
      };
    case "none":
    default:
      return {
        title: "No Local Orchestration",
        desc:
          "Keep the desktop app light. Prefer direct API providers and local storage without any background container stack.",
      };
  }
}

export function getRuntimeBridgeConfig(
  settings: Pick<AppSettings, "runtime">,
): RuntimeBridgeConfig {
  return {
    profile: settings.runtime.profile,
    orchestration: settings.runtime.orchestration,
    composeProjectName: settings.runtime.composeProjectName,
    localAppUrl: settings.runtime.localAppUrl,
    localRuntimeUrl: settings.runtime.localRuntimeUrl,
    sidecarApiUrl: settings.runtime.sidecarApiUrl,
    difyBaseUrl: settings.runtime.difyBaseUrl,
    autoBootLocalStack: settings.runtime.autoBootLocalStack,
  };
}

export function getDefaultRuntimeBridgeConfig(): RuntimeBridgeConfig {
  return getRuntimeBridgeConfig({ runtime: runtimeDefaults.runtime });
}

export function getDesktopRuntimeStatusSummary(
  settings: AppSettings,
  doctor?: RuntimeDoctorReport | null,
) {
  const provider = settings.llm.activeProvider;
  const providerConfigured = Boolean(
    settings.llm.providers[provider]?.apiKey?.trim(),
  );
  const requiresDocker = settings.runtime.profile === "desktop_dify";
  const dockerReady = doctor
    ? doctor.checks.docker.ok && doctor.checks.dockerCompose.ok
    : null;
  const runtimeAddressConfigured = requiresDocker
    ? Boolean(settings.runtime.difyBaseUrl.trim())
    : true;
  const runtimeConfigured = requiresDocker
    ? runtimeAddressConfigured && (dockerReady ?? false)
    : true;

  const checklist: RuntimeSetupChecklistItem[] = [
    {
      id: "profile",
      title: "Choose runtime profile",
      detail:
        settings.runtime.profile === "desktop_light"
          ? "Desktop light runtime is selected for API-only workflow execution."
          : "Desktop + Dify sidecar is selected for local orchestration and retrieval.",
      status: "ready",
    },
    {
      id: "provider",
      title: "Connect cloud model provider",
      detail: providerConfigured
        ? `Active provider ${provider} is ready for BYOK API calls.`
        : `Add an API key for ${provider} before running workflow automation.`,
      status: providerConfigured ? "ready" : "attention",
    },
    {
      id: "runtime",
      title: requiresDocker
        ? "Validate local sidecar runtime"
        : "Light runtime is ready",
      detail: requiresDocker
        ? !runtimeAddressConfigured
          ? "Set the Dify Base URL before enabling the local sidecar stack."
          : doctor
            ? dockerReady
              ? "Docker and Compose are available for the desktop sidecar stack."
              : "Docker or Compose is unavailable. Switch to desktop light or install Docker Desktop."
            : "Run diagnostics to verify Docker and Compose before using the Dify sidecar."
        : "No local model stack is required. Workflow state and assets stay light and local.",
      status: requiresDocker
        ? !runtimeAddressConfigured
          ? "attention"
          : doctor
            ? dockerReady
              ? "ready"
              : "attention"
            : "checking"
        : "ready",
    },
  ];

  const completedSteps = checklist.filter((item) => item.status === "ready").length;
  const totalSteps = checklist.length;
  const initializationComplete = checklist.every((item) => item.status === "ready");

  return {
    providerConfigured,
    runtimeConfigured,
    requiresDocker,
    dockerReady,
    shell: settings.runtime.shell,
    profile: settings.runtime.profile,
    profileMeta: getDesktopRuntimeProfileMeta(settings.runtime.profile),
    orchestrationMeta: getDesktopRuntimeOrchestrationMeta(
      settings.runtime.orchestration,
    ),
    checklist,
    completedSteps,
    totalSteps,
    initializationComplete,
    recommendedProfile: doctor?.recommendedProfile ?? null,
  };
}
