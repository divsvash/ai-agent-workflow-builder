// Minimal, documented interpolation contract shared by llm_call and
// http_request step configs. Deliberately simple, per the spec's instruction
// that conditional_branch (and, by extension, any inter-step data passing)
// "may be deliberately simple."
//
// Contract: any string value in a step's config may contain the literal
// token "{{previous_output}}". Wherever that token appears, it is replaced
// with the previous step's output — stringified as JSON if the output is an
// object/array, or used as-is if it's already a string. Non-string config
// values are returned unchanged. This is applied recursively to strings
// nested in arrays/objects so a config like:
//   { "body": { "summary": "{{previous_output}}" } }
// works as expected.

function stringifyOutput(previousOutput: any): string {
  if (previousOutput === null || previousOutput === undefined) return '';
  if (typeof previousOutput === 'string') return previousOutput;
  try {
    return JSON.stringify(previousOutput);
  } catch {
    return String(previousOutput);
  }
}

export function interpolate(value: any, previousOutput: any): any {
  const token = '{{previous_output}}';

  if (typeof value === 'string') {
    if (!value.includes(token)) return value;
    return value.split(token).join(stringifyOutput(previousOutput));
  }

  if (Array.isArray(value)) {
    return value.map((v) => interpolate(v, previousOutput));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = interpolate(v, previousOutput);
    }
    return result;
  }

  return value;
}
