import { executeApprovalGate } from './steps/approvalGate';
import { executeConditionalBranch } from './steps/conditionalBranch';
import { executeDbWrite } from './steps/dbWrite';
import { executeHttpRequest } from './steps/httpRequest';
import { executeLlmCall } from './steps/llmCall';
import { executeNotify } from './steps/notify';
import {
  insertStepRun,
  setWorkflowRunStatus,
  updateStepRun,
} from './queries';
import type {
  OrgRole,
  RunStatus,
  StepRunRow,
  WorkflowStepRow,
} from './types';

export interface RunStepsFromParams {
  workflowRunId: string;
  steps: WorkflowStepRow[]; // full, ordered list for the workflow
  existingStepRuns: StepRunRow[]; // step_runs already recorded for this run (for resume)
  startAtStepOrder: number;
  callerRole: OrgRole | null; // null for external (webhook) triggers
}

export interface RunStepsFromResult {
  status: RunStatus;
}

function findIndexByStepOrder(steps: WorkflowStepRow[], stepOrder: number): number {
  // Exact match first (the normal case).
  const exact = steps.findIndex((s) => s.step_order === stepOrder);
  if (exact !== -1) return exact;
  // conditional_branch may target a step_order that doesn't exist exactly
  // (a gap); fall back to the first step at or after that order.
  return steps.findIndex((s) => s.step_order >= stepOrder);
}

function outputForStep(
  stepId: string,
  existingStepRuns: StepRunRow[]
): any {
  const found = existingStepRuns.find((sr) => sr.workflow_step_id === stepId);
  return found ? found.output : undefined;
}

const STEP_HANDLERS = {
  llm_call: executeLlmCall,
  http_request: executeHttpRequest,
  conditional_branch: executeConditionalBranch,
  db_write: executeDbWrite,
  notify: executeNotify,
  approval_gate: executeApprovalGate,
} as const;

/**
 * The single ordered executor. Used by BOTH triggerWorkflowRun (starting at
 * the first step) and approveStep (starting at the step after an approved
 * approval_gate) — there is no second execution engine. "Resume" is not a
 * distinct code path: it's this same function called with a later
 * startAtStepOrder and the previously-persisted step_runs as context.
 *
 * Runs synchronously to completion, failure, or the next pause — no queue,
 * no background worker, no busy-waiting.
 */
export async function runStepsFrom(params: RunStepsFromParams): Promise<RunStepsFromResult> {
  const { workflowRunId, steps, callerRole } = params;
  let existingStepRuns = [...params.existingStepRuns];

  let idx = findIndexByStepOrder(steps, params.startAtStepOrder);

  // previousOutput starts as the output of whatever step_run exists
  // immediately before the starting point (relevant on resume, where a
  // conditional_branch or llm_call earlier in the run already produced
  // output that later steps might reference).
  let previousOutput: any =
    idx > 0 ? outputForStep(steps[idx - 1].id, existingStepRuns) : undefined;

  while (idx !== -1 && idx < steps.length) {
    const step = steps[idx];
    const handler = STEP_HANDLERS[step.type];

    if (!handler) {
      // Should be unreachable given the DB CHECK constraint on type, but
      // fail loudly rather than silently skipping an unknown step type.
      await failRun(workflowRunId, `Unknown step type: ${step.type}`);
      return { status: 'failed' };
    }

    const stepRunId = await insertStepRun(workflowRunId, step.id, 'running', {
      previous_output: previousOutput ?? null,
    });

    const result = await handler({
      workflowRunId,
      step,
      previousOutput,
      callerRole,
    });

    if (result.status === 'failed') {
      await updateStepRun(stepRunId, {
        status: 'failed',
        error: result.error ?? 'Unknown error',
        attempt_count: result.attemptCount ?? 1,
      });
      await failRun(workflowRunId);
      return { status: 'failed' };
    }

    if (result.status === 'paused') {
      await updateStepRun(stepRunId, { status: 'paused' });
      await setWorkflowRunStatus(workflowRunId, 'paused');
      return { status: 'paused' };
    }

    // completed
    await updateStepRun(stepRunId, {
      status: 'completed',
      output: result.output ?? null,
      attempt_count: result.attemptCount ?? 1,
    });

    // Track this step_run locally so later steps (or a future resume) can
    // see its output via outputForStep.
    existingStepRuns = [
      ...existingStepRuns.filter((sr) => sr.workflow_step_id !== step.id),
      {
        id: stepRunId,
        workflow_run_id: workflowRunId,
        workflow_step_id: step.id,
        status: 'completed',
        input: null,
        output: result.output ?? null,
        error: null,
        attempt_count: result.attemptCount ?? 1,
        approved_by: null,
        approved_at: null,
      },
    ];

    previousOutput = result.output;

    if (result.nextStepOrder !== undefined) {
      idx = findIndexByStepOrder(steps, result.nextStepOrder);
    } else {
      idx += 1;
    }
  }

  // Loop exhausted normally: every step from the starting point ran to
  // completion (or was branched past) without failing or pausing.
  await setWorkflowRunStatus(workflowRunId, 'completed', { completed: true });
  return { status: 'completed' };
}

async function failRun(workflowRunId: string, _reason?: string): Promise<void> {
  await setWorkflowRunStatus(workflowRunId, 'failed', { completed: true });
}
