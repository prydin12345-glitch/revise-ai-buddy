// @vitest-environment node
import { it, expect } from 'vitest';
import { build } from 'esbuild';
import vm from 'node:vm';
import { handleResponseDraft, installResponseContract, requireLegacyResponsePath } from '../functions/_shared/response-foundation';
import { responseFixture, responseQuestion as q, responseParent as p, responseUser as u, responseContractId as c, requestId } from './response-foundation-fixtures';
function clientMock(options: {
    foreign?: boolean;
    missingQuestion?: boolean;
    readError?: boolean;
    saveError?: boolean;
    conflict?: boolean;
    stored?: any;
} = {}) {
    const queries: any[] = [], writes: any[] = [], rpcCalls: any[] = [];
    const f = responseFixture();
    const client = { auth: { getUser: async () => ({ data: { user: { id: u } }, error: null }) }, from(table: string) {
            let op = 'select';
            const filters: any = {};
            let projection = '';
            const query: any = {};
            for (const method of ['select', 'eq', 'in', 'maybeSingle', 'single', 'insert'])
                query[method] = (...args: any[]) => { if (method === 'select')
                    projection = args[0]; if (method === 'eq' || method === 'in')
                    filters[args[0]] = args[1]; if (method === 'insert') {
                    op = 'insert';
                    writes.push({ table, value: args[0] });
                } return query; };
            query.then = (resolve: any, reject: any) => {
                queries.push({ table, filters, projection });
                let data: any = null, error: any = null;
                if (table === 'practice_question_sets')
                    data = options.foreign ? null : { id: p };
                if (table === 'exam_questions' || table === 'practice_questions')
                    data = options.missingQuestion ? null : { id: q, marks: 2 };
                if (table === 'question_response_contracts')
                    data = filters.exam_question_id instanceof Array || filters.practice_question_id instanceof Array ? [{ id: c }] : op === 'insert' ? { id: c } : { id: c, definition: f.definition, marking_key: f.key };
                if (table === 'question_response_drafts')
                    data = options.stored ?? null;
                if (options.readError)
                    error = { message: 'db' };
                return Promise.resolve({ data, error }).then(resolve, reject);
            };
            return query;
        }, rpc: async (name: string, args: any) => { rpcCalls.push({ name, args }); if (name === 'exam_access_info')
            return { data: { hasAccess: !options.foreign }, error: null }; return { data: options.conflict ? { conflict: true, revision: 4 } : { revision: 1, response: args.p_response }, error: options.saveError ? { message: 'private database detail' } : null }; } };
    return { client, queries, writes, rpcCalls, f };
}
it.each(['exam', 'practice'] as const)('projects public metadata and only the current user draft for %s', async (source) => {
    const m = clientMock({ stored: { response: responseFixture().envelope, revision: 2, updated_at: 'today' } });
    const result = await handleResponseDraft(m.client, u, { source, parentId: p, questionId: q, action: 'get', userId: 'forged' });
    expect(result).toHaveProperty('definition');
    expect(result).not.toHaveProperty('marking_key');
    expect(JSON.stringify(result)).not.toContain('expectedIds');
    expect(m.queries.find(x => x.table === 'question_response_contracts')?.projection).toBe('id,definition');
    expect(m.queries.find(x => x.table === 'question_response_drafts')?.filters.user_id).toBe(u);
});
it.each(['exam', 'practice'] as const)('refuses a foreign %s attempt before any draft lookup', async (source) => {
    const m = clientMock({ foreign: true });
    await expect(handleResponseDraft(m.client, u, { source, parentId: p, questionId: q, action: 'get' })).rejects.toMatchObject({ status: 403 });
    expect(m.queries.some(x => x.table === 'question_response_drafts')).toBe(false);
});
it('requires the question to belong to the supplied parent', async () => {
    const m = clientMock({ missingQuestion: true });
    await expect(handleResponseDraft(m.client, u, { source: 'exam', parentId: p, questionId: q, action: 'get' })).rejects.toMatchObject({ status: 404 });
    expect(m.queries.find(x => x.table === 'exam_questions')?.filters).toEqual({ id: q, exam_id: p });
});
it('validates a save before RPC and ignores client-supplied user/score/key fields', async () => {
    const m = clientMock();
    const body = { source: 'exam', parentId: p, questionId: q, action: 'save', requestId, expectedRevision: 0, response: m.f.envelope, score: 999, userId: 'forged', marking_key: 'forged' };
    await handleResponseDraft(m.client, u, body);
    const call = m.rpcCalls.find(x => x.name === 'save_question_response_draft');
    expect(call.args.p_user_id).toBe(u);
    expect(call.args).not.toHaveProperty('score');
    expect(call.args.p_response).toEqual(m.f.envelope);
    (body.response.value as any).selectedIds = ['a', 'b', 'c'];
    await expect(handleResponseDraft(m.client, u, body)).rejects.toMatchObject({ status: 400 });
    expect(m.rpcCalls.filter(x => x.name === 'save_question_response_draft')).toHaveLength(1);
});
it.each([{ readError: true }, { saveError: true }, { conflict: true }])('fails closed when persistence cannot be verified: %j', async (options) => {
    const m = clientMock(options);
    await expect(handleResponseDraft(m.client, u, { source: 'exam', parentId: p, questionId: q, action: 'save', expectedRevision: 0, requestId, response: m.f.envelope })).rejects.toThrow();
});
it('validates private marking coverage before storing any contract', async () => {
    const m = clientMock();
    m.f.key.units[0].marks = 1;
    await expect(installResponseContract(m.client, { source: 'exam', parentId: p, questionId: q }, m.f.definition, m.f.key)).rejects.toThrow(/coverage/);
    expect(m.writes).toHaveLength(0);
    m.f.key.units[0].marks = 2;
    expect(await installResponseContract(m.client, { source: 'exam', parentId: p, questionId: q }, m.f.definition, m.f.key)).toBe(c);
    expect(m.writes[0].value).toHaveProperty('marking_key');
});
it('blocks legacy rendering/marking for a new contract until Batch 2', async () => {
    await expect(requireLegacyResponsePath(clientMock().client, 'exam', [q])).rejects.toMatchObject({ status: 409 });
    await expect(requireLegacyResponsePath(clientMock({ readError: true }).client, 'practice', [q])).rejects.toMatchObject({ status: 503 });
});
it('the real Edge handler authenticates and returns only the public draft response', async () => {
    const m = clientMock();
    let handler: any;
    const built = await build({ entryPoints: ['supabase/functions/question-response/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'runtime', setup(b) { b.onResolve({ filter: /^https:\/\// }, a => ({ path: a.path, namespace: 'runtime' })); b.onLoad({ filter: /.*/, namespace: 'runtime' }, a => ({ contents: a.path.includes('supabase-js') ? 'export const createClient=()=>globalThis.client;' : 'export const serve=h=>globalThis.capture(h);', loader: 'js' })); } }] });
    const context = { client: m.client, capture: (h: any) => handler = h, Deno: { env: { get: () => '' } }, Response, Request, TextEncoder, console };
    vm.runInNewContext(built.outputFiles[0].text, context);
    const req = () => new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify({ source: 'exam', parentId: p, questionId: q, action: 'get' }) });
    const response = await handler(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ definition: m.f.definition, response: null, revision: 0, updatedAt: null });
    m.client.auth.getUser = async () => ({ data: { user: null as any }, error: null });
    expect((await handler(req())).status).toBe(401);
    expect((await handler(new Request('https://example.test', { method: 'GET' }))).status).toBe(405);
});
