process.env.ACTION_SECRET = 'test-secret';
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/webhook';

const handler = require('../dist/notifyEventHandler').default;

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

async function scenarioIgnoresNonNotificationRow() {
  const req = {
    headers: { 'x-action-secret': 'test-secret' },
    body: {
      event: {
        op: 'INSERT',
        data: {
          old: null,
          new: {
            id: 'out-1',
            workflow_run_id: 'run-1',
            workflow_step_id: 'step-1',
            key: 'some_db_write_key', // NOT "notification"
            value: { foo: 'bar' },
            created_at: new Date().toISOString(),
          },
        },
      },
      table: { schema: 'public', name: 'workflow_outputs' },
      trigger: { name: 'workflow_outputs_notify' },
    },
  };

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true };
  };

  const res = makeRes();
  await handler(req, res);

  console.log('Non-notification row ->', res.statusCode, res.body, 'fetchCalled=', fetchCalled);
  const pass = res.statusCode === 200 && res.body.skipped === true && fetchCalled === false;
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenarioDeliversNotificationRow() {
  const req = {
    headers: { 'x-action-secret': 'test-secret' },
    body: {
      event: {
        op: 'INSERT',
        data: {
          old: null,
          new: {
            id: 'out-2',
            workflow_run_id: 'run-1',
            workflow_step_id: 'step-2',
            key: 'notification',
            value: { message: 'Approval needed', channel: 'ops' },
            created_at: new Date().toISOString(),
          },
        },
      },
      table: { schema: 'public', name: 'workflow_outputs' },
      trigger: { name: 'workflow_outputs_notify' },
    },
  };

  let capturedUrl = null;
  let capturedBody = null;
  global.fetch = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return { ok: true };
  };

  const res = makeRes();
  await handler(req, res);

  console.log('Notification row -> status', res.statusCode, res.body);
  console.log('Slack call ->', capturedUrl, capturedBody);

  const pass =
    res.statusCode === 200 &&
    res.body.delivered === true &&
    capturedUrl === 'https://hooks.slack.test/webhook' &&
    capturedBody.text === '[ops] Approval needed';
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function scenarioRejectsWrongActionSecret() {
  const req = {
    headers: { 'x-action-secret': 'WRONG' },
    body: {},
  };
  const res = makeRes();
  await handler(req, res);
  console.log('Wrong secret ->', res.statusCode, res.body);
  const pass = res.statusCode === 401;
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

async function main() {
  const results = [];
  results.push(await scenarioRejectsWrongActionSecret());
  results.push(await scenarioIgnoresNonNotificationRow());
  results.push(await scenarioDeliversNotificationRow());
  process.exit(results.every(Boolean) ? 0 : 1);
}

main();
