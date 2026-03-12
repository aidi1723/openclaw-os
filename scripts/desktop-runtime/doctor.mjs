import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args) {
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

function probeRuntimeTemplate() {
  const templatePath = path.join(
    process.cwd(),
    "deploy",
    "desktop-runtime",
    "docker-compose.agentcore-runtime.example.yml",
  );
  return existsSync(templatePath)
    ? { ok: true, version: templatePath, error: null }
    : { ok: false, version: null, error: `Missing runtime template: ${templatePath}` };
}

function probeLocalStore() {
  const targetDir = path.join(process.cwd(), ".openclaw-data");
  const probeFile = path.join(targetDir, ".doctor-write-test");
  try {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(probeFile, "ok", "utf8");
    rmSync(probeFile, { force: true });
    return { ok: true, version: targetDir, error: null };
  } catch (error) {
    return {
      ok: false,
      version: null,
      error: error instanceof Error ? error.message : "Local store is not writable.",
    };
  }
}

const docker = run("docker", ["--version"]);
const dockerCompose = docker.ok
  ? run("docker", ["compose", "version"])
  : { ok: false, status: 1, stdout: "", stderr: "", error: "" };
const node = run(process.execPath, ["--version"]);
const ffmpeg = run("ffmpeg", ["-version"]);
const runtimeTemplate = probeRuntimeTemplate();
const localStore = probeLocalStore();
const desktopLightReady = localStore.ok;
const desktopDifyReady = localStore.ok && runtimeTemplate.ok && docker.ok && dockerCompose.ok;
const creativeStudioReady = ffmpeg.ok;

const output = {
  runtimeMode: "api_only",
  checkedAt: new Date().toISOString(),
  recommendedProfile: desktopDifyReady ? "desktop_dify" : "desktop_light",
  checks: {
    node: {
      ok: node.ok,
      version: node.stdout || null,
      error: node.stderr || node.error || null,
    },
    ffmpeg: {
      ok: ffmpeg.ok,
      version: ffmpeg.stdout.split("\n")[0]?.trim() || null,
      error: ffmpeg.stderr || ffmpeg.error || null,
    },
    docker: {
      ok: docker.ok,
      version: docker.stdout || null,
      error: docker.stderr || docker.error || null,
    },
    dockerCompose: {
      ok: dockerCompose.ok,
      version: dockerCompose.stdout || null,
      error: dockerCompose.stderr || dockerCompose.error || null,
    },
    runtimeTemplate,
    localStore,
  },
  readiness: {
    desktopLightReady,
    desktopDifyReady,
    creativeStudioReady,
  },
  nextAction: !desktopLightReady
    ? "Fix local storage permissions first. The desktop app needs a writable local data directory before first-run testing."
    : desktopDifyReady
      ? creativeStudioReady
        ? "This machine is ready for full desktop testing, including Desktop + Dify Runtime and Creative Studio local video processing."
        : "This machine can run the full desktop stack. Install ffmpeg only if you need Creative Studio local video processing."
      : creativeStudioReady
        ? "A fresh machine can already install and test in Desktop Light mode after you fill in an API key. Install Docker Desktop only if you need local Dify orchestration."
        : "A fresh machine can install and test most workflows in Desktop Light mode after you fill in an API key. Install ffmpeg for Creative Studio, and Docker Desktop only if you need local Dify orchestration.",
};

console.log(JSON.stringify(output, null, 2));
