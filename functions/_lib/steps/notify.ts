import { interpolate } from '../interpolate';
import { insertWorkflowOutput } from '../queries';
import type { StepExecutionContext, StepExecutionResult } from '../types';

// Config contract:
// {
//   "message": "string, required. May contain {{previous_output}}",
//   "channel": "string, optional — informational metadata only"
// }
//
// IMPORTANT: this step does NOT call Slack (or any notification service)
// directly. Per the approved design, a notify step only inserts a row into
// workflow_outputs with key = "notification". A Hasura Event Trigger on
// workflow_outputs INSERT (configured in
// nhost/metadata/databases/default/tables/public_workflow_outputs.yaml)
// invokes functions/notifyEventHandler.ts, which inspects rows where
// key = "notification" and performs the actual Slack call. This keeps the
// executor decoupled from any specific notification provider and reuses
// workflow_outputs instead of a new table.
export async function executeNotify(ctx: StepExecutionContext): Promise<StepExecutionResult> {
  if (ctx.callerRole !== null && ctx.callerRole !== 'owner') {
    return { status: 'failed', error: 'notify requires owner role' };
  }

  const config = ctx.step.config || {};
  if (!config.message || typeof config.message !== 'string') {
    return { status: 'failed', error: 'notify step config.message is required' };
  }

  const message = interpolate(config.message, ctx.previousOutput);
  const value = {
    message,
    channel: config.channel ?? null,
    source_step_id: ctx.step.id,
  };

  await insertWorkflowOutput(ctx.workflowRunId, ctx.step.id, 'notification', value);

  return { status: 'completed', output: value };
}
