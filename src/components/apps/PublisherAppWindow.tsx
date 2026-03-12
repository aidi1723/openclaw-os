"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Copy, RefreshCw, RotateCcw, Send, Share2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { CreatorHeroWorkflowPanel } from "@/components/workflows/CreatorHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { upsertCreatorAsset } from "@/lib/creator-assets";
import {
  createDraft,
  getDrafts,
  removeDraft,
  subscribeDrafts,
  updateDraft,
  type DraftId,
  type DraftRecord,
} from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  createPublishJob,
  getPublishJobs,
  removePublishJob,
  refreshPublishJobs,
  subscribePublish,
  updatePublishJob,
  type PublishJobId,
  type PublishJobRecord,
  type PublishJobResult,
  type PublishPlatformId,
} from "@/lib/publish";
import {
  getPublishConfig,
  refreshPublishConfig,
  savePublishConfig,
  subscribePublishConfig,
} from "@/lib/publish-config";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenSettings, type PublisherPrefill } from "@/lib/ui-events";
import type { WorkflowContextMeta } from "@/lib/workflow-context";
import {
  advanceWorkflowRun,
  completeWorkflowRun,
  getWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";

const platforms: Array<{ id: PublishPlatformId; name: string; supported?: boolean }> = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  { id: "wechat", name: "公众号", supported: false },
  { id: "twitter", name: "X(Twitter)", supported: false },
  { id: "linkedin", name: "LinkedIn", supported: false },
  { id: "storefront", name: "独立站", supported: false },
];

function getModeLabel(mode: PublishJobRecord["mode"]) {
  return mode === "dispatch" ? "自动发布" : "安全预演";
}

function getJobStatusMeta(status: PublishJobRecord["status"]) {
  switch (status) {
    case "queued":
      return { label: "排队中", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "running":
      return { label: "执行中", className: "border-blue-200 bg-blue-50 text-blue-700" };
    case "done":
      return { label: "已完成", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "error":
      return { label: "失败", className: "border-red-200 bg-red-50 text-red-700" };
    case "stopped":
      return { label: "已停止", className: "border-gray-200 bg-gray-50 text-gray-700" };
  }
}

function formatTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatRetry(ts?: number) {
  if (!ts) return null;
  const deltaMs = ts - Date.now();
  if (deltaMs <= 0) return "即将重试";
  const seconds = Math.round(deltaMs / 1000);
  if (seconds < 60) return `${seconds} 秒后重试`;
  return `${Math.ceil(seconds / 60)} 分钟后重试`;
}

type JobFilterId = "all" | "active" | "failed" | "done";

const jobFilters: Array<{ id: JobFilterId; label: string }> = [
  { id: "all", label: "全部" },
  { id: "active", label: "进行中" },
  { id: "failed", label: "失败" },
  { id: "done", label: "完成" },
];

type ChecklistStatus = "ok" | "warn" | "risk";

type PublishChecklistItem = {
  label: string;
  detail: string;
  status: ChecklistStatus;
};

type PlatformAdvice = {
  platform: PublishPlatformId;
  detail: string;
  status: ChecklistStatus;
};

function getChecklistStatusMeta(status: ChecklistStatus) {
  switch (status) {
    case "ok":
      return {
        label: "通过",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "warn":
      return {
        label: "建议调整",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "risk":
      return {
        label: "高风险",
        className: "border-red-200 bg-red-50 text-red-700",
      };
  }
}

function analyzePublishReadiness(input: {
  title: string;
  body: string;
  platforms: PublishPlatformId[];
  dispatchMode: "dry-run" | "dispatch";
  connections: Record<string, { token: string; webhookUrl: string }>;
}) {
  const title = input.title.trim();
  const body = input.body.trim();
  const firstLine = body.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
  const bodyLength = body.length;
  const lineCount = body ? body.split(/\r?\n/).filter((line) => line.trim()).length : 0;
  const hashtagCount = (body.match(/#[\p{L}\p{N}_-]+/gu) ?? []).length;
  const hasQuestionOrNumber = /[0-9０-９一二三四五六七八九十?？!！]|为什么|别再|不要|如何|怎样|秘诀|清单|步骤|技巧/.test(
    title || firstLine,
  );
  const hasCta = /关注|评论|私信|收藏|转发|点击|了解|预约|领取|回复|下载|扫码|follow|comment|dm|link|save/i.test(body);
  const selectedPlatforms = input.platforms;
  const checks: PublishChecklistItem[] = [];

  if (!title) {
    checks.push({ label: "标题", detail: "缺少明确标题，预演和发布后的识别成本都会变高。", status: "risk" });
  } else if (title.length < 8) {
    checks.push({ label: "标题", detail: "标题偏短，建议补上结果、数字或冲突点。", status: "warn" });
  } else if (title.length > 36) {
    checks.push({ label: "标题", detail: "标题偏长，建议压到 36 字以内，方便短内容平台首屏阅读。", status: "warn" });
  } else {
    checks.push({ label: "标题", detail: "标题长度合适，适合继续做预演或派发。", status: "ok" });
  }

  if (!body) {
    checks.push({ label: "正文", detail: "正文为空，当前不能进入有效预演或发布。", status: "risk" });
  } else if (bodyLength < 90) {
    checks.push({ label: "正文", detail: "正文偏短，建议补足观点、场景或行动建议。", status: "warn" });
  } else if (bodyLength > 900) {
    checks.push({ label: "正文", detail: "正文较长，更像长文底稿，建议拆出一个短版再发。", status: "warn" });
  } else {
    checks.push({ label: "正文", detail: "正文长度适中，适合继续做平台差异检查。", status: "ok" });
  }

  if (!hasQuestionOrNumber) {
    checks.push({ label: "开场 hook", detail: "标题或首句里缺少数字、问题或强结论，吸引力偏弱。", status: "warn" });
  } else {
    checks.push({ label: "开场 hook", detail: "标题或首句已经包含明显钩子。", status: "ok" });
  }

  if (!hasCta) {
    checks.push({ label: "CTA", detail: "正文里没有明显动作指令，建议补上关注、评论、私信或领取动作。", status: "warn" });
  } else {
    checks.push({ label: "CTA", detail: "正文里已经有明确 CTA。", status: "ok" });
  }

  if (lineCount < 3) {
    checks.push({ label: "结构", detail: "段落偏少，建议拆成 3 段以上，移动端更好读。", status: "warn" });
  } else {
    checks.push({ label: "结构", detail: "段落层次够用，适合移动端阅读。", status: "ok" });
  }

  if (selectedPlatforms.some((platform) => ["xiaohongshu", "instagram", "tiktok"].includes(platform)) && hashtagCount === 0) {
    checks.push({ label: "标签", detail: "当前没有 hashtag，可按平台补 2-4 个主题标签。", status: "warn" });
  } else if (hashtagCount > 8) {
    checks.push({ label: "标签", detail: "hashtag 偏多，建议收敛到更聚焦的几个主题标签。", status: "warn" });
  } else {
    checks.push({ label: "标签", detail: "标签数量可接受。", status: "ok" });
  }

  if (
    input.dispatchMode === "dispatch" &&
    selectedPlatforms.some((platform) => !input.connections[platform]?.webhookUrl?.trim())
  ) {
    checks.push({
      label: "自动发布配置",
      detail: "部分已选平台没有 Webhook，当前更适合先做预演或切成手动发布清单。",
      status: "risk",
    });
  } else if (input.dispatchMode === "dispatch") {
    checks.push({
      label: "自动发布配置",
      detail: "已选平台的自动发布条件基本齐备。",
      status: "ok",
    });
  } else {
    checks.push({
      label: "自动发布配置",
      detail: "当前是预演模式，适合先看平台差异和文案质量。",
      status: "ok",
    });
  }

  const platformAdvice = selectedPlatforms.map<PlatformAdvice>((platform) => {
    if (platform === "xiaohongshu") {
      if (bodyLength < 120) {
        return { platform, status: "warn", detail: "适合补一点场景感、步骤感或个人经验，再去小红书更稳。" };
      }
      return { platform, status: "ok", detail: "结构和长度基本适合做小红书预演，注意封面标题和分段节奏。" };
    }
    if (platform === "douyin" || platform === "tiktok") {
      if (!hasQuestionOrNumber || bodyLength > 260) {
        return { platform, status: "warn", detail: "更像长帖，不像口播脚本。建议压短并把 hook 放到第一句。" };
      }
      return { platform, status: "ok", detail: "具备短视频脚本基础，可以直接预演短口播版本。" };
    }
    if (platform === "instagram") {
      if (lineCount < 3) {
        return { platform, status: "warn", detail: "建议增加换行和标签，让 caption 更像 Instagram 贴文。" };
      }
      return { platform, status: "ok", detail: "caption 结构基本可用，适合继续调语气和标签。" };
    }
    return { platform, status: "warn", detail: "该平台还不是当前第一梯队接入，建议先作为保留位处理。" };
  });

  const scorePenalty = checks.reduce((sum, item) => sum + (item.status === "risk" ? 18 : item.status === "warn" ? 8 : 0), 0);
  const score = Math.max(32, 100 - scorePenalty);
  const riskCount = checks.filter((item) => item.status === "risk").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;
  const recommendation =
    riskCount > 0
      ? "先修正高风险项，再继续发布。当前更适合停留在预演。"
      : warnCount > 2
        ? "可以先做预演，把标题、CTA 和结构再收一遍。"
        : input.dispatchMode === "dispatch"
          ? "整体已经接近可发布状态，适合在确认 Webhook 后进入自动发布。"
          : "稿件基础不错，建议先预演确认平台差异，再决定是否自动发布。";

  return {
    score,
    recommendation,
    checks,
    platformAdvice,
  };
}

function getPlatformLabel(platform: PublishPlatformId) {
  return platforms.find((item) => item.id === platform)?.name ?? platform;
}

function buildLocalPlatformVariant(platform: PublishPlatformId, title: string, body: string) {
  const cleanTitle = title.trim() || "未命名主题";
  const cleanBody = body.trim();
  const bodyLines = cleanBody.split(/\r?\n/).filter((line) => line.trim());
  const first = bodyLines[0] ?? cleanBody;
  const second = bodyLines[1] ?? "先讲问题，再给一个立刻能执行的动作。";
  const third = bodyLines[2] ?? "最后补一句明确 CTA，例如评论、收藏或私信领取。";

  if (platform === "douyin" || platform === "tiktok") {
    return [
      `${cleanTitle}，最容易做错的其实是这一点。`,
      "",
      "口播脚本：",
      `1. 开场先抛结果或误区：${first}`,
      `2. 中段补一句核心解释：${second}`,
      `3. 结尾给动作：${third}`,
      "",
      "CTA：看完直接评论“想要”，我把完整版本发你。",
    ].join("\n");
  }

  if (platform === "xiaohongshu") {
    return [
      `${cleanTitle}`,
      "",
      "今天把这件事重新整理了一遍，最值得先做的是下面 3 步：",
      `1. ${first}`,
      `2. ${second}`,
      `3. ${third}`,
      "",
      "如果你也在做类似内容，可以先收藏这版，再按自己的场景微调。",
      "#经验分享 #内容运营 #效率提升",
    ].join("\n");
  }

  if (platform === "instagram") {
    return [
      `${cleanTitle}`,
      "",
      first,
      second,
      third,
      "",
      "Save this for your next content sprint.",
      "#contentworkflow #creatorops #digitalmarketing",
    ].join("\n");
  }

  return cleanBody;
}

export function PublisherAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [jobs, setJobs] = useState<PublishJobRecord[]>([]);
  const [selectedId, setSelectedId] = useState<DraftId | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<PublishJobId | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PublishPlatformId[]>(() => ["xiaohongshu", "douyin"]);
  const [resultText, setResultText] = useState("");
  const [lastResults, setLastResults] = useState<PublishJobResult[] | null>(null);
  const [connByPlatform, setConnByPlatform] = useState<Record<string, { token: string; webhookUrl: string }>>({});
  const [dispatchMode, setDispatchMode] = useState<"dry-run" | "dispatch">("dry-run");
  const [connectorOnline, setConnectorOnline] = useState<null | boolean>(null);
  const [connectorJobs, setConnectorJobs] = useState<any[] | null>(null);
  const [jobFilter, setJobFilter] = useState<JobFilterId>("all");
  const [jobActionId, setJobActionId] = useState<PublishJobId | null>(null);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState<"success" | "error">("success");
  const [workflowRunId, setWorkflowRunId] = useState<string | undefined>();
  const [workflowScenarioId, setWorkflowScenarioId] = useState<string | undefined>();
  const [workflowStageId, setWorkflowStageId] = useState<string | undefined>();
  const [workflowSource, setWorkflowSource] = useState("");
  const [workflowNextStep, setWorkflowNextStep] = useState("");
  const [workflowTriggerType, setWorkflowTriggerType] = useState<WorkflowTriggerType | undefined>();
  const [rewritingPlatform, setRewritingPlatform] = useState<PublishPlatformId | null>(null);

  const applyWorkflowContext = useCallback((context?: WorkflowContextMeta | null) => {
    setWorkflowRunId(context?.workflowRunId);
    setWorkflowScenarioId(context?.workflowScenarioId);
    setWorkflowStageId(context?.workflowStageId);
    setWorkflowSource(context?.workflowSource ?? "");
    setWorkflowNextStep(context?.workflowNextStep ?? "");
    setWorkflowTriggerType(context?.workflowTriggerType);
  }, []);

  const buildWorkflowContext = (): WorkflowContextMeta => ({
    workflowRunId,
    workflowScenarioId,
    workflowStageId,
    workflowSource: workflowSource || undefined,
    workflowNextStep: workflowNextStep || undefined,
    workflowTriggerType,
  });

  useEffect(() => {
    if (!isVisible) return;
    setDrafts(getDrafts());
    setJobs(getPublishJobs());
    void refreshPublishJobs();
    const unsubDrafts = subscribeDrafts(() => setDrafts(getDrafts()));
    const unsubPublish = subscribePublish(() => setJobs(getPublishJobs()));
    return () => {
      unsubDrafts();
      unsubPublish();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    const run = async () => {
      const health = await fetch(buildAgentCoreApiUrl("/api/publish/connector/health"), {
        method: "GET",
      })
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      setConnectorOnline(Boolean(health?.ok));

      const jobsRes = await fetch(
        buildAgentCoreApiUrl("/api/publish/connector/jobs?limit=12"),
        { method: "GET" },
      )
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      const list = jobsRes?.ok ? jobsRes?.data?.jobs : null;
      setConnectorJobs(Array.isArray(list) ? list : null);
    };
    void run();
    const intervalId = window.setInterval(() => {
      void run();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const apply = () => {
      setConnByPlatform(getPublishConfig());
    };
    apply();
    void refreshPublishConfig();
    const unsubConfig = subscribePublishConfig(apply);
    return () => {
      unsubConfig();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (drafts.length === 0) {
      setSelectedId(null);
      setTitle("");
      setBody("");
      applyWorkflowContext(null);
      return;
    }
    if (selectedId && drafts.some((draft) => draft.id === selectedId)) return;
    const first = drafts[0];
    setSelectedId(first.id);
    setTitle(first.title);
    setBody(first.body);
    applyWorkflowContext(first);
  }, [applyWorkflowContext, drafts, isVisible, selectedId]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<PublisherPrefill>).detail;
      const targetDraft = detail?.draftId ? getDrafts().find((draft) => draft.id === detail.draftId) ?? null : null;

      if (targetDraft) {
        setSelectedId(targetDraft.id);
        setTitle(targetDraft.title);
        setBody(targetDraft.body);
        applyWorkflowContext({
          workflowRunId: detail?.workflowRunId ?? targetDraft.workflowRunId,
          workflowScenarioId: detail?.workflowScenarioId ?? targetDraft.workflowScenarioId,
          workflowStageId: detail?.workflowStageId ?? targetDraft.workflowStageId,
          workflowSource: detail?.workflowSource ?? targetDraft.workflowSource,
          workflowNextStep: detail?.workflowNextStep ?? targetDraft.workflowNextStep,
          workflowTriggerType: detail?.workflowTriggerType ?? targetDraft.workflowTriggerType,
        });
      } else {
        setSelectedId(null);
        setTitle(detail?.title ?? "");
        setBody(detail?.body ?? "");
        applyWorkflowContext(detail);
      }

      if (detail?.platforms?.length) {
        setSelectedPlatforms(detail.platforms);
      }
      if (detail?.dispatchMode) {
        setDispatchMode(detail.dispatchMode);
      }
      setResultText("");
      setLastResults(null);
      setActionTone("success");
      setActionMessage("已带入发布上下文");
    };

    window.addEventListener("openclaw:publisher-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:publisher-prefill", onPrefill);
  }, [applyWorkflowContext]);

  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedJobId(null);
      return;
    }
    if (selectedJobId && jobs.some((job) => job.id === selectedJobId)) return;
    setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId]);

  const selectedDraft = useMemo(() => {
    if (!selectedId) return null;
    return drafts.find((draft) => draft.id === selectedId) ?? null;
  }, [drafts, selectedId]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId]);

  const isDispatching = useMemo(
    () => jobs.some((job) => job.status === "running"),
    [jobs],
  );

  const queueSummary = useMemo(() => {
    const queued = jobs.filter((job) => job.status === "queued").length;
    const running = jobs.filter((job) => job.status === "running").length;
    const failed = jobs.filter((job) => job.status === "error").length;
    const done = jobs.filter((job) => job.status === "done").length;
    return { queued, running, failed, done };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    switch (jobFilter) {
      case "active":
        return jobs.filter((job) => job.status === "queued" || job.status === "running");
      case "failed":
        return jobs.filter((job) => job.status === "error");
      case "done":
        return jobs.filter((job) => job.status === "done");
      default:
        return jobs;
    }
  }, [jobFilter, jobs]);

  const publishInsights = useMemo(
    () =>
      analyzePublishReadiness({
        title,
        body,
        platforms: selectedPlatforms,
        dispatchMode,
        connections: connByPlatform,
      }),
    [title, body, selectedPlatforms, dispatchMode, connByPlatform],
  );

  useEffect(() => {
    setResultText(selectedJob?.resultText ?? "");
    setLastResults(selectedJob?.results ?? null);
  }, [selectedJob]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => setActionMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const togglePlatform = (id: PublishPlatformId) => {
    setSelectedPlatforms((prev) => (prev.includes(id) ? prev.filter((platform) => platform !== id) : [...prev, id]));
  };

  const onSelectDraft = (draftId: DraftId) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    setSelectedId(draftId);
    setTitle(draft.title);
    setBody(draft.body);
    applyWorkflowContext(draft);
    setResultText("");
    setLastResults(null);
  };

  const refreshJobsPanel = async () => {
    setJobsRefreshing(true);
    try {
      await refreshPublishJobs();
    } finally {
      setJobsRefreshing(false);
    }
  };

  const triggerQueueRun = async () => {
    await fetch(buildAgentCoreApiUrl("/api/publish/queue/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }).catch(() => null);
    await refreshPublishJobs();
  };

  const saveCurrent = () => {
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    if (!nextBody) return;
    const workflowContext = buildWorkflowContext();
    if (!selectedId) {
      const draftId = createDraft({
        title: nextTitle,
        body: nextBody,
        tags: selectedPlatforms,
        source: "publisher",
        ...workflowContext,
      });
      setSelectedId(draftId);
      return;
    }
    updateDraft(selectedId, {
      title: nextTitle,
      body: nextBody,
      tags: selectedPlatforms,
      ...workflowContext,
    });
  };

  const isCreatorWorkflowContext =
    workflowScenarioId === "creator-studio" ||
    Boolean(workflowRunId) ||
    Boolean(selectedDraft?.workflowRunId);

  const syncWorkflowDraft = (draftId: DraftId, context: WorkflowContextMeta) => {
    updateDraft(draftId, {
      workflowRunId: context.workflowRunId,
      workflowScenarioId: context.workflowScenarioId,
      workflowStageId: context.workflowStageId,
      workflowSource: context.workflowSource,
      workflowNextStep: context.workflowNextStep,
      workflowTriggerType: context.workflowTriggerType,
    });
  };

  const dispatch = async () => {
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    if (!nextBody || selectedPlatforms.length === 0) return;
    const workflowContext = buildWorkflowContext();

    const draftId = (() => {
      if (!selectedId) {
        const id = createDraft({
          title: nextTitle,
          body: nextBody,
          tags: selectedPlatforms,
          source: "publisher",
          ...workflowContext,
        });
        setSelectedId(id);
        return id;
      }
      updateDraft(selectedId, {
        title: nextTitle,
        body: nextBody,
        tags: selectedPlatforms,
        ...workflowContext,
      });
      return selectedId;
    })();

    setResultText("已加入队列，等待执行…");
    setLastResults(null);

    try {
      const jobId = await createPublishJob({
        draftId,
        draftTitle: nextTitle,
        draftBody: nextBody,
        platforms: selectedPlatforms,
        mode: dispatchMode,
        status: "queued",
        maxAttempts: dispatchMode === "dry-run" ? 1 : 3,
      });
      setSelectedJobId(jobId);
      if (workflowRunId) {
        const run = getWorkflowRun(workflowRunId);
        const nextContext: WorkflowContextMeta = {
          workflowRunId,
          workflowScenarioId: workflowScenarioId ?? "creator-studio",
          workflowStageId: run?.currentStageId === "preflight" ? "publish-loop" : workflowStageId,
          workflowSource:
            dispatchMode === "dispatch"
              ? "Publisher 已批准自动发布，进入发布与复用阶段"
              : "Publisher 已完成安全预演，进入发布与复用阶段",
          workflowNextStep:
            dispatchMode === "dispatch"
              ? "等待平台回执与收据，再确认哪些结构值得复用沉淀。"
              : "检查预演结果后，确认是否切到自动发布，并把有效版本沉淀为资产。",
          workflowTriggerType,
        };
        if (run?.currentStageId === "preflight") {
          advanceWorkflowRun(workflowRunId);
        }
        applyWorkflowContext(nextContext);
        syncWorkflowDraft(draftId, nextContext);
        upsertCreatorAsset(workflowRunId, {
          scenarioId: workflowScenarioId ?? "creator-studio",
          draftId,
          topic: nextTitle,
          primaryAngle: nextTitle,
          latestDraftTitle: nextTitle,
          latestDraftBody: nextBody,
          publishTargets: selectedPlatforms,
          publishStatus: dispatchMode === "dispatch" ? "dispatch_queued" : "dry_run_queued",
          nextAction: nextContext.workflowNextStep,
          status: "publishing",
        });
      }
    } catch (err) {
      setResultText(err instanceof Error ? err.message : "创建发布任务失败");
    }
  };

  const completeCreatorWorkflowRun = () => {
    if (!workflowRunId) return;
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    const nextContext: WorkflowContextMeta = {
      workflowRunId,
      workflowScenarioId: workflowScenarioId ?? "creator-studio",
      workflowStageId: "publish-loop",
      workflowSource: "Publisher 已完成本轮预演/发布闭环",
      workflowNextStep: "本轮内容链已完成，可以复用高表现结构、平台版本和 CTA 模板。",
      workflowTriggerType,
    };
    applyWorkflowContext(nextContext);
    if (selectedId) {
      syncWorkflowDraft(selectedId, nextContext);
    }
    upsertCreatorAsset(workflowRunId, {
      scenarioId: workflowScenarioId ?? "creator-studio",
      draftId: selectedId ?? undefined,
      topic: nextTitle,
      primaryAngle: nextTitle,
      latestDraftTitle: nextTitle,
      latestDraftBody: nextBody,
      publishTargets: selectedPlatforms,
      publishStatus: selectedJob?.status === "done" ? "completed" : dispatchMode === "dispatch" ? "dispatch_reviewed" : "dry_run_reviewed",
      nextAction: nextContext.workflowNextStep,
      reuseNotes:
        lastResults
          ?.map((item) =>
            `${getPlatformLabel(item.platform)}: ${item.ok ? "执行完成" : item.error || "待人工复核"} (${item.mode})`,
          )
          .join("\n") ?? "",
      status: "completed",
    });
    completeWorkflowRun(workflowRunId);
    setActionTone("success");
    setActionMessage("已完成 Creator Hero Workflow");
  };

  const supportedPlatformCount = platforms.filter((platform) => platform.supported !== false).length;
  const canReplaySelectedJob = Boolean(
    selectedJob && selectedJob.status !== "running" && selectedJob.platforms.length > 0 && selectedJob.draftBody?.trim(),
  );
  const canDeleteSelectedJob = Boolean(selectedJob && selectedJob.status !== "running");

  const replayJob = async (job: PublishJobRecord) => {
    if (job.status === "running" || !job.draftBody?.trim() || job.platforms.length === 0) return;
    setJobActionId(job.id);
    try {
      await updatePublishJob(job.id, {
        status: "queued",
        attempts: 0,
        nextAttemptAt: null,
        resultText: "",
        results: null,
      });
      setSelectedJobId(job.id);
      setActionTone("success");
      setActionMessage(job.status === "done" ? "任务已重新排队执行" : "失败任务已重新入队");
      await triggerQueueRun();
    } catch (err) {
      setActionTone("error");
      setActionMessage(err instanceof Error ? err.message : "重新排队失败");
    } finally {
      setJobActionId(null);
    }
  };

  const deleteJob = async (job: PublishJobRecord) => {
    if (job.status === "running") return;
    setJobActionId(job.id);
    try {
      await removePublishJob(job.id);
      setActionTone("success");
      setActionMessage("任务已删除");
      if (selectedJobId === job.id) {
        setSelectedJobId(null);
      }
    } catch (err) {
      setActionTone("error");
      setActionMessage(err instanceof Error ? err.message : "删除任务失败");
    } finally {
      setJobActionId(null);
    }
  };

  const copySelectedResult = async () => {
    if (!resultText.trim()) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setActionTone("success");
      setActionMessage("结果已复制");
    } catch {
      setActionTone("error");
      setActionMessage("复制失败");
    }
  };

  const generatePlatformVariant = async (platform: PublishPlatformId) => {
    const cleanBody = body.trim();
    const cleanTitle = title.trim() || "未命名草稿";
    if (!cleanBody) {
      setActionTone("error");
      setActionMessage("请先准备正文，再生成平台修正版");
      return;
    }

    const taskId = createTask({
      name: `Assistant - Publisher ${platform} variant`,
      status: "running",
      detail: cleanTitle,
    });

    setRewritingPlatform(platform);
    try {
      const platformName = getPlatformLabel(platform);
      const prompt =
        `你是 ${platformName} 平台的内容编辑助手。请把用户提供的标题和正文改写成更适合该平台直接预演的版本。\n` +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 保留核心观点，但按目标平台习惯重写结构和语气。\n" +
        "2) 强化开场 hook、可读性和 CTA。\n" +
        "3) 只输出最终可直接发布/预演的文案，不要解释。\n" +
        "4) 如果适合该平台，可补充 2-4 个简洁标签。\n\n" +
        `目标平台：${platformName}\n` +
        `原标题：${cleanTitle}\n` +
        `原正文：\n${cleanBody}`;

      const rewritten =
        (await requestOpenClawAgent({
          message: prompt,
          sessionId: `webos-publisher-${platform}-variant`,
          timeoutSeconds: 90,
        })) || buildLocalPlatformVariant(platform, cleanTitle, cleanBody);

      const workflowContext = buildWorkflowContext();
      const draftId = createDraft({
        title: `${cleanTitle} · ${platformName}版`,
        body: rewritten,
        tags: [platform, "publish-variant", "publisher"],
        source: "publisher",
        ...workflowContext,
        workflowSource: `基于 Publisher 智能检查生成的 ${platformName} 修正版`,
        workflowNextStep: "先做预演，确认平台语气、CTA 和标签是否合适，再决定是否自动发布。",
      });

      setSelectedId(draftId);
      setTitle(`${cleanTitle} · ${platformName}版`);
      setBody(rewritten);
      setSelectedPlatforms([platform]);
      setDispatchMode("dry-run");
      setWorkflowSource(`基于 Publisher 智能检查生成的 ${platformName} 修正版`);
      setWorkflowNextStep("先做预演，确认平台语气、CTA 和标签是否合适，再决定是否自动发布。");
      setActionTone("success");
      setActionMessage(`已生成 ${platformName} 修正版并切换到新草稿`);
      updateTask(taskId, { status: "done", detail: `${platformName} variant ready` });
    } catch (err) {
      const platformName = getPlatformLabel(platform);
      const fallback = buildLocalPlatformVariant(platform, cleanTitle, cleanBody);
      const draftId = createDraft({
        title: `${cleanTitle} · ${platformName}版`,
        body: fallback,
        tags: [platform, "publish-variant", "publisher", "fallback"],
        source: "publisher",
        ...buildWorkflowContext(),
        workflowSource: `Publisher 本地兜底生成的 ${platformName} 修正版`,
        workflowNextStep: "建议先手动检查这版语气和 CTA，再进入预演。",
      });
      setSelectedId(draftId);
      setTitle(`${cleanTitle} · ${platformName}版`);
      setBody(fallback);
      setSelectedPlatforms([platform]);
      setDispatchMode("dry-run");
      setWorkflowSource(`Publisher 本地兜底生成的 ${platformName} 修正版`);
      setWorkflowNextStep("建议先手动检查这版语气和 CTA，再进入预演。");
      setActionTone("error");
      setActionMessage(err instanceof Error ? `${platformName} 改写失败，已切换本地兜底版` : "改写失败，已切换本地兜底版");
      updateTask(taskId, { status: "error", detail: err instanceof Error ? err.message : "rewrite failed" });
    } finally {
      setRewritingPlatform(null);
    }
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="矩阵发布中心"
      icon={Share2}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.publisher"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="bg-white">
        <div className="flex min-h-[680px] flex-col lg:flex-row">
          <aside className="w-full border-b border-gray-200 bg-gray-50/70 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Publisher</div>
              <div className="mt-1 text-lg font-bold text-gray-950">内容库</div>
              <div className="mt-2 text-xs leading-5 text-gray-500">
                保存主稿，快速切换要发的平台，然后把结果留在右侧工作区统一查看。
              </div>
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">草稿</div>
                <div className="mt-1 text-2xl font-bold text-gray-950">{drafts.length}</div>
                <div className="mt-2 text-xs text-gray-500">发布记录 {jobs.length} 条</div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setTitle("");
                  setBody("");
                  applyWorkflowContext(null);
                  setResultText("");
                  setLastResults(null);
                }}
                className="w-full rounded-2xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                新建草稿
              </button>
            </div>

            <div className="px-2 pb-4">
              <div className="px-3 pb-2 text-xs font-semibold text-gray-500">草稿列表</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {drafts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    还没有草稿。可以先从 AI 文案或其他应用保存一份主稿。
                  </div>
                ) : (
                  drafts.slice(0, 20).map((draft) => {
                    const activeRow = draft.id === selectedId;
                    return (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => onSelectDraft(draft.id)}
                        className={[
                          "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                          activeRow
                            ? "border-emerald-200 bg-white text-gray-950 shadow-sm"
                            : "border-transparent bg-transparent text-gray-700 hover:bg-white/75",
                        ].join(" ")}
                      >
                        <div className="truncate text-sm font-semibold">{draft.title}</div>
                        <div className="mt-1 truncate text-xs text-gray-500">{formatTime(draft.updatedAt)}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <main className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {isCreatorWorkflowContext ? (
              <CreatorHeroWorkflowPanel
                workflowRunId={workflowRunId}
                title={title ? `${title} · 发布前检查与复用阶段` : "Publisher · Creator Hero Workflow"}
                description="Publisher 在这条内容链里承担的是企业级的人机协作边界: 先做预演和平台适配，再决定是否自动发布，最后把有效版本沉淀成复用资产。"
                emptyHint="当稿件来自 Creator Radar 或 Content Repurposer 时，这里会显示同一条 Creator Hero Workflow 的状态。"
                source={workflowSource}
                nextStep={workflowNextStep}
                actions={[
                  {
                    label: "保存主稿",
                    onClick: saveCurrent,
                    disabled: !body.trim(),
                    tone: "secondary",
                  },
                  {
                    label: "完成本轮内容链",
                    onClick: completeCreatorWorkflowRun,
                    disabled: !workflowRunId,
                  },
                ]}
              />
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
              <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#edf7ff_52%,#fffaf2_100%)] p-5 shadow-[0_20px_70px_rgba(16,24,40,0.08)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Publisher Workflow
                    </div>
                    <div className="mt-3 text-[28px] font-bold tracking-tight text-gray-950">发布工作台</div>
                    <div className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
                      这里不只是一个发文按钮。它负责把平台选择、发布模式、任务状态、重试结果和 Connector 收据收在一个界面里，方便你用同一套流程处理内容派发。
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                    <Send className="h-4 w-4 text-emerald-600" />
                    {getModeLabel(dispatchMode)}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Drafts</div>
                    <div className="mt-2 text-2xl font-bold text-gray-950">{drafts.length}</div>
                    <div className="mt-1 text-xs text-gray-500">内容库存量</div>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Queue</div>
                    <div className="mt-2 text-2xl font-bold text-gray-950">{queueSummary.queued + queueSummary.running}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {queueSummary.running > 0 ? `${queueSummary.running} 条执行中` : "当前无运行任务"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Completed</div>
                    <div className="mt-2 text-2xl font-bold text-gray-950">{queueSummary.done}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {queueSummary.failed > 0 ? `${queueSummary.failed} 条失败待处理` : "历史记录正常"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Connector</div>
                    <div className="mt-2 text-2xl font-bold text-gray-950">
                      {connectorOnline === null ? "..." : connectorOnline ? "Online" : "Offline"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">本机收据通道状态</div>
                  </div>
                </div>
              </section>

              <section className="grid gap-3">
                <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    当前模式说明
                  </div>
                  <div className="mt-3 text-sm leading-6 text-gray-600">
                    {dispatchMode === "dry-run"
                      ? "安全预演只生成平台版本和检查清单，不触发真实派发，适合先看文案结构和 CTA。"
                      : "自动发布会向已配置的 Webhook 发起请求。未配置的平台仍会生成结果，但会自动回退成手动发布清单。"}
                  </div>
                </div>
                <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Clock3 className="h-4 w-4 text-amber-500" />
                    推荐流程
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <div>1. 先选一份主稿，确认标题和正文是可发布版本。</div>
                    <div>2. 优先做预演，检查平台差异和输出口径。</div>
                    <div>3. 确认 Webhook 后再自动发布，并在右侧回看任务和收据。</div>
                  </div>
                </div>
              </section>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-5 xl:flex-row">
                <div className="xl:w-[380px] xl:shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">模式与平台</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        先切模式，再勾选这一轮真正要发的平台。当前优先接入的是 4 个高频平台。
                      </div>
                    </div>
                    <div
                      className={[
                        "rounded-xl border px-3 py-2 text-xs font-semibold",
                        connectorOnline === null
                          ? "border-gray-200 bg-gray-50 text-gray-600"
                          : connectorOnline
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700",
                      ].join(" ")}
                    >
                      Connector {connectorOnline === null ? "检测中" : connectorOnline ? "在线" : "离线"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDispatchMode("dry-run")}
                      className={[
                        "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                        dispatchMode === "dry-run"
                          ? "border-gray-950 bg-gray-950 text-white"
                          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      安全预演
                    </button>
                    <button
                      type="button"
                      onClick={() => setDispatchMode("dispatch")}
                      className={[
                        "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                        dispatchMode === "dispatch"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      自动发布（Webhook）
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open("http://127.0.0.1:8787/", "_blank", "noopener,noreferrer")}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      打开 Connector
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-gray-700">已选平台</div>
                      <div className="text-xs font-semibold text-gray-500">
                        {selectedPlatforms.length} / {supportedPlatformCount}
                      </div>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-gray-500">
                      当前平台范围：小红书、抖音、Instagram、TikTok。其他平台先保留信息位，后面可以平滑接入，不必重做界面结构。
                    </div>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                  {platforms.map((platform) => {
                    const checked = selectedPlatforms.includes(platform.id);
                    const conn = connByPlatform[platform.id];
                    const tokenOk = Boolean(conn?.token?.trim());
                    const webhookOk = Boolean(conn?.webhookUrl?.trim());
                    const supported = platform.supported !== false;
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => {
                          if (!supported) return;
                          togglePlatform(platform.id);
                        }}
                        className={[
                          "rounded-2xl border px-4 py-4 text-left transition-colors",
                          checked ? "border-emerald-200 bg-emerald-50" : "border-gray-200 hover:bg-gray-50",
                          supported ? "" : "cursor-not-allowed opacity-50",
                        ].join(" ")}
                        aria-pressed={checked}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900">{platform.name}</div>
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              supported
                                ? tokenOk
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-gray-200 bg-gray-50 text-gray-600",
                            ].join(" ")}
                          >
                            {supported ? (tokenOk ? "已授权" : "未授权") : "待接入"}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-xs text-gray-500">{platform.id}</div>
                        {supported ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                            <span
                              className={[
                                "rounded-full border px-2 py-0.5 font-semibold",
                                webhookOk
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-gray-200 bg-white text-gray-600",
                              ].join(" ")}
                            >
                              {webhookOk ? "Webhook" : "手动"}
                            </span>
                            {!webhookOk ? <span className="text-gray-500">填 Webhook 才能自动发布</span> : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">内容编辑区</div>
                      <div className="mt-1 text-xs leading-5 text-gray-500">
                        尽量把标题写成明确结论，把正文保留成一份主稿，然后再交给平台适配层做改写和检查。
                      </div>
                    </div>
                    {selectedDraft ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                        当前草稿：{selectedDraft.title}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                        新草稿
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">标题</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="例如：新品发布｜3 个技巧让转化翻倍"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">内容</label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="粘贴/编辑要发布的正文..."
                        className="h-56 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {workflowSource || workflowNextStep ? (
                    <div className="mt-4 rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#edfdf5_100%)] p-4">
                      <div className="text-sm font-semibold text-gray-900">内容流程上下文</div>
                      {workflowSource ? (
                        <div className="mt-3 text-sm leading-6 text-gray-700">
                          <span className="font-semibold text-gray-900">来源：</span>
                          {workflowSource}
                        </div>
                      ) : null}
                      {workflowNextStep ? (
                        <div className="mt-2 text-sm leading-6 text-gray-700">
                          <span className="font-semibold text-gray-900">建议动作：</span>
                          {workflowNextStep}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[24px] border border-gray-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          发布前智能检查
                        </div>
                        <div className="mt-1 text-xs leading-5 text-gray-500">
                          基于标题、正文、CTA、结构和平台匹配度给出快速建议，帮助你决定现在该预演还是直接发布。
                        </div>
                      </div>
                      <div
                        className={[
                          "self-start rounded-2xl border px-4 py-3 text-center",
                          publishInsights.score >= 84
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : publishInsights.score >= 70
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-red-200 bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">Readiness</div>
                        <div className="mt-1 text-2xl font-bold">{publishInsights.score}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {publishInsights.checks.map((item) => {
                        const meta = getChecklistStatusMeta(item.status);
                        return (
                          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                                <div className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</div>
                              </div>
                              <span
                                className={[
                                  "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                  meta.className,
                                ].join(" ")}
                              >
                                {meta.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)]">
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Platform Fit</div>
                        <div className="mt-3 space-y-2">
                          {publishInsights.platformAdvice.length === 0 ? (
                            <div className="text-sm text-gray-500">先选择平台，系统才会给出针对性建议。</div>
                          ) : (
                            publishInsights.platformAdvice.map((item) => {
                              const meta = getChecklistStatusMeta(item.status);
                              return (
                                <div
                                  key={item.platform}
                                  className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-mono text-xs font-semibold text-gray-900">{item.platform}</div>
                                      <div className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</div>
                                    </div>
                                    <span
                                      className={[
                                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                        meta.className,
                                      ].join(" ")}
                                    >
                                      {meta.label}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void generatePlatformVariant(item.platform);
                                      }}
                                      disabled={!body.trim() || rewritingPlatform === item.platform}
                                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      {rewritingPlatform === item.platform ? "生成中..." : "生成平台版"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPlatforms([item.platform]);
                                        setDispatchMode("dry-run");
                                        setActionTone("success");
                                        setActionMessage(`已切换到 ${getPlatformLabel(item.platform)} 预演模式`);
                                      }}
                                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      只预演该平台
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Recommended Move</div>
                        <div className="mt-3 flex items-start gap-3">
                          {publishInsights.score >= 70 ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          )}
                          <div className="text-sm leading-6 text-gray-700">{publishInsights.recommendation}</div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs leading-5 text-gray-600">
                          小技巧：如果你是从 Content Repurposer 送过来的，先挑最适合当前平台的一块单独预演，通常比整包直接发更稳。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    本轮动作
                  </div>

                  <div className="mt-3 space-y-3 text-sm text-gray-600">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Mode</div>
                      <div className="mt-1 font-semibold text-gray-900">{getModeLabel(dispatchMode)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Platforms</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {selectedPlatforms.length > 0 ? selectedPlatforms.join(", ") : "未选择"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Notes</div>
                      <div className="mt-1 leading-6">
                        {dispatchMode === "dispatch"
                          ? "自动发布依赖平台 Webhook；未配置的平台仍会产出建议，但不会自动派发。"
                          : "预演不会真实外发，更适合先确认标题、结构和平台差异。"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={saveCurrent}
                      disabled={!body.trim()}
                      className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void dispatch();
                      }}
                      disabled={!body.trim() || selectedPlatforms.length === 0}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dispatchMode === "dry-run" ? "预演发布" : "自动发布"}
                    </button>
                  </div>

                  {isDispatching ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      队列正在执行中，新任务会继续排队。
                    </div>
                  ) : null}

                  {dispatchMode === "dispatch" &&
                  selectedPlatforms.some((platform) => !connByPlatform[platform]?.webhookUrl?.trim()) ? (
                    <>
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        部分平台未配置 Webhook，将回退为手动发布清单。
                      </div>
                      <button
                        type="button"
                        onClick={() => requestOpenSettings("matrix")}
                        className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                      >
                        去配置 Webhook
                      </button>
                    </>
                  ) : null}

                  {selectedDraft ? (
                    <button
                      type="button"
                      onClick={() => {
                        removeDraft(selectedDraft.id);
                        setSelectedId(null);
                        setTitle("");
                        setBody("");
                        setWorkflowSource("");
                        setWorkflowNextStep("");
                        setResultText("");
                        setLastResults(null);
                      }}
                      className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      删除草稿
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
              <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">结果与说明</div>
                    <div className="mt-1 text-xs leading-5 text-gray-500">
                      这里显示当前选中任务的模式、状态、重试信息，以及平台输出和返回说明。
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedJob ? (
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-[11px] font-semibold",
                          getJobStatusMeta(selectedJob.status).className,
                        ].join(" ")}
                      >
                        {getJobStatusMeta(selectedJob.status).label}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void refreshJobsPanel();
                      }}
                      disabled={jobsRefreshing}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className={["h-3.5 w-3.5", jobsRefreshing ? "animate-spin" : ""].join(" ")} />
                      刷新
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void copySelectedResult();
                      }}
                      disabled={!resultText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制结果
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedJob) return;
                        void replayJob(selectedJob);
                      }}
                      disabled={!selectedJob || !canReplaySelectedJob || jobActionId === selectedJob?.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {selectedJob?.status === "done" ? "再次执行" : "重新排队"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedJob) return;
                        void deleteJob(selectedJob);
                      }}
                      disabled={!selectedJob || !canDeleteSelectedJob || jobActionId === selectedJob?.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除任务
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-gray-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-4">
                  {selectedJob ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700">
                          {getModeLabel(selectedJob.mode)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700">
                          attempts {selectedJob.attempts ?? 0}/{selectedJob.maxAttempts ?? 3}
                        </span>
                        {selectedJob.nextAttemptAt ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                            {formatRetry(selectedJob.nextAttemptAt)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-base font-semibold text-gray-950">{selectedJob.draftTitle}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {selectedJob.platforms.join(", ")} · 更新于 {formatTime(selectedJob.updatedAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm leading-6 text-gray-500">
                      还没有选中记录。先发起一次预演，或者从右侧记录列表里点开一条任务。
                    </div>
                  )}
                </div>

                {actionMessage ? (
                  <div
                    className={[
                      "mt-3 rounded-2xl px-3 py-2 text-xs font-medium",
                      actionTone === "success"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-red-200 bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {actionMessage}
                  </div>
                ) : null}

                {selectedJob?.draftBody?.trim() ? (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-gray-700">任务快照</div>
                      <div className="text-[11px] text-gray-500">执行时使用的正文副本</div>
                    </div>
                    <div className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl bg-gray-50 px-3 py-3 text-[11px] leading-relaxed text-gray-700">
                      {selectedJob.draftBody}
                    </div>
                  </div>
                ) : null}

                {selectedJob && !selectedJob.draftBody?.trim() ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                    这条历史任务没有正文快照，不能直接重新执行。先回到草稿区重新保存并发起新任务更安全。
                  </div>
                ) : null}

                {lastResults && lastResults.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-700">平台执行结果</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {lastResults.map((result) => (
                        <div
                          key={`${result.platform}:${result.mode}`}
                          className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-mono text-gray-700">{result.platform}</span>
                            <span className="text-gray-500">{result.mode}</span>
                            <span
                              className={[
                                "rounded-full border px-2 py-0.5 font-semibold",
                                result.ok
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-red-200 bg-red-50 text-red-700",
                              ].join(" ")}
                            >
                              {result.ok ? "OK" : "ERR"}
                              {typeof result.status === "number" ? ` ${result.status}` : ""}
                            </span>
                          </div>
                          {result.error ? (
                            <div className="mt-2 text-[11px] leading-5 text-red-700">{result.error}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 min-h-[260px] rounded-[24px] border border-gray-200 bg-gray-50 p-4">
                  {resultText ? (
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800">{resultText}</pre>
                  ) : (
                    <div className="text-sm leading-6 text-gray-500">
                      这里会显示平台改写结果、检查清单或发布返回信息。推荐先做一次预演，把输出口径确认后再切到自动发布。
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">发布记录</div>
                        <div className="mt-1 text-xs text-gray-500">
                          共 {jobs.length} 条任务，当前筛选后 {filteredJobs.length} 条。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestOpenApp("task_manager")}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                      >
                        打开任务调度
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {jobFilters.map((filter) => {
                        const active = filter.id === jobFilter;
                        const count =
                          filter.id === "all"
                            ? jobs.length
                            : filter.id === "active"
                              ? queueSummary.queued + queueSummary.running
                              : filter.id === "failed"
                                ? queueSummary.failed
                                : queueSummary.done;
                        return (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setJobFilter(filter.id)}
                            className={[
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                              active
                                ? "border-gray-950 bg-gray-950 text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            {filter.label} · {count}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 max-h-[340px] overflow-auto">
                    {filteredJobs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                        当前筛选下还没有任务。可以先发起一次预演，或者切换到其他筛选查看历史记录。
                      </div>
                    ) : (
                      filteredJobs.slice(0, 30).map((job) => {
                        const selected = job.id === selectedJobId;
                        const statusMeta = getJobStatusMeta(job.status);
                        const okCount = job.results?.filter((result) => result.ok).length ?? 0;
                        const totalCount = job.results?.length ?? 0;
                        return (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => setSelectedJobId(job.id)}
                            className={[
                              "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                              selected
                                ? "border-emerald-200 bg-emerald-50/70 shadow-sm"
                                : "border-gray-200 bg-white hover:bg-gray-50",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-gray-900">{job.draftTitle}</div>
                                <div className="mt-1 text-xs text-gray-500">{job.platforms.join(", ")}</div>
                              </div>
                              <span
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                  statusMeta.className,
                                ].join(" ")}
                              >
                                {statusMeta.label}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 font-semibold text-gray-700">
                                {getModeLabel(job.mode)}
                              </span>
                              <span>attempts {job.attempts ?? 0}/{job.maxAttempts ?? 3}</span>
                              {totalCount > 0 ? <span>{okCount}/{totalCount} 平台成功</span> : null}
                            </div>
                            <div className="mt-2 text-[11px] text-gray-500">
                              更新于 {formatTime(job.updatedAt)}
                              {job.nextAttemptAt ? ` · ${formatRetry(job.nextAttemptAt)}` : ""}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ShieldCheck className="h-4 w-4 text-gray-700" />
                    Connector 收据（本机）
                  </div>
                  <div className="mt-2 text-xs leading-5 text-gray-500">
                    这里读取示例 Connector 的 `jobs.jsonl`。最适合用来确认自动发布请求有没有真正送到接收端。
                  </div>
                  <div className="mt-3 space-y-2 max-h-[220px] overflow-auto">
                    {connectorJobs === null ? (
                      <div className="text-xs text-gray-500">
                        {connectorOnline ? "暂无数据" : "Connector 未运行或不可达"}
                      </div>
                    ) : connectorJobs.length === 0 ? (
                      <div className="text-xs text-gray-500">暂无收据</div>
                    ) : (
                      connectorJobs.map((job) => (
                        <div
                          key={String(job.id)}
                          className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                        >
                          <div className="truncate font-mono text-xs text-gray-700">
                            {String(job.platform)} · {String(job.id)}
                          </div>
                          <div className="mt-1 truncate text-xs text-gray-600">{String(job.title || "")}</div>
                          <div className="mt-1 text-[11px] text-gray-500">{String(job.receivedAt || "")}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
