-- ASSUMPTION: the assignment specifies a "status" column for step_runs but does not
-- enumerate its values. We mirror workflow_runs' status set (pending/running/paused/
-- completed/failed) so that approval_gate steps can sit in "paused" while awaiting
-- approval. Agent 2 should confirm this matches the executor's state machine.

CREATE TABLE public.step_runs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id  uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id uuid NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    status           text NOT NULL DEFAULT 'pending',
    input            jsonb,
    output           jsonb,
    error            text,
    attempt_count    integer NOT NULL DEFAULT 0,
    approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT step_runs_status_check CHECK (
        status IN ('pending', 'running', 'paused', 'completed', 'failed')
    ),
    CONSTRAINT step_runs_attempt_count_nonneg CHECK (attempt_count >= 0),
    -- "one per step per workflow run"
    CONSTRAINT step_runs_run_step_unique UNIQUE (workflow_run_id, workflow_step_id)
);

CREATE INDEX step_runs_workflow_run_id_idx ON public.step_runs (workflow_run_id);
CREATE INDEX step_runs_workflow_step_id_idx ON public.step_runs (workflow_step_id);
CREATE INDEX step_runs_status_idx ON public.step_runs (status);

CREATE TRIGGER set_step_runs_updated_at
BEFORE UPDATE ON public.step_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
