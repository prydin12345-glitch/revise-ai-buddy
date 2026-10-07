import { salvageTruncatedQuestions } from './guided-batching.ts';

// Transport adaptation only. The saved plan, tasks, keys, scope and resources
// still pass their existing gates. Never invent rows or flatten parent groups.
export class GenerationResponseError extends Error {
  constructor(public readonly code: string, public readonly detail: string, public readonly terminal = false) {
    super(`${code}: ${detail}`);
    this.name = 'GenerationResponseError';
  }
}

const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  record(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export interface GenerationEnvelope {
  questions: Record<string, any>[];
  [field: string]: any;
}

export function generationEnvelope(value: unknown): GenerationEnvelope {
  const envelope = record(value) ? value : {};
  const arrays = Array.isArray(value) ? [value]
    : ['questions', 'parts'].filter(key => Object.hasOwn(envelope, key)).map(key => envelope[key]);
  if (!arrays.length || arrays.some(rows => !Array.isArray(rows))) {
    throw new GenerationResponseError('invalid_question_envelope', 'Expected a questions array, parts array or top-level array.');
  }
  if (arrays.some(rows => stable(rows) !== stable(arrays[0]))) {
    throw new GenerationResponseError('conflicting_question_arrays', 'Questions and parts contain different rows; no array was selected.');
  }
  const questions = arrays[0];
  if (!questions.length) throw new GenerationResponseError('empty_question_array', 'The provider returned no question rows.');
  if (questions.some((row: unknown) => !record(row))) {
    throw new GenerationResponseError('invalid_question_rows', 'Each question row must be an object.');
  }
  return {...envelope, questions};
}

/** Only complete objects in an explicitly truncated question array survive. */
export function parseGenerationContent(content: unknown, finishReason: unknown): GenerationEnvelope {
  if (typeof content !== 'string' || !content.trim()) {
    throw new GenerationResponseError('empty_provider_content', 'The provider returned no question content.');
  }
  const body = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch {
    if (finishReason !== 'length') {
      throw new GenerationResponseError('invalid_provider_json', 'The question response was not valid JSON.');
    }
    const questions = salvageTruncatedQuestions(body);
    if (!questions.length) {
      throw new GenerationResponseError('truncated_before_first_question', 'The output limit was reached before a complete question arrived.');
    }
    return generationEnvelope({questions});
  }
  return generationEnvelope(parsed);
}

export function providerHttpError(status: number, model: string): GenerationResponseError {
  const reasons: Record<number, string> = {
    401: 'The AI gateway rejected its server credential; check the Edge Function AI credential configuration.',
    402: 'The AI gateway requires credits/payment; check the Lovable AI balance.',
    403: 'The AI gateway denied access; check the provider permission configuration.',
    429: 'The AI gateway rate limit was reached; wait before retrying.',
  };
  return new GenerationResponseError('provider_http_error', `${model} returned HTTP ${status}. ${reasons[status] ?? 'The AI gateway request failed.'}`,
    Object.hasOwn(reasons, status));
}

export function generationFailureDetail(error: unknown): string {
  return error instanceof GenerationResponseError ? error.message
    : 'provider_transport_error: The AI provider request could not complete.';
}
