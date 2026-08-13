// Centralized environment variable access. Nothing here is ever hard-coded —
// every credential comes from process.env, read lazily (not at import time)
// so a missing var only breaks the specific code path that needs it.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  // Hasura GraphQL endpoint + admin secret, used for every mutation/query
  // except the single atomic quota-admission statement (which uses DATABASE_URL
  // directly, per the approved plan).
  hasuraGraphqlEndpoint: () => required('HASURA_GRAPHQL_ENDPOINT'),
  hasuraAdminSecret: () => required('HASURA_GRAPHQL_ADMIN_SECRET'),

  // Direct Postgres connection, used ONLY for atomic quota admission.
  databaseUrl: () => required('DATABASE_URL'),

  // Shared secret Hasura sends to our function handlers (via the action's
  // configured headers) so the function can reject calls that didn't come
  // through Hasura. Optional: if unset, this check is skipped (useful for
  // local dev), but should be set in any real deployment.
  actionSecret: () => optional('ACTION_SECRET'),

  // Groq LLM provider.
  groqApiKey: () => required('GROQ_API_KEY'),
  groqApiUrl: () => optional('GROQ_API_URL') || 'https://api.groq.com/openai/v1/chat/completions',
  groqDefaultModel: () => optional('GROQ_DEFAULT_MODEL') || 'llama-3.1-8b-instant',

  // notify -> workflow_outputs -> Hasura Event Trigger -> this webhook.
  slackWebhookUrl: () => optional('SLACK_WEBHOOK_URL'),
};
