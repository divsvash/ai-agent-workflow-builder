CREATE TABLE public.workflow_triggers (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id    uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    trigger_type   text NOT NULL,
    config         jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled        boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT workflow_triggers_type_check CHECK (
        trigger_type IN ('manual', 'webhook', 'scheduled', 'database_event')
    )
);

CREATE INDEX workflow_triggers_workflow_id_idx ON public.workflow_triggers (workflow_id);

CREATE TRIGGER set_workflow_triggers_updated_at
BEFORE UPDATE ON public.workflow_triggers
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
