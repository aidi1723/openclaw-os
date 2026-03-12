import { rename, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  AGENTCORE_STATIC_EXPORT: "1",
};

const appDir = path.join(process.cwd(), "src", "app");
const apiDir = path.join(appDir, "api");
const parkedApiDir = path.join(appDir, "__api_runtime__");

async function main() {
  let parked = false;

  try {
    await rm(path.join(process.cwd(), ".next"), { recursive: true, force: true });
    await rm(path.join(process.cwd(), ".next-dev"), { recursive: true, force: true });
    await rm(path.join(process.cwd(), "out"), { recursive: true, force: true });
    await rename(apiDir, parkedApiDir);
    parked = true;
  } catch {
    parked = false;
  }

  const result = spawnSync(process.execPath, ["./node_modules/next/dist/bin/next", "build"], {
    stdio: "inherit",
    env,
  });

  if (parked) {
    await rename(parkedApiDir, apiDir);
  }

  process.exit(result.status ?? 1);
}

main().catch(async (error) => {
  try {
    await rename(parkedApiDir, apiDir);
  } catch {
    // ignore restore failure
  }
  console.error(error);
  process.exit(1);
});
