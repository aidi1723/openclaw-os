import { copyFile, mkdir, rm } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function isExecutable(candidate) {
  if (!candidate) {
    return false;
  }
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveRustc() {
  const home = os.homedir();
  const candidates = [
    process.env.RUSTC,
    path.join(home, ".cargo", "bin", "rustc.exe"),
    path.join(home, ".cargo", "bin", "rustc"),
    "/opt/homebrew/bin/rustc",
    "/opt/homebrew/opt/rust/bin/rustc",
    process.platform === "win32" ? "rustc.exe" : "rustc",
    "rustc",
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!(await isExecutable(candidate)) && !candidate.includes("rustc")) {
      continue;
    }
    const probe = spawnSync(candidate, ["-Vv"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (probe.status === 0) {
      return candidate;
    }
  }

  fail("Unable to detect Rust target triple. Install Rust and ensure `rustc` is available.");
}

function getHostTriple(rustcBinary) {
  const direct = spawnSync(rustcBinary, ["--print", "host-tuple"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (direct.status === 0 && direct.stdout.trim()) {
    return direct.stdout.trim();
  }

  const fallback = spawnSync(rustcBinary, ["-Vv"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (fallback.status !== 0) {
    fail(`Unable to detect Rust target triple using \`${rustcBinary}\`.`);
  }

  const hostLine = fallback.stdout
    .split("\n")
    .find((line) => line.trim().startsWith("host:"));
  const triple = hostLine?.split(":")[1]?.trim();
  if (!triple) {
    fail("Unable to parse Rust target triple from `rustc -Vv`.");
  }
  return triple;
}

async function main() {
  const source = process.argv[2];
  if (!source) {
    fail("Usage: npm run desktop:stage-sidecar -- /absolute/path/to/lobster_engine[.exe]");
  }

  const rustcBinary = await resolveRustc();
  const hostTriple = getHostTriple(rustcBinary);
  const extension = source.endsWith(".exe") ? ".exe" : "";
  const destDir = path.join(process.cwd(), "src-tauri", "binaries");
  const destPath = path.join(destDir, `lobster_engine-${hostTriple}${extension}`);

  try {
    await access(source, constants.F_OK);
  } catch {
    fail(`Sidecar binary does not exist: ${source}`);
  }

  await mkdir(destDir, { recursive: true });
  await rm(destPath, { force: true });
  await copyFile(source, destPath);

  console.log(`Staged Lobster sidecar: ${destPath}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to stage Lobster sidecar.");
});
