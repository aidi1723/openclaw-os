import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".openclaw-data");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function resolveFile(name: string) {
  return path.join(DATA_DIR, name);
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const file = resolveFile(name);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(name: string, value: unknown) {
  await ensureDataDir();
  const file = resolveFile(name);
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}
