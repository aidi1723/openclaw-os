import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(THIS_DIR, "..", "..");
const TAURI_CONFIG_PATH = path.join(PROJECT_ROOT, "src-tauri", "tauri.conf.json");

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function getBuildProfile() {
  return process.argv.includes("--debug") ? "debug" : "release";
}

function hostArchSuffix() {
  switch (process.arch) {
    case "arm64":
      return "aarch64";
    case "x64":
      return "x64";
    default:
      return process.arch;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function loadTauriConfig() {
  const raw = await readFile(TAURI_CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

async function main() {
  if (process.platform !== "darwin") {
    console.log("Skipping macOS DMG packaging on non-darwin host.");
    return;
  }

  const config = await loadTauriConfig();
  const productName = config.productName || "AgentCore OS";
  const version = config.version || "0.1.0";
  const arch = hostArchSuffix();
  const profile = getBuildProfile();
  const bundleRoot = path.join(PROJECT_ROOT, "src-tauri", "target", profile, "bundle");

  const appName = `${productName}.app`;
  const appPath = path.join(bundleRoot, "macos", appName);
  const dmgDir = path.join(bundleRoot, "dmg");
  const dmgName = `${productName}_${version}_${arch}.dmg`;
  const dmgPath = path.join(dmgDir, dmgName);

  await mkdir(dmgDir, { recursive: true });
  await run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  const stagingRoot = await mkdtemp(path.join(dmgDir, ".stage-"));
  try {
    await rm(dmgPath, { force: true });

    await cp(appPath, path.join(stagingRoot, appName), { recursive: true });
    await symlink("/Applications", path.join(stagingRoot, "Applications"));

    try {
      await run("hdiutil", [
        "create",
        "-volname",
        productName,
        "-srcfolder",
        stagingRoot,
        "-ov",
        "-format",
        "UDZO",
        dmgPath,
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown hdiutil failure.";
      throw new Error(
        [
          `Unable to create DMG at ${dmgPath}.`,
          `The app bundle is already available at ${appPath}.`,
          "If you are running inside a sandboxed shell, rerun the DMG step with host permissions because macOS may block hdiutil disk-image creation there.",
          `Original error: ${detail}`,
        ].join(" "),
      );
    }

    console.log(`Created DMG: ${dmgPath}`);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to package macOS DMG.");
});
