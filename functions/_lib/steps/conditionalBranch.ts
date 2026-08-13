import type { StepExecutionContext, StepExecutionResult } from '../types';

// Config contract (deliberately simple, per the spec):
// {
//   "if_output_contains": "string to search for in the previous step's output",
//   "on_true_step_order": number — step_order to jump to if the string is found,
//   "on_false_step_order": number — step_order to jump to otherwise
// }
//
// The previous step's output is stringified (if it isn't already a string)
// and checked for the substring. This is enough to let an llm_call's output
// (e.g. "YES" / "NO") actually steer execution, without building a real
// expression language.
export async function executeConditionalBranch(
  ctx: StepExecutionContext
): Promise<StepExecutionResult> {
  const config = ctx.step.config || {};

  if (typeof config.if_output_contains !== 'string') {
    return { status: 'failed', error: 'conditional_branch config.if_output_contains is required' };
  }
  if (typeof config.on_true_step_order !== 'number' || typeof config.on_false_step_order !== 'number') {
    return {
      status: 'failed',
      error: 'conditional_branch requires numeric config.on_true_step_order and config.on_false_step_order',
    };
  }

  const haystack =
    typeof ctx.previousOutput === 'string'
      ? ctx.previousOutput
      : JSON.stringify(ctx.previousOutput ?? '');

  const matched = haystack.includes(config.if_output_contains);
  const nextStepOrder = matched ? config.on_true_step_order : config.on_false_step_order;

  return {
    status: 'completed',
    output: { matched, evaluated_against: haystack, next_step_order: nextStepOrder },
    nextStepOrder,
  };
}
