-- Deterministic demo/seed data for Org A vs Org B isolation testing.
-- All IDs below are fixed UUIDs so the demo is reproducible run-to-run.
--
-- ASSUMPTION: this seed inserts minimal rows into auth.users (Nhost Auth's
-- schema) so that org_members' FK to auth.users(id) is satisfiable in a
-- fresh environment. It only sets columns that are safe/standard on a
-- default Nhost Auth install (id, email, display_name, email_verified,
-- default_role). If your auth.users schema differs (extra NOT NULL columns
-- without defaults), replace this block with real signed-up users' IDs
-- instead, or adjust the columns list to match your schema.

-- ---------------------------------------------------------------------
-- Users (3 per org)
-- ---------------------------------------------------------------------
INSERT INTO auth.users (id, email, display_name, email_verified, default_role)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'orga.owner@example.com',  'Org A Owner',  true, 'user'),
  ('a1111111-0000-0000-0000-000000000002', 'orga.editor@example.com', 'Org A Editor', true, 'user'),
  ('a1111111-0000-0000-0000-000000000003', 'orga.viewer@example.com', 'Org A Viewer', true, 'user')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, display_name, email_verified, default_role)
VALUES
  ('b2222222-0000-0000-0000-000000000001', 'orgb.owner@example.com',  'Org B Owner',  true, 'user'),
  ('b2222222-0000-0000-0000-000000000002', 'orgb.editor@example.com', 'Org B Editor', true, 'user'),
  ('b2222222-0000-0000-0000-000000000003', 'orgb.viewer@example.com', 'Org B Viewer', true, 'user')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------
INSERT INTO public.organizations (id, name, quota_limit, quota_used)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Org A', 1000, 0),
  ('b0000000-0000-0000-0000-000000000001', 'Org B', 1000, 0)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Org membership
-- ---------------------------------------------------------------------
INSERT INTO public.org_members (user_id, org_id, role)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('a1111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'editor'),
  ('a1111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'viewer'),

  ('b2222222-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('b2222222-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'editor'),
  ('b2222222-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'viewer')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- One workflow in Org A, with a step and a trigger, for demo purposes.
-- ---------------------------------------------------------------------
INSERT INTO public.workflows (id, org_id, name, description, created_by)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Demo Workflow: Summarize and Notify',
  'Seed workflow used for the Org A vs Org B isolation demo.',
  'a1111111-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workflow_steps (id, workflow_id, step_order, type, config)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  0,
  'llm_call',
  '{"prompt": "Summarize the input text.", "model": "example-model"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workflow_triggers (id, workflow_id, trigger_type, config, enabled)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'manual',
  '{}'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
