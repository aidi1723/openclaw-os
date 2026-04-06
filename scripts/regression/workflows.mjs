import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function moduleUrl(relativePath) {
  return pathToFileURL(path.join(PROJECT_ROOT, relativePath)).href;
}

class MemoryStorage {
  #store = new Map();

  getItem(key) {
    return this.#store.has(key) ? this.#store.get(key) : null;
  }

  setItem(key, value) {
    this.#store.set(String(key), String(value));
  }

  removeItem(key) {
    this.#store.delete(key);
  }

  clear() {
    this.#store.clear();
  }
}

class ThrowingStorage {
  getItem() {
    throw new Error("Storage read failed");
  }

  setItem() {
    throw new Error("Storage write failed");
  }

  removeItem() {
    throw new Error("Storage remove failed");
  }
}

function installBrowserStub() {
  const localStorage = new MemoryStorage();
  const eventTarget = new EventTarget();
  const windowStub = {
    localStorage,
    dispatchEvent: (event) => eventTarget.dispatchEvent(event),
    addEventListener: (...args) => eventTarget.addEventListener(...args),
    removeEventListener: (...args) => eventTarget.removeEventListener(...args),
  };
  globalThis.window = windowStub;
  globalThis.localStorage = localStorage;
  return localStorage;
}

function resetBrowserState(localStorage) {
  localStorage.clear();
}

function logSection(title) {
  console.log(`\n[workflow-regression] ${title}`);
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compareWorkflowRunPriority(left, right) {
  if ((left?.createdAt ?? 0) !== (right?.createdAt ?? 0)) {
    return (left?.createdAt ?? 0) - (right?.createdAt ?? 0);
  }
  if ((left?.updatedAt ?? 0) !== (right?.updatedAt ?? 0)) {
    return (left?.updatedAt ?? 0) - (right?.updatedAt ?? 0);
  }
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""), "en");
}

async function runSalesAndKnowledgeRegression(localStorage) {
  logSection("sales + knowledge asset");
  resetBrowserState(localStorage);

  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const salesWorkflow = await import(moduleUrl("src/lib/sales-workflow.ts"));
  const deals = await import(moduleUrl("src/lib/deals.ts"));
  const knowledgeAssets = await import(moduleUrl("src/lib/knowledge-assets.ts"));
  const reuse = await import(moduleUrl("src/lib/knowledge-asset-reuse.ts"));

  const salesScenario = salesWorkflow.getSalesWorkflowScenario();
  assert(salesScenario, "Sales workflow scenario should exist.");

  const runId = workflowRuns.startWorkflowRun(salesScenario, "web_form");
  const dealId = deals.createDeal({
    company: "Aventra Windows",
    contact: "Lena",
    inquiryChannel: "WhatsApp",
    preferredLanguage: "English",
    productLine: "Thermal Aluminum Door",
    need: "Need a fast quote for UAE project",
    budget: "USD 25k",
    timing: "30 days",
    workflowRunId: runId,
    workflowScenarioId: salesScenario.id,
    workflowStageId: "qualify",
    workflowSource: "Regression sales lead intake",
    workflowNextStep: "Qualify and draft outreach",
    workflowTriggerType: "web_form",
  });

  deals.updateDeal(dealId, {
    stage: "qualified",
    brief: "Priority lead with clear delivery window.",
    reviewNotes: "Approved for outreach.",
  });

  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  const completedRun = workflowRuns.completeWorkflowRun(runId);
  assert.equal(completedRun?.state, "completed", "Sales workflow should complete.");

  const latestDeal = deals.getDeals()[0];
  assert.equal(latestDeal?.id, dealId, "Latest deal should match created lead.");
  assert.equal(latestDeal?.stage, "qualified", "Sales deal should preserve qualified stage.");
  assert.equal(latestDeal?.workflowRunId, runId, "Sales deal should keep workflow metadata.");

  const salesAsset = knowledgeAssets.upsertKnowledgeAsset(`sales-${runId}`, {
    title: "Aventra Windows · 跟进资产",
    body:
      "公司：Aventra Windows\n联系人：Lena\n来源：WhatsApp\n语言：English\n产品线：Thermal Aluminum Door\n预算：USD 25k\n时间：30 days\n\n【客户画像与偏好】\n偏好快节奏英文沟通\n\n【有效跟进策略】\n48 小时内给出价格框架和交期说明\n\n【下次可复用模板】\n先确认项目阶段，再发报价框架",
    sourceApp: "personal_crm",
    scenarioId: salesScenario.id,
    workflowRunId: runId,
    assetType: "sales_playbook",
    status: "active",
    tags: ["sales", "uae"],
    applicableScene: "门窗外贸报价推进",
  });

  const beforeReuse = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === salesAsset.id);
  assert.equal(beforeReuse?.reuseCount, 0, "New sales asset should start with zero reuse count.");

  const prefill = reuse.buildDealDeskPrefillFromKnowledgeAsset(salesAsset);
  const afterPrefill = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === salesAsset.id);
  assert.equal(afterPrefill?.reuseCount, 0, "Building a sales prefill should not mutate reuse count.");
  assert.equal(prefill.company, "Aventra Windows", "Sales prefill should parse company.");
  assert.equal(prefill.contact, "Lena", "Sales prefill should parse contact.");
  assert.match(prefill.workflowNextStep ?? "", /复用已沉淀销售打法/, "Sales prefill should include workflow next step.");

  knowledgeAssets.incrementKnowledgeAssetReuse(salesAsset.id);
  const afterIncrement = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === salesAsset.id);
  assert.equal(afterIncrement?.reuseCount, 1, "Explicit reuse increment should update reuse count.");

  console.log("sales workflow and sales asset regression passed");
}

async function runSupportAndKnowledgeRegression(localStorage) {
  logSection("support + knowledge asset");
  resetBrowserState(localStorage);

  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const supportWorkflow = await import(moduleUrl("src/lib/support-workflow.ts"));
  const support = await import(moduleUrl("src/lib/support.ts"));
  const knowledgeAssets = await import(moduleUrl("src/lib/knowledge-assets.ts"));
  const reuse = await import(moduleUrl("src/lib/knowledge-asset-reuse.ts"));

  const supportScenario = supportWorkflow.getSupportWorkflowScenario();
  assert(supportScenario, "Support workflow scenario should exist.");

  const runId = workflowRuns.startWorkflowRun(supportScenario, "manual");
  const ticketId = support.createSupportTicket({
    customer: "Nora",
    channel: "whatsapp",
    subject: "Broken hinge on delivery",
    message: "The hinge is damaged and customer requests replacement.",
    workflowRunId: runId,
    workflowScenarioId: supportScenario.id,
    workflowStageId: "capture",
    workflowSource: "Regression support intake",
    workflowNextStep: "Draft reply and define escalation boundary",
    workflowTriggerType: "manual",
  });

  support.updateSupportTicket(ticketId, {
    status: "waiting",
    replyDraft: "We will ship a replacement hinge within 48 hours.",
    reviewNotes: "Needs warranty boundary note.",
  });

  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  const completedRun = workflowRuns.completeWorkflowRun(runId);
  assert.equal(completedRun?.state, "completed", "Support workflow should complete.");

  const latestTicket = support.getSupportTickets()[0];
  assert.equal(latestTicket?.id, ticketId, "Latest support ticket should match created ticket.");
  assert.equal(latestTicket?.status, "waiting", "Support ticket should preserve updated status.");
  assert.equal(latestTicket?.workflowRunId, runId, "Support ticket should keep workflow metadata.");

  const supportAsset = knowledgeAssets.upsertKnowledgeAsset(`support-${runId}`, {
    title: "Broken hinge after delivery · FAQ 资产",
    body:
      "客户：Nora\n渠道：WhatsApp\n主题：Broken hinge after delivery\n问题摘要：Damaged hinge after installation\n\n【标准回复】\nWe will ship a replacement hinge and share the tracking number.\n\n【升级边界】\nIf damage includes frame deformation, escalate to after-sales engineer.\n\n【需要补充的信息】\n需要订单号和现场图片",
    sourceApp: "support_copilot",
    scenarioId: supportScenario.id,
    workflowRunId: runId,
    assetType: "support_faq",
    status: "active",
    tags: ["support", "after-sales"],
    applicableScene: "售后五金损坏处理",
  });

  const prefill = reuse.buildSupportPrefillFromKnowledgeAsset(supportAsset);
  assert.equal(prefill.channel, "whatsapp", "Support prefill should parse channel.");
  assert.match(prefill.replyDraft ?? "", /replacement hinge/i, "Support prefill should parse reply draft.");
  assert.match(prefill.workflowNextStep ?? "", /已沉淀边界处理/, "Support prefill should include escalation guidance.");

  knowledgeAssets.setKnowledgeAssetStatus(supportAsset.id, "archived");
  const archivedAsset = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === supportAsset.id);
  assert.equal(archivedAsset?.status, "archived", "Support asset should support archive transitions.");

  console.log("support workflow and FAQ asset regression passed");
}

async function runCreatorWorkflowHandoffRegression(localStorage) {
  logSection("creator workflow handoff");
  resetBrowserState(localStorage);

  const drafts = await import(moduleUrl("src/lib/drafts.ts"));
  const creatorWorkflow = await import(moduleUrl("src/lib/creator-workflow.ts"));
  const draftStore = await import(moduleUrl("src/lib/server/draft-store.ts"));
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-creator-handoff-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const meta = creatorWorkflow.buildCreatorWorkflowMeta({
      workflowRunId: "creator-run-1",
      workflowScenarioId: "creator-studio",
      workflowStageId: "preflight",
      workflowSource: "  来自 Content Repurposer 的发布候选稿  ",
      workflowNextStep: "  先做预演，再决定是否自动发布。  ",
      workflowTriggerType: "manual",
      workflowOriginApp: "content_repurposer",
      workflowOriginId: "project-1",
      workflowOriginLabel: "  春季窗品选题  ",
      workflowAudience: "  外贸门窗采购负责人  ",
      workflowPrimaryAngle: "  先讲成交案例，再讲三步检查法  ",
      workflowSourceSummary: "  这是一条从长内容拆出的短视频版本。  ",
      workflowBlockLabel: "  短视频口播  ",
      workflowSuggestedPlatforms: ["douyin", "xiaohongshu", "douyin"],
      workflowPublishNotes: "  建议保留数字 hook 和评论 CTA。  ",
    });

    const draftId = drafts.createDraft({
      title: "春季窗品选题 · 抖音版",
      body: "前三秒先讲成交案例，再落到检查清单。",
      tags: ["publish-ready", "douyin"],
      source: "import",
      ...meta,
    });
    const latestDraft = drafts.getDrafts().find((draft) => draft.id === draftId);
    assert(latestDraft, "Creator workflow draft should be created.");
    assert.equal(
      latestDraft?.workflowOriginApp,
      "content_repurposer",
      "Creator workflow draft should preserve origin app.",
    );
    assert.equal(
      latestDraft?.workflowOriginLabel,
      "春季窗品选题",
      "Creator workflow meta should trim origin label.",
    );
    assert.deepEqual(
      latestDraft?.workflowSuggestedPlatforms,
      ["douyin", "xiaohongshu"],
      "Creator workflow meta should dedupe suggested platforms.",
    );
    assert.equal(
      latestDraft?.workflowPublishNotes,
      "建议保留数字 hook 和评论 CTA。",
      "Creator workflow meta should trim publish notes.",
    );

    const stored = await draftStore.upsertDraftInStore(latestDraft);
    assert.equal(
      stored.draft?.workflowBlockLabel,
      "短视频口播",
      "Draft store should persist workflow block labels.",
    );
    assert.equal(
      stored.draft?.workflowSourceSummary,
      "这是一条从长内容拆出的短视频版本。",
      "Draft store should persist workflow source summary.",
    );

    const snapshot = await draftStore.listDraftStoreSnapshot();
    const persistedDraft = snapshot.drafts.find((draft) => draft.id === draftId);
    assert.equal(
      persistedDraft?.workflowAudience,
      "外贸门窗采购负责人",
      "Draft store snapshot should preserve creator workflow audience.",
    );

    console.log("creator workflow handoff regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runCreatorPublishFeedbackRegression() {
  logSection("creator publish feedback");

  const feedback = await import(moduleUrl("src/lib/creator-publish-feedback.ts"));
  const creatorAssetStore = await import(moduleUrl("src/lib/server/creator-asset-store.ts"));

  const summary = feedback.buildCreatorPublishFeedback({
    draftTitle: "3 步检查内容发布闭环",
    draftBody: "先讲结果，再给三步清单。\n最后提醒评论区领取模板。",
    dispatchMode: "dispatch",
    jobStatus: "done",
    publishTargets: ["douyin", "xiaohongshu"],
    primaryAngle: "先给结果，再拆步骤",
    blockLabel: "短视频口播",
    publishNotes: "保留数字 hook 和 CTA",
    results: [
      {
        platform: "douyin",
        ok: true,
        mode: "webhook",
        queued: true,
        retryable: true,
        receiptId: "receipt-1",
      },
      {
        platform: "xiaohongshu",
        ok: false,
        mode: "webhook",
        errorType: "auth",
        retryable: false,
        error: "token expired",
      },
    ],
    reviewedAt: 1_710_000_000_000,
  });

  assert.equal(summary.publishStatus, "dispatch_done", "Creator publish feedback should derive publish status.");
  assert.equal(summary.latestPublishFeedback, "已接收: douyin | 失败: xiaohongshu | 可重试: douyin", "Structured feedback should summarize platform outcomes.");
  assert.deepEqual(summary.successfulPlatforms, ["douyin"], "Structured feedback should expose successful platforms.");
  assert.deepEqual(summary.failedPlatforms, ["xiaohongshu"], "Structured feedback should expose failed platforms.");
  assert.deepEqual(summary.retryablePlatforms, ["douyin"], "Structured feedback should expose retryable platforms.");
  assert.equal(summary.lastReviewedAt, 1_710_000_000_000, "Structured feedback should preserve the review timestamp.");
  assert.match(summary.nextAction, /复盘有效结构/, "Done publish feedback should point back to reuse review.");
  assert.match(summary.reuseNotes, /短视频口播/, "Reuse notes should preserve the content block label.");
  assert.match(summary.reuseNotes, /收据 receipt-1/, "Reuse notes should include successful connector receipts.");
  assert.match(summary.reuseNotes, /token expired/, "Reuse notes should include failure details.");
  assert.match(summary.reuseNotes, /先修复授权/, "Reuse notes should include auth repair guidance.");

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "creator-asset-feedback-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const stored = await creatorAssetStore.upsertCreatorAssetInStore({
      id: "creator-asset-1",
      workflowRunId: "creator-run-1",
      scenarioId: "creator-studio",
      topic: "春季窗品选题",
      latestDraftTitle: "3 步检查内容发布闭环",
      publishTargets: ["douyin", "xiaohongshu"],
      publishStatus: summary.publishStatus,
      latestPublishFeedback: summary.latestPublishFeedback,
      successfulPlatforms: summary.successfulPlatforms,
      failedPlatforms: summary.failedPlatforms,
      retryablePlatforms: summary.retryablePlatforms,
      nextAction: summary.nextAction,
      reuseNotes: summary.reuseNotes,
      lastReviewedAt: summary.lastReviewedAt,
      status: "publishing",
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_000_123,
    });
    assert.equal(stored.accepted, true, "Creator asset store should accept structured feedback fields.");
    assert.equal(stored.creatorAsset?.latestPublishFeedback, summary.latestPublishFeedback, "Creator asset store should persist latest feedback summary.");

    const snapshot = await creatorAssetStore.listCreatorAssetStoreSnapshot();
    assert.deepEqual(snapshot.creatorAssets[0]?.successfulPlatforms, ["douyin"], "Creator asset snapshot should preserve successful platforms.");
    assert.deepEqual(snapshot.creatorAssets[0]?.retryablePlatforms, ["douyin"], "Creator asset snapshot should preserve retryable platforms.");
    assert.equal(snapshot.creatorAssets[0]?.lastReviewedAt, 1_710_000_000_000, "Creator asset snapshot should preserve review timestamps.");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log("creator publish feedback regression passed");
}

async function runCreatorAssetQueryRegression() {
  logSection("creator asset query");

  const creatorAssetQuery = await import(moduleUrl("src/lib/creator-asset-query.ts"));

  const baseAsset = {
    scenarioId: "creator-studio",
    topic: "春季窗品选题",
    audience: "采购负责人",
    sourceChannels: "wechat",
    primaryAngle: "先给结果再给步骤",
    latestDigest: "",
    latestPack: "",
    latestDraftTitle: "",
    latestDraftBody: "",
    publishTargets: [],
    publishStatus: "not_started",
    latestPublishFeedback: "",
    successfulPlatforms: [],
    failedPlatforms: [],
    retryablePlatforms: [],
    nextAction: "",
    reuseNotes: "",
    status: "completed",
    createdAt: 10,
    updatedAt: 10,
  };

  const items = [
    {
      ...baseAsset,
      id: "creator-a",
      workflowRunId: "run-a",
      publishTargets: ["douyin"],
      publishStatus: "dispatch_done",
      latestPublishFeedback: "已接收: douyin",
      successfulPlatforms: ["douyin"],
      lastReviewedAt: 300,
      updatedAt: 400,
    },
    {
      ...baseAsset,
      id: "creator-b",
      workflowRunId: "run-b",
      publishTargets: ["xiaohongshu"],
      publishStatus: "dispatch_error",
      latestPublishFeedback: "失败: xiaohongshu | 可重试: xiaohongshu",
      failedPlatforms: ["xiaohongshu"],
      retryablePlatforms: ["xiaohongshu"],
      status: "publishing",
      lastReviewedAt: 500,
      updatedAt: 350,
    },
    {
      ...baseAsset,
      id: "creator-c",
      workflowRunId: "run-c",
      publishTargets: ["instagram"],
      publishStatus: "dispatch_queued",
      latestPublishFeedback: "任务已进入发布队列",
      status: "publishing",
      updatedAt: 450,
    },
  ];

  const successful = creatorAssetQuery.queryCreatorAssets(items, {
    filter: "successful",
  });
  assert.deepEqual(successful.map((item) => item.id), ["creator-a"], "Successful filter should only keep assets with successful platforms.");

  const retryable = creatorAssetQuery.queryCreatorAssets(items, {
    filter: "retryable",
  });
  assert.deepEqual(retryable.map((item) => item.id), ["creator-b"], "Retryable filter should only keep retryable assets.");

  const inFlight = creatorAssetQuery.queryCreatorAssets(items, {
    filter: "in_flight",
    sort: "updated",
  });
  assert.deepEqual(inFlight.map((item) => item.id), ["creator-c", "creator-b"], "In-flight filter should keep queued or publishing assets ordered by recent update.");

  const platformFiltered = creatorAssetQuery.queryCreatorAssets(items, {
    platform: "xiaohongshu",
    sort: "reviewed",
  });
  assert.deepEqual(platformFiltered.map((item) => item.id), ["creator-b"], "Platform filter should match publish targets and structured feedback platforms.");

  const successSignal = creatorAssetQuery.queryCreatorAssets(items, {
    sort: "success_signal",
  });
  assert.deepEqual(successSignal.map((item) => item.id), ["creator-a", "creator-b", "creator-c"], "Success signal sort should prioritize more successful platforms.");

  const retryPriority = creatorAssetQuery.queryCreatorAssets(items, {
    sort: "retry_priority",
  });
  assert.deepEqual(retryPriority.map((item) => item.id), ["creator-b", "creator-a", "creator-c"], "Retry priority sort should surface retryable assets first.");

  console.log("creator asset query regression passed");
}

async function runCreatorAssetQueryRouteRegression() {
  logSection("creator asset query route");

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "creator-asset-query-route-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const creatorAssetStore = await import(moduleUrl("src/lib/server/creator-asset-store.ts"));
    const route = await import(moduleUrl("src/app/api/runtime/state/creator-assets/query/route.ts"));

    await creatorAssetStore.upsertCreatorAssetInStore({
      id: "creator-route-1",
      workflowRunId: "creator-route-run-1",
      scenarioId: "creator-studio",
      topic: "抖音三步成交内容",
      latestDraftTitle: "抖音成交脚本",
      publishTargets: ["douyin"],
      publishStatus: "dispatch_done",
      latestPublishFeedback: "已接收: douyin",
      successfulPlatforms: ["douyin"],
      failedPlatforms: [],
      retryablePlatforms: [],
      nextAction: "复盘短视频 hook",
      reuseNotes: "保留数字 hook",
      status: "completed",
      createdAt: 100,
      updatedAt: 200,
    });
    await creatorAssetStore.upsertCreatorAssetInStore({
      id: "creator-route-2",
      workflowRunId: "creator-route-run-2",
      scenarioId: "creator-studio",
      topic: "小红书图文复盘",
      latestDraftTitle: "图文版本",
      publishTargets: ["xiaohongshu"],
      publishStatus: "dispatch_error",
      latestPublishFeedback: "失败: xiaohongshu | 可重试: xiaohongshu",
      successfulPlatforms: [],
      failedPlatforms: ["xiaohongshu"],
      retryablePlatforms: ["xiaohongshu"],
      nextAction: "修复授权再重试",
      reuseNotes: "保留图文分段结构",
      status: "publishing",
      createdAt: 110,
      updatedAt: 300,
    });

    const response = await route.POST(
      new Request("http://localhost/api/runtime/state/creator-assets/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: "图文",
          platform: "xiaohongshu",
          sort: "retry_priority",
          limit: 4,
        }),
      }),
    );
    const payload = await response.json();
    assert.equal(response.status, 200, "Creator asset query route should succeed for valid requests.");
    assert.equal(payload?.ok, true, "Creator asset query route should return ok=true.");
    assert.deepEqual(
      payload?.data?.creatorAssets?.map((item) => item.id),
      ["creator-route-2"],
      "Creator asset query route should combine keyword, platform and sort filters.",
    );

    const invalidResponse = await route.POST(
      new Request("http://localhost/api/runtime/state/creator-assets/query", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "bad-body",
      }),
    );
    assert.equal(invalidResponse.status, 415, "Creator asset query route should reuse JSON body guards.");

    console.log("creator asset query route regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runKnowledgeReuseSourceGuard() {
  logSection("knowledge vault source guard");
  const file = path.join(PROJECT_ROOT, "src", "components", "apps", "KnowledgeVaultAppWindow.tsx");
  const source = await readFile(file, "utf8");
  const anchor = source.indexOf("一键复用");
  assert(anchor >= 0, "Knowledge Vault one-click reuse button should exist.");
  const oneClickBlock = source.slice(Math.max(0, anchor - 500), anchor + 500);
  assert(!/incrementKnowledgeAssetReuse\(asset\.id\)/.test(oneClickBlock), "One-click reuse should not increment reuse count directly.");
  assert(/标记已复用/.test(source), "Explicit reuse marker button should remain available.");
  console.log("knowledge vault one-click reuse guard passed");
}

async function runVaultHybridContextRegression() {
  logSection("vault hybrid context");

  const routeFile = path.join(
    PROJECT_ROOT,
    "src",
    "app",
    "api",
    "openclaw",
    "vault",
    "query",
    "route.ts",
  );
  const appFile = path.join(
    PROJECT_ROOT,
    "src",
    "components",
    "apps",
    "KnowledgeVaultAppWindow.tsx",
  );

  const routeSource = await readFile(routeFile, "utf8");
  const appSource = await readFile(appFile, "utf8");

  assert.match(routeSource, /知识资产：\\n\$\{knowledgeList/, "Vault query route should include knowledge asset context.");
  assert.match(routeSource, /Creator 内容资产：\\n\$\{creatorList/, "Vault query route should include creator asset context.");
  assert.match(routeSource, /知识库混合检索助手/, "Vault query route should describe the new hybrid retrieval role.");

  assert.match(appSource, /knowledgeAssets:\s*knowledgeContext/, "Knowledge Vault app should send knowledge asset context.");
  assert.match(appSource, /creatorAssets:\s*creatorContext/, "Knowledge Vault app should send creator asset context.");
  assert.match(appSource, /activeFolder === "social_assets"/, "Knowledge Vault app should only attach creator context inside social assets.");
  assert.match(appSource, /structuredAnswer/, "Knowledge Vault app should consume structured vault results.");
  assert.match(
    appSource,
    /RecommendationResultBody/,
    "Knowledge Vault app should render structured recommendation results through the shared body component.",
  );

  console.log("vault hybrid context regression passed");
}

async function runVaultMixedQueryRegression() {
  logSection("vault mixed query");

  const vaultMixedQuery = await import(moduleUrl("src/lib/vault-mixed-query.ts"));

  const result = vaultMixedQuery.buildVaultMixedQueryStructuredResult({
    query: "抖音 hook 复盘",
    files: [
      {
        id: "file-1",
        folderId: "social_assets",
        name: "抖音脚本清单.md",
        size: 2048,
        addedAt: 100,
      },
    ],
    knowledgeAssets: [
      {
        id: "knowledge-1",
        title: "销售 FAQ 模板",
        assetType: "sales_playbook",
        status: "active",
        applicableScene: "报价异议处理",
        body: "适合销售流程，不是内容复盘。",
      },
    ],
    creatorAssets: [
      {
        id: "creator-1",
        topic: "抖音三步成交复盘",
        primaryAngle: "先给结果再给 hook",
        publishStatus: "dispatch_done",
        latestPublishFeedback: "已接收: douyin",
        nextAction: "回到 Publisher 复盘 hook",
        publishTargets: ["douyin"],
        successfulPlatforms: ["douyin"],
        retryablePlatforms: [],
        jumpTarget: {
          kind: "publisher",
          prefill: {
            draftId: "draft-1",
            workflowRunId: "run-1",
            workflowScenarioId: "creator-studio",
          },
        },
      },
    ],
  });

  assert.equal(result.contractVersion, "v1", "Mixed vault query should expose the recommendation contract version.");
  assert.equal(
    result.sections.find((section) => section.id === "creator_assets")?.hits[0]?.id,
    "creator-1",
    "Mixed vault query should rank creator assets inside generic sections.",
  );
  assert.equal(result.recommendedAction.kind, "resume_creator_workflow", "Mixed vault query should recommend resuming creator workflow when creator assets dominate.");
  assert.equal(result.recommendedAction.jumpTarget?.kind, "publisher", "Mixed vault query should surface a jump target for creator workflow resume.");

  console.log("vault mixed query regression passed");
}

async function runPublishRecommendationRegression() {
  logSection("publish recommendation");

  const publishRecommendation = await import(moduleUrl("src/lib/publish-recommendation.ts"));

  const risky = publishRecommendation.analyzePublishReadiness({
    title: "短标题",
    body: "只有一句，没有 CTA。",
    platforms: ["douyin", "xiaohongshu"],
    dispatchMode: "dispatch",
    connections: {
      douyin: { token: "a", webhookUrl: "" },
      xiaohongshu: { token: "b", webhookUrl: "" },
    },
  });
  assert.equal(risky.recommendationResult.contractVersion, "v1", "Publish recommendation should expose the shared recommendation contract.");
  assert.equal(risky.recommendationResult.recommendedAction.kind, "improve_copy", "Risky publish inputs should recommend fixing copy/config first.");
  assert.equal(risky.recommendationResult.sections.length, 2, "Publish recommendation should expose checklist and platform sections.");
  assert.equal(risky.recommendationResult.sections[0]?.id, "publish_checks", "Publish recommendation should expose publish checks as a generic section.");

  const ready = publishRecommendation.analyzePublishReadiness({
    title: "3 步把抖音口播改到可发布",
    body: "先讲结果。\n再给三步清单。\n最后评论区领取模板。 #抖音 #内容运营",
    platforms: ["douyin"],
    dispatchMode: "dry-run",
    connections: {
      douyin: { token: "a", webhookUrl: "https://example.com/hook" },
    },
  });
  assert.equal(ready.recommendationResult.recommendedAction.kind, "run_dry_run", "Healthy copy in dry-run mode should recommend preflight preview.");
  assert(
    ready.recommendationResult.sections.some((section) => section.id === "platform_fit" && section.hits.length > 0),
    "Publish recommendation should surface platform-fit hits in the shared section model.",
  );

  console.log("publish recommendation regression passed");
}

async function runWorkflowSurfaceRecommendationRegression() {
  logSection("workflow surface recommendation");

  const helper = await import(moduleUrl("src/lib/workflow-surface-recommendation.ts"));

  const dealRecommendation = helper.buildDealDeskSurfaceRecommendation({
    deal: {
      id: "deal-surface-1",
      company: "Aventra Windows",
      contact: "Lena",
      inquiryChannel: "WhatsApp",
      preferredLanguage: "English",
      productLine: "Thermal Aluminum Door",
      need: "Need a first quote for UAE project.",
      budget: "",
      timing: "2 weeks",
      stage: "new",
      notes: "Customer wants a fast answer.",
      brief: "",
      reviewNotes: "",
      workflowRunId: "sales-run-surface-1",
      workflowScenarioId: "sales-pipeline",
      workflowStageId: "qualify",
      workflowSource: "Deal Desk intake",
      workflowNextStep: "先生成资格简报，再决定是否进入邮件跟进。",
      workflowTriggerType: "manual",
      createdAt: 100,
      updatedAt: 120,
    },
    asset: null,
  });
  assert.equal(
    dealRecommendation.recommendedAction.kind,
    "generate_sales_brief",
    "Deal surface recommendation should first push qualification brief generation when context is mostly present.",
  );
  assert.equal(
    dealRecommendation.sections.some((section) => section.id === "deal_risks"),
    true,
    "Deal surface recommendation should expose missing-context and risk sections.",
  );

  const supportRecommendation = helper.buildSupportCopilotSurfaceRecommendation({
    ticket: {
      id: "support-surface-1",
      customer: "Nora",
      channel: "whatsapp",
      subject: "Broken hinge",
      message: "The hinge arrived damaged.",
      status: "waiting",
      replyDraft: "We have received your issue and will confirm the replacement window shortly.",
      reviewNotes: "不要承诺具体发货时效，除非已经确认库存。",
      workflowRunId: "support-run-surface-1",
      workflowScenarioId: "support-ops",
      workflowStageId: "reply",
      workflowSource: "Support Copilot generated draft",
      workflowNextStep: "人工确认回复边界后，再决定是否转任务跟进或沉淀成 FAQ。",
      workflowTriggerType: "manual",
      createdAt: 130,
      updatedAt: 150,
    },
    asset: {
      id: "support-asset-surface-1",
      workflowRunId: "support-run-surface-1",
      scenarioId: "support-ops",
      ticketId: "support-surface-1",
      customer: "Nora",
      channel: "whatsapp",
      issueSummary: "The hinge arrived damaged.",
      latestDigest: "",
      latestReply: "We have received your issue and will confirm the replacement window shortly.",
      escalationTask: "",
      faqDraft: "",
      nextAction: "人工确认当前回复，确认是否需要升级处理或转成任务。",
      status: "replying",
      createdAt: 130,
      updatedAt: 150,
    },
  });
  assert.equal(
    supportRecommendation.recommendedAction.kind,
    "review_support_reply",
    "Support surface recommendation should prioritize review when reply-draft guardrails still exist.",
  );
  assert.equal(
    supportRecommendation.sections.some((section) => section.id === "support_assetize"),
    true,
    "Support surface recommendation should expose follow-up and assetization signals.",
  );

  const researchRecommendation = helper.buildDeepResearchSurfaceRecommendation({
    report: {
      id: "research-surface-1",
      topic: "Window hardware demand in GCC",
      sources: "Trade forums, distributor notes",
      angle: "What changes replacement demand timing",
      audience: "Sales leadership",
      notes: "Focus on replacement cycle shifts.",
      report: "【Research Brief】\n...\n【下一步】\n把今天必须采取的判断送进 Morning Brief。",
      workflowRunId: "research-run-surface-1",
      workflowScenarioId: "research-radar",
      workflowStageId: "route",
      workflowSource: "Deep Research Hub synthesized report",
      workflowNextStep: "在 Morning Brief 里把研究结论压成今天可执行的判断与动作。",
      workflowTriggerType: "manual",
      createdAt: 160,
      updatedAt: 190,
    },
    asset: {
      id: "research-asset-surface-1",
      workflowRunId: "research-run-surface-1",
      scenarioId: "research-radar",
      reportId: "research-surface-1",
      topic: "Window hardware demand in GCC",
      audience: "Sales leadership",
      angle: "What changes replacement demand timing",
      sources: "Trade forums, distributor notes",
      latestReport: "Structured report",
      latestBrief: "",
      vaultQuery: "",
      nextAction: "在 Morning Brief 里把研究结论压成今天可执行的判断与动作。",
      status: "routing",
      createdAt: 160,
      updatedAt: 190,
    },
  });
  assert.equal(
    researchRecommendation.recommendedAction.kind,
    "route_research_to_brief",
    "Research surface recommendation should prioritize Morning Brief routing when the next step points there.",
  );
  assert.equal(
    researchRecommendation.sections.some((section) => section.id === "research_route"),
    true,
    "Research surface recommendation should expose routing and assetization signals.",
  );

  const repurposerRecommendation = helper.buildContentRepurposerSurfaceRecommendation({
    project: {
      id: "repurpose-surface-1",
      title: "Spring windows content",
      sourceType: "youtube",
      audience: "Procurement leads",
      goal: "Lead gen",
      sourceContent: "Long-form notes about how to choose insulated windows.",
      contentPack: "【短视频口播】\n先讲结果，再给三步判断。\n\n【社媒帖子】\n提炼 3 个购买信号。",
      workflowRunId: "creator-run-surface-2",
      workflowScenarioId: "creator-studio",
      workflowStageId: "preflight",
      workflowSource: "Content Repurposer generated pack",
      workflowNextStep: "在 Publisher 里先做预演，确认标题、CTA 和平台差异后再决定是否自动发布。",
      workflowTriggerType: "manual",
      workflowOriginApp: "content_repurposer",
      workflowOriginId: "repurpose-surface-1",
      workflowOriginLabel: "Spring windows content",
      workflowAudience: "Procurement leads",
      workflowPrimaryAngle: "先讲结果再讲三步判断",
      workflowSourceSummary: "Long-form notes about how to choose insulated windows.",
      workflowSuggestedPlatforms: ["xiaohongshu", "douyin"],
      workflowPublishNotes: "优先做短视频与社媒双版本预演",
      createdAt: 200,
      updatedAt: 230,
    },
    asset: {
      id: "creator-asset-surface-2",
      workflowRunId: "creator-run-surface-2",
      scenarioId: "creator-studio",
      repurposerProjectId: "repurpose-surface-1",
      topic: "Spring windows content",
      audience: "Procurement leads",
      sourceChannels: "",
      primaryAngle: "先讲结果再讲三步判断",
      latestDigest: "Long-form notes about how to choose insulated windows.",
      latestPack: "Pack",
      latestDraftTitle: "",
      latestDraftBody: "",
      publishTargets: ["xiaohongshu", "douyin"],
      publishStatus: "preflight_pending",
      latestPublishFeedback: "",
      successfulPlatforms: [],
      failedPlatforms: [],
      retryablePlatforms: [],
      nextAction: "进入 Publisher 检查标题、CTA 和平台适配，再决定是否自动发布。",
      reuseNotes: "",
      status: "preflight",
      createdAt: 200,
      updatedAt: 230,
    },
  });
  assert.equal(
    repurposerRecommendation.recommendedAction.kind,
    "route_content_to_publisher",
    "Content Repurposer surface recommendation should route finished packs into Publisher preflight.",
  );
  assert.equal(
    repurposerRecommendation.sections.some((section) => section.id === "repurpose_route"),
    true,
    "Content Repurposer surface recommendation should expose publish-routing signals.",
  );

  const inboxRecommendation = helper.buildInboxDeclutterSurfaceRecommendation({
    items: [
      {
        id: "inbox-surface-1",
        source: "client",
        title: "Client asks for quote update",
        body: "Need a response about quote timing and MOQ.",
        workflowRunId: "support-run-surface-2",
        workflowScenarioId: "support-ops",
        workflowStageId: "reply",
        workflowSource: "Inbox Declutter completed intake",
        workflowNextStep: "先生成建议回复，再决定是否升级成任务或 FAQ。",
        workflowTriggerType: "inbound_message",
        createdAt: 240,
        updatedAt: 260,
      },
    ],
    digests: [
      {
        id: "digest-surface-1",
        focus: "Prioritize client issues",
        content: "Client issue should go to Support Copilot first.",
        createdAt: 250,
        updatedAt: 250,
      },
    ],
    digest: "Client issue should go to Support Copilot first.",
    activeItem: {
      id: "inbox-surface-1",
      source: "client",
      title: "Client asks for quote update",
      body: "Need a response about quote timing and MOQ.",
      workflowRunId: "support-run-surface-2",
      workflowScenarioId: "support-ops",
      workflowStageId: "reply",
      workflowSource: "Inbox Declutter completed intake",
      workflowNextStep: "先生成建议回复，再决定是否升级成任务或 FAQ。",
      workflowTriggerType: "inbound_message",
      createdAt: 240,
      updatedAt: 260,
    },
  });
  assert.equal(
    inboxRecommendation.recommendedAction.kind,
    "route_client_issue_to_support",
    "Inbox surface recommendation should prioritize routing client issues into Support Copilot once digest exists.",
  );
  assert.equal(
    inboxRecommendation.sections.some((section) => section.id === "inbox_digest"),
    true,
    "Inbox surface recommendation should expose digest-state signals.",
  );

  const morningRecommendation = helper.buildMorningBriefSurfaceRecommendation({
    focus: "Turn research insight into today's sales decisions",
    notes: "Need a short daily brief for the team.",
    brief: "【今日晨报】\n先完成销售判断，再安排研究复盘。",
    taskCount: 5,
    draftCount: 2,
    latestBriefAt: 300,
    currentBrief: {
      id: "brief-surface-1",
      focus: "Turn research insight into today's sales decisions",
      notes: "Need a short daily brief for the team.",
      content: "【今日晨报】\n先完成销售判断，再安排研究复盘。",
      workflowRunId: "research-run-surface-2",
      workflowScenarioId: "research-radar",
      workflowStageId: "assetize",
      workflowSource: "Deep Research Hub delivered a summary",
      workflowNextStep: "本轮研究链已完成，可把分析框架、观察维度和分发模板继续复用。",
      workflowTriggerType: "manual",
      createdAt: 300,
      updatedAt: 320,
    },
    workflowSource: "Deep Research Hub delivered a summary",
    workflowNextStep: "本轮研究链已完成，可把分析框架、观察维度和分发模板继续复用。",
    asset: {
      id: "research-asset-surface-2",
      workflowRunId: "research-run-surface-2",
      scenarioId: "research-radar",
      briefId: "brief-surface-1",
      topic: "Window hardware demand in GCC",
      audience: "Sales leadership",
      angle: "What changes replacement demand timing",
      sources: "Trade forums, distributor notes",
      latestReport: "",
      latestBrief: "【今日晨报】\n先完成销售判断，再安排研究复盘。",
      vaultQuery: "",
      nextAction: "本轮研究摘要已完成，可以继续复用沉淀下来的框架。",
      status: "completed",
      createdAt: 300,
      updatedAt: 320,
    },
  });
  assert.equal(
    morningRecommendation.recommendedAction.kind,
    "close_research_loop",
    "Morning Brief surface recommendation should surface research closeout when a workflow-linked brief already exists.",
  );
  assert.equal(
    morningRecommendation.sections.some((section) => section.id === "morning_output"),
    true,
    "Morning Brief surface recommendation should expose brief-output and next-step signals.",
  );

  const dealDeskSource = await readFile(
    path.join(PROJECT_ROOT, "src", "components", "apps", "DealDeskAppWindow.tsx"),
    "utf8",
  );
  assert.match(
    dealDeskSource,
    /buildDealDeskSurfaceRecommendation/,
    "Deal Desk should consume the shared workflow-surface recommendation helper.",
  );
  assert.match(
    dealDeskSource,
    /RecommendationResultBody/,
    "Deal Desk should render structured recommendation output through the shared body component.",
  );

  const supportSource = await readFile(
    path.join(PROJECT_ROOT, "src", "components", "apps", "SupportCopilotAppWindow.tsx"),
    "utf8",
  );
  assert.match(
    supportSource,
    /buildSupportCopilotSurfaceRecommendation/,
    "Support Copilot should consume the shared workflow-surface recommendation helper.",
  );
  assert.match(
    supportSource,
    /RecommendationResultBody/,
    "Support Copilot should render structured recommendation output through the shared body component.",
  );

  const researchSource = await readFile(
    path.join(PROJECT_ROOT, "src", "components", "apps", "DeepResearchHubAppWindow.tsx"),
    "utf8",
  );
  assert.match(
    researchSource,
    /buildDeepResearchSurfaceRecommendation/,
    "Deep Research Hub should consume the shared workflow-surface recommendation helper.",
  );
  assert.match(
    researchSource,
    /RecommendationResultBody/,
    "Deep Research Hub should render structured recommendation output through the shared body component.",
  );

  const repurposerSource = await readFile(
    path.join(PROJECT_ROOT, "src", "components", "apps", "ContentRepurposerAppWindow.tsx"),
    "utf8",
  );
  assert.match(
    repurposerSource,
    /buildContentRepurposerSurfaceRecommendation/,
    "Content Repurposer should consume the shared workflow-surface recommendation helper.",
  );
  assert.match(
    repurposerSource,
    /RecommendationResultBody/,
    "Content Repurposer should render structured recommendation output through the shared body component.",
  );

  const inboxSource = await readFile(
    path.join(PROJECT_ROOT, "src", "components", "apps", "InboxDeclutterAppWindow.tsx"),
    "utf8",
  );
  assert.match(
    inboxSource,
    /buildInboxDeclutterSurfaceRecommendation/,
    "Inbox Declutter should consume the shared workflow-surface recommendation helper.",
  );
  assert.match(
    inboxSource,
    /RecommendationResultBody/,
    "Inbox Declutter should render structured recommendation output through the shared body component.",
  );

  const morningSource = await readFile(
    path.join(PROJECT_ROOT, "src", "components", "apps", "MorningBriefAppWindow.tsx"),
    "utf8",
  );
  assert.match(
    morningSource,
    /buildMorningBriefSurfaceRecommendation/,
    "Morning Brief should consume the shared workflow-surface recommendation helper.",
  );
  assert.match(
    morningSource,
    /RecommendationResultBody/,
    "Morning Brief should render structured recommendation output through the shared body component.",
  );

  console.log("workflow surface recommendation regression passed");
}

async function runAppApiAndStorageRegression(localStorage) {
  logSection("app api + storage guard");
  resetBrowserState(localStorage);

  delete globalThis.window.__AGENTCORE_API_BASE_URL__;
  delete globalThis.window.__AGENTCORE_DESKTOP_SHELL__;

  const appApi = await import(moduleUrl("src/lib/app-api.ts"));
  const settings = await import(moduleUrl("src/lib/settings.ts"));
  const storage = await import(moduleUrl("src/lib/storage.ts"));

  const browserOnlyUrl = appApi.buildAgentCoreApiUrl("/api/runtime/doctor");
  assert.equal(
    browserOnlyUrl,
    "/api/runtime/doctor",
    "Browser-only mode should use same-origin APIs by default.",
  );

  globalThis.window.__AGENTCORE_DESKTOP_SHELL__ = true;
  globalThis.window.__AGENTCORE_API_BASE_URL__ = "http://127.0.0.1:8080/";
  const desktopUrl = appApi.buildAgentCoreApiUrl("/api/runtime/doctor");
  assert.equal(
    desktopUrl,
    "http://127.0.0.1:8080/api/runtime/doctor",
    "Desktop shell should honor the injected sidecar API base.",
  );

  delete globalThis.window.__AGENTCORE_API_BASE_URL__;
  delete globalThis.window.__AGENTCORE_DESKTOP_SHELL__;

  assert.doesNotThrow(() => {
    storage.setJsonToStorage("agentcore.test.storage", { ok: true }, new ThrowingStorage());
  }, "Storage writes should not crash the app when the browser blocks persistence.");

  const fallback = storage.getJsonFromStorage(
    "agentcore.test.storage",
    { ok: false },
    new ThrowingStorage(),
  );
  assert.deepEqual(
    fallback,
    { ok: false },
    "Storage reads should fall back cleanly when persistence is unavailable.",
  );

  settings.saveSettings(settings.defaultSettings);
  console.log("app api and storage guard passed");
}

async function runRequestBodyGuardRegression() {
  logSection("request body guard");

  const requestBody = await import(moduleUrl("src/lib/server/request-body.ts"));

  const valid = await requestBody.readJsonBodyWithLimit(
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    }),
    1024,
  );
  assert.equal(valid?.ok, true, "Valid JSON body should parse successfully.");

  await assert.rejects(
    () =>
      requestBody.readJsonBodyWithLimit(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ bad: true }),
        }),
        1024,
      ),
    (error) =>
      error instanceof Error &&
      requestBody.getRequestBodyErrorStatus(error) === 415,
    "Non-JSON requests should be rejected with 415.",
  );

  await assert.rejects(
    () =>
      requestBody.readJsonBodyWithLimit(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }),
        1024,
      ),
    (error) =>
      error instanceof Error &&
      requestBody.getRequestBodyErrorStatus(error) === 400,
    "Invalid JSON should be rejected with 400.",
  );

  await assert.rejects(
    () =>
      requestBody.readJsonBodyWithLimit(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ huge: "x".repeat(2048) }),
        }),
        64,
      ),
    (error) =>
      error instanceof Error &&
      requestBody.getRequestBodyErrorStatus(error) === 413,
    "Oversized JSON should be rejected with 413.",
  );

  console.log("request body guard regression passed");
}

async function runTaskWorkflowMetadataRegression(localStorage) {
  logSection("task workflow metadata");
  resetBrowserState(localStorage);

  const tasks = await import(moduleUrl("src/lib/tasks.ts"));

  const taskId = tasks.createTask({
    name: "Assistant - Creator radar",
    status: "running",
    detail: "春季窗品成交内容",
    workflowRunId: "creator-run-meta-1",
    workflowScenarioId: "creator-studio",
    workflowStageId: "radar",
    workflowSource: "Creator Radar 生成内容雷达摘要",
    workflowNextStep: "确认主角度后送进 Content Repurposer。",
    workflowTriggerType: "manual",
  });

  const created = tasks.getTasks().find((item) => item.id === taskId);
  assert.equal(created?.workflowRunId, "creator-run-meta-1", "Task record should preserve workflow run ids.");
  assert.equal(created?.workflowScenarioId, "creator-studio", "Task record should preserve workflow scenario ids.");
  assert.equal(created?.workflowStageId, "radar", "Task record should preserve workflow stage ids.");
  assert.match(created?.workflowNextStep ?? "", /Content Repurposer/, "Task record should preserve workflow next-step context.");

  console.log("task workflow metadata regression passed");
}

async function runServerBackedRetryRegression(localStorage) {
  logSection("server backed retry");
  resetBrowserState(localStorage);

  const listState = await import(moduleUrl("src/lib/server-backed-list-state.ts"));
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url ?? "");
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/runtime/test-sync") && method === "POST") {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary network failure");
      }
      const payload = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          ok: true,
          data: { item: payload.item, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.endsWith("/api/runtime/test-sync") && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { items: [], tombstones: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const state = listState.createServerBackedListState({
      statusId: "agentcore.retry.test",
      statusLabel: "Retry Test",
      storageKey: "agentcore.retry.test",
      eventName: "agentcore:retry-test",
      maxItems: 10,
      listPath: "/api/runtime/test-sync",
      itemBodyKey: "item",
      retryBaseMs: 10,
      retryMaxMs: 20,
      sortItems: (items) => items.slice().sort((a, b) => b.updatedAt - a.updatedAt),
      parseHydrateData: (data) => ({
        items: Array.isArray(data?.data?.items) ? data.data.items : null,
        tombstones: Array.isArray(data?.data?.tombstones) ? data.data.tombstones : [],
      }),
      parseUpsertData: (data) => ({
        item: data?.data?.item ?? null,
        tombstone: data?.data?.tombstone ?? null,
      }),
    });

    state.saveLocal([{ id: "retry-item-1", updatedAt: 100, value: "local" }]);
    await state.syncItemToServer({ id: "retry-item-1", updatedAt: 100, value: "local" });
    await waitMs(160);

    assert.equal(attempts >= 2, true, "Failed syncs should retry automatically.");
    assert.equal(
      state.getPendingSyncCount(),
      0,
      "Retry queue should drain after a successful retry.",
    );
    assert.equal(
      listState.getServerBackedSyncStatus("agentcore.retry.test")?.pendingCount,
      0,
      "Sync status snapshot should reflect the drained retry queue.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("server backed retry regression passed");
}

async function runExecutionRoutingPlanRegression() {
  logSection("execution routing plan");
  const settingsLib = await import(moduleUrl("src/lib/settings.ts"));

  const settings = {
    ...settingsLib.defaultSettings,
    llm: {
      ...settingsLib.defaultSettings.llm,
      activeProvider: "openai",
      providers: {
        ...settingsLib.defaultSettings.llm.providers,
        openai: {
          apiKey: "openai-key",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
        },
        anthropic: {
          apiKey: "anthropic-key",
          baseUrl: "https://api.anthropic.com",
          model: "claude-3-5-sonnet-latest",
        },
        deepseek: {
          apiKey: "deepseek-key",
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-chat",
        },
        kimi: {
          apiKey: "kimi-key",
          baseUrl: "https://api.moonshot.cn/v1",
          model: "moonshot-v1-8k",
        },
        qwen: {
          apiKey: "",
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          model: "qwen-plus",
        },
      },
      routing: {
        ...settingsLib.defaultSettings.llm.routing,
        strategy: "quality_first",
        fallbackProviderOrder: ["deepseek", "anthropic", "kimi", "qwen", "openai"],
      },
    },
  };

  const plan = settingsLib.getExecutionLlmPlan(settings);
  assert.equal(plan.primary.id, "kimi", "Execution plan should pin Kimi as the primary provider.");
  assert.deepEqual(plan.fallbacks.map((item) => item.id), [], "Kimi-only routing should not emit fallback providers.");

  console.log("execution routing plan regression passed");
}

async function runAgentExecutorRegression(localStorage) {
  logSection("agent executor core");
  resetBrowserState(localStorage);

  const executor = await import(moduleUrl("src/lib/executor/core.ts"));
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedPayload = null;
  let attemptCount = 0;

  globalThis.fetch = async (input, init) => {
    attemptCount += 1;
    capturedUrl = typeof input === "string" ? input : String(input?.url ?? "");
    capturedPayload = init?.body ? JSON.parse(String(init.body)) : null;
    if (attemptCount === 1) {
      return new Response(
        JSON.stringify({
          error: { message: "temporary upstream failure" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "executor-ok" } }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const payload = await executor.runAgentCoreTask({
      message: "请输出一段销售跟进建议",
      sessionId: "regression-agent-route",
      timeoutSeconds: 30,
      systemPrompt: "You are a specialist sales copilot.",
      useSkills: true,
      workspaceContext: {
        activeIndustry: "doors_windows",
        activeScenarioId: "sales-followup",
        runtimeProfile: "desktop_light",
      },
      llm: {
        provider: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      maxAttempts: 2,
      retryBackoffMs: 0,
    });

    assert.equal(payload.ok, true, "Executor should succeed with direct model config.");
    assert.equal(payload.text, "executor-ok", "Executor should surface model output.");
    assert.equal(payload.engine, "agentcore_executor", "Executor should use the internal model adapter when llm config is present.");
    assert.equal(payload.trace.attemptCount, 2, "Executor should expose retry attempts in trace.");
    assert.equal(payload.trace.attempts[0]?.success, false, "First attempt should record the upstream failure.");
    assert.equal(payload.trace.attempts[1]?.success, true, "Second attempt should record the retry success.");
    assert.match(payload.trace.requestId, /^exec-/, "Executor should generate a stable request id.");
    assert.equal(
      capturedUrl,
      "https://api.openai.com/v1/chat/completions",
      "Internal executor should call the configured model endpoint directly.",
    );
    assert.equal(capturedPayload?.model, "gpt-4o-mini", "Executor should forward the configured model.");
    assert.match(
      capturedPayload?.messages?.[0]?.content ?? "",
      /specialist sales copilot/i,
      "Executor should keep the explicit system prompt.",
    );
    assert.match(
      capturedPayload?.messages?.[0]?.content ?? "",
      /activeIndustry=doors_windows/,
      "Executor should include workspace context in the system prompt.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("agent executor regression passed");
}

async function runSkillRuntimeAndMemoryRegression() {
  logSection("skill runtime + memory v2");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-skill-memory-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  const originalFetch = globalThis.fetch;
  const capturedSystemPrompts = [];
  globalThis.fetch = async (_input, init) => {
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    capturedSystemPrompts.push(payload?.messages?.[0]?.content ?? payload?.system ?? "");
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "We can ship a replacement hinge within 48 hours." } }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const runner = await import(moduleUrl("src/lib/server/executor-runner.ts"));
    const sessionStore = await import(moduleUrl("src/lib/server/executor-session-store.ts"));
    const instinctRoute = await import(
      moduleUrl("src/app/api/runtime/executor/memory/instincts/route.ts")
    );

    const first = await runner.executeAgentCoreTask({
      source: "regression/skill-memory",
      message: "请为 damaged hinge case 生成一段客服回复",
      sessionId: "regression-skill-memory",
      timeoutSeconds: 20,
      systemPrompt: "You are a support reviewer.",
      useSkills: true,
      skillProfileId: "support_reply_specialist",
      enableMemoryV2: true,
      memoryScope: "support:damaged-hinge",
      taskLabel: "support-reply",
      maxAttempts: 1,
      retryBackoffMs: 0,
      llm: {
        provider: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    });

    const second = await runner.executeAgentCoreTask({
      source: "regression/skill-memory",
      message: "请再次为 damaged hinge case 生成一段客服回复",
      sessionId: "regression-skill-memory",
      timeoutSeconds: 20,
      systemPrompt: "You are a support reviewer.",
      useSkills: true,
      skillProfileId: "support_reply_specialist",
      enableMemoryV2: true,
      memoryScope: "support:damaged-hinge",
      taskLabel: "support-reply",
      maxAttempts: 1,
      retryBackoffMs: 0,
      llm: {
        provider: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    });

    assert.equal(first.ok, true, "First skill runtime execution should succeed.");
    assert.equal(second.ok, true, "Second skill runtime execution should succeed.");
    assert.equal(
      second.trace.memory?.recalledInstincts >= 1,
      true,
      "Second execution should recall at least one distilled instinct.",
    );
    assert.equal(
      second.trace.skillPlan?.selectedSkillIds.includes("support_reply"),
      true,
      "Skill planner should choose the support reply skill.",
    );
    assert.equal(
      second.trace.skillReceipts.some((receipt) => receipt.skillId === "knowledge_capture"),
      true,
      "Skill receipts should include post-run knowledge capture.",
    );
    assert.match(
      capturedSystemPrompts[capturedSystemPrompts.length - 1] ?? "",
      /Operational instincts for scope support:damaged-hinge/,
      "Second execution should inject Memory V2 recall into the system prompt.",
    );

    const session = await sessionStore.getExecutorSession("regression-skill-memory");
    assert.equal(session?.turns.length, 2, "Session store should keep both skill runtime turns.");
    assert.equal(
      session?.turns[1]?.skillReceipts?.length >= 2,
      true,
      "Persisted session turns should include skill receipts.",
    );

    const routeResponse = await instinctRoute.GET(
      new Request(
        "http://localhost/api/runtime/executor/memory/instincts?scope=support%3Adamaged-hinge&profileId=support_reply_specialist&limit=2",
      ),
    );
    const routePayload = await routeResponse.json();
    assert.equal(routeResponse.status, 200, "Instinct route should succeed.");
    assert.equal(
      routePayload.data?.instincts?.length >= 1,
      true,
      "Instinct route should expose stored Memory V2 entries.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log("skill runtime + memory v2 regression passed");
}

async function runAgentExecutorFallbackHealthRegression() {
  logSection("executor fallback health");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-executor-audit-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const payload = init?.body ? JSON.parse(String(init.body)) : null;
    if (payload?.model === "gpt-4o-mini") {
      return new Response(
        JSON.stringify({
          error: { message: "primary unavailable" },
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (payload?.model === "gpt-4o-mini-backup") {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "fallback-ok" } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`unexpected model request: ${payload?.model ?? "unknown"}`);
  };

  try {
    const runner = await import(moduleUrl("src/lib/server/executor-runner.ts"));
    const healthRoute = await import(moduleUrl("src/app/api/runtime/executor/health/route.ts"));

    const result = await runner.executeAgentCoreTask({
      source: "regression/executor-fallback-health",
      message: "请给出一段稳健的跟进建议",
      sessionId: "regression-fallback-session",
      timeoutSeconds: 15,
      systemPrompt: "You are a resilient workflow copilot.",
      useSkills: true,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
      llm: {
        provider: "openai",
        apiKey: "primary-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      fallbackLlm: [
        {
          provider: "openai",
          apiKey: "backup-key",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini-backup",
        },
      ],
    });

    assert.equal(result.ok, true, "Fallback model should recover the execution.");
    assert.equal(result.text, "fallback-ok", "Fallback model output should be surfaced.");
    assert.equal(result.trace.fallbackUsed, true, "Trace should mark fallback routing.");
    assert.equal(result.trace.attemptCount, 2, "Trace should include primary + fallback attempts.");
    assert.equal(
      result.trace.attempts[0]?.candidateKind,
      "primary",
      "First attempt should belong to the primary candidate.",
    );
    assert.equal(
      result.trace.attempts[1]?.candidateKind,
      "fallback",
      "Second attempt should belong to the fallback candidate.",
    );

    const response = await healthRoute.GET();
    const payload = await response.json();
    assert.equal(response.status, 200, "Executor health route should succeed.");
    assert.equal(payload.ok, true, "Executor health route should return ok=true.");
    assert.equal(
      payload.data?.overview?.totals?.fallback,
      1,
      "Health overview should count fallback executions.",
    );
    assert.equal(
      payload.data?.overview?.recent24h?.runs,
      1,
      "Health overview should include the recorded execution.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log("executor fallback health regression passed");
}

async function runExecutorSessionStoreRegression() {
  logSection("executor session store");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-executor-session-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "session-store-ok Authorization=Bearer secret-token sk-proj-secret",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    const runner = await import(moduleUrl("src/lib/server/executor-runner.ts"));
    const sessionStore = await import(moduleUrl("src/lib/server/executor-session-store.ts"));

    const result = await runner.executeAgentCoreTask({
      source: "regression/executor-session",
      message: "请总结这个客户的下一步动作 token=abc123",
      sessionId: "regression-session-store",
      timeoutSeconds: 20,
      systemPrompt: "You are a disciplined sales reviewer. apiKey=super-secret-key",
      useSkills: true,
      workspaceContext: {
        activeIndustry: "doors_windows",
        activeScenarioId: "sales-followup",
        connectorToken: "token-should-redact",
      },
      llm: {
        provider: "openai",
        apiKey: "super-secret-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    });

    assert.equal(result.ok, true, "Executor runner should succeed before session persistence checks.");

    const session = await sessionStore.getExecutorSession("regression-session-store");
    assert(session, "Executor session should be persisted.");
    assert.equal(session.id, "regression-session-store", "Persisted session id should match.");
    assert.equal(session.turns.length, 1, "One executor turn should be recorded.");
    assert.equal(
      session.turns[0]?.llmProvider,
      "openai",
      "Persisted turn should include the model provider.",
    );
    assert.equal(
      session.turns[0]?.llmModel,
      "gpt-4o-mini",
      "Persisted turn should include the model name.",
    );
    assert.match(
      session.turns[0]?.outputText ?? "",
      /session-store-ok/,
      "Persisted turn should include the model output.",
    );
    assert.equal(
      session.turns[0]?.requestId.startsWith("exec-"),
      true,
      "Persisted turn should keep the generated request id.",
    );
    assert.equal(
      session.turns[0]?.attemptCount,
      1,
      "Persisted turn should include attempt counts.",
    );
    assert.equal(
      session.turns[0]?.skillReceipts?.some((receipt) => receipt.skillId === "knowledge_capture"),
      true,
      "Persisted turn should keep skill receipts.",
    );
    assert.equal(
      "apiKey" in (session.turns[0] ?? {}),
      false,
      "Executor session persistence must not store API keys.",
    );
    assert.equal(
      /super-secret-key|secret-token|abc123/.test(JSON.stringify(session.turns[0] ?? {})),
      false,
      "Executor session persistence must redact sensitive values.",
    );
    assert.match(
      JSON.stringify(session.turns[0] ?? {}),
      /\[REDACTED\]/,
      "Executor session persistence should replace secret-looking values with redaction markers.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log("executor session store regression passed");
}

async function runCoreStateServerSyncRegression(localStorage) {
  logSection("core state server sync");
  resetBrowserState(localStorage);

  const deals = await import(moduleUrl("src/lib/deals.ts"));
  const support = await import(moduleUrl("src/lib/support.ts"));
  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const salesWorkflow = await import(moduleUrl("src/lib/sales-workflow.ts"));

  const originalFetch = globalThis.fetch;
  const requests = [];
  const salesScenario = salesWorkflow.getSalesWorkflowScenario();
  let serverDeals = [
    {
      id: "server-deal-1",
      company: "Server Deal",
      contact: "Lia",
      inquiryChannel: "Email",
      preferredLanguage: "English",
      productLine: "Window",
      need: "Server-side sync",
      budget: "",
      timing: "",
      stage: "qualified",
      notes: "",
      brief: "Loaded from server",
      reviewNotes: "",
      createdAt: 100,
      updatedAt: 200,
    },
  ];
  let serverDealTombstones = [];
  let serverTickets = [
    {
      id: "server-ticket-1",
      customer: "Server Nora",
      channel: "whatsapp",
      subject: "Loaded from server",
      message: "Support sync",
      status: "waiting",
      replyDraft: "Reply from server",
      reviewNotes: "",
      createdAt: 100,
      updatedAt: 200,
    },
  ];
  let serverSupportTombstones = [];
  let serverWorkflowRuns = [
    {
      id: "server-run-1",
      scenarioId: salesScenario.id,
      scenarioTitle: salesScenario.title,
      triggerType: "manual",
      state: "running",
      currentStageId: salesScenario.workflowStages[0].id,
      stageRuns: salesScenario.workflowStages.map((stage, index) => ({
        id: stage.id,
        title: stage.title,
        mode: stage.mode,
        state: index === 0 ? "running" : "pending",
      })),
      createdAt: 100,
      updatedAt: 200,
    },
  ];
  let serverWorkflowTombstones = [];

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url ?? "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, method, body });

    if (url === "/api/runtime/state/deals" && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            deals: serverDeals,
            tombstones: serverDealTombstones,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/deals" && method === "POST") {
      const candidate = body?.deal;
      const existingTombstone = serverDealTombstones.find(
        (tombstone) => tombstone.id === candidate?.id,
      );
      if (existingTombstone && existingTombstone.deletedAt >= candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { deal: null, tombstone: existingTombstone, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const existing = serverDeals.find((deal) => deal.id === candidate?.id);
      if (existing && existing.updatedAt > candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { deal: existing, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      serverDealTombstones = serverDealTombstones.filter(
        (tombstone) => tombstone.id !== candidate.id,
      );
      serverDeals = [candidate, ...serverDeals.filter((deal) => deal.id !== candidate.id)];
      return new Response(
        JSON.stringify({
          ok: true,
          data: { deal: candidate, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/deals/server-deal-1" && method === "DELETE") {
      const existing = serverDeals.find((deal) => deal.id === "server-deal-1") ?? null;
      if (existing && existing.updatedAt > (body?.updatedAt ?? 0)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "conflict",
            data: { removed: false, conflict: true, deal: existing, tombstone: null },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const tombstone = {
        id: "server-deal-1",
        updatedAt: 500,
        deletedAt: 500,
      };
      serverDealTombstones = [
        tombstone,
        ...serverDealTombstones.filter((entry) => entry.id !== "server-deal-1"),
      ];
      serverDeals = serverDeals.filter((deal) => deal.id !== "server-deal-1");
      return new Response(
        JSON.stringify({
          ok: true,
          data: { removed: true, conflict: false, deal: existing, tombstone },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/support" && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            tickets: serverTickets,
            tombstones: serverSupportTombstones,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/support" && method === "POST") {
      const candidate = body?.ticket;
      const existingTombstone = serverSupportTombstones.find(
        (tombstone) => tombstone.id === candidate?.id,
      );
      if (existingTombstone && existingTombstone.deletedAt >= candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { ticket: null, tombstone: existingTombstone, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const existing = serverTickets.find((ticket) => ticket.id === candidate?.id);
      if (existing && existing.updatedAt > candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { ticket: existing, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      serverSupportTombstones = serverSupportTombstones.filter(
        (tombstone) => tombstone.id !== candidate.id,
      );
      serverTickets = [
        candidate,
        ...serverTickets.filter((ticket) => ticket.id !== candidate.id),
      ];
      return new Response(
        JSON.stringify({
          ok: true,
          data: { ticket: candidate, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/workflow-runs" && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            workflowRuns: serverWorkflowRuns,
            tombstones: serverWorkflowTombstones,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/workflow-runs" && method === "POST") {
      const candidate = body?.workflowRun;
      const existingTombstone = serverWorkflowTombstones.find(
        (tombstone) => tombstone.id === candidate?.id,
      );
      if (existingTombstone) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { workflowRun: null, tombstone: existingTombstone, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const existing = serverWorkflowRuns.find((workflowRun) => workflowRun.id === candidate?.id);
      if (existing && existing.updatedAt > candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { workflowRun: existing, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const activeScenarioRun =
        serverWorkflowRuns.find(
          (workflowRun) =>
            workflowRun.scenarioId === candidate?.scenarioId &&
            workflowRun.id !== candidate?.id,
        ) ?? null;
      if (activeScenarioRun && compareWorkflowRunPriority(activeScenarioRun, candidate) >= 0) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { workflowRun: activeScenarioRun, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const supersededRuns = serverWorkflowRuns.filter(
        (workflowRun) =>
          workflowRun.scenarioId === candidate.scenarioId && workflowRun.id !== candidate.id,
      );
      serverWorkflowTombstones = [
        ...supersededRuns.map((workflowRun) => ({
          id: workflowRun.id,
          scenarioId: workflowRun.scenarioId,
          updatedAt: candidate.createdAt,
          deletedAt: candidate.createdAt,
        })),
        ...serverWorkflowTombstones.filter(
          (tombstone) =>
            !supersededRuns.some((workflowRun) => workflowRun.id === tombstone.id) &&
            tombstone.id !== candidate.id,
        ),
      ];
      serverWorkflowRuns = [
        candidate,
        ...serverWorkflowRuns.filter(
          (workflowRun) =>
            workflowRun.id !== candidate.id &&
            workflowRun.scenarioId !== candidate.scenarioId,
        ),
      ];
      return new Response(
        JSON.stringify({
          ok: true,
          data: { workflowRun: candidate, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    deals.createDeal({ company: "Sync Deal" });
    support.createSupportTicket({ customer: "Sync Customer", subject: "Sync Subject" });
    workflowRuns.startWorkflowRun(salesScenario, "manual");

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert(
      requests.some((entry) => entry.url === "/api/runtime/state/deals" && entry.method === "POST"),
      "Deals should upsert to the server after local changes.",
    );
    assert(
      requests.some(
        (entry) => entry.url === "/api/runtime/state/support" && entry.method === "POST",
      ),
      "Support tickets should upsert to the server after local changes.",
    );
    assert(
      requests.some(
        (entry) =>
          entry.url === "/api/runtime/state/workflow-runs" && entry.method === "POST",
      ),
      "Workflow runs should upsert to the server after local changes.",
    );

    serverDeals = [
      {
        id: "server-deal-1",
        company: "Server Deal",
        contact: "Lia",
        inquiryChannel: "Email",
        preferredLanguage: "English",
        productLine: "Window",
        need: "Server-side sync",
        budget: "",
        timing: "",
        stage: "qualified",
        notes: "",
        brief: "Loaded from server",
        reviewNotes: "",
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverDealTombstones = [];
    serverTickets = [
      {
        id: "server-ticket-1",
        customer: "Server Nora",
        channel: "whatsapp",
        subject: "Loaded from server",
        message: "Support sync",
        status: "waiting",
        replyDraft: "Reply from server",
        reviewNotes: "",
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverSupportTombstones = [];
    serverWorkflowRuns = [
      {
        id: "server-run-1",
        scenarioId: salesScenario.id,
        scenarioTitle: salesScenario.title,
        triggerType: "manual",
        state: "running",
        currentStageId: salesScenario.workflowStages[0].id,
        stageRuns: salesScenario.workflowStages.map((stage, index) => ({
          id: stage.id,
          title: stage.title,
          mode: stage.mode,
          state: index === 0 ? "running" : "pending",
        })),
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverWorkflowTombstones = [];

    localStorage.clear();
    await deals.hydrateDealsFromServer(true);
    await support.hydrateSupportTicketsFromServer(true);
    await workflowRuns.hydrateWorkflowRunsFromServer(true);

    assert.equal(
      deals.getDeals()[0]?.id,
      "server-deal-1",
      "Deals should hydrate from the server store.",
    );
    assert.equal(
      support.getSupportTickets()[0]?.id,
      "server-ticket-1",
      "Support tickets should hydrate from the server store.",
    );
    assert.equal(
      workflowRuns.getWorkflowRuns()[0]?.id,
      "server-run-1",
      "Workflow runs should hydrate from the server store.",
    );

    serverDeals = [
      {
        ...serverDeals[0],
        company: "Server Deal Newer",
        updatedAt: 999,
      },
    ];
    serverDealTombstones = [];

    deals.removeDeal("server-deal-1");
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      deals.getDeals()[0]?.company,
      "Server Deal Newer",
      "Delete conflicts should restore the newer server deal locally.",
    );
    assert.equal(
      deals.getDeals()[0]?.updatedAt,
      999,
      "Delete conflicts should preserve the newer server timestamp.",
    );

    requests.length = 0;
    localStorage.setItem(
      "openclaw.deals.v1",
      JSON.stringify([
        {
          id: "local-newer-deal",
          company: "Local Newer Deal",
          contact: "Ava",
          inquiryChannel: "WhatsApp",
          preferredLanguage: "English",
          productLine: "Door",
          need: "Keep local newer state",
          budget: "",
          timing: "",
          stage: "proposal",
          notes: "",
          brief: "Pending local sync",
          reviewNotes: "",
          createdAt: 300,
          updatedAt: 600,
        },
      ]),
    );
    serverDeals = [
      {
        id: "server-only-deal",
        company: "Server Only Deal",
        contact: "Mia",
        inquiryChannel: "Email",
        preferredLanguage: "English",
        productLine: "Window",
        need: "Server snapshot",
        budget: "",
        timing: "",
        stage: "new",
        notes: "",
        brief: "",
        reviewNotes: "",
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverDealTombstones = [];

    await deals.hydrateDealsFromServer(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert(
      deals.getDeals().some((deal) => deal.id === "local-newer-deal"),
      "Hydration should preserve newer local deals instead of overwriting them.",
    );
    assert(
      requests.some(
        (entry) =>
          entry.url === "/api/runtime/state/deals" &&
          entry.method === "POST" &&
          entry.body?.deal?.id === "local-newer-deal",
      ),
      "Hydration should resync newer local deals back to the server.",
    );

    requests.length = 0;
    localStorage.setItem(
      "openclaw.deals.v1",
      JSON.stringify([
        {
          id: "deleted-deal-1",
          company: "Deleted Deal",
          contact: "Theo",
          inquiryChannel: "Email",
          preferredLanguage: "English",
          productLine: "Window",
          need: "Should stay deleted",
          budget: "",
          timing: "",
          stage: "qualified",
          notes: "",
          brief: "",
          reviewNotes: "",
          createdAt: 100,
          updatedAt: 150,
        },
      ]),
    );
    serverDeals = [];
    serverDealTombstones = [
      {
        id: "deleted-deal-1",
        updatedAt: 400,
        deletedAt: 400,
      },
    ];

    await deals.hydrateDealsFromServer(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      deals.getDeals().some((deal) => deal.id === "deleted-deal-1"),
      false,
      "Hydration should drop local deals that are already deleted on the server.",
    );
    assert.equal(
      requests.some(
        (entry) =>
          entry.url === "/api/runtime/state/deals" &&
          entry.method === "POST" &&
          entry.body?.deal?.id === "deleted-deal-1",
      ),
      false,
      "Hydration should not resurrect a server-deleted deal from stale local cache.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("core state server sync regression passed");
}

async function runWorkflowRunStoreRegression() {
  logSection("workflow run tombstone boundary");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-workflow-run-store-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const store = await import(moduleUrl("src/lib/server/workflow-run-store.ts"));

    const olderRun = {
      id: "run-old",
      scenarioId: "sales-followup",
      scenarioTitle: "Sales Follow-up",
      triggerType: "manual",
      state: "running",
      currentStageId: "qualify",
      stageRuns: [{ id: "qualify", title: "Qualify", mode: "auto", state: "running" }],
      createdAt: 100,
      updatedAt: 120,
    };
    const newerRun = {
      ...olderRun,
      id: "run-new",
      currentStageId: "draft",
      stageRuns: [{ id: "draft", title: "Draft", mode: "auto", state: "running" }],
      createdAt: 200,
      updatedAt: 210,
    };

    const firstInsert = await store.upsertWorkflowRunInStore(olderRun);
    assert.equal(firstInsert.accepted, true, "Initial workflow run should store successfully.");

    const secondInsert = await store.upsertWorkflowRunInStore(newerRun);
    assert.equal(secondInsert.accepted, true, "Newer workflow run should supersede the old run.");

    const snapshot = await store.listWorkflowRunStoreSnapshot();
    assert.deepEqual(
      snapshot.workflowRuns.map((run) => run.id),
      ["run-new"],
      "Only the latest started run should remain active for a scenario.",
    );
    assert.equal(
      snapshot.tombstones.some((tombstone) => tombstone.id === "run-old"),
      true,
      "Superseded workflow runs should leave a tombstone boundary.",
    );

    const resurrect = await store.upsertWorkflowRunInStore({
      ...olderRun,
      updatedAt: 999,
    });
    assert.equal(resurrect.accepted, false, "Superseded workflow run ids should not resurrect.");
    assert.equal(
      resurrect.tombstone?.id,
      "run-old",
      "Superseded workflow runs should reject with their tombstone.",
    );

    const removed = await store.removeWorkflowRunFromStore("run-new", newerRun.updatedAt);
    assert.equal(removed.removed, true, "Workflow runs should support tombstone-backed delete.");

    const afterDelete = await store.listWorkflowRunStoreSnapshot();
    assert.equal(
      afterDelete.workflowRuns.length,
      0,
      "Deleting the active workflow run should clear it from the live snapshot.",
    );
    assert.equal(
      afterDelete.tombstones.some((tombstone) => tombstone.id === "run-new"),
      true,
      "Deleting a workflow run should persist a tombstone.",
    );

    console.log("workflow run tombstone boundary regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runLegacyPutGuardRegression() {
  logSection("legacy put guard");
  const routeFiles = [
    path.join(PROJECT_ROOT, "src", "app", "api", "runtime", "state", "deals", "route.ts"),
    path.join(PROJECT_ROOT, "src", "app", "api", "runtime", "state", "support", "route.ts"),
    path.join(
      PROJECT_ROOT,
      "src",
      "app",
      "api",
      "runtime",
      "state",
      "workflow-runs",
      "route.ts",
    ),
  ];

  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      /x-agentcore-allow-full-replace/,
      "Legacy full-replace routes should require an explicit override header.",
    );
    assert.match(
      source,
      /status:\s*409/,
      "Legacy full-replace routes should reject snapshot overwrite by default.",
    );
  }

  console.log("legacy put guard regression passed");
}

async function runJsonStoreRegression() {
  logSection("json store hardening");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-json-store-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const jsonStore = await import(moduleUrl("src/lib/server/json-store.ts"));

    await jsonStore.writeJsonFile("atomic.json", { version: 1 });
    await jsonStore.writeJsonFile("atomic.json", { version: 2 });

    const dataDir = path.join(tempRoot, ".openclaw-data");
    const mainFile = path.join(dataDir, "atomic.json");
    const backupFile = path.join(dataDir, "atomic.json.bak");

    assert.equal(
      fs.existsSync(backupFile),
      true,
      "Successful writes should maintain a backup file.",
    );

    fs.writeFileSync(mainFile, "{broken-json", "utf8");
    const recovered = await jsonStore.readJsonFile("atomic.json", { version: 0 });
    assert.equal(recovered.version, 2, "Corrupted primary JSON should recover from backup.");

    await Promise.all(
      Array.from({ length: 12 }, () =>
        jsonStore.readModifyWrite("counter.json", { value: 0 }, (current) => ({
          value: current.value + 1,
        })),
      ),
    );

    const counter = await jsonStore.readJsonFile("counter.json", { value: 0 });
    assert.equal(counter.value, 12, "Store locking should serialize read-modify-write updates.");

    console.log("json store hardening regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runPublishQueueRegression() {
  logSection("publish queue");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-publish-regression-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const publishJobStore = await import(moduleUrl("src/lib/server/publish-job-store.ts"));
    const publishConfigStore = await import(moduleUrl("src/lib/server/publish-config-store.ts"));
    const queueRunner = await import(moduleUrl("src/lib/server/publish-queue-runner.ts"));

    await publishConfigStore.writePublishConfig({});

    const dryRunJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Regression draft",
      draftBody: "Regression body for manual publishing",
      platforms: ["wechat", "xiaohongshu"],
      mode: "dry-run",
    });

    const dryRunResult = await queueRunner.runOneQueuedPublishJob();
    assert.equal(dryRunResult.ok, true, "Dry-run publish queue execution should succeed.");
    assert.equal(dryRunResult.processed, true, "Dry-run publish queue should process one job.");

    const jobsAfterDryRun = await publishJobStore.listPublishJobs();
    const finishedDryRun = jobsAfterDryRun.find((job) => job.id === dryRunJob.id);
    assert.equal(finishedDryRun?.status, "done", "Dry-run publish job should finish as done.");
    assert.ok(finishedDryRun?.resultText, "Dry-run publish job should store result text.");

    await publishConfigStore.writePublishConfig({
      xiaohongshu: {
        token: "regression-token",
        webhookUrl: "http://127.0.0.1:9/dispatch",
      },
    });

    const dispatchJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Dispatch retry regression",
      draftBody: "This should retry and then fail.",
      platforms: ["xiaohongshu"],
      mode: "dispatch",
      maxAttempts: 2,
    });

    const firstDispatch = await queueRunner.runOneQueuedPublishJob();
    assert.equal(firstDispatch.ok, false, "First dispatch attempt should fail.");
    assert.equal(firstDispatch.retried, true, "First dispatch attempt should schedule a retry.");

    await publishJobStore.updatePublishJobRecord(dispatchJob.id, {
      nextAttemptAt: Date.now() - 1000,
    });

    const secondDispatch = await queueRunner.runOneQueuedPublishJob();
    assert.equal(secondDispatch.ok, false, "Second dispatch attempt should still fail.");
    assert.equal(secondDispatch.retried, undefined, "Final dispatch failure should not retry again.");

    const jobsAfterDispatch = await publishJobStore.listPublishJobs();
    const failedDispatch = jobsAfterDispatch.find((job) => job.id === dispatchJob.id);
    assert.equal(failedDispatch?.status, "error", "Dispatch job should end in error after max attempts.");
    assert.equal(failedDispatch?.attempts, 2, "Dispatch job should record both attempts.");

    const lockFile = path.join(tempRoot, ".openclaw-data", "publish-queue.lock");
    assert(!fs.existsSync(lockFile), "Publish queue lock should be released after processing.");

    console.log("publish queue regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runHeroWorkflowRecommendationRegression(localStorage) {
  logSection("hero workflow recommendation");
  resetBrowserState(localStorage);

  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const salesWorkflow = await import(moduleUrl("src/lib/sales-workflow.ts"));
  const supportWorkflow = await import(moduleUrl("src/lib/support-workflow.ts"));
  const creatorWorkflow = await import(moduleUrl("src/lib/creator-workflow.ts"));
  const researchWorkflow = await import(moduleUrl("src/lib/research-workflow.ts"));
  const salesAssets = await import(moduleUrl("src/lib/sales-assets.ts"));
  const creatorAssets = await import(moduleUrl("src/lib/creator-assets.ts"));
  const supportAssets = await import(moduleUrl("src/lib/support-assets.ts"));
  const researchAssets = await import(moduleUrl("src/lib/research-assets.ts"));
  const helper = await import(moduleUrl("src/lib/hero-workflow-recommendation.ts"));

  const salesScenario = salesWorkflow.getSalesWorkflowScenario();
  const creatorScenario = creatorWorkflow.getCreatorWorkflowScenario();
  const supportScenario = supportWorkflow.getSupportWorkflowScenario();
  const researchScenario = researchWorkflow.getResearchWorkflowScenario();
  assert(salesScenario, "Sales scenario should exist for recommendation regression.");
  assert(creatorScenario, "Creator scenario should exist for recommendation regression.");
  assert(supportScenario, "Support scenario should exist for recommendation regression.");
  assert(researchScenario, "Research scenario should exist for recommendation regression.");

  const salesRunId = workflowRuns.startWorkflowRun(salesScenario, "web_form");
  const salesRun = workflowRuns.setWorkflowRunAwaitingHuman(salesRunId);
  const salesAsset = salesAssets.upsertSalesAsset(salesRunId, {
    company: "Aventra Windows",
    contactName: "Lena",
    inquiryChannel: "WhatsApp",
    preferredLanguage: "English",
    productLine: "Thermal Aluminum Door",
    requirementSummary: "Need a fast quote for UAE project.",
    nextAction: "Review quote framing before sending.",
    quoteStatus: "draft_ready",
    dealId: "deal-regression-1",
  });

  const salesRecommendation = helper.buildSalesHeroWorkflowRecommendation({
    run: salesRun,
    asset: salesAsset,
    tasks: [
      {
        id: "sales-task-1",
        name: "Assistant - Deal qualification",
        status: "running",
        detail: "Aventra Windows",
        workflowRunId: salesRunId,
        workflowScenarioId: "sales-pipeline",
        workflowStageId: "qualify",
        workflowSource: "Deal Desk 生成销售资格判断简报",
        workflowNextStep: "确认是否值得推进，再进入报价和跟进阶段。",
        workflowTriggerType: "manual",
        createdAt: 110,
        updatedAt: 130,
      },
    ],
    source: "Regression sales intake",
  });
  assert.equal(
    salesRecommendation.recommendedAction.kind,
    "resume_sales_workflow",
    "Awaiting-human sales workflow should recommend resuming the workflow.",
  );
  assert.equal(
    salesRecommendation.recommendedAction.jumpTarget?.kind,
    "record",
    "Sales recommendation should expose a record jump target when asset ids exist.",
  );
  assert.equal(
    salesRecommendation.sections.some((section) => section.id === "sales_asset_signals"),
    true,
    "Sales recommendation should include asset signals.",
  );
  assert.equal(
    salesRecommendation.sections.some((section) => section.id === "sales_task_signals"),
    true,
    "Sales recommendation should include workflow-linked task signals.",
  );

  const supportRunId = workflowRuns.startWorkflowRun(supportScenario, "manual");
  workflowRuns.advanceWorkflowRun(supportRunId);
  workflowRuns.advanceWorkflowRun(supportRunId);
  workflowRuns.advanceWorkflowRun(supportRunId);
  const supportRun = workflowRuns.completeWorkflowRun(supportRunId);
  const supportAsset = supportAssets.upsertSupportAsset(supportRunId, {
    customer: "Nora",
    channel: "whatsapp",
    issueSummary: "Broken hinge on delivery.",
    latestReply: "We will ship a replacement hinge within 48 hours.",
    faqDraft: "Broken hinge replacements require order number and photos.",
    ticketId: "ticket-regression-1",
    status: "completed",
  });

  const supportRecommendation = helper.buildSupportHeroWorkflowRecommendation({
    run: supportRun,
    asset: supportAsset,
    tasks: [
      {
        id: "support-task-1",
        name: "Support - Nora",
        status: "queued",
        detail: "Broken hinge on delivery",
        workflowRunId: supportRunId,
        workflowScenarioId: "support-ops",
        workflowStageId: "followup",
        workflowSource: "Support Copilot 已进入后续跟进阶段",
        workflowNextStep: "把本次处理沉淀成 FAQ 或升级规则。",
        workflowTriggerType: "manual",
        createdAt: 210,
        updatedAt: 230,
      },
    ],
    nextStep: "Archive the approved reply into FAQ.",
  });
  assert.equal(
    supportRecommendation.recommendedAction.kind,
    "reuse_support_asset",
    "Completed support workflow with asset should recommend asset reuse.",
  );
  assert.equal(
    supportRecommendation.recommendedAction.jumpTarget?.kind,
    "record",
    "Support recommendation should expose a record jump target when ticket ids exist.",
  );
  assert.equal(
    supportRecommendation.sections.some((section) => section.id === "support_task_signals"),
    true,
    "Support recommendation should include workflow-linked task signals.",
  );

  const creatorRunId = workflowRuns.startWorkflowRun(creatorScenario, "manual");
  workflowRuns.advanceWorkflowRun(creatorRunId);
  workflowRuns.advanceWorkflowRun(creatorRunId);
  const creatorRun = workflowRuns.setWorkflowRunAwaitingHuman(creatorRunId);
  const creatorAsset = creatorAssets.upsertCreatorAsset(creatorRunId, {
    topic: "春季窗品成交内容",
    audience: "门窗采购负责人",
    primaryAngle: "先讲结果再讲三步检查",
    publishTargets: ["douyin", "xiaohongshu"],
    publishStatus: "dispatch_error",
    latestPublishFeedback: "失败: xiaohongshu | 可重试: douyin",
    successfulPlatforms: [],
    failedPlatforms: ["xiaohongshu"],
    retryablePlatforms: ["douyin"],
    nextAction: "先回到 Publisher 修正文案和授权",
    reuseNotes: "保留数字 hook，修复小红书授权后再发。",
    draftId: "draft-regression-1",
    status: "publishing",
  });

  const creatorRecommendation = helper.buildCreatorHeroWorkflowRecommendation({
    run: creatorRun,
    asset: creatorAsset,
    draft: {
      id: "draft-regression-1",
      title: "春季成交短视频稿",
      body: "先讲结果，再给三步检查，最后引导评论区领取模板。",
      source: "publisher",
      workflowRunId: creatorRunId,
      workflowScenarioId: "creator-studio",
      workflowStageId: "preflight",
      createdAt: 100,
      updatedAt: 120,
    },
    publishJob: {
      id: "job-regression-1",
      draftId: "draft-regression-1",
      draftTitle: "春季成交短视频稿",
      draftBody: "先讲结果，再给三步检查，最后引导评论区领取模板。",
      platforms: ["douyin", "xiaohongshu"],
      mode: "dispatch",
      status: "error",
      results: [
        { platform: "douyin", ok: false, mode: "webhook", retryable: true, error: "temporary timeout" },
      ],
      createdAt: 130,
      updatedAt: 140,
    },
    tasks: [
      {
        id: "task-regression-1",
        name: "Assistant - Publisher xiaohongshu variant",
        status: "running",
        detail: "春季成交短视频稿",
        workflowRunId: creatorRunId,
        workflowScenarioId: "creator-studio",
        workflowStageId: "preflight",
        workflowSource: "Publisher 生成平台修正版",
        workflowNextStep: "检查平台语气和 CTA，再决定是否自动发布。",
        workflowTriggerType: "manual",
        createdAt: 150,
        updatedAt: 160,
      },
    ],
    source: "Regression creator handoff",
  });
  assert.equal(
    creatorRecommendation.recommendedAction.kind,
    "resume_creator_workflow",
    "Awaiting-human creator workflow should recommend resuming the workflow.",
  );
  assert.equal(
    creatorRecommendation.recommendedAction.jumpTarget?.kind,
    "publisher",
    "Creator recommendation should expose a publisher jump target when draft ids exist.",
  );
  assert.equal(
    creatorRecommendation.sections.some((section) => section.id === "creator_asset_signals"),
    true,
    "Creator recommendation should include creator asset signals.",
  );
  assert.equal(
    creatorRecommendation.sections.some((section) => section.id === "creator_draft_signals"),
    true,
    "Creator recommendation should include linked draft signals.",
  );
  assert.equal(
    creatorRecommendation.sections.some((section) => section.id === "creator_connector_signals"),
    true,
    "Creator recommendation should include connector runtime signals.",
  );
  assert.equal(
    creatorRecommendation.sections.some((section) => section.id === "creator_task_signals"),
    true,
    "Creator recommendation should include workflow-linked task signals.",
  );

  const researchRunId = workflowRuns.startWorkflowRun(researchScenario, "schedule");
  workflowRuns.advanceWorkflowRun(researchRunId);
  const researchRun = workflowRuns.advanceWorkflowRun(researchRunId);
  const researchAsset = researchAssets.upsertResearchAsset(researchRunId, {
    topic: "Window hardware demand in GCC",
    audience: "Sales leadership",
    angle: "What changes replacement demand timing",
    sources: "Trade forums, service tickets, distributor notes",
    latestBrief: "Replacement demand spikes when installation partners lag on inspection.",
    vaultQuery: "gcc replacement demand hinge hardware",
    reportId: "report-regression-1",
    status: "routing",
  });

  const researchRecommendation = helper.buildResearchHeroWorkflowRecommendation({
    run: researchRun,
    asset: researchAsset,
    tasks: [
      {
        id: "research-task-1",
        name: "Assistant - Deep research",
        status: "running",
        detail: "Window hardware demand in GCC",
        workflowRunId: researchRunId,
        workflowScenarioId: "research-radar",
        workflowStageId: "synthesize",
        workflowSource: "Deep Research Hub 生成研究简报",
        workflowNextStep: "完成研究报告后进入 Morning Brief 或知识路由。",
        workflowTriggerType: "manual",
        createdAt: 310,
        updatedAt: 330,
      },
    ],
  });
  assert.equal(
    researchRecommendation.recommendedAction.kind,
    "advance_research_workflow",
    "Running research workflow should recommend advancing the current stage.",
  );
  assert.equal(
    researchRecommendation.sections.some((section) => section.id === "research_asset_signals"),
    true,
    "Research recommendation should include asset signals.",
  );
  assert.equal(
    researchRecommendation.sections.some((section) => section.id === "research_task_signals"),
    true,
    "Research recommendation should include workflow-linked task signals.",
  );

  console.log("hero workflow recommendation regression passed");
}

async function runHeroWorkflowRecommendationRouteRegression() {
  logSection("hero workflow recommendation route");

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-hero-recommendation-route-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const route = await import(moduleUrl("src/app/api/runtime/recommendations/hero-workflow/route.ts"));
    const summaryRoute = await import(moduleUrl("src/app/api/runtime/recommendations/hero-workflows/summary/route.ts"));
    const workflowStore = await import(moduleUrl("src/lib/server/workflow-run-store.ts"));
    const salesAssetStore = await import(moduleUrl("src/lib/server/sales-asset-store.ts"));
    const creatorAssetStore = await import(moduleUrl("src/lib/server/creator-asset-store.ts"));
    const draftStore = await import(moduleUrl("src/lib/server/draft-store.ts"));
    const publishJobStore = await import(moduleUrl("src/lib/server/publish-job-store.ts"));
    const taskStore = await import(moduleUrl("src/lib/server/task-store.ts"));
    const supportAssetStore = await import(moduleUrl("src/lib/server/support-asset-store.ts"));
    const researchAssetStore = await import(moduleUrl("src/lib/server/research-asset-store.ts"));

    await workflowStore.writeWorkflowRunsToStore([
      {
        id: "sales-run-1",
        scenarioId: "sales-pipeline",
        scenarioTitle: "Sales Pipeline",
        triggerType: "web_form",
        state: "awaiting_human",
        currentStageId: "qualify",
        stageRuns: [
          { id: "qualify", title: "资格判断", mode: "review", state: "awaiting_human" },
        ],
        createdAt: 100,
        updatedAt: 120,
      },
      {
        id: "creator-run-1",
        scenarioId: "creator-studio",
        scenarioTitle: "Creator Studio",
        triggerType: "manual",
        state: "awaiting_human",
        currentStageId: "preflight",
        stageRuns: [
          { id: "preflight", title: "发布前检查", mode: "review", state: "awaiting_human" },
        ],
        createdAt: 160,
        updatedAt: 190,
      },
      {
        id: "support-run-1",
        scenarioId: "support-ops",
        scenarioTitle: "Support Ops",
        triggerType: "manual",
        state: "completed",
        currentStageId: "faq",
        stageRuns: [
          { id: "faq", title: "沉淀 FAQ", mode: "manual", state: "completed" },
        ],
        createdAt: 200,
        updatedAt: 260,
      },
      {
        id: "research-run-1",
        scenarioId: "research-radar",
        scenarioTitle: "Research Radar",
        triggerType: "schedule",
        state: "running",
        currentStageId: "route",
        stageRuns: [
          { id: "route", title: "分发洞察", mode: "assist", state: "running" },
        ],
        createdAt: 300,
        updatedAt: 360,
      },
    ]);

    await salesAssetStore.writeSalesAssetsToStore([
      {
        id: "sales-asset-1",
        workflowRunId: "sales-run-1",
        scenarioId: "sales-pipeline",
        dealId: "deal-1",
        company: "Aventra Windows",
        contactName: "Lena",
        inquiryChannel: "WhatsApp",
        preferredLanguage: "English",
        productLine: "Thermal Aluminum Door",
        requirementSummary: "Need a fast quote for UAE project.",
        preferenceNotes: "",
        objectionNotes: "",
        nextAction: "Review quote framing before sending.",
        quoteNotes: "",
        quoteStatus: "draft_ready",
        latestDraftSubject: "",
        latestDraftBody: "",
        assetDraft: "",
        status: "awaiting_review",
        createdAt: 100,
        updatedAt: 120,
      },
    ]);

    await creatorAssetStore.writeCreatorAssetsToStore([
      {
        id: "creator-asset-1",
        workflowRunId: "creator-run-1",
        scenarioId: "creator-studio",
        draftId: "draft-1",
        topic: "春季窗品成交内容",
        audience: "门窗采购负责人",
        sourceChannels: "wechat",
        primaryAngle: "先讲结果再给三步",
        latestDigest: "",
        latestPack: "",
        latestDraftTitle: "春季成交短视频稿",
        latestDraftBody: "",
        publishTargets: ["douyin", "xiaohongshu"],
        publishStatus: "dispatch_error",
        latestPublishFeedback: "失败: xiaohongshu | 可重试: douyin",
        successfulPlatforms: [],
        failedPlatforms: ["xiaohongshu"],
        retryablePlatforms: ["douyin"],
        nextAction: "先修复授权再回到 Publisher",
        reuseNotes: "保留数字 hook 和结尾 CTA",
        status: "publishing",
        createdAt: 160,
        updatedAt: 190,
      },
    ]);
    await draftStore.writeDraftsToStore([
      {
        id: "draft-1",
        title: "春季成交短视频稿",
        body: "先讲结果，再给三步检查，最后评论区领取模板。",
        source: "publisher",
        workflowRunId: "creator-run-1",
        workflowScenarioId: "creator-studio",
        workflowStageId: "preflight",
        createdAt: 170,
        updatedAt: 195,
      },
    ]);
    await publishJobStore.createPublishJobRecord({
      draftId: "draft-1",
      draftTitle: "春季成交短视频稿",
      draftBody: "先讲结果，再给三步检查，最后评论区领取模板。",
      platforms: ["douyin", "xiaohongshu"],
      mode: "dispatch",
      status: "queued",
    });
    await taskStore.writeTasksToStore([
      {
        id: "task-1",
        name: "Assistant - Publisher xiaohongshu variant",
        status: "running",
        detail: "春季成交短视频稿",
        workflowRunId: "creator-run-1",
        workflowScenarioId: "creator-studio",
        workflowStageId: "preflight",
        workflowSource: "Publisher 生成平台修正版",
        workflowNextStep: "检查平台语气和 CTA，再决定是否自动发布。",
        workflowTriggerType: "manual",
        createdAt: 180,
        updatedAt: 210,
      },
    ]);

    await supportAssetStore.writeSupportAssetsToStore([
      {
        id: "support-asset-1",
        workflowRunId: "support-run-1",
        scenarioId: "support-ops",
        ticketId: "ticket-1",
        customer: "Nora",
        channel: "whatsapp",
        issueSummary: "Broken hinge on delivery.",
        latestDigest: "",
        latestReply: "We will ship a replacement hinge within 48 hours.",
        escalationTask: "",
        faqDraft: "Broken hinge replacements require order number and photos.",
        nextAction: "Archive the approved reply into FAQ.",
        status: "completed",
        createdAt: 200,
        updatedAt: 260,
      },
    ]);

    await researchAssetStore.writeResearchAssetsToStore([
      {
        id: "research-asset-1",
        workflowRunId: "research-run-1",
        scenarioId: "research-radar",
        reportId: "report-1",
        topic: "Window hardware demand in GCC",
        audience: "Sales leadership",
        angle: "What changes replacement demand timing",
        sources: "Trade forums, service tickets, distributor notes",
        latestReport: "",
        latestBrief: "Replacement demand spikes when installation partners lag on inspection.",
        vaultQuery: "gcc replacement demand hinge hardware",
        nextAction: "",
        status: "routing",
        createdAt: 300,
        updatedAt: 360,
      },
    ]);

    const salesResponse = await route.POST(
      new Request("http://localhost/api/runtime/recommendations/hero-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family: "sales",
          workflowRunId: "sales-run-1",
          source: "Regression sales intake",
        }),
      }),
    );
    const salesPayload = await salesResponse.json();
    assert.equal(salesResponse.status, 200, "Sales recommendation route should return success.");
    assert.equal(
      salesPayload?.data?.recommendation?.recommendedAction?.kind,
      "resume_sales_workflow",
      "Sales recommendation route should preserve awaiting-human action semantics.",
    );

    const supportResponse = await route.POST(
      new Request("http://localhost/api/runtime/recommendations/hero-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family: "support",
        }),
      }),
    );
    const supportPayload = await supportResponse.json();
    const creatorResponse = await route.POST(
      new Request("http://localhost/api/runtime/recommendations/hero-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family: "creator",
          workflowRunId: "creator-run-1",
        }),
      }),
    );
    const creatorPayload = await creatorResponse.json();
    assert.equal(
      creatorPayload?.data?.recommendation?.recommendedAction?.kind,
      "resume_creator_workflow",
      "Creator recommendation route should preserve awaiting-human creator action semantics.",
    );
    assert.equal(
      creatorPayload?.data?.recommendation?.recommendedAction?.jumpTarget?.kind,
      "publisher",
      "Creator recommendation route should expose publisher jump targets.",
    );
    assert.equal(
      creatorPayload?.data?.recommendation?.sections?.some((section) => section.id === "creator_draft_signals"),
      true,
      "Creator recommendation route should include draft sections.",
    );
    assert.equal(
      creatorPayload?.data?.recommendation?.sections?.some((section) => section.id === "creator_connector_signals"),
      true,
      "Creator recommendation route should include connector signal sections.",
    );
    assert.equal(
      creatorPayload?.data?.recommendation?.sections?.some((section) => section.id === "creator_task_signals"),
      true,
      "Creator recommendation route should include task signal sections.",
    );

    assert.equal(
      supportPayload?.data?.workflowRunId,
      "support-run-1",
      "Support recommendation route should fall back to the latest scenario run.",
    );
    assert.equal(
      supportPayload?.data?.recommendation?.recommendedAction?.kind,
      "reuse_support_asset",
      "Support recommendation route should preserve completed-run asset reuse semantics.",
    );

    const researchResponse = await route.POST(
      new Request("http://localhost/api/runtime/recommendations/hero-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family: "research",
          workflowRunId: "research-run-1",
        }),
      }),
    );
    const researchPayload = await researchResponse.json();
    assert.equal(
      researchPayload?.data?.recommendation?.recommendedAction?.kind,
      "advance_research_workflow",
      "Research recommendation route should preserve running-stage action semantics.",
    );
    assert.equal(
      Array.isArray(researchPayload?.data?.recommendation?.sections),
      true,
      "Research recommendation route should return structured sections.",
    );

    const summaryResponse = await summaryRoute.GET();
    const summaryPayload = await summaryResponse.json();
    assert.equal(summaryResponse.status, 200, "Hero recommendation summary route should return success.");
    assert.equal(
      summaryPayload?.data?.summary?.sales?.recommendation?.recommendedAction?.kind,
      "resume_sales_workflow",
      "Hero recommendation summary route should include sales recommendation output.",
    );
    assert.equal(
      summaryPayload?.data?.summary?.creator?.recommendation?.recommendedAction?.kind,
      "resume_creator_workflow",
      "Hero recommendation summary route should include creator recommendation output.",
    );
    assert.equal(
      summaryPayload?.data?.summary?.support?.recommendation?.recommendedAction?.kind,
      "reuse_support_asset",
      "Hero recommendation summary route should include support recommendation output.",
    );

    const routeSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "app",
        "api",
        "runtime",
        "recommendations",
        "hero-workflow",
        "route.ts",
      ),
      "utf8",
    );
    assert.match(
      routeSource,
      /buildRuntimeHeroWorkflowRecommendation/,
      "Hero recommendation route should delegate to the shared server recommendation helper.",
    );
    const summaryRouteSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "app",
        "api",
        "runtime",
        "recommendations",
        "hero-workflows",
        "summary",
        "route.ts",
      ),
      "utf8",
    );
    assert.match(
      summaryRouteSource,
      /buildRuntimeHeroWorkflowRecommendationSummary/,
      "Hero recommendation summary route should reuse the server-side aggregation helper.",
    );

    const salesPanelSource = await readFile(
      path.join(PROJECT_ROOT, "src", "components", "workflows", "SalesHeroWorkflowPanel.tsx"),
      "utf8",
    );
    assert.match(
      salesPanelSource,
      /useRuntimeHeroRecommendation/,
      "Hero workflow panels should consume the runtime recommendation hook.",
    );
    const creatorPanelSource = await readFile(
      path.join(PROJECT_ROOT, "src", "components", "workflows", "CreatorHeroWorkflowPanel.tsx"),
      "utf8",
    );
    assert.match(
      creatorPanelSource,
      /useRuntimeHeroRecommendation/,
      "Creator hero workflow panel should consume the runtime recommendation hook.",
    );
    assert.match(
      creatorPanelSource,
      /buildCreatorHeroWorkflowRecommendation/,
      "Creator hero workflow panel should keep a deterministic local fallback recommendation.",
    );

    const assetConsoleSource = await readFile(
      path.join(PROJECT_ROOT, "src", "components", "workflows", "UnifiedAssetConsole.tsx"),
      "utf8",
    );
    assert.match(
      assetConsoleSource,
      /useRuntimeHeroWorkflowSummary/,
      "Unified Asset Console should consume the shared runtime hero workflow summary hook.",
    );
    assert.match(
      assetConsoleSource,
      /heroRecommendations/,
      "Unified Asset Console should surface hero workflow recommendation slices.",
    );
    assert.match(
      assetConsoleSource,
      /creator/,
      "Unified Asset Console should include creator hero recommendation coverage.",
    );
    assert.match(
      assetConsoleSource,
      /heroRecommendationPhase/,
      "Unified Asset Console should track runtime recommendation loading state.",
    );
    assert.match(
      assetConsoleSource,
      /heroRecommendationRefreshKey/,
      "Unified Asset Console should support manual refresh for runtime recommendations.",
    );

    const knowledgeVaultSource = await readFile(
      path.join(PROJECT_ROOT, "src", "components", "apps", "KnowledgeVaultAppWindow.tsx"),
      "utf8",
    );
    assert.match(
      knowledgeVaultSource,
      /useRuntimeHeroWorkflowSummary/,
      "Knowledge Vault should consume the shared runtime hero workflow summary hook.",
    );
    assert.match(
      knowledgeVaultSource,
      /heroRecommendations/,
      "Knowledge Vault should surface cross-workflow hero recommendations.",
    );
    assert.match(
      knowledgeVaultSource,
      /label: "内容"/,
      "Knowledge Vault should include creator in the cross-workflow recommendation summary.",
    );
    assert.match(
      knowledgeVaultSource,
      /heroRecommendationPhase/,
      "Knowledge Vault should track hero recommendation runtime state.",
    );
    assert.match(
      knowledgeVaultSource,
      /heroRecommendationRefreshKey/,
      "Knowledge Vault should support manual hero recommendation refresh.",
    );

    const heroSummaryHookSource = await readFile(
      path.join(PROJECT_ROOT, "src", "components", "workflows", "useRuntimeHeroWorkflowSummary.ts"),
      "utf8",
    );
    assert.match(
      heroSummaryHookSource,
      /\/api\/runtime\/recommendations\/hero-workflows\/summary/,
      "Shared hero workflow summary hook should target the runtime summary route.",
    );
    assert.match(
      heroSummaryHookSource,
      /unavailableMessage/,
      "Shared hero workflow summary hook should preserve consumer-specific unavailable copy.",
    );

    console.log("hero workflow recommendation route regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const localStorage = installBrowserStub();
  await runSalesAndKnowledgeRegression(localStorage);
  await runSupportAndKnowledgeRegression(localStorage);
  await runCreatorWorkflowHandoffRegression(localStorage);
  await runCreatorPublishFeedbackRegression();
  await runCreatorAssetQueryRegression();
  await runCreatorAssetQueryRouteRegression();
  await runKnowledgeReuseSourceGuard();
  await runVaultHybridContextRegression();
  await runVaultMixedQueryRegression();
  await runPublishRecommendationRegression();
  await runWorkflowSurfaceRecommendationRegression();
  await runAppApiAndStorageRegression(localStorage);
  await runRequestBodyGuardRegression();
  await runTaskWorkflowMetadataRegression(localStorage);
  await runServerBackedRetryRegression(localStorage);
  await runExecutionRoutingPlanRegression();
  await runAgentExecutorRegression(localStorage);
  await runSkillRuntimeAndMemoryRegression();
  await runAgentExecutorFallbackHealthRegression();
  await runExecutorSessionStoreRegression();
  await runCoreStateServerSyncRegression(localStorage);
  await runWorkflowRunStoreRegression();
  await runLegacyPutGuardRegression();
  await runJsonStoreRegression();
  await runPublishQueueRegression();
  await runHeroWorkflowRecommendationRegression(localStorage);
  await runHeroWorkflowRecommendationRouteRegression();
  console.log("\n[workflow-regression] all core workflow regressions passed");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[workflow-regression] failed");
    console.error(error);
    process.exit(1);
  });
