import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
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

async function findPyInstaller(repoRoot) {
  const candidates = [
    process.env.PYINSTALLER_BIN,
    path.join(repoRoot, "lobster-sidecar", ".venv", "bin", "pyinstaller"),
    path.join(repoRoot, "lobster-sidecar", ".venv", "Scripts", "pyinstaller.exe"),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if ((await isExecutable(candidate)) || !candidate.includes(path.sep)) {
      const probe = spawnSync(candidate, ["--version"], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (probe.status === 0) {
        return { command: candidate, args: [] };
      }
    }
  }

  const python = await findPythonBinary(repoRoot);
  if (python) {
    const probe = spawnSync(python, ["-m", "PyInstaller", "--version"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (probe.status === 0) {
      return { command: python, args: ["-m", "PyInstaller"] };
    }
  }

  fail("Unable to find PyInstaller. Install lobster-sidecar dependencies first, or set PYINSTALLER_BIN.");
}

async function findPythonBinary(repoRoot) {
  const home = os.homedir();
  const candidates = [
    process.env.PYTHON_BIN,
    path.join(repoRoot, "lobster-sidecar", ".venv", "Scripts", "python.exe"),
    path.join(repoRoot, "lobster-sidecar", ".venv", "bin", "python3"),
    path.join(repoRoot, "lobster-sidecar", ".venv", "bin", "python"),
    process.platform === "win32" ? "python.exe" : "python3",
    "python",
    path.join(home, ".pyenv", "shims", process.platform === "win32" ? "python.exe" : "python3"),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if ((await isExecutable(candidate)) || !candidate.includes(path.sep)) {
      return candidate;
    }
  }

  return null;
}

async function main() {
  const repoRoot = process.cwd();
  const sidecarRoot = path.join(repoRoot, "lobster-sidecar");
  const pyinstaller = await findPyInstaller(repoRoot);
  const cacheDir = path.join(repoRoot, ".cache", "pyinstaller");
  const distDir = path.join(sidecarRoot, "dist");
  const workDir = path.join(sidecarRoot, "build");
  const specPath = path.join(sidecarRoot, "lobster_engine.spec");

  await mkdir(cacheDir, { recursive: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const child = spawn(
    pyinstaller.command,
    [
      ...pyinstaller.args,
      "--distpath",
      distDir,
      "--workpath",
      workDir,
      specPath,
    ],
    {
      cwd: sidecarRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PYINSTALLER_CONFIG_DIR: cacheDir,
        PYTHONUTF8: "1",
      },
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      fail(`PyInstaller terminated by signal: ${signal}`);
    }
    if (code !== 0) {
      fail(`PyInstaller failed with exit code ${code ?? 1}.`, code ?? 1);
    }

    const suffix = process.platform === "win32" ? ".exe" : "";
    console.log(`Built Lobster sidecar: ${path.join(distDir, `lobster_engine${suffix}`)}`);
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to build Lobster sidecar.");
});
