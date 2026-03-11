"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FolderKanban, LibraryBig, Sparkles } from "lucide-react";

import { getDisplayLanguage } from "@/lib/app-display";
import {
  getCreatorAssets,
  subscribeCreatorAssets,
  type CreatorAssetRecord,
} from "@/lib/creator-assets";
import { getResearchAssets, subscribeResearchAssets, type ResearchAssetRecord } from "@/lib/research-assets";
import { getSalesAssets, subscribeSalesAssets, type SalesAssetRecord } from "@/lib/sales-assets";
import type { InterfaceLanguage } from "@/lib/settings";
import { getSupportAssets, subscribeSupportAssets, type SupportAssetRecord } from "@/lib/support-assets";
import type { AssetJumpTarget } from "@/lib/asset-jumps";

type AssetFamily = "all" | "sales" | "creator" | "support" | "research";

type AssetConsoleEntry = {
  id: string;
  family: Exclude<AssetFamily, "all">;
  workflowLabel: string;
  title: string;
  detail: string;
  status: string;
  updatedAt: number;
  jumpTarget?: AssetJumpTarget;
};

function getCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "en") {
    return {
      eyebrow: "Asset Console",
      title: "Results should accumulate as an operating layer, not disappear as one-off tasks.",
      desc:
        "Every workflow run should leave behind reusable assets. Filter by chain, inspect what changed, and jump straight back to the exact execution node.",
      empty: "No assets yet. Run one hero workflow and the local asset layer will begin to fill.",
      open: "Open asset",
      updated: "Updated",
      filters: {
        all: "All assets",
        sales: "Sales",
        creator: "Creator",
        support: "Support",
        research: "Research",
      },
    };
  }
  if (displayLanguage === "ja") {
    return {
      eyebrow: "Asset Console",
      title: "結果を単発タスクで終わらせず、運用資産として残します。",
      desc:
        "各 workflow run は再利用できる資産を残すべきです。チェーン別に絞り込み、何が更新されたかを見て、そのまま該当ノードへ戻れます。",
      empty: "まだ資産がありません。Hero Workflow を 1 回動かすとローカル資産層が埋まり始めます。",
      open: "資産を開く",
      updated: "更新",
      filters: {
        all: "すべて",
        sales: "Sales",
        creator: "Creator",
        support: "Support",
        research: "Research",
      },
    };
  }
  return {
    eyebrow: "Asset Console",
    title: "结果不该做完就消失，而要逐步沉淀成可复用的业务资产层。",
    desc:
      "每次 workflow run 都应该留下一份可调用资产。这里统一按业务链查看、筛选和回跳，不再让资产散落在各个 App 里。",
    empty: "还没有结果资产。先跑一次 Hero Workflow，本地资产层就会开始累积。",
    open: "打开资产",
    updated: "更新于",
    filters: {
      all: "全部资产",
      sales: "销售",
      creator: "内容",
      support: "客服",
      research: "研究",
    },
  };
}

function buildSalesEntries(items: SalesAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "sales",
    workflowLabel: "Sales Pipeline",
    title: asset.company || asset.contactName || "销售资产",
    detail:
      asset.latestDraftSubject ||
      asset.nextAction ||
      asset.requirementSummary ||
      "已沉淀客户偏好、推进节奏和下一步动作。",
    status: asset.quoteStatus || asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.contactId
        ? {
            kind: "record",
            appId: "personal_crm",
            eventName: "openclaw:crm-select",
            eventDetail: { contactId: asset.contactId },
          }
        : asset.emailThreadId
          ? {
              kind: "record",
              appId: "email_assistant",
              eventName: "openclaw:email-assistant-select",
              eventDetail: { threadId: asset.emailThreadId },
            }
          : asset.dealId
            ? {
                kind: "record",
                appId: "deal_desk",
                eventName: "openclaw:deal-desk-select",
                eventDetail: { dealId: asset.dealId },
              }
            : undefined,
  }));
}

function buildCreatorEntries(items: CreatorAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "creator",
    workflowLabel: "Creator Studio",
    title: asset.topic || "内容增长资产",
    detail:
      asset.latestDraftTitle ||
      asset.primaryAngle ||
      asset.nextAction ||
      "已沉淀选题角度、多平台内容包和发布候选稿。",
    status: asset.publishStatus || asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.draftId
        ? {
            kind: "publisher",
            prefill: {
              draftId: asset.draftId,
              workflowRunId: asset.workflowRunId,
              workflowScenarioId: asset.scenarioId,
            },
          }
        : asset.repurposerProjectId
          ? {
              kind: "record",
              appId: "content_repurposer",
              eventName: "openclaw:content-repurposer-select",
              eventDetail: { projectId: asset.repurposerProjectId },
            }
          : asset.radarItemId
            ? {
                kind: "record",
                appId: "creator_radar",
                eventName: "openclaw:creator-radar-select",
                eventDetail: { radarItemId: asset.radarItemId },
              }
            : undefined,
  }));
}

function buildSupportEntries(items: SupportAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "support",
    workflowLabel: "Support Ops",
    title: asset.customer || "客服资产",
    detail:
      asset.latestReply ||
      asset.faqDraft ||
      asset.nextAction ||
      "已沉淀建议回复、升级动作和 FAQ 片段。",
    status: asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.ticketId
        ? {
            kind: "record",
            appId: "support_copilot",
            eventName: "openclaw:support-copilot-select",
            eventDetail: { ticketId: asset.ticketId },
          }
        : asset.inboxItemId
          ? {
              kind: "record",
              appId: "inbox_declutter",
              eventName: "openclaw:inbox-select",
              eventDetail: { itemId: asset.inboxItemId },
            }
          : undefined,
  }));
}

function buildResearchEntries(items: ResearchAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "research",
    workflowLabel: "Research Radar",
    title: asset.topic || "研究资产",
    detail:
      asset.latestBrief ||
      asset.latestReport ||
      asset.nextAction ||
      "已沉淀研究简报、观察框架和决策摘要。",
    status: asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.briefId
        ? {
            kind: "record",
            appId: "morning_brief",
            eventName: "openclaw:morning-brief-select",
            eventDetail: { briefId: asset.briefId },
          }
        : asset.reportId
          ? {
              kind: "record",
              appId: "deep_research_hub",
              eventName: "openclaw:research-hub-select",
              eventDetail: { reportId: asset.reportId },
            }
          : undefined,
  }));
}

export function UnifiedAssetConsole({
  language,
  onOpenAsset,
}: {
  language: InterfaceLanguage;
  onOpenAsset: (target?: AssetJumpTarget) => void;
}) {
  const [family, setFamily] = useState<AssetFamily>("all");
  const [revision, setRevision] = useState(0);
  const copy = getCopy(language);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const offSales = subscribeSalesAssets(bump);
    const offCreator = subscribeCreatorAssets(bump);
    const offSupport = subscribeSupportAssets(bump);
    const offResearch = subscribeResearchAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      offSales();
      offCreator();
      offSupport();
      offResearch();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const entries = useMemo(() => {
    void revision;
    return [
      ...buildSalesEntries(getSalesAssets()),
      ...buildCreatorEntries(getCreatorAssets()),
      ...buildSupportEntries(getSupportAssets()),
      ...buildResearchEntries(getResearchAssets()),
    ].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [revision]);

  const filteredEntries =
    family === "all" ? entries : entries.filter((entry) => entry.family === family);

  const counts = useMemo(
    () => ({
      sales: entries.filter((entry) => entry.family === "sales").length,
      creator: entries.filter((entry) => entry.family === "creator").length,
      support: entries.filter((entry) => entry.family === "support").length,
      research: entries.filter((entry) => entry.family === "research").length,
    }),
    [entries],
  );

  return (
    <div className="mt-5 rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
            <LibraryBig className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>
          <div className="mt-3 text-xl font-semibold text-white">{copy.title}</div>
          <div className="mt-2 text-sm leading-6 text-white/70">{copy.desc}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Sales</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.sales}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Creator</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.creator}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Support</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.support}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Research</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.research}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "sales", "creator", "support", "research"] as AssetFamily[]).map((item) => {
          const active = item === family;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFamily(item)}
              className={[
                "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-white/20 bg-white/16 text-white"
                  : "border-white/10 bg-white/8 text-white/75 hover:bg-white/12",
              ].join(" ")}
            >
              {copy.filters[item]}
            </button>
          );
        })}
      </div>

      {filteredEntries.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {filteredEntries.slice(0, 8).map((entry) => (
            <div
              key={entry.id}
              className="rounded-[24px] border border-white/10 bg-black/14 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                      {entry.workflowLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-white/65">
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-3 text-base font-semibold text-white">{entry.title}</div>
                  <div className="mt-2 line-clamp-3 text-sm leading-6 text-white/70">
                    {entry.detail}
                  </div>
                </div>
                <FolderKanban className="h-5 w-5 shrink-0 text-white/35" />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs text-white/55">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.updated} {new Date(entry.updatedAt).toLocaleString()}
                </div>
                {entry.jumpTarget ? (
                  <button
                    type="button"
                    onClick={() => onOpenAsset(entry.jumpTarget)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/15"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {copy.open}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-black/14 p-5 text-sm leading-6 text-white/60">
          {copy.empty}
        </div>
      )}
    </div>
  );
}
