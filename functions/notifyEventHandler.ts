import { env } from './_lib/env';
import { verifyActionSecret } from './_lib/http';
import type { FunctionRequest, FunctionResponse, HasuraEventPayload } from './_lib/types';

interface WorkflowOutputRow {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  key: string;
  value: any;
  created_at: string;
}

// Hasura Event Trigger webhook: fires on every INSERT into workflow_outputs.
// This is the ENTIRE notify implementation's external side effect — the
// notify step executor (functions/_lib/steps/notify.ts) only inserts a row;
// this handler is what actually reaches out to Slack.
//
// notify step -> workflow_outputs INSERT -> Hasura Event Trigger -> this handler -> Slack
export default async function handler(req: FunctionRequest, res: FunctionResponse) {
  // Same shared-secret check as the Action handlers — the event trigger is
  // configured with the same x-action-secret header.
  if (!verifyActionSecret(req)) {
    res.status(401).json({ message: 'Invalid action secret' });
    return;
  }

  const payload = req.body as HasuraEventPayload<WorkflowOutputRow>;
  const row = payload?.event?.data?.new;

  if (!row) {
    // Not an INSERT with a new row (shouldn't happen for this trigger's
    // config, but don't error Hasura's delivery over it).
    res.status(200).json({ skipped: true, reason: 'no row data' });
    return;
  }

  // Only process notify-step rows; workflow_outputs also receives db_write
  // rows and this same table/event trigger sees all of them.
  if (row.key !== 'notification') {
    res.status(200).json({ skipped: true, reason: 'not a notification row' });
    return;
  }

  const message: string = row.value?.message ?? '(no message)';
  const channel: string | null = row.value?.channel ?? null;

  const slackWebhookUrl = env.slackWebhookUrl();
  if (!slackWebhookUrl) {
    console.log(`[notify] SLACK_WEBHOOK_URL not configured; skipping delivery. message="${message}"`);
    res.status(200).json({ skipped: true, reason: 'SLACK_WEBHOOK_URL not configured' });
    return;
  }

  try {
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: channel ? `[${channel}] ${message}` : message,
      }),
    });

    if (!slackResponse.ok) {
      const bodyText = await slackResponse.text().catch(() => '');
      console.error(`[notify] Slack delivery failed (${slackResponse.status}): ${bodyText}`);
      // Non-200 so Hasura's event-trigger retry policy (configured in
      // metadata) retries delivery.
      res.status(500).json({ message: `Slack delivery failed: ${slackResponse.status}` });
      return;
    }

    res.status(200).json({ delivered: true });
  } catch (err: any) {
    console.error('[notify] Slack delivery threw:', err);
    res.status(500).json({ message: `Slack delivery error: ${err?.message ?? String(err)}` });
  }
}
