import { getWorkspaceScenario } from "@/lib/workspace-presets";
import type { WorkflowRunRecord, WorkflowRunState, WorkflowStageRunState, WorkflowTriggerType } from "@/lib/workflow-runs";

export const SALES_WORKFLOW_SCENARIO_ID = "sales-pipeline";

export type SalesWorkflowMeta = {
  workflowRunId?: string;
  workflowScenarioId?: string;
  workflowStageId?: string;
  workflowSource?: string;
  workflowNextStep?: string;
  workflowTriggerType?: WorkflowTriggerType;
};

export function getSalesWorkflowScenario() {
  return getWorkspaceScenario(SALES_WORKFLOW_SCENARIO_ID);
}

export function getSalesRuntimeLabel(state?: WorkflowRunState | null) {
  switch (state) {
    case "running":
      return "自动处理中";
    case "awaiting_human":
      return "等待人工确认";
    case "completed":
      return "已完成";
    case "error":
      return "执行异常";
    default:
      return "未启动";
  }
}

export function getSalesTriggerLabel(triggerType?: WorkflowTriggerType) {
  switch (triggerType) {
    case "inbound_message":
      return "客户询盘";
    case "schedule":
      return "定时跟进";
    case "web_form":
      return "手动录入线索";
    case "manual":
    default:
      return "手动启动";
  }
}

export function getSalesStageStateLabel(state: WorkflowStageRunState) {
  switch (state) {
    case "running":
      return "执行中";
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

export function getSalesWorkflowNextAction(run: WorkflowRunRecord | null) {
  switch (run?.currentStageId) {
    case "qualify":
      return "先在 Deal Desk 完成资格判断，确认这条询盘是否值得推进。";
    case "outreach":
      return "在 Email Assistant 生成并人工审核跟进邮件，再决定是否发出。";
    case "meeting":
      return "把最近触达、客户偏好和下一步动作同步到 Personal CRM。";
    case "assetize":
      return "把话术、偏好和推进节奏沉淀成可复用销售资产。";
    default:
      return run?.state === "completed"
        ? "这一轮销售闭环已经完成，可以复用沉淀下来的打法。"
        : "从客户询盘或手动录入启动第一条销售 Hero Workflow。";
  }
}

export function buildSalesWorkflowMeta(input?: SalesWorkflowMeta): SalesWorkflowMeta {
  return {
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId ?? SALES_WORKFLOW_SCENARIO_ID,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource,
    workflowNextStep: input?.workflowNextStep,
    workflowTriggerType: input?.workflowTriggerType,
  };
}
