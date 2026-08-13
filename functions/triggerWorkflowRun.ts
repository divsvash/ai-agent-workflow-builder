import { getCallerUserId, isOwner, isOwnerOrEditor } from './_lib/auth';
import { admitQuota } from './_lib/db';
import { runStepsFrom } from './_lib/executor';
import { actionError, actionOk, verifyActionSecret } from './_lib/http';
import { createWorkflowRun, getOrgRoleForUser, getWorkflowOrgAndSteps } from './_lib/queries';
import type { FunctionRequest, FunctionResponse, HasuraActionPayload } from './_lib/types';

interface TriggerWorkflowRunInput {
  workflow_id: string;
}

export default async function handler(req: FunctionRequest, res: FunctionResponse) {
  if (!verifyActionSecret(req)) {
    return actionError(res, 401, 'Invalid action secret');
  }

  const payload = req.body as HasuraActionPayload<TriggerWorkflowRunInput>;
  const workflowId = payload?.input?.workflow_id;

  if (!workflowId) {
    return actionError(res, 400, 'workflow_id is required');
  }

  // 1. Authenticate the caller.
  const userId = getCallerUserId(payload);
  if (!userId) {
    return actionError(res, 401, 'Not authenticated');
  }

  try {
    // 2-3. Load the workflow and derive its organization (never trust a
    // client-supplied org_id — it's always derived from the workflow row).
    const workflow = await getWorkflowOrgAndSteps(workflowId);
    if (!workflow) {
      return actionError(res, 404, 'Workflow not found');
    }

    // 4. Verify the caller is owner/editor in that organization.
    const role = await getOrgRoleForUser(userId, workflow.orgId);
    if (!isOwnerOrEditor(role)) {
      return actionError(res, 403, 'Not authorized to trigger this workflow');
    }

    // Sensitive-step gate: if the workflow contains db_write/notify steps,
    // require owner even though Hasura already enforced owner-only at
    // authoring time — role may have changed since the step was created.
    const hasSensitiveStep = workflow.steps.some((s) => s.type === 'db_write' || s.type === 'notify');
    if (hasSensitiveStep && !isOwner(role)) {
      return actionError(res, 403, 'This workflow contains db_write/notify steps; only an owner may trigger it');
    }

    if (workflow.steps.length === 0) {
      return actionError(res, 400, 'Workflow has no steps');
    }

    // 5. Check organization quota (atomic admission via direct Postgres).
    const admission = await admitQuota(workflow.orgId);
    if (!admission.admitted) {
      return actionError(res, 429, 'Organization quota exceeded for the current period', 'QUOTA_EXCEEDED');
    }

    // 6. Create workflow_run.
    const workflowRunId = await createWorkflowRun(workflowId, userId);

    // 7-16. Execute workflow steps in order via the shared executor.
    const result = await runStepsFrom({
      workflowRunId,
      steps: workflow.steps,
      existingStepRuns: [],
      startAtStepOrder: workflow.steps[0].step_order,
      callerRole: role,
    });

    return actionOk(res, { workflow_run_id: workflowRunId, status: result.status });
  } catch (err: any) {
    return actionError(res, 500, `triggerWorkflowRun failed: ${err?.message ?? String(err)}`);
  }
}
