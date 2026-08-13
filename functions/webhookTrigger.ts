import { admitQuota } from './_lib/db';
import { runStepsFrom } from './_lib/executor';
import { actionError, actionOk, verifyActionSecret } from './_lib/http';
import { createWorkflowRun, getWebhookTrigger, getWorkflowOrgAndSteps } from './_lib/queries';
import type { FunctionRequest, FunctionResponse, HasuraActionPayload } from './_lib/types';

interface WebhookTriggerInput {
  workflow_id: string;
  secret: string;
}

// External system -> Hasura Action (webhookTrigger) -> this Nhost Function
// -> the exact same shared executor used by manual execution.
//
// There is no end-user JWT here (this is called by an external system, not
// a logged-in user), so authorization can't be "caller is owner/editor."
// Instead, the workflow_triggers row for this workflow must (a) be an
// enabled trigger of type 'webhook', and (b) have a config.secret that
// matches what the caller supplies. Creating a webhook-type trigger already
// required 'owner' role at write-time (Agent 1's Layer 2 Hasura permission
// gate on workflow_triggers), so a valid, enabled webhook trigger is
// implicitly owner-authorized — sensitive steps (db_write/notify) are
// allowed to run under a webhook-triggered run on that basis.
export default async function handler(req: FunctionRequest, res: FunctionResponse) {
  if (!verifyActionSecret(req)) {
    return actionError(res, 401, 'Invalid action secret');
  }

  const payload = req.body as HasuraActionPayload<WebhookTriggerInput>;
  const workflowId = payload?.input?.workflow_id;
  const suppliedSecret = payload?.input?.secret;

  if (!workflowId || !suppliedSecret) {
    return actionError(res, 400, 'workflow_id and secret are required');
  }

  try {
    // Identify the configured workflow + verify it has an enabled webhook trigger.
    const trigger = await getWebhookTrigger(workflowId);
    if (!trigger) {
      return actionError(res, 404, 'No enabled webhook trigger configured for this workflow');
    }

    // Verify the shared secret from the trigger config; reject invalid secrets.
    const expectedSecret = trigger.config?.secret;
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return actionError(res, 401, 'Invalid webhook secret');
    }

    const workflow = await getWorkflowOrgAndSteps(workflowId);
    if (!workflow || workflow.steps.length === 0) {
      return actionError(res, 400, 'Workflow not found or has no steps');
    }

    const admission = await admitQuota(workflow.orgId);
    if (!admission.admitted) {
      return actionError(res, 429, 'Organization quota exceeded for the current period', 'QUOTA_EXCEEDED');
    }

    // triggered_by = null for external execution — no human caller.
    const workflowRunId = await createWorkflowRun(workflowId, null);

    // Invoke the exact same shared executor used by manual execution.
    // callerRole is null because this is an external trigger; step handlers
    // treat null as "already authorized" for sensitive steps (see note above).
    const result = await runStepsFrom({
      workflowRunId,
      steps: workflow.steps,
      existingStepRuns: [],
      startAtStepOrder: workflow.steps[0].step_order,
      callerRole: null,
    });

    return actionOk(res, { workflow_run_id: workflowRunId, status: result.status });
  } catch (err: any) {
    return actionError(res, 500, `webhookTrigger failed: ${err?.message ?? String(err)}`);
  }
}
