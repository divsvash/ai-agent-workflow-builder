import { Pool } from 'pg';
import { env } from './env';

// A single pooled Postgres connection, used ONLY for the atomic quota
// admission statement described below. Every other read/write in the
// executor goes through the Hasura GraphQL API with the admin secret — this
// is the sole exception, because Hasura's GraphQL mutations can't express a
// column-to-column WHERE comparison (quota_used < quota_limit) as a single
// atomic operation, and quota admission must be race-safe under concurrent
// triggerWorkflowRun calls.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.databaseUrl() });
  }
  return pool;
}

export interface QuotaAdmissionResult {
  admitted: boolean;
  quotaUsed?: number;
  quotaLimit?: number;
  quotaPeriodStart?: string;
}

/**
 * Atomically reserves one execution slot for `orgId`.
 *
 * Semantics (per the approved plan):
 * - quota_used represents ADMITTED / RESERVED execution slots for the
 *   current quota period, not just successfully completed runs. A run that
 *   is admitted here counts against quota even if it later fails — the slot
 *   was consumed at admission time, matching "if usage >= limit: reject"
 *   happening BEFORE a run is created.
 * - If the stored quota_period_start is before the start of the current
 *   calendar month, the period is rolled forward: quota_used resets to 1
 *   (this admission is the first use of the new period) and
 *   quota_period_start advances to the first of the current month.
 * - Otherwise, the slot is granted only if quota_used < quota_limit, and
 *   quota_used is incremented by 1.
 *
 * This is expressed as a single UPDATE ... WHERE ... RETURNING statement.
 * Postgres takes a row-level lock for the duration of an UPDATE; a second
 * concurrent UPDATE against the same organizations row blocks until the
 * first commits, then re-evaluates its WHERE clause against the now-updated
 * row. That serialization is what makes this safe against two simultaneous
 * requests both consuming the last available slot — no explicit
 * BEGIN/FOR UPDATE transaction block is needed for a single statement.
 */
export async function admitQuota(orgId: string): Promise<QuotaAdmissionResult> {
  const sql = `
    UPDATE organizations
    SET
      quota_used = CASE
        WHEN quota_period_start < date_trunc('month', now())::date THEN 1
        ELSE quota_used + 1
      END,
      quota_period_start = CASE
        WHEN quota_period_start < date_trunc('month', now())::date THEN date_trunc('month', now())::date
        ELSE quota_period_start
      END
    WHERE id = $1
      AND (
        quota_period_start < date_trunc('month', now())::date
        OR quota_used < quota_limit
      )
    RETURNING quota_used, quota_limit, quota_period_start;
  `;

  const result = await getPool().query(sql, [orgId]);

  if (result.rowCount === 0) {
    return { admitted: false };
  }

  const row = result.rows[0];
  return {
    admitted: true,
    quotaUsed: row.quota_used,
    quotaLimit: row.quota_limit,
    quotaPeriodStart: row.quota_period_start,
  };
}
