import type { AgentCoreSkillId } from "@/lib/executor/contracts";

export type AgentCoreSkillDefinition = {
  id: AgentCoreSkillId;
  title: string;
  purpose: string;
};

const skillCatalog: Record<AgentCoreSkillId, AgentCoreSkillDefinition> = {
  memory_recall: {
    id: "memory_recall",
    title: "Memory Recall",
    purpose: "召回相同场景下已沉淀的执行本能，减少重复踩坑。",
  },
  sales_qualification: {
    id: "sales_qualification",
    title: "Sales Qualification",
    purpose: "把销售资格判断任务收敛成结构化判断，而不是泛泛建议。",
  },
  outreach_draft: {
    id: "outreach_draft",
    title: "Outreach Draft",
    purpose: "把销售跟进输出收敛为可审核、可直接发送的邮件正文。",
  },
  support_reply: {
    id: "support_reply",
    title: "Support Reply",
    purpose: "把客服建议收敛为边界清楚、可直接审核的回复。",
  },
  reality_guard: {
    id: "reality_guard",
    title: "Reality Guard",
    purpose: "在生成前注入事实边界和未知项约束。",
  },
  knowledge_capture: {
    id: "knowledge_capture",
    title: "Knowledge Capture",
    purpose: "在成功执行后把结果提炼成可复用资产或本能。",
  },
};

export function getSkillDefinition(skillId: AgentCoreSkillId) {
  return skillCatalog[skillId];
}

export function listSkillDefinitions() {
  return Object.values(skillCatalog);
}
