import { interpolate } from '../interpolate';
import { withOneRetry } from '../retry';
import type { StepExecutionContext, StepExecutionResult } from '../types';

// Config contract:
// {
//   "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",   required
//   "url": "string",                                          required
//   "headers": { [key: string]: string },                     optional
//   "body": any (object/string, may contain {{previous_output}} tokens),  optional
// }
export async function executeHttpRequest(ctx: StepExecutionContext): Promise<StepExecutionResult> {
  const config = ctx.step.config || {};
  if (!config.method || typeof config.method !== 'string') {
    return { status: 'failed', error: 'http_request step config.method is required' };
  }
  if (!config.url || typeof config.url !== 'string') {
    return { status: 'failed', error: 'http_request step config.url is required' };
  }

  const headers = interpolate(config.headers || {}, ctx.previousOutput);
  const body = config.body !== undefined ? interpolate(config.body, ctx.previousOutput) : undefined;

  const outcome = await withOneRetry(async () => {
    const response = await fetch(config.url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseBody).slice(0, 500)}`);
    }

    return { status: response.status, body: responseBody };
  });

  if (outcome.error) {
    return { status: 'failed', error: outcome.error, attemptCount: outcome.attemptCount };
  }

  return {
    status: 'completed',
    output: outcome.result,
    attemptCount: outcome.attemptCount,
  };
}
