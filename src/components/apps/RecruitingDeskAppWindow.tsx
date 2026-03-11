"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Mail, Sparkles, UserSearch } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  getRecruitingRecords,
  subscribeRecruitingRecords,
  upsertRecruitingRecord,
  type RecruitingRecord,
  type RecruitingStage,
} from "@/lib/recruiting";
import { createTask, updateTask } from "@/lib/tasks";
import { requestComposeEmail, requestOpenApp, type RecruitingDeskPrefill } from "@/lib/ui-events";

const stageOptions: Array<{ id: RecruitingStage; label: string }> = [
  { id: "sourced", label: "待筛选" },
  { id: "screen", label: "初筛中" },
  { id: "interview", label: "面试中" },
  { id: "final", label: "终面 / 评估" },
  { id: "offer", label: "Offer / 跟进" },
];

function buildLocalScorecard(input: {
  role: string;
  candidate: string;
  stage: RecruitingStage;
  profile: string;
  notes: string;
}) {
  const profileLines = input.profile
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  const noteLines = input.notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return [
    "【候选人摘要】",
    `- 岗位：${input.role.trim() || "未命名岗位"}`,
    `- 候选人：${input.candidate.trim() || "未命名候选人"}`,
    `- 当前阶段：${stageOptions.find((item) => item.id === input.stage)?.label ?? input.stage}`,
    "",
    "【优势】",
    ...(profileLines.length > 0 ? profileLines.map((line) => `- ${line}`) : ["- 资料较少，建议先补充核心经历。"]),
    "",
    "【风险】",
    ...(noteLines.length > 0 ? noteLines.map((line) => `- ${line}`) : ["- 暂无详细面试记录，建议补充评估意见。"]),
    "",
    "【建议下一步】",
    "- 明确 2-3 个需要进一步验证的能力点。",
    "- 若继续推进，安排下一轮面试并提前同步评估维度。",
    "- 若暂不推进，沉淀原因以便后续复盘。",
  ].join("\n");
}

function extractNextSteps(scorecard: string) {
  const sectionMatch = scorecard.match(/【建议下一步】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : scorecard;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function RecruitingDeskAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [role, setRole] = useState("");
  const [candidate, setCandidate] = useState("");
  const [stage, setStage] = useState<RecruitingStage>("screen");
  const [profile, setProfile] = useState("");
  const [notes, setNotes] = useState("");
  const [scorecard, setScorecard] = useState("");
  const [recordId, setRecordId] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [records, setRecords] = useState<RecruitingRecord[]>([]);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => setRecords(getRecruitingRecords());
    sync();
    const unsub = subscribeRecruitingRecords(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<RecruitingDeskPrefill>).detail;
      setRecordId(undefined);
      setRole(detail?.role ?? "");
      setCandidate(detail?.candidate ?? "");
      setStage(detail?.stage ?? "screen");
      setProfile(detail?.profile ?? "");
      setNotes(detail?.notes ?? "");
      setScorecard(detail?.scorecard ?? "");
      showToast("已带入招聘场景上下文", "ok");
    };
    window.addEventListener("openclaw:recruiting-desk-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:recruiting-desk-prefill", onPrefill);
  }, [showToast]);

  const generateScorecard = async () => {
    if (!role.trim() && !candidate.trim()) {
      showToast("请先填写岗位或候选人", "error");
      return;
    }

    const fallback = buildLocalScorecard({ role, candidate, stage, profile, notes });
    const taskId = createTask({
      name: "Assistant - Recruiting scorecard",
      status: "running",
      detail: `${role.trim() || "岗位"} / ${candidate.trim() || "candidate"}`,
    });

    setIsGenerating(true);
    try {
      const message =
        "你是 Recruiting Desk 助手。请把候选人资料和面试记录整理成一份可执行的中文评分卡。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含：\n" +
        "【候选人摘要】\n【优势】\n【风险】\n【建议下一步】\n" +
        "要求短句、可执行，不要空话。\n\n" +
        `岗位：${role.trim() || "未填写"}\n` +
        `候选人：${candidate.trim() || "未填写"}\n` +
        `阶段：${stage}\n` +
        `候选人资料：\n${profile.trim() || "(空)"}\n` +
        `面试 / 观察记录：\n${notes.trim() || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-recruiting-desk",
        timeoutSeconds: 120,
      });
      const nextScorecard = text || fallback;
      setScorecard(nextScorecard);
      setRecordId(
        upsertRecruitingRecord({
          id: recordId,
          role,
          candidate,
          stage,
          profile,
          notes,
          scorecard: nextScorecard,
        }),
      );
      updateTask(taskId, { status: "done" });
      showToast("候选人评分卡已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setScorecard(fallback);
      setRecordId(
        upsertRecruitingRecord({
          id: recordId,
          role,
          candidate,
          stage,
          profile,
          notes,
          scorecard: fallback,
        }),
      );
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已生成本地评分卡", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!scorecard.trim()) {
      showToast("请先生成评分卡", "error");
      return;
    }
    createDraft({
      title: `${candidate.trim() || "Candidate"} - Recruiting Scorecard`,
      body: scorecard,
      tags: ["recruiting", "candidate"],
      source: "import",
    });
    showToast("已写入草稿", "ok");
  };

  const pushTasks = () => {
    const nextSteps = extractNextSteps(scorecard);
    if (nextSteps.length === 0) {
      showToast("没有可写入的后续动作", "error");
      return;
    }
    nextSteps.forEach((item) => {
      createTask({
        name: `Recruiting - ${candidate.trim() || role.trim() || "Candidate"}`,
        status: "queued",
        detail: item,
      });
    });
    showToast(`已写入 ${nextSteps.length} 个后续动作`, "ok");
  };

  const draftFollowUp = () => {
    requestComposeEmail({
      recipient: candidate.trim(),
      subject: `${role.trim() || "岗位"} 面试后续`,
      goal: "安排下一步招聘流程或同步结果",
      context: scorecard.trim() || notes.trim(),
      tone: "warm",
    });
    showToast("已带入邮件助手", "ok");
  };

  const stats = useMemo(
    () => ({
      records: records.length,
      nextSteps: extractNextSteps(scorecard).length,
      latest: records[0]?.updatedAt ?? null,
    }),
    [records, scorecard],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Recruiting Desk"
      icon={UserSearch}
      widthClassName="w-[1140px]"
      storageKey="openclaw.window.recruiting_desk"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Recruiting Desk</div>
              <div className="mt-1 text-sm text-gray-500">
                按招聘与人才场景封装的评分卡工作台。适合候选人筛选、面试纪要整理和后续动作收口。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestOpenApp("meeting_copilot")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                打开会议助手
              </button>
              <button
                type="button"
                onClick={() => requestOpenApp("task_manager")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                打开任务中心
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">候选池</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{stats.records} 位</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">下一步</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{stats.nextSteps} 项</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">最近更新</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {stats.latest ? new Date(stats.latest).toLocaleString() : "暂无"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">岗位</span>
                  <input
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="如：Founding Product Designer"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">候选人</span>
                  <input
                    value={candidate}
                    onChange={(event) => setCandidate(event.target.value)}
                    placeholder="姓名或候选人代号"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">阶段</span>
                <select
                  value={stage}
                  onChange={(event) => setStage(event.target.value as RecruitingStage)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                >
                  {stageOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">候选人资料</span>
                <textarea
                  value={profile}
                  onChange={(event) => setProfile(event.target.value)}
                  placeholder="粘贴简历摘要、作品集要点、过往经历。"
                  rows={8}
                  className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <label className="mt-4 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">面试记录 / 观察</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="记录亮点、风险、用人经理反馈和待验证问题。"
                  rows={8}
                  className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateScorecard}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "生成中..." : "生成评分卡"}
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  写入草稿
                </button>
                <button
                  type="button"
                  onClick={pushTasks}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  同步后续动作
                </button>
                <button
                  type="button"
                  onClick={draftFollowUp}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  <Mail className="h-4 w-4" />
                  生成跟进邮件
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">评分卡输出</div>
              <pre className="mt-3 min-h-[360px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                {scorecard || "在左侧填写候选人信息后生成评分卡。"}
              </pre>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">最近候选人</div>
              <div className="mt-3 space-y-3">
                {records.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRecordId(item.id);
                      setRole(item.role);
                      setCandidate(item.candidate);
                      setStage(item.stage);
                      setProfile(item.profile);
                      setNotes(item.notes);
                      setScorecard(item.scorecard);
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:bg-gray-100"
                  >
                    <div className="text-sm font-semibold text-gray-900">{item.candidate}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.role}</div>
                    <div className="mt-2 text-xs text-gray-600">{stageOptions.find((stageItem) => stageItem.id === item.stage)?.label}</div>
                  </button>
                ))}
                {records.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有候选人记录。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
