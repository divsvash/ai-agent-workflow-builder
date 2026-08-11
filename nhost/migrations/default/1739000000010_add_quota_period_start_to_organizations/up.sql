ALTER TABLE public.organizations
    ADD COLUMN quota_period_start date NOT NULL DEFAULT date_trunc('month', now())::date;
