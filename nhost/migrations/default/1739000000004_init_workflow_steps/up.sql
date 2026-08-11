CREATE TABLE public.workflow_steps (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id   uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    step_order    integer NOT NULL,
    type          text NOT NULL,
    config        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT workflow_steps_type_check CHECK (
        type IN ('llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate')
    ),
    CONSTRAINT workflow_steps_order_nonneg CHECK (step_order >= 0),
    CONSTRAINT workflow_steps_workflow_order_unique UNIQUE (workflow_id, step_order)
);

CREATE INDEX workflow_steps_workflow_id_idx ON public.workflow_steps (workflow_id);

CREATE TRIGGER set_workflow_steps_updated_at
BEFORE UPDATE ON public.workflow_steps
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
