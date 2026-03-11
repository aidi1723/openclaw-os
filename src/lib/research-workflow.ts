import { getWorkspaceScenario } from "@/lib/workspace-presets";
import type {
  WorkflowRunRecord,
  WorkflowRunState,
  WorkflowStageRunState,
  WorkflowTriggerType,
} from "@/lib/workflow-runs";
import type { WorkflowContextMeta } from "@/lib/workflow-context";

export const RESEARCH_WORKFLOW_SCENARIO_ID = "research-radar";

export type ResearchWorkflowMeta = WorkflowContextMeta;

export function getResearchWorkflowScenario() {
  return getWorkspaceScenario(RESEARCH_WORKFLOW_SCENARIO_ID);
}

export function buildResearchWorkflowMeta(input?: ResearchWorkflowMeta): ResearchWorkflowMeta {
  return {
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId ?? RESEARCH_WORKFLOW_SCENARIO_ID,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource,
    workflowNextStep: input?.workflowNextStep,
    workflowTriggerType: input?.workflowTriggerType,
  };
}

export function getResearchRuntimeLabel(state?: WorkflowRunState | null) {
  switch (state) {
    case "running":
      return "研究处理中";
    case "awaiting_human":
      return "待人工判断";
    case "completed":
      return "已沉淀完成";
    case "error":
      return "研究异常";
    default:
      return "未启动";
  }
}

export function getResearchTriggerLabel(triggerType?: WorkflowTriggerType) {
  switch (triggerType) {
    case "web_form":
      return "研究任务";
    case "schedule":
      return "定时情报";
    case "manual":
      return "手动启动";
    default:
      return "研究输入";
  }
}

export function getResearchStageStateLabel(state: WorkflowStageRunState) {
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

export function getResearchWorkflowNextAction(run: WorkflowRunRecord | null) {
  switch (run?.currentStageId) {
    case "capture":
      return "先把研究主题、来源和角度压成结构化研究简报。";
    case "synthesize":
      return "把研究结论转成可被决策使用的摘要，而不是停留在资料堆里。";
    case "route":
      return "把研究洞察送去知识库、内容或任务系统，进入真正分发。";
    case "assetize":
      return "把方法、判断框架和跟踪维度沉淀成长期资产。";
    default:
      return run?.state === "completed"
        ? "这一轮研究闭环已经完成，可以复用沉淀下来的分析框架和分发模板。"
        : "从 Deep Research Hub 启动一条 Research Hero Workflow。";
  }
}
