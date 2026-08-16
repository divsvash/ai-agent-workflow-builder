/*
 * Command Room style reminder: this file is the quiet contract boundary.
 * Keep operation names and response shapes explicit, avoid frontend-only
 * execution assumptions, and let live GraphQL data determine visible state.
 */

export type GraphQLConfig = {
  endpoint: string;
  websocketEndpoint?: string;
  organizationId?: string;
  role?: "owner" | "editor" | "viewer";
  userName?: string;
};

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export const WORKFLOWS_QUERY = /* GraphQL */ `
  query Workflows($organizationId: uuid!) {
    workflows(where: { org_id: { _eq: $organizationId } }) {
      id
      name
      updated_at
    }
  }
`;

export const CREATE_WORKFLOW_MUTATION = /* GraphQL */ `
  mutation CreateWorkflow($organizationId: uuid!, $name: String!) {
    insert_workflows_one(object: { org_id: $organizationId, name: $name }) {
      id
      name
      updated_at
    }
  }
`;

export const UPDATE_WORKFLOW_MUTATION = /* GraphQL */ `
  mutation UpdateWorkflow($workflowId: uuid!, $patch: jsonb!) {
    update_workflows_by_pk(pk_columns: { id: $workflowId }, _set: $patch) {
      id
      name
      updated_at
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN_MUTATION = /* GraphQL */ `
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(workflow_id: $workflowId) {
      workflow_run_id
    }
  }
`;

export const APPROVE_STEP_MUTATION = /* GraphQL */ `
  mutation ApproveStep($stepRunId: uuid!) {
    approveStep(step_run_id: $stepRunId) {
      step_run_id
    }
  }
`;

export const STEP_RUNS_SUBSCRIPTION = /* GraphQL */ `
  subscription StepRuns($workflowRunId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $workflowRunId } }, order_by: { position: asc }) {
      id
      workflow_run_id
      step_key
      step_type
      status
      position
      started_at
      completed_at
    }
  }
`;


export function getGraphQLConfig(): GraphQLConfig {
  return {
    endpoint: import.meta.env.VITE_NHOST_GRAPHQL_URL ?? "",
    websocketEndpoint: import.meta.env.VITE_NHOST_WS_URL,
    organizationId: import.meta.env.VITE_NHOST_ORGANIZATION_ID,
    role: import.meta.env.VITE_NHOST_ROLE ?? "viewer",
    userName: import.meta.env.VITE_NHOST_USER_NAME,
  };
}

export async function requestGraphQL<T>(
  config: GraphQLConfig,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  if (!config.endpoint) {
    throw new Error("VITE_NHOST_GRAPHQL_URL is not configured.");
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? "GraphQL request failed.");
  }
  if (!payload.data) {
    throw new Error("GraphQL returned no data.");
  }
  return payload.data;
}

export const operationCatalog = [
  { label: "Workflows", operation: "query Workflows" },
  { label: "Create / update", operation: "mutation CreateWorkflow / UpdateWorkflow" },
  { label: "Run", operation: "mutation TriggerWorkflowRun" },
  { label: "Approve", operation: "mutation ApproveStep" },
  { label: "Live step runs", operation: "subscription StepRuns" },
];
