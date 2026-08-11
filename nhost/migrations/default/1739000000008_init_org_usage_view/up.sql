-- Org-level usage for the current calendar month, counted by workflow_runs.
-- Kept as a plain view (recomputed on query) rather than a materialized view,
-- since org/workflow/run volumes here are small enough not to need caching.

CREATE VIEW public.org_usage_monthly AS
SELECT
    o.id                                                   AS org_id,
    o.name                                                 AS org_name,
    o.quota_limit                                           AS quota_limit,
    date_trunc('month', now())                              AS usage_month,
    count(wr.id) FILTER (
        WHERE wr.created_at >= date_trunc('month', now())
    )                                                        AS runs_this_month
FROM public.organizations o
LEFT JOIN public.workflows w ON w.org_id = o.id
LEFT JOIN public.workflow_runs wr ON wr.workflow_id = w.id
GROUP BY o.id, o.name, o.quota_limit;
