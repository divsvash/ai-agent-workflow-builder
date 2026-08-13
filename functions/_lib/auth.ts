import type { HasuraActionPayload, OrgRole } from './types';

// "Authenticate the caller": Hasura validates the caller's JWT BEFORE it
// ever invokes this action webhook, and forwards the resulting session
// variables in the POST body. We trust `session_variables['x-hasura-user-id']`
// precisely because only Hasura (verified via verifyActionSecret in http.ts)
// can reach this endpoint — we never accept a user id passed as a plain
// GraphQL argument, which would let a client claim to be anyone.
export function getCallerUserId(payload: HasuraActionPayload): string | null {
  return payload.session_variables?.['x-hasura-user-id'] ?? null;
}

export function isOwnerOrEditor(role: OrgRole | null): boolean {
  return role === 'owner' || role === 'editor';
}

export function isOwner(role: OrgRole | null): boolean {
  return role === 'owner';
}
