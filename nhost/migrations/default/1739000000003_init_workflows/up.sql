CREATE TABLE public.workflows (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name          text NOT NULL,
    description   text,
    created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workflows_org_id_idx ON public.workflows (org_id);

CREATE TRIGGER set_workflows_updated_at
BEFORE UPDATE ON public.workflows
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
