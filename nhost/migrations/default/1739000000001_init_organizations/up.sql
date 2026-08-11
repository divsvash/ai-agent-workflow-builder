-- Assumes pgcrypto (gen_random_uuid) is already available, which Nhost enables by default.

CREATE TABLE public.organizations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    quota_limit   integer NOT NULL DEFAULT 1000,
    quota_used    integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT organizations_quota_limit_nonneg CHECK (quota_limit >= 0),
    CONSTRAINT organizations_quota_used_nonneg CHECK (quota_used >= 0)
);

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
