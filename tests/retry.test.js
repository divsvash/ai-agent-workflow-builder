const { withOneRetry } = require('../dist/_lib/retry');

async function scenario1_firstFailsSecondSucceeds() {
  let calls = 0;
  const outcome = await withOneRetry(async () => {
    calls++;
    if (calls === 1) throw new Error('transient failure');
    return 'ok';
  });
  const pass = calls === 2 && outcome.attemptCount === 2 && outcome.result === 'ok' && outcome.error === undefined;
  console.log(`Scenario: first attempt fails, retry succeeds -> calls=${calls}, attemptCount=${outcome.attemptCount}, result=${outcome.result}`);
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenario2_bothFail() {
  let calls = 0;
  const outcome = await withOneRetry(async () => {
    calls++;
    throw new Error(`failure #${calls}`);
  });
  const pass = calls === 2 && outcome.attemptCount === 2 && outcome.error === 'failure #2' && outcome.result === undefined;
  console.log(`Scenario: both attempts fail -> calls=${calls}, attemptCount=${outcome.attemptCount}, error="${outcome.error}"`);
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenario3_firstAttemptSucceeds_noRetryNeeded() {
  let calls = 0;
  const outcome = await withOneRetry(async () => {
    calls++;
    return 'immediate-ok';
  });
  const pass = calls === 1 && outcome.attemptCount === 1 && outcome.result === 'immediate-ok';
  console.log(`Scenario: first attempt succeeds -> calls=${calls}, attemptCount=${outcome.attemptCount}`);
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenario4_delayIsApplied() {
  const start = Date.now();
  await withOneRetry(async () => {
    throw new Error('always fails');
  });
  const elapsed = Date.now() - start;
  // Expect at least the ~750ms backoff between attempt 1 and attempt 2.
  const pass = elapsed >= 700;
  console.log(`Scenario: backoff delay between attempts -> elapsed=${elapsed}ms`);
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function main() {
  const results = await Promise.all([
    scenario1_firstFailsSecondSucceeds(),
    scenario2_bothFail(),
    scenario3_firstAttemptSucceeds_noRetryNeeded(),
    scenario4_delayIsApplied(),
  ]);
  const allPass = results.every(Boolean);
  process.exit(allPass ? 0 : 1);
}

main();
