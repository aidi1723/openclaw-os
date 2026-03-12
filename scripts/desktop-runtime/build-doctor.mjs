import { access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

async function findExisting(candidates) {
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

function runIfAvailable(command, args) {
  if (!command) {
    return null;
  }
  return run(command, args);
}

async function main() {
  const projectRoot = process.cwd();
  const home = os.homedir();
  const python = await findExisting([
    process.env.PYTHON_BIN,
    path.join(projectRoot, "lobster-sidecar", ".venv", "Scripts", "python.exe"),
    path.join(projectRoot, "lobster-sidecar", ".venv", "bin", "python3"),
    path.join(projectRoot, "lobster-sidecar", ".venv", "bin", "python"),
    process.platform === "win32" ? "python.exe" : "python3",
    "python",
  ]);
  const pyinstaller = await findExisting([
    process.env.PYINSTALLER_BIN,
    path.join(projectRoot, "lobster-sidecar", ".venv", "Scripts", "pyinstaller.exe"),
    path.join(projectRoot, "lobster-sidecar", ".venv", "bin", "pyinstaller"),
  ]);
  const cargo = await findExisting([
    process.env.CARGO_BIN,
    path.join(home, ".cargo", "bin", "cargo.exe"),
    path.join(home, ".cargo", "bin", "cargo"),
    process.platform === "win32" ? "cargo.exe" : "cargo",
    "cargo",
  ]);
  const rustc = await findExisting([
    process.env.RUSTC,
    path.join(home, ".cargo", "bin", "rustc.exe"),
    path.join(home, ".cargo", "bin", "rustc"),
    process.platform === "win32" ? "rustc.exe" : "rustc",
    "rustc",
  ]);

  const node = run(process.execPath, ["--version"]);
  const pythonVersion = python ? run(python, ["--version"]) : null;
  const cargoVersion = cargo ? run(cargo, ["--version"]) : null;
  const rustcVersion = rustc ? run(rustc, ["--version"]) : null;
  const pyinstallerCliVersion = runIfAvailable(pyinstaller, ["--version"]);
  const pyinstallerModuleVersion = runIfAvailable(python, ["-m", "PyInstaller", "--version"]);
  const pyinstallerVersion = pyinstallerCliVersion?.ok
    ? pyinstallerCliVersion
    : pyinstallerModuleVersion;
  const pyinstallerCommand = pyinstallerCliVersion?.ok
    ? pyinstaller
    : pyinstallerModuleVersion?.ok
      ? python
        ? `${python} -m PyInstaller`
        : null
      : pyinstaller
        ? pyinstaller
        : python
          ? `${python} -m PyInstaller`
          : null;
  const warnings = [];
  const pythonVersionText = pythonVersion?.stdout || pythonVersion?.stderr || "";
  const pythonMinorMatch = pythonVersionText.match(/Python\s+3\.(\d+)/i);
  const pythonMinor = pythonMinorMatch ? Number(pythonMinorMatch[1]) : null;
  if (pythonMinor != null && pythonMinor >= 14) {
    warnings.push(
      "Python 3.14+ can build in some environments, but Python 3.11 or 3.12 is recommended for the Lobster sidecar packaging path.",
    );
  }

  const output = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    ready: Boolean(
      node.ok
      && pythonVersion?.ok
      && cargoVersion?.ok
      && rustcVersion?.ok
      && pyinstallerVersion?.ok,
    ),
    checks: {
      node: {
        ok: node.ok,
        command: process.execPath,
        version: node.stdout || null,
        error: node.stderr || node.error || null,
      },
      python: {
        ok: pythonVersion?.ok ?? false,
        command: python,
        version: pythonVersion?.stdout || pythonVersion?.stderr || null,
        error: pythonVersion && !pythonVersion.ok ? pythonVersion.stderr || pythonVersion.error || null : python ? null : "Python not found",
      },
      pyinstaller: {
        ok: pyinstallerVersion?.ok ?? false,
        command: pyinstallerCommand,
        version: pyinstallerVersion?.stdout || pyinstallerVersion?.stderr || null,
        error: pyinstallerVersion && !pyinstallerVersion.ok
          ? pyinstallerVersion.stderr || pyinstallerVersion.error || null
          : pyinstaller || python
            ? null
            : "PyInstaller not found",
      },
      cargo: {
        ok: cargoVersion?.ok ?? false,
        command: cargo,
        version: cargoVersion?.stdout || null,
        error: cargoVersion && !cargoVersion.ok ? cargoVersion.stderr || cargoVersion.error || null : cargo ? null : "cargo not found",
      },
      rustc: {
        ok: rustcVersion?.ok ?? false,
        command: rustc,
        version: rustcVersion?.stdout || null,
        error: rustcVersion && !rustcVersion.ok ? rustcVersion.stderr || rustcVersion.error || null : rustc ? null : "rustc not found",
      },
    },
    warnings,
    nextAction:
      node.ok && pythonVersion?.ok && cargoVersion?.ok && rustcVersion?.ok && pyinstallerVersion?.ok
        ? warnings.length > 0
          ? "This machine can build the desktop shell, but you should prefer Python 3.11 or 3.12 before producing release sidecar binaries."
          : "This machine can build the AgentCore OS desktop shell and packaged Lobster sidecar."
        : "Install the missing build tools before attempting desktop packaging.",
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Desktop build doctor failed.");
  process.exit(1);
});
