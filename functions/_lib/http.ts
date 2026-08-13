import { env } from './env';
import type { FunctionRequest, FunctionResponse } from './types';

// Hasura Action errors: a non-200 JSON body with a `message` field is
// surfaced by Hasura as a GraphQL error with that message. `code` is an
// optional machine-readable extension.
export function actionError(res: FunctionResponse, status: number, message: string, code?: string) {
  res.status(status).json({ message, ...(code ? { code } : {}) });
}

export function actionOk(res: FunctionResponse, body: any) {
  res.status(200).json(body);
}

// Verifies the shared secret Hasura is configured to send on every action /
// event-trigger webhook call, so this function endpoint can't usefully be
// invoked by anyone who didn't come through Hasura. No-ops (allows the
// request) if ACTION_SECRET isn't configured, for local dev convenience.
export function verifyActionSecret(req: FunctionRequest): boolean {
  const expected = env.actionSecret();
  if (!expected) return true;
  const header = req.headers['x-action-secret'];
  const provided = Array.isArray(header) ? header[0] : header;
  return provided === expected;
}
