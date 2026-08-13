import { adminGraphQL } from './graphql';
import type {
  OrgRole,
  RunStatus,
  StepRunRow,
  StepRunStatus,
  StepType,
  WorkflowStepRow,
} from './types';

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

export async function getWorkflowOrgAndSteps(
  workflowId: string
): Promise<{ orgId: string; steps: WorkflowStepRow[] } | null> {
  const data = await adminGraphQL<{
    workflows_by_pk: { org_id: string; steps: WorkflowStepRow[] } | null;
  }>(
    `
    query GetWorkflowOrgAndSteps($id: uuid!) {
      workflows_by_pk(id: $id) {
        org_id
        steps(order_by: { step_order: asc }) {
          id
          workflow_id
          step_order
          type
          config
        }
      }
    }
    `,
    { id: workflowId }
  );

  if (!data.workflows_by_pk) return null;
  return { orgId: data.workflows_by_pk.org_id, steps: data.workflows_by_pk.steps };
}

export async function getOrgRoleForUser(
  userId: string,
  orgId: string
): Promise<OrgRole | null> {
  const data = await adminGraphQL<{ org_members: { role: OrgRole }[] }>(
    `
    query GetOrgRole($userId: uuid!, $orgId: uuid!) {
      org_members(where: { user_id: { _eq: $userId }, org_id: { _eq: $orgId } }) {
        role
      }
    }
    `,
    { userId, orgId }
  );

  return data.org_members[0]?.role ?? null;
}

export interface StepRunForApproval {
  id: string;
  status: StepRunStatus;
  approved_at: string | null;
  workflow_run_id: string;
  workflow_run_status: RunStatus;
  workflow_step_id: string;
  step_type: StepType;
  step_order: number;
  workflow_id: string;
  org_id: string;
}

export async function getStepRunForApproval(
  stepRunId: string
): Promise<StepRunForApproval | null> {
  const data = await adminGraphQL<{
    step_runs_by_pk: {
      id: string;
      status: StepRunStatus;
      approved_at: string | null;
      workflow_run: { id: string; status: RunStatus };
      workflow_step: {
        id: string;
        type: StepType;
        step_order: number;
        workflow_id: string;
        workflow: { org_id: string };
      };
    } | null;
  }>(
    `
    query GetStepRunForApproval($id: uuid!) {
      step_runs_by_pk(id: $id) {
        id
        status
        approved_at
        workflow_run {
          id
          status
        }
        workflow_step {
          id
          type
          step_order
          workflow_id
          workflow {
            org_id
          }
        }
      }
    }
    `,
    { id: stepRunId }
  );

  const row = data.step_runs_by_pk;
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    approved_at: row.approved_at,
    workflow_run_id: row.workflow_run.id,
    workflow_run_status: row.workflow_run.status,
    workflow_step_id: row.workflow_step.id,
    step_type: row.workflow_step.type,
    step_order: row.workflow_step.step_order,
    workflow_id: row.workflow_step.workflow_id,
    org_id: row.workflow_step.workflow.org_id,
  };
}

export async function getStepsAndExistingStepRuns(
  workflowId: string,
  workflowRunId: string
): Promise<{ steps: WorkflowStepRow[]; stepRuns: StepRunRow[] }> {
  const data = await adminGraphQL<{
    workflow_steps: WorkflowStepRow[];
    step_runs: StepRunRow[];
  }>(
    `
    query GetStepsAndRuns($workflowId: uuid!, $runId: uuid!) {
      workflow_steps(where: { workflow_id: { _eq: $workflowId } }, order_by: { step_order: asc }) {
        id
        workflow_id
        step_order
        type
        config
      }
      step_runs(where: { workflow_run_id: { _eq: $runId } }) {
        id
        workflow_run_id
        workflow_step_id
        status
        input
        output
        error
        attempt_count
        approved_by
        approved_at
      }
    }
    `,
    { workflowId, runId: workflowRunId }
  );

  return { steps: data.workflow_steps, stepRuns: data.step_runs };
}

export async function getWebhookTrigger(
  workflowId: string
): Promise<{ id: string; config: any; org_id: string } | null> {
  const data = await adminGraphQL<{
    workflow_triggers: { id: string; config: any; workflow: { org_id: string } }[];
  }>(
    `
    query GetWebhookTrigger($workflowId: uuid!) {
      workflow_triggers(
        where: {
          workflow_id: { _eq: $workflowId }
          trigger_type: { _eq: "webhook" }
          enabled: { _eq: true }
        }
        limit: 1
      ) {
        id
        config
        workflow {
          org_id
        }
      }
    }
    `,
    { workflowId }
  );

  const row = data.workflow_triggers[0];
  if (!row) return null;
  return { id: row.id, config: row.config, org_id: row.workflow.org_id };
}

// ---------------------------------------------------------------------
// Writes — all via admin secret. No user-role mutation is ever used here.
// ---------------------------------------------------------------------

export async function createWorkflowRun(
  workflowId: string,
  triggeredBy: string | null
): Promise<string> {
  const data = await adminGraphQL<{ insert_workflow_runs_one: { id: string } }>(
    `
    mutation CreateWorkflowRun($workflowId: uuid!, $triggeredBy: uuid) {
      insert_workflow_runs_one(
        object: {
          workflow_id: $workflowId
          status: "running"
          triggered_by: $triggeredBy
          started_at: "now()"
        }
      ) {
        id
      }
    }
    `,
    { workflowId, triggeredBy }
  );
  return data.insert_workflow_runs_one.id;
}

export async function setWorkflowRunStatus(
  runId: string,
  status: RunStatus,
  opts: { completed?: boolean } = {}
): Promise<void> {
  await adminGraphQL(
    `
    mutation SetRunStatus($id: uuid!, $status: String!, $completedAt: timestamptz) {
      update_workflow_runs_by_pk(
        pk_columns: { id: $id }
        _set: { status: $status, completed_at: $completedAt }
      ) {
        id
      }
    }
    `,
    { id: runId, status, completedAt: opts.completed ? new Date().toISOString() : null }
  );
}

export async function insertStepRun(
  workflowRunId: string,
  workflowStepId: string,
  status: StepRunStatus,
  input: any
): Promise<string> {
  const data = await adminGraphQL<{ insert_step_runs_one: { id: string } }>(
    `
    mutation InsertStepRun($runId: uuid!, $stepId: uuid!, $status: String!, $input: jsonb) {
      insert_step_runs_one(
        object: {
          workflow_run_id: $runId
          workflow_step_id: $stepId
          status: $status
          input: $input
          attempt_count: 0
        }
      ) {
        id
      }
    }
    `,
    { runId: workflowRunId, stepId: workflowStepId, status, input: input ?? null }
  );
  return data.insert_step_runs_one.id;
}

export async function updateStepRun(
  stepRunId: string,
  patch: Partial<{
    status: StepRunStatus;
    output: any;
    error: string | null;
    attempt_count: number;
    approved_by: string;
    approved_at: string;
  }>
): Promise<void> {
  await adminGraphQL(
    `
    mutation UpdateStepRun($id: uuid!, $set: step_runs_set_input!) {
      update_step_runs_by_pk(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    `,
    { id: stepRunId, set: patch }
  );
}

/**
 * Atomically approves a step_run, IF AND ONLY IF it is still paused and
 * unapproved at the moment the UPDATE executes.
 *
 * Uses update_step_runs (a bulk/where-scoped mutation), not
 * update_step_runs_by_pk, specifically so the WHERE clause itself carries
 * `status = 'paused' AND approved_at IS NULL` — Hasura compiles this to a
 * single `UPDATE step_runs SET ... WHERE id = $1 AND status = 'paused' AND
 * approved_at IS NULL`. Postgres executes that as one atomic statement: if
 * two of these fire concurrently for the same row, the first to acquire the
 * row lock commits and flips status to 'completed'; the second's WHERE
 * clause then no longer matches (status is no longer 'paused'), so it
 * affects 0 rows. Only the caller who receives affected_rows === 1 may
 * proceed to resume execution — this is the sole source of truth, not the
 * earlier read-then-check in approveStep.ts (which exists only to produce
 * fast, specific error messages before bothering with the write).
 */
export async function tryApproveStepRun(
  stepRunId: string,
  userId: string,
  approvedAt: string
): Promise<boolean> {
  const data = await adminGraphQL<{ update_step_runs: { affected_rows: number } }>(
    `
    mutation TryApproveStepRun($id: uuid!, $userId: uuid!, $approvedAt: timestamptz!) {
      update_step_runs(
        where: {
          id: { _eq: $id }
          status: { _eq: "paused" }
          approved_at: { _is_null: true }
        }
        _set: { approved_by: $userId, approved_at: $approvedAt, status: "completed" }
      ) {
        affected_rows
      }
    }
    `,
    { id: stepRunId, userId, approvedAt }
  );

  return data.update_step_runs.affected_rows === 1;
}

export async function insertWorkflowOutput(
  workflowRunId: string,
  workflowStepId: string,
  key: string,
  value: any
): Promise<string> {
  const data = await adminGraphQL<{ insert_workflow_outputs_one: { id: string } }>(
    `
    mutation InsertOutput($runId: uuid!, $stepId: uuid!, $key: String!, $value: jsonb!) {
      insert_workflow_outputs_one(
        object: { workflow_run_id: $runId, workflow_step_id: $stepId, key: $key, value: $value }
      ) {
        id
      }
    }
    `,
    { runId: workflowRunId, stepId: workflowStepId, key, value }
  );
  return data.insert_workflow_outputs_one.id;
}
