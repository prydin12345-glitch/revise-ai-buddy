import { ExamRequestError, requireExamAccess } from './exam-access.ts';
import { parseResponseDefinition, parsePrivateResponseKey, parseResponseEnvelope } from './response-contract.ts';
export type ResponseScope = {
    source: 'exam' | 'practice';
    parentId: string;
    questionId: string;
};
export function responseScope(v: any): ResponseScope {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!v || !['exam', 'practice'].includes(v.source) || !uuid.test(v.parentId ?? '') || !uuid.test(v.questionId ?? ''))
        throw new ExamRequestError(400, 'Invalid question scope');
    return { source: v.source, parentId: v.parentId, questionId: v.questionId };
}
async function questionAccess(client: any, s: ResponseScope, userId: string) {
    if (s.source === 'exam')
        await requireExamAccess(client, s.parentId, userId);
    else {
        const { data, error } = await client.from('practice_question_sets').select('id').eq('id', s.parentId).eq('user_id', userId).maybeSingle();
        if (error)
            throw new ExamRequestError(503, 'Practice access could not be checked');
        if (!data)
            throw new ExamRequestError(403, 'Practice access denied');
    }
    const { data, error } = await client.from(s.source === 'exam' ? 'exam_questions' : 'practice_questions').select('id,marks').eq('id', s.questionId).eq(s.source === 'exam' ? 'exam_id' : 'set_id', s.parentId).maybeSingle();
    if (error)
        throw new ExamRequestError(503, 'Question could not be checked');
    if (!data)
        throw new ExamRequestError(404, 'Question not found in this attempt');
    return data;
}
/** Service-only writer for future generation integration. No HTTP creation action. */
export async function installResponseContract(client: any, s: ResponseScope, definition: unknown, key: unknown) {
    s = responseScope(s);
    const { data: q, error } = await client.from(s.source === 'exam' ? 'exam_questions' : 'practice_questions').select('marks').eq('id', s.questionId).eq(s.source === 'exam' ? 'exam_id' : 'set_id', s.parentId).maybeSingle();
    if (error || !q)
        throw new Error('Cannot bind response contract to question');
    const parsed = parseResponseDefinition(definition), marking = parsePrivateResponseKey(key, parsed, q.marks);
    const { data, error: writeError } = await client.from('question_response_contracts').insert({ [s.source === 'exam' ? 'exam_question_id' : 'practice_question_id']: s.questionId, definition: parsed, marking_key: marking }).select('id').single();
    if (writeError || !data)
        throw new Error('Response contract could not be stored');
    return data.id as string;
}
/** Authenticated boundary. Client-supplied user IDs, keys and grades are never used. */
export async function handleResponseDraft(client: any, userId: string, body: any) {
    const s = responseScope(body);
    await questionAccess(client, s, userId);
    const { data: c, error } = await client.from('question_response_contracts').select('id,definition').eq(s.source === 'exam' ? 'exam_question_id' : 'practice_question_id', s.questionId).maybeSingle();
    if (error)
        throw new ExamRequestError(503, 'Response contract could not be loaded');
    if (!c)
        throw new ExamRequestError(404, 'No structured response contract for this question');
    const definition = parseResponseDefinition(c.definition);
    if (body.action === 'get') {
        const { data: d, error: e } = await client.from('question_response_drafts').select('response,revision,updated_at').eq('contract_id', c.id).eq('user_id', userId).maybeSingle();
        if (e)
            throw new ExamRequestError(503, 'Draft could not be loaded');
        return { definition, response: d ? parseResponseEnvelope(d.response, definition, s.questionId) : null, revision: d?.revision ?? 0, updatedAt: d?.updated_at ?? null };
    }
    if (body.action !== 'save')
        throw new ExamRequestError(400, 'Unsupported response action');
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || !/^[0-9a-f-]{36}$/i.test(body.requestId ?? ''))
        throw new ExamRequestError(400, 'Invalid save revision/request ID');
    let response;
    try {
        response = parseResponseEnvelope(body.response, definition, s.questionId);
    }
    catch (e) {
        throw new ExamRequestError(400, (e as Error).message);
    }
    const { data: result, error: saveError } = await client.rpc('save_question_response_draft', { p_contract_id: c.id, p_user_id: userId, p_response: response, p_expected_revision: body.expectedRevision, p_request_id: body.requestId });
    if (saveError)
        throw new ExamRequestError(409, 'Draft could not be saved. Reload its status before retrying.');
    if (result?.conflict)
        throw new ExamRequestError(409, 'This answer changed in another session. Reload before editing.');
    if (!result || !Number.isInteger(result.revision))
        throw new ExamRequestError(503, 'Draft save was not confirmed');
    return { revision: result.revision, response: parseResponseEnvelope(result.response, definition, s.questionId), replayed: result.replayed === true };
}
/** Batch 1 cannot mark/serve these drafts using legacy input/marking code. */
export async function requireLegacyResponsePath(client: any, source: 'exam' | 'practice', questionIds: string[]) {
    if (!questionIds.length)
        return;
    const { data, error } = await client.from('question_response_contracts').select('id').in(source === 'exam' ? 'exam_question_id' : 'practice_question_id', questionIds);
    if (error)
        throw new ExamRequestError(503, 'Response compatibility could not be checked');
    if (data?.length)
        throw new ExamRequestError(409, 'This question uses a structured response awaiting the next format update. No marking was attempted.');
}
