import { env } from './env';

// Every executor read/write EXCEPT quota admission (see db.ts) goes through
// Hasura's GraphQL API using the admin secret. This is the "service
// credential" access the assignment requires: normal authenticated users
// only ever hold the `user` Hasura role, which per Agent 1's permissions has
// no insert/update access on workflow_runs / step_runs / workflow_outputs.
// Only this admin-secret path can write those tables.
//
// Relies on the global `fetch` available in the Node 18+ runtime Nhost
// Functions run on. If the deployed runtime is older, a fetch polyfill
// (undici) would need to be added — flagged in the deliverable report.

export class GraphQLError extends Error {
  constructor(message: string, public errors: any[]) {
    super(message);
  }
}

export async function adminGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(env.hasuraGraphqlEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': env.hasuraAdminSecret(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json: any = await response.json();

  if (json.errors) {
    throw new GraphQLError(
      json.errors.map((e: any) => e.message).join('; '),
      json.errors
    );
  }

  return json.data as T;
}
