"use client";

import Image from "next/image";
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
import { StatusClock } from "@/components/StatusClock";
import { SystemTrayWindows } from "@/components/SystemTrayWindows";
import { PublishQueueRunner } from "@/components/PublishQueueRunner";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  getAppDisplayName,
  getAppCategory,
  getCategoryMeta,
  getDisplayLanguage,
  getModeDisplayName,
  getShellLabel,
  resolveLanguageLocale,
} from "@/lib/app-display";
import { getLanguageLabel } from "@/lib/language";
import {
  defaultSettings,
  getActiveLlmConfig,
  hasSavedSettings,
  hydrateSettingsFromDesktopBridge,
  loadSettings,
  saveSettings,
  type InterfaceLanguage,
  type LlmProviderId,
  type PersonalizationSettings,
} from "@/lib/settings";
import { Spotlight } from "@/components/Spotlight";
import { useSidecarHeartbeat } from "@/hooks/useSidecarHeartbeat";
import { getDesktopRuntimeStatusSummary } from "@/lib/desktop-runtime";
import {
  getIndustryBundle,
  mapIndustryToWorkspaceIndustry,
  type IndustryId,
} from "@/lib/industry-solutions";
import {
  industrySolutionStarters,
  runIndustrySolutionStarterActions,
  type IndustrySolutionStarter,
} from "@/lib/solution-starters";
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
import { createTask, updateTask } from "@/lib/tasks";

export default function Home() {
  useSidecarHeartbeat();
  const languageWelcomeKey = "openclaw.language_welcome.v1";
  const runtimeOnboardingKey = "agentcore.runtime_onboarding.dismissed.v1";
  const agentSidebarWidthKey = "agentcore.desktop.agent-sidebar.width.v1";
  const agentSidebarCollapsedKey = "agentcore.desktop.agent-sidebar.collapsed.v1";
  const [volumeLevel, setVolumeLevel] = useState(2);
  const [modeId, setModeId] = useState<ModeId>("creator");
  const [personalization, setPersonalization] = useState<PersonalizationSettings>(
    () => defaultSettings.personalization,
  );
  const [showLanguageWelcome, setShowLanguageWelcome] = useState(false);
  const [showRuntimeOnboarding, setShowRuntimeOnboarding] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<LlmProviderId>("kimi");
  const [activeWindow, setActiveWindow] = useState<AppId | null>(null);
  const [desktopCanScrollUp, setDesktopCanScrollUp] = useState(false);
  const [desktopCanScrollDown, setDesktopCanScrollDown] = useState(false);
  const [agentSidebarWidth, setAgentSidebarWidth] = useState(296);
  const [agentSidebarCollapsed, setAgentSidebarCollapsed] = useState(false);

  const [appStateById, setAppStateById] = useState<Record<AppId, AppState>>(() => {
    const initial = {} as Record<AppId, AppState>;
    for (const app of listApps()) {
      initial[app.id] = "closed";
    }
    return initial;
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
    void hydrateSettingsFromDesktopBridge().then((hydrated) => {
      if (!hydrated) return;
      setPersonalization(hydrated.personalization);
      setActiveProvider(hydrated.llm.activeProvider);
    });
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
      const savedWidth = Number(window.localStorage.getItem(agentSidebarWidthKey) || "");
      const savedCollapsed = window.localStorage.getItem(agentSidebarCollapsedKey);
      if (Number.isFinite(savedWidth) && savedWidth >= 260 && savedWidth <= 420) {
        setAgentSidebarWidth(savedWidth);
      }
      if (savedCollapsed === "1") setAgentSidebarCollapsed(true);
      if (savedCollapsed === "0") setAgentSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(agentSidebarWidthKey, String(agentSidebarWidth));
      window.localStorage.setItem(
        agentSidebarCollapsedKey,
        agentSidebarCollapsed ? "1" : "0",
      );
    } catch {
      // ignore
    }
  }, [agentSidebarWidth, agentSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const hasSeenWelcome = window.localStorage.getItem(languageWelcomeKey) === "1";
      if (!hasSeenWelcome && !hasSavedSettings()) {
        setShowLanguageWelcome(true);
      }
      const settings = loadSettings();
      const dismissed = window.localStorage.getItem(runtimeOnboardingKey) === "1";
      const runtimeSummary = getDesktopRuntimeStatusSummary(settings);
      const needsOnboarding = !runtimeSummary.initializationComplete;
      if (!dismissed && needsOnboarding) {
        setShowRuntimeOnboarding(true);
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
    return personalization.customDesktopApps;
  }, [mode.desktopApps, personalization.customDesktopApps, personalization.useCustomWorkspace]);
  const dockApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.dockApps;
    return personalization.customDockApps;
  }, [mode.dockApps, personalization.customDockApps, personalization.useCustomWorkspace]);
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
  const desktopRightInset = agentSidebarCollapsed ? 0 : agentSidebarWidth + 18;

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
      <div
        className="absolute left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-3.5"
        style={{ right: desktopRightInset }}
      >
        <div className="rounded-[24px] border border-white/12 bg-black/15 px-3 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2 text-white/95 drop-shadow">
              <AgentCoreBrand />
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
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
                <Wifi className="hidden h-3.5 w-3.5 sm:block" />
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  onClick={() => setVolumeLevel((prev) => (prev + 1) % 3)}
                  title="音量"
                  aria-label="音量"
                >
                  {getVolumeIcon()}
                </button>
                <div className="relative hidden h-3.5 w-6 overflow-hidden rounded-md border border-white/40 sm:block">
                  <div className="absolute inset-y-0 left-0 w-4 bg-white/80" />
                </div>
              </div>
            </div>

            <div className="order-2 flex flex-1 items-center justify-end gap-1.5 text-white/90 sm:order-3 sm:flex-none">
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
                className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/15"
                onClick={() => requestOpenSettings("personalization")}
              >
                {getShellLabel("workspace", interfaceLanguage)}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/15"
                onClick={() => openApp("settings")}
              >
                {getShellLabel("settings", interfaceLanguage)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主屏图标网格 */}
      <div
        className="absolute inset-0 z-10 px-4 pb-40 pt-24 sm:px-8 sm:pb-44 sm:pt-20"
        style={{ right: desktopRightInset }}
      >
        <div
          ref={desktopScrollRef}
          className="h-full overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth pr-1 touch-pan-y"
        >
          <div className="mx-auto max-w-[1160px] pb-4">
            <SolutionCenterPanel
              language={interfaceLanguage}
              starters={featuredSolutionStarters}
              onLaunchStarter={launchFeaturedStarter}
              onEnterRoleDesk={enterRoleDesk}
              onOpenIndustryHub={() => openApp("industry_hub")}
              onOpenSolutionsHub={() => openApp("solutions_hub")}
            />

            <WorkspaceAppWidgetGrid
              appIds={desktopApps}
              dockApps={dockApps}
              language={interfaceLanguage}
              appStateById={appStateById}
              onOpenApp={openApp}
            />
          </div>
        </div>
      </div>

      {desktopCanScrollUp || desktopCanScrollDown ? (
        <div
          className="pointer-events-none absolute bottom-26 z-20 flex flex-col gap-1.5 sm:bottom-30"
          style={{ right: agentSidebarCollapsed ? 76 : agentSidebarWidth + 20 }}
        >
          <button
            type="button"
            onClick={() => scrollDesktopByPage(-1)}
            disabled={!desktopCanScrollUp}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-white/15 bg-black/25 text-white/90 shadow-xl backdrop-blur-2xl transition-colors hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="向上翻页"
            title="向上翻页"
          >
            <ChevronUp className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollDesktopByPage(1)}
            disabled={!desktopCanScrollDown}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-white/15 bg-black/25 text-white/90 shadow-xl backdrop-blur-2xl transition-colors hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="向下翻页"
            title="向下翻页"
          >
            <ChevronDown className="h-4.5 w-4.5" />
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
      <div className="absolute bottom-3 left-1/2 z-30 w-[calc(100%-20px)] max-w-max -translate-x-1/2 sm:bottom-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-[24px] border border-white/18 bg-white/14 px-2.5 py-2.5 shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:gap-2 sm:px-3">
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
                <Icon className="h-5 w-5 text-white/88" />
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

      <AgentSidebar
        collapsed={agentSidebarCollapsed}
        width={agentSidebarWidth}
        language={interfaceLanguage}
        activeProvider={activeProvider}
        scenarioTitle={workspaceScenario?.title}
        contextSummary={[
          `当前工作台：${workspaceScenario?.title || "未固定"}`,
          `当前行业：${personalization.activeIndustry}`,
          `桌面应用数：${desktopApps.length}`,
          `Dock 应用数：${dockApps.length}`,
          `当前模型提供商：${providerLabel(activeProvider)}`,
        ].join("\n")}
        onToggleCollapsed={() => setAgentSidebarCollapsed((prev) => !prev)}
        onResize={(nextWidth) =>
          setAgentSidebarWidth(Math.max(260, Math.min(420, Math.round(nextWidth))))
        }
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

      {!showLanguageWelcome && showRuntimeOnboarding ? (
        <RuntimeOnboardingCard
          onChooseLightRuntime={() => {
            const settings = loadSettings();
            saveSettings({
              ...settings,
              runtime: {
                ...settings.runtime,
                profile: "desktop_light",
                orchestration: "none",
                autoBootLocalStack: false,
              },
            });
            setShowRuntimeOnboarding(false);
            try {
              window.localStorage.setItem(runtimeOnboardingKey, "1");
            } catch {
              // ignore
            }
          }}
          onOpenEngineSettings={() => {
            requestOpenSettings("engine");
            setShowRuntimeOnboarding(false);
          }}
        />
      ) : null}
    </div>
  );
}

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

function getWorkflowModeMeta(mode: "auto" | "assist" | "review" | "manual") {
  switch (mode) {
    case "auto":
      return { label: "自动", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "assist":
      return { label: "协作", className: "border-sky-200 bg-sky-50 text-sky-700" };
    case "review":
      return { label: "审核", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "manual":
    default:
      return { label: "人工", className: "border-slate-200 bg-white text-slate-600" };
  }
}

function getPrivacySafeStarterTitle(
  starter: IndustrySolutionStarter,
  fallback: string,
  language: InterfaceLanguage,
) {
  const displayLanguage = getDisplayLanguage(language);
  const map: Record<string, { zh: string; en: string; ja: string }> = {
    "sales-inbound-quote": {
      zh: "销售询盘处理",
      en: "Sales Intake Flow",
      ja: "営業問い合わせ処理",
    },
    "creator-campaign-sprint": {
      zh: "内容增长冲刺",
      en: "Creator Sprint",
      ja: "コンテンツ成長スプリント",
    },
    "support-escalation-recovery": {
      zh: "客服升级处理",
      en: "Support Recovery",
      ja: "サポート復旧フロー",
    },
    "research-market-scan": {
      zh: "研究扫描任务",
      en: "Research Scan",
      ja: "リサーチスキャン",
    },
  };

  return map[starter.id]?.[displayLanguage] || fallback;
}

function getCompactRunSummary(run: WorkflowRunRecord | null, stageCount: number) {
  if (!run) {
    return `未启动 · ${stageCount} 个阶段`;
  }
  const currentIndex = run.currentStageId
    ? run.stageRuns.findIndex((stage) => stage.id === run.currentStageId)
    : run.state === "completed"
      ? run.stageRuns.length - 1
      : -1;
  const visibleIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  return `${getRunStateMeta(run).label} · ${visibleIndex}/${Math.max(stageCount, 1)} 阶段`;
}

function getAppShortName(appId: AppId, language: InterfaceLanguage) {
  const app = getApp(appId);
  const fullName = getAppDisplayName(appId, app.name, language);
  return fullName.length > 14 ? `${fullName.slice(0, 14)}…` : fullName;
}

const workspaceCategoryOrder = [
  "workflow",
  "insight",
  "content",
  "relationship",
  "personal",
  "system",
] as const;

function SolutionCenterPanel({
  language,
  starters,
  onLaunchStarter,
  onEnterRoleDesk,
  onOpenIndustryHub,
  onOpenSolutionsHub,
}: {
  language: InterfaceLanguage;
  starters: IndustrySolutionStarter[];
  onLaunchStarter: (starter: IndustrySolutionStarter) => void;
  onEnterRoleDesk: (roleDesk: WorkspaceRoleDesk, industryId: IndustryId) => void;
  onOpenIndustryHub: () => void;
  onOpenSolutionsHub: () => void;
}) {
  const [selectedStarterId, setSelectedStarterId] = useState(starters[0]?.id ?? "");
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunRecord[]>(() => getWorkflowRuns());

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
        title: "Pick the workflow. The workspace follows.",
        desc:
          "Hero workflows are the entry point. Open the business chain first, then expand the matching role desk and apps only when needed.",
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
        title: "最初に選ぶのはワークフローです。",
        desc:
          "Hero Workflow を先に開き、必要なロールデスクとアプリはその後に段階的に展開します。",
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
      title: "先选工作流，再展开工作台。",
      desc:
        "首页只保留可执行业务入口。角色桌面、应用链和资产沉淀都按需展开，不再把说明书长期铺在桌面上。",
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

  const selectedRun =
    workflowRuns.find((item) => item.scenarioId === selectedStarter.scenarioId) ?? null;
  const activeStageCount = selectedScenario?.workflowStages.length ?? 0;

  return (
    <section className="rounded-[34px] bg-[linear-gradient(145deg,rgba(8,12,22,0.72)_0%,rgba(17,24,39,0.64)_52%,rgba(18,55,90,0.38)_100%)] p-3.5 text-white shadow-[0_24px_72px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-4">
      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.28fr)_280px]">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                <AgentCoreLogoMark size={22} roundedClassName="rounded-[8px]" />
                {copy.eyebrow}
              </div>
              <h1 className="mt-2 text-base font-semibold tracking-tight text-white sm:text-[1.45rem]">
                {copy.title}
              </h1>
              <p className="mt-1 max-w-lg text-[12px] leading-5 text-white/54">{copy.desc}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onOpenIndustryHub}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/15"
              >
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                {copy.industry}
              </button>
              <button
                type="button"
                onClick={onOpenSolutionsHub}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/15"
              >
                <Bot className="h-3.5 w-3.5" />
                {copy.library}
              </button>
            </div>
          </div>

          <div className="grid items-stretch gap-2.5 md:grid-cols-2">
            {starters.map((starter) => {
              const scenario = getWorkspaceScenario(starter.scenarioId);
              const starterRoleDesk = starter.roleId
                ? workspaceRoleDesks.find((desk) => desk.id === starter.roleId) ?? null
                : null;
              const run =
                workflowRuns.find((item) => item.scenarioId === starter.scenarioId) ?? null;
              const meta = getRunStateMeta(run);
              const safeTitle = getPrivacySafeStarterTitle(
                starter,
                scenario?.title || starter.title,
                language,
              );
              const previewStages = scenario?.workflowStages.slice(0, 3) ?? [];
              const previewApps = (scenario?.desktopApps ?? []).slice(0, 2);
              const previewAssets = (scenario?.resultAssets ?? starter.assets).slice(0, 2);
              const active = starter.id === selectedStarter.id;

              return (
                <div
                  key={starter.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedStarterId(starter.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedStarterId(starter.id);
                    }
                  }}
                  className={[
                    "flex h-full cursor-pointer flex-col rounded-[24px] p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                    active
                      ? "bg-white/14 shadow-[0_14px_46px_rgba(0,0,0,0.2)] ring-1 ring-white/18"
                      : "bg-black/14 hover:bg-white/10 hover:ring-1 hover:ring-white/12",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          solutionBadgeClasses[starter.accent],
                        ].join(" ")}
                      >
                        {getIndustryBundle(starter.bundleId)?.title || "Solution"}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">{safeTitle}</div>
                      <div className="mt-1 text-[11px] text-white/52">
                        {starterRoleDesk?.title || scenario?.title || starter.triggerLabel}
                      </div>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        meta.className,
                      ].join(" ")}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {previewStages.slice(0, 2).map((stage) => {
                      const stageMeta = getWorkflowModeMeta(stage.mode);
                      return (
                        <span
                          key={stage.id}
                          className={[
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            stageMeta.className,
                          ].join(" ")}
                        >
                          {stage.title}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 text-[11px] leading-4 text-white/58">
                    {getCompactRunSummary(run, scenario?.workflowStages.length ?? 0)}
                  </div>

                  <div className="mt-2.5 flex min-h-9 flex-wrap content-start gap-1.5">
                    {previewApps.map((appId) => (
                      <span
                        key={appId}
                        className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-white/74"
                      >
                        {getAppShortName(appId, language)}
                      </span>
                    ))}
                    {previewAssets.map((asset) => (
                      <span
                        key={asset}
                        className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-white/74"
                      >
                        {asset}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onLaunchStarter(starter);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                    >
                      <PlayCircle className="h-3 w-3" />
                      {copy.launch}
                    </button>
                    {starterRoleDesk ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEnterRoleDesk(starterRoleDesk, starter.industryId);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-white/15"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {copy.role}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[24px] bg-black/18 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  <Sparkles className="h-3.5 w-3.5" />
                  Active Flow
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {getPrivacySafeStarterTitle(
                    selectedStarter,
                    selectedScenario?.title || selectedStarter.title,
                    language,
                  )}
                </div>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/72">
                {getCompactRunSummary(selectedRun, activeStageCount)}
              </div>
            </div>
            <div className="mt-1.5 text-[11px] leading-5 text-white/56">
              {selectedScenario?.workflowTitle || selectedBundle.summary}
            </div>
            <div className="mt-4 space-y-2.5">
              {(selectedScenario?.workflowStages ?? []).map((stage, index) => {
                const stageMeta = getWorkflowModeMeta(stage.mode);
                const isActive = selectedRun?.currentStageId === stage.id;
                const isDone =
                  selectedRun?.stageRuns.find((item) => item.id === stage.id)?.state === "completed";
                return (
                  <div
                    key={stage.id}
                    className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5"
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={[
                          "mt-1 h-3 w-3 rounded-full",
                          isActive
                            ? "bg-sky-300 shadow-[0_0_0_4px_rgba(125,211,252,0.16)]"
                            : isDone
                              ? "bg-emerald-400"
                              : "bg-white/28",
                        ].join(" ")}
                      />
                      {index < (selectedScenario?.workflowStages.length ?? 0) - 1 ? (
                        <span className="mt-2 h-full w-px bg-white/12" />
                      ) : null}
                    </div>
                    <div
                      className={[
                        "rounded-[18px] bg-white/[0.06] px-3 py-2.5",
                        isActive ? "ring-1 ring-white/14" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">
                            Stage {index + 1}
                          </div>
                          <div className="mt-1 text-[13px] font-semibold text-white">{stage.title}</div>
                        </div>
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            stageMeta.className,
                          ].join(" ")}
                        >
                          {stageMeta.label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {stage.appIds.slice(0, 3).map((appId) => (
                          <span
                            key={appId}
                            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/76"
                          >
                            {getAppDisplayName(appId, appId, language)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] bg-black/16 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {copy.role}
            </div>
            <div className="mt-2.5 text-sm font-semibold text-white">
              {roleDesk?.title || "General Desk"}
            </div>
            <div className="mt-2 text-xs leading-5 text-white/58">
              {roleDesk ? `${roleDesk.focus.length} 个关注焦点` : copy.noRole}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {roleDesk ? (
                <button
                  type="button"
                  onClick={() => onEnterRoleDesk(roleDesk, selectedStarter.industryId)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {copy.role}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onLaunchStarter(selectedStarter)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-slate-100"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {copy.launch}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspaceAppWidgetGrid({
  appIds,
  dockApps,
  language,
  appStateById,
  onOpenApp,
}: {
  appIds: AppId[];
  dockApps: AppId[];
  language: InterfaceLanguage;
  appStateById: Record<AppId, AppState>;
  onOpenApp: (appId: AppId) => void;
}) {
  const groupedApps = useMemo(() => {
    const grouped = new Map<(typeof workspaceCategoryOrder)[number], AppId[]>();
    for (const appId of appIds) {
      const category = getAppCategory(appId);
      const items = grouped.get(category) ?? [];
      items.push(appId);
      grouped.set(category, items);
    }

    return workspaceCategoryOrder
      .map((category) => {
        const items = grouped.get(category);
        if (!items?.length) return null;
        return {
          category,
          meta: getCategoryMeta(category, language),
          appIds: [...items].sort((left, right) => {
            const leftPinned = dockApps.includes(left) ? 1 : 0;
            const rightPinned = dockApps.includes(right) ? 1 : 0;
            if (leftPinned !== rightPinned) return rightPinned - leftPinned;
            return getAppDisplayName(left, left, language).localeCompare(
              getAppDisplayName(right, right, language),
              language === "zh-CN" ? "zh-CN" : language === "ja-JP" ? "ja-JP" : "en-US",
            );
          }),
        };
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
  }, [appIds, dockApps, language]);

  const dockCount = new Set(dockApps).size;

  return (
    <section className="mt-5 rounded-[30px] bg-[linear-gradient(145deg,rgba(6,10,18,0.58)_0%,rgba(15,23,42,0.5)_100%)] p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.14)] backdrop-blur-2xl sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Apps
          </div>
          <div className="mt-2 text-lg font-semibold text-white">桌面应用</div>
          <div className="mt-1 text-sm text-white/62">
            按工作类型分区展示，减少重复标签和桌面噪音。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
            {appIds.length} 个工作组件
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">
            {groupedApps.length} 个分区
          </div>
          <div className="rounded-full bg-sky-400/12 px-3 py-1.5 text-xs font-semibold text-sky-100">
            Dock {dockCount}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groupedApps.map((group) => (
          <div
            key={group.category}
            className="rounded-[26px] border border-white/10 bg-white/[0.03] p-3.5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{group.meta.label}</div>
                <div className="mt-1 text-xs leading-5 text-white/58">
                  {group.meta.description}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/75">
                  {group.appIds.length} 个应用
                </span>
                <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/60">
                  {group.meta.helper}
                </span>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {group.appIds.map((appId) => {
                const app = getApp(appId);
                const Icon = app.icon;
                const state = appStateById[appId];
                const isPinned = dockApps.includes(appId);
                const isActive = state === "open" || state === "opening";
                const isRunning = state !== "closed" && state !== "closing";

                return (
                  <button
                    key={appId}
                    type="button"
                    onClick={() => onOpenApp(appId)}
                    className={[
                      "group flex h-full flex-col rounded-[22px] p-3 text-left transition-all",
                      isActive
                        ? "bg-white/14 shadow-[0_14px_42px_rgba(0,0,0,0.18)] ring-1 ring-white/18"
                        : "bg-black/12 hover:bg-white/10 hover:ring-1 hover:ring-white/12",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/10 text-white shadow-lg transition-transform group-hover:scale-[1.03]">
                        <Icon className="h-4.5 w-4.5 text-white/88" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {isPinned ? (
                          <span className="rounded-full bg-sky-400/12 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                            Dock
                          </span>
                        ) : null}
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            运行中
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2.5 text-[13px] font-semibold text-white">
                      {getAppShortName(appId, language)}
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-white/55">
                      {isActive
                        ? "已展开，继续回到当前任务"
                        : isPinned
                          ? "已固定到 Dock，点击快速打开"
                          : "点击打开"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type AgentSidebarMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  error?: boolean;
};

type AgentSidebarSessionMeta = {
  id: string;
  title: string;
  updatedAt: number;
  lastMessage: string;
};

const AGENT_SIDEBAR_MAX_SESSIONS = 40;
const AGENT_SIDEBAR_MAX_MESSAGES = 120;
const AGENT_SIDEBAR_MESSAGE_KEY_PREFIX = "agentcore.desktop.agent-sidebar.messages.";
const AGENT_SIDEBAR_MESSAGE_KEY_SUFFIX = ".v1";

function normalizeAgentSidebarSessions(sessions: AgentSidebarSessionMeta[]) {
  const deduped = new Map<string, AgentSidebarSessionMeta>();
  for (const session of sessions) {
    if (!session?.id) continue;
    deduped.set(session.id, session);
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, AGENT_SIDEBAR_MAX_SESSIONS);
}

function extractAgentSidebarMessageTimestamp(message: AgentSidebarMessage) {
  const match = message.id.match(/^(\d+)/);
  const timestamp = Number(match?.[1] ?? "");
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function recoverAgentSidebarSessionsFromStorage(storage: Storage) {
  const recovered: AgentSidebarSessionMeta[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      !key ||
      !key.startsWith(AGENT_SIDEBAR_MESSAGE_KEY_PREFIX) ||
      !key.endsWith(AGENT_SIDEBAR_MESSAGE_KEY_SUFFIX)
    ) {
      continue;
    }

    const sessionId = key.slice(
      AGENT_SIDEBAR_MESSAGE_KEY_PREFIX.length,
      key.length - AGENT_SIDEBAR_MESSAGE_KEY_SUFFIX.length,
    );
    if (!sessionId) continue;

    try {
      const raw = storage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as AgentSidebarMessage[]) : null;
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      const firstUserMessage = parsed.find((message) => message.role === "user" && message.text.trim());
      const lastMessage = [...parsed]
        .reverse()
        .find((message) => message.text.trim());
      const updatedAt =
        parsed.reduce(
          (latest, message) => Math.max(latest, extractAgentSidebarMessageTimestamp(message)),
          0,
        ) || Date.now();

      recovered.push({
        id: sessionId,
        title: firstUserMessage?.text.slice(0, 18) || "恢复的会话",
        updatedAt,
        lastMessage: lastMessage?.text.slice(0, 60) || "",
      });
    } catch {
      // ignore malformed orphaned session payloads
    }
  }

  return normalizeAgentSidebarSessions(recovered);
}

function isAgentSidebarSessionEmpty(session: AgentSidebarSessionMeta) {
  return !session.lastMessage.trim() && ["新对话", "默认会话"].includes(session.title);
}

function pickPreferredAgentSidebarSessionId(
  sessions: AgentSidebarSessionMeta[],
  savedActiveSessionId: string | null,
) {
  if (savedActiveSessionId && sessions.some((session) => session.id === savedActiveSessionId)) {
    return savedActiveSessionId;
  }
  const latestNonEmptySession = sessions.find((session) => !isAgentSidebarSessionEmpty(session));
  return latestNonEmptySession?.id ?? sessions[0]?.id ?? "";
}

function AgentSidebar({
  collapsed,
  width,
  language,
  activeProvider,
  scenarioTitle,
  contextSummary,
  onToggleCollapsed,
  onResize,
}: {
  collapsed: boolean;
  width: number;
  language: InterfaceLanguage;
  activeProvider: LlmProviderId;
  scenarioTitle?: string;
  contextSummary: string;
  onToggleCollapsed: () => void;
  onResize: (nextWidth: number) => void;
}) {
  const sessionsStorageKey = "agentcore.desktop.agent-sidebar.sessions.v1";
  const activeSessionStorageKey = "agentcore.desktop.agent-sidebar.active-session.v1";
  const buildMessageStorageKey = (sessionId: string) =>
    `agentcore.desktop.agent-sidebar.messages.${sessionId}.v1`;
  const createWelcomeMessage = (text?: string): AgentSidebarMessage => ({
    id: `${Date.now()}-welcome`,
    role: "assistant",
    text:
      text ||
      "我是 AgentCore OS 助手。你可以直接让我拆任务、做调研、整理工作流，或给当前桌面下一步建议。",
  });
  const createSessionMeta = (title = "新对话"): AgentSidebarSessionMeta => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    updatedAt: Date.now(),
    lastMessage: "",
  });

  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionStrip, setShowSessionStrip] = useState(false);
  const [showPromptStrip, setShowPromptStrip] = useState(false);
  const [sessions, setSessions] = useState<AgentSidebarSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messagesBySessionId, setMessagesBySessionId] = useState<
    Record<string, AgentSidebarMessage[]>
  >({});
  const [storageHydrated, setStorageHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const messages = useMemo(() => {
    if (!activeSessionId) return [createWelcomeMessage()];
    return messagesBySessionId[activeSessionId] ?? [createWelcomeMessage()];
  }, [activeSessionId, messagesBySessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawSessions = window.localStorage.getItem(sessionsStorageKey);
      const parsedSessions = rawSessions ? (JSON.parse(rawSessions) as AgentSidebarSessionMeta[]) : null;
      const recoveredSessions = recoverAgentSidebarSessionsFromStorage(window.localStorage);
      const initialSessions =
        Array.isArray(parsedSessions) && parsedSessions.length > 0
          ? normalizeAgentSidebarSessions([...parsedSessions, ...recoveredSessions])
          : recoveredSessions.length > 0
            ? recoveredSessions
          : [createSessionMeta("默认会话")];
      setSessions(initialSessions);
      const savedActive = window.localStorage.getItem(activeSessionStorageKey);
      const resolvedActive = pickPreferredAgentSidebarSessionId(initialSessions, savedActive);
      setActiveSessionId(resolvedActive);
    } catch {
      const fallback = [createSessionMeta("默认会话")];
      setSessions(fallback);
      setActiveSessionId(fallback[0].id);
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!storageHydrated || !activeSessionId || typeof window === "undefined") return;
    setMessagesBySessionId((prev) => {
      if (prev[activeSessionId]) return prev;
      try {
        const raw = window.localStorage.getItem(buildMessageStorageKey(activeSessionId));
        const parsed = raw ? (JSON.parse(raw) as AgentSidebarMessage[]) : null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            ...prev,
            [activeSessionId]: parsed.slice(-AGENT_SIDEBAR_MAX_MESSAGES),
          };
        }
      } catch {
        // ignore
      }
      return {
        ...prev,
        [activeSessionId]: [createWelcomeMessage()],
      };
    });
  }, [activeSessionId, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        sessionsStorageKey,
        JSON.stringify(normalizeAgentSidebarSessions(sessions)),
      );
      if (activeSessionId) {
        window.localStorage.setItem(activeSessionStorageKey, activeSessionId);
      }
    } catch {
      // ignore
    }
  }, [activeSessionId, sessions, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || typeof window === "undefined") return;
    try {
      for (const [sessionId, sessionMessages] of Object.entries(messagesBySessionId)) {
        window.localStorage.setItem(
          buildMessageStorageKey(sessionId),
          JSON.stringify(sessionMessages.slice(-AGENT_SIDEBAR_MAX_MESSAGES)),
        );
      }
    } catch {
      // ignore
    }
  }, [messagesBySessionId, storageHydrated]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, collapsed]);

  const suggestions = useMemo(() => {
    const displayLanguage = getDisplayLanguage(language);
    if (displayLanguage === "en") {
      return [
        "Plan my top 3 actions for today",
        "Audit this workspace for automation gaps",
        "Turn this workflow into an SOP",
      ];
    }
    if (displayLanguage === "ja") {
      return [
        "今日の優先アクションを3つに絞って",
        "このワークスペースの自動化不足を点検して",
        "このフローをSOPにして",
      ];
    }
    return [
      "帮我拆今天最重要的 3 个动作",
      "检查这个工作台还有哪些自动化薄弱点",
      "把当前流程整理成 SOP 清单",
    ];
  }, [language]);

  const pinnedPrompts = useMemo(
    () => [
      {
        id: "priority",
        label: "今日优先级",
        prompt: "根据当前工作台，帮我整理今天最重要的 3 个执行动作，并说明先后顺序。",
      },
      {
        id: "automation",
        label: "自动化排查",
        prompt: "请审视当前工作台和流程，指出最值得优先补齐的自动化薄弱点。",
      },
      {
        id: "sop",
        label: "SOP 生成",
        prompt: "把当前这套工作流整理成简明 SOP，要求能直接交给团队执行。",
      },
    ],
    [],
  );

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  const clearConversation = () => {
    if (!activeSessionId) return;
    setMessagesBySessionId((prev) => ({
      ...prev,
      [activeSessionId]: [createWelcomeMessage("已清空当前会话。你可以继续基于当前工作台提问。")],
    }));
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? { ...session, title: "新对话", updatedAt: Date.now(), lastMessage: "" }
          : session,
      ),
    );
  };

  const createNewSession = () => {
    const reusableEmptySession = sessions.find((session) => isAgentSidebarSessionEmpty(session));
    if (reusableEmptySession) {
      setActiveSessionId(reusableEmptySession.id);
      setMessagesBySessionId((prev) => ({
        ...prev,
        [reusableEmptySession.id]: [createWelcomeMessage("已回到现有空白会话。")],
      }));
      return;
    }
    const next = createSessionMeta("新对话");
    setSessions((prev) => normalizeAgentSidebarSessions([next, ...prev]));
    setActiveSessionId(next.id);
    setMessagesBySessionId((prev) => ({
      ...prev,
      [next.id]: [createWelcomeMessage("已创建一个新的对话会话。")],
    }));
  };

  const deleteSession = (sessionId: string) => {
    const remaining = sessions.filter((session) => session.id !== sessionId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(buildMessageStorageKey(sessionId));
      } catch {
        // ignore
      }
    }
    if (remaining.length === 0) {
      const fallback = createSessionMeta("新对话");
      setSessions([fallback]);
      setActiveSessionId(fallback.id);
      setMessagesBySessionId({
        [fallback.id]: [createWelcomeMessage()],
      });
      return;
    }
    setSessions(remaining);
    setMessagesBySessionId((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const insertContextIntoDraft = () => {
    setDraft((prev) => {
      const next = prev.trim();
      return [next, "## 当前工作台上下文", contextSummary]
        .filter(Boolean)
        .join(next ? "\n\n" : "\n");
    });
  };

  const sendMessage = async (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text || loading || !activeSessionId) return;

    const targetSessionId = activeSessionId;

    const userMessage: AgentSidebarMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    };
    const runningTaskId = createTask({
      name: "Agent Sidebar Chat",
      status: "running",
      detail: text.slice(0, 80),
    });

    setMessagesBySessionId((prev) => {
      const current = prev[targetSessionId] ?? [createWelcomeMessage()];
      return {
        ...prev,
        [targetSessionId]: [...current, userMessage].slice(-AGENT_SIDEBAR_MAX_MESSAGES),
      };
    });
    setSessions((prev) =>
      prev
        .map((session) =>
          session.id === targetSessionId
            ? {
                ...session,
                title: session.title === "新对话" ? text.slice(0, 18) : session.title,
                updatedAt: Date.now(),
                lastMessage: text.slice(0, 60),
              }
            : session,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
    setDraft("");
    setLoading(true);

    try {
      const reply = await requestOpenClawAgent({
        message: text,
        sessionId: `webos-desktop-agent-sidebar-${targetSessionId}`,
        timeoutSeconds: 45,
      });
      const assistantMessage: AgentSidebarMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: reply || "（没有返回内容）",
      };
      setMessagesBySessionId((prev) => {
        const current = prev[targetSessionId] ?? [createWelcomeMessage()];
        return {
          ...prev,
          [targetSessionId]: [...current, assistantMessage].slice(-AGENT_SIDEBAR_MAX_MESSAGES),
        };
      });
      setSessions((prev) =>
        prev
          .map((session) =>
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  lastMessage: (reply || "（没有返回内容）").slice(0, 60),
                }
              : session,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
      updateTask(runningTaskId, { status: "done", detail: "对话完成" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      const errorMessage: AgentSidebarMessage = {
        id: `${Date.now()}-error`,
        role: "assistant",
        text: message,
        error: true,
      };
      setMessagesBySessionId((prev) => {
        const current = prev[targetSessionId] ?? [createWelcomeMessage()];
        return {
          ...prev,
          [targetSessionId]: [...current, errorMessage].slice(-AGENT_SIDEBAR_MAX_MESSAGES),
        };
      });
      setSessions((prev) =>
        prev
          .map((session) =>
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  lastMessage: message.slice(0, 60),
                }
              : session,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
      updateTask(runningTaskId, { status: "error", detail: message });
    } finally {
      setLoading(false);
    }
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      onResize(startWidth + delta);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  if (collapsed) {
    return (
      <aside className="absolute bottom-28 right-4 z-[45]">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="group inline-flex items-center gap-3 rounded-[22px] bg-[linear-gradient(180deg,rgba(7,12,24,0.9)_0%,rgba(10,17,32,0.82)_100%)] px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-transform hover:-translate-y-0.5"
          title="展开聊天"
          aria-label="展开聊天"
        >
          <AgentCoreLogoMark size={40} roundedClassName="rounded-2xl" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-semibold text-white">聊天</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/58">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {providerLabel(activeProvider)}
            </span>
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="absolute bottom-24 right-4 top-20 z-[45] flex flex-col overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,rgba(7,12,24,0.92)_0%,rgba(15,23,42,0.86)_58%,rgba(11,18,32,0.82)_100%)] shadow-[0_24px_72px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
      style={{ width }}
    >
      <div
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize"
        onPointerDown={startResize}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-2.5 border-b border-white/10 px-3 py-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72">
            <AgentCoreLogoMark size={22} roundedClassName="rounded-[8px]" />
            聊天
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">随时对话</div>
          <div className="mt-0.5 text-[11px] leading-4 text-white/58">
            {scenarioTitle ? `当前工作台：${scenarioTitle}` : "当前工作台未固定"} · {providerLabel(activeProvider)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={createNewSession}
            className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/82 transition-colors hover:bg-white/15"
          >
            新建
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/82 transition-colors hover:bg-white/15"
            title="折叠侧栏"
            aria-label="折叠侧栏"
          >
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="space-y-2">
          <div className="rounded-[18px] bg-white/[0.05] p-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowSessionStrip((prev) => !prev)}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white"
              >
                {showSessionStrip ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                会话
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/56">
                  {sessions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const latestNonEmptySession = sessions.find(
                    (session) =>
                      session.id !== activeSessionId && !isAgentSidebarSessionEmpty(session),
                  );
                  if (latestNonEmptySession) {
                    setActiveSessionId(latestNonEmptySession.id);
                  }
                }}
                className="text-[11px] font-semibold text-white/62 transition-colors hover:text-white"
                disabled={!sessions.some(
                  (session) => session.id !== activeSessionId && !isAgentSidebarSessionEmpty(session),
                )}
              >
                回到最近
              </button>
              <button
                type="button"
                onClick={clearConversation}
                className="text-[11px] font-semibold text-white/62 transition-colors hover:text-white"
              >
                清空当前
              </button>
            </div>
            {showSessionStrip ? (
              <div className="mt-2.5 max-h-72 space-y-2 overflow-y-auto pr-1">
                {sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={[
                        "rounded-2xl border px-3 py-2",
                        active ? "border-white/20 bg-white/14" : "border-white/10 bg-white/6",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(session.id)}
                        className="w-full text-left"
                      >
                        <div className="truncate text-xs font-semibold text-white">
                          {session.title || "新对话"}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/52">
                          {session.lastMessage || "暂无消息"}
                        </div>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] text-white/35">
                          {active ? "当前会话" : new Date(session.updatedAt).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSession(session.id)}
                          className="text-[10px] font-semibold text-white/45 transition-colors hover:text-white/80"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-[18px] bg-white/[0.05] p-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPromptStrip((prev) => !prev)}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white"
              >
                {showPromptStrip ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                常用
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/56">
                  {pinnedPrompts.length + suggestions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={insertContextIntoDraft}
                className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/76 transition-colors hover:bg-white/14"
              >
                插入上下文
              </button>
            </div>
            {showPromptStrip ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[...pinnedPrompts.map((item) => item.label), ...suggestions].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const preset = pinnedPrompts.find((prompt) => prompt.label === item);
                      void sendMessage(preset?.prompt ?? item);
                    }}
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/78 transition-colors hover:bg-white/14"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={[
                "max-w-[92%] rounded-[20px] border px-3 py-2.5 text-[13px] leading-6 shadow-sm",
                message.role === "user"
                  ? "ml-auto border-sky-200/30 bg-sky-400/12 text-white"
                  : message.error
                    ? "border-rose-300/30 bg-rose-400/10 text-rose-50"
                    : "border-white/10 bg-white/8 text-white/86",
              ].join(" ")}
            >
              {message.text}
            </div>
          ))}
          {loading ? (
            <div className="max-w-[92%] rounded-[20px] border border-white/10 bg-white/8 px-3 py-2.5 text-[13px] text-white/65">
              正在处理...
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="rounded-[20px] border border-white/10 bg-black/14 p-2.5">
          <div className="mb-2.5 rounded-[16px] border border-white/8 bg-white/6 px-3 py-1.5 text-[10px] leading-5 text-white/52">
            当前会话：{activeSession?.title || "新对话"}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            rows={3}
            placeholder="直接提问，例如：根据当前工作台，帮我给今天排一个执行顺序。"
            className="w-full resize-none bg-transparent text-[13px] leading-5 text-white outline-none placeholder:text-white/35"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="text-[10px] leading-4 text-white/48">
              `Enter` 发送，`Shift + Enter` 换行
            </div>
            <button
              type="button"
              disabled={loading || !draft.trim()}
              onClick={() => void sendMessage()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-950 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowRight className="h-3 w-3" />
              发送
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function providerLabel(id: LlmProviderId) {
  const map: Record<LlmProviderId, string> = {
    kimi: "Kimi (Moonshot)",
    deepseek: "DeepSeek",
    openai: "OpenAI",
    anthropic: "Claude (Anthropic)",
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

function RuntimeOnboardingCard({
  onChooseLightRuntime,
  onOpenEngineSettings,
}: {
  onChooseLightRuntime: () => void;
  onOpenEngineSettings: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[160] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-[linear-gradient(180deg,rgba(8,12,24,0.96)_0%,rgba(17,24,39,0.98)_100%)] p-6 shadow-[0_36px_120px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="flex justify-center">
          <AgentCoreLogoMark size={28} roundedClassName="rounded-[10px]" />
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onChooseLightRuntime}
            className="flex w-full items-center justify-between rounded-[24px] border border-emerald-200/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.2)_0%,rgba(255,255,255,0.05)_100%)] px-5 py-4 text-left transition-colors hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.26)_0%,rgba(255,255,255,0.08)_100%)]"
          >
            <span className="text-base font-semibold text-white">进入轻量级桌面</span>
            <ArrowRight className="h-4 w-4 text-emerald-100" />
          </button>

          <button
            type="button"
            onClick={onOpenEngineSettings}
            className="flex w-full items-center justify-between rounded-[24px] border border-white/12 bg-white/6 px-5 py-4 text-left transition-colors hover:bg-white/10"
          >
            <span className="text-base font-semibold text-white">配置桌面</span>
            <ArrowRight className="h-4 w-4 text-white/75" />
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
        "relative flex h-10 w-10 items-center justify-center rounded-[16px] transition-all sm:h-11 sm:w-11",
        active ? "bg-white/20" : "hover:bg-white/10",
      ].join(" ")}
    >
      {children}
      {running && (
        <span className="absolute -bottom-1 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full bg-white/70" />
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

function AgentCoreBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-full border border-white/12 bg-white/8 px-2 py-1.5 backdrop-blur-xl">
      <AgentCoreLogoMark size={32} roundedClassName="rounded-[12px]" />
      <div className="min-w-0 leading-none">
        <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/95">
          AgentCore OS
        </div>
        <div className="truncate text-[10px] text-white/60">
          Business Solution Operating System
        </div>
      </div>
    </div>
  );
}

function AgentCoreLogoMark({
  size = 32,
  roundedClassName = "rounded-[12px]",
}: {
  size?: number;
  roundedClassName?: string;
}) {
  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden ring-1 ring-white/18 shadow-[0_10px_24px_rgba(36,118,255,0.28)]",
        roundedClassName,
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <Image
        src="/agentcore-logo.png"
        alt="AgentCore OS"
        fill
        sizes={`${size}px`}
        className="object-cover"
        priority
      />
    </div>
  );
}
