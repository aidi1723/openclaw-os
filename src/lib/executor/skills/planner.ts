import type {
  AgentCoreSkillId,
  AgentCoreSkillPlan,
  AgentCoreTaskRequest,
} from "@/lib/executor/contracts";

function pickPreferredProfile(request: AgentCoreTaskRequest) {
  return (
    request.skillPolicy.preferredProfileId ||
    (typeof request.context.workspace?.expertProfileId === "string"
      ? request.context.workspace.expertProfileId
      : "")
  ).trim();
}

function pickMemoryScope(request: AgentCoreTaskRequest) {
  const explicit = (request.skillPolicy.memoryScope ?? "").trim();
  if (explicit) return explicit;

  const activeIndustry =
    typeof request.context.workspace?.activeIndustry === "string"
      ? request.context.workspace.activeIndustry.trim()
      : "";
  const activeScenarioId =
    typeof request.context.workspace?.activeScenarioId === "string"
      ? request.context.workspace.activeScenarioId.trim()
      : "";
  const preferredProfileId = pickPreferredProfile(request);

  return [activeIndustry, activeScenarioId, preferredProfileId || "general"]
    .filter(Boolean)
    .join(":");
}

function filterAllowedSkills(
  selected: AgentCoreSkillId[],
  allowedSkillIds?: AgentCoreSkillId[],
) {
  if (!allowedSkillIds || allowedSkillIds.length === 0) return selected;
  const allowed = new Set(allowedSkillIds);
  return selected.filter((skillId) => allowed.has(skillId));
}

export function buildSkillPlan(request: AgentCoreTaskRequest): AgentCoreSkillPlan {
  if (!request.skillPolicy.enabled || request.skillPolicy.mode === "off") {
    return { selectedSkillIds: [], plannerReason: ["skill runtime disabled"] };
  }

  const selected: AgentCoreSkillId[] = [];
  const reasons: string[] = [];
  const preferredProfileId = pickPreferredProfile(request);
  const memoryScope = pickMemoryScope(request);

  if (request.skillPolicy.enableMemory !== false && memoryScope) {
    selected.push("memory_recall");
    reasons.push(`memory recall enabled for scope ${memoryScope}`);
  }

  if (preferredProfileId === "sales_qualification_specialist") {
    selected.push("sales_qualification", "reality_guard", "knowledge_capture");
    reasons.push("sales qualification specialist selected");
  } else if (preferredProfileId === "outreach_draft_specialist") {
    selected.push("outreach_draft", "reality_guard", "knowledge_capture");
    reasons.push("outreach draft specialist selected");
  } else if (preferredProfileId === "support_reply_specialist") {
    selected.push("support_reply", "reality_guard", "knowledge_capture");
    reasons.push("support reply specialist selected");
  } else if (preferredProfileId === "knowledge_asset_editor") {
    selected.push("knowledge_capture");
    reasons.push("knowledge asset editor selected");
  } else if (preferredProfileId === "reality_checker") {
    selected.push("reality_guard");
    reasons.push("reality checker selected");
  } else if (request.skillPolicy.mode === "strict") {
    selected.push("reality_guard", "knowledge_capture");
    reasons.push("strict mode enabled without an explicit specialist");
  } else {
    selected.push("knowledge_capture");
    reasons.push("default knowledge capture for successful runs");
  }

  const deduped = Array.from(new Set(filterAllowedSkills(selected, request.skillPolicy.allowedSkillIds)));
  return {
    selectedSkillIds: deduped,
    plannerReason: reasons,
    preferredProfileId: preferredProfileId || undefined,
    memoryScope: memoryScope || undefined,
  };
}
