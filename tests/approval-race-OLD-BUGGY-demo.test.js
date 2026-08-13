// Simulates the ORIGINAL buggy approveStep flow: read-then-check in the app
// layer, then an UNCONDITIONAL update_step_runs_by_pk write (no WHERE
// guarding status/approved_at). This is what the code looked like before
// the fix in this verification pass — run to confirm the bug was real.
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/testdb' });

const STEP_RUN_ID = '22222222-2222-2222-2222-222222222222';

async function buggyApprove(userId) {
  // "read" step (app-layer check-then-act, same as the old getStepRunForApproval + status check)
  const read = await pool.query('SELECT status, approved_at FROM step_runs_test WHERE id=$1', [STEP_RUN_ID]);
  if (read.rows[0].status !== 'paused' || read.rows[0].approved_at !== null) {
    return false; // would have returned 409 in the app
  }
  // small artificial delay to widen the race window, simulating real network/app latency
  await new Promise((r) => setTimeout(r, 5));
  // unconditional write by primary key — the bug
  await pool.query(
    `UPDATE step_runs_test SET approved_by=$2, approved_at=now(), status='completed' WHERE id=$1`,
    [STEP_RUN_ID, userId]
  );
  return true; // both concurrent callers get here and think they "won"
}

async function main() {
  await pool.query(
    `UPDATE step_runs_test SET status='paused', approved_by=NULL, approved_at=NULL WHERE id=$1`,
    [STEP_RUN_ID]
  );

  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => buggyApprove(`00000000-0000-0000-0000-00000000000${i}`))
  );
  const claimedWins = results.filter(Boolean).length;

  console.log(`Old pattern: ${claimedWins} of 10 concurrent callers believed they successfully approved`);
  console.log(
    claimedWins > 1
      ? 'CONFIRMED BUG (pre-fix): multiple callers would have proceeded to call runStepsFrom() concurrently'
      : 'Could not reproduce race in this run (timing-dependent) — does not mean the bug was not real'
  );

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
