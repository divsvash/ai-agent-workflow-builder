# Workflow Studio Frontend Contract

This project contains the frontend surface for an AI Agent Workflow Builder. It intentionally does not modify database migrations, backend functions, authorization rules, or the final execution architecture. The UI exposes only the states and operations represented by the external GraphQL/Nhost contract.

## Files created or modified

The main frontend implementation lives in `client/src/pages/Home.tsx`, with the global Command Room visual system in `client/src/index.css` and the font loading in `client/index.html`. The typed GraphQL boundary is isolated in `client/src/lib/graphql.ts`. The design direction is documented in `ideas.md`, and visual QA findings are recorded in `visual-qa.md`.

## Environment variables

| Variable | Purpose | Required for live data |
| --- | --- | --- |
| `VITE_NHOST_GRAPHQL_URL` | Nhost GraphQL endpoint used by the frontend query layer | Yes |
| `VITE_NHOST_WS_URL` | Optional WebSocket endpoint for live subscriptions | Yes for live step updates |
| `VITE_NHOST_ORGANIZATION_ID` | Current organization context | Yes for organization-scoped queries |
| `VITE_NHOST_ROLE` | Display-only role context: `owner`, `editor`, or `viewer` | No; defaults to `viewer` |
| `VITE_NHOST_USER_NAME` | Display-only current user label | No |

The frontend does not treat these display values as a security boundary. Backend authorization must remain authoritative.

## GraphQL operations used

The operation documents in `client/src/lib/graphql.ts` cover the required contract: the organization-scoped workflow query, workflow creation and update placeholders, `triggerWorkflowRun(workflow_id)`, `approveStep(step_run_id)`, the `step_runs` subscription filtered by `workflow_run_id`, and the organization usage query.

The current workflow list executes only when both GraphQL endpoint and organization ID are present. It renders backend-returned records, an explicit loading state, an explicit empty state, or an explicit error state. The execution desk intentionally shows an empty rail until a real workflow run and live step-run data are supplied.

## Local run command

```bash
pnpm install
pnpm dev
```

For a production build:

```bash
pnpm check
pnpm build
```

## Backend assumptions requiring confirmation

The exact Nhost schema may use different root field names, JSON patch types, timestamp fields, or auth/session conventions. The operation strings are isolated so Agent 1/2 can adjust those names without redesigning the UI. The frontend assumes the backend provides organization-scoped workflow access, role-aware authorization, real `workflow_run_id` values, a step-run status enum including `pending`, `running`, `completed`, `failed`, and `paused`, and an authoritative response/subscription after `triggerWorkflowRun` or `approveStep`.

The frontend does not assume approval succeeds after the button action, does not manufacture an execution sequence, and does not make a viewer secure by hiding a button alone. The final permission boundary remains the backend.
