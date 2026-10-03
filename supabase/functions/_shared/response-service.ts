import { ExamRequestError, studentQuestion } from './exam-access.ts';
import { parseResponseDefinition, parsePrivateResponseKey, parseResponseEnvelope, type ResponseDefinition, type PrivateResponseKey } from './response-contract.ts';
import { responseResources } from './response-resources.ts';
import { markResponse, parseResponseResult, type RubricMarker } from './response-marking.ts';
import { responseScope } from './response-foundation.ts';

export type StoredResponseContract = { id: string; questionId: string; definition: ResponseDefinition; key: PrivateResponseKey };
export async function loadResponseContracts(client: any, source: 'exam' | 'practice', questions: any[]): Promise<Map<string, StoredResponseContract>> {
  const output = new Map<string, StoredResponseContract>();
  if (!questions.length) return output;
  const field = source === 'exam' ? 'exam_question_id' : 'practice_question_id';
  const { data, error } = await client.from('question_response_contracts').select(`id,${field},definition,marking_key`).in(field, questions.map(q => q.id));
  if (error) throw new ExamRequestError(503, 'Response definitions could not be loaded');
  for (const row of data ?? []) {
    const question = questions.find(q => q.id === row[field]);
    if (!question || output.has(question.id)) throw new Error('Response contract binding is invalid');
    const definition = parseResponseDefinition(row.definition);
    const key = parsePrivateResponseKey(row.marking_key, definition, question.marks);
    responseResources(question, definition);
    output.set(question.id, { id: row.id, questionId: question.id, definition, key });
  }
  return output;
}

/** Append explicitly projected public data; permission is decided by the caller. */
export async function projectResponseQuestions(client: any, source: 'exam' | 'practice', questions: any[], userId: string, readable: (q: any) => boolean): Promise<any[]> {
  const contracts = await loadResponseContracts(client, source, questions);
  if (!contracts.size) return questions;
  const ids = [...contracts.values()].map(c => c.id);
  const [{ data: drafts, error: draftError }, { data: results, error: resultError }] = await Promise.all([
    client.from('question_response_drafts').select('contract_id,response,revision').eq('user_id', userId).in('contract_id', ids),
    client.from('question_response_results').select('contract_id,status,response,result').eq('user_id', userId).in('contract_id', ids),
  ]);
  if (draftError || resultError) throw new ExamRequestError(503, 'Saved response state could not be loaded');
  return questions.map(question => {
    const contract = contracts.get(question.id);
    if (!contract) return question;
    const draft = drafts?.find((d: any) => d.contract_id === contract.id);
    const result = results?.find((r: any) => r.contract_id === contract.id && r.status === 'graded');
    const mayReview = readable(question) && (source === 'exam' || Boolean(result));
    return {
      ...question, correct_answer: null, worked_solution: null, rationale: null, options: null,
      response_definition: contract.definition,
      response_resources: responseResources(question, contract.definition),
      response_snapshot: { response: draft ? parseResponseEnvelope(draft.response, contract.definition, question.id) : null, revision: draft?.revision ?? 0 },
      ...(mayReview ? {
        response_key: contract.key,
        ...(result ? { response_result: parseResponseResult(result.result, contract.definition, contract.key) } : {}),
      } : {}),
    };
  });
}

/** Read-only quiz endpoint. Opening a quiz must never start model generation. */
export async function readPracticeResponses(client: any, userId: string, body: any) {
  const scope = responseScope({ source: 'practice', parentId: body.parentId, questionId: body.questionId ?? body.parentId });
  const { data: set, error } = await client.from('practice_question_sets').select('id').eq('id', scope.parentId).eq('user_id', userId).maybeSingle();
  if (error) throw new ExamRequestError(503, 'Practice access could not be checked');
  if (!set) throw new ExamRequestError(403, 'Practice access denied');
  let query = client.from('practice_questions').select('*').eq('set_id', scope.parentId);
  if (body.questionId) query = query.eq('id', scope.questionId);
  const { data: rows, error: questionError } = await query;
  if (questionError) throw new ExamRequestError(503, 'Practice questions could not be loaded');
  const { data: answers, error: answerError } = await client.from('practice_question_answers').select('question_id,score,submitted_at').eq('user_id', userId).eq('set_id', scope.parentId);
  if (answerError) throw new ExamRequestError(503, 'Practice results could not be verified');
  const released = (q: any) => answers?.some((a: any) => a.question_id === q.id && a.score !== null && a.submitted_at !== null) === true;
  // Resource/key validation needs the saved row; public projection happens last.
  const decorated = await projectResponseQuestions(client, 'practice', rows ?? [], userId, released);
  const questions = decorated.map(q => {
    const safe = released(q) ? q : { ...studentQuestion(q), set_id: q.set_id, subtopic: q.subtopic, difficulty: q.difficulty, question_number_int: q.question_number_int };
    return { ...safe, ...(q.response_definition ? {
      response_definition: q.response_definition, response_resources: q.response_resources, response_snapshot: q.response_snapshot,
      ...(q.response_key ? { response_key: q.response_key } : {}),
      ...(q.response_result ? { response_result: q.response_result } : {}),
    } : {}) };
  });
  return { questions };
}

/** Grade only the persisted, claimed practice snapshot. Browser scores/keys ignored. */
export async function gradePracticeResponse(client: any, userId: string, contract: StoredResponseContract, question: any, expectedRevision: unknown, marker: RubricMarker) {
  if (!Number.isInteger(expectedRevision) || Number(expectedRevision) < 0) throw new ExamRequestError(400, 'Save the answer before marking');
  const { data: claim, error } = await client.rpc('claim_practice_response', { p_contract_id: contract.id, p_user_id: userId, p_expected_revision: expectedRevision });
  if (error) throw new ExamRequestError(409, 'The saved answer changed or could not be locked. Reload before marking.');
  if (claim?.state === 'graded') return parseResponseResult(claim.result, contract.definition, contract.key);
  if (claim?.state !== 'claimed') throw new ExamRequestError(409, 'This answer is already being marked. Check its status before retrying.');
  try {
    const result = await markResponse({ questionId: question.id, marks: question.marks, definition: contract.definition, key: contract.key, response: claim.response }, marker);
    const { data: committed, error: saveError } = await client.rpc('finish_practice_response', { p_contract_id: contract.id, p_user_id: userId, p_token: claim.token, p_result: result });
    if (saveError || !committed) throw new Error('Marking result could not be saved');
    return parseResponseResult(committed, contract.definition, contract.key);
  } catch (error) {
    await client.rpc('fail_practice_response', { p_contract_id: contract.id, p_user_id: userId, p_token: claim.token });
    throw error;
  }
}
