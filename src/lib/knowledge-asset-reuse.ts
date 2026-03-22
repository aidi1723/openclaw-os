import type { KnowledgeAssetRecord } from "@/lib/knowledge-assets";
import type { DealDeskPrefill, SupportCopilotPrefill } from "@/lib/ui-events";
import type { SupportChannel } from "@/lib/support";

function normalizeText(input: string) {
  return input.replace(/\r\n?/g, "\n").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAssetSuffix(title: string, assetType: KnowledgeAssetRecord["assetType"]) {
  const suffix = assetType === "sales_playbook" ? /\s*·\s*跟进资产$/ : /\s*·\s*FAQ 资产$/;
  return title.replace(suffix, "").trim();
}

function compactJoin(parts: string[]) {
  return parts.filter((part) => part.trim()).join("\n\n");
}

function summarizeSection(section?: string, maxLength = 64) {
  if (!section) return "";
  const cleaned = normalizeText(section)
    .replace(/^[\-*•]\s*/gm, "")
    .replace(/\n+/g, "；");
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}...`;
}

function parseBracketSections(body: string) {
  const sections = new Map<string, string[]>();
  let activeSection = "";

  for (const rawLine of normalizeText(body).split("\n")) {
    const line = rawLine.trim();
    const match = line.match(/^【(.+?)】$/);
    if (match) {
      activeSection = match[1].trim();
      if (!sections.has(activeSection)) {
        sections.set(activeSection, []);
      }
      continue;
    }
    if (!activeSection) continue;
    sections.get(activeSection)?.push(rawLine);
  }

  return Object.fromEntries(
    Array.from(sections.entries()).map(([key, value]) => [key, normalizeText(value.join("\n"))]),
  ) as Record<string, string>;
}

function findLabeledValue(body: string, labels: string[]) {
  for (const rawLine of normalizeText(body).split("\n")) {
    const line = rawLine.trim();
    for (const label of labels) {
      const match = line.match(new RegExp(`^${escapeRegExp(label)}\\s*[：:]\\s*(.+)$`));
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  }
  return "";
}

function parseSupportChannel(value: string): SupportChannel | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("review")) return "reviews";
  if (normalized.includes("google")) return "reviews";
  if (normalized.includes("邮箱")) return "email";
  if (normalized.includes("邮件")) return "email";
  if (normalized.includes("email")) return "email";
  return undefined;
}

export function buildDealDeskPrefillFromKnowledgeAsset(
  asset: KnowledgeAssetRecord,
): DealDeskPrefill {
  const body = normalizeText(asset.body);
  const titleBase = stripAssetSuffix(asset.title, asset.assetType) || "销售线索";
  const sections = parseBracketSections(body);

  const company = findLabeledValue(body, ["公司", "客户公司"]) || titleBase;
  const contact = findLabeledValue(body, ["联系人", "客户联系人"]);
  const inquiryChannel = findLabeledValue(body, ["来源", "渠道", "客户渠道"]);
  const preferredLanguage = findLabeledValue(body, ["语言", "偏好语言"]);
  const productLine = findLabeledValue(body, ["产品", "产品线", "品类"]);
  const budget = findLabeledValue(body, ["预算"]);
  const timing = findLabeledValue(body, ["时间", "交期", "时效"]);
  const fallbackNeed = findLabeledValue(body, ["需求", "需求摘要", "问题摘要"]);
  const need =
    fallbackNeed ||
    sections["适用场景"] ||
    summarizeSection(sections["有效跟进策略"], 120) ||
    titleBase;

  const notes = compactJoin([
    sections["客户画像与偏好"] ? `客户画像与偏好：\n${sections["客户画像与偏好"]}` : "",
    sections["有效跟进策略"] ? `有效跟进策略：\n${sections["有效跟进策略"]}` : "",
    sections["禁忌与风险"] ? `禁忌与风险：\n${sections["禁忌与风险"]}` : "",
    findLabeledValue(body, ["备注"]) ? `备注：${findLabeledValue(body, ["备注"])}` : "",
  ]);

  const nextStepSummary =
    summarizeSection(sections["下次可复用模板"]) ||
    summarizeSection(sections["有效跟进策略"]);

  return {
    company,
    contact,
    inquiryChannel,
    preferredLanguage,
    productLine,
    need,
    budget,
    timing,
    notes,
    stage: "new",
    workflowSource: "来自 Knowledge Vault 的销售资产复用",
    workflowNextStep: nextStepSummary
      ? `优先复用已沉淀销售打法：${nextStepSummary}`
      : "基于已沉淀销售资产，补齐本次线索信息并启动新的销售推进。",
    workflowTriggerType: "manual",
  };
}

export function buildSupportPrefillFromKnowledgeAsset(
  asset: KnowledgeAssetRecord,
): SupportCopilotPrefill {
  const body = normalizeText(asset.body);
  const titleBase = stripAssetSuffix(asset.title, asset.assetType) || "客服问题";
  const sections = parseBracketSections(body);

  const customer = findLabeledValue(body, ["客户", "客户名称"]);
  const channel = parseSupportChannel(findLabeledValue(body, ["渠道", "客户渠道"])) ?? "email";
  const subject =
    findLabeledValue(body, ["主题", "问题主题"]) ||
    titleBase;
  const replyDraft =
    sections["标准回复"] ||
    findLabeledValue(body, ["建议回复", "当前回复"]);

  const message = compactJoin([
    sections["适用场景"] ? `适用场景：\n${sections["适用场景"]}` : "",
    findLabeledValue(body, ["问题摘要", "问题"]) ? `问题摘要：${findLabeledValue(body, ["问题摘要", "问题"])}` : "",
    sections["需要补充的信息"] ? `需要补充的信息：\n${sections["需要补充的信息"]}` : "",
    sections["升级边界"] ? `升级边界：\n${sections["升级边界"]}` : "",
    sections["复用备注"] ? `复用备注：\n${sections["复用备注"]}` : "",
  ]);

  const nextStepSummary = summarizeSection(sections["升级边界"]) || summarizeSection(sections["需要补充的信息"]);

  return {
    customer,
    channel,
    subject,
    message: message || body,
    status: "new",
    replyDraft,
    workflowSource: "来自 Knowledge Vault 的 FAQ 资产复用",
    workflowNextStep: nextStepSummary
      ? `先按已沉淀边界处理：${nextStepSummary}`
      : "基于已沉淀 FAQ 资产，生成新的客服回复并判断是否需要升级。",
    workflowTriggerType: "manual",
  };
}
