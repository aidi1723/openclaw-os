"use client";

import { BarChart3, BookOpenCheck, ShieldAlert, Waypoints } from "lucide-react";

import { getDisplayLanguage } from "@/lib/app-display";
import type { IndustrySolutionStarter } from "@/lib/solution-starters";
import { getSolutionBlueprint } from "@/lib/solution-blueprints";
import type { InterfaceLanguage } from "@/lib/settings";

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
  };
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

  if (!blueprint) {
    return (
      <div className="mt-5 rounded-[30px] border border-white/10 bg-black/12 p-5 text-sm text-white/60">
        {copy.empty}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
            <BookOpenCheck className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>
          <div className="mt-3 text-xl font-semibold text-white">{starter.title}</div>
          <div className="mt-2 text-sm leading-6 text-white/70">{blueprint.positioning}</div>
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
