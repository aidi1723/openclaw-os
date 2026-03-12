"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookCopy,
  BookOpenCheck,
  Copy,
  Save,
  ShieldAlert,
  Trash2,
  Waypoints,
} from "lucide-react";

import { AppToast } from "@/components/AppToast";
import { useTimedToast } from "@/hooks/useTimedToast";
import { getDisplayLanguage } from "@/lib/app-display";
import {
  createSavedSolutionBlueprint,
  deleteSavedSolutionBlueprint,
  loadSavedSolutionBlueprints,
  subscribeSavedSolutionBlueprints,
} from "@/lib/saved-solution-blueprints";
import type { IndustrySolutionStarter } from "@/lib/solution-starters";
import { getSolutionBlueprint, type SolutionBlueprint } from "@/lib/solution-blueprints";
import { upsertPlaybook } from "@/lib/playbooks";
import type { InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp } from "@/lib/ui-events";

function getCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "en") {
    return {
      eyebrow: "Solution Blueprint",
      playbook: "Playbook",
      sop: "Execution SOP",
      kpi: "Landing KPI",
      guardrails: "Human Guardrails",
      owner: "Owner",
      automation: "Automation",
      exit: "Exit condition",
      empty: "This solution does not have a blueprint yet.",
      saveSop: "Save as My SOP",
      saveBlueprint: "Save blueprint snapshot",
      openPlaybooks: "Open My Playbooks",
      saved: "Saved Blueprints",
      savedEmpty: "No local blueprint snapshots yet.",
      copied: "Copied",
      copy: "Copy JSON",
      remove: "Delete",
      savedToast: "Saved to My Playbooks",
      snapshotToast: "Blueprint snapshot saved",
      deleteToast: "Snapshot deleted",
      saveNote: "Store the current delivery logic as a reusable operating template.",
    };
  }
  if (displayLanguage === "ja") {
    return {
      eyebrow: "Solution Blueprint",
      playbook: "Playbook",
      sop: "実行 SOP",
      kpi: "定着 KPI",
      guardrails: "人による境界",
      owner: "担当",
      automation: "自動化",
      exit: "完了条件",
      empty: "このソリューションにはまだ blueprint がありません。",
      saveSop: "My SOP に保存",
      saveBlueprint: "blueprint を保存",
      openPlaybooks: "My Playbooks を開く",
      saved: "保存済み Blueprints",
      savedEmpty: "まだローカル blueprint はありません。",
      copied: "コピーしました",
      copy: "JSON をコピー",
      remove: "削除",
      savedToast: "My Playbooks に保存しました",
      snapshotToast: "Blueprint を保存しました",
      deleteToast: "Snapshot を削除しました",
      saveNote: "現在の業務ロジックを再利用できる運用テンプレートとして保存します。",
    };
  }
  return {
    eyebrow: "Solution Blueprint",
    playbook: "业务打法",
    sop: "执行 SOP",
    kpi: "落地 KPI",
    guardrails: "人机边界",
    owner: "负责人",
    automation: "自动化",
    exit: "收口条件",
    empty: "当前方案还没有配置蓝图。",
    saveSop: "保存到 My SOP",
    saveBlueprint: "保存蓝图快照",
    openPlaybooks: "打开我的 Playbooks",
    saved: "已保存蓝图",
    savedEmpty: "当前还没有本地蓝图快照。",
    copied: "已复制",
    copy: "复制 JSON",
    remove: "删除",
    savedToast: "已写入 My Playbooks",
    snapshotToast: "蓝图快照已保存",
    deleteToast: "已删除快照",
    saveNote: "把当前方案逻辑沉淀成可复用、可交付的执行模板。",
  };
}

function buildBlueprintCopyText(
  starter: IndustrySolutionStarter,
  blueprint: SolutionBlueprint,
) {
  const playbookLines = blueprint.playbook.map((item, index) => `${index + 1}. ${item}`);
  const sopLines = blueprint.sop.map(
    (item, index) =>
      `${index + 1}. ${item.step}\n负责人：${item.owner}\n自动化：${item.automation}\n收口条件：${item.exit}`,
  );
  const kpiLines = blueprint.kpis.map(
    (item) => `- ${item.label}: ${item.target} | ${item.note}`,
  );
  const guardrailLines = blueprint.guardrails.map((item) => `- ${item}`);

  return [
    `${starter.title} · Solution Blueprint`,
    "",
    "定位",
    blueprint.positioning,
    "",
    "业务打法",
    ...playbookLines,
    "",
    "执行 SOP",
    ...sopLines,
    "",
    "落地 KPI",
    ...kpiLines,
    "",
    "人机边界",
    ...guardrailLines,
  ].join("\n");
}

export function SolutionBlueprintPanel({
  language,
  starter,
}: {
  language: InterfaceLanguage;
  starter: IndustrySolutionStarter;
}) {
  const copy = getCopy(language);
  const blueprint = getSolutionBlueprint(starter.id);
  const [savedBlueprints, setSavedBlueprints] = useState(() =>
    loadSavedSolutionBlueprints(),
  );
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    const refresh = () => setSavedBlueprints(loadSavedSolutionBlueprints());
    refresh();
    const unsub = subscribeSavedSolutionBlueprints(refresh);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const currentSavedBlueprints = useMemo(
    () =>
      savedBlueprints
        .filter((item) => item.starterId === starter.id)
        .slice(0, 3),
    [savedBlueprints, starter.id],
  );

  const copyJson = useCallback(async (value: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      showToast(copy.copied, "ok");
    } catch {
      showToast("Copy failed", "error");
    }
  }, [copy.copied, showToast]);

  if (!blueprint) {
    return (
      <div className="mt-5 rounded-[30px] border border-white/10 bg-black/12 p-5 text-sm text-white/60">
        {copy.empty}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_100%)] p-4 sm:p-5">
      <AppToast toast={toast} />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
            <BookOpenCheck className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>
          <div className="mt-3 text-xl font-semibold text-white">{starter.title}</div>
          <div className="mt-2 text-sm leading-6 text-white/70">{blueprint.positioning}</div>
          <div className="mt-3 text-xs leading-5 text-white/55">{copy.saveNote}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              upsertPlaybook({
                id: `solution-blueprint:${starter.id}`,
                title: `${starter.title} · SOP`,
                desc: blueprint.positioning,
                actions: [
                  ...starter.apps.slice(0, 3).map((appId) => ({
                    type: "open_app" as const,
                    appId,
                    label: `打开 ${appId}`,
                  })),
                  {
                    type: "copy" as const,
                    label: "复制执行蓝图",
                    text: buildBlueprintCopyText(starter, blueprint),
                  },
                ],
              });
              showToast(copy.savedToast, "ok");
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
          >
            <Save className="h-4 w-4" />
            {copy.saveSop}
          </button>
          <button
            type="button"
            onClick={() => {
              createSavedSolutionBlueprint({
                starterId: starter.id,
                starterTitle: starter.title,
                starterSummary: starter.summary,
                blueprint,
              });
              showToast(copy.snapshotToast, "ok");
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            <BookCopy className="h-4 w-4" />
            {copy.saveBlueprint}
          </button>
          <button
            type="button"
            onClick={() => requestOpenApp("solo_ops")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            <Waypoints className="h-4 w-4" />
            {copy.openPlaybooks}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-4">
          <div className="rounded-[26px] border border-white/10 bg-black/14 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Waypoints className="h-4 w-4 text-sky-300" />
              {copy.playbook}
            </div>
            <div className="mt-4 space-y-3">
              {blueprint.playbook.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-white/80"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/14 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              {copy.guardrails}
            </div>
            <div className="mt-4 space-y-3">
              {blueprint.guardrails.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-white/80"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/14 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BookCopy className="h-4 w-4 text-violet-300" />
              {copy.saved}
            </div>
            <div className="mt-4 space-y-3">
              {currentSavedBlueprints.length > 0 ? (
                currentSavedBlueprints.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/8 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.starterTitle}</div>
                        <div className="mt-1 text-xs text-white/55">
                          {new Date(item.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyJson(item)}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/15"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copy.copy}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteSavedSolutionBlueprint(item.id);
                            showToast(copy.deleteToast, "ok");
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200/20 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-100 transition-colors hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {copy.remove}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-white/70">
                      {item.starterSummary}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/6 p-4 text-sm text-white/55">
                  {copy.savedEmpty}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[26px] border border-white/10 bg-black/14 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BookOpenCheck className="h-4 w-4 text-emerald-300" />
              {copy.sop}
            </div>
            <div className="mt-4 space-y-3">
              {blueprint.sop.map((item, index) => (
                <div
                  key={`${item.step}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/8 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-xl">
                      <div className="text-sm font-semibold text-white">{item.step}</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                            {copy.owner}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-white/75">{item.owner}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                            {copy.exit}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-white/75">{item.exit}</div>
                        </div>
                      </div>
                    </div>
                    <div className="max-w-sm rounded-2xl border border-white/10 bg-black/18 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                        {copy.automation}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-white/75">{item.automation}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/14 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart3 className="h-4 w-4 text-rose-300" />
              {copy.kpi}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {blueprint.kpis.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/8 p-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                    {item.label}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">{item.target}</div>
                  <div className="mt-2 text-sm leading-6 text-white/70">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
