import { it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ResponseSaveQueue } from '@/lib/response-save-queue';
import { ResponseDraftSession } from '@/lib/response-draft-session';
import { useLegacyResponseState } from '@/hooks/useLegacyResponseState';
import { legacyDraftHasAnswer, readLegacyBlanks, readLegacyDraft } from '@/lib/legacy-response-state';
import { FillInBlankRenderer, hasFillInBlanks } from '@/components/FillInBlankRenderer';
import { responseFixture, responseQuestion, responseParent } from '../../supabase/tests/response-foundation-fixtures';
afterEach(cleanup);
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => resolve = r); return { promise, resolve }; }
it('serialises writes, coalesces newer edits, and acknowledges only the latest snapshot', async () => {
    const gate = deferred(), written: string[] = [], acked: string[] = [];
    const queue = new ResponseSaveQueue<string>(async (_id, v) => { written.push(v); if (v === 'first')
        await gate.promise; }, (_id, v) => acked.push(v));
    queue.update('q', 'first');
    const flush = queue.flush('q');
    queue.update('q', 'second');
    queue.update('q', 'latest');
    expect(written).toEqual(['first']);
    gate.resolve();
    await flush;
    expect(written).toEqual(['first', 'latest']);
    expect(acked).toEqual(['latest']);
    expect(queue.dirtyIds()).toEqual([]);
});
it('keeps failed and cleared answers dirty until a successful retry', async () => {
    let fail = true;
    const writes: string[] = [];
    const queue = new ResponseSaveQueue<string>(async (_id, v) => { if (fail)
        throw new Error('network'); writes.push(v); });
    queue.update('q', '');
    await expect(queue.flushAll()).rejects.toThrow('network');
    expect(queue.dirtyIds()).toEqual(['q']);
    fail = false;
    await queue.flushAll();
    expect(writes).toEqual(['']);
    expect(queue.dirtyIds()).toEqual([]);
});
it('waits for all queued questions before final submission, including an in-flight save', async () => {
    const gate = deferred();
    let count = 0;
    const queue = new ResponseSaveQueue<string>(async () => { await gate.promise; count++; });
    queue.update('grid', 'cells');
    const first = queue.flush('grid');
    queue.update('blank', 'word');
    let done = false;
    const final = queue.flushAll().then(() => done = true);
    await Promise.resolve();
    expect(done).toBe(false);
    gate.resolve();
    await Promise.all([first, final]);
    expect(count).toBe(2);
});
it('keeps all legacy input families in one synchronous store, even before React rerenders', () => {
    const changed = vi.fn(), { result } = renderHook(() => useLegacyResponseState(changed));
    act(() => { result.current.setBlankAnswers({ q: { blank_0: 'glucose' } }); result.current.setTableGridAnswers({ r: { polymer: [1, 3] } }); result.current.setUserAnswers({ s: { workingOut: '2+2', finalAnswer: '4' } }); });
    expect(result.current.current.current.q.blanks).toEqual({ blank_0: 'glucose' });
    expect(Object.keys(result.current.current.current)).toEqual(['q', 'r', 's']);
    expect(changed).toHaveBeenCalledTimes(3);
    act(() => result.current.setTableGridAnswers(prev => ({ ...prev, r: { polymer: [] } })));
    expect(result.current.current.current.r.grid).toEqual({ polymer: [] });
    expect(legacyDraftHasAnswer(result.current.current.current.r)).toBe(false);
});
it('round-trips blank, grid and text snapshots without converting them to prose', () => {
    const { result } = renderHook(() => useLegacyResponseState());
    const rows = { a: { version: 1 as const, blanks: { blank_0: 'glucose' } }, b: { version: 1 as const, grid: { polymer: [1, 3] } }, c: { version: 1 as const, text: { workingOut: 'method', finalAnswer: 'result' } } };
    act(() => Object.entries(rows).forEach(([id, r]) => result.current.restore(id, JSON.parse(JSON.stringify(r)))));
    expect(result.current.blankAnswers.a).toEqual({ blank_0: 'glucose' });
    expect(result.current.tableGridAnswers.b).toEqual({ polymer: [1, 3] });
    expect(result.current.userAnswers.c.finalAnswer).toBe('result');
    expect(readLegacyBlanks('{"blank_0":"glucose"}')).toEqual({ blank_0: 'glucose' });
    expect(readLegacyBlanks('{"answer":"glucose"}')).toBeNull();
    act(() => result.current.reset());
    expect(result.current.current.current).toEqual({});
});
it('detects blanks on every render and rehydrates each inline input', () => {
    const text = 'The product is [ BLANK ] and the substrate is [ BLANK ].';
    for (let i = 0; i < 6; i++)
        expect(hasFillInBlanks(text)).toBe(true);
    const change = vi.fn();
    render(<FillInBlankRenderer content={text} questionId="q" answers={{ blank_0: 'glucose', blank_1: 'starch' }} onAnswerChange={change}/>);
    expect(screen.getByDisplayValue('glucose')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('starch'), { target: { value: 'maltose' } });
    expect(change).toHaveBeenCalledWith('blank_1', 'maltose');
});
it('does not count unselected tables/empty blanks as answered, but retains numerical zero', () => {
    expect(legacyDraftHasAnswer({ version: 1, table: { x: false }, blanks: { blank_0: '' }, grid: { row: [] } })).toBe(false);
    expect(legacyDraftHasAnswer({ version: 1, blanks: { blank_0: '0' } })).toBe(true);
});
it('rejects malformed local cache values instead of handing them to inputs', () => {
    expect(readLegacyDraft({ version: 1, blanks: { blank_0: 2 } })).toBeNull();
    expect(readLegacyDraft({ version: 1, grid: { r: 'wrong' } })).toBeNull();
    expect(readLegacyDraft({ version: 1, text: { workingOut: '', finalAnswer: '4' } })).toEqual({ version: 1, text: { workingOut: '', finalAnswer: '4' } });
});
it.each(['choice', 'grid', 'cloze', 'fields', 'text'] as const)('loads, edits and saves %s through the common draft session', async (kind) => {
    const f = responseFixture(kind);
    let stored: any = null;
    let revision = 0;
    const transport = vi.fn(async (body) => body.action === 'get' ? { definition: f.definition, response: stored, revision } : { response: (stored = body.response), revision: ++revision });
    const session = new ResponseDraftSession({ source: 'exam', parentId: responseParent, questionId: responseQuestion }, transport);
    await session.load();
    session.update(f.envelope);
    await session.flush();
    expect(session.revision).toBe(1);
    expect(session.status).toBe('saved');
    const resumed = new ResponseDraftSession(session.scope, transport);
    await resumed.load();
    expect(resumed.response).toEqual(f.envelope);
    expect(resumed.completeness()).toBe('complete');
});
it('retries the exact request after an ambiguous timeout without duplicating a revision', async () => {
    const f = responseFixture();
    let attempts = 0;
    const requests: any[] = [];
    const session = new ResponseDraftSession({ source: 'practice', parentId: responseParent, questionId: responseQuestion }, async (body) => {
        if (body.action === 'get')
            return { definition: f.definition, response: null, revision: 0 };
        requests.push(body);
        if (++attempts === 1)
            throw new Error('timeout');
        return { response: body.response, revision: 1, replayed: true };
    });
    await session.load();
    session.update(f.envelope);
    await expect(session.flush()).rejects.toThrow('timeout');
    await session.flush();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(session.revision).toBe(1);
});
it('stops on a cross-session conflict while preserving the unsaved answer for reconciliation', async () => {
    const f = responseFixture();
    const session = new ResponseDraftSession({ source: 'exam', parentId: responseParent, questionId: responseQuestion }, async (body) => {
        if (body.action === 'get')
            return { definition: f.definition, response: null, revision: 0 };
        throw Object.assign(new Error('conflict'), { status: 409 });
    });
    await session.load();
    session.update(f.envelope);
    await expect(session.flush()).rejects.toThrow('conflict');
    expect(session.response).toEqual(f.envelope);
    expect(session.status).toBe('conflict');
    await expect(session.flush()).rejects.toThrow(/conflict/);
});
it('accepts a confirmed JSONB save when the database reorders field keys', async () => {
    const f = responseFixture('fields');
    const definition: any = f.definition;
    definition.fields.push({ id: 'tube_y', label: 'Tube Y', input: 'number', required: true });
    const response: any = { ...f.envelope, value: { fields: { tube_y: '2', tube_x: '0' } } };
    const session = new ResponseDraftSession({ source: 'exam', parentId: responseParent, questionId: responseQuestion }, async (body) => body.action === 'get' ? { definition, response: null, revision: 0 } : { revision: 1, response: { ...(body.response as any), value: { fields: { tube_x: '0', tube_y: '2' } } } });
    await session.load();
    session.update(response);
    await session.flush();
    expect(session.status).toBe('saved');
});
