-- ASSUMPTION: this project uses Nhost Auth, which provisions auth.users(id uuid PK).
-- If that schema is absent in this environment, drop the FK to auth.users and keep
-- user_id as a bare uuid column instead.

CREATE TABLE public.org_members (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role          text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT org_members_role_check CHECK (role IN ('owner', 'editor', 'viewer')),
    CONSTRAINT org_members_user_org_unique UNIQUE (user_id, org_id)
);

CREATE INDEX org_members_org_id_idx ON public.org_members (org_id);
CREATE INDEX org_members_user_id_idx ON public.org_members (user_id);

CREATE TRIGGER set_org_members_updated_at
BEFORE UPDATE ON public.org_members
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
