process.env.HASURA_GRAPHQL_ENDPOINT = 'https://fake-hasura.test/v1/graphql';
process.env.HASURA_GRAPHQL_ADMIN_SECRET = 'fake-admin-secret';
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/testdb';
// ACTION_SECRET intentionally unset for this test (verifyActionSecret no-ops).

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const WORKFLOW_ID = '33333333-3333-3333-3333-333333333333';
const REAL_SECRET = 'correct-webhook-secret';

// In-memory ledger of what admin-secret GraphQL calls were made, and canned
// responses keyed by a distinctive substring of the operation name embedded
// in each query (see functions/_lib/queries.ts — every query/mutation is
// named, e.g. "GetWebhookTrigger", "CreateWorkflowRun").
let calls = [];
let insertedOutputs = [];
let createdRun = false;

function mockFetch(url, opts) {
  const body = JSON.parse(opts.body);
  const query = body.query;
  calls.push(query.match(/(?:query|mutation)\s+(\w+)/)?.[1] ?? 'UNKNOWN');

  const respond = (data) => ({ ok: true, json: async () => ({ data }) });

  if (query.includes('GetWebhookTrigger')) {
    return respond({
      workflow_triggers: [
        { id: 'trigger-1', config: { secret: REAL_SECRET }, workflow: { org_id: ORG_ID } },
      ],
    });
  }
  if (query.includes('GetWorkflowOrgAndSteps')) {
    return respond({
      workflows_by_pk: {
        org_id: ORG_ID,
        steps: [
          {
            id: 'step-1',
            workflow_id: WORKFLOW_ID,
            step_order: 1,
            type: 'db_write',
            config: { key: 'result', value: { ok: true } },
          },
        ],
      },
    });
  }
  if (query.includes('CreateWorkflowRun')) {
    createdRun = true;
    // Assert triggered_by is null for external execution.
    if (body.variables.triggeredBy !== null) {
      throw new Error(`Expected triggered_by=null for webhook trigger, got ${body.variables.triggeredBy}`);
    }
    return respond({ insert_workflow_runs_one: { id: 'run-1' } });
  }
  if (query.includes('InsertStepRun')) {
    return respond({ insert_step_runs_one: { id: 'steprun-1' } });
  }
  if (query.includes('UpdateStepRun')) {
    return respond({ update_step_runs_by_pk: { id: 'steprun-1' } });
  }
  if (query.includes('InsertOutput')) {
    insertedOutputs.push(body.variables);
    return respond({ insert_workflow_outputs_one: { id: 'out-1' } });
  }
  if (query.includes('SetRunStatus')) {
    return respond({ update_workflow_runs_by_pk: { id: 'run-1' } });
  }

  throw new Error(`Unmocked GraphQL operation: ${query}`);
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  return res;
}

async function scenarioInvalidSecretRejected() {
  calls = [];
  createdRun = false;
  global.fetch = mockFetch;

  const handler = require('../dist/webhookTrigger').default;
  const req = { headers: {}, body: { input: { workflow_id: WORKFLOW_ID, secret: 'WRONG-SECRET' } } };
  const res = makeRes();
  await handler(req, res);

  console.log('Invalid secret ->', res.statusCode, res.body, '| createdRun =', createdRun);
  const pass = res.statusCode === 401 && createdRun === false;
  console.log(pass ? 'PASS: invalid secret rejected, no workflow_run created' : 'FAIL');
  return pass;
}

async function scenarioValidSecretConverges() {
  calls = [];
  createdRun = false;
  insertedOutputs = [];
  global.fetch = mockFetch;

  const handler = require('../dist/webhookTrigger').default;
  const req = { headers: {}, body: { input: { workflow_id: WORKFLOW_ID, secret: REAL_SECRET } } };
  const res = makeRes();
  await handler(req, res);

  console.log('Valid secret -> status', res.statusCode, 'body', res.body);
  console.log('GraphQL operations invoked, in order:', calls);
  console.log('workflow_outputs inserted:', insertedOutputs);

  const pass =
    res.statusCode === 200 &&
    res.body.status === 'completed' &&
    createdRun === true &&
    // Confirms this hit the SAME executor path as manual trigger: it went
    // through InsertStepRun/UpdateStepRun/InsertOutput, exactly like
    // triggerWorkflowRun would for the same workflow.
    calls.includes('InsertStepRun') &&
    calls.includes('InsertOutput') &&
    insertedOutputs.length === 1 &&
    insertedOutputs[0].key === 'result';

  console.log(pass ? 'PASS: valid secret runs the shared executor to completion' : 'FAIL');
  return pass;
}

async function main() {
  // Reset the real Postgres quota row before this scenario so admission succeeds.
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `UPDATE organizations SET quota_used=0, quota_limit=10, quota_period_start=date_trunc('month', now())::date WHERE id=$1`,
    [ORG_ID]
  );
  await pool.end();

  const results = [];
  results.push(await scenarioInvalidSecretRejected());
  results.push(await scenarioValidSecretConverges());

  process.exit(results.every(Boolean) ? 0 : 1);
}

main().catch((err) => {
  console.error('Test threw:', err);
  process.exit(1);
});
