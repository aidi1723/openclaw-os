"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  FileText,
  HardDrive,
  Inbox,
  CalendarDays,
  HeartPulse,
  Mic2,
  Newspaper,
  Rocket,
  Share2,
  Target,
  Video,
} from "lucide-react";

import type { AppId, AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  getAppDisplayName,
  getDisplayLanguage,
} from "@/lib/app-display";
import {
  deletePlaybook,
  importPlaybooksFromText,
  loadPlaybooks,
  subscribePlaybooks,
  type Playbook,
  type PlaybookAction,
  createPlaybook,
} from "@/lib/playbooks";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import { defaultSettings, loadSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp } from "@/lib/ui-events";

type Step = {
  title: string;
  desc: string;
  apps: Array<{ id: AppId; label: string }>;
};

export function SoloOpsAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const { toast, showToast } = useTimedToast(1800);
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(
    defaultSettings.personalization.interfaceLanguage,
  );
  const displayLanguage = getDisplayLanguage(interfaceLanguage);
  const t = useMemo(
    () =>
      displayLanguage === "en"
        ? {
            copied: "Copied to clipboard",
            copyFailed: "Copy failed",
            saveFailed: "Save failed: empty title",
            savedMine: "Saved to My Playbooks",
            title: "Workflow Playbooks",
            subtitle: "Use the fewest steps to turn idea -> content -> distribution -> review into a reusable system.",
            start: "Start Creating",
            publish: "Publish",
            step1: "1) Research and Positioning",
            step1Desc: "Clarify audience, pain point, and value prop; store reusable angles as assets.",
            step2: "2) Generate Content Pack",
            step2Desc: "Turn one idea into multiple platform-ready content outputs.",
            step3: "3) Distribute",
            step3Desc: "Choose channels, review formatting, and run a safe publishing rehearsal first.",
            step4: "4) Review and Iterate",
            step4Desc: "Turn winning hooks and structures into reusable templates.",
            open: "Open",
            builtins: "Ready-to-run Scenario Packs",
            builtinsDesc: "These are combinational workflows already runnable in WebOS.",
            save: "Save",
            mine: "My Playbooks",
            exportAll: "Export All",
            import: "Import",
            importPlaceholder: "Paste Playbook JSON",
            cancel: "Cancel",
            noPlaybooks: "No Playbooks yet. Save one from the scenario packs on the left.",
            export: "Export",
            remove: "Delete",
            deleted: "Deleted",
            todaySop: "Today's 30-minute SOP",
            automation: "Suggested Automation Path",
            automationDesc: "1) Rehearsal first -> 2) Connect platform auth -> 3) Server queue + callback -> 4) Metrics feedback and A/B tests.",
            importFailed: "Import failed",
            importDone: "Imported",
          }
        : displayLanguage === "ja"
          ? {
              copied: "クリップボードにコピーしました",
              copyFailed: "コピーに失敗しました",
              saveFailed: "保存に失敗しました: タイトルが空です",
              savedMine: "My Playbooks に保存しました",
              title: "ワークフロープレイブック",
              subtitle: "最小ステップで、企画 -> 制作 -> 配信 -> 振り返りを再利用可能な流れにします。",
              start: "作成開始",
              publish: "公開へ",
              step1: "1) 調査と企画",
              step1Desc: "対象、課題、価値提案を明確にし、再利用できる切り口を蓄積します。",
              step2: "2) コンテンツ生成",
              step2Desc: "ひとつのテーマから複数チャネル向けの内容を作ります。",
              step3: "3) 配信",
              step3Desc: "配信先を選び、まずは安全なリハーサルで確認します。",
              step4: "4) 振り返り",
              step4Desc: "効果の高いフックや構成をテンプレート化します。",
              open: "開く",
              builtins: "すぐ使えるシナリオ",
              builtinsDesc: "WebOS でそのまま使える組み合わせです。",
              save: "保存",
              mine: "My Playbooks",
              exportAll: "すべて書き出し",
              import: "読み込み",
              importPlaceholder: "Playbook JSON を貼り付け",
              cancel: "キャンセル",
              noPlaybooks: "まだ Playbook がありません。左側のシナリオから保存してください。",
              export: "書き出し",
              remove: "削除",
              deleted: "削除しました",
              todaySop: "今日の30分SOP",
              automation: "おすすめ自動化ルート",
              automationDesc: "1) まずリハーサル -> 2) 認証接続 -> 3) サーバーキュー + callback -> 4) 指標フィードバックとA/Bテスト。",
              importFailed: "読み込み失敗",
              importDone: "読み込み完了",
            }
          : {
              copied: "已复制到剪贴板",
              copyFailed: "复制失败（浏览器权限）",
              saveFailed: "保存失败：标题为空",
              savedMine: "已保存到“我的 Playbooks”",
              title: "Workflow Playbooks（MVP）",
              subtitle: "目标：用最少的步骤，把选题→内容→分发→复盘跑成“可复用系统”。",
              start: "开始产出",
              publish: "去发布",
              step1: "1) 定位与选题",
              step1Desc: "明确目标用户、痛点、卖点；把选题沉淀成可复用资产。",
              step2: "2) 生成内容包",
              step2Desc: "一份选题同时产出：小红书/抖音脚本/公众号长文（可按平台再细化）。",
              step3: "3) 矩阵分发",
              step3Desc: "选择平台、检查合规与排版；优先走“安全发布预演”，再逐步接入自动发布。",
              step4: "4) 复盘迭代",
              step4Desc: "把有效的开头、标题、话术沉淀为模板；形成可复用的内容增长闭环。",
              open: "打开",
              builtins: "成熟应用场景（可直接套用）",
              builtinsDesc: "这些是当前 WebOS 已经能跑起来的“组合拳”（先手动跑通，再接 webhook 实现自动发布）。",
              save: "保存",
              mine: "我的 Playbooks",
              exportAll: "导出全部",
              import: "导入",
              importPlaceholder: "粘贴 Playbook JSON（单个对象或数组）",
              cancel: "取消",
              noPlaybooks: "还没有 Playbook。你可以在左侧的“成熟应用场景”里点「保存」。",
              export: "导出",
              remove: "删除",
              deleted: "已删除",
              todaySop: "今日 30 分钟 SOP",
              automation: "建议的自动化路线",
              automationDesc: "1) 先做“发布预演”（可复制粘贴）→ 2) 接入平台授权 → 3) 服务端队列 + 回调 → 4) 指标回流与 A/B 测试。",
              importFailed: "导入失败",
              importDone: "已导入",
            },
    [displayLanguage],
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t.copied, "ok");
    } catch {
      showToast(t.copyFailed, "error");
    }
  }, [showToast, t]);

  const [myPlaybooks, setMyPlaybooks] = useState<Playbook[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const refreshPlaybooks = useCallback(() => {
    setMyPlaybooks(loadPlaybooks());
  }, []);

  useEffect(() => {
    const syncLanguage = () => setInterfaceLanguage(loadSettings().personalization.interfaceLanguage);
    syncLanguage();
    refreshPlaybooks();
    const unsub = subscribePlaybooks(refreshPlaybooks);
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("openclaw.playbooks")) refreshPlaybooks();
      syncLanguage();
    };
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, syncLanguage);
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      removeSettingsListener();
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshPlaybooks]);

  const steps: Step[] = useMemo(
    () => [
      {
        desc: t.step1Desc,
        title: t.step1,
        apps: [
          { id: "industry_hub", label: getAppDisplayName("industry_hub", "Industry App Center", interfaceLanguage) },
          { id: "tech_news_digest", label: getAppDisplayName("tech_news_digest", "Tech News Digest", interfaceLanguage) },
          { id: "creator_radar", label: getAppDisplayName("creator_radar", "Creator Radar", interfaceLanguage) },
          { id: "knowledge_vault", label: getAppDisplayName("knowledge_vault", "Knowledge Vault", interfaceLanguage) },
          { id: "task_manager", label: getAppDisplayName("task_manager", "Task Manager", interfaceLanguage) },
        ],
      },
      {
        title: t.step2,
        desc: t.step2Desc,
        apps: [
          { id: "content_repurposer", label: getAppDisplayName("content_repurposer", "Content Repurposer", interfaceLanguage) },
          { id: "media_ops", label: getAppDisplayName("media_ops", "AI Copy Studio", interfaceLanguage) },
          { id: "creative_studio", label: getAppDisplayName("creative_studio", "Creative Studio", interfaceLanguage) },
        ],
      },
      {
        title: t.step3,
        desc: t.step3Desc,
        apps: [
          { id: "publisher", label: getAppDisplayName("publisher", "Publisher", interfaceLanguage) },
          { id: "account_center", label: getAppDisplayName("account_center", "Account Center", interfaceLanguage) },
        ],
      },
      {
        title: t.step4,
        desc: t.step4Desc,
        apps: [
          { id: "knowledge_vault", label: getAppDisplayName("knowledge_vault", "Knowledge Vault", interfaceLanguage) },
          { id: "second_brain", label: getAppDisplayName("second_brain", "Second Brain", interfaceLanguage) },
          { id: "settings", label: getAppDisplayName("settings", "Settings", interfaceLanguage) },
        ],
      },
    ],
    [interfaceLanguage, t],
  );

  type BuiltinPlaybook = {
    title: string;
    desc: string;
    icon: ReactNode;
    actions: PlaybookAction[];
  };

  const builtInPlaybooks: BuiltinPlaybook[] = useMemo(
    () => [
      {
        title: displayLanguage === "en" ? "Industry Bundles" : displayLanguage === "ja" ? "業界バンドル" : "行业应用组合",
        desc:
          displayLanguage === "en"
            ? "Open an industry-curated workspace built from mature workflow patterns."
            : displayLanguage === "ja"
              ? "成熟した OpenClaw 活用例をもとにした業界別ワークスペースを開きます。"
              : "打开按行业整理好的成熟工作流工作台。",
        icon: <BriefcaseBusiness className="h-4 w-4 text-sky-600" />,
        actions: [
          { type: "open_app", appId: "industry_hub", label: displayLanguage === "en" ? "Open Industry App Center" : displayLanguage === "ja" ? "業界アプリセンターを開く" : "打开行业应用中心" },
          { type: "open_app", appId: "solutions_hub", label: displayLanguage === "en" ? "Open Solutions Hub" : displayLanguage === "ja" ? "Solutions Hub を開く" : "打开方案库" },
        ],
      },
      {
        title: "Tech / Market Radar（多源摘要）",
        desc: "先从多源信息里挑出今天最重要的变化，再转成选题或今日优先级。",
        icon: <Compass className="h-4 w-4 text-slate-700" />,
        actions: [
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
      {
        title: "Creator Radar（日更选题雷达）",
        desc: "整理频道动态、评论区问题和近期主题，再把最值得做的一条内容送去拆分。",
        icon: <Compass className="h-4 w-4 text-cyan-600" />,
        actions: [
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          {
            type: "copy",
            label: "复制雷达模板",
            text:
              "请根据以下频道/创作者动态，输出今天最值得做的 3 个内容角度：\n" +
              "- 关注来源\n- 受众\n- 目标\n- 近期评论区问题\n" +
              "最后给出最适合先做短视频还是帖子。",
          },
        ],
      },
      {
        title: "Long-form -> Shorts（长内容再利用）",
        desc: "把长视频、播客、直播纪要拆成短视频脚本、帖子和 newsletter 摘要。",
        icon: <Video className="h-4 w-4 text-fuchsia-600" />,
        actions: [
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          {
            type: "copy",
            label: "复制拆分模板",
            text:
              "请把以下长内容拆成：\n" +
              "1) 30 秒短视频口播\n" +
              "2) 一条社媒帖子\n" +
              "3) 一段 newsletter 摘要\n" +
              "要求：保留同一个核心观点，但适配不同平台节奏。",
          },
        ],
      },
      {
        title: "矩阵内容增长（小红书/抖音/Ins/TikTok）",
        desc: "一份选题产出 4 端版本 + 封面 + 发布清单；先预演再自动化。",
        icon: <Share2 className="h-4 w-4 text-emerald-600" />,
        actions: [
          {
            type: "open_app",
            appId: "media_ops",
            label: "打开 AI 文案",
          },
          {
            type: "open_app",
            appId: "publisher",
            label: "打开 发布中心",
          },
          {
            type: "copy",
            label: "复制指令",
            text:
              "请把以下选题做成矩阵内容包：\n" +
              "1) 小红书：标题 3 个 + 正文 + 话题标签\n" +
              "2) 抖音：口播脚本 + 字幕要点 + 结尾关注引导\n" +
              "3) Instagram：短文 + hashtag\n" +
              "4) TikTok：强钩子 + 快节奏脚本\n" +
              "选题：<在这里填你的主题/产品卖点>\n" +
              "目标用户：<在这里填>\n" +
              "约束：避免夸大、可直接发布。",
          },
        ],
      },
      {
        title: "视频再利用（封面 + 高光剪辑）",
        desc: "把长视频快速剪成高光片段，并导出封面图用于各平台。",
        icon: <Video className="h-4 w-4 text-indigo-600" />,
        actions: [
          {
            type: "open_app",
            appId: "creative_studio",
            label: "打开 视觉工坊",
          },
          {
            type: "copy",
            label: "复制指令",
            text:
              "请从视频中提取封面并剪出 15 秒高光片段：\n" +
              "- 封面：第 10 秒，文字标题 8 字以内\n" +
              "- 高光：从第 0 秒开始，节奏快\n" +
              "- 输出：cover.png + clip.mp4",
          },
        ],
      },
      {
        title: "知识库问答（文件驱动）",
        desc: "把合同/素材/产品资料存进知识库，用问题驱动检索下一步该看什么。",
        icon: <HardDrive className="h-4 w-4 text-sky-600" />,
        actions: [
          {
            type: "open_app",
            appId: "knowledge_vault",
            label: "打开 知识库",
          },
          {
            type: "copy",
            label: "复制提问模板",
            text:
              "我想要达成的目标：<例如：写一篇公众号深度文/做一套销售话术>\n" +
              "当前资料包含：<例如：产品参数/历史合同/用户反馈>\n" +
              "请告诉我：最相关的 3 份资料 + 我还缺什么关键信息 + 下一步怎么做。",
          },
        ],
      },
      {
        title: "内容选题与标题库（可复用资产）",
        desc: "把高转化标题、开头、评论区常见问题沉淀为可复用组件。",
        icon: <FileText className="h-4 w-4 text-amber-600" />,
        actions: [
          { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "评论区/私信回复（半自动）",
        desc: "把高频提问做成标准回复 + 引导话术；先用 Spotlight 跑通，再接入 webhook 自动化。",
        icon: <Rocket className="h-4 w-4 text-rose-600" />,
        actions: [
          {
            type: "copy",
            label: "复制 Spotlight 指令",
            text:
              "（Spotlight）请把下面问题生成 3 条不同语气的标准回复，并给出一句引导私信/关注的 CTA：\n" +
              "问题：<在这里填用户提问>",
          },
          { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
        ],
      },
      {
        title: "Morning Brief（日启动）",
        desc: "把任务、草稿和今日重点压成晨报，减少启动摩擦。",
        icon: <Newspaper className="h-4 w-4 text-slate-700" />,
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          {
            type: "copy",
            label: "复制晨报模板",
            text:
              "请基于以下信息生成今日晨报：\n" +
              "- 今日唯一关键目标\n" +
              "- 正在推进的任务\n" +
              "- 昨天遗留事项\n" +
              "- 风险与优先级\n" +
              "要求：中文、简洁、给出先后顺序。",
          },
        ],
      },
      {
        title: "Meeting → Task（会后闭环）",
        desc: "会后直接整理纪要、抽取行动项并写入任务中心。",
        icon: <Mic2 className="h-4 w-4 text-cyan-600" />,
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          {
            type: "copy",
            label: "复制纪要模板",
            text:
              "请把下面会议记录整理成：\n" +
              "【会议摘要】\n【决议】\n【待办】\n" +
              "待办需要尽量包含负责人、动作、时间。",
          },
        ],
      },
      {
        title: "Inbox + Support（统一收口）",
        desc: "把邮件消息和客服问题统一收口，再拆成 digest 或回复草稿。",
        icon: <Inbox className="h-4 w-4 text-emerald-600" />,
        actions: [
          { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        title: "Email Follow-up（邮件推进）",
        desc: "写首封、跟进、催进度和回复邮件，避免在上下文切换里丢速度。",
        icon: <FileText className="h-4 w-4 text-blue-600" />,
        actions: [
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
          {
            type: "copy",
            label: "复制邮件模板",
            text:
              "请基于以下信息生成一封邮件：\n" +
              "- 背景\n- 目标\n- 需要对方回复的关键点\n- 语气：专业但不生硬\n" +
              "输出：主题 + 正文。",
          },
        ],
      },
      {
        title: "Lead Qualification（线索判断）",
        desc: "快速判断线索是否值得推进，补全预算、时间和下一步动作。",
        icon: <Compass className="h-4 w-4 text-indigo-600" />,
        actions: [
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          {
            type: "copy",
            label: "复制线索判断模板",
            text:
              "请基于以下线索信息输出：\n" +
              "1) 是否值得推进\n2) 缺失信息\n3) 风险点\n4) 下一步建议\n" +
              "线索信息：<公司/联系人/需求/预算/时间/备注>",
          },
        ],
      },
      {
        title: "Family Calendar（家庭节奏）",
        desc: "统一家庭日程、补货和晨间计划，适合高频日常生活管理。",
        icon: <CalendarDays className="h-4 w-4 text-amber-600" />,
        actions: [
          { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          {
            type: "copy",
            label: "复制家庭计划模板",
            text:
              "请基于以下家庭日程和待办，生成一份晨间计划：\n" +
              "- 今天关键安排\n- 接送/外出事项\n- 待采购/待提醒项目\n- 家庭协作建议",
          },
        ],
      },
      {
        title: "Habit Tracker（习惯打卡）",
        desc: "高频自我管理场景：打卡、看 streak、生成每日/每周复盘。",
        icon: <Target className="h-4 w-4 text-emerald-600" />,
        actions: [
          { type: "open_app", appId: "habit_tracker", label: "打开 Habit Tracker" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
      {
        title: "Health Tracker（健康记录）",
        desc: "记录睡眠、精力、症状和药物，用于整理变化趋势。",
        icon: <HeartPulse className="h-4 w-4 text-rose-600" />,
        actions: [
          { type: "open_app", appId: "health_tracker", label: "打开 Health Tracker" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          {
            type: "copy",
            label: "复制健康记录模板",
            text:
              "请把以下健康记录整理成摘要：\n" +
              "- 睡眠\n- 精力\n- 症状\n- 药物/补剂\n- 备注\n" +
              "注意：只总结变化，不做诊断。",
          },
        ],
      },
      {
        title: "Second Brain（沉淀洞察）",
        desc: "把碎片想法、客户观察、会议摘录整理成模式和 SOP。",
        icon: <Brain className="h-4 w-4 text-violet-600" />,
        actions: [
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          {
            type: "copy",
            label: "复制整理模板",
            text:
              "请基于以下笔记找出：\n" +
              "1) 重复出现的问题/模式\n" +
              "2) 哪些适合沉淀为 SOP 或模板\n" +
              "3) 哪些应该转成任务或草稿",
          },
        ],
      },
    ],
    [displayLanguage],
  );

  const runAction = useCallback(
    (action: PlaybookAction) => {
      if (action.type === "open_app") requestOpenApp(action.appId);
      if (action.type === "copy") copy(action.text);
    },
    [copy],
  );

  const saveBuiltinToMine = useCallback(
    (p: BuiltinPlaybook) => {
      const created = createPlaybook({
        title: p.title,
        desc: p.desc,
        actions: p.actions,
      });
      if (!created) {
        showToast(t.saveFailed, "error");
        return;
      }
      refreshPlaybooks();
      showToast(t.savedMine, "ok");
    },
    [refreshPlaybooks, showToast, t],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title={t.title}
      icon={BriefcaseBusiness}
      widthClassName="w-[1100px]"
      storageKey="openclaw.window.solo_ops"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-gray-900">
                {t.title}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t.subtitle}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => requestOpenApp("media_ops")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition-colors"
              >
                <Rocket className="h-4 w-4" />
                {t.start}
              </button>
              <button
                type="button"
                onClick={() => requestOpenApp("publisher")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                {t.publish}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {steps.map((s) => (
              <div key={s.title} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{s.title}</div>
                    <div className="mt-1 text-sm text-gray-600">{s.desc}</div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600/80" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {s.apps.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => requestOpenApp(a.id)}
                      className="px-3 py-2 rounded-xl bg-gray-50 text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {t.open} {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">{t.builtins}</div>
              <div className="mt-1 text-sm text-gray-600">
                {t.builtinsDesc}
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {builtInPlaybooks.map((p) => (
                  <div key={p.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-8 w-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                            {p.icon}
                          </span>
                          <div className="text-sm font-semibold text-gray-900">{p.title}</div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">{p.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveBuiltinToMine(p)}
                        className="shrink-0 px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {t.save}
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {p.actions.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          onClick={() => runAction(a)}
                          className="px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">{t.mine}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(JSON.stringify(myPlaybooks, null, 2))}
                    className="px-3 py-2 rounded-xl bg-gray-50 text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {t.exportAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportOpen((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-gray-50 text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {t.import}
                  </button>
                </div>
              </div>

              {importOpen && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={t.importPlaceholder}
                    className="w-full h-28 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImportOpen(false);
                        setImportText("");
                      }}
                      className="px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = importPlaybooksFromText(importText.trim());
                        if (!res.ok) {
                          showToast(`${t.importFailed}: ${res.error}`);
                          return;
                        }
                        refreshPlaybooks();
                        showToast(`${t.importDone} ${res.imported} Playbook`);
                        setImportOpen(false);
                        setImportText("");
                      }}
                      className="px-3 py-2 rounded-xl bg-gray-900 text-white font-semibold text-xs hover:bg-black transition-colors"
                    >
                      {t.import}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {myPlaybooks.length === 0 ? (
                  <div className="text-xs text-gray-500">
                    {t.noPlaybooks}
                  </div>
                ) : (
                  myPlaybooks.slice(0, 6).map((p) => (
                    <div key={p.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{p.title}</div>
                          <div className="mt-1 text-xs text-gray-600 line-clamp-2">{p.desc}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => copy(JSON.stringify(p, null, 2))}
                            className="px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            {t.export}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deletePlaybook(p.id);
                              refreshPlaybooks();
                              showToast(t.deleted);
                            }}
                            className="px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            {t.remove}
                          </button>
                        </div>
                      </div>
                      {p.actions.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {p.actions.slice(0, 4).map((a) => (
                            <button
                              key={`${p.id}:${a.label}`}
                              type="button"
                              onClick={() => runAction(a)}
                              className="px-3 py-2 rounded-xl bg-white text-gray-900 font-semibold text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Compass className="h-4 w-4 text-indigo-600" />
                {t.todaySop}
              </div>
              <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal pl-5">
                <li>选 1 个选题：目标用户 + 痛点 + 一句话卖点</li>
                <li>在「AI 文案」生成 2 套版本，保存到内容库</li>
                <li>在「AI 视觉工坊」出封面/剪辑关键画面</li>
                <li>在「矩阵发布中心」选择平台并预演发布</li>
                <li>在「知识库」记录：有效标题/开头/评论区问题</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">{t.automation}</div>
              <div className="mt-2 text-sm text-gray-600">
                {t.automationDesc}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
