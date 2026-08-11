-- workflow_outputs: durable, keyed outputs produced by a step during a run
-- (e.g. what a db_write step actually wrote, or any named value a step wants
-- to expose downstream). Separate from step_runs.output so a single step can
-- emit multiple named values without overloading one JSONB blob.

CREATE TABLE public.workflow_outputs (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id   uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id  uuid NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    key               text NOT NULL,
    value             jsonb NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workflow_outputs_workflow_run_id_idx ON public.workflow_outputs (workflow_run_id);
CREATE INDEX workflow_outputs_workflow_step_id_idx ON public.workflow_outputs (workflow_step_id);
