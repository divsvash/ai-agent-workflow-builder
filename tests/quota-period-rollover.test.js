process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/testdb';
const { admitQuota } = require('../dist/_lib/db');

const ORG_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `UPDATE organizations SET quota_used=5, quota_limit=5, quota_period_start='2026-06-01' WHERE id=$1`,
    [ORG_ID]
  );
  await pool.end();

  // Org is seeded with quota_used=5 (== quota_limit=5, exhausted) but
  // quota_period_start='2026-06-01' — stale relative to the current month.
  const result = await admitQuota(ORG_ID);

  console.log('Admission result for a stale, previously-exhausted period:', result);

  const pass =
    result.admitted === true &&
    result.quotaUsed === 1 &&
    result.quotaPeriodStart &&
    new Date(result.quotaPeriodStart).getUTCMonth() === new Date().getUTCMonth();

  console.log(
    pass
      ? 'PASS: stale period rolled over, quota_used reset to 1, quota_period_start advanced to current month'
      : 'FAIL: rollover did not behave as expected'
  );

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('Test threw:', err);
  process.exit(1);
});
