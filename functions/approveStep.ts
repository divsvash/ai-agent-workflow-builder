import { getCallerUserId, isOwnerOrEditor } from './_lib/auth';
import { runStepsFrom } from './_lib/executor';
import { actionError, actionOk, verifyActionSecret } from './_lib/http';
import {
  getOrgRoleForUser,
  getStepRunForApproval,
  getStepsAndExistingStepRuns,
  setWorkflowRunStatus,
  tryApproveStepRun,
} from './_lib/queries';
import type { FunctionRequest, FunctionResponse, HasuraActionPayload } from './_lib/types';

interface ApproveStepInput {
  step_run_id: string;
}

export default async function handler(req: FunctionRequest, res: FunctionResponse) {
  if (!verifyActionSecret(req)) {
    return actionError(res, 401, 'Invalid action secret');
  }

  const payload = req.body as HasuraActionPayload<ApproveStepInput>;
  const stepRunId = payload?.input?.step_run_id;

  if (!stepRunId) {
    return actionError(res, 400, 'step_run_id is required');
  }

  // Authenticate the caller.
  const userId = getCallerUserId(payload);
  if (!userId) {
    return actionError(res, 401, 'Not authenticated');
  }

  try {
    // Resolve step_run -> workflow_step -> workflow -> organization.
    const stepRun = await getStepRunForApproval(stepRunId);
    if (!stepRun) {
      return actionError(res, 404, 'step_run not found');
    }

    // Verify caller belongs to the same organization, with owner/editor role.
    const role = await getOrgRoleForUser(userId, stepRun.org_id);
    if (!isOwnerOrEditor(role)) {
      return actionError(res, 403, 'Not authorized to approve this step');
    }

    // Verify the step is actually an approval_gate.
    if (stepRun.step_type !== 'approval_gate') {
      return actionError(res, 400, 'This step is not an approval_gate');
    }

    // Verify the run is actually paused.
    if (stepRun.status !== 'paused' || stepRun.workflow_run_status !== 'paused') {
      return actionError(res, 409, 'This run is not currently paused for approval');
    }

    // Verify the approval has not already been completed (fast-path check,
    // for a clear error message — NOT the actual concurrency guarantee).
    if (stepRun.approved_at) {
      return actionError(res, 409, 'This approval_gate has already been approved');
    }

    // Atomically approve. This single UPDATE's WHERE clause re-checks
    // status = 'paused' AND approved_at IS NULL at the moment it executes,
    // so it is the actual source of truth for "did I win the race" — not
    // the reads above, which could be stale by the time we get here if a
    // concurrent approveStep call is in flight for the same step_run.
    const approvedAt = new Date().toISOString();
    const wonRace = await tryApproveStepRun(stepRunId, userId, approvedAt);

    if (!wonRace) {
      return actionError(
        res,
        409,
        'This approval_gate was already approved by a concurrent request',
        'ALREADY_APPROVED'
      );
    }

    await setWorkflowRunStatus(stepRun.workflow_run_id, 'running');

    // Resume execution from the correct next step — same shared executor,
    // no separate "resume" engine. All state comes from what's already
    // persisted: the full step list plus every step_run recorded so far.
    const { steps, stepRuns } = await getStepsAndExistingStepRuns(
      stepRun.workflow_id,
      stepRun.workflow_run_id
    );

    const nextStepOrder = stepRun.step_order + 1;

    const result = await runStepsFrom({
      workflowRunId: stepRun.workflow_run_id,
      steps,
      existingStepRuns: stepRuns,
      startAtStepOrder: nextStepOrder,
      callerRole: role,
    });

    return actionOk(res, { workflow_run_id: stepRun.workflow_run_id, status: result.status });
  } catch (err: any) {
    return actionError(res, 500, `approveStep failed: ${err?.message ?? String(err)}`);
  }
}
