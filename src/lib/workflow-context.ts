import type { WorkflowTriggerType } from "@/lib/workflow-runs";

export type WorkflowContextMeta = {
  workflowRunId?: string;
  workflowScenarioId?: string;
  workflowStageId?: string;
  workflowSource?: string;
  workflowNextStep?: string;
  workflowTriggerType?: WorkflowTriggerType;
};
