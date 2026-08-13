import type { StepExecutionContext, StepExecutionResult } from '../types';

// approval_gate never "executes" logic — it simply signals the executor to
// pause. The executor (executor.ts) is responsible for persisting
// step_runs.status = 'paused' and workflow_runs.status = 'paused', then
// returning control immediately — no waiting, no polling. Resumption is
// handled entirely by approveStep.ts, which re-enters the same executor
// loop starting at the step after this one.
export async function executeApprovalGate(_ctx: StepExecutionContext): Promise<StepExecutionResult> {
  return { status: 'paused' };
}
