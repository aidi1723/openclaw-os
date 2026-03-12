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

async function main() {
  const buildDoctor = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "build-doctor.mjs");
  const prepareSidecar = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "prepare-lobster-sidecar.mjs");
  const runTauri = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "run-tauri.mjs");

  await runNodeScript(buildDoctor);
  await runNodeScript(prepareSidecar);
  await runNodeScript(runTauri, ["build", ...process.argv.slice(2)]);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to package desktop build.");
});
