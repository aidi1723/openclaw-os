import {
  type PublishJobId,
  type PublishJobPatch,
  type PublishJobRecord,
  type PublishJobResult,
  type PublishJobStatus,
  type PublishPlatformId,
} from "@/lib/publish";
import { readJsonFile, writeJsonFile } from "@/lib/server/json-store";

const FILE_NAME = "publish-jobs.json";

const PLATFORM_IDS = new Set<PublishPlatformId>([
  "xiaohongshu",
  "douyin",
  "wechat",
  "tiktok",
  "instagram",
  "twitter",
  "linkedin",
  "storefront",
]);

const STATUS_IDS = new Set<PublishJobStatus>(["queued", "running", "done", "error", "stopped"]);

function normalizePlatforms(input: unknown): PublishPlatformId[] {
  if (!Array.isArray(input)) return [];
  const result: PublishPlatformId[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const platform = item.trim() as PublishPlatformId;
    if (!PLATFORM_IDS.has(platform) || result.includes(platform)) continue;
    result.push(platform);
  }
  return result;
}

function normalizeResults(input: unknown): PublishJobResult[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const result: PublishJobResult[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const platform = typeof item.platform === "string" ? (item.platform.trim() as PublishPlatformId) : null;
    if (!platform || !PLATFORM_IDS.has(platform)) continue;
    result.push({
      platform,
      ok: Boolean(item.ok),
      mode: item.mode === "webhook" ? "webhook" : "manual",
      status: typeof item.status === "number" ? item.status : undefined,
      error: typeof item.error === "string" && item.error.trim() ? item.error : undefined,
    });
  }
  return result.length > 0 ? result : undefined;
}

function normalizeJob(input: unknown): PublishJobRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id : null;
  const draftTitle =
    typeof item.draftTitle === "string" && item.draftTitle.trim() ? item.draftTitle.trim() : "未命名草稿";
  const platforms = normalizePlatforms(item.platforms);
  const status =
    typeof item.status === "string" && STATUS_IDS.has(item.status as PublishJobStatus)
      ? (item.status as PublishJobStatus)
      : "queued";
  const createdAt = typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : Date.now();
  const updatedAt = typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) ? item.updatedAt : createdAt;
  if (!id) return null;

  return {
    id,
    draftId: typeof item.draftId === "string" && item.draftId.trim() ? item.draftId : undefined,
    draftTitle,
    draftBody: typeof item.draftBody === "string" ? item.draftBody : undefined,
    platforms,
    mode: item.mode === "dispatch" ? "dispatch" : "dry-run",
    status,
    attempts: typeof item.attempts === "number" && Number.isFinite(item.attempts) ? item.attempts : 0,
    maxAttempts:
      typeof item.maxAttempts === "number" && Number.isFinite(item.maxAttempts) ? item.maxAttempts : 3,
    nextAttemptAt:
      typeof item.nextAttemptAt === "number" && Number.isFinite(item.nextAttemptAt) ? item.nextAttemptAt : undefined,
    resultText: typeof item.resultText === "string" ? item.resultText : undefined,
    results: normalizeResults(item.results),
    createdAt,
    updatedAt,
  };
}

async function readAll() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return raw.map(normalizeJob).filter((job): job is PublishJobRecord => Boolean(job));
}

async function writeAll(next: PublishJobRecord[]) {
  await writeJsonFile(FILE_NAME, next);
}

export async function listPublishJobs() {
  const jobs = await readAll();
  return jobs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createPublishJobRecord(input: {
  draftId?: string;
  draftTitle: string;
  draftBody?: string;
  platforms: PublishPlatformId[];
  mode?: "dry-run" | "dispatch";
  status?: PublishJobStatus;
  maxAttempts?: number;
}) {
  const now = Date.now();
  const job: PublishJobRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    draftId: input.draftId,
    draftTitle: input.draftTitle.trim() || "未命名草稿",
    draftBody: typeof input.draftBody === "string" ? input.draftBody : "",
    platforms: normalizePlatforms(input.platforms),
    mode: input.mode ?? "dry-run",
    status: input.status ?? "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: now,
    updatedAt: now,
  };
  const next = [job, ...(await readAll())];
  await writeAll(next);
  return job;
}

export async function updatePublishJobRecord(
  jobId: PublishJobId,
  patch: PublishJobPatch,
) {
  const current = await readAll();
  let updated: PublishJobRecord | null = null;
  const now = Date.now();
  const next = current.map((job) => {
    if (job.id !== jobId) return job;
    updated = {
      ...job,
      draftId:
        patch.draftId === undefined ? job.draftId : typeof patch.draftId === "string" && patch.draftId.trim() ? patch.draftId : undefined,
      draftTitle:
        typeof patch.draftTitle === "string" && patch.draftTitle.trim() ? patch.draftTitle.trim() : job.draftTitle,
      draftBody:
        patch.draftBody === undefined ? job.draftBody : typeof patch.draftBody === "string" ? patch.draftBody : undefined,
      platforms: patch.platforms ? normalizePlatforms(patch.platforms) : job.platforms,
      mode: patch.mode === "dispatch" ? "dispatch" : patch.mode === "dry-run" ? "dry-run" : job.mode,
      status:
        typeof patch.status === "string" && STATUS_IDS.has(patch.status as PublishJobStatus)
          ? (patch.status as PublishJobStatus)
          : job.status,
      attempts: typeof patch.attempts === "number" && Number.isFinite(patch.attempts) ? patch.attempts : job.attempts,
      maxAttempts:
        typeof patch.maxAttempts === "number" && Number.isFinite(patch.maxAttempts) ? patch.maxAttempts : job.maxAttempts,
      nextAttemptAt:
        patch.nextAttemptAt === undefined
          ? job.nextAttemptAt
          : typeof patch.nextAttemptAt === "number" && Number.isFinite(patch.nextAttemptAt)
            ? patch.nextAttemptAt
            : undefined,
      resultText:
        patch.resultText === undefined ? job.resultText : typeof patch.resultText === "string" ? patch.resultText : undefined,
      results: patch.results !== undefined ? normalizeResults(patch.results) : job.results,
      updatedAt: now,
    };
    return updated;
  });
  if (!updated) return null;
  await writeAll(next);
  return updated;
}

export async function removePublishJobRecord(jobId: PublishJobId) {
  const current = await readAll();
  const next = current.filter((job) => job.id !== jobId);
  await writeAll(next);
}
