import { buildAgentCoreApiUrl } from "@/lib/app-api";

export type PublishJobId = string;

export type PublishPlatformId =
  | "xiaohongshu"
  | "douyin"
  | "wechat"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "storefront";

export type PublishJobStatus = "queued" | "running" | "done" | "error" | "stopped";

export type PublishJobResult = {
  platform: PublishPlatformId;
  ok: boolean;
  mode: "webhook" | "manual";
  status?: number;
  error?: string;
};

export type PublishJobRecord = {
  id: PublishJobId;
  draftId?: string;
  draftTitle: string;
  draftBody?: string;
  platforms: PublishPlatformId[];
  mode?: "dry-run" | "dispatch";
  status: PublishJobStatus;
  attempts?: number;
  maxAttempts?: number;
  nextAttemptAt?: number;
  resultText?: string;
  results?: PublishJobResult[];
  createdAt: number;
  updatedAt: number;
};

export type PublishJobPatch = Omit<
  Partial<Omit<PublishJobRecord, "id" | "createdAt">>,
  "draftId" | "draftBody" | "nextAttemptAt" | "resultText" | "results"
> & {
  draftId?: string | null;
  draftBody?: string | null;
  nextAttemptAt?: number | null;
  resultText?: string | null;
  results?: PublishJobResult[] | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();
let jobsCache: PublishJobRecord[] = [];

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:publish"));
  }
}

function sortJobs(jobs: PublishJobRecord[]) {
  return jobs.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function subscribePublish(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPublishJobs() {
  return sortJobs(jobsCache);
}

export async function refreshPublishJobs() {
  if (typeof window === "undefined") return jobsCache;
  try {
    const res = await fetch(buildAgentCoreApiUrl("/api/publish/jobs"), {
      method: "GET",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | null
      | { ok?: boolean; data?: { jobs?: PublishJobRecord[] } };
    if (!res.ok || !data?.ok) return jobsCache;
    jobsCache = Array.isArray(data.data?.jobs) ? data.data!.jobs : [];
    emit();
    return jobsCache;
  } catch {
    return jobsCache;
  }
}

export async function createPublishJob(input: {
  draftId?: string;
  draftTitle: string;
  draftBody?: string;
  platforms: PublishPlatformId[];
  mode?: "dry-run" | "dispatch";
  status?: PublishJobStatus;
  maxAttempts?: number;
}) {
  const res = await fetch(buildAgentCoreApiUrl("/api/publish/jobs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => null)) as
    | null
    | { ok?: boolean; data?: { job?: PublishJobRecord }; error?: string };
  if (!res.ok || !data?.ok || !data.data?.job) {
    throw new Error(data?.error || "创建任务失败");
  }
  jobsCache = sortJobs([data.data.job, ...jobsCache.filter((job) => job.id !== data.data!.job!.id)]);
  emit();
  return data.data.job.id;
}

export async function updatePublishJob(
  jobId: PublishJobId,
  patch: PublishJobPatch,
) {
  const res = await fetch(
    buildAgentCoreApiUrl(`/api/publish/jobs/${encodeURIComponent(jobId)}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  const data = (await res.json().catch(() => null)) as
    | null
    | { ok?: boolean; data?: { job?: PublishJobRecord }; error?: string };
  if (!res.ok || !data?.ok || !data.data?.job) {
    throw new Error(data?.error || "更新任务失败");
  }
  jobsCache = sortJobs(jobsCache.map((job) => (job.id === jobId ? data.data!.job! : job)));
  emit();
  return data.data.job;
}

export async function removePublishJob(jobId: PublishJobId) {
  const res = await fetch(
    buildAgentCoreApiUrl(`/api/publish/jobs/${encodeURIComponent(jobId)}`),
    {
      method: "DELETE",
    },
  );
  const data = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "删除任务失败");
  }
  jobsCache = jobsCache.filter((job) => job.id !== jobId);
  emit();
}
