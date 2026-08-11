DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
DROP TABLE IF EXISTS public.organizations;
-- set_current_timestamp_updated_at() left in place; later migrations reuse it.
