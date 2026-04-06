"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Copy, Layers, Plus, ShieldCheck } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  getAppDisplayName,
  getCategoryLabel,
  getDisplayLanguage,
} from "@/lib/app-display";
import {
  createPlaybook,
  loadPlaybooks,
  subscribePlaybooks,
  type PlaybookAction,
} from "@/lib/playbooks";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import { sourceUseCaseIndustries } from "@/lib/openclaw-usecase-map";
import { defaultSettings, loadSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp } from "@/lib/ui-events";

type Solution = {
  id: string;
  category: string;
  tags: string[];
  title: string;
  desc: string;
  stacks: Array<{ title: string; items: string[] }>;
  playbooks: Array<{ title: string; desc: string; actions: PlaybookAction[] }>;
  setupChecklist: string;
};

function buildSolutions(): Solution[] {
  return [
    {
      id: "tech-news-radar",
      category: "信息摄取",
      tags: ["news digest", "tech", "market", "multi-source"],
      title: "Tech / Market Radar（多源信息摄取 → 摘要 → 行动）",
      desc: "参考 Multi-Source Tech News Digest 一类案例，把 RSS、X、GitHub、newsletter 等来源压成一份可行动摘要。",
      stacks: [
        { title: "输入", items: ["多源来源列表", "关注主题", "面向对象"] },
        { title: "输出", items: ["今日 3-5 个重要信号", "内容选题方向", "今日优先级调整建议"] },
      ],
      playbooks: [
        {
          title: "先看市场，再定今天动作",
          desc: "先做 digest，再把可做内容送去 Creator Radar，把影响执行的点送去 Morning Brief。",
          actions: [
            { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
            { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
            { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          ],
        },
      ],
      setupChecklist:
        "Tech / Market Radar 搭建清单：\n" +
        "1) 固定维护信息来源池。\n" +
        "2) 明确你真正关心的是产品、模型、分发还是增长。\n" +
        "3) 每次 digest 之后只保留 1-2 个真正要行动的点。",
    },
    {
      id: "creator-radar",
      category: "内容增长",
      tags: ["youtube digest", "creator", "research", "ideas"],
      title: "Creator Radar（日更选题 / 频道情报 / 评论区问题）",
      desc: "参考 Daily YouTube Digest 一类高频场景，把频道动态、评论区问题和可做角度压成一份日更摘要。",
      stacks: [
        { title: "输入", items: ["频道 / 创作者来源", "近期主题", "评论区高频问题"] },
        { title: "输出", items: ["今日 3 个值得做的角度", "推荐 hook", "下一步 app 动作"] },
      ],
      playbooks: [
        {
          title: "日更选题整理",
          desc: "先做一份雷达摘要，再把最值得跟进的一条送去拆内容。",
          actions: [
            { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
            { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          ],
        },
      ],
      setupChecklist:
        "Creator Radar 搭建清单：\n" +
        "1) 维护固定关注来源和频道池。\n" +
        "2) 把评论区反复出现的问题写进 notes。\n" +
        "3) 每天只挑 1 条最值得做的内容推进到下一步。",
    },
    {
      id: "content-repurposer",
      category: "内容增长",
      tags: ["repurpose", "shorts", "podcast", "youtube"],
      title: "Content Repurposer（长视频 / 播客 / 直播 → Shorts）",
      desc: "参考 YouTube Content Pipeline、Podcast Production Pipeline 一类案例，把长内容快速拆成多平台内容包。",
      stacks: [
        { title: "输入", items: ["逐字稿 / 摘要", "目标受众", "内容目标"] },
        { title: "输出", items: ["短视频口播", "社媒帖子", "newsletter 摘要"] },
      ],
      playbooks: [
        {
          title: "一稿多拆",
          desc: "先生成 repurpose pack，再发到发布中心继续排程。",
          actions: [
            { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          ],
        },
      ],
      setupChecklist:
        "Content Repurposer 搭建清单：\n" +
        "1) 先准备长内容摘要或逐字稿。\n" +
        "2) 统一定义目标受众和本轮目标。\n" +
        "3) 生成后先人工校对，再送去发布中心。",
    },
    {
      id: "habit-system",
      category: "个人生活",
      tags: ["habit", "routine", "accountability", "review"],
      title: "Habit System（打卡 + 复盘 + accountability）",
      desc: "把习惯打卡、连续 streak 和每日复盘放进一个轻量操作台，适合长期高频使用。",
      stacks: [
        { title: "输入", items: ["习惯列表", "daily / weekly cadence", "完成记录"] },
        { title: "输出", items: ["今日完成情况", "streak 变化", "简短复盘"] },
      ],
      playbooks: [
        {
          title: "每日复盘",
          desc: "先打卡，再生成一份简短复盘，明确明天最需要保持的一项习惯。",
          actions: [
            { type: "open_app", appId: "habit_tracker", label: "打开 Habit Tracker" },
            { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          ],
        },
      ],
      setupChecklist:
        "Habit System 搭建清单：\n" +
        "1) 先维护 1-3 个高价值习惯。\n" +
        "2) 每天只做最小可完成动作，先确保连续性。\n" +
        "3) 定期复盘并把卡点写进 Second Brain。",
    },
    {
      id: "health-rhythm",
      category: "个人生活",
      tags: ["health", "symptom", "sleep", "energy"],
      title: "Health Rhythm（睡眠 / 精力 / 症状记录）",
      desc: "把健康记录做成轻量追踪器，用于整理模式与就医前准备，不用于诊断。",
      stacks: [
        { title: "记录", items: ["睡眠", "精力", "症状", "药物/补剂"] },
        { title: "输出", items: ["近 7 天摘要", "模式整理", "线下就医前备忘"] },
      ],
      playbooks: [
        {
          title: "一周健康整理",
          desc: "记录变化，整理近期模式，必要时导出给自己或医生查看。",
          actions: [
            { type: "open_app", appId: "health_tracker", label: "打开 Health Tracker" },
          ],
        },
      ],
      setupChecklist:
        "Health Rhythm 搭建清单：\n" +
        "1) 按天记录睡眠、精力、症状和药物。\n" +
        "2) 只做整理和观察，不做自我诊断。\n" +
        "3) 如症状持续或恶化，及时线下就医。",
    },
    {
      id: "family-ops",
      category: "个人生活",
      tags: ["family", "calendar", "household", "morning brief"],
      title: "Family Ops（日程 + 家务 + 补货）",
      desc: "把家庭日程、补货清单和晨间计划放进一个轻量操作台，减少每天的重复协调。",
      stacks: [
        { title: "日程", items: ["家庭活动", "接送安排", "成员提醒"] },
        { title: "家务与补货", items: ["库存不足提醒", "购物清单", "临时家务事项"] },
        { title: "晨间计划", items: ["当日家庭安排", "高优先级提醒", "写入任务中心"] },
      ],
      playbooks: [
        {
          title: "家庭晨间计划",
          desc: "先看今天日程，再整理需要采购和提醒的事项。",
          actions: [
            { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
            { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          ],
        },
      ],
      setupChecklist:
        "Family Ops 搭建清单：\n" +
        "1) 先录入一周家庭日程。\n" +
        "2) 把高频补货项和家务项维护成清单。\n" +
        "3) 每天早晨生成一份家庭计划，并把必要事项转到任务中心。",
    },
    {
      id: "language-practice-desk",
      category: "个人成长",
      tags: ["translation", "language", "speaking", "tutor", "practice"],
      title: "Language Practice Desk（翻译 + 口语练习 + 复习）",
      desc: "对应 Language Learning Desk 一类高频场景，把翻译、重点表达、角色扮演和复习动作收口到一个 app 里。",
      stacks: [
        { title: "输入", items: ["母语", "目标语言", "使用场景", "原文或练习素材"] },
        { title: "输出", items: ["重点表达", "角色扮演", "说法纠正", "复习动作"] },
      ],
      playbooks: [
        {
          title: "先练再沉淀",
          desc: "先生成一份学习包，再把高频表达沉淀到知识库，并把复习写入任务中心。",
          actions: [
            { type: "open_app", appId: "language_learning_desk", label: "打开 Language Learning Desk" },
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          ],
        },
      ],
      setupChecklist:
        "Language Practice Desk 搭建清单：\n" +
        "1) 每次只练一个高频场景，例如旅行、会议或客服回复。\n" +
        "2) 先保留 5-10 个最常用表达，不要一次收太多。\n" +
        "3) 把下一次复习动作写入任务中心，形成真正的闭环。",
    },
    {
      id: "founder-os",
      category: "个人操作系统",
      tags: ["morning brief", "meeting", "crm", "second brain", "inbox", "email", "deal"],
      title: "Founder / Solo Operator OS（日启动 → 收口 → 沉淀）",
      desc: "把晨报、会议、收件箱、联系人跟进和知识沉淀串成一个单人运营系统。",
      stacks: [
        { title: "日启动", items: ["Morning Brief：今天主线", "任务中心：待办与阻塞", "Inbox Digest：先处理关键信息"] },
        { title: "协同与跟进", items: ["Meeting Copilot：会后纪要与待办", "Personal CRM：联系人推进", "Support Copilot：统一客服回复", "Email Assistant：邮件推进", "Deal Desk：线索判断"] },
        { title: "沉淀", items: ["Second Brain：整理洞察", "知识库：沉淀可复用资产", "草稿：把洞察转成可发布内容"] },
      ],
      playbooks: [
        {
          title: "每日开机 SOP",
          desc: "先看晨报，再收口 inbox，最后明确今天最重要的推进动作。",
          actions: [
            { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
            { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
            { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          ],
        },
        {
          title: "会后闭环：纪要 → CRM → Second Brain",
          desc: "把会后结论快速转成待办、联系人推进和长期知识。",
          actions: [
            { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
            { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
            { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          ],
        },
        {
          title: "外联推进：Email + Deal Desk",
          desc: "先判断线索，再生成邮件推进草稿，避免只停留在模糊线索。",
          actions: [
            { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
            { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
            { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
          ],
        },
      ],
      setupChecklist:
        "Founder OS 搭建清单：\n" +
        "1) 每天先用 Morning Brief 确定主线，再清收件箱。\n" +
        "2) 会后立刻生成纪要并写入任务中心。\n" +
        "3) 重要联系人在 CRM 里维护推进状态。\n" +
        "4) 每周把重复问题和洞察整理到 Second Brain / 知识库。",
    },
    {
      id: "email-ops",
      category: "外联与沟通",
      tags: ["email", "follow-up", "outreach", "reply"],
      title: "Email Ops（首封 / 跟进 / 回复）",
      desc: "用统一上下文写邮件，减少重写和催进度时的脑力浪费。",
      stacks: [
        { title: "输入", items: ["收件人", "背景", "目标", "语气"] },
        { title: "输出", items: ["主题 + 正文", "跟进版本", "写入草稿箱"] },
      ],
      playbooks: [
        {
          title: "跟进邮件：提醒但不冒犯",
          desc: "适合催进度、催反馈、再次确认时间。",
          actions: [
            { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
            {
              type: "copy",
              label: "复制跟进邮件模板",
              text:
                "请写一封跟进邮件：\n" +
                "- 背景：<上次沟通内容>\n" +
                "- 当前目标：<希望对方给出反馈/确认时间>\n" +
                "- 语气：礼貌、专业、简洁\n" +
                "输出：主题 + 正文。",
            },
          ],
        },
      ],
      setupChecklist:
        "Email Ops 搭建清单：\n" +
        "1) 统一记录背景和目标，避免每次重写。\n" +
        "2) 对关键邮件同步到 CRM / 任务中心。\n" +
        "3) 将高频场景沉淀为邮件模板。",
    },
    {
      id: "content-pipeline",
      category: "内容增长",
      tags: ["内容", "分发", "复盘", "模板"],
      title: "内容生产流水线（从选题到复盘）",
      desc: "把“选题→脚本/文案→素材→发布→复盘”固化成可重复的 SOP，并用 Playbooks 管理。",
      stacks: [
        { title: "内容资产", items: ["知识库（素材/FAQ/品牌口径）", "模板库（标题/开头/CTA）", "版本管理（草稿与发布记录）"] },
        { title: "生产工具（示例）", items: ["文案生成：LLM + 提示词模板", "视觉素材：设计/剪辑工具", "协作：文档/看板"] },
        { title: "分发与排程", items: ["发布预演（本项目内置）", "连接器：官方 API 或合规第三方排程工具", "发布回执（webhook receipts）"] },
      ],
      playbooks: [
        {
          title: "内容包：一稿多发（4 平台）",
          desc: "一份选题产出多平台版本 + 话题标签 + CTA。",
          actions: [
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            { type: "open_app", appId: "publisher", label: "打开 矩阵发布中心" },
            {
              type: "copy",
              label: "复制提示词模板",
              text:
                "请把以下选题做成多平台内容包：\n" +
                "1) 小红书：标题 3 个 + 正文 + 话题标签\n" +
                "2) 抖音：口播脚本 + 字幕要点 + 结尾 CTA\n" +
                "3) Instagram：短文 + hashtag\n" +
                "4) TikTok：强钩子 + 快节奏脚本\n" +
                "选题：<填写主题>\n" +
                "目标用户：<填写>\n" +
                "约束：避免夸大；可直接发布。",
            },
          ],
        },
        {
          title: "复盘：把有效素材沉淀成模板",
          desc: "把有效标题/开头/评论区问题沉淀为可复用资产。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
            {
              type: "copy",
              label: "复制复盘模板",
              text:
                "复盘记录：\n" +
                "- 目标：<转化/涨粉/引流>\n" +
                "- 发布平台：<平台>\n" +
                "- 有效点：标题/开头/结构/CTA/评论区问题\n" +
                "- 可复用模板：<标题公式/开头句式/回复模板>\n" +
                "- 下一轮实验：<A/B 变量与预期>",
            },
          ],
        },
      ],
      setupChecklist:
        "内容流水线搭建清单：\n" +
        "1) 在「设置」配置大模型 Provider（Key/Base URL/Model）。\n" +
        "2) 在「知识库」建立：品牌口径/FAQ/素材库/标题库。\n" +
        "3) 在「矩阵发布中心」先用“安全预演”跑通流程。\n" +
        "4) 如需自动发布：用 webhook 连接器对接官方 API 或合规第三方工具。\n" +
        "5) 每周固定复盘，把有效内容沉淀为模板与 Playbooks。",
    },
    {
      id: "customer-support",
      category: "用户运营",
      tags: ["客服", "私信", "评论", "SOP"],
      title: "评论区 / 私信 / 工单（标准回复 + 跟进）",
      desc: "把高频问题做成回复模板，并把需要跟进的对话自动变成任务/草稿。",
      stacks: [
        { title: "标准化", items: ["高频问题库（知识库）", "回复模板（多语气/多场景）", "合规口径（避免夸大承诺）"] },
        { title: "流转", items: ["统一入口（连接器：表单/邮箱/客服系统）", "自动建任务（webhook → task）", "人工审核后再发布/回复"] },
      ],
      playbooks: [
        {
          title: "标准回复：同问题 3 种语气",
          desc: "生成标准回复 + 1 句引导 CTA（关注/私信/下单）。",
          actions: [
            { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
            { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
            {
              type: "copy",
              label: "复制 Spotlight 指令",
              text:
                "> 请把下面问题生成 3 条不同语气的标准回复，并给出一句引导 CTA：\n" +
                "问题：<粘贴用户问题>\n" +
                "限制：避免夸大；尽量短；可直接发送。",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
      ],
      setupChecklist:
        "客服/跟进清单：\n" +
        "1) 在「知识库」建立 FAQ 与标准口径。\n" +
        "2) 把常见问题做成 Playbooks（回复模板）。\n" +
        "3) 用连接器把评论/私信/表单汇总到 webhook，再由人工审核后处理。\n" +
        "4) 需要长期跟进的对话转成任务并设定 SLA。",
    },
    {
      id: "launch-checklist",
      category: "发布上线",
      tags: ["发布", "清单", "复用"],
      title: "产品/活动发布（从准备到上线）",
      desc: "用“可复用清单 + 内容包 + 回执”把每次发布变成可复制的动作。",
      stacks: [
        { title: "准备", items: ["定位/卖点/FAQ（知识库）", "素材与落地页（资产管理）", "发布节奏（看板/日历）"] },
        { title: "上线", items: ["多平台内容包（文案/素材/脚本）", "发布队列与回执（Publisher）", "指标与反馈回流（后续接入）"] },
      ],
      playbooks: [
        {
          title: "发布清单：上线前 30 分钟",
          desc: "快速检查素材、口径、链接、风险点。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            { type: "open_app", appId: "publisher", label: "打开 矩阵发布中心" },
            {
              type: "copy",
              label: "复制检查清单",
              text:
                "上线前检查：\n" +
                "- 链接/二维码是否正确\n" +
                "- 标题/主卖点/价格口径一致\n" +
                "- 关键素材（封面/视频/图）齐全\n" +
                "- 风险词/夸大承诺已移除\n" +
                "- 评论区常见问题的标准回复已准备",
            },
          ],
        },
      ],
      setupChecklist:
        "发布流程清单：\n" +
        "1) 在「任务调度」建立发布里程碑与负责人（可个人）。\n" +
        "2) 在「AI 文案/视觉工坊」生成内容包与素材。\n" +
        "3) 在「发布中心」先 dry-run 预演，再决定是否 dispatch。\n" +
        "4) 通过连接器写入回执（id/url/时间）用于复盘。",
    },
    {
      id: "ecommerce-ops",
      category: "电商运营",
      tags: ["上新", "促销", "商品", "素材"],
      title: "电商上新与促销（素材包 + 发布节奏）",
      desc: "上新/大促时快速生成“商品卖点 + 素材清单 + 多平台文案”，并固化成复用模板。",
      stacks: [
        { title: "商品资产", items: ["卖点/参数/FAQ（知识库）", "图片/视频素材（视觉工坊）", "价格与活动口径（统一模板）"] },
        { title: "节奏与执行", items: ["任务看板（上新前 7 天）", "多平台内容包（文案/脚本）", "发布中心：预演/队列/回执"] },
      ],
      playbooks: [
        {
          title: "上新内容包：卖点 → 多平台文案",
          desc: "从商品信息生成：标题/主图文案/短视频脚本/FAQ。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制商品信息模板",
              text:
                "请基于以下商品信息，生成上新内容包：\n" +
                "- 核心卖点（3 条）\n" +
                "- 小红书：标题 3 个 + 正文 + 话题\n" +
                "- 抖音：口播脚本（15-25 秒）+ 字幕要点\n" +
                "- Instagram/TikTok：短文/脚本 + hashtag\n" +
                "- FAQ：10 个常见问题 + 标准回复\n" +
                "商品信息：<参数/材质/规格/价格/优惠>\n" +
                "目标人群：<填写>\n" +
                "限制：避免夸大；不使用绝对化用语。",
            },
          ],
        },
        {
          title: "大促清单：上线前 24 小时",
          desc: "检查库存、口径、素材、链接与风险点。",
          actions: [
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
            {
              type: "copy",
              label: "复制大促检查清单",
              text:
                "大促上线前 24 小时检查：\n" +
                "- 活动规则与价格口径一致\n" +
                "- 库存/发货时效明确\n" +
                "- 主图/视频/封面齐全并过审\n" +
                "- 站内链接/落地页/客服入口可用\n" +
                "- 评论区高频问题标准回复就绪\n" +
                "- 风险词/夸大承诺已移除",
            },
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          ],
        },
      ],
      setupChecklist:
        "电商上新/大促搭建清单：\n" +
        "1) 在「知识库」建立商品资料卡模板（参数/卖点/FAQ）。\n" +
        "2) 在「任务调度」建立上新节奏（T-7/T-3/T-1）。\n" +
        "3) 在「发布中心」先预演，确认排版与话题；再接 webhook 排程。\n" +
        "4) 复盘：把高转化标题/开头沉淀为模板。",
    },
    {
      id: "lead-gen-funnel",
      category: "增长获客",
      tags: ["线索", "漏斗", "表单", "转化"],
      title: "线索获取漏斗（内容 → 表单 → 跟进）",
      desc: "用内容引流到表单/私信入口，把线索自动变任务，并沉淀跟进脚本。",
      stacks: [
        { title: "入口", items: ["内容引流（多平台）", "表单/落地页（外部工具）", "自动建任务（webhook → task）"] },
        { title: "跟进", items: ["跟进脚本库（知识库）", "SLA 与提醒（任务调度）", "转化反馈与迭代（复盘模板）"] },
      ],
      playbooks: [
        {
          title: "引流文案：强钩子 + 表单 CTA",
          desc: "生成 3 个不同角度的引流文案，并带明确 CTA。",
          actions: [
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制引流提示词",
              text:
                "请生成引流内容（3 个角度）：\n" +
                "- 每个角度：标题 + 开头 2 句 + 正文 120-200 字 + CTA（填写表单/私信关键词）\n" +
                "目标人群：<填写>\n" +
                "价值承诺：<填写>\n" +
                "表单/私信入口：<链接或关键词>\n" +
                "限制：避免夸大；不承诺不可控结果。",
            },
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          ],
        },
        {
          title: "线索跟进：首次触达脚本（3 版本）",
          desc: "三种语气：专业/轻松/直给；带问题引导。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            {
              type: "copy",
              label: "复制跟进脚本模板",
              text:
                "请根据以下线索信息，写首次触达脚本（3 个版本）：\n" +
                "- 开场（表明来意）\n" +
                "- 3 个澄清问题（快速判断匹配度）\n" +
                "- 下一步建议（预约/试用/发资料）\n" +
                "线索来源：<平台/表单>\n" +
                "线索需求：<粘贴>\n" +
                "限制：不强推；尊重隐私。",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
      ],
      setupChecklist:
        "线索漏斗搭建清单：\n" +
        "1) 准备表单/落地页（外部工具），并定义字段（需求/预算/时间）。\n" +
        "2) 用连接器把表单提交推送到 webhook，并自动创建任务。\n" +
        "3) 在「知识库」沉淀：跟进脚本/常见异议处理。\n" +
        "4) 每周复盘：来源渠道 → 成交率 → 内容迭代。",
    },
    {
      id: "newsletter-system",
      category: "内容增长",
      tags: ["newsletter", "周报", "复用", "自动化"],
      title: "Newsletter / 周报系统（收集 → 写作 → 分发）",
      desc: "把一周的素材收集起来，自动整理成周报/Newsletter，并拆成短内容分发。",
      stacks: [
        { title: "收集", items: ["灵感/链接/素材（知识库）", "每周固定收集任务（任务调度）"] },
        { title: "写作与拆条", items: ["长文结构（模板）", "拆条成多平台短内容", "发布中心：预演与回执"] },
      ],
      playbooks: [
        {
          title: "周报大纲：3 栏目固定结构",
          desc: "把素材整理成：洞察/案例/行动建议。",
          actions: [
            { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制周报模板",
              text:
                "请把下面素材整理成一篇周报（800-1200 字）：\n" +
                "栏目 1：本周洞察（3 条）\n" +
                "栏目 2：案例拆解（1 条）\n" +
                "栏目 3：下周行动建议（5 条）\n" +
                "素材：<粘贴本周收集内容>\n" +
                "语气：清晰、克制、不夸大。",
            },
          ],
        },
        {
          title: "长文拆条：一稿多用（7 条）",
          desc: "把周报拆成 7 条短内容，适配不同平台。",
          actions: [
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
            {
              type: "copy",
              label: "复制拆条提示词",
              text:
                "请把下面长文拆成 7 条短内容：\n" +
                "- 每条：标题 + 3-6 句正文 + 话题/hashtag（可选）\n" +
                "- 保持信息一致，不新增不确定事实\n" +
                "长文：<粘贴周报正文>",
            },
          ],
        },
      ],
      setupChecklist:
        "周报系统搭建清单：\n" +
        "1) 在「任务调度」创建每周固定任务：收集素材/写作/拆条/发布。\n" +
        "2) 在「知识库」建立收集模板（来源/要点/可引用句）。\n" +
        "3) 发布时先 dry-run 预演，再接入 webhook 排程。\n" +
        "4) 复盘：打开率/互动 → 优化栏目与标题。",
    },
    {
      id: "brand-kit",
      category: "品牌与资产",
      tags: ["品牌", "一致性", "素材", "规范"],
      title: "品牌素材与一致性（Brand Kit）",
      desc: "把品牌口径、视觉风格、禁用词、常用模板沉淀成一套“可复用资产”。",
      stacks: [
        { title: "规范", items: ["品牌语气/禁用词/免责声明（知识库）", "标题/CTA 模板", "视觉风格（色彩/字体/封面结构）"] },
        { title: "生产", items: ["文案：按模板生成", "视觉：按 Brand Kit 输出", "发布：预演检查一致性"] },
      ],
      playbooks: [
        {
          title: "Brand Kit：口径与禁用词清单",
          desc: "生成品牌口径文档骨架，便于后续补全。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            {
              type: "copy",
              label: "复制 Brand Kit 模板",
              text:
                "请输出 Brand Kit 文档骨架：\n" +
                "1) 品牌一句话定位\n" +
                "2) 语气（Do/Don't）\n" +
                "3) 禁用词/风险词（以及替代说法）\n" +
                "4) 免责声明模板（按场景）\n" +
                "5) 标题/开头/CTA 模板库（各 10 条）\n" +
                "6) 常见问答标准口径（10 条）",
            },
          ],
        },
        {
          title: "发布前一致性检查",
          desc: "发布前检查是否符合 Brand Kit 与合规口径。",
          actions: [
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
            {
              type: "copy",
              label: "复制检查项",
              text:
                "一致性检查：\n" +
                "- 是否使用了禁用词/绝对化表述\n" +
                "- 标题/卖点与正文一致\n" +
                "- 视觉风格是否符合 Brand Kit\n" +
                "- CTA 是否清晰且不误导\n" +
                "- 如涉及效果承诺，是否加入必要免责声明",
            },
          ],
        },
      ],
      setupChecklist:
        "Brand Kit 搭建清单：\n" +
        "1) 在「知识库」建立 Brand Kit（口径/禁用词/模板）。\n" +
        "2) 在「视觉工坊」沉淀封面结构与风格参考。\n" +
        "3) 在「发布中心」把一致性检查固化为发布前必做步骤。",
    },
    {
      id: "ops-dashboard",
      category: "运营管理",
      tags: ["仪表盘", "复盘", "节奏", "效率"],
      title: "日常运营节奏（每日清单 + 周复盘）",
      desc: "建立每日 30 分钟例行 SOP + 每周复盘仪表盘，持续优化产出与分发。",
      stacks: [
        { title: "日常节奏", items: ["今日清单（固定 5 步）", "内容/客服/跟进 3 个 Inbox", "发布队列与回执"] },
        { title: "周复盘", items: ["本周产出/发布次数", "有效模板与失败原因", "下周实验计划（A/B）"] },
      ],
      playbooks: [
        {
          title: "每日 30 分钟 Ops",
          desc: "固定 5 步快速推进：收集→生产→发布→跟进→沉淀。",
          actions: [
            { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
            { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox Digest" },
            { type: "open_app", appId: "solo_ops", label: "打开 Workflow Playbooks" },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
            {
              type: "copy",
              label: "复制每日清单",
              text:
                "每日 30 分钟：\n" +
                "1) 收集：新增 3 条素材到知识库\n" +
                "2) 生产：生成 1 份内容包（或补齐素材）\n" +
                "3) 发布：预演/排程 1-2 条\n" +
                "4) 跟进：处理 5 条评论/私信/线索\n" +
                "5) 沉淀：记录 1 条可复用模板/洞察",
            },
          ],
        },
        {
          title: "周复盘：有效模板与下周实验",
          desc: "把结果回流到模板库与实验计划。",
          actions: [
            { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            {
              type: "copy",
              label: "复制周复盘模板",
              text:
                "周复盘：\n" +
                "- 本周产出：<数量>\n" +
                "- 本周发布：<数量>\n" +
                "- 有效模板：<标题/开头/结构/CTA>\n" +
                "- 失败原因：<分发/素材/定位/执行>\n" +
                "- 下周实验（A/B）：<变量、样本、预期>\n" +
                "- 需要补的资产：<素材/FAQ/口径>",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
      ],
      setupChecklist:
        "日常运营节奏搭建清单：\n" +
        "1) 固定每日 30 分钟 SOP（写入 Playbooks）。\n" +
        "2) 固定每周复盘（模板化），并把有效内容沉淀。\n" +
        "3) 将关键任务设置提醒与优先级，避免被碎片化打断。",
    },
    {
      id: "saas-growth",
      category: "SaaS 增长",
      tags: ["增长", "试用", "激活", "留存"],
      title: "SaaS 增长闭环（获客 → 激活 → 留存）",
      desc: "把内容获客、试用引导、功能教育与留存触达做成一套可复用 SOP，并用连接器回流指标。",
      stacks: [
        { title: "获客", items: ["内容矩阵（多平台）", "落地页/表单（外部工具）", "线索进入任务队列（webhook）"] },
        { title: "激活", items: ["新手引导/Onboarding 文案", "教育内容（教程/案例）", "关键动作清单（任务调度）"] },
        { title: "留存", items: ["周报/产品更新（Newsletter）", "用户触达（合规工具/官方 API）", "指标回流与复盘（后续接入）"] },
      ],
      playbooks: [
        {
          title: "激活邮件/站内引导：3 段式",
          desc: "欢迎 → 关键动作 → 下一步 CTA（预约/试用/教程）。",
          actions: [
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制激活模板",
              text:
                "请写 SaaS 试用激活引导（3 个版本，语气不同）：\n" +
                "- 目标：让用户完成关键动作（Activation）\n" +
                "- 结构：欢迎 + 价值一句话 + 关键动作步骤（3 步）+ CTA\n" +
                "产品：<一句话介绍>\n" +
                "目标用户：<填写>\n" +
                "关键动作：<例如：创建第一个项目/导入数据>\n" +
                "限制：短、清晰、不夸大。",
            },
          ],
        },
        {
          title: "新功能发布：一稿多用（公告 + 短内容）",
          desc: "把更新说明拆成公告与多平台短内容。",
          actions: [
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
            {
              type: "copy",
              label: "复制发布提示词",
              text:
                "请基于以下更新内容输出：\n" +
                "1) 更新公告（300-500 字）\n" +
                "2) 多平台短内容（5 条）：每条标题 + 3-5 句正文 + CTA\n" +
                "更新内容：<粘贴 changelog/功能说明>\n" +
                "用户收益：<填写>\n" +
                "限制：不承诺不可控结果；避免夸大。",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
      ],
      setupChecklist:
        "SaaS 增长闭环搭建清单：\n" +
        "1) 定义关键动作（Activation）与指标口径。\n" +
        "2) 用 Playbooks 固化：获客内容、激活引导、留存触达。\n" +
        "3) 用连接器：表单/CRM 线索进入任务；合规触达工具发送消息；回执写入发布记录。\n" +
        "4) 每周复盘：渠道 → 激活 → 留存，迭代模板与节奏。",
    },
    {
      id: "info-product",
      category: "知识产品",
      tags: ["课程", "转化", "交付", "社群"],
      title: "课程/知识产品（内容引流 → 转化 → 交付）",
      desc: "把引流内容、销售页要点、成交后交付与社群运营做成可复用 SOP。",
      stacks: [
        { title: "引流", items: ["选题与栏目（周更）", "多平台内容包", "线索入口（表单/私信关键词）"] },
        { title: "转化", items: ["销售页要点/FAQ（知识库）", "异议处理话术（模板）", "人工审核后再触达"] },
        { title: "交付", items: ["交付清单（任务调度）", "课程内容拆分与更新", "复盘：满意度与续费"] },
      ],
      playbooks: [
        {
          title: "课程引流：3 选题 + 7 天内容排期",
          desc: "快速生成一周排期，并给出每条内容的结构。",
          actions: [
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制排期提示词",
              text:
                "请为一个课程/知识产品生成：\n" +
                "1) 选题方向 3 个（每个方向给 5 个子选题）\n" +
                "2) 7 天内容排期（每天 1 条）：标题 + 大纲 + CTA（私信关键词/表单）\n" +
                "课程主题：<填写>\n" +
                "目标人群：<填写>\n" +
                "限制：避免夸大；给出可执行步骤。",
            },
            { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          ],
        },
        {
          title: "异议处理：标准话术库（10 条）",
          desc: "价格/时间/效果/信任等常见异议的回复模板。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            {
              type: "copy",
              label: "复制话术提示词",
              text:
                "请生成课程销售的异议处理话术库（10 条），覆盖：\n" +
                "- 价格贵/没时间/担心学不会/效果不确定/怕被骗/已经买过类似\n" +
                "每条给：共情一句 + 解释 + 1 个小承诺（可控）+ 下一步 CTA（预约/试学/发资料）。\n" +
                "课程信息：<一句话卖点 + 交付形式>\n" +
                "限制：不做不可控承诺；避免夸大。",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
      ],
      setupChecklist:
        "课程/知识产品搭建清单：\n" +
        "1) 在「知识库」沉淀：课程大纲、FAQ、案例、异议处理话术。\n" +
        "2) 用 Playbooks 固化：选题排期、引流 CTA、成交后交付清单。\n" +
        "3) 用连接器：表单线索 → 创建任务；成交回执 → 写入交付队列。\n" +
        "4) 每周复盘：引流 → 转化 → 完课/满意度。",
    },
    {
      id: "b2b-outreach",
      category: "B2B 外联",
      tags: ["外联", "邮件", "LinkedIn", "线索"],
      title: "B2B 外联系统（名单 → 触达 → 跟进）",
      desc: "把目标名单、触达脚本与跟进节奏做成可复用系统（不包含任何平台绕过自动化）。",
      stacks: [
        { title: "名单", items: ["目标画像（ICP）", "名单来源（外部：CRM/表格）", "去重与备注（外部或后续接入）"] },
        { title: "触达", items: ["首封/二封/三封脚本", "个性化要点提取（可选）", "合规发送（官方 API / 合规工具）"] },
        { title: "跟进", items: ["任务化跟进（提醒/SLA）", "异议处理与案例库（知识库）", "回执与复盘（响应率/预约率）"] },
      ],
      playbooks: [
        {
          title: "外联邮件：3 封序列（冷启动）",
          desc: "首封 + 跟进 1 + 跟进 2，适配不同语气。",
          actions: [
            { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
            { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
            { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制外联模板",
              text:
                "请为 B2B 外联写 3 封邮件序列：\n" +
                "1) 首封：一句话价值 + 2 个要点 + 1 个低门槛 CTA（15 分钟）\n" +
                "2) 跟进 1：补充一个案例/数据点（不夸大）\n" +
                "3) 跟进 2：给一个替代选择（资料包/异步）\n" +
                "目标客户画像（ICP）：<行业/规模/角色>\n" +
                "我们提供的价值：<一句话>\n" +
                "限制：不夸大；礼貌；可复制发送。",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
        {
          title: "跟进节奏：7 天任务化",
          desc: "把外联变成任务队列，避免遗漏。",
          actions: [
            { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
            {
              type: "copy",
              label: "复制 7 天节奏",
              text:
                "B2B 外联 7 天节奏：\n" +
                "Day 1：首封 + 记录备注\n" +
                "Day 3：跟进 1\n" +
                "Day 5：跟进 2\n" +
                "Day 7：收尾（是否关闭/转入长期培育）\n" +
                "每次记录：响应/下一步/风险点。",
            },
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          ],
        },
      ],
      setupChecklist:
        "B2B 外联搭建清单：\n" +
        "1) 定义 ICP 与不做触达的边界（合规）。\n" +
        "2) 把脚本、案例、异议处理沉淀到「知识库」。\n" +
        "3) 用连接器（合规工具/官方 API）发送与记录回执；或先手动执行。\n" +
        "4) 用「任务调度」管理 7 天跟进节奏并复盘响应率。",
    },
    {
      id: "hiring-delivery",
      category: "招聘与交付",
      tags: ["招聘", "面试", "交付", "外包"],
      title: "招聘/外包交付（需求 → 筛选 → 交付验收）",
      desc: "把招聘/外包从需求拆解到验收标准固化，减少沟通成本与返工。",
      stacks: [
        { title: "需求", items: ["岗位/外包需求卡（范围/产出/验收）", "时间线与风险（任务调度）"] },
        { title: "筛选", items: ["简历/作品筛选标准", "面试题库与评分表", "Offer/合同要点（外部或后续接入）"] },
        { title: "交付", items: ["里程碑与回传机制（webhook receipts）", "验收清单与缺陷闭环", "复盘：供应商/候选人表现"] },
      ],
      playbooks: [
        {
          title: "需求卡：范围 + 验收标准",
          desc: "把模糊需求变成可交付、可验收的清单。",
          actions: [
            { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
            {
              type: "copy",
              label: "复制需求卡模板",
              text:
                "请把下面需求整理成“可验收”的需求卡：\n" +
                "- 背景/目标\n" +
                "- 范围（做/不做）\n" +
                "- 交付物清单（文件/代码/文档）\n" +
                "- 验收标准（可测量）\n" +
                "- 时间线与里程碑\n" +
                "- 风险与依赖\n" +
                "原始需求：<粘贴>",
            },
            { type: "open_app", appId: "task_manager", label: "打开 任务调度" },
          ],
        },
        {
          title: "面试题库：按岗位生成 + 评分表",
          desc: "生成结构化面试题与评分维度。",
          actions: [
            { type: "open_app", appId: "media_ops", label: "打开 AI 文案" },
            {
              type: "copy",
              label: "复制面试模板",
              text:
                "请为以下岗位生成结构化面试包：\n" +
                "1) 核心能力维度（5-7 个）\n" +
                "2) 每个维度 2 个问题（含追问）\n" +
                "3) 评分表（1-5 分）与红旗信号\n" +
                "岗位：<填写>\n" +
                "级别：<初/中/高>\n" +
                "工作内容：<粘贴 JD 或要点>",
            },
          ],
        },
      ],
      setupChecklist:
        "招聘/外包交付搭建清单：\n" +
        "1) 用需求卡固化范围与验收标准（写入知识库）。\n" +
        "2) 用任务调度管理筛选/面试/里程碑交付。\n" +
        "3) 用连接器把回执（交付物链接/状态）写入发布/交付记录（后续可扩展）。\n" +
        "4) 复盘：质量/沟通/时效，沉淀供应商/候选人评估模板。",
    },
  ];
}

export function SolutionsHubAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const solutions = useMemo(() => buildSolutions(), []);
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(
    defaultSettings.personalization.interfaceLanguage,
  );
  const displayLanguage = getDisplayLanguage(interfaceLanguage);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(solutions[0]?.id ?? "content-pipeline");
  const [selectedSourceIndustry, setSelectedSourceIndustry] = useState(
    sourceUseCaseIndustries[0]?.industry ?? "Content & Media",
  );
  const [installedCount, setInstalledCount] = useState(0);
  const { toast, showToast } = useTimedToast(1600);
  const t = useMemo(
    () =>
      displayLanguage === "en"
        ? {
            copied: "Copied to clipboard",
            copyFailed: "Copy failed",
            installed: "Installed into My Playbooks",
            installFailed: "Already exists or install failed",
            title: "Solutions Hub",
            subtitle: "Turn proven workflows into Playbooks and connectors inside WebOS.",
            compliant: "Compliance first: official APIs / approved tools / webhook connectors",
            localFirst: "Local first: Playbooks are stored in browser localStorage",
            openPlaybooks: "Open Playbooks",
            installCurrent: "Install Current Solution",
            installedCount: "Installed Playbooks",
            searchPlaceholder: "Search solutions (keywords / tags)…",
            total: "Total",
            current: "Visible",
            noMatch: "No matching solution. Try a shorter keyword or search by category / tag.",
            structure: "Solution Structure",
            playbooks: "Playbooks (installable)",
            playbooksHint: "Installing the current solution will add these Playbooks into My Playbooks.",
            copyJson: "Copy Playbooks JSON",
            checklist: "Setup Checklist",
            checklistHint: "Use this to connect external tools or connectors into this UI.",
            copyChecklist: "Copy Checklist",
            openSettings: "Open Settings",
            openPublisher: "Open Publisher",
            noResult: "No result under current search, so the previous solution is hidden.",
            sourceMap: "Source Use Case Mapping",
            sourceMapHint:
              "Map source scenarios into current WebOS apps by industry, then open the packaged app set directly.",
            ready: "Ready",
            partial: "Partial",
            mappedApps: "Mapped apps",
            openPackagedFlow: "Open packaged flow",
          }
        : displayLanguage === "ja"
          ? {
              copied: "クリップボードにコピーしました",
              copyFailed: "コピーに失敗しました",
              installed: "My Playbooks に追加しました",
              installFailed: "すでに存在するか、追加に失敗しました",
              title: "Solutions Hub",
              subtitle: "実運用の流れを Playbooks と connector として WebOS に組み込みます。",
              compliant: "コンプライアンス優先: 公式API / 承認済みツール / webhook connector",
              localFirst: "ローカル優先: Playbooks はブラウザ localStorage に保存されます",
              openPlaybooks: "Playbooks を開く",
              installCurrent: "現在の案を追加",
              installedCount: "追加済み Playbooks",
              searchPlaceholder: "ソリューションを検索（キーワード / タグ）…",
              total: "合計",
              current: "表示中",
              noMatch: "一致するソリューションがありません。短いキーワードか分類 / タグで試してください。",
              structure: "構成",
              playbooks: "Playbooks（追加可能）",
              playbooksHint: "現在の案を追加すると、これらが My Playbooks に入ります。",
              copyJson: "Playbooks JSON をコピー",
              checklist: "構築チェックリスト",
              checklistHint: "外部ツールや connector をこの UI に接続するためのチェックです。",
              copyChecklist: "チェックリストをコピー",
              openSettings: "設定を開く",
              openPublisher: "Publisher を開く",
              noResult: "検索結果がないため、前の案は表示しません。",
              sourceMap: "元ユースケース対応表",
              sourceMapHint:
                "元のシナリオを現在の WebOS アプリに業界別で対応付け、まとめて開けます。",
              ready: "実装済み",
              partial: "一部対応",
              mappedApps: "対応アプリ",
              openPackagedFlow: "対応フローを開く",
            }
          : {
              copied: "已复制到剪贴板",
              copyFailed: "复制失败（浏览器权限）",
              installed: "已安装到“我的 Playbooks”",
              installFailed: "已存在或安装失败",
              title: "成熟落地方案库",
              subtitle: "用“方案 → Playbooks → 连接器”把真实业务流程快速装进 WebOS。",
              compliant: "合规优先：官方 API / 合规工具 / webhook 连接器",
              localFirst: "本地优先：Playbooks 存在浏览器 localStorage",
              openPlaybooks: "打开 Playbooks",
              installCurrent: "安装当前方案",
              installedCount: "已安装 Playbooks",
              searchPlaceholder: "搜索方案（关键词/标签）…",
              total: "共",
              current: "当前",
              noMatch: "没有匹配的方案。试试更短的关键词，或直接搜分类/标签。",
              structure: "方案结构",
              playbooks: "Playbooks（可直接安装）",
              playbooksHint: "点击「安装当前方案」会把这些 Playbooks 写入“我的 Playbooks”。",
              copyJson: "复制 Playbooks JSON",
              checklist: "搭建清单",
              checklistHint: "用于把外部工具/连接器“接入”到本 UI（不包含任何平台绕过自动化）。",
              copyChecklist: "复制清单",
              openSettings: "打开 设置",
              openPublisher: "打开 发布中心",
              noResult: "当前搜索没有结果，因此不会继续显示旧方案内容。",
              sourceMap: "来源场景映射",
              sourceMapHint: "按行业把来源场景映射到当前 WebOS 已封装的 app 和流程，可直接打开对应组合。",
              ready: "已封装",
              partial: "部分覆盖",
              mappedApps: "对应 app",
              openPackagedFlow: "打开对应流程",
            },
    [displayLanguage],
  );

  useEffect(() => {
    if (!isVisible) return;
    const syncLanguage = () => setInterfaceLanguage(loadSettings().personalization.interfaceLanguage);
    syncLanguage();
    const refresh = () => setInstalledCount(loadPlaybooks().length);
    refresh();
    const unsub = subscribePlaybooks(refresh);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("openclaw.playbooks")) refresh();
      syncLanguage();
    };
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, syncLanguage);
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      removeSettingsListener();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const filteredSolutions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return solutions;
    return solutions.filter((s) => {
      const hay = `${s.title} ${s.desc} ${s.category} ${s.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, solutions]);

  const visibleSelected = useMemo(
    () => filteredSolutions.find((s) => s.id === selectedId) ?? filteredSolutions[0] ?? null,
    [filteredSolutions, selectedId],
  );

  const visibleSourceIndustry = useMemo(
    () =>
      sourceUseCaseIndustries.find((item) => item.industry === selectedSourceIndustry) ??
      sourceUseCaseIndustries[0] ??
      null,
    [selectedSourceIndustry],
  );

  useEffect(() => {
    if (!filteredSolutions.some((s) => s.id === selectedId)) {
      setSelectedId(filteredSolutions[0]?.id ?? solutions[0]?.id ?? selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSolutions]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t.copied, "ok");
    } catch {
      showToast(t.copyFailed, "error");
    }
  }, [showToast, t]);

  const installSelected = useCallback(() => {
    if (!visibleSelected) return;
    const before = loadPlaybooks().length;
    for (const pb of visibleSelected.playbooks) {
      createPlaybook({ title: pb.title, desc: pb.desc, actions: pb.actions });
    }
    const after = loadPlaybooks().length;
    showToast(after > before ? t.installed : t.installFailed, after > before ? "ok" : "error");
    setInstalledCount(after);
  }, [showToast, t, visibleSelected]);

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title={t.title}
      icon={Layers}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.solutions_hub"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">{t.title}</div>
              <div className="text-sm text-gray-500 mt-1">
                {t.subtitle}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.compliant}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-semibold">
                  <BookOpen className="h-4 w-4" />
                  {t.localFirst}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => requestOpenApp("industry_hub")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                {displayLanguage === "en" ? "Open Industry App Center" : displayLanguage === "ja" ? "業界アプリセンターを開く" : "打开行业应用中心"}
              </button>
              <button
                type="button"
                onClick={installSelected}
                disabled={!visibleSelected}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t.installCurrent}
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {t.installedCount}：<span className="font-semibold text-gray-800">{installedCount}</span>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-gray-50/80 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">{t.sourceMap}</div>
              <div className="mt-1 text-sm text-gray-600">{t.sourceMapHint}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              {sourceUseCaseIndustries.map((industry) => {
                const active = industry.industry === visibleSourceIndustry?.industry;
                return (
                  <button
                    key={industry.industry}
                    type="button"
                    onClick={() => setSelectedSourceIndustry(industry.industry)}
                    className={[
                      "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                      active
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    {industry.industry}
                  </button>
                );
              })}
            </div>

            {visibleSourceIndustry ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {visibleSourceIndustry.apps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{app.name}</div>
                        <div className="mt-1 text-sm text-gray-600">{app.desc}</div>
                      </div>
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          app.coverage === "ready"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        {app.coverage === "ready" ? t.ready : t.partial}
                      </span>
                    </div>

                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                      {t.mappedApps}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {app.mappedApps.map((appId) => (
                        <span
                          key={`${app.id}:${appId}`}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          app.workflowActions.forEach((action, index) => {
                            window.setTimeout(() => {
                              if (action.type === "open_app") requestOpenApp(action.appId);
                            }, index * 90);
                          });
                        }}
                        className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                      >
                        {t.openPackagedFlow}
                      </button>
                      {app.mappedApps.slice(0, 3).map((appId) => (
                        <button
                          key={`${app.id}:open:${appId}`}
                          type="button"
                          onClick={() => requestOpenApp(appId)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-4">
          <aside className="lg:col-span-1 space-y-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <div className="mt-2 text-[11px] text-gray-500">
                {t.total} {solutions.length} · {t.current} {filteredSolutions.length}
              </div>
            </div>

            {filteredSolutions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                {t.noMatch}
              </div>
            )}

            {filteredSolutions.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={[
                    "w-full text-left rounded-2xl border p-4 transition-colors",
                    isActive ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className={["text-sm font-semibold", isActive ? "text-white" : "text-gray-900"].join(" ")}>
                    {s.title}
                  </div>
                  <div className={["mt-1 text-xs", isActive ? "text-white/75" : "text-gray-500"].join(" ")}>
                    {s.desc}
                  </div>
                  <div className={["mt-2 flex flex-wrap items-center gap-1.5", isActive ? "text-white/70" : "text-gray-500"].join(" ")}>
                    <span className={["text-[10px] px-2 py-0.5 rounded-full border font-semibold", isActive ? "border-white/20 bg-white/10" : "border-gray-200 bg-gray-50"].join(" ")}>
                      {getCategoryLabel(
                        s.category === "信息摄取"
                          ? "insight"
                          : s.category === "内容增长" || s.category === "发布上线"
                            ? "content"
                            : s.category === "个人生活"
                              ? "personal"
                              : s.category === "外联与沟通" || s.category === "用户运营" || s.category === "增长获客" || s.category === "B2B 外联"
                                ? "relationship"
                                : "workflow",
                        interfaceLanguage,
                      )}
                    </span>
                    {s.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className={["text-[10px] px-2 py-0.5 rounded-full border font-semibold", isActive ? "border-white/15 bg-white/5" : "border-gray-200 bg-white"].join(" ")}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="lg:col-span-3 space-y-4">
            {visibleSelected ? (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-semibold text-gray-900">{t.structure}</div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {visibleSelected.stacks.map((b) => (
                      <div key={b.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">{b.title}</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                          {b.items.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{t.playbooks}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {t.playbooksHint}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(JSON.stringify(visibleSelected.playbooks, null, 2))}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                    >
                      <Copy className="h-4 w-4" />
                      {t.copyJson}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {visibleSelected.playbooks.map((p) => (
                      <div key={p.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">{p.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{p.desc}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {p.actions.map((a) => (
                            <button
                              key={a.label}
                              type="button"
                              onClick={() => {
                                if (a.type === "open_app") requestOpenApp(a.appId);
                                if (a.type === "copy") void copy(a.text);
                              }}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                            >
                              {a.type === "open_app"
                                ? `${displayLanguage === "en" ? "Open" : displayLanguage === "ja" ? "開く" : "打开"} ${getAppDisplayName(a.appId, a.appId, interfaceLanguage)}`
                                : a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{t.checklist}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {t.checklistHint}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(visibleSelected.setupChecklist)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                    >
                      <Copy className="h-4 w-4" />
                      {t.copyChecklist}
                    </button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
                    {visibleSelected.setupChecklist}
                  </pre>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => requestOpenApp("settings")}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      {t.openSettings}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestOpenApp("publisher")}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      {t.openPublisher}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                {t.noResult}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
