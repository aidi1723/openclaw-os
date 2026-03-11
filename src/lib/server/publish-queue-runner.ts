import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PublishJobRecord } from "@/lib/publish";
import { readPublishConfig } from "@/lib/server/publish-config-store";
import { listPublishJobs, updatePublishJobRecord } from "@/lib/server/publish-job-store";
import { runPublishDispatch } from "@/lib/server/publish-dispatch";

const LOCK_FILE = path.join(process.cwd(), ".openclaw-data", "publish-queue.lock");

async function tryAcquireLock() {
  try {
    await mkdir(path.dirname(LOCK_FILE), { recursive: true });
    await writeFile(LOCK_FILE, String(process.pid), { encoding: "utf8", flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

async function releaseLock() {
  try {
    await unlink(LOCK_FILE);
  } catch {
    // ignore
  }
}

export async function runOneQueuedPublishJob() {
  const locked = await tryAcquireLock();
  if (!locked) {
    return { ok: true as const, processed: false, skipped: "locked" as const };
  }

  try {
    const now = Date.now();
    const queued = (await listPublishJobs())
      .filter((job) => job.status === "queued" && (job.nextAttemptAt ?? 0) <= now)
      .sort((a, b) => a.createdAt - b.createdAt);
    const job = queued[0];
    if (!job) {
      return { ok: true as const, processed: false, skipped: "empty" as const };
    }

    const maxAttempts = job.maxAttempts ?? 3;
    const attempt = (job.attempts ?? 0) + 1;
    await updatePublishJobRecord(job.id, { status: "running", nextAttemptAt: undefined });

    return await processJob(job, attempt, maxAttempts);
  } finally {
    await releaseLock();
  }
}

async function processJob(job: PublishJobRecord, attempt: number, maxAttempts: number) {
  const mode = job.mode ?? "dry-run";
  const title = job.draftTitle.trim() || "未命名草稿";
  const body = (job.draftBody ?? "").trim();
  const platforms = job.platforms ?? [];

  if (!body || platforms.length === 0) {
    const error = "队列任务无效：缺少内容或平台";
    const updated = await updatePublishJobRecord(job.id, {
      status: "error",
      attempts: attempt,
      nextAttemptAt: undefined,
      resultText: error,
      results: undefined,
    });
    return { ok: false as const, processed: true, error, job: updated };
  }

  const connections = await readPublishConfig();
  const result = await runPublishDispatch({
    title,
    body,
    platforms,
    dryRun: mode === "dry-run",
    connections,
  });

  const results = Array.isArray((result as any).results) ? ((result as any).results as any[]) : undefined;
  const resultText = typeof (result as any).text === "string" ? (result as any).text : undefined;

  if (!result.ok) {
    const error = "error" in result ? result.error : "发布失败";
    if (attempt < maxAttempts && mode === "dispatch") {
      const backoffMs = Math.min(60_000, 1500 * 2 ** (attempt - 1));
      const updated = await updatePublishJobRecord(job.id, {
        status: "queued",
        attempts: attempt,
        nextAttemptAt: Date.now() + backoffMs,
        resultText: resultText ? `${error}\n\n${resultText}` : error,
        results,
      });
      return { ok: false as const, processed: true, retried: true as const, error, job: updated };
    }

    const updated = await updatePublishJobRecord(job.id, {
      status: "error",
      attempts: attempt,
      nextAttemptAt: undefined,
      resultText: resultText ? `${error}\n\n${resultText}` : error,
      results,
    });
    return { ok: false as const, processed: true, error, job: updated };
  }

  const updated = await updatePublishJobRecord(job.id, {
    status: "done",
    attempts: attempt,
    nextAttemptAt: undefined,
    resultText: resultText || "（无输出）",
    results,
  });
  return { ok: true as const, processed: true, job: updated };
}
