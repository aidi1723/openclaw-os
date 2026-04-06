import type {
  AgentCoreMemoryTrace,
  AgentCoreSkillPlan,
  AgentCoreSkillReceipt,
  AgentCoreTaskRequest,
} from "@/lib/executor/contracts";
import {
  type ExecutorInstinctRecord,
  listRelevantExecutorInstincts,
  markExecutorInstinctsUsed,
  storeExecutorInstinct,
} from "@/lib/server/executor-instinct-store";

function buildMemoryRecallText(input: {
  scope?: string;
  instincts: Awaited<ReturnType<typeof listRelevantExecutorInstincts>>;
}) {
  if (!input.scope || input.instincts.length === 0) return "";
  return [
    `Operational instincts for scope ${input.scope}:`,
    ...input.instincts.map(
      (instinct, index) =>
        `${index + 1}. ${instinct.title}\n- Instinct: ${instinct.instinct}\n- Evidence: ${instinct.evidence}`,
    ),
  ].join("\n");
}

function buildStructuredSkillPrompt(skillId: AgentCoreSkillPlan["selectedSkillIds"][number]) {
  switch (skillId) {
    case "sales_qualification":
      return [
        "Use this output contract:",
        "【推进判断】",
        "【判断理由】",
        "【缺失信息】",
        "【风险点】",
        "【下一步建议】",
      ].join("\n");
    case "outreach_draft":
      return [
        "Use this output contract:",
        "- Return only the email body.",
        "- Keep tone professional and concrete.",
        "- End with one explicit next action.",
      ].join("\n");
    case "support_reply":
      return [
        "Use this output contract:",
        "- Return only the customer-facing reply body.",
        "- Acknowledge the issue, define next step, and mark unknowns explicitly.",
      ].join("\n");
    case "reality_guard":
      return [
        "Reality guard:",
        "- Do not invent prices, timelines, policies, or internal facts.",
        "- If information is missing, say so explicitly.",
        "- Mark any high-risk assumptions as pending human confirmation.",
      ].join("\n");
    default:
      return "";
  }
}

export async function runPreExecutionSkills(input: {
  request: AgentCoreTaskRequest;
  skillPlan: AgentCoreSkillPlan;
}) {
  const receipts: AgentCoreSkillReceipt[] = [];
  const promptFragments: string[] = [];
  let recalledInstinctIds: string[] = [];

  if (input.skillPlan.selectedSkillIds.includes("memory_recall")) {
    const instincts = await listRelevantExecutorInstincts({
      scope: input.skillPlan.memoryScope,
      profileId: input.skillPlan.preferredProfileId,
      limit: input.request.skillPolicy.maxInstincts ?? 2,
    });
    recalledInstinctIds = instincts.map((instinct) => instinct.id);
    const text = buildMemoryRecallText({
      scope: input.skillPlan.memoryScope,
      instincts,
    });
    if (text) {
      promptFragments.push(text);
    }
    receipts.push({
      skillId: "memory_recall",
      phase: "pre",
      ok: true,
      summary:
        instincts.length > 0
          ? `recalled ${instincts.length} distilled instincts`
          : "no matching instincts recalled",
      outputText: text || undefined,
    });
  }

  for (const skillId of input.skillPlan.selectedSkillIds) {
    if (skillId === "memory_recall" || skillId === "knowledge_capture") continue;
    const fragment = buildStructuredSkillPrompt(skillId);
    if (!fragment) continue;
    promptFragments.push(fragment);
    receipts.push({
      skillId,
      phase: "pre",
      ok: true,
      summary: "prompt contract injected",
      outputText: fragment,
    });
  }

  if (recalledInstinctIds.length > 0) {
    await markExecutorInstinctsUsed(recalledInstinctIds);
  }

  const memory: AgentCoreMemoryTrace = {
    scope: input.skillPlan.memoryScope,
    recalledInstincts: recalledInstinctIds.length,
  };

  return { promptFragments, receipts, memory };
}

export async function runPostExecutionSkills(input: {
  request: AgentCoreTaskRequest;
  skillPlan: AgentCoreSkillPlan;
  outputText: string;
  success: boolean;
}) {
  const receipts: AgentCoreSkillReceipt[] = [];
  const memory: AgentCoreMemoryTrace = {
    scope: input.skillPlan.memoryScope,
    recalledInstincts: 0,
  };

  if (
    input.success &&
    input.skillPlan.selectedSkillIds.includes("knowledge_capture") &&
    input.request.skillPolicy.enableMemory !== false
  ) {
    const instinct: ExecutorInstinctRecord | null = await storeExecutorInstinct({
      scope: input.skillPlan.memoryScope,
      profileId: input.skillPlan.preferredProfileId,
      taskLabel: input.request.skillPolicy.taskLabel,
      requestMessage: input.request.taskInput.userMessage,
      outputText: input.outputText,
      sourceSessionId: input.request.session.id,
      sourceRequestId: input.request.metadata.requestId,
    });
    const storedInstinctText = instinct ? instinct.instinct : undefined;
    const storedInstinctId = instinct ? instinct.id : undefined;

    receipts.push({
      skillId: "knowledge_capture",
      phase: "post",
      ok: Boolean(instinct),
      summary: instinct ? "distilled instinct stored" : "no instinct stored",
      outputText: storedInstinctText,
    });
    memory.storedInstinctId = storedInstinctId;
  }

  return { receipts, memory };
}
