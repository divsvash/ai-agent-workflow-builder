// Real test: fires 20 concurrent admitQuota() calls (the ACTUAL compiled
// function from dist/functions/_lib/db.js, not a re-implementation) against
// an org with quota_limit=5, and asserts exactly 5 are admitted.
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/testdb';

const { admitQuota } = require('../dist/_lib/db');

const ORG_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `UPDATE organizations SET quota_used=0, quota_limit=5, quota_period_start=date_trunc('month', now())::date WHERE id=$1`,
    [ORG_ID]
  );
  await pool.end();

  const CONCURRENCY = 20;
  const promises = Array.from({ length: CONCURRENCY }, () => admitQuota(ORG_ID));
  const results = await Promise.all(promises);

  const admittedCount = results.filter((r) => r.admitted).length;
  const rejectedCount = results.filter((r) => !r.admitted).length;

  console.log(`Fired ${CONCURRENCY} concurrent admitQuota() calls against quota_limit=5, quota_used starting at 0`);
  console.log(`Admitted: ${admittedCount}, Rejected: ${rejectedCount}`);

  const pass = admittedCount === 5 && rejectedCount === 15;
  console.log(pass ? 'PASS: exactly 5 admitted, 15 rejected — no over-admission' : 'FAIL: incorrect admission count');

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('Test threw:', err);
  process.exit(1);
});
