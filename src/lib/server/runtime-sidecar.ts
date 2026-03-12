import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  getDefaultRuntimeBridgeConfig,
  type RuntimeBridgeConfig,
  type RuntimeSidecarAction,
  type RuntimeSidecarServiceStatus,
  type RuntimeSidecarStatus,
} from "@/lib/desktop-runtime";
import { getRuntimeDoctorReport } from "@/lib/runtime-doctor";
import { readJsonFile, writeJsonFile } from "@/lib/server/json-store";

type RuntimeSidecarState = {
  config: RuntimeBridgeConfig;
  lastAction: RuntimeSidecarStatus["lastAction"];
};

const STATE_FILE = "agentcore-runtime-sidecar.json";
const DATA_DIR = path.join(process.cwd(), ".openclaw-data", "desktop-runtime");
const COMPOSE_FILE = path.join(
  process.cwd(),
  "deploy",
  "desktop-runtime",
  "docker-compose.agentcore-runtime.example.yml",
);

function getEnvFilePath(projectName: string) {
  const normalized = projectName.trim() || "agentcore-runtime";
  return path.join(DATA_DIR, `${normalized}.env`);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

function sanitizeConfig(config?: Partial<RuntimeBridgeConfig> | null): RuntimeBridgeConfig {
  const fallback = getDefaultRuntimeBridgeConfig();

  return {
    profile:
      config?.profile === "desktop_dify" ? "desktop_dify" : fallback.profile,
    orchestration:
      config?.orchestration === "docker_compose" ? "docker_compose" : "none",
    composeProjectName:
      typeof config?.composeProjectName === "string" && config.composeProjectName.trim()
        ? config.composeProjectName.trim()
        : fallback.composeProjectName,
    localAppUrl:
      typeof config?.localAppUrl === "string" && config.localAppUrl.trim()
        ? config.localAppUrl.trim()
        : fallback.localAppUrl,
    localRuntimeUrl:
      typeof config?.localRuntimeUrl === "string" && config.localRuntimeUrl.trim()
        ? config.localRuntimeUrl.trim()
        : fallback.localRuntimeUrl,
    sidecarApiUrl:
      typeof config?.sidecarApiUrl === "string" && config.sidecarApiUrl.trim()
        ? config.sidecarApiUrl.trim()
        : fallback.sidecarApiUrl,
    difyBaseUrl:
      typeof config?.difyBaseUrl === "string" && config.difyBaseUrl.trim()
        ? config.difyBaseUrl.trim()
        : fallback.difyBaseUrl,
    autoBootLocalStack: Boolean(config?.autoBootLocalStack),
  };
}

function parsePortFromUrl(value: string, fallbackPort: number) {
  try {
    const url = new URL(value);
    return url.port || String(fallbackPort);
  } catch {
    return String(fallbackPort);
  }
}

function buildEnvFileContent(config: RuntimeBridgeConfig) {
  const projectName = config.composeProjectName.trim() || "agentcore-runtime";

  return [
    `COMPOSE_PROJECT_NAME=${projectName}`,
    `AGENTCORE_RUNTIME_APP_URL=${config.localAppUrl}`,
    `AGENTCORE_RUNTIME_URL=${config.localRuntimeUrl}`,
    `AGENTCORE_SIDECAR_API_URL=${config.sidecarApiUrl}`,
    `AGENTCORE_DIFY_BASE_URL=${config.difyBaseUrl}`,
    "AGENTCORE_POSTGRES_IMAGE=postgres:15-alpine",
    "AGENTCORE_REDIS_IMAGE=redis:7-alpine",
    "AGENTCORE_QDRANT_IMAGE=qdrant/qdrant:v1.13.2",
    "AGENTCORE_DIFY_API_IMAGE=langgenius/dify-api:0.13.1",
    "AGENTCORE_DIFY_WORKER_IMAGE=langgenius/dify-api:0.13.1",
    "POSTGRES_DB=dify",
    "POSTGRES_USER=postgres",
    "POSTGRES_PASSWORD=agentcore",
    "POSTGRES_PORT=5433",
    "REDIS_PORT=6380",
    "QDRANT_PORT=6333",
    `DIFY_API_PORT=${parsePortFromUrl(config.difyBaseUrl, 5001)}`,
    "DIFY_WORKER_PORT=5002",
  ].join("\n");
}

async function ensureRuntimeFiles(config: RuntimeBridgeConfig) {
  const envFilePath = getEnvFilePath(config.composeProjectName);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(envFilePath, buildEnvFileContent(config), "utf8");
  return { composeFilePath: COMPOSE_FILE, envFilePath };
}

async function readState(): Promise<RuntimeSidecarState | null> {
  const state = await readJsonFile<RuntimeSidecarState | null>(STATE_FILE, null);
  if (!state?.config) return null;
  return {
    config: sanitizeConfig(state.config),
    lastAction: state.lastAction ?? {
      type: null,
      at: null,
      ok: null,
      message: null,
    },
  };
}

async function writeState(state: RuntimeSidecarState) {
  await writeJsonFile(STATE_FILE, state);
}

function normalizeServiceStatus(stdout: string): RuntimeSidecarServiceStatus[] {
  if (!stdout.trim()) return [];

  const parseOne = (value: string) => {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  let items: Array<Record<string, unknown>> = [];
  const parsed = parseOne(stdout);
  if (Array.isArray(parsed)) {
    items = parsed.filter(Boolean) as Array<Record<string, unknown>>;
  } else if (parsed && typeof parsed === "object") {
    items = [parsed];
  } else {
    items = stdout
      .split("\n")
      .map((line) => parseOne(line))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  return items.map((item) => {
    const publishers = Array.isArray(item.Publishers)
      ? item.Publishers
          .map((publisher) => {
            if (!publisher || typeof publisher !== "object") return "";
            const target = String((publisher as Record<string, unknown>).TargetPort ?? "");
            const published = String((publisher as Record<string, unknown>).PublishedPort ?? "");
            return target && published ? `${published}->${target}` : published || target;
          })
          .filter(Boolean)
      : [];

    return {
      service: String(item.Service ?? item.Name ?? "unknown"),
      state: String(item.State ?? "unknown"),
      health:
        typeof item.Health === "string" && item.Health.trim() ? item.Health.trim() : null,
      statusText:
        typeof item.Status === "string" && item.Status.trim()
          ? item.Status.trim()
          : String(item.State ?? "unknown"),
      publishedPorts: publishers,
    };
  });
}

async function buildStatus(
  config: RuntimeBridgeConfig,
  lastAction: RuntimeSidecarStatus["lastAction"],
  synced: boolean,
): Promise<RuntimeSidecarStatus> {
  const doctor = getRuntimeDoctorReport();
  const canManage =
    config.profile === "desktop_dify" && config.orchestration === "docker_compose";
  const bootable =
    canManage && doctor.checks.docker.ok && doctor.checks.dockerCompose.ok;
  const { composeFilePath, envFilePath } = await ensureRuntimeFiles(config);

  let services: RuntimeSidecarServiceStatus[] = [];
  if (bootable) {
    const ps = run("docker", [
      "compose",
      "--project-name",
      config.composeProjectName,
      "--file",
      composeFilePath,
      "--env-file",
      envFilePath,
      "ps",
      "--format",
      "json",
    ]);
    if (ps.ok) {
      services = normalizeServiceStatus(ps.stdout);
    }
  }

  const running = services.some((service) => service.state === "running");
  const ready =
    services.length > 0 &&
    services.every(
      (service) =>
        service.state === "running" &&
        (!service.health || service.health === "healthy"),
    );

  return {
    synced,
    canManage,
    bootable,
    running,
    ready,
    config,
    composeFilePath,
    envFilePath,
    services,
    doctor,
    nextAction: bootable
      ? running
        ? "Sidecar stack is available. You can keep working or stop it from the runtime panel."
        : "Local sidecar is ready to boot. Use the runtime panel to start the compose stack."
      : doctor.nextAction,
    lastAction,
  };
}

export async function getRuntimeSidecarStatus(
  incomingConfig?: Partial<RuntimeBridgeConfig> | null,
) {
  const state = await readState();
  const config = sanitizeConfig(incomingConfig ?? state?.config ?? null);
  const synced = Boolean(state?.config);
  return buildStatus(
    config,
    state?.lastAction ?? { type: null, at: null, ok: null, message: null },
    synced,
  );
}

export async function syncRuntimeSidecarConfig(incomingConfig: Partial<RuntimeBridgeConfig>) {
  const config = sanitizeConfig(incomingConfig);
  const nextState: RuntimeSidecarState = {
    config,
    lastAction: {
      type: "sync",
      at: new Date().toISOString(),
      ok: true,
      message: "Runtime config synced to the local backend bridge.",
    },
  };
  await ensureRuntimeFiles(config);
  await writeState(nextState);
  return buildStatus(config, nextState.lastAction, true);
}

async function runComposeAction(
  action: RuntimeSidecarAction,
  incomingConfig: Partial<RuntimeBridgeConfig>,
) {
  const config = sanitizeConfig(incomingConfig);
  const { composeFilePath, envFilePath } = await ensureRuntimeFiles(config);
  const doctor = getRuntimeDoctorReport();
  const manageable =
    config.profile === "desktop_dify" && config.orchestration === "docker_compose";

  let ok = false;
  let message = "";

  if (!manageable) {
    message = "Switch to Desktop + Dify Runtime before managing the local sidecar stack.";
  } else if (!doctor.checks.docker.ok || !doctor.checks.dockerCompose.ok) {
    message = doctor.nextAction;
  } else {
    const command =
      action === "boot"
        ? ["up", "-d"]
        : action === "stop"
          ? ["stop"]
          : [];
    const result = run("docker", [
      "compose",
      "--project-name",
      config.composeProjectName,
      "--file",
      composeFilePath,
      "--env-file",
      envFilePath,
      ...command,
    ]);
    ok = result.ok;
    message =
      (result.ok ? result.stdout : result.stderr || result.error || result.stdout).trim() ||
      (action === "boot" ? "Local sidecar boot started." : "Local sidecar stopped.");
  }

  const nextState: RuntimeSidecarState = {
    config,
    lastAction: {
      type: action,
      at: new Date().toISOString(),
      ok,
      message,
    },
  };
  await writeState(nextState);
  return buildStatus(config, nextState.lastAction, true);
}

export async function bootRuntimeSidecar(config: Partial<RuntimeBridgeConfig>) {
  return runComposeAction("boot", config);
}

export async function stopRuntimeSidecar(config: Partial<RuntimeBridgeConfig>) {
  return runComposeAction("stop", config);
}
