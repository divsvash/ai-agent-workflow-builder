// Shared types for the workflow execution engine.
// Mirrors the schema exactly as defined by Agent 1 — no invented columns.

export type OrgRole = 'owner' | 'editor' | 'viewer';

export type StepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate';

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type StepRunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowStepRow {
  id: string;
  workflow_id: string;
  step_order: number;
  type: StepType;
  config: Record<string, any>;
}

export interface StepRunRow {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: StepRunStatus;
  input: any;
  output: any;
  error: string | null;
  attempt_count: number;
  approved_by: string | null;
  approved_at: string | null;
}

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  status: RunStatus;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
}

// Minimal Express-compatible request/response shape.
// Nhost Functions expose an Express-compatible (req, res) signature at
// runtime; we avoid depending on @types/express (not a runtime dependency
// Nhost requires us to install) and instead type only what we use.
export interface FunctionRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

export interface FunctionResponse {
  status(code: number): FunctionResponse;
  json(body: any): void;
  send(body: any): void;
}

// Hasura Action webhook payload shape (what Hasura POSTs to our handler).
export interface HasuraActionPayload<TInput = any> {
  action: { name: string };
  input: TInput;
  session_variables: Record<string, string>;
  request_query?: string;
}

// Hasura Event Trigger webhook payload shape.
export interface HasuraEventPayload<TRow = any> {
  event: {
    op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
    data: { old: TRow | null; new: TRow | null };
  };
  table: { schema: string; name: string };
  trigger: { name: string };
}

export interface StepExecutionContext {
  workflowRunId: string;
  step: WorkflowStepRow;
  previousOutput: any;
  callerRole: OrgRole | null; // null for external (webhook) triggers
}

export interface StepExecutionResult {
  status: 'completed' | 'failed' | 'paused';
  output?: any;
  error?: string;
  attemptCount?: number;
  // Only set by conditional_branch to redirect the executor's cursor.
  nextStepOrder?: number;
}
