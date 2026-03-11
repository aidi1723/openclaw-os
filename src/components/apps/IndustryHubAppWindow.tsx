"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  Layers,
  PlayCircle,
  Rocket,
  Sparkles,
  UserRound,
} from "lucide-react";

import type { AppId, AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { appCatalog, getAppDisplayName, getCategoryLabel, getDisplayLanguage } from "@/lib/app-display";
import {
  getIndustryBundle,
  industries,
  listBundlesByIndustry,
  mapIndustryToWorkspaceIndustry,
  type IndustryId,
} from "@/lib/industry-solutions";
import type { PlaybookAction } from "@/lib/playbooks";
import { defaultSettings, loadSettings, saveSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp } from "@/lib/ui-events";
import {
  industrySolutionStarters,
  runIndustrySolutionStarterActions,
  type IndustrySolutionStarter,
} from "@/lib/solution-starters";
import {
  getWorkspaceScenario,
  workspaceRoleDesks,
  type WorkspaceRoleId,
} from "@/lib/workspace-presets";
import {
  advanceWorkflowRun,
  completeWorkflowRun,
  failWorkflowRun,
  getWorkflowRuns,
  setWorkflowRunAwaitingHuman,
  startWorkflowRun,
  subscribeWorkflowRuns,
} from "@/lib/workflow-runs";

type CopySet = {
  title: string;
  subtitle: string;
  applyWorkspace: string;
  openCore: string;
  launchDesk: string;
  openSolutions: string;
  sourceCases: string;
  packagedApps: string;
  workspaceResult: string;
  openedApps: string;
  highlights: string;
  workspaceApps: string;
  appRoles: string;
  quickFlows: string;
  copyUseCases: string;
  runFlow: string;
  dashboard: string;
  shortcuts: string;
  runShortcut: string;
  workspaceBuilder: string;
  workspaceBuilderDesc: string;
  desktopSelection: string;
  dockSelection: string;
  applyCustomWorkspace: string;
  resetTemplate: string;
  addToDesktop: string;
  pinToDock: string;
  required: string;
  selectedCount: string;
  templates: string;
  todaysFocus: string;
  launchSequence: string;
  roleDesks: string;
  roleDesksDesc: string;
  roleFocus: string;
  applyRoleDesk: string;
  workflowMap: string;
  workflowMapDesc: string;
  resultAssets: string;
  startPoint: string;
  modeAuto: string;
  modeAssist: string;
  modeReview: string;
  modeManual: string;
  triggers: string;
  triggerDesc: string;
  startWorkflow: string;
  advanceWorkflow: string;
  holdForReview: string;
  completeWorkflow: string;
  failWorkflow: string;
  runtimeState: string;
  stateIdle: string;
  stateRunning: string;
  stateAwaitingHuman: string;
  stateCompleted: string;
  stateError: string;
  solutionStarters: string;
  solutionStartersDesc: string;
  starterTrigger: string;
  starterOutcome: string;
  starterAssets: string;
  launchStarter: string;
  starterLaunched: string;
};

function getCopy(language: InterfaceLanguage): CopySet {
  if (language === "en-US") {
    return {
      title: "Industry App Center",
      subtitle:
        "Package mature OpenClaw use cases into ready-to-run industry workbenches and apply them directly to your desktop.",
      applyWorkspace: "Apply to Workspace",
      openCore: "Open Core Apps",
      launchDesk: "Launch Industry Desk",
      openSolutions: "Open Solutions Hub",
      sourceCases: "Referenced use cases",
      packagedApps: "Packaged apps",
      workspaceResult: "Workspace applied",
      openedApps: "Core apps opened",
      highlights: "Why this bundle works",
      workspaceApps: "Workspace apps",
      appRoles: "App roles",
      quickFlows: "Recommended flows",
      copyUseCases: "Copy use cases",
      runFlow: "Run flow",
      dashboard: "Industry dashboard",
      shortcuts: "High-frequency shortcuts",
      runShortcut: "Run shortcut",
      workspaceBuilder: "Workspace builder",
      workspaceBuilderDesc:
        "Choose the apps you want to keep on desktop and pin to Dock, then generate your own industry workspace.",
      desktopSelection: "Desktop apps",
      dockSelection: "Dock apps",
      applyCustomWorkspace: "Apply custom workspace",
      resetTemplate: "Reset to template",
      addToDesktop: "Desktop",
      pinToDock: "Dock",
      required: "Required",
      selectedCount: "selected",
      templates: "templates",
      todaysFocus: "Today's recommended actions",
      launchSequence: "Default launch sequence",
      roleDesks: "Role desks",
      roleDesksDesc: "Enter from your role first, then let the system bring in the matching scenario, apps, and launch order.",
      roleFocus: "Focus",
      applyRoleDesk: "Enter role desk",
      workflowMap: "Default workflow",
      workflowMapDesc: "This is the recommended operating sequence for the selected role desk. It shows where AI assists, where people confirm, and what assets should be retained.",
      resultAssets: "Result assets",
      startPoint: "Start here",
      modeAuto: "Auto",
      modeAssist: "AI assist",
      modeReview: "Human review",
      modeManual: "Manual",
      triggers: "Triggers",
      triggerDesc: "A workflow should not depend only on manual clicking. These are the concrete events that can start the chain.",
      startWorkflow: "Start workflow",
      advanceWorkflow: "Advance",
      holdForReview: "Hold for review",
      completeWorkflow: "Mark complete",
      failWorkflow: "Mark failed",
      runtimeState: "Runtime state",
      stateIdle: "Idle",
      stateRunning: "Running",
      stateAwaitingHuman: "Awaiting human",
      stateCompleted: "Completed",
      stateError: "Error",
      solutionStarters: "Solution starters",
      solutionStartersDesc: "These are runnable industry entry points with seeded context, default apps, and expected outputs.",
      starterTrigger: "Trigger",
      starterOutcome: "Outcome",
      starterAssets: "Assets",
      launchStarter: "Launch starter",
      starterLaunched: "Starter launched",
    };
  }
  if (language === "ja-JP") {
    return {
      title: "業界アプリセンター",
      subtitle:
        "成熟した OpenClaw 活用例を業界別ワークベンチとしてまとめ、デスクトップへそのまま適用できます。",
      applyWorkspace: "ワークスペースに適用",
      openCore: "主要アプリを開く",
      launchDesk: "業界デスクを起動",
      openSolutions: "Solutions Hub を開く",
      sourceCases: "参照ユースケース",
      packagedApps: "パッケージ済みアプリ",
      workspaceResult: "ワークスペースを適用しました",
      openedApps: "主要アプリを開きました",
      highlights: "この構成が有効な理由",
      workspaceApps: "ワークスペース構成",
      appRoles: "アプリの役割",
      quickFlows: "おすすめフロー",
      copyUseCases: "ユースケースをコピー",
      runFlow: "フローを実行",
      dashboard: "業界ダッシュボード",
      shortcuts: "高頻度ショートカット",
      runShortcut: "ショートカット実行",
      workspaceBuilder: "ワークスペースビルダー",
      workspaceBuilderDesc:
        "デスクトップと Dock に置くアプリを選び、業界テンプレートを自分用に調整します。",
      desktopSelection: "デスクトップアプリ",
      dockSelection: "Dock アプリ",
      applyCustomWorkspace: "カスタム構成を適用",
      resetTemplate: "テンプレートに戻す",
      addToDesktop: "デスクトップ",
      pinToDock: "Dock",
      required: "必須",
      selectedCount: "選択済み",
      templates: "テンプレート",
      todaysFocus: "今日の推奨アクション",
      launchSequence: "既定の起動順序",
      roleDesks: "ロール別デスク",
      roleDesksDesc: "まず自分の役割から入り、対応するシナリオ、アプリ構成、起動順序をまとめて適用します。",
      roleFocus: "注力ポイント",
      applyRoleDesk: "このデスクに入る",
      workflowMap: "既定ワークフロー",
      workflowMapDesc: "選択中のロール別デスクに対する推奨進行順です。AI が補助する箇所、人が確認すべき箇所、残すべき資産を示します。",
      resultAssets: "残す資産",
      startPoint: "開始地点",
      modeAuto: "自動",
      modeAssist: "AI 補助",
      modeReview: "人の確認",
      modeManual: "手動",
      triggers: "トリガー",
      triggerDesc: "ワークフローは手動クリックだけに依存すべきではありません。ここでは開始イベントを定義します。",
      startWorkflow: "ワークフロー開始",
      advanceWorkflow: "次へ進める",
      holdForReview: "確認待ちにする",
      completeWorkflow: "完了にする",
      failWorkflow: "失敗にする",
      runtimeState: "実行状態",
      stateIdle: "待機中",
      stateRunning: "実行中",
      stateAwaitingHuman: "人の確認待ち",
      stateCompleted: "完了",
      stateError: "失敗",
      solutionStarters: "ソリューションスターター",
      solutionStartersDesc: "業界別の起点をそのまま走らせるための入口です。初期コンテキスト、標準アプリ、期待成果をまとめて適用します。",
      starterTrigger: "トリガー",
      starterOutcome: "成果物",
      starterAssets: "残る資産",
      launchStarter: "起動する",
      starterLaunched: "スターターを起動しました",
    };
  }
  return {
    title: "行业应用中心",
    subtitle:
      "把 awesome-openclaw-usecases 里成熟的落地场景，按行业打包成可直接使用的工作台和 app 组合。",
    applyWorkspace: "应用到工作台",
    openCore: "打开核心应用",
    launchDesk: "启动行业桌面",
    openSolutions: "打开方案库",
    sourceCases: "参考场景",
    packagedApps: "组合应用",
    workspaceResult: "已应用到当前工作台",
    openedApps: "已打开核心应用",
    highlights: "为什么这样组合",
    workspaceApps: "工作台配备",
    appRoles: "应用分工",
    quickFlows: "推荐流程",
    copyUseCases: "复制 use cases",
    runFlow: "运行流程",
    dashboard: "行业首页面板",
    shortcuts: "高频快捷入口",
    runShortcut: "执行快捷入口",
    workspaceBuilder: "工作台配置器",
    workspaceBuilderDesc: "选择要放到桌面和 Dock 的 app，把行业模板微调成你自己的工作台。",
    desktopSelection: "桌面应用",
    dockSelection: "Dock 应用",
    applyCustomWorkspace: "应用自定义工作台",
    resetTemplate: "恢复推荐模板",
    addToDesktop: "桌面",
    pinToDock: "Dock",
    required: "必选",
    selectedCount: "已选",
    templates: "套模板",
    todaysFocus: "今日推荐动作",
    launchSequence: "默认启动顺序",
    roleDesks: "角色工作台入口",
    roleDesksDesc: "先按角色进入，再让系统带出对应场景、默认应用组合和启动顺序，比先找 App 更接近真实业务入口。",
    roleFocus: "核心关注",
    applyRoleDesk: "进入这个角色工作台",
    workflowMap: "默认工作流",
    workflowMapDesc: "这里定义的是该角色进入后的推荐执行顺序，也标明了 AI 辅助、人工确认和最终该沉淀的业务资产。",
    resultAssets: "结果资产",
    startPoint: "建议起点",
    modeAuto: "自动执行",
    modeAssist: "AI 辅助",
    modeReview: "待人工确认",
    modeManual: "人工收口",
    triggers: "触发器",
    triggerDesc: "工作流不应该只靠手动点开。这里定义它会因什么事件被拉起。",
    startWorkflow: "启动这条流程",
    advanceWorkflow: "推进到下一步",
    holdForReview: "标记待确认",
    completeWorkflow: "标记已完成",
    failWorkflow: "标记失败",
    runtimeState: "运行状态",
    stateIdle: "待启动",
    stateRunning: "运行中",
    stateAwaitingHuman: "等待人工确认",
    stateCompleted: "已完成",
    stateError: "失败",
    solutionStarters: "行业解决方案 Starter",
    solutionStartersDesc: "这里不是再列一组 App，而是给每个行业一个可以直接启动的样板方案，带预填上下文、默认应用和预期结果。",
    starterTrigger: "触发场景",
    starterOutcome: "预期交付",
    starterAssets: "会沉淀的资产",
    launchStarter: "一键启动方案",
    starterLaunched: "已启动解决方案",
  };
}

function getWorkflowModeMeta(
  mode: "auto" | "assist" | "review" | "manual",
  copy: CopySet,
) {
  switch (mode) {
    case "auto":
      return {
        label: copy.modeAuto,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: Bot,
      };
    case "assist":
      return {
        label: copy.modeAssist,
        className: "border-blue-200 bg-blue-50 text-blue-700",
        icon: Sparkles,
      };
    case "review":
      return {
        label: copy.modeReview,
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: UserRound,
      };
    default:
      return {
        label: copy.modeManual,
        className: "border-gray-200 bg-gray-50 text-gray-700",
        icon: BriefcaseBusiness,
      };
  }
}

function getRunStateMeta(state: "idle" | "running" | "awaiting_human" | "completed" | "error", copy: CopySet) {
  switch (state) {
    case "running":
      return { label: copy.stateRunning, className: "border-blue-200 bg-blue-50 text-blue-700" };
    case "awaiting_human":
      return { label: copy.stateAwaitingHuman, className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "completed":
      return { label: copy.stateCompleted, className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "error":
      return { label: copy.stateError, className: "border-red-200 bg-red-50 text-red-700" };
    default:
      return { label: copy.stateIdle, className: "border-gray-200 bg-gray-50 text-gray-700" };
  }
}

function getShortcutAccentClasses(accent: "slate" | "blue" | "emerald" | "amber" | "rose") {
  switch (accent) {
    case "blue":
      return {
        wrap: "border-blue-200 bg-blue-50",
        button: "bg-blue-600 hover:bg-blue-700",
      };
    case "emerald":
      return {
        wrap: "border-emerald-200 bg-emerald-50",
        button: "bg-emerald-600 hover:bg-emerald-700",
      };
    case "amber":
      return {
        wrap: "border-amber-200 bg-amber-50",
        button: "bg-amber-500 hover:bg-amber-600",
      };
    case "rose":
      return {
        wrap: "border-rose-200 bg-rose-50",
        button: "bg-rose-600 hover:bg-rose-700",
      };
    default:
      return {
        wrap: "border-gray-200 bg-gray-50",
        button: "bg-gray-900 hover:bg-black",
      };
  }
}

function getStarterAccentClasses(accent: IndustrySolutionStarter["accent"]) {
  switch (accent) {
    case "blue":
      return {
        card: "border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#eef2ff_100%)]",
        pill: "border-blue-200 bg-blue-50 text-blue-700",
        button: "bg-blue-600 hover:bg-blue-700",
      };
    case "emerald":
      return {
        card: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#f0fdf4_100%)]",
        pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
        button: "bg-emerald-600 hover:bg-emerald-700",
      };
    case "amber":
      return {
        card: "border-amber-200 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_55%,#fff7ed_100%)]",
        pill: "border-amber-200 bg-amber-50 text-amber-700",
        button: "bg-amber-500 hover:bg-amber-600",
      };
    case "rose":
      return {
        card: "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_55%,#fff7ed_100%)]",
        pill: "border-rose-200 bg-rose-50 text-rose-700",
        button: "bg-rose-600 hover:bg-rose-700",
      };
    default:
      return {
        card: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#f1f5f9_100%)]",
        pill: "border-slate-200 bg-slate-50 text-slate-700",
        button: "bg-slate-900 hover:bg-black",
      };
  }
}

const REQUIRED_DESKTOP_APPS: AppId[] = ["industry_hub", "settings"];
const REQUIRED_DOCK_APPS: AppId[] = ["industry_hub"];

function uniqueAppIds(appIds: AppId[]) {
  return appIds.filter((appId, index) => appIds.indexOf(appId) === index);
}

export function IndustryHubAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(
    defaultSettings.personalization.interfaceLanguage,
  );
  const [industryId, setIndustryId] = useState<IndustryId>("creator_media");
  const [selectedBundleId, setSelectedBundleId] = useState("creator-command");
  const [selectedRoleId, setSelectedRoleId] = useState<WorkspaceRoleId>("creator");
  const [selectedDesktopApps, setSelectedDesktopApps] = useState<AppId[]>([]);
  const [selectedDockApps, setSelectedDockApps] = useState<AppId[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState(getWorkflowRuns());
  const { toast, showToast } = useTimedToast(1800);
  const displayLanguage = getDisplayLanguage(interfaceLanguage);
  const copy = useMemo(() => getCopy(interfaceLanguage), [interfaceLanguage]);

  useEffect(() => {
    const sync = () => setInterfaceLanguage(loadSettings().personalization.interfaceLanguage);
    sync();
    window.addEventListener("openclaw:settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("openclaw:settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => setWorkflowRuns(getWorkflowRuns());
    sync();
    const unsub = subscribeWorkflowRuns(sync);
    window.addEventListener("storage", sync);
    return () => {
      unsub();
      window.removeEventListener("storage", sync);
    };
  }, []);

  const bundles = useMemo(() => listBundlesByIndustry(industryId), [industryId]);
  const selectedBundle = useMemo(
    () => bundles.find((bundle) => bundle.id === selectedBundleId) ?? bundles[0] ?? null,
    [bundles, selectedBundleId],
  );
  const selectedRoleDesk = useMemo(
    () => workspaceRoleDesks.find((role) => role.id === selectedRoleId) ?? workspaceRoleDesks[0] ?? null,
    [selectedRoleId],
  );
  const selectedRoleScenario = useMemo(
    () => getWorkspaceScenario(selectedRoleDesk?.scenarioId ?? ""),
    [selectedRoleDesk],
  );
  const selectedWorkflowRun = useMemo(
    () => (selectedRoleScenario ? workflowRuns.find((run) => run.scenarioId === selectedRoleScenario.id) ?? null : null),
    [selectedRoleScenario, workflowRuns],
  );
  const starterCards = useMemo(() => {
    return industrySolutionStarters
      .slice()
      .sort((a, b) => {
        if (a.industryId === industryId && b.industryId !== industryId) return -1;
        if (b.industryId === industryId && a.industryId !== industryId) return 1;
        return a.title.localeCompare(b.title);
      });
  }, [industryId]);

  useEffect(() => {
    if (!bundles.some((bundle) => bundle.id === selectedBundleId)) {
      setSelectedBundleId(bundles[0]?.id ?? selectedBundleId);
    }
  }, [bundles, selectedBundleId]);

  useEffect(() => {
    if (!selectedBundle) return;
    setSelectedDesktopApps(uniqueAppIds([...selectedBundle.desktopApps, ...REQUIRED_DESKTOP_APPS]));
    setSelectedDockApps(uniqueAppIds([...selectedBundle.dockApps, ...REQUIRED_DOCK_APPS]));
  }, [selectedBundle]);

  const builderApps = useMemo(() => {
    if (!selectedBundle) return [] as AppId[];
    return uniqueAppIds([
      ...selectedBundle.desktopApps,
      ...selectedBundle.dockApps,
      ...selectedBundle.featuredApps,
      ...selectedBundle.launchSequence,
      ...selectedBundle.appSpotlights.map((item) => item.appId),
      ...REQUIRED_DESKTOP_APPS,
    ]);
  }, [selectedBundle]);

  const builderGroups = useMemo(() => {
    const appCategoryMap = new Map(appCatalog.map((item) => [item.id, item.category]));
    const grouped = new Map<string, AppId[]>();
    builderApps.forEach((appId) => {
      const category = appCategoryMap.get(appId) ?? "workflow";
      const list = grouped.get(category) ?? [];
      grouped.set(category, [...list, appId]);
    });
    return Array.from(grouped.entries()).map(([category, apps]) => ({
      category,
      label: getCategoryLabel(category as Parameters<typeof getCategoryLabel>[0], interfaceLanguage),
      apps,
    }));
  }, [builderApps, interfaceLanguage]);

  const applyWorkspace = (bundleId: string, desktopApps?: AppId[], dockApps?: AppId[]) => {
    const bundle = getIndustryBundle(bundleId);
    if (!bundle) return;
    const nextDesktopApps = uniqueAppIds([
      ...(desktopApps ?? bundle.desktopApps),
      ...REQUIRED_DESKTOP_APPS,
    ]);
    const nextDockApps = uniqueAppIds([
      ...(dockApps ?? bundle.dockApps).filter((appId) => nextDesktopApps.includes(appId)),
      ...REQUIRED_DOCK_APPS,
    ]);
    const settings = loadSettings();
    saveSettings({
      ...settings,
      personalization: {
        ...settings.personalization,
        activeIndustry: mapIndustryToWorkspaceIndustry(bundle.industryId),
        useCustomWorkspace: true,
        activeScenarioId: bundle.id,
        customDesktopApps: nextDesktopApps,
        customDockApps: nextDockApps,
      },
    });
    showToast(copy.workspaceResult, "ok");
  };

  const openCoreApps = (apps: AppId[]) => {
    apps.slice(0, 4).forEach((appId, index) => {
      window.setTimeout(() => requestOpenApp(appId), index * 90);
    });
    showToast(copy.openedApps, "ok");
  };

  const launchIndustryDesk = () => {
    if (!selectedBundle) return;
    applyWorkspace(selectedBundle.id);
    selectedBundle.launchSequence.forEach((appId, index) => {
      window.setTimeout(() => requestOpenApp(appId), 120 + index * 90);
    });
    showToast(copy.openedApps, "ok");
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(displayLanguage === "en" ? "Copied" : displayLanguage === "ja" ? "コピーしました" : "已复制", "ok");
    } catch {
      showToast(displayLanguage === "en" ? "Copy failed" : displayLanguage === "ja" ? "コピー失敗" : "复制失败", "error");
    }
  };

  const runActions = (actions: PlaybookAction[]) => {
    actions.forEach((action, index) => {
      window.setTimeout(() => {
        if (action.type === "open_app") requestOpenApp(action.appId);
        if (action.type === "copy") void copyText(action.text);
      }, index * 90);
    });
  };

  const toggleDesktopApp = (appId: AppId) => {
    if (REQUIRED_DESKTOP_APPS.includes(appId)) return;
    const nextDesktopApps = selectedDesktopApps.includes(appId)
      ? selectedDesktopApps.filter((item) => item !== appId)
      : [...selectedDesktopApps, appId];
    const normalizedDesktopApps = uniqueAppIds([...nextDesktopApps, ...REQUIRED_DESKTOP_APPS]);
    setSelectedDesktopApps(normalizedDesktopApps);
    setSelectedDockApps((current) => current.filter((item) => normalizedDesktopApps.includes(item)));
  };

  const toggleDockApp = (appId: AppId) => {
    setSelectedDesktopApps((desktopCurrent) =>
      desktopCurrent.includes(appId)
        ? desktopCurrent
        : uniqueAppIds([...desktopCurrent, appId, ...REQUIRED_DESKTOP_APPS]),
    );
    setSelectedDockApps((current) => {
      if (REQUIRED_DOCK_APPS.includes(appId)) return uniqueAppIds([...current, ...REQUIRED_DOCK_APPS]);
      return current.includes(appId)
        ? current.filter((item) => item !== appId)
        : uniqueAppIds([...current, appId, ...REQUIRED_DOCK_APPS]);
    });
  };

  const resetBuilder = () => {
    if (!selectedBundle) return;
    setSelectedDesktopApps(uniqueAppIds([...selectedBundle.desktopApps, ...REQUIRED_DESKTOP_APPS]));
    setSelectedDockApps(uniqueAppIds([...selectedBundle.dockApps, ...REQUIRED_DOCK_APPS]));
  };

  const applyRoleDesk = (scenarioId: string) => {
    const scenario = getWorkspaceScenario(scenarioId);
    if (!scenario) return;
    const settings = loadSettings();
    saveSettings({
      ...settings,
      personalization: {
        ...settings.personalization,
        activeIndustry: scenario.industryId,
        useCustomWorkspace: true,
        activeScenarioId: scenario.id,
        customDesktopApps: uniqueAppIds([...scenario.desktopApps, ...REQUIRED_DESKTOP_APPS]),
        customDockApps: uniqueAppIds([...scenario.dockApps, ...REQUIRED_DOCK_APPS]),
      },
    });
    scenario.dockApps.slice(0, 4).forEach((appId, index) => {
      window.setTimeout(() => requestOpenApp(appId), index * 90);
    });
    showToast(copy.workspaceResult, "ok");
  };

  const startSelectedWorkflow = (triggerId?: string) => {
    if (!selectedRoleScenario) return;
    const trigger = selectedRoleScenario.triggers.find((item) => item.id === triggerId) ?? selectedRoleScenario.triggers[0];
    startWorkflowRun(selectedRoleScenario, trigger?.type ?? "manual");
    showToast(copy.startWorkflow, "ok");
  };

  const launchSolutionStarter = (starter: IndustrySolutionStarter) => {
    setIndustryId(starter.industryId);
    setSelectedBundleId(starter.bundleId);
    if (starter.roleId) {
      setSelectedRoleId(starter.roleId);
    }
    applyWorkspace(starter.bundleId);
    const scenario = getWorkspaceScenario(starter.scenarioId);
    if (scenario) {
      startWorkflowRun(scenario, starter.triggerType);
    }
    runIndustrySolutionStarterActions(starter.actions);
    showToast(copy.starterLaunched, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title={copy.title}
      icon={BriefcaseBusiness}
      widthClassName="w-[1220px]"
      storageKey="openclaw.window.industry_hub"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">{copy.title}</div>
              <div className="mt-1 text-sm text-gray-500">{copy.subtitle}</div>
            </div>
            <button
              type="button"
              onClick={() => requestOpenApp("solutions_hub")}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              <Layers className="h-4 w-4" />
              {copy.openSolutions}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {industries.map((industry) => {
              const selected = industry.id === industryId;
              const bundleCount = listBundlesByIndustry(industry.id).length;
              return (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => setIndustryId(industry.id)}
                  className={[
                    "w-full rounded-2xl border p-4 text-left transition-colors",
                    selected
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold">{industry.title}</div>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        selected ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {bundleCount} {copy.templates}
                    </span>
                  </div>
                  <div className={["mt-1 text-xs", selected ? "text-white/75" : "text-gray-500"].join(" ")}>
                    {industry.desc}
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="space-y-4">
            <div className="rounded-[28px] border border-gray-200 bg-[linear-gradient(135deg,#fffaf2_0%,#f5f7ff_52%,#f6fffb_100%)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{copy.roleDesks}</div>
                  <div className="mt-1 text-sm leading-6 text-gray-600">{copy.roleDesksDesc}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                  industry + role + workflow
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                {workspaceRoleDesks.map((role) => {
                  const scenario = getWorkspaceScenario(role.scenarioId);
                  if (!scenario) return null;
                  const selected = role.id === selectedRoleId;
                  return (
                    <div
                      key={role.id}
                      className={[
                        "rounded-[24px] border p-4 shadow-sm transition-colors",
                        selected ? "border-gray-900 bg-white" : "border-white/80 bg-white/85",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{role.title}</div>
                          <div className="mt-1 text-sm leading-6 text-gray-600">{role.desc}</div>
                        </div>
                        <BriefcaseBusiness className="h-4 w-4 text-gray-700" />
                      </div>
                      <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                          {copy.roleFocus}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {role.focus.map((item) => (
                            <span
                              key={`${role.id}:${item}`}
                              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 text-xs leading-5 text-gray-500">
                        默认场景：{scenario.title} · Desktop {scenario.desktopApps.length} · Dock {scenario.dockApps.length}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRoleId(role.id)}
                          className={[
                            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                            selected
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <Sparkles className="h-4 w-4" />
                          {selected ? copy.startPoint : "查看流程"}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyRoleDesk(role.scenarioId)}
                          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                        >
                          <Rocket className="h-4 w-4" />
                          {copy.applyRoleDesk}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIndustryId(industries.find((industry) => mapIndustryToWorkspaceIndustry(industry.id) === scenario.industryId)?.id ?? industryId);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                        >
                          <Layers className="h-4 w-4" />
                          查看对应场景
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_46%,#fff7ed_100%)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-sm font-semibold text-gray-900">{copy.solutionStarters}</div>
                  <div className="mt-1 text-sm leading-6 text-gray-600">{copy.solutionStartersDesc}</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                  scenario-ready starters
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {starterCards.map((starter) => {
                  const accent = getStarterAccentClasses(starter.accent);
                  const starterRun =
                    workflowRuns.find((run) => run.scenarioId === starter.scenarioId) ?? null;
                  const starterRunMeta = getRunStateMeta(starterRun?.state ?? "idle", copy);
                  const industry = industries.find((item) => item.id === starter.industryId);
                  return (
                    <div
                      key={starter.id}
                      className={[
                        "rounded-[26px] border p-5 shadow-sm transition-transform hover:-translate-y-0.5",
                        accent.card,
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={["rounded-full border px-2.5 py-1 text-[11px] font-semibold", accent.pill].join(" ")}>
                              {industry?.title ?? starter.industryId}
                            </span>
                            <span className={["rounded-full border px-2.5 py-1 text-[11px] font-semibold", starterRunMeta.className].join(" ")}>
                              {copy.runtimeState} · {starterRunMeta.label}
                            </span>
                          </div>
                          <div className="mt-3 text-lg font-semibold text-gray-950">{starter.title}</div>
                          <div className="mt-1 text-sm leading-6 text-gray-600">{starter.summary}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => launchSolutionStarter(starter)}
                          className={[
                            "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-colors",
                            accent.button,
                          ].join(" ")}
                        >
                          <PlayCircle className="h-4 w-4" />
                          {copy.launchStarter}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {copy.starterTrigger}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-gray-800">{starter.triggerLabel}</div>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {copy.starterOutcome}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-gray-800">{starter.outcomeLabel}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {starter.apps.map((appId) => (
                          <span
                            key={`${starter.id}:${appId}`}
                            className="rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                          >
                            {getAppDisplayName(appId, appId, interfaceLanguage)}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {copy.starterAssets}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {starter.assets.map((asset) => (
                            <span
                              key={`${starter.id}:${asset}`}
                              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                            >
                              {asset}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRoleDesk && selectedRoleScenario ? (
              <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedRoleDesk.title} · {copy.workflowMap}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-gray-600">{copy.workflowMapDesc}</div>
                    <div className="mt-2 text-xs font-semibold text-gray-500">
                      {selectedRoleScenario.workflowTitle}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700">
                      {copy.startPoint}：{selectedRoleScenario.workflowStages[0]?.title ?? "—"}
                    </div>
                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-[11px] font-semibold",
                        getRunStateMeta(selectedWorkflowRun?.state ?? "idle", copy).className,
                      ].join(" ")}
                    >
                      {copy.runtimeState} · {getRunStateMeta(selectedWorkflowRun?.state ?? "idle", copy).label}
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{copy.triggers}</div>
                      <div className="mt-1 text-sm leading-6 text-gray-600">{copy.triggerDesc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startSelectedWorkflow()}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {copy.startWorkflow}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {selectedRoleScenario.triggers.map((trigger) => (
                      <button
                        key={`${selectedRoleScenario.id}:${trigger.id}`}
                        type="button"
                        onClick={() => startSelectedWorkflow(trigger.id)}
                        className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="text-sm font-semibold text-gray-900">{trigger.title}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-500">{trigger.type}</div>
                        <div className="mt-2 text-sm leading-6 text-gray-600">{trigger.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-4">
                  {selectedRoleScenario.workflowStages.map((stage, index) => {
                    const meta = getWorkflowModeMeta(stage.mode, copy);
                    const ModeIcon = meta.icon;
                    const stageRun = selectedWorkflowRun?.stageRuns.find((item) => item.id === stage.id);
                    const stageStateMeta = getRunStateMeta(
                      stageRun?.state === "pending" ? "idle" : stageRun?.state ?? "idle",
                      copy,
                    );
                    return (
                      <div
                        key={`${selectedRoleScenario.id}:${stage.id}`}
                        className="rounded-[24px] border border-gray-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 text-xs font-bold text-white">
                              {index + 1}
                            </span>
                            <div className="text-sm font-semibold text-gray-900">{stage.title}</div>
                          </div>
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              meta.className,
                            ].join(" ")}
                          >
                            <ModeIcon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-gray-600">{stage.desc}</div>
                        <div className="mt-3">
                          <span
                            className={[
                              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              stageStateMeta.className,
                            ].join(" ")}
                          >
                            {stageStateMeta.label}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {stage.appIds.map((appId) => (
                            <button
                              key={`${stage.id}:${appId}`}
                              type="button"
                              onClick={() => requestOpenApp(appId)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-50"
                            >
                              {getAppDisplayName(appId, appId, interfaceLanguage)}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedWorkflowRun ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{copy.runtimeState}</div>
                        <div className="mt-1 text-sm text-gray-600">
                          当前运行流：{selectedWorkflowRun.scenarioTitle} · trigger {selectedWorkflowRun.triggerType}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => advanceWorkflowRun(selectedWorkflowRun.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                          <PlayCircle className="h-4 w-4" />
                          {copy.advanceWorkflow}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkflowRunAwaitingHuman(selectedWorkflowRun.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          <UserRound className="h-4 w-4" />
                          {copy.holdForReview}
                        </button>
                        <button
                          type="button"
                          onClick={() => completeWorkflowRun(selectedWorkflowRun.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {copy.completeWorkflow}
                        </button>
                        <button
                          type="button"
                          onClick={() => failWorkflowRun(selectedWorkflowRun.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          <BriefcaseBusiness className="h-4 w-4" />
                          {copy.failWorkflow}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.resultAssets}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRoleScenario.resultAssets.map((item) => (
                      <span
                        key={`${selectedRoleScenario.id}:${item}`}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {bundles.map((bundle) => {
                const selected = bundle.id === selectedBundle?.id;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setSelectedBundleId(bundle.id)}
                    className={[
                      "rounded-2xl border p-5 text-left transition-colors",
                      selected
                        ? "border-blue-500 bg-blue-50/70"
                        : "border-gray-200 bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{bundle.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{bundle.summary}</div>
                      </div>
                      <Sparkles className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bundle.sourceUseCases.slice(0, 3).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBundle ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{selectedBundle.title}</div>
                    <div className="mt-1 text-sm text-gray-600">{selectedBundle.summary}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyWorkspace(selectedBundle.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {copy.applyWorkspace}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCoreApps(selectedBundle.featuredApps)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Rocket className="h-4 w-4" />
                      {copy.openCore}
                    </button>
                    <button
                      type="button"
                      onClick={launchIndustryDesk}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {copy.launchDesk}
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.shortcuts}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                    {selectedBundle.shortcutButtons.map((shortcut) => {
                      const accent = getShortcutAccentClasses(shortcut.accent);
                      return (
                        <div
                          key={`${selectedBundle.id}:${shortcut.title}`}
                          className={[
                            "rounded-2xl border p-4",
                            accent.wrap,
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{shortcut.title}</div>
                              <div className="mt-1 text-sm text-gray-600">{shortcut.caption}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => runActions(shortcut.actions)}
                              className={[
                                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors",
                                accent.button,
                              ].join(" ")}
                            >
                              <PlayCircle className="h-4 w-4" />
                              {copy.runShortcut}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {shortcut.actions.map((action) => (
                              <span
                                key={`${shortcut.title}:${action.label}`}
                                className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                              >
                                {action.type === "open_app"
                                  ? getAppDisplayName(action.appId, action.appId, interfaceLanguage)
                                  : action.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.dashboard}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {selectedBundle.dashboardCards.map((card) => (
                      <div
                        key={`${selectedBundle.id}:${card.label}`}
                        className="rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {card.label}
                        </div>
                        <div className="mt-2 text-lg font-bold text-gray-900">{card.value}</div>
                        <div className="mt-1 text-xs text-gray-500">{card.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{copy.workspaceBuilder}</div>
                      <div className="mt-1 text-sm text-gray-600">{copy.workspaceBuilderDesc}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={resetBuilder}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                      >
                        {copy.resetTemplate}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          selectedBundle &&
                          applyWorkspace(selectedBundle.id, selectedDesktopApps, selectedDockApps)
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {copy.applyCustomWorkspace}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      {builderGroups.map((group) => (
                        <div key={group.category} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                            {group.label}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {group.apps.map((appId) => {
                              const inDesktop = selectedDesktopApps.includes(appId);
                              const inDock = selectedDockApps.includes(appId);
                              const requiredDesktop = REQUIRED_DESKTOP_APPS.includes(appId);
                              const requiredDock = REQUIRED_DOCK_APPS.includes(appId);
                              return (
                                <div
                                  key={`${selectedBundle.id}:builder:${appId}`}
                                  className="rounded-2xl border border-gray-200 bg-white p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {getAppDisplayName(appId, appId, interfaceLanguage)}
                                      </div>
                                      {(requiredDesktop || requiredDock) ? (
                                        <div className="mt-1 text-xs font-semibold text-gray-500">
                                          {copy.required}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleDesktopApp(appId)}
                                      disabled={requiredDesktop}
                                      className={[
                                        "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                        inDesktop
                                          ? "bg-gray-900 text-white hover:bg-black"
                                          : "border border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100",
                                        requiredDesktop ? "cursor-default opacity-70" : "",
                                      ].join(" ")}
                                    >
                                      {copy.addToDesktop}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleDockApp(appId)}
                                      disabled={requiredDock}
                                      className={[
                                        "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                        inDock
                                          ? "bg-blue-600 text-white hover:bg-blue-700"
                                          : "border border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100",
                                        requiredDock ? "cursor-default opacity-70" : "",
                                      ].join(" ")}
                                    >
                                      {copy.pinToDock}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">{copy.desktopSelection}</div>
                      <div className="mt-2 text-xs text-gray-500">
                        {selectedDesktopApps.length} {copy.selectedCount}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDesktopApps.map((appId) => (
                          <span
                            key={`${selectedBundle.id}:desktop:${appId}`}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                          >
                            {getAppDisplayName(appId, appId, interfaceLanguage)}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 text-sm font-semibold text-gray-900">{copy.dockSelection}</div>
                      <div className="mt-2 text-xs text-gray-500">
                        {selectedDockApps.length} {copy.selectedCount}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDockApps.map((appId) => (
                          <span
                            key={`${selectedBundle.id}:dock:${appId}`}
                            className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                          >
                            {getAppDisplayName(appId, appId, interfaceLanguage)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.sourceCases}</div>
                    <div className="mt-3 space-y-2">
                      {selectedBundle.sourceUseCases.map((item) => (
                        <div key={item} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.packagedApps}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBundle.featuredApps.map((appId) => (
                        <button
                          key={appId}
                          type="button"
                          onClick={() => requestOpenApp(appId)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 text-sm font-semibold text-gray-900">{copy.workspaceApps}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBundle.desktopApps.map((appId) => (
                        <span
                          key={appId}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.highlights}</div>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
                      {selectedBundle.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.todaysFocus}</div>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
                      {selectedBundle.todayChecklist.map((item) => (
                        <li key={`${selectedBundle.id}:${item}`}>{item}</li>
                      ))}
                    </ol>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedBundle.launchSequence.map((appId) => (
                        <button
                          key={`${selectedBundle.id}:launch:${appId}`}
                          type="button"
                          onClick={() => requestOpenApp(appId)}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900">{copy.appRoles}</div>
                      <button
                        type="button"
                        onClick={() => copyText(selectedBundle.sourceUseCases.join("\n"))}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                      >
                        <Copy className="h-4 w-4" />
                        {copy.copyUseCases}
                      </button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedBundle.appSpotlights.map((item) => (
                        <div
                          key={`${selectedBundle.id}:${item.appId}`}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {getAppDisplayName(item.appId, item.appId, interfaceLanguage)}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-gray-500">
                                {item.role}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => requestOpenApp(item.appId)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                            >
                              {displayLanguage === "en" ? "Open" : displayLanguage === "ja" ? "開く" : "打开"}
                            </button>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">{item.outcome}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.quickFlows}</div>
                    <div className="mt-3 space-y-3">
                      {selectedBundle.quickActions.map((flow) => (
                        <div
                          key={`${selectedBundle.id}:${flow.title}`}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{flow.title}</div>
                              <div className="mt-1 text-sm text-gray-600">{flow.desc}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => runActions(flow.actions)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                            >
                              <PlayCircle className="h-4 w-4" />
                              {copy.runFlow}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {flow.actions.map((action) => (
                              <span
                                key={`${flow.title}:${action.label}`}
                                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                              >
                                {action.type === "open_app"
                                  ? getAppDisplayName(action.appId, action.appId, interfaceLanguage)
                                  : action.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.launchSequence}</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {selectedBundle.launchSequence.map((appId, index) => (
                      <div
                        key={`${selectedBundle.id}:sequence:${appId}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-900">
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-gray-800">
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
