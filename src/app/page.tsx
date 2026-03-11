"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Globe2,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { AppId, AppState, AppWindowState, ModeId } from "@/apps/types";
import { getMode, modes } from "@/apps/modes";
import { getApp, listApps } from "@/apps/registry";
import { DesktopIcon } from "@/components/DesktopIcon";
import { StatusClock } from "@/components/StatusClock";
import { SystemTrayWindows } from "@/components/SystemTrayWindows";
import { PublishQueueRunner } from "@/components/PublishQueueRunner";
import { SolutionBlueprintPanel } from "@/components/workflows/SolutionBlueprintPanel";
import { UnifiedAssetConsole } from "@/components/workflows/UnifiedAssetConsole";
import { WorkflowSignalCenter } from "@/components/workflows/WorkflowSignalCenter";
import {
  jumpToAssetTarget,
  type AssetJumpTarget,
} from "@/lib/asset-jumps";
import {
  getAppDisplayName,
  getDisplayLanguage,
  getModeDisplayName,
  getShellLabel,
  resolveLanguageLocale,
} from "@/lib/app-display";
import { getLanguageLabel } from "@/lib/language";
import {
  defaultSettings,
  hasSavedSettings,
  loadSettings,
  saveSettings,
  type InterfaceLanguage,
  type LlmProviderId,
  type PersonalizationSettings,
} from "@/lib/settings";
import { Spotlight } from "@/components/Spotlight";
import {
  getCreatorAssetByWorkflowRunId,
  subscribeCreatorAssets,
} from "@/lib/creator-assets";
import {
  getIndustryBundle,
  mapIndustryToWorkspaceIndustry,
  type IndustryId,
} from "@/lib/industry-solutions";
import {
  getResearchAssetByWorkflowRunId,
  subscribeResearchAssets,
} from "@/lib/research-assets";
import {
  getSalesAssetByWorkflowRunId,
  subscribeSalesAssets,
} from "@/lib/sales-assets";
import {
  industrySolutionStarters,
  runIndustrySolutionStarterActions,
  type IndustrySolutionStarter,
} from "@/lib/solution-starters";
import {
  getSupportAssetByWorkflowRunId,
  subscribeSupportAssets,
} from "@/lib/support-assets";
import type {
  ContentRepurposerPrefill,
  CreatorRadarPrefill,
  DealDeskPrefill,
  EmailAssistantPrefill,
  KnowledgeVaultPrefill,
  MorningBriefPrefill,
  PersonalCrmPrefill,
  PublisherPrefill,
  ProjectOpsPrefill,
  RecruitingDeskPrefill,
  ResearchHubPrefill,
  SettingsTargetTab,
  SupportCopilotPrefill,
} from "@/lib/ui-events";
import {
  getWorkspaceScenario,
  workspaceRoleDesks,
  type WorkspaceRoleDesk,
} from "@/lib/workspace-presets";
import {
  requestOpenApp,
  requestOpenSettings,
} from "@/lib/ui-events";
import {
  getWorkflowRuns,
  startWorkflowRun,
  subscribeWorkflowRuns,
  type WorkflowRunRecord,
} from "@/lib/workflow-runs";

export default function Home() {
  const languageWelcomeKey = "openclaw.language_welcome.v1";
  const [volumeLevel, setVolumeLevel] = useState(2);
  const [modeId, setModeId] = useState<ModeId>("creator");
  const [personalization, setPersonalization] = useState<PersonalizationSettings>(
    () => defaultSettings.personalization,
  );
  const [showLanguageWelcome, setShowLanguageWelcome] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<LlmProviderId>("kimi");
  const [activeWindow, setActiveWindow] = useState<AppId | null>(null);
  const [desktopCanScrollUp, setDesktopCanScrollUp] = useState(false);
  const [desktopCanScrollDown, setDesktopCanScrollDown] = useState(false);

  const [appStateById, setAppStateById] = useState<Record<AppId, AppState>>({
    industry_hub: "closed",
    recruiting_desk: "closed",
    project_ops: "closed",
    deep_research_hub: "closed",
    financial_document_bot: "closed",
    social_media_autopilot: "closed",
    website_seo_studio: "closed",
    language_learning_desk: "closed",
    tech_news_digest: "closed",
    morning_brief: "closed",
    meeting_copilot: "closed",
    personal_crm: "closed",
    inbox_declutter: "closed",
    support_copilot: "closed",
    second_brain: "closed",
    email_assistant: "closed",
    deal_desk: "closed",
    family_calendar: "closed",
    habit_tracker: "closed",
    health_tracker: "closed",
    creator_radar: "closed",
    content_repurposer: "closed",
    solo_ops: "closed",
    solutions_hub: "closed",
    media_ops: "closed",
    creative_studio: "closed",
    knowledge_vault: "closed",
    account_center: "closed",
    task_manager: "closed",
    openclaw_console: "closed",
    publisher: "closed",
    settings: "closed",
  });
  const [appZOrder, setAppZOrder] = useState<AppId[]>([]);

  const spotlightOpenRef = useRef(spotlightOpen);
  const appStateByIdRef = useRef(appStateById);
  const appZOrderRef = useRef(appZOrder);
  const activeWindowRef = useRef(activeWindow);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    spotlightOpenRef.current = spotlightOpen;
  }, [spotlightOpen]);
  useEffect(() => {
    appStateByIdRef.current = appStateById;
  }, [appStateById]);
  useEffect(() => {
    appZOrderRef.current = appZOrder;
  }, [appZOrder]);
  useEffect(() => {
    activeWindowRef.current = activeWindow;
  }, [activeWindow]);

  useEffect(() => {
    const apply = () => {
      const settings = loadSettings();
      setPersonalization(settings.personalization);
      setActiveProvider(settings.llm.activeProvider);
    };
    apply();
    window.addEventListener("openclaw:settings", apply);
    window.addEventListener("storage", apply);
    const onOpenApp = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          appId?: AppId;
          settingsTab?: SettingsTargetTab;
          dealPrefill?: DealDeskPrefill;
          emailDraft?: EmailAssistantPrefill;
          crmPrefill?: PersonalCrmPrefill;
          supportPrefill?: SupportCopilotPrefill;
          researchPrefill?: ResearchHubPrefill;
          projectOpsPrefill?: ProjectOpsPrefill;
          recruitingPrefill?: RecruitingDeskPrefill;
          vaultPrefill?: KnowledgeVaultPrefill;
          repurposerPrefill?: ContentRepurposerPrefill;
          creatorRadarPrefill?: CreatorRadarPrefill;
          morningBriefPrefill?: MorningBriefPrefill;
          publisherPrefill?: PublisherPrefill;
        }>
      ).detail;
      const appId = detail?.appId;
      if (!appId) return;
      setAppStateById((prev) => {
        const cur = prev[appId];
        if (cur === "closed") return { ...prev, [appId]: "opening" };
        if (cur === "minimized") return { ...prev, [appId]: "open" };
        if (cur === "closing") return { ...prev, [appId]: "opening" };
        return { ...prev, [appId]: "open" };
      });
      setAppZOrder((prev) => [...prev.filter((id) => id !== appId), appId]);
      setActiveWindow(appId);
      if (appId === "settings" && detail?.settingsTab) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:settings-focus", {
              detail: { tab: detail.settingsTab },
            }),
          );
        }, 0);
      }
      if (appId === "deal_desk" && detail?.dealPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:deal-desk-prefill", {
              detail: detail.dealPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "email_assistant" && detail?.emailDraft) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:email-assistant-prefill", {
              detail: detail.emailDraft,
            }),
          );
        }, 80);
      }
      if (appId === "personal_crm" && detail?.crmPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:crm-prefill", {
              detail: detail.crmPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "knowledge_vault" && detail?.vaultPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:vault-prefill", {
              detail: detail.vaultPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "support_copilot" && detail?.supportPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:support-copilot-prefill", {
              detail: detail.supportPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "deep_research_hub" && detail?.researchPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:research-hub-prefill", {
              detail: detail.researchPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "project_ops" && detail?.projectOpsPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:project-ops-prefill", {
              detail: detail.projectOpsPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "recruiting_desk" && detail?.recruitingPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:recruiting-desk-prefill", {
              detail: detail.recruitingPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "content_repurposer" && detail?.repurposerPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:content-repurposer-prefill", {
              detail: detail.repurposerPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "creator_radar" && detail?.creatorRadarPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:creator-radar-prefill", {
              detail: detail.creatorRadarPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "morning_brief" && detail?.morningBriefPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:morning-brief-prefill", {
              detail: detail.morningBriefPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "publisher" && detail?.publisherPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:publisher-prefill", {
              detail: detail.publisherPrefill,
            }),
          );
        }, 80);
      }
    };
    window.addEventListener("openclaw:open-app", onOpenApp);
    return () => {
      window.removeEventListener("openclaw:settings", apply);
      window.removeEventListener("storage", apply);
      window.removeEventListener("openclaw:open-app", onOpenApp);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const hasSeenWelcome = window.localStorage.getItem(languageWelcomeKey) === "1";
      if (!hasSeenWelcome && !hasSavedSettings()) {
        setShowLanguageWelcome(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return false;
    };

    const getVisibleWindows = () => {
      const states = appStateByIdRef.current;
      return appZOrderRef.current.filter((appId) => {
        const s = states[appId];
        return s === "open" || s === "opening";
      });
    };

    const getTopWindow = () => {
      const states = appStateByIdRef.current;
      const active = activeWindowRef.current;
      if (active && (states[active] === "open" || states[active] === "opening")) {
        return active;
      }
      return (
        [...appZOrderRef.current]
          .reverse()
          .find((appId) => {
            const s = states[appId];
            return s === "open" || s === "opening";
          }) ?? null
      );
    };

    const onGlobalKeys = (e: KeyboardEvent) => {
      // Spotlight toggle always available.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
        return;
      }

      if (spotlightOpenRef.current) return;

      // Window tiling (desktop UX).
      if ((e.metaKey || e.ctrlKey) && e.altKey) {
        if (isTypingTarget(e.target)) return;
        const top = getTopWindow();
        if (!top) return;
        const storageKey = `openclaw.window.${top}`;

        const key = e.key;
        if (key === "ArrowLeft") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "tile_left" },
            }),
          );
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "tile_right" },
            }),
          );
          return;
        }
        if (key === "ArrowUp") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "maximize" },
            }),
          );
          return;
        }
        if (key === "ArrowDown") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "restore" },
            }),
          );
          return;
        }
      }

      if (e.key === "Escape") {
        const top = getTopWindow();
        if (!top) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setAppStateById((prev) => ({ ...prev, [top]: "closing" }));
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        const top = getTopWindow();
        if (!top) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setAppStateById((prev) => ({ ...prev, [top]: "closing" }));
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) {
          // Restore all minimized windows.
          setAppStateById((prev) => {
            const next = { ...prev };
            for (const id of Object.keys(next) as AppId[]) {
              if (next[id] === "minimized") next[id] = "open";
            }
            return next;
          });
        } else {
          const top = getTopWindow();
          if (!top) return;
          setAppStateById((prev) => ({ ...prev, [top]: "minimized" }));
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "[" || e.key === "]")) {
        if (isTypingTarget(e.target)) return;
        const visible = getVisibleWindows();
        if (visible.length <= 1) return;
        e.preventDefault();

        const cur = getTopWindow();
        const idx = cur ? visible.indexOf(cur) : visible.length - 1;
        const dir = e.key === "]" ? 1 : -1;
        const next = visible[(idx + dir + visible.length) % visible.length];
        setAppZOrder((prev) => [...prev.filter((id) => id !== next), next]);
        setActiveWindow(next);
      }
    };

    window.addEventListener("keydown", onGlobalKeys);
    return () => window.removeEventListener("keydown", onGlobalKeys);
  }, []);

  const getVolumeIcon = () => {
    if (volumeLevel === 0) return <VolumeX className="w-4 h-4" />;
    if (volumeLevel === 1) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  const openApp = (appId: AppId) => {
    setAppStateById((prev) => {
      const cur = prev[appId];
      if (cur === "closed") return { ...prev, [appId]: "opening" };
      if (cur === "minimized") return { ...prev, [appId]: "open" };
      if (cur === "closing") return { ...prev, [appId]: "opening" };
      return { ...prev, [appId]: "open" };
    });
    focusApp(appId);
  };

  const restoreApp = (appId: AppId) => openApp(appId);

  const minimizeApp = (appId: AppId) =>
    setAppStateById((prev) => ({ ...prev, [appId]: "minimized" }));
  const closeApp = (appId: AppId) =>
    setAppStateById((prev) => ({ ...prev, [appId]: "closing" }));

  const focusApp = (appId: AppId) => {
    setAppZOrder((prev) => [...prev.filter((id) => id !== appId), appId]);
    setActiveWindow(appId);
  };

  const toggleAppFromDock = (appId: AppId) => {
    const cur = appStateById[appId];
    const next: AppState =
      cur === "closed"
        ? "opening"
        : cur === "minimized"
          ? "open"
          : cur === "open"
            ? "minimized"
            : cur === "closing"
              ? "opening"
              : "open";

    setAppStateById((prev) => ({ ...prev, [appId]: next }));
    if (next === "open" || next === "opening") focusApp(appId);
  };

  useEffect(() => {
    const ids = Object.keys(appStateById) as AppId[];
    const timers: number[] = [];
    const rafIds: number[] = [];

    for (const appId of ids) {
      const state = appStateById[appId];
      if (state === "opening") {
        const rafId = window.requestAnimationFrame(() => {
          setAppStateById((prev) =>
            prev[appId] === "opening" ? { ...prev, [appId]: "open" } : prev,
          );
        });
        const timeoutId = window.setTimeout(() => {
          setAppStateById((prev) =>
            prev[appId] === "opening" ? { ...prev, [appId]: "open" } : prev,
          );
        }, 120);
        rafIds.push(rafId);
        timers.push(timeoutId);
      } else if (state === "closing") {
        const timeoutId = window.setTimeout(() => {
          setAppStateById((prev) =>
            prev[appId] === "closing" ? { ...prev, [appId]: "closed" } : prev,
          );
          setAppZOrder((prev) => prev.filter((id) => id !== appId));
        }, 200);
        timers.push(timeoutId);
      }
    }

    return () => {
      for (const id of rafIds) window.cancelAnimationFrame(id);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [appStateById]);

  useEffect(() => {
    const nextActive =
      [...appZOrder]
        .reverse()
        .find((appId) => {
          const s = appStateById[appId];
          return s === "open" || s === "opening";
        }) ?? null;

    setActiveWindow((prev) => (prev === nextActive ? prev : nextActive));
  }, [appZOrder, appStateById]);

  const mode = useMemo(() => getMode(modeId), [modeId]);
  const workspaceScenario = useMemo(
    () => getWorkspaceScenario(personalization.activeScenarioId),
    [personalization.activeScenarioId],
  );
  const interfaceLanguage = personalization.interfaceLanguage;
  const desktopApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.desktopApps;
    if (personalization.customDesktopApps.length > 0) {
      return personalization.customDesktopApps;
    }
    return workspaceScenario?.desktopApps ?? mode.desktopApps;
  }, [mode.desktopApps, personalization, workspaceScenario]);
  const dockApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.dockApps;
    if (personalization.customDockApps.length > 0) {
      return personalization.customDockApps;
    }
    return workspaceScenario?.dockApps ?? mode.dockApps;
  }, [mode.dockApps, personalization, workspaceScenario]);
  const isAnyAppVisible = Object.values(appStateById).some(
    (s) => s === "opening" || s === "open",
  );

  const wallpaperClassName = useMemo(() => {
    const map: Record<PersonalizationSettings["desktopBackground"], string> = {
      aurora:
        "bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(135deg,#0b1220_0%,#1a1f3b_35%,#3a1c63_70%,#0b1220_100%)]",
      ocean:
        "bg-[radial-gradient(900px_circle_at_25%_15%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(1100px_circle_at_80%_45%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#06131f_0%,#0b3a5a_35%,#0b6aa6_65%,#06131f_100%)]",
      sunset:
        "bg-[radial-gradient(1100px_circle_at_20%_10%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(900px_circle_at_85%_35%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#1a0b1a_0%,#6a1b2d_35%,#ff6a00_70%,#1a0b1a_100%)]",
    };
    return map[personalization.desktopBackground];
  }, [personalization.desktopBackground]);

  const applyLanguage = (next: InterfaceLanguage) => {
    const settings = loadSettings();
    if (next === "custom" && !settings.personalization.customLanguageLabel.trim()) {
      requestOpenSettings("personalization");
      return;
    }
    saveSettings({
      ...settings,
      personalization: {
        ...settings.personalization,
        interfaceLanguage: next,
      },
    });
    try {
      window.localStorage.setItem(languageWelcomeKey, "1");
    } catch {
      // ignore
    }
    setShowLanguageWelcome(false);
  };

  const featuredSolutionStarters = useMemo(
    () =>
      [
        "sales-inbound-quote",
        "creator-campaign-sprint",
        "support-escalation-recovery",
        "research-market-scan",
      ]
        .map((id) => industrySolutionStarters.find((starter) => starter.id === id) ?? null)
        .filter((starter): starter is IndustrySolutionStarter => Boolean(starter)),
    [],
  );

  const applyScenarioWorkspace = (scenarioId: string, industryId: IndustryId) => {
    const scenario = getWorkspaceScenario(scenarioId);
    if (!scenario) return;
    const settings = loadSettings();
    const nextPersonalization: PersonalizationSettings = {
      ...settings.personalization,
      activeIndustry: mapIndustryToWorkspaceIndustry(industryId),
      activeScenarioId: scenario.id,
      useCustomWorkspace: true,
      customDesktopApps: uniqueAppIds(scenario.desktopApps),
      customDockApps: uniqueAppIds(scenario.dockApps),
    };
    saveSettings({
      ...settings,
      personalization: nextPersonalization,
    });
    setPersonalization(nextPersonalization);
  };

  const launchFeaturedStarter = (starter: IndustrySolutionStarter) => {
    applyScenarioWorkspace(starter.scenarioId, starter.industryId);
    const scenario = getWorkspaceScenario(starter.scenarioId);
    if (scenario) {
      startWorkflowRun(scenario, starter.triggerType);
    }
    runIndustrySolutionStarterActions(starter.actions);
  };

  const activateScenarioTrigger = (starter: IndustrySolutionStarter, triggerId: string) => {
    applyScenarioWorkspace(starter.scenarioId, starter.industryId);
    const scenario = getWorkspaceScenario(starter.scenarioId);
    if (!scenario) return;
    const trigger =
      scenario.triggers.find((item) => item.id === triggerId) ?? scenario.triggers[0];
    startWorkflowRun(scenario, trigger?.type ?? "manual");
    starter.apps.slice(0, 3).forEach((appId, index) => {
      window.setTimeout(() => openApp(appId), index * 90);
    });
  };

  const enterRoleDesk = (roleDesk: WorkspaceRoleDesk, industryId: IndustryId) => {
    applyScenarioWorkspace(roleDesk.scenarioId, industryId);
    const scenario = getWorkspaceScenario(roleDesk.scenarioId);
    scenario?.dockApps.slice(0, 4).forEach((appId, index) => {
      window.setTimeout(() => openApp(appId), index * 90);
    });
  };

  const updateDesktopScrollState = () => {
    const el = desktopScrollRef.current;
    if (!el) {
      setDesktopCanScrollUp(false);
      setDesktopCanScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setDesktopCanScrollUp(el.scrollTop > 12);
    setDesktopCanScrollDown(maxScrollTop - el.scrollTop > 12);
  };

  const scrollDesktopByPage = (direction: -1 | 1) => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const distance = Math.max(240, Math.floor(el.clientHeight * 0.72)) * direction;
    el.scrollBy({ top: distance, behavior: "smooth" });
  };

  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const onScroll = () => updateDesktopScrollState();
    const onResize = () => updateDesktopScrollState();

    updateDesktopScrollState();
    const rafId = window.requestAnimationFrame(updateDesktopScrollState);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [desktopApps]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <PublishQueueRunner />
      {/* iPad 风格壁纸背景（可由设置切换） */}
      <div className={["absolute inset-0", wallpaperClassName].join(" ")} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,rgba(8,11,18,0.18),rgba(8,11,18,0.5))]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:120px_120px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />

      {/* 状态栏 */}
      <div className="absolute left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="rounded-[28px] border border-white/15 bg-black/15 px-3 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-white/95 drop-shadow">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setSpotlightOpen(true)}
            title={`${getShellLabel("search", interfaceLanguage)} (⌘K / Ctrl+K)`}
            aria-label={getShellLabel("search", interfaceLanguage)}
          >
            <Search className="w-4 h-4 text-white/90" />
          </button>
          <StatusClock locale={resolveLanguageLocale(interfaceLanguage)} />
          </div>
            <div className="order-3 flex w-full items-center justify-between gap-2 sm:order-2 sm:w-auto sm:justify-end">
              <LanguageCapsule
                value={interfaceLanguage}
                customLanguageLabel={personalization.customLanguageLabel}
                onChange={applyLanguage}
              />
              <ModelCapsule
                value={activeProvider}
                language={interfaceLanguage}
                onChange={(next) => {
                  const settings = loadSettings();
                  saveSettings({
                    ...settings,
                    llm: { ...settings.llm, activeProvider: next },
                  });
                }}
              />
              <div className="flex items-center gap-2 text-white/90">
                <Wifi className="hidden h-4 w-4 sm:block" />
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  onClick={() => setVolumeLevel((prev) => (prev + 1) % 3)}
                  title="音量"
                  aria-label="音量"
                >
                  {getVolumeIcon()}
                </button>
                <div className="relative hidden h-4 w-7 overflow-hidden rounded-md border border-white/40 sm:block">
                  <div className="absolute inset-y-0 left-0 w-4 bg-white/80" />
                </div>
              </div>
            </div>

            <div className="order-2 flex flex-1 items-center justify-end gap-2 text-white/90 sm:order-3 sm:flex-none">
              <ModeSwitcher
                value={modeId}
                language={interfaceLanguage}
                onChange={setModeId}
              />
              <SystemTrayWindows
                language={interfaceLanguage}
                appStateById={appStateById}
                appZOrder={appZOrder}
                activeWindow={activeWindow}
                onRestore={restoreApp}
                onMinimize={minimizeApp}
                onClose={closeApp}
                onFocus={focusApp}
              />
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
                onClick={() => requestOpenSettings("personalization")}
              >
                {getShellLabel("workspace", interfaceLanguage)}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
                onClick={() => openApp("settings")}
              >
                {getShellLabel("settings", interfaceLanguage)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主屏图标网格 */}
      <div className="absolute inset-0 z-10 px-4 pb-40 pt-28 sm:px-8 sm:pb-44 sm:pt-24">
        <div
          ref={desktopScrollRef}
          className="h-full overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth pr-1 touch-pan-y"
        >
          <div className="mx-auto max-w-6xl pb-4">
            <SolutionCenterPanel
              language={interfaceLanguage}
              activeScenarioTitle={workspaceScenario?.title}
              starters={featuredSolutionStarters}
              onLaunchStarter={launchFeaturedStarter}
              onActivateTrigger={activateScenarioTrigger}
              onEnterRoleDesk={enterRoleDesk}
              onOpenIndustryHub={() => openApp("industry_hub")}
              onOpenSolutionsHub={() => openApp("solutions_hub")}
            />

            <div className="mt-8 grid auto-rows-max content-start grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-7 lg:grid-cols-6">
            {desktopApps.map((appId) => {
              const app = getApp(appId);
              const Icon = app.icon;
              return (
                <DesktopIcon
                  key={appId}
                  icon={<Icon className="w-9 h-9 text-white/90" />}
                  name={getAppDisplayName(appId, app.name, interfaceLanguage)}
                  onClick={() => openApp(appId)}
                />
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {desktopCanScrollUp || desktopCanScrollDown ? (
        <div className="pointer-events-none absolute bottom-28 right-4 z-20 flex flex-col gap-2 sm:bottom-32 sm:right-6">
          <button
            type="button"
            onClick={() => scrollDesktopByPage(-1)}
            disabled={!desktopCanScrollUp}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-white/90 shadow-xl backdrop-blur-2xl transition-colors hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="向上翻页"
            title="向上翻页"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollDesktopByPage(1)}
            disabled={!desktopCanScrollDown}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-white/90 shadow-xl backdrop-blur-2xl transition-colors hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="向下翻页"
            title="向下翻页"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      {/* 应用打开时的遮罩（点空白可关闭） */}
      {isAnyAppVisible && (
        <div
          className="absolute inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
          onClick={() => {
            const top =
              activeWindow ??
              [...appZOrder]
                .reverse()
                .find((appId) => {
                  const s = appStateById[appId];
                  return s === "open" || s === "opening";
                }) ??
              null;

            if (top) closeApp(top);
          }}
          aria-hidden="true"
        />
      )}

      {appZOrder.map((appId, index) => {
        const state = appStateById[appId];
        if (state === "closed") return null;
        const app = getApp(appId);
        const Window = app.window;
        return (
          <Window
            key={appId}
            state={state as AppWindowState}
            zIndex={50 + index + (activeWindow === appId ? 100 : 0)}
            active={activeWindow === appId}
            onFocus={() => focusApp(appId)}
            onMinimize={() => minimizeApp(appId)}
            onClose={() => closeApp(appId)}
          />
        );
      })}

      {/* Dock */}
      <div className="absolute bottom-3 left-1/2 z-30 w-[calc(100%-20px)] max-w-max -translate-x-1/2 sm:bottom-4">
        <div className="flex items-center gap-2 overflow-x-auto rounded-[28px] border border-white/20 bg-white/15 px-3 py-3 shadow-2xl backdrop-blur-2xl sm:gap-3 sm:px-4">
          {dockApps.map((appId) => {
            const app = getApp(appId);
            const Icon = app.icon;
            const state = appStateById[appId];
            const running = state !== "closed" && state !== "closing";
            const active = state === "open" || state === "opening";
            return (
              <DockIcon
                key={appId}
                title={getAppDisplayName(appId, app.name, interfaceLanguage)}
                active={active}
                running={running}
                onClick={() => toggleAppFromDock(appId)}
              >
                <Icon className="w-7 h-7 text-white/90" />
              </DockIcon>
            );
          })}
        </div>
      </div>

      <Spotlight
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        apps={listApps().map((a) => ({
          id: a.id,
          name: getAppDisplayName(a.id, a.name, interfaceLanguage),
        }))}
        onOpenApp={(appId) => openApp(appId as AppId)}
      />

      {showLanguageWelcome ? (
        <LanguageWelcomeCard
          customLanguageLabel={personalization.customLanguageLabel}
          onSelect={applyLanguage}
          onOpenSettings={() => {
            try {
              window.localStorage.setItem(languageWelcomeKey, "1");
            } catch {
              // ignore
            }
            setShowLanguageWelcome(false);
            requestOpenSettings("personalization");
          }}
        />
      ) : null}
    </div>
  );
}

const solutionAccentClasses: Record<IndustrySolutionStarter["accent"], string> = {
  blue:
    "border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96)_0%,rgba(255,255,255,0.98)_48%,rgba(224,242,254,0.9)_100%)]",
  emerald:
    "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98)_0%,rgba(255,255,255,0.98)_48%,rgba(240,253,244,0.92)_100%)]",
  amber:
    "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(255,255,255,0.98)_48%,rgba(254,243,199,0.86)_100%)]",
  rose:
    "border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.98)_0%,rgba(255,255,255,0.98)_48%,rgba(255,228,230,0.88)_100%)]",
  slate:
    "border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,0.98)_48%,rgba(226,232,240,0.9)_100%)]",
};

const solutionBadgeClasses: Record<IndustrySolutionStarter["accent"], string> = {
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
};

function uniqueAppIds(appIds: AppId[]) {
  return Array.from(new Set(appIds));
}

function getRunStateMeta(run: WorkflowRunRecord | null) {
  switch (run?.state) {
    case "running":
      return { label: "运行中", className: "border-sky-200 bg-sky-50 text-sky-700" };
    case "awaiting_human":
      return { label: "待人工确认", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "completed":
      return { label: "已完成", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "error":
      return { label: "异常", className: "border-rose-200 bg-rose-50 text-rose-700" };
    default:
      return { label: "未启动", className: "border-slate-200 bg-white text-slate-600" };
  }
}

type StarterAssetSnapshot = {
  title: string;
  detail: string;
  meta: string;
  jumpTarget?: AssetJumpTarget;
};

function getStarterAssetSnapshot(
  starter: IndustrySolutionStarter,
  workflowRuns: WorkflowRunRecord[],
): StarterAssetSnapshot {
  const run = workflowRuns.find((item) => item.scenarioId === starter.scenarioId) ?? null;
  if (!run) {
    return {
      title: "还没有最近资产",
      detail: "先启动这条 Hero Workflow，系统会把结果沉淀成业务资产。",
      meta: "No recent asset",
    };
  }

  if (starter.scenarioId === "sales-pipeline") {
    const asset = getSalesAssetByWorkflowRunId(run.id);
    if (!asset) {
      return {
        title: "销售资产等待写入",
        detail: "最近一次运行已存在，但还没有询盘、草稿或 CRM 资产快照。",
        meta: getRunStateMeta(run).label,
      };
    }
    const jumpTarget =
      asset.contactId
        ? {
            kind: "record" as const,
            appId: "personal_crm" as const,
            eventName: "openclaw:crm-select",
            eventDetail: { contactId: asset.contactId },
          }
        : asset.emailThreadId
          ? {
              kind: "record" as const,
              appId: "email_assistant" as const,
              eventName: "openclaw:email-assistant-select",
              eventDetail: { threadId: asset.emailThreadId },
            }
          : asset.dealId
            ? {
                kind: "record" as const,
                appId: "deal_desk" as const,
                eventName: "openclaw:deal-desk-select",
                eventDetail: { dealId: asset.dealId },
              }
            : undefined;
    return {
      title: asset.company || asset.contactName || "销售推进资产",
      detail:
        asset.latestDraftSubject ||
        asset.nextAction ||
        asset.requirementSummary ||
        "已沉淀客户偏好、跟进节奏和下一步动作。",
      meta: asset.quoteStatus || asset.status,
      jumpTarget,
    };
  }

  if (starter.scenarioId === "creator-studio") {
    const asset = getCreatorAssetByWorkflowRunId(run.id);
    if (!asset) {
      return {
        title: "内容资产等待写入",
        detail: "最近一次运行已存在，但还没有选题、内容包或发布快照。",
        meta: getRunStateMeta(run).label,
      };
    }
    const jumpTarget =
      asset.draftId
        ? {
            kind: "publisher" as const,
            prefill: {
              draftId: asset.draftId,
              workflowRunId: run.id,
              workflowScenarioId: starter.scenarioId,
            },
          }
        : asset.repurposerProjectId
          ? {
              kind: "record" as const,
              appId: "content_repurposer" as const,
              eventName: "openclaw:content-repurposer-select",
              eventDetail: { projectId: asset.repurposerProjectId },
            }
          : asset.radarItemId
            ? {
                kind: "record" as const,
                appId: "creator_radar" as const,
                eventName: "openclaw:creator-radar-select",
                eventDetail: { radarItemId: asset.radarItemId },
              }
            : undefined;
    return {
      title: asset.topic || "内容增长资产",
      detail:
        asset.latestDraftTitle ||
        asset.primaryAngle ||
        asset.nextAction ||
        "已沉淀选题角度、多平台内容包和发布候选稿。",
      meta: asset.publishStatus || asset.status,
      jumpTarget,
    };
  }

  if (starter.scenarioId === "support-ops") {
    const asset = getSupportAssetByWorkflowRunId(run.id);
    if (!asset) {
      return {
        title: "客服资产等待写入",
        detail: "最近一次运行已存在，但还没有回复、升级或 FAQ 快照。",
        meta: getRunStateMeta(run).label,
      };
    }
    const jumpTarget =
      asset.ticketId
        ? {
            kind: "record" as const,
            appId: "support_copilot" as const,
            eventName: "openclaw:support-copilot-select",
            eventDetail: { ticketId: asset.ticketId },
          }
        : asset.inboxItemId
          ? {
              kind: "record" as const,
              appId: "inbox_declutter" as const,
              eventName: "openclaw:inbox-select",
              eventDetail: { itemId: asset.inboxItemId },
            }
          : undefined;
    return {
      title: asset.customer || "客服处理资产",
      detail:
        asset.latestReply ||
        asset.faqDraft ||
        asset.nextAction ||
        "已沉淀建议回复、升级任务和 FAQ 条目。",
      meta: asset.status,
      jumpTarget,
    };
  }

  if (starter.scenarioId === "research-radar") {
    const asset = getResearchAssetByWorkflowRunId(run.id);
    if (!asset) {
      return {
        title: "研究资产等待写入",
        detail: "最近一次运行已存在，但还没有研究摘要或晨报快照。",
        meta: getRunStateMeta(run).label,
      };
    }
    const jumpTarget =
      asset.briefId
        ? {
            kind: "record" as const,
            appId: "morning_brief" as const,
            eventName: "openclaw:morning-brief-select",
            eventDetail: { briefId: asset.briefId },
          }
        : asset.reportId
          ? {
              kind: "record" as const,
              appId: "deep_research_hub" as const,
              eventName: "openclaw:research-hub-select",
              eventDetail: { reportId: asset.reportId },
            }
          : undefined;
    return {
      title: asset.topic || "研究策略资产",
      detail:
        asset.latestBrief ||
        asset.angle ||
        asset.nextAction ||
        "已沉淀研究简报、观察框架和决策摘要。",
      meta: asset.status,
      jumpTarget,
    };
  }

  return {
    title: "最近资产",
    detail: run.scenarioTitle,
    meta: getRunStateMeta(run).label,
  };
}

function SolutionCenterPanel({
  language,
  activeScenarioTitle,
  starters,
  onLaunchStarter,
  onActivateTrigger,
  onEnterRoleDesk,
  onOpenIndustryHub,
  onOpenSolutionsHub,
}: {
  language: InterfaceLanguage;
  activeScenarioTitle?: string;
  starters: IndustrySolutionStarter[];
  onLaunchStarter: (starter: IndustrySolutionStarter) => void;
  onActivateTrigger: (starter: IndustrySolutionStarter, triggerId: string) => void;
  onEnterRoleDesk: (roleDesk: WorkspaceRoleDesk, industryId: IndustryId) => void;
  onOpenIndustryHub: () => void;
  onOpenSolutionsHub: () => void;
}) {
  const [selectedStarterId, setSelectedStarterId] = useState(starters[0]?.id ?? "");
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunRecord[]>(() => getWorkflowRuns());
  const [, setAssetRevision] = useState(0);

  useEffect(() => {
    if (!selectedStarterId && starters[0]?.id) {
      setSelectedStarterId(starters[0].id);
    }
  }, [selectedStarterId, starters]);

  useEffect(() => {
    const sync = () => setWorkflowRuns(getWorkflowRuns());
    sync();
    const off = subscribeWorkflowRuns(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const bump = () => setAssetRevision((value) => value + 1);
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

  const displayLanguage = getDisplayLanguage(language);
  const selectedStarter =
    starters.find((starter) => starter.id === selectedStarterId) ?? starters[0] ?? null;
  const selectedBundle = selectedStarter ? getIndustryBundle(selectedStarter.bundleId) : null;
  const selectedScenario = selectedStarter
    ? getWorkspaceScenario(selectedStarter.scenarioId)
    : null;
  const roleDesk = selectedStarter?.roleId
    ? workspaceRoleDesks.find((desk) => desk.id === selectedStarter.roleId) ?? null
    : null;

  const copy = useMemo(() => {
    if (displayLanguage === "en") {
      return {
        eyebrow: "Solution Center",
        title: "Start from the business scenario, not the app shelf.",
        desc:
          "OpenClaw OS now surfaces runnable hero workflows first. Pick your industry, enter the matching role desk, and let the system carry the default apps, workflow stages, and assets with you.",
        active: "Current workspace",
        launch: "Launch hero workflow",
        role: "Enter role desk",
        industry: "Open industry hub",
        library: "Open solution library",
        outcome: "Expected outcome",
        assets: "Assets retained",
        apps: "Default apps",
        runtime: "Live runtime",
        workflow: "Workflow chain",
        noRole: "This solution does not have a dedicated role desk yet.",
        jump: "Open exact asset",
      };
    }
    if (displayLanguage === "ja") {
      return {
        eyebrow: "Solution Center",
        title: "最初に選ぶのは App ではなく、業務シナリオです。",
        desc:
          "OpenClaw OS は実行可能な Hero Workflow を最初に前面表示します。業界とロールを選ぶと、対応するアプリ、進行段階、残す資産が一緒に立ち上がります。",
        active: "現在のワークスペース",
        launch: "Hero Workflow を起動",
        role: "ロールデスクに入る",
        industry: "Industry Hub を開く",
        library: "Solutions Library を開く",
        outcome: "想定アウトカム",
        assets: "残る資産",
        apps: "標準アプリ",
        runtime: "実行状態",
        workflow: "ワークフロー",
        noRole: "このソリューションにはまだ専用のロールデスクがありません。",
        jump: "この資産を開く",
      };
    }
    return {
      eyebrow: "Solution Center",
      title: "先从业务方案进入，而不是先找 App。",
      desc:
        "openclaw-os 现在把已经跑通的 Hero Workflow 前置为业务入口。先选行业，再进角色桌面，系统会把默认应用、流程阶段和资产沉淀逻辑一起带出来。",
      active: "当前工作台",
      launch: "启动这条 Hero Workflow",
      role: "进入角色桌面",
      industry: "打开行业中心",
      library: "打开方案库",
      outcome: "预期结果",
      assets: "沉淀资产",
      apps: "默认应用链",
      runtime: "实时运行状态",
      workflow: "工作流主线",
      noRole: "当前方案还没有绑定独立角色桌面。",
      jump: "回到这次流程",
    };
  }, [displayLanguage]);

  if (!selectedStarter || !selectedBundle) {
    return null;
  }

  const liveRuns = starters.map((starter) => {
    const run = workflowRuns.find((item) => item.scenarioId === starter.scenarioId) ?? null;
    return { starter, run };
  });
  const selectedSnapshot = getStarterAssetSnapshot(selectedStarter, workflowRuns);
  const starterSnapshots = starters.map((starter) => ({
    starter,
    snapshot: getStarterAssetSnapshot(starter, workflowRuns),
  }));

  return (
    <section className="rounded-[36px] border border-white/15 bg-[linear-gradient(135deg,rgba(7,12,24,0.76)_0%,rgba(15,23,42,0.72)_52%,rgba(15,118,110,0.24)_100%)] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/75">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{copy.desc}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenIndustryHub}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                {copy.industry}
              </button>
              <button
                type="button"
                onClick={onOpenSolutionsHub}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                <Bot className="h-4 w-4" />
                {copy.library}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {starters.map((starter) => {
              const active = starter.id === selectedStarter.id;
              return (
                <button
                  key={starter.id}
                  type="button"
                  onClick={() => setSelectedStarterId(starter.id)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-white/25 bg-white/16 text-white"
                      : "border-white/10 bg-white/6 text-white/75 hover:bg-white/10",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">{starter.title}</div>
                  <div className="mt-1 text-xs text-white/60">{starter.triggerLabel}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[30px] border border-white/10 bg-white/8 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className={["inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold", solutionBadgeClasses[selectedStarter.accent]].join(" ")}>
                  {selectedBundle.title}
                </div>
                <div className="mt-3 text-xl font-semibold text-white">{selectedStarter.title}</div>
                <div className="mt-2 text-sm leading-6 text-white/70">{selectedStarter.summary}</div>
              </div>
              <div className={["rounded-[26px] border p-4 shadow-sm", solutionAccentClasses[selectedStarter.accent]].join(" ")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.active}</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{activeScenarioTitle || "未固定到专属桌面"}</div>
                <div className="mt-2 text-xs leading-5 text-slate-600">{selectedBundle.summary}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-black/12 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.workflow}</div>
                  <div className="mt-3 text-sm leading-6 text-white">
                    {getWorkspaceScenario(selectedStarter.scenarioId)?.workflowTitle || selectedBundle.summary}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/12 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.outcome}</div>
                  <div className="mt-3 text-sm leading-6 text-white">{selectedStarter.outcomeLabel}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/12 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.assets}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStarter.assets.map((asset) => (
                      <span
                        key={asset}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85"
                      >
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/12 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.apps}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStarter.apps.map((appId) => (
                      <span
                        key={appId}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85"
                      >
                        {getAppDisplayName(appId, appId, language)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.04)_100%)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{copy.runtime}</div>
                <div className="mt-3 space-y-3">
                  {liveRuns.map(({ starter, run }) => {
                    const meta = getRunStateMeta(run);
                    return (
                      <div key={starter.id} className="rounded-2xl border border-white/10 bg-black/14 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{starter.title}</div>
                            <div className="mt-1 text-xs text-white/55">{starter.triggerLabel}</div>
                          </div>
                          <span className={["rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.className].join(" ")}>
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-black/12 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Latest Asset Snapshot</div>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="text-lg font-semibold text-white">{selectedSnapshot.title}</div>
                  <div className="mt-2 text-sm leading-6 text-white/70">{selectedSnapshot.detail}</div>
                </div>
                <div className="flex min-w-[180px] flex-col items-start gap-3 lg:items-end">
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
                    {selectedSnapshot.meta}
                  </div>
                  {selectedSnapshot.jumpTarget ? (
                    <button
                      type="button"
                      onClick={() => jumpToAssetTarget(selectedSnapshot.jumpTarget)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {copy.jump}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onLaunchStarter(selectedStarter)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
              >
                <PlayCircle className="h-4 w-4" />
                {copy.launch}
              </button>
              {roleDesk ? (
                <button
                  type="button"
                  onClick={() => onEnterRoleDesk(roleDesk, selectedStarter.industryId)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {copy.role}
                </button>
              ) : null}
            </div>

            <WorkflowSignalCenter
              language={language}
              scenario={selectedScenario}
              run={workflowRuns.find((item) => item.scenarioId === selectedStarter.scenarioId) ?? null}
              onFireTrigger={(triggerId) => onActivateTrigger(selectedStarter, triggerId)}
            />

            <SolutionBlueprintPanel
              language={language}
              starter={selectedStarter}
            />

            <UnifiedAssetConsole
              language={language}
              onOpenAsset={(target) => jumpToAssetTarget(target)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[30px] border border-white/10 bg-white/8 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Industry + Role + Workflow</div>
            <div className="mt-3 space-y-3">
              {starters.map((starter) => {
                const starterRoleDesk = starter.roleId
                  ? workspaceRoleDesks.find((desk) => desk.id === starter.roleId) ?? null
                  : null;
                const meta = getRunStateMeta(workflowRuns.find((item) => item.scenarioId === starter.scenarioId) ?? null);
                return (
                  <button
                    key={starter.id}
                    type="button"
                    onClick={() => setSelectedStarterId(starter.id)}
                    className={[
                      "w-full rounded-[24px] border p-4 text-left transition-colors",
                      starter.id === selectedStarter.id
                        ? "border-white/20 bg-white/14"
                        : "border-white/8 bg-black/12 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{starter.title}</div>
                        <div className="mt-1 text-xs text-white/55">
                          {getIndustryBundle(starter.bundleId)?.title || starter.bundleId}
                          {starterRoleDesk ? ` · ${starterRoleDesk.title}` : ""}
                        </div>
                      </div>
                      <span className={["rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.className].join(" ")}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-white/65">
                      <ArrowRight className="h-3.5 w-3.5" />
                      {starter.triggerLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

            <div className="rounded-[30px] border border-white/10 bg-white/8 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Recent Business Proof</div>
            <div className="mt-3 space-y-3">
              {starterSnapshots.map(({ starter, snapshot }) => (
                <div
                  key={starter.id}
                  className={[
                    "rounded-[24px] border p-4 transition-colors",
                    starter.id === selectedStarter.id
                      ? "border-white/20 bg-white/14"
                      : "border-white/8 bg-black/12 hover:bg-white/10",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedStarterId(starter.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{starter.title}</div>
                        <div className="mt-1 text-xs text-white/55">{snapshot.title}</div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                        {snapshot.meta}
                      </span>
                    </div>
                    <div className="mt-3 line-clamp-3 text-xs leading-5 text-white/65">{snapshot.detail}</div>
                  </button>
                  <div className="mt-3 flex justify-end">
                    {snapshot.jumpTarget ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStarterId(starter.id);
                          jumpToAssetTarget(snapshot.jumpTarget);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/85 transition-colors hover:bg-white/15"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        {copy.jump}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/8 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Role Desk</div>
            {roleDesk ? (
              <div className="mt-3 rounded-[24px] border border-white/10 bg-black/12 p-4">
                <div className="text-lg font-semibold text-white">{roleDesk.title}</div>
                <div className="mt-2 text-sm leading-6 text-white/70">{roleDesk.desc}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {roleDesk.focus.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-[24px] border border-dashed border-white/10 bg-black/12 p-4 text-sm text-white/60">{copy.noRole}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function providerLabel(id: LlmProviderId) {
  const map: Record<LlmProviderId, string> = {
    kimi: "Kimi (Moonshot)",
    deepseek: "DeepSeek",
    openai: "OpenAI",
    qwen: "通义千问",
  };
  return map[id];
}

function detectWelcomeLanguage(): InterfaceLanguage {
  if (typeof navigator === "undefined") return "en-US";
  const language = navigator.language.toLowerCase();
  if (language.startsWith("zh")) return "zh-CN";
  if (language.startsWith("ja")) return "ja-JP";
  return "en-US";
}

function getWelcomeCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "ja") {
    return {
      eyebrow: "Language",
      title: "使用する言語を選択",
      desc: "最初に表示言語を選びます。あとから上部バーでいつでも変更できます。",
      badge: "Global first",
      zhDesc: "中国語ユーザー向け",
      enDesc: "For global users",
      jaDesc: "日本語ユーザー向け",
    };
  }
  if (displayLanguage === "zh") {
    return {
      eyebrow: "语言",
      title: "选择你的语言",
      desc: "先选择界面语言，之后也可以随时从顶部栏切换。",
      badge: "全球优先",
      zhDesc: "适合中文用户",
      enDesc: "适合全球用户",
      jaDesc: "适合日语用户",
    };
  }
  return {
    eyebrow: "Language",
    title: "Choose your language",
    desc: "Pick the interface language first. You can change it anytime from the top bar.",
    badge: "Global first",
    zhDesc: "For Chinese users",
    enDesc: "For global users",
    jaDesc: "For Japanese users",
  };
}

function LanguageCapsule({
  value,
  customLanguageLabel,
  onChange,
}: {
  value: InterfaceLanguage;
  customLanguageLabel: string;
  onChange: (next: InterfaceLanguage) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const items: Array<{ id: InterfaceLanguage; label: string; hint?: string }> = [
    { id: "zh-CN", label: "中文" },
    { id: "en-US", label: "English" },
    { id: "ja-JP", label: "日本語" },
    {
      id: "custom",
      label: customLanguageLabel.trim() || getShellLabel("customLanguage", value),
      hint: customLanguageLabel.trim()
        ? getShellLabel("customLanguageSet", value)
        : getShellLabel("openSettings", value),
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={[
          "max-w-[56vw] truncate rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/95 backdrop-blur-xl transition-colors hover:bg-white/15 sm:max-w-none sm:px-4",
          "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Globe2 className="h-3.5 w-3.5" />
          {getLanguageLabel(value, customLanguageLabel)} ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 mt-2 w-[220px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0f18]/70 shadow-2xl backdrop-blur-2xl"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 text-[11px] font-semibold text-white/70">
            {getShellLabel("interfaceLanguage", value)}
          </div>
          <div className="space-y-1 p-2">
            {items.map((item) => {
              const active = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {active ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80">
                      {getShellLabel("current", value)}
                    </span>
                  ) : item.hint ? (
                    <span className="text-[10px] text-white/45">{item.hint}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageWelcomeCard({
  customLanguageLabel,
  onSelect,
  onOpenSettings,
}: {
  customLanguageLabel: string;
  onSelect: (next: InterfaceLanguage) => void;
  onOpenSettings: () => void;
}) {
  const welcomeLanguage = useMemo(() => detectWelcomeLanguage(), []);
  const copy = useMemo(() => getWelcomeCopy(welcomeLanguage), [welcomeLanguage]);
  const items: Array<{ id: InterfaceLanguage; title: string; desc: string }> = [
    { id: "zh-CN", title: "中文", desc: copy.zhDesc },
    { id: "en-US", title: "English", desc: copy.enDesc },
    { id: "ja-JP", title: "日本語", desc: copy.jaDesc },
  ];

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/15 bg-[#0b0f18]/75 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              {copy.eyebrow}
            </div>
            <div className="mt-2 text-2xl font-bold text-white">{copy.title}</div>
            <div className="mt-2 text-sm text-white/70">
              {copy.desc}
            </div>
          </div>
          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/65">
            {copy.badge}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="rounded-3xl border border-white/15 bg-white/5 p-5 text-left transition-colors hover:bg-white/10"
            >
              <div className="text-lg font-semibold text-white">{item.title}</div>
              <div className="mt-2 text-sm text-white/65">{item.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {customLanguageLabel.trim() || getShellLabel("customLanguage", welcomeLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelCapsule({
  value,
  language,
  onChange,
}: {
  value: LlmProviderId;
  language: InterfaceLanguage;
  onChange: (next: LlmProviderId) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const items: LlmProviderId[] = ["kimi", "deepseek", "openai", "qwen"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={[
          "max-w-[68vw] truncate px-3 py-2 sm:max-w-none sm:px-4 rounded-full border border-white/15 bg-white/10 backdrop-blur-xl",
          "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
          "text-xs font-semibold text-white/95 hover:bg-white/15 transition-colors",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ✨ {getShellLabel("engine", language)}: {providerLabel(value)} ▾
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 mt-2 w-[260px] rounded-2xl border border-white/15 bg-[#0b0f18]/70 backdrop-blur-2xl shadow-2xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 text-[11px] font-semibold text-white/70">
            一键切换全局大模型
          </div>
          <div className="p-2 space-y-1">
            {items.map((id) => {
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={[
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>{providerLabel(id)}</span>
                  {active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/80">
                      {getShellLabel("current", language)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-3 text-[11px] text-white/55">
            配置 Key/Base URL 请到「设置 → 大模型与助手」。
          </div>
        </div>
      )}
    </div>
  );
}

function DockIcon({
  title,
  active,
  running,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  running?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
        active ? "bg-white/20" : "hover:bg-white/10",
      ].join(" ")}
    >
      {children}
      {running && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-white/70" />
      )}
    </button>
  );
}

function ModeSwitcher({
  value,
  language,
  onChange,
}: {
  value: ModeId;
  language: InterfaceLanguage;
  onChange: (next: ModeId) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModeId)}
        className="appearance-none rounded-full border border-white/15 bg-white/10 py-1.5 pl-3 pr-8 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
        aria-label={getShellLabel("switchMode", language)}
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id} className="text-black">
            {getModeDisplayName(mode.id, mode.name, language)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/80">
        <span className="text-[10px]">▼</span>
      </div>
    </div>
  );
}
