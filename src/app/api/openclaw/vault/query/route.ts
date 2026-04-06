import { NextResponse } from "next/server";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";
import { requestServerLlmText, type ServerLlmConfigInput } from "@/lib/server/direct-llm";
import {
  buildVaultMixedQueryStructuredResult,
  type VaultCreatorAssetSummary,
  type VaultFileSummary,
  type VaultKnowledgeAssetSummary,
} from "@/lib/vault-mixed-query";

export const runtime = "nodejs";
const QUERY_BODY_LIMIT = 96_000;

function clipText(value: string, limit: number) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(1, limit - 1))}...`;
}

export async function POST(req: Request) {
  try {
    const body = (await readJsonBodyWithLimit(req, QUERY_BODY_LIMIT)) as
      | null
      | {
          query?: string;
          folderName?: string;
          files?: VaultFileSummary[];
          knowledgeAssets?: VaultKnowledgeAssetSummary[];
          creatorAssets?: VaultCreatorAssetSummary[];
          llm?: ServerLlmConfigInput;
        };

    const query = (body?.query ?? "").trim();
    const folderName = (body?.folderName ?? "知识库").trim() || "知识库";
    const files = Array.isArray(body?.files) ? body?.files ?? [] : [];
    const knowledgeAssets = Array.isArray(body?.knowledgeAssets) ? body.knowledgeAssets : [];
    const creatorAssets = Array.isArray(body?.creatorAssets) ? body.creatorAssets : [];
    const structured = buildVaultMixedQueryStructuredResult({
      query,
      files,
      knowledgeAssets,
      creatorAssets,
    });

    if (!query) {
      return NextResponse.json({ ok: false, error: "缺少 query" }, { status: 400 });
    }

    const list = files
      .slice(0, 40)
      .map((f) => `- ${f.name} (${Math.round(f.size / 1024)}KB)`)
      .join("\n");

    const knowledgeList = knowledgeAssets
      .slice(0, 8)
      .map((asset) =>
        [
          `- ${asset.title}`,
          asset.assetType ? `类型 ${asset.assetType}` : "",
          asset.status ? `状态 ${asset.status}` : "",
          asset.applicableScene ? `场景 ${asset.applicableScene}` : "",
          Array.isArray(asset.tags) && asset.tags.length > 0 ? `标签 ${asset.tags.join(" / ")}` : "",
          typeof asset.reuseCount === "number" ? `复用 ${asset.reuseCount} 次` : "",
          asset.body ? `摘要 ${clipText(asset.body, 180)}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n");

    const creatorList = creatorAssets
      .slice(0, 8)
      .map((asset) =>
        [
          `- ${asset.topic || "未命名内容资产"}`,
          asset.primaryAngle ? `角度 ${asset.primaryAngle}` : "",
          asset.publishStatus ? `状态 ${asset.publishStatus}` : "",
          Array.isArray(asset.publishTargets) && asset.publishTargets.length > 0
            ? `平台 ${asset.publishTargets.join(" / ")}`
            : "",
          asset.latestPublishFeedback ? `反馈 ${clipText(asset.latestPublishFeedback, 180)}` : "",
          asset.nextAction ? `下一步 ${clipText(asset.nextAction, 120)}` : "",
          Array.isArray(asset.successfulPlatforms) && asset.successfulPlatforms.length > 0
            ? `成功 ${asset.successfulPlatforms.join(" / ")}`
            : "",
          Array.isArray(asset.retryablePlatforms) && asset.retryablePlatforms.length > 0
            ? `重试 ${asset.retryablePlatforms.join(" / ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n");

    const message =
      "你是知识库混合检索助手。用户会给你一个问题，以及 3 类上下文：文件列表、知识资产摘要、内容工作流资产摘要。\n" +
      "你的任务是：\n" +
      "1) 从这 3 类上下文里挑出最相关的线索，按优先级列出。\n" +
      "2) 给出一个简短判断：目前更应该看文件、复用知识资产，还是回到 Creator Studio 继续推进。\n" +
      "3) 给出可执行的下一步：为了回答得更准，需要用户提供哪些关键信息、正文内容，或进入哪个工作流节点。\n" +
      "注意：\n" +
      "- 文件上下文只有文件名/大小，没有正文。\n" +
      "- 知识资产和 creator assets 只有摘要，不代表完整原文。\n" +
      "- 不要假装已经阅读了文件内容。\n\n" +
      `当前文件夹：${folderName}\n` +
      `文件列表：\n${list || "(空)"}\n\n` +
      `知识资产：\n${knowledgeList || "(空)"}\n\n` +
      `Creator 内容资产：\n${creatorList || "(空)"}\n\n` +
      `用户问题：${query}\n\n` +
      "请用简洁的 Markdown 输出：\n" +
      "【最相关线索】\n- ...\n【判断】\n- ...\n【建议】\n- ...";

    const r = await requestServerLlmText({
      llm: body?.llm,
      userPrompt: message,
      timeoutMs: 60_000,
      temperature: 0.2,
    });
    if (!r.ok) return NextResponse.json(r, { status: 502 });

    return NextResponse.json(
      { ok: true, text: r.text, raw: r.raw, structured },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(err, 500) },
    );
  }
}
