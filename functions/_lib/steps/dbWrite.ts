import { insertWorkflowOutput } from '../queries';
import type { StepExecutionContext, StepExecutionResult } from '../types';

// Config contract:
// {
//   "key": "string, required — the workflow_outputs.key to write",
//   "value": any — literal value to store, OR
//   "value_from_previous_output": true — use the previous step's output as the value instead
// }
//
// Only reachable if the caller (or, for a webhook-triggered run, the
// trigger's own owner-only creation gate) already authorized db_write for
// this workflow — enforced by triggerWorkflowRun/webhookTrigger BEFORE the
// executor loop starts, and re-checked defensively here.
export async function executeDbWrite(ctx: StepExecutionContext): Promise<StepExecutionResult> {
  if (ctx.callerRole !== null && ctx.callerRole !== 'owner') {
    return { status: 'failed', error: 'db_write requires owner role' };
  }

  const config = ctx.step.config || {};
  if (!config.key || typeof config.key !== 'string') {
    return { status: 'failed', error: 'db_write step config.key is required' };
  }

  const value = config.value_from_previous_output === true ? ctx.previousOutput : config.value;

  if (value === undefined) {
    return {
      status: 'failed',
      error: 'db_write step requires config.value or config.value_from_previous_output=true',
    };
  }

  await insertWorkflowOutput(ctx.workflowRunId, ctx.step.id, config.key, value);

  return { status: 'completed', output: { key: config.key, value } };
}
