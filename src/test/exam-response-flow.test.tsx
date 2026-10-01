import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExamInProgress from '@/pages/ExamInProgress';
const fixture = vi.hoisted(() => ({ existing: [] as any[], writes: [] as any[], calls: [] as string[], fail: false, text: 'The sugar is [ BLANK ].' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
        auth: { getUser: async () => ({ data: { user: { id: 'student' } }, error: null }), getSession: async () => ({ data: { session: null } }) },
        from(table: string) { const q: any = {}; for (const k of ['select', 'eq', 'ilike', 'single', 'maybeSingle', 'order'])
            q[k] = () => q; q.then = (resolve: any) => Promise.resolve({ data: table === 'exams' ? { subject_id: 'Biology', title: 'Response test' } : null, error: null }).then(resolve); return q; },
        functions: { invoke: async (name: string, args: any) => {
                fixture.calls.push(name);
                if (name === 'get-exam-questions')
                    return { data: { questions: [{ id: 'q1', question_number: '1', question_type: 'written', question_text: fixture.text, marks: 1 }], existingAnswers: fixture.existing, submission: { status: 'in_progress' }, isTeacher: false, timer: null }, error: null };
                if (name === 'submit-student-answer') {
                    fixture.writes.push(args.body);
                    if (fixture.fail)
                        return { data: null, error: new Error('network') };
                    fixture.existing = [{ question_id: 'q1', answer_text: args.body.answerText }];
                }
                return { data: { success: true }, error: null };
            } }
    } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.stubGlobal('ResizeObserver', class {
    observe() { }
    unobserve() { }
    disconnect() { }
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
const open = () => render(<MemoryRouter initialEntries={['/exam/exam1']}><Routes><Route path="/exam/:examId" element={<ExamInProgress />}/><Route path="/exam/:examId/review" element={<div>Exam review</div>}/><Route path="/my-exams" element={<div>My exams</div>}/></Routes></MemoryRouter>);
afterEach(() => { cleanup(); fixture.existing = []; fixture.writes = []; fixture.fail = false; fixture.calls = []; fixture.text = 'The sugar is [ BLANK ].'; sessionStorage.clear(); });
it('hydrates an existing inline blank into its input and saves the newest typed value', async () => {
    fixture.existing = [{ question_id: 'q1', answer_text: '{"blank_0":"starch"}' }];
    open();
    const input = await screen.findByDisplayValue('starch');
    fireEvent.change(input, { target: { value: 'glucose' } });
    await waitFor(() => expect(fixture.writes.at(-1)?.answerText).toBe('{"blank_0":"glucose"}'), { timeout: 2500 });
    expect(sessionStorage.getItem('exam:exam1:user:student:draft:q1')).toBeNull();
});
it('keeps a full scoped blank draft on save failure and restores it after reload', async () => {
    fixture.fail = true;
    const view = open();
    const input = await screen.findByPlaceholderText('answer');
    fireEvent.change(input, { target: { value: 'glucose' } });
    const cached = sessionStorage.getItem('exam:exam1:user:student:draft:q1');
    expect(JSON.parse(cached!).draft.blanks).toEqual({ blank_0: 'glucose' });
    await waitFor(() => expect(fixture.writes.length).toBeGreaterThan(0), { timeout: 2500 });
    view.unmount();
    fixture.fail = false;
    open();
    expect(await screen.findByDisplayValue('glucose')).toBeTruthy();
});
it('submits a just-edited blank even before its debounce fires', async () => {
    open();
    fireEvent.change(await screen.findByPlaceholderText('answer'), { target: { value: 'glucose' } });
    const buttons = screen.getAllByRole('button', { name: /Submit exam/i });
    fireEvent.click(buttons[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Yes, submit|Submit now|Submit exam/i }));
    await waitFor(() => expect(fixture.writes.some(x => x.answerText === '{"blank_0":"glucose"}')).toBe(true));
});
it('saves a clicked grid cell from the current state and retains clearing it', async () => {
    fixture.text = 'Tick every correct cell.\n| Property | Glycogen | Sucrose | DNA |\n|---|---|---|---|\n| Contains glucose | | | |';
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Contains glucose - Glycogen: not selected' }));
    await waitFor(() => expect(fixture.writes.at(-1)?.answerText).toBe('{"_type":"table_grid","answers":{"contains_glucose":[1]}}'), { timeout: 2500 });
    fireEvent.click(screen.getByRole('button', { name: 'Contains glucose - Glycogen: selected' }));
    await waitFor(() => expect(fixture.writes.at(-1)?.answerText).toBe('{"_type":"table_grid","answers":{"contains_glucose":[]}}'), { timeout: 2500 });
});
it('does not begin marking when a just-edited response fails to save', async () => {
    fixture.fail = true;
    open();
    fireEvent.change(await screen.findByPlaceholderText('answer'), { target: { value: 'glucose' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Submit exam/i })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Submit exam/i }));
    await waitFor(() => expect(fixture.writes.length).toBeGreaterThan(0));
    expect(fixture.calls).not.toContain('submit-exam');
    expect(JSON.parse(sessionStorage.getItem('exam:exam1:user:student:draft:q1')!).draft.blanks.blank_0).toBe('glucose');
});
it('does not restore a different user local draft', async () => {
    sessionStorage.setItem('exam:exam1:user:student:draft:q1', JSON.stringify({ version: 1, examId: 'exam1', ownerId: 'another-user', draft: { version: 1, blanks: { blank_0: 'private' } } }));
    open();
    expect(await screen.findByPlaceholderText('answer')).toHaveValue('');
});
it('retains a text answer when a blur save fails without an unhandled rejection', async () => {
    fixture.fail = true;
    fixture.text = 'State the function of a ribosome.';
    open();
    const input = await screen.findByPlaceholderText('Type your answer here…');
    fireEvent.change(input, { target: { value: 'Protein synthesis' } });
    fireEvent.blur(input);
    await waitFor(() => expect(fixture.writes.length).toBeGreaterThan(0));
    expect(input).toHaveValue('Protein synthesis');
    expect(JSON.parse(sessionStorage.getItem('exam:exam1:user:student:draft:q1')!).draft.text.finalAnswer).toBe('Protein synthesis');
    expect(fixture.calls).not.toContain('submit-exam');
});
