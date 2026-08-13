import { interpolate } from '../interpolate';
import { callLLM } from '../providers/llm';
import { withOneRetry } from '../retry';
import type { StepExecutionContext, StepExecutionResult } from '../types';

// Config contract:
// {
//   "prompt": "string, required. May contain {{previous_output}}",
//   "model": "string, optional — defaults to GROQ_DEFAULT_MODEL",
//   "system": "string, optional system prompt",
//   "temperature": number optional,
//   "max_tokens": number optional
// }
export async function executeLlmCall(ctx: StepExecutionContext): Promise<StepExecutionResult> {
  const config = ctx.step.config || {};
  if (!config.prompt || typeof config.prompt !== 'string') {
    return { status: 'failed', error: 'llm_call step config.prompt is required and must be a string' };
  }

  const prompt = interpolate(config.prompt, ctx.previousOutput);
  const system = config.system ? interpolate(config.system, ctx.previousOutput) : undefined;

  const outcome = await withOneRetry(() =>
    callLLM({
      prompt,
      system,
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    })
  );

  if (outcome.error) {
    return { status: 'failed', error: outcome.error, attemptCount: outcome.attemptCount };
  }

  return {
    status: 'completed',
    output: { text: outcome.result!.text },
    attemptCount: outcome.attemptCount,
  };
}
