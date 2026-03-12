import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".openclaw-data");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function resolveFile(name: string) {
  return path.join(DATA_DIR, name);
}

// Per-file async mutex to prevent concurrent read-modify-write races.
const fileLocks = new Map<string, Promise<void>>();

function withFileLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(name) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  fileLocks.set(name, next);
  return prev.then(fn).finally(() => resolve!());
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

export async function readModifyWrite<T>(
  name: string,
  fallback: T,
  modify: (current: T) => T | Promise<T>,
): Promise<T> {
  return withFileLock(name, async () => {
    const current = await readJsonFile<T>(name, fallback);
    const next = await modify(current);
    await writeJsonFile(name, next);
    return next;
  });
}
