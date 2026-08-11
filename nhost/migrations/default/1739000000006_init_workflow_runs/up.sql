CREATE TABLE public.workflow_runs (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id    uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    status         text NOT NULL DEFAULT 'pending',
    triggered_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at     timestamptz,
    completed_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT workflow_runs_status_check CHECK (
        status IN ('pending', 'running', 'paused', 'completed', 'failed')
    )
);

CREATE INDEX workflow_runs_workflow_id_idx ON public.workflow_runs (workflow_id);
CREATE INDEX workflow_runs_status_idx ON public.workflow_runs (status);
CREATE INDEX workflow_runs_created_at_idx ON public.workflow_runs (created_at);

CREATE TRIGGER set_workflow_runs_updated_at
BEFORE UPDATE ON public.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
