## Database, Hasura & Security (Agent 1)

> This section covers only the DATABASE + HASURA + SECURITY + SEEDS ownership
> area. Paste/merge it into the project's main README; it is written standalone
> so it isn't accidentally overwriting anything else.

### Schema reasoning

The schema is a straight hierarchy that mirrors the product model:

```
organizations
  └─ org_members        (who belongs to the org, and with what role)
  └─ workflows
       └─ workflow_steps     (ordered, typed, JSONB config)
       └─ workflow_triggers  (typed, JSONB config, enabled flag)
       └─ workflow_runs      (one row per execution)
            └─ step_runs     (one row per step per run — immutable-ish history)
```

Design choices:

- **UUID PKs everywhere** so records can be created client- or server-side
  without a round trip, and so org/workflow IDs are unguessable (important for
  cross-org isolation, since nothing here relies on IDs being secret, but it
  doesn't hurt).
- **JSONB only on `config`, `input`, `output`** — the genuinely variable
  fields (step config differs completely per `type`, run input/output differ
  per step). Everything else (status, role, type, order, timestamps) is a
  plain typed column with a `CHECK` constraint, so Postgres and Hasura can
  both validate and index on it.
- **`CHECK` constraints enforce the fixed vocabularies** from the assignment:
  roles (`owner|editor|viewer`), step types (6 values), trigger types (4
  values), and run/step-run statuses (`pending|running|paused|completed|failed`).
- **`workflow_steps` / `step_runs` have a uniqueness constraint** enforcing
  "ordered, one per workflow" and "one per step per run" respectively, so
  those invariants live in the DB, not just application code.
- **`org_usage_monthly` is a plain SQL view**, not materialized — usage
  aggregation is simple `COUNT` over `workflow_runs` for the current month; a
  view keeps it always correct with no refresh/staleness to reason about.

### Relationships (tracked in Hasura)

```
organizations 1─* org_members
organizations 1─* workflows
workflows     1─* workflow_steps
workflows     1─* workflow_triggers
workflows     1─* workflow_runs
workflow_runs 1─* step_runs
```

`org_usage_monthly` has a manually-configured relationship back to
`organizations` (views don't carry real foreign keys) so its select
permission can be scoped the same way as every other table.

### Permission model (two layers)

**Layer 1 — org + role scoping.** Every table's `select`/`insert`/`update`/
`delete` permission for the `user` role walks the relationship chain back to
`organizations.members` and requires `user_id = X-Hasura-User-Id`. This is
what stops an Org A user from reading or mutating an Org B workflow even with
the UUID in hand — the row simply doesn't match the permission filter, so
Hasura returns nothing (not an error, not a leak of "it exists but you can't
see it").

Role-gated actions:
- `owner`: full control over workflows/steps/triggers, membership management,
  can trigger runs.
- `editor`: create/edit workflows, steps, triggers (except the sensitive
  subset below), can trigger runs, **cannot** touch `org_members`.
- `viewer`: `select` only everywhere; no insert/update/delete permissions
  exist for viewer-eligible rows, and run-triggering is blocked because
  `workflow_runs` insert requires `role IN (owner, editor)`.

**Layer 2 — sensitive step/trigger gating.** `workflow_steps` and
`workflow_triggers` insert/update/delete permissions use an `_or` of two
`_and` branches: one requires `role IN (owner, editor)` for the "safe" types
(`llm_call`, `http_request`, `conditional_branch`, `approval_gate`,
`manual`/`scheduled`/`database_event` triggers), the other requires
`role = owner` for the sensitive types (`db_write`, `notify`, `webhook`
trigger). This is pure Hasura permission-expression logic — no Postgres
trigger/function needed. The same expression is used for the `check`
(post-write) as the `filter` (pre-write) on updates, so an editor can't
side-step the gate by changing a step's `type` mid-update.

**`step_runs` (and `workflow_runs` status/timestamps) are read-only for the
`user` role.** Only a `service` Hasura role — intended for Agent 2's
execution engine / Nhost Functions to use — can insert/update them. Approval
authorization itself (i.e., "is this specific approver allowed to approve
this specific `approval_gate` step") is **not** expressed in Hasura
permissions at all; per the assignment, that logic belongs in Agent 2's
Action handler.

### Cross-org isolation, concretely

Every permission filter/check in `nhost/metadata/databases/default/tables/`
bottoms out in the same predicate: *does a row exist in `org_members` linking
`X-Hasura-User-Id` to the organization that owns this row (directly or via
`workflow` → `organization`)?* Guessing a UUID from another org does not
help, because the filter is evaluated against the requester's session
variable, not against anything derivable from the row's ID.

### Assumptions Agent 2 must know

1. **`step_runs.status` enum** is not specified in the assignment. It mirrors
   `workflow_runs.status` (`pending|running|paused|completed|failed`) so an
   `approval_gate` step can sit in `paused` while awaiting approval. If your
   executor's state machine wants different values, that's a migration
   change, not a permission change.
2. **`step_runs` and `workflow_runs` status/output mutation is `service`-role
   only.** Agent 2's backend should either call Hasura as the `service` role
   (defined in metadata but you'll need to wire up how that role's session
   variable gets set — e.g. a custom JWT claim or `x-hasura-role` header from
   a trusted server context) or call with the admin secret directly from
   Nhost Functions. Either way, do not expose run/step-run mutations to
   end-user GraphQL calls.
3. **Approval authorization is not enforced by the DB/Hasura layer at all** —
   `approved_by`/`approved_at` are plain columns anyone with `service`-role
   access can set. Agent 2's Action handler must independently verify the
   approver is legitimate before writing those columns.
4. **Org creation is out of scope here.** There are no `insert` permissions
   on `organizations` for the `user` role — org creation/quota changes are
   assumed to happen through an admin-privileged path, not a normal mutation.
5. **`auth.users`** is assumed to be Nhost Auth's standard schema. The seed
   inserts minimal rows there; if your actual Nhost Auth schema has
   additional `NOT NULL` columns without defaults, the seed's `auth.users`
   insert will need adjusting (see comment at the top of the seed file).
