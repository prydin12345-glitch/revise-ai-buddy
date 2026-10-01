// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { responseFixture, responseQuestion as q, responseParent as p, responseUser as u, responseOther as other, responseContractId as c, requestId } from './response-foundation-fixtures';
let db: PGlite;
const practiceQ = '77777777-7777-4777-8777-777777777777', practiceC = '88888888-8888-4888-8888-888888888888';
beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create table public.exams(id uuid primary key,user_id uuid);
 create table public.exam_questions(id uuid primary key,exam_id uuid references public.exams,marks integer);
 create table public.exam_submissions(exam_id uuid,student_id uuid,status text);
 create table public.student_answers(question_id uuid,score numeric);
 create table public.practice_question_sets(id uuid primary key,user_id uuid);
 create table public.practice_questions(id uuid primary key,set_id uuid references public.practice_question_sets,marks integer);
 create table public.practice_question_answers(question_id uuid,user_id uuid,score numeric);
 create function public.exam_access_info(p_exam_id uuid,p_user_id uuid) returns jsonb language sql as $$
 select jsonb_build_object('hasAccess',exists(select 1 from public.exams where id=p_exam_id and user_id=p_user_id)) $$;
 insert into auth.users values('${u}'),('${other}');
 insert into public.exams values('${p}','${u}');
 insert into public.exam_questions values('${q}','${p}',2);
 insert into public.exam_submissions values('${p}','${u}','in_progress');
 insert into public.practice_question_sets values('${p}','${u}');
 insert into public.practice_questions values('${practiceQ}','${p}',2);
 `);
    await db.exec(readFileSync('docs/pending-migrations/20261001090000_response_foundation.sql', 'utf8'));
    const { definition, key } = responseFixture();
    await db.query('insert into question_response_contracts(id,exam_question_id,definition,marking_key) values($1,$2,$3,$4)', [c, q, JSON.stringify(definition), JSON.stringify(key)]);
    await db.query('insert into question_response_contracts(id,practice_question_id,definition,marking_key) values($1,$2,$3,$4)', [practiceC, practiceQ, JSON.stringify(definition), JSON.stringify(key)]);
    await db.query('insert into student_answers values($1,null)', [q]);
    await db.query('insert into practice_question_answers values($1,$2,null)', [practiceQ, u]);
});
afterAll(async () => db?.close());
async function asRole(role: string, sql: string, args: unknown[] = []) { await db.exec('SET ROLE ' + role); try {
    return await db.query(sql, args);
}
finally {
    await db.exec('RESET ROLE');
} }
async function save(contract = c, rev = 0, rid = requestId, envelope = responseFixture().envelope, user = u) { const result = await asRole('service_role', 'select public.save_question_response_draft($1,$2,$3,$4,$5) as result', [contract, user, JSON.stringify(envelope), rev, rid]); return (result.rows[0] as any).result; }
it.each(['anon', 'authenticated'])('denies direct key/draft reads and draft RPC to %s', async (role) => {
    for (const table of ['question_response_contracts', 'question_response_drafts'])
        await expect(asRole(role, 'select * from ' + table)).rejects.toThrow(/permission denied/);
    await expect(asRole(role, 'select public.save_question_response_draft($1,$2,$3,0,$4)', [c, u, '{}', requestId])).rejects.toThrow(/permission denied/);
});
it('does not allow a client to forge a contract or draft', async () => {
    await expect(asRole('authenticated', 'insert into question_response_contracts(exam_question_id,definition,marking_key) values($1,$2,$3)', [q, '{}', '{}'])).rejects.toThrow(/permission denied/);
    await expect(asRole('authenticated', 'insert into question_response_drafts(contract_id,user_id,response,revision,last_request_id) values($1,$2,$3,1,$4)', [c, u, '{}', requestId])).rejects.toThrow(/permission denied/);
});
it('keeps the contract and its stable identifiers immutable', async () => {
    await expect(db.query("update question_response_contracts set definition=jsonb_set(definition,'{revision}','\"r2\"') where id=$1", [c])).rejects.toThrow(/immutable/);
    await expect(db.query("update question_response_contracts set marking_key=jsonb_set(marking_key,'{maxMarks}','3') where id=$1", [c])).rejects.toThrow(/immutable/);
});
it('refuses to reinterpret a question that already has student answers', async () => {
    const id = 'abababab-abab-4bab-8bab-abababababab';
    const f = responseFixture();
    await db.query('insert into exam_questions values($1,$2,2)', [id, p]);
    await db.query('insert into student_answers values($1,2)', [id]);
    await expect(db.query('insert into question_response_contracts(exam_question_id,definition,marking_key) values($1,$2,$3)', [id, JSON.stringify(f.definition), JSON.stringify(f.key)])).rejects.toThrow(/existing answers/);
    expect((await db.query('select score from student_answers where question_id=$1', [id])).rows[0]).toEqual({ score: '2' });
});
it('creates one unscored draft, replays the same request, and preserves historical score storage', async () => {
    const first = await save();
    expect(first.revision).toBe(1);
    expect(first.replayed).toBe(false);
    const replay = await save();
    expect(replay.revision).toBe(1);
    expect(replay.replayed).toBe(true);
    expect((await db.query('select count(*)::int n from question_response_drafts')).rows[0]).toEqual({ n: 1 });
    expect((await db.query('select score from student_answers where question_id=$1', [q])).rows[0]).toEqual({ score: null });
});
it('rejects reuse of a request ID with a different answer', async () => {
    const e: any = responseFixture().envelope;
    e.value.selectedIds = ['b', 'c'];
    await expect(save(c, 0, requestId, e)).rejects.toThrow(/different content/);
});
it('detects another session revision and never overwrites its newer value', async () => {
    const e: any = responseFixture().envelope;
    e.value.selectedIds = ['b', 'c'];
    const next = await save(c, 1, '99999999-9999-4999-8999-999999999999', e);
    expect(next.revision).toBe(2);
    const stale = await save(c, 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(stale).toEqual({ conflict: true, revision: 2 });
    expect((await db.query('select response from question_response_drafts where contract_id=$1', [c])).rows[0]).toEqual({ response: e });
});
it('refuses mismatched question identity and a foreign user', async () => {
    await expect(save(c, 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { ...responseFixture().envelope, questionId: practiceQ })).rejects.toThrow(/identity/);
    await expect(save(c, 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', responseFixture().envelope, other)).rejects.toThrow(/access denied/);
});
it.each(['marking', 'graded', 'submitted', 'completed'])('blocks a late save after status %s', async (status) => {
    await db.query('update exam_submissions set status=$1', [status]);
    await expect(save(c, 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow(/locked/);
    await db.query("update exam_submissions set status='in_progress'");
});
it('preserves an intentional clear instead of retaining the old answer', async () => {
    const e: any = responseFixture().envelope;
    e.value.selectedIds = [];
    const result = await save(c, 2, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', e);
    expect(result.revision).toBe(3);
    expect(result.response.value.selectedIds).toEqual([]);
});
it('applies ownership and marked-answer locks to practice drafts', async () => {
    const e = { ...responseFixture().envelope, questionId: practiceQ };
    await expect(save(practiceC, 0, requestId, e, other)).rejects.toThrow(/access denied/);
    expect((await save(practiceC, 0, requestId, e)).revision).toBe(1);
    await db.query('update practice_question_answers set score=2 where question_id=$1', [practiceQ]);
    await expect(save(practiceC, 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', e)).rejects.toThrow(/already marked/);
});
it.each(['grid', 'cloze', 'fields', 'text'] as const)('round trips %s through the actual SQL without writing grades', async (kind) => {
    const f = responseFixture(kind);
    const index = ['grid', 'cloze', 'fields', 'text'].indexOf(kind) + 10;
    const qid = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    const cid = `00000000-0000-4000-9000-${String(index).padStart(12, '0')}`;
    await db.query('insert into exam_questions values($1,$2,2)', [qid, p]);
    await db.query('insert into question_response_contracts(id,exam_question_id,definition,marking_key) values($1,$2,$3,$4)', [cid, qid, JSON.stringify(f.definition), JSON.stringify(f.key)]);
    const e = { ...f.envelope, questionId: qid };
    expect((await save(cid, 0, requestId, e)).response).toEqual(e);
});
