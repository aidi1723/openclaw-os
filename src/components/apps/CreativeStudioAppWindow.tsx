"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, CloudUpload, Download } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { loadSettings } from "@/lib/settings";
import {
  createTask,
  registerTaskCancel,
  updateTask,
  type TaskId,
} from "@/lib/tasks";

type Output = {
  videoSrc: string | null;
  coverSrc: string | null;
};

export function CreativeStudioAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [localVideoPreviewSrc, setLocalVideoPreviewSrc] = useState<string | null>(
    null,
  );
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState<Output>({ videoSrc: null, coverSrc: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast, showToast } = useTimedToast(2200);
  const abortRef = useRef<AbortController | null>(null);
  const taskIdRef = useRef<TaskId | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      abortRef.current?.abort();
      if (localVideoPreviewSrc) URL.revokeObjectURL(localVideoPreviewSrc);
    };
  }, [localVideoPreviewSrc]);

  const videoLabel = useMemo(() => {
    if (!videoFile) return "拖拽视频到这里，或点击选择文件";
    const sizeMb = (videoFile.size / 1024 / 1024).toFixed(1);
    return `${videoFile.name} · ${sizeMb}MB`;
  }, [videoFile]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFiles = (files: FileList | null) => {
    const file = files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showToast("请选择视频文件（video/*）", "error");
      return;
    }
    setVideoFile(file);
    setOutput({ videoSrc: null, coverSrc: null });
    if (localVideoPreviewSrc) URL.revokeObjectURL(localVideoPreviewSrc);
    setLocalVideoPreviewSrc(URL.createObjectURL(file));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onFiles(e.dataTransfer.files);
  };

  const onSend = async () => {
    const text = instruction.trim();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    if (!videoFile) {
      showToast("请先选择视频文件", "error");
      return;
    }
    if (!text) {
      showToast("请先输入处理指令", "error");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const settings = loadSettings();
    const engineUrl = settings.openclaw.baseUrl.trim();
    const token = settings.openclaw.apiToken.trim();

    setIsSubmitting(true);
    setOutput({ videoSrc: null, coverSrc: null });
    taskIdRef.current = createTask({
      name: "Assistant - Run studio instruction",
      status: "running",
      detail: `engine: ${engineUrl || "local-video-frames"}`,
    });
    registerTaskCancel(taskIdRef.current, () => controller.abort());

    try {
      const form = new FormData();
      form.append("prompt", text);
      form.append("file", videoFile);
      form.append("engineUrl", engineUrl);
      form.append("token", token);

      const res = await fetch(buildAgentCoreApiUrl("/api/creative-studio/process"), {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as
        | null
        | {
            ok?: boolean;
            error?: string;
            output?: Output;
            raw?: unknown;
            note?: string;
          };

      if (!res.ok || !data?.ok) {
        const message =
          data?.error ||
          (engineUrl
            ? `无法连接到运行时引擎，请检查 ${engineUrl} 是否运行`
            : "执行失败：本地 video-frames 处理未能完成");
        if (runId !== runIdRef.current || !mountedRef.current) return;
        showToast(message, "error");
        setOutput({ videoSrc: null, coverSrc: null });
        if (taskIdRef.current) {
          updateTask(taskIdRef.current, { status: "error", detail: message });
        }
        return;
      }

      const nextOutput: Output = {
        videoSrc: data.output?.videoSrc ?? null,
        coverSrc: data.output?.coverSrc ?? null,
      };

      if (!nextOutput.videoSrc && !nextOutput.coverSrc) {
        const message = "引擎未返回可预览的成果";
        if (runId !== runIdRef.current || !mountedRef.current) return;
        showToast(message, "error");
        setOutput({ videoSrc: null, coverSrc: null });
        if (taskIdRef.current) {
          updateTask(taskIdRef.current, { status: "error", detail: message });
        }
        return;
      }

      if (runId !== runIdRef.current || !mountedRef.current) return;
      setOutput(nextOutput);
      showToast(data.note?.trim() ? data.note.trim() : "处理完成", "ok");
      if (taskIdRef.current) {
        updateTask(taskIdRef.current, {
          status: "done",
          detail: data.note?.trim() ? data.note.trim() : undefined,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (taskIdRef.current) {
          updateTask(taskIdRef.current, { status: "stopped", detail: "已取消" });
        }
        return;
      }
      if (runId !== runIdRef.current || !mountedRef.current) return;
      setOutput({ videoSrc: null, coverSrc: null });
      const message = `无法连接到运行时引擎，请检查 ${engineUrl} 是否运行`;
      showToast(message, "error");
      if (taskIdRef.current) {
        updateTask(taskIdRef.current, { status: "error", detail: message });
      }
    } finally {
      if (runId === runIdRef.current && mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const onDownloadCover = () => {
    if (!output.coverSrc) return;
    const a = document.createElement("a");
    a.href = output.coverSrc;
    a.download = `cover-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="AI 视觉工坊"
      icon={Clapperboard}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.creative_studio"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={() => {
        abortRef.current?.abort();
        if (taskIdRef.current) {
          updateTask(taskIdRef.current, { status: "stopped", detail: "已关闭窗口" });
        }
        onClose();
      }}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* 左侧：选择与指令 */}
          <div className="space-y-5 border-b border-gray-200 p-4 md:border-b-0 md:border-r md:p-6">
            <div className="text-sm font-semibold text-gray-900">素材与指令区</div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />

            <div
              className={[
                "rounded-2xl border border-dashed p-6 transition-colors cursor-pointer",
                isDragging
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:bg-gray-50",
              ].join(" ")}
              onClick={onPickFile}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickFile();
                }
              }}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200">
                  <CloudUpload className="h-6 w-6 text-gray-700" />
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  上传视频文件
                </div>
                <div className="text-xs text-gray-500 max-w-[420px] truncate">
                  {videoLabel}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                指令
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="请告诉 AI 如何处理视频与封面（例如：提取第10秒画面作为封面加上大字，并截取前15秒高光片段）..."
                className="h-44 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={onSend}
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-semibold text-white transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "引擎正在逐帧处理中..."
                : "🎬 启动智能剪辑与封面生成"}
            </button>

            <div className="text-xs text-gray-500 leading-relaxed">
              提示：该 App 只负责“指令交互”。后端可接运行时引擎的{" "}
              <span className="font-semibold text-gray-700">video-frames</span>{" "}
              技能返回封面图或视频片段。
            </div>
          </div>

          {/* 右侧：预览 */}
          <div className="p-4 md:p-6">
            <div className="text-sm font-semibold text-gray-900 mb-4">产出成果区</div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* A: Video */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="bg-gray-900 h-56 flex items-center justify-center relative">
                  {isSubmitting ? (
                    <div className="absolute inset-0 animate-pulse">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full border-2 border-gray-600 border-t-transparent animate-spin" />
                      </div>
                    </div>
                  ) : output.videoSrc ? (
                    <video
                      controls
                      src={output.videoSrc}
                      className="h-full w-full object-contain bg-black"
                    />
                  ) : localVideoPreviewSrc ? (
                    <>
                      <video
                        controls
                        src={localVideoPreviewSrc}
                        className="h-full w-full object-contain bg-black"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
                        原视频预览
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-white/70">
                      剪辑后视频片段将在此展示
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-sm font-semibold text-gray-900">
                    {output.videoSrc ? "剪辑后视频片段" : "视频预览"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {output.videoSrc
                      ? "已生成片段，可直接播放。"
                      : localVideoPreviewSrc
                        ? "当前展示的是原视频；要生成片段，请在指令中包含“剪/截取…10秒”等。"
                      : "引擎返回视频片段后将自动展示。"}
                  </div>
                </div>
              </div>

              {/* B: Cover */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="bg-gray-50 h-56 flex items-center justify-center relative">
                  {isSubmitting ? (
                    <div className="absolute inset-0 animate-pulse">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-6 w-40 rounded-full bg-gray-300/80" />
                      </div>
                    </div>
                  ) : output.coverSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={output.coverSrc}
                      alt="AI 生成封面预览"
                      className="h-full w-full object-contain bg-white"
                    />
                  ) : (
                    <div className="text-sm text-gray-500">
                      AI 提取并生成的封面图将在此展示
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        AI 提取并生成的封面图
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        支持下载封面，用于各平台发布。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onDownloadCover}
                      disabled={!output.coverSrc || isSubmitting}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 font-semibold text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="下载封面"
                    >
                      <Download className="h-4 w-4" />
                      下载封面
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
