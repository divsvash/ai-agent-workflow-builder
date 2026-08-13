// Deliberately NOT a generalized retry framework: the assignment asks for
// "at least one retry" with a "short delay/backoff" for external calls only
// (llm_call, http_request). This is hardcoded to that shape and used only by
// those two step executors.

export interface RetryOutcome<T> {
  result?: T;
  error?: string;
  attemptCount: number;
}

const MAX_ATTEMPTS = 2; // 1 initial attempt + 1 retry
const RETRY_DELAY_MS = 750;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withOneRetry<T>(fn: () => Promise<T>): Promise<RetryOutcome<T>> {
  let attemptCount = 0;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attemptCount = attempt;
    try {
      const result = await fn();
      return { result, attemptCount };
    } catch (err: any) {
      lastError = err?.message ? String(err.message) : String(err);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  return { error: lastError, attemptCount };
}
