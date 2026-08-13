// This exercises the exact SQL semantics Hasura compiles
// tryApproveStepRun()'s `update_step_runs(where: {...})` GraphQL mutation
// into: a single UPDATE with status='paused' AND approved_at IS NULL in the
// WHERE clause. We can't start a real Hasura server in this environment, so
// this proves the underlying Postgres-level guarantee directly against a
// real table with the same relevant columns/constraints as step_runs.
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/testdb' });

const STEP_RUN_ID = '22222222-2222-2222-2222-222222222222';

async function tryApprove(userId) {
  const sql = `
    UPDATE step_runs_test
    SET approved_by = $2, approved_at = now(), status = 'completed'
    WHERE id = $1 AND status = 'paused' AND approved_at IS NULL
    RETURNING id;
  `;
  const result = await pool.query(sql, [STEP_RUN_ID, userId]);
  return result.rowCount === 1;
}

async function main() {
  // Reset fixture so this test is idempotent across repeated runs.
  await pool.query(
    `UPDATE step_runs_test SET status='paused', approved_by=NULL, approved_at=NULL WHERE id=$1`,
    [STEP_RUN_ID]
  );

  const CONCURRENCY = 10;
  const fakeUserIds = Array.from({ length: CONCURRENCY }, (_, i) =>
    `00000000-0000-0000-0000-00000000000${i}`
  );

  const results = await Promise.all(fakeUserIds.map((uid) => tryApprove(uid)));
  const wins = results.filter(Boolean).length;

  console.log(`Fired ${CONCURRENCY} concurrent "approve" attempts at the same paused step_run`);
  console.log(`Successful (rowCount===1) approvals: ${wins}`);

  const row = await pool.query('SELECT status, approved_by, approved_at FROM step_runs_test WHERE id=$1', [STEP_RUN_ID]);
  console.log('Final row state:', row.rows[0]);

  const pass = wins === 1 && row.rows[0].status === 'completed' && row.rows[0].approved_by !== null;
  console.log(pass ? 'PASS: exactly one request approved the step; no double-approval' : 'FAIL');

  await pool.end();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('Test threw:', err);
  process.exit(1);
});
