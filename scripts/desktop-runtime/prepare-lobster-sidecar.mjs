import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const PROJECT_ROOT = process.cwd();

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(scriptPath)} terminated by signal: ${signal}`));
        return;
      }
      if ((code ?? 0) !== 0) {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function ensureExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    fail(`Expected sidecar artifact was not produced: ${filePath}`);
  }
}

async function main() {
  const buildScript = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "build-lobster-sidecar.mjs");
  const stageScript = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "stage-lobster-sidecar.mjs");
  const sidecarDistPath = path.join(
    PROJECT_ROOT,
    "lobster-sidecar",
    "dist",
    `lobster_engine${process.platform === "win32" ? ".exe" : ""}`,
  );

  await runNodeScript(buildScript);
  await ensureExists(sidecarDistPath);
  await runNodeScript(stageScript, [sidecarDistPath]);

  console.log(`Prepared Lobster sidecar for desktop packaging: ${sidecarDistPath}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to prepare Lobster sidecar.");
});
