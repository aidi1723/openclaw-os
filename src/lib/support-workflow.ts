import { getWorkspaceScenario } from "@/lib/workspace-presets";
import type {
  WorkflowRunRecord,
  WorkflowRunState,
  WorkflowStageRunState,
  WorkflowTriggerType,
} from "@/lib/workflow-runs";
import type { WorkflowContextMeta } from "@/lib/workflow-context";

export const SUPPORT_WORKFLOW_SCENARIO_ID = "support-ops";

export type SupportWorkflowMeta = WorkflowContextMeta;

export function getSupportWorkflowScenario() {
  return getWorkspaceScenario(SUPPORT_WORKFLOW_SCENARIO_ID);
}

export function buildSupportWorkflowMeta(input?: SupportWorkflowMeta): SupportWorkflowMeta {
  return {
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId ?? SUPPORT_WORKFLOW_SCENARIO_ID,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource,
    workflowNextStep: input?.workflowNextStep,
    workflowTriggerType: input?.workflowTriggerType,
  };
}

export function getSupportRuntimeLabel(state?: WorkflowRunState | null) {
  switch (state) {
    case "running":
      return "问题处理中";
    case "awaiting_human":
      return "待人工确认";
    case "completed":
      return "已沉淀完成";
    case "error":
      return "处理异常";
    default:
      return "未启动";
  }
}

export function getSupportTriggerLabel(triggerType?: WorkflowTriggerType) {
  switch (triggerType) {
    case "inbound_message":
      return "客户消息";
    case "schedule":
      return "SLA 定时";
    case "manual":
      return "人工补录";
    default:
      return "手动启动";
  }
}

export function getSupportStageStateLabel(state: WorkflowStageRunState) {
  switch (state) {
    case "running":
      return "处理中";
    case "awaiting_human":
      return "待确认";
    case "completed":
      return "已完成";
    case "error":
      return "失败";
    default:
      return "待开始";
  }
}

export function getSupportWorkflowNextAction(run: WorkflowRunRecord | null) {
  switch (run?.currentStageId) {
    case "capture":
      return "先把客户问题整理成单一上下文，再送进 Support Copilot 生成建议回复。";
    case "reply":
      return "生成建议回复后做人工确认，避免敏感或高风险内容直接外发。";
    case "followup":
      return "把需要持续处理的问题转成任务或升级处理动作。";
    case "faq":
      return "把高频问题、标准答复和升级边界沉淀到 FAQ 资产层。";
    default:
      return run?.state === "completed"
        ? "这一轮客服闭环已经完成，可以复用沉淀下来的标准回复和 FAQ。"
        : "从 Inbox 或人工补录启动一条 Support Hero Workflow。";
  }
}
