const { executeConditionalBranch } = require('../dist/_lib/steps/conditionalBranch');

async function scenarioMatches() {
  // Simulates the output shape llmCall.ts actually produces: { text: "..." }
  const previousOutput = { text: 'Based on the review, my answer is YES, approve it.' };

  const ctx = {
    workflowRunId: 'run-1',
    step: {
      id: 'step-1',
      workflow_id: 'wf-1',
      step_order: 3,
      type: 'conditional_branch',
      config: {
        if_output_contains: 'YES',
        on_true_step_order: 4,
        on_false_step_order: 5,
      },
    },
    previousOutput,
    callerRole: 'editor',
  };

  const result = await executeConditionalBranch(ctx);
  console.log('Matches case ->', result);
  const pass = result.status === 'completed' && result.nextStepOrder === 4 && result.output.matched === true;
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenarioNoMatch() {
  const previousOutput = { text: 'Based on the review, my answer is NO, reject it.' };

  const ctx = {
    workflowRunId: 'run-1',
    step: {
      id: 'step-1',
      workflow_id: 'wf-1',
      step_order: 3,
      type: 'conditional_branch',
      config: {
        if_output_contains: 'YES',
        on_true_step_order: 4,
        on_false_step_order: 5,
      },
    },
    previousOutput,
    callerRole: 'editor',
  };

  const result = await executeConditionalBranch(ctx);
  console.log('No-match case ->', result);
  const pass = result.status === 'completed' && result.nextStepOrder === 5 && result.output.matched === false;
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenarioMissingConfig() {
  const ctx = {
    workflowRunId: 'run-1',
    step: { id: 'step-1', workflow_id: 'wf-1', step_order: 3, type: 'conditional_branch', config: {} },
    previousOutput: { text: 'YES' },
    callerRole: 'editor',
  };
  const result = await executeConditionalBranch(ctx);
  console.log('Missing config case ->', result);
  const pass = result.status === 'failed';
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function main() {
  const results = await Promise.all([scenarioMatches(), scenarioNoMatch(), scenarioMissingConfig()]);
  process.exit(results.every(Boolean) ? 0 : 1);
}

main();
