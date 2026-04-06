import { NextResponse } from "next/server";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { normalizeBaseUrl } from "@/lib/url-utils";

export const runtime = "nodejs";

type ExecuteOutput = {
  videoSrc: string | null;
  coverSrc: string | null;
};

type ExecuteOk = {
  ok: true;
  output: ExecuteOutput;
  raw?: unknown;
  note?: string;
};

type VideoPlan = {
  coverTime?: string; // HH:MM:SS
  clipStartSeconds?: number; // integer seconds
  clipSeconds?: number | null; // integer seconds
};

function ensureDataUrlFromBase64(maybeBase64: string) {
  const v = maybeBase64.trim();
  if (!v) return null;
  if (v.startsWith("data:")) return v;
  // default to png; OpenClaw can return jpg too, but this is a safe start
  return `data:image/png;base64,${v}`;
}

function extractJsonFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try raw JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }

  // Try ```json ... ```
  const fence = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // ignore
    }
  }

  // Try first {...} block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // ignore
    }
  }

  return null;
}

function isHms(v: unknown) {
  return typeof v === "string" && /^\d{2}:\d{2}:\d{2}$/.test(v.trim());
}

function parseOutputFromUnknown(payload: any): ExecuteOutput | null {
  if (!payload || typeof payload !== "object") return null;

  const output = (payload.output ?? payload.result ?? payload.data ?? payload) as any;

  const directVideo =
    output.videoSrc ??
    output.video_url ??
    output.videoUrl ??
    output.clip_video_url ??
    output.clipVideoUrl ??
    output.video ??
    null;

  const directCover =
    output.coverSrc ??
    output.cover_url ??
    output.coverUrl ??
    output.cover_image_url ??
    output.coverImageUrl ??
    output.cover ??
    output.image ??
    null;

  const directCoverBase64 =
    output.coverBase64 ??
    output.cover_base64 ??
    output.cover_image_base64 ??
    output.coverImageBase64 ??
    null;

  const videoSrc =
    typeof directVideo === "string"
      ? directVideo
      : typeof directVideo?.url === "string"
        ? directVideo.url
        : null;

  const coverSrc =
    typeof directCover === "string"
      ? directCover
      : typeof directCover?.url === "string"
        ? directCover.url
        : typeof directCoverBase64 === "string"
          ? ensureDataUrlFromBase64(directCoverBase64)
          : null;

  if (!videoSrc && !coverSrc) return null;
  return { videoSrc, coverSrc };
}

async function saveUploadedFile(file: File) {
  const root = path.join("/tmp", "agentcore-os", "uploads");
  await mkdir(root, { recursive: true });
  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
  const fullPath = path.join(root, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);
  return fullPath;
}

const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastCleanupAt = 0;

async function cleanupOldTmpFiles() {
  const now = Date.now();
  // Run at most once per hour
  if (now - lastCleanupAt < 60 * 60 * 1000) return;
  lastCleanupAt = now;

  const dirs = [
    path.join("/tmp", "agentcore-os", "uploads"),
    path.join("/tmp", "agentcore-os", "outputs"),
  ];
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        try {
          const filePath = path.join(dir, entry);
          const info = await stat(filePath);
          if (now - info.mtimeMs > TMP_MAX_AGE_MS) {
            await unlink(filePath).catch(() => null);
          }
        } catch {
          // skip individual file errors
        }
      }
    } catch {
      // directory may not exist yet
    }
  }
}

async function runFfmpeg(args: string[]) {
  return await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 12_000) stderr = stderr.slice(-12_000);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function secondsToHms(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function parseCoverTimestamp(prompt: string) {
  const text = prompt.trim();
  const hms = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  if (hms) return `${pad2(Number(hms[1]))}:${pad2(Number(hms[2]))}:${pad2(Number(hms[3]))}`;
  const sec = text.match(/第\s*(\d+)\s*秒/);
  if (sec) return secondsToHms(Number(sec[1]));
  const around = text.match(/(?:在|到)\s*(\d+)\s*秒/);
  if (around) return secondsToHms(Number(around[1]));
  return "00:00:10";
}

function parseClipSeconds(prompt: string) {
  const text = prompt.trim();
  const m = text.match(/前\s*(\d+)\s*(秒钟|秒)/);
  if (m) return Number(m[1]);
  const m2 = text.match(/截取\s*(\d+)\s*(秒钟|秒)/);
  if (m2) return Number(m2[1]);
  const m3 = text.match(
    /(?:截取|剪辑|剪|保留|输出|生成)\s*(?:一段|成片|片段|视频)?\s*(\d+)\s*(秒钟|秒)(?!\d)/,
  );
  if (m3) return Number(m3[1]);
  const m4 = text.match(/剪.*?(\d+)\s*(秒钟|秒)(?!\d)/);
  if (m4) return Number(m4[1]);
  if (/(高光|剪辑|片段|成片)/.test(text)) return 15;
  return null;
}

function parseClipStartSeconds(prompt: string) {
  const text = prompt.trim();
  const r1 = text.match(/从第?\s*(\d+)\s*秒\s*(?:开始|起)?/);
  if (r1) return Number(r1[1]);
  const r2 = text.match(/从\s*(\d+)\s*秒\s*(?:开始|起)?/);
  if (r2) return Number(r2[1]);
  return 0;
}

function buildLocalVideoPlan(prompt: string): VideoPlan {
  const coverTime = parseCoverTimestamp(prompt);
  const clipStartSeconds = parseClipStartSeconds(prompt);
  const clipSeconds = parseClipSeconds(prompt);
  return {
    coverTime: isHms(coverTime) ? coverTime : "00:00:10",
    clipStartSeconds: Number.isFinite(clipStartSeconds) ? Math.max(0, Math.floor(clipStartSeconds)) : 0,
    clipSeconds:
      typeof clipSeconds === "number" && Number.isFinite(clipSeconds)
        ? Math.max(1, Math.floor(clipSeconds))
        : null,
  };
}

async function localVideoFramesExecute(params: {
  prompt: string;
  fileUrl: string;
}): Promise<ExecuteOk> {
  const outRoot = path.join("/tmp", "agentcore-os", "outputs");
  await mkdir(outRoot, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const plan = buildLocalVideoPlan(params.prompt);
  let coverTime = plan.coverTime ?? "00:00:10";
  const coverName = `${id}-cover.png`;
  const coverPath = path.join(outRoot, coverName);

  const extractCover = async (time: string) => {
    await runFfmpeg([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      time,
      "-i",
      params.fileUrl,
      "-frames:v",
      "1",
      "-vf",
      "scale=1280:-1",
      coverPath,
    ]);
  };

  await extractCover(coverTime);

  let coverBuf: Buffer;
  try {
    coverBuf = await readFile(coverPath);
  } catch {
    coverTime = "00:00:00";
    await extractCover(coverTime);
    coverBuf = await readFile(coverPath);
  }
  const coverSrc = `data:image/png;base64,${coverBuf.toString("base64")}`;

  const clipSeconds = plan.clipSeconds;
  const clipStartSeconds = plan.clipStartSeconds ?? 0;
  let videoSrc: string | null = null;
  let clipName: string | null = null;
  let clipPath: string | null = null;

  if (typeof clipSeconds === "number" && Number.isFinite(clipSeconds) && clipSeconds > 0) {
    clipName = `${id}-clip.mp4`;
    clipPath = path.join(outRoot, clipName);
    try {
      await runFfmpeg([
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(Math.max(0, Math.floor(clipStartSeconds))),
        "-i",
        params.fileUrl,
        "-t",
        String(Math.floor(clipSeconds)),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        clipPath,
      ]);
    } catch {
      await runFfmpeg([
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(Math.max(0, Math.floor(clipStartSeconds))),
        "-i",
        params.fileUrl,
        "-t",
        String(Math.floor(clipSeconds)),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        clipPath,
      ]);
    }
  }

  if (clipName) {
    videoSrc = `/api/openclaw/assets/${encodeURIComponent(clipName)}`;
  }

  return {
    ok: true,
    output: { videoSrc, coverSrc },
    raw: {
      mode: "local-video-frames",
      coverTime,
      clipSeconds,
      clipStartSeconds,
      fileUrl: params.fileUrl,
      coverPath,
      clipPath,
    },
    note: "运行时引擎不可达，已使用本地 video-frames (ffmpeg) 完成处理",
  };
}

async function callOpenClawChat(params: {
  engineUrl: string;
  token: string;
  prompt: string;
  fileUrl: string;
}) {
  const url = `${params.engineUrl}/v1/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(params.token
          ? {
              Authorization: `Bearer ${params.token}`,
              "X-API-Token": params.token,
              "X-OpenClaw-Token": params.token,
              "X-OpenClaw-Gateway-Token": params.token,
            }
          : {}),
      },
      body: JSON.stringify({
        model: "openclaw",
        stream: false,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是运行时引擎的 Agent 执行器。你的目标是基于用户指令，对给定视频文件调用 video-frames 能力完成：抽帧生成封面 + 产出剪辑后片段（如果需要）。" +
              "请严格只返回 JSON，不要输出其它文字。JSON schema：" +
              '{"videoSrc":string|null,"coverSrc":string|null,"coverBase64":string|null}。' +
              "coverBase64 为纯 base64（不含 data: 前缀）。如果只能返回其中之一，另一个置 null。",
          },
          {
            role: "user",
            content:
              `用户指令：${params.prompt}\n` +
              `视频文件路径(fileUrl)：${params.fileUrl}\n` +
              "请开始执行。",
          },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    return { res, text };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  // Fire-and-forget cleanup of old temp files
  void cleanupOldTmpFiles();

  try {
    const contentType = req.headers.get("content-type") ?? "";

    let prompt = "";
    let fileUrl = "";
    let engineUrl = "";
    let token = "";

    if (contentType.includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await req.formData();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const maybeTooLarge =
          /too\s*large|payload|body|max|limit|size/i.test(message);
        return NextResponse.json(
          {
            ok: false,
            error: maybeTooLarge
              ? "上传失败：视频文件过大或超出服务端请求体限制。请先用较小的视频测试，或改用可被引擎直接读取的 fileUrl 路径方案。"
              : `请求异常（解析上传内容失败）：${message}`,
          },
          { status: maybeTooLarge ? 413 : 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      prompt = String(form.get("prompt") ?? "").trim();
      fileUrl = String(form.get("fileUrl") ?? "").trim();
      engineUrl = String(form.get("engineUrl") ?? "").trim();
      token = String(form.get("token") ?? "").trim();

      const file = form.get("file");
      if (file && file instanceof File) {
        try {
          fileUrl = await saveUploadedFile(file);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return NextResponse.json(
            { ok: false, error: `请求异常（保存上传文件失败）：${message}` },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      }
    } else {
      const body = (await req.json().catch(() => null)) as
        | null
        | { prompt?: string; fileUrl?: string; engineUrl?: string; token?: string };
      prompt = body?.prompt?.trim() ?? "";
      fileUrl = body?.fileUrl?.trim() ?? "";
      engineUrl = body?.engineUrl?.trim() ?? "";
      token = body?.token?.trim() ?? "";
    }

    const headerEngineUrl = req.headers.get("x-openclaw-engine-url");
    const headerToken = req.headers.get("x-openclaw-token");
    if (!engineUrl && headerEngineUrl) engineUrl = headerEngineUrl;
    if (!token && headerToken) token = headerToken;

    engineUrl = normalizeBaseUrl(engineUrl);

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "缺少 prompt" },
        { status: 400 },
      );
    }
    if (!fileUrl) {
      return NextResponse.json(
        { ok: false, error: "缺少 fileUrl 或 file" },
        { status: 400 },
      );
    }

    if (!engineUrl) {
      // No engine URL provided: run local ffmpeg-based implementation.
      return NextResponse.json(await localVideoFramesExecute({ prompt, fileUrl }), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Try real engine first; if it's unreachable or endpoint differs, fallback to local.
    let res: Response | null = null;
    let text = "";
    try {
      const r = await callOpenClawChat({ engineUrl, token, prompt, fileUrl });
      res = r.res;
      text = r.text;
    } catch (err) {
      // For Creative Studio, we have a deterministic local implementation.
      // If the engine can't be reached (any fetch error), fallback to local video-frames.
      try {
        return NextResponse.json(await localVideoFramesExecute({ prompt, fileUrl }), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (fallbackErr) {
        const cause = (err as any)?.cause as unknown;
        const causeMessage =
          cause && typeof cause === "object" && "message" in (cause as any)
            ? String((cause as any).message)
            : null;
        const message =
          err instanceof Error ? err.message : "无法连接到运行时引擎";
        const fallbackMessage =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return NextResponse.json(
          {
            ok: false,
            error:
              `无法连接到运行时引擎，请检查 ${engineUrl} 是否运行。` +
              (causeMessage ? `（${causeMessage}）` : message ? `（${message}）` : "") +
              `；本地 video-frames 兜底也失败：${fallbackMessage}`,
          },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "鉴权失败：请在『设置 → 引擎核心』中填写正确的运行时 API Token。",
          },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
      // If engine exists but doesn't implement this endpoint, fallback.
      if (res.status === 404 || res.status === 405) {
        return NextResponse.json(await localVideoFramesExecute({ prompt, fileUrl }), {
          headers: { "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error: text || `${res.status} ${res.statusText}`,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const json = extractJsonFromText(text);
    const outputFromJson = parseOutputFromUnknown(json);
    const output: ExecuteOutput = outputFromJson ?? {
      videoSrc: null,
      coverSrc: null,
    };

    // If JSON had coverBase64 but parseOutput didn't convert, do it here
    const coverBase64 =
      (json as any)?.coverBase64 ??
      (json as any)?.cover_base64 ??
      (json as any)?.cover_image_base64 ??
      null;
    if (!output.coverSrc && typeof coverBase64 === "string") {
      output.coverSrc = ensureDataUrlFromBase64(coverBase64);
    }

    return NextResponse.json(
      { ok: true, output, raw: json ?? text },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `请求异常：${message}` },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
