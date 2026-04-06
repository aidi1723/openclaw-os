"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardCheck, FilePlus2, Mic2, Sparkles } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { getMeetings, subscribeMeetings, upsertMeeting, type MeetingRecord } from "@/lib/meetings";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenDealDesk } from "@/lib/ui-events";

function buildLocalMeetingSummary(title: string, participants: string, transcript: string) {
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const short = lines.slice(0, 6);
  const actionHints = lines
    .filter((line) => /todo|待办|行动|下一步|follow up|deadline|负责/i.test(line))
    .slice(0, 5);

  return [
    "【会议摘要】",
    `- 会议：${title.trim() || "未命名会议"}`,
    `- 参与人：${participants.trim() || "未填写"}`,
    ...(short.length > 0 ? short.map((line) => `- ${line}`) : ["- 暂无足够记录。"]),
    "",
    "【决议】",
    "- 建议把关键结论固化成 2-3 条可执行项。",
    "",
    "【待办】",
    ...(actionHints.length > 0
      ? actionHints.map((line) => `- ${line.replace(/^[-*]\s*/, "")}`)
      : ["- 整理负责人、截止时间和下一步动作。"]),
  ].join("\n");
}

function extractActionItems(summary: string) {
  const sectionMatch = summary.match(/【待办】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : summary;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function MeetingCopilotAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [meetingId, setMeetingId] = useState<string | undefined>(undefined);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => setRecords(getMeetings());
    sync();
    const unsub = subscribeMeetings(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const generate = async () => {
    const transcriptText = transcript.trim();
    if (!transcriptText) {
      showToast("请先粘贴会议记录", "error");
      return;
    }

    const fallback = buildLocalMeetingSummary(title, participants, transcriptText);
    const taskId = createTask({
      name: "Assistant - Meeting copilot",
      status: "running",
      detail: title.trim().slice(0, 80) || "meeting-summary",
    });

    setIsGenerating(true);
    try {
      const message =
        "你是 Meeting Copilot。请把用户提供的会议记录整理成中文会议纪要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出格式必须包含以下三个标题：\n" +
        "【会议摘要】\n【决议】\n【待办】\n" +
        "其中待办使用短 bullet，每条尽量包含负责人/动作/时间。\n\n" +
        `会议名称：${title.trim() || "未命名会议"}\n` +
        `参与人：${participants.trim() || "未填写"}\n` +
        `会议记录：\n${transcriptText}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-meeting-copilot",
        timeoutSeconds: 120,
      });
      setSummary(text || fallback);
      setMeetingId(
        upsertMeeting({
          id: meetingId,
          title,
          participants,
          transcript,
          summary: text || fallback,
        }),
      );
      updateTask(taskId, { status: "done" });
      showToast("会议纪要已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setSummary(fallback);
      setMeetingId(
        upsertMeeting({
          id: meetingId,
          title,
          participants,
          transcript,
          summary: fallback,
        }),
      );
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已生成本地纪要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!summary.trim()) {
      showToast("请先生成会议纪要", "error");
      return;
    }
    createDraft({
      title: title.trim() || "会议纪要",
      body: summary,
      tags: ["meeting", "notes"],
      source: "import",
    });
    showToast("已写入草稿", "ok");
  };

  const pushTasks = () => {
    const items = extractActionItems(summary);
    if (items.length === 0) {
      showToast("没有可写入的待办项", "error");
      return;
    }
    for (const item of items) {
      createTask({
        name: `Meeting - ${title.trim() || "Follow-up"}`,
        status: "queued",
        detail: item,
      });
    }
    showToast(`已写入 ${items.length} 个待办`, "ok");
  };

  const sendToDealDesk = () => {
    if (!summary.trim()) {
      showToast("请先生成会议纪要", "error");
      return;
    }
    const actionItems = extractActionItems(summary);
    requestOpenDealDesk({
      company: title.trim() || "Meeting Lead",
      contact: participants.trim(),
      need: actionItems[0] || title.trim() || "根据会议内容跟进下一步",
      notes: summary,
      stage: "new",
    });
    showToast("已发送到 Deal Desk", "ok");
  };

  const stats = useMemo(
    () => ({
      records: records.length,
      actionItems: extractActionItems(summary).length,
    }),
    [records.length, summary],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Meeting Copilot"
      icon={Mic2}
      widthClassName="w-[1140px]"
      storageKey="openclaw.window.meeting_copilot"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Meeting Notes & Action Items</div>
              <div className="mt-1 text-sm text-gray-500">
                把原始记录压缩成纪要、决议和待办，并能直接写入任务中心。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                纪要记录 {stats.records} 条
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                当前待办 {stats.actionItems} 项
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">输入会议内容</div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">
                    会议名称
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：周一增长周会"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">
                    参与人
                  </label>
                  <input
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="例如：产品、运营、销售"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-600">
                    会议记录 / Transcript
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="粘贴会议纪要、录音转写或你的手写笔记。"
                    className="h-52 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={generate}
                  disabled={isGenerating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "整理中..." : "生成会议纪要"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">最近会议</div>
                <button
                  type="button"
                  onClick={() => requestOpenApp("task_manager")}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                >
                  打开任务中心
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {records.length > 0 ? (
                  records.slice(0, 6).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        setMeetingId(record.id);
                        setTitle(record.title);
                        setParticipants(record.participants);
                        setTranscript(record.transcript);
                        setSummary(record.summary);
                      }}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:bg-gray-100"
                    >
                      <div className="text-sm font-semibold text-gray-900">{record.title}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(record.updatedAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有会议记录。
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">纪要结果</div>
                <div className="mt-1 text-xs text-gray-500">
                  支持保存为草稿，或把待办直接写入任务调度中心。
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                >
                  <FilePlus2 className="h-4 w-4" />
                  写入草稿
                </button>
                <button
                  type="button"
                  onClick={pushTasks}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  写入待办
                </button>
                <button
                  type="button"
                  onClick={sendToDealDesk}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                >
                  发送到 Deal Desk
                </button>
              </div>
            </div>

            <div className="min-h-[500px] pt-4">
              {summary ? (
                <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
                  {summary}
                </pre>
              ) : (
                <div className="flex min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  生成后，这里会出现会议纪要与行动项。
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
              <div className="inline-flex items-center gap-2 font-semibold text-gray-900">
                <CalendarCheck2 className="h-4 w-4" />
                使用建议
              </div>
              <div className="mt-2">
                会后立刻粘贴 transcript，先生成纪要，再把待办推到任务中心，减少后续遗漏。
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
