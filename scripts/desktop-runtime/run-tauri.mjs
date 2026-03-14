import { constants } from "node:fs";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(THIS_DIR, "..", "..");
const TAURI_CONFIG_PATH = path.join(PROJECT_ROOT, "src-tauri", "tauri.conf.json");

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/",
        timeout: 1200,
      },
      (res) => {
        res.resume();
        resolve(true);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function findFreePort(start = 3000, attempts = 25) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = start + offset;
    const inUse = await isPortOpen(port);
    if (!inUse) {
      return port;
    }
  }
  fail(`Unable to find a free dev port between ${start} and ${start + attempts - 1}.`);
}

async function waitForUrl(url, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, { timeout: 1500 }, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
    });
    if (ok) {
      return;
    }
    await sleep(800);
  }
  fail(`Timed out waiting for Next dev server: ${url}`);
}

async function findCargo() {
  const home = os.homedir();
  const candidates = [
    process.env.CARGO_BIN,
    path.join(home, ".cargo", "bin", "cargo.exe"),
    path.join(home, ".cargo", "bin", "cargo"),
    "/opt/homebrew/bin/cargo",
    "/opt/homebrew/opt/rust/bin/cargo",
    process.platform === "win32" ? "cargo.exe" : "cargo",
    "cargo",
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!(await isExecutable(candidate)) && !candidate.includes("cargo")) {
      continue;
    }
    const probe = spawn(candidate, ["--version"], {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env,
    });
    const verified = await new Promise((resolve) => {
      probe.on("exit", (code) => resolve(code === 0));
      probe.on("error", () => resolve(false));
    });
    if (verified) {
      return candidate;
    }
  }

  fail(
    "Unable to find cargo. Install Rust/Tauri first, or set CARGO_BIN to an executable cargo path.",
  );
}

async function hasCargoTauri(cargo) {
  const probe = spawn(cargo, ["tauri", "--help"], {
    cwd: PROJECT_ROOT,
    stdio: "ignore",
    env: buildRuntimeEnv(),
  });
  return await new Promise((resolve) => {
    probe.on("exit", (code) => resolve(code === 0));
    probe.on("error", () => resolve(false));
  });
}

function buildRuntimeEnv() {
  const home = os.homedir();
  const pathEntries = [
    path.join(home, ".cargo", "bin"),
    "/opt/homebrew/opt/rust/bin",
    "/opt/homebrew/bin",
    "C:\\Program Files\\Docker\\Docker\\resources\\bin",
    process.env.PATH ?? "",
  ].filter(Boolean);

  return {
    ...process.env,
    PATH: pathEntries.join(path.delimiter),
  };
}

function stripArgWithValue(args, name) {
  const next = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name) {
      index += 1;
      continue;
    }
    next.push(value);
  }
  return next;
}

function hasArg(args, name) {
  return args.includes(name);
}

function runChild(command, args, env = buildRuntimeEnv()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal: ${signal}`));
        return;
      }
      if ((code ?? 0) !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

function spawnNextDevServer(port) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCommand,
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: String(port),
      },
    },
  );

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`Next dev server exited early with code ${code}.`);
    }
  });

  return child;
}

async function writeTempTauriDevConfig(devUrl) {
  const raw = await readFile(TAURI_CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  config.build = {
    ...config.build,
    devUrl,
    beforeDevCommand: 'node -e "process.exit(0)"',
  };

  const tempPath = path.join(
    os.tmpdir(),
    `agentcore-tauri-dev-${process.pid}-${Date.now()}.json`,
  );
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return tempPath;
}

async function runTauriDev(cargo) {
  const port = await findFreePort(3000, 30);
  const devUrl = `http://127.0.0.1:${port}`;
  console.log(`[AgentCore OS] starting Next dev server on ${devUrl}`);

  const nextChild = spawnNextDevServer(port);
  let tempConfigPath = "";

  const stopNext = () => {
    if (nextChild.exitCode != null) {
      return;
    }
    nextChild.kill();
    if (process.platform === "win32" && nextChild.pid) {
      spawnSync("taskkill", ["/PID", String(nextChild.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    }
  };

  try {
    await waitForUrl(devUrl);
    tempConfigPath = await writeTempTauriDevConfig(devUrl);
    const args = ["tauri", "dev", "--config", tempConfigPath, ...process.argv.slice(3)];
    const child = spawn(cargo, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: buildRuntimeEnv(),
    });

    child.on("exit", async (code, signal) => {
      stopNext();
      if (tempConfigPath) {
        await rm(tempConfigPath, { force: true });
      }
      if (signal) {
        fail(`cargo tauri terminated by signal: ${signal}`);
      }
      process.exit(code ?? 0);
    });
  } catch (error) {
    stopNext();
    if (tempConfigPath) {
      await rm(tempConfigPath, { force: true });
    }
    throw error;
  }
}

async function runTauriCli(args) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await runChild(npmCommand, ["exec", "--", "tauri", ...args]);
}

async function runTauriBuild(cargo, useCargoTauri) {
  const rawArgs = process.argv.slice(3);
  const extraArgs = stripArgWithValue(rawArgs, "--bundles");

  const invokeBuild = async (args) => {
    if (useCargoTauri) {
      await runChild(cargo, ["tauri", "build", ...args]);
      return;
    }
    await runTauriCli(["build", ...args]);
  };

  if (process.platform === "darwin") {
    await invokeBuild(["--bundles", "app", ...extraArgs]);
    await runChild(process.execPath, [
      path.join(THIS_DIR, "package-macos-dmg.mjs"),
      ...(rawArgs.includes("--debug") ? ["--debug"] : []),
    ]);
    return;
  }

  if (process.platform === "win32" && !hasArg(rawArgs, "--bundles")) {
    await invokeBuild(["--bundles", "nsis", ...rawArgs]);
    return;
  }

  await invokeBuild(rawArgs);
}

async function main() {
  const cargo = await findCargo();
  const useCargoTauri = await hasCargoTauri(cargo);
  const tauriSubcommand = process.argv[2];

  if (tauriSubcommand === "dev") {
    if (!useCargoTauri) {
      fail("Tauri dev mode requires cargo tauri to be installed locally.");
    }
    await runTauriDev(cargo);
    return;
  }

  if (tauriSubcommand === "build") {
    await runTauriBuild(cargo, useCargoTauri);
    return;
  }

  if (useCargoTauri) {
    const args = ["tauri", ...process.argv.slice(2)];
    const child = spawn(cargo, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: buildRuntimeEnv(),
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        fail(`cargo tauri terminated by signal: ${signal}`);
      }
      process.exit(code ?? 0);
    });
    return;
  }

  await runTauriCli(process.argv.slice(2));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to run cargo tauri.");
});
