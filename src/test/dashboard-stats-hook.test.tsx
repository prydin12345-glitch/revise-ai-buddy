import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatsDrilldown } from '@/hooks/useStatsDrilldown';
import { dateKey, initialStudyPeriod } from '@/lib/dashboard-stats';

interface Call { table: string; steps: unknown[][]; signal?: AbortSignal }
const fixture = vi.hoisted(() => ({ owner: 'user-a', authOwner: 'user-a', calls: [] as Call[], fail: '', delayed: null as null | Promise<unknown>, rows: {} as Record<string, unknown> }));
vi.mock('@/hooks/use-workspace-session', () => ({ useWorkspaceSession: () => ({ ownerId: fixture.owner, ready: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: fixture.authOwner } }, error: null }) },
  from(table: string) {
    const call: Call = { table, steps: [] }; fixture.calls.push(call);
    const delayed = fixture.delayed;
    let single = false;
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'not', 'order', 'range', 'throwOnError']) query[method] = (...args: unknown[]) => { call.steps.push([method, ...args]); return query; };
    query.abortSignal = (signal: AbortSignal) => { call.signal = signal; return query; };
    query.maybeSingle = () => { single = true; return query; };
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const error = fixture.fail === table ? { message: 'Backend fixture error' } : null;
      const data = fixture.rows[table] ?? (single ? null : []);
      return (delayed ?? Promise.resolve({ data, error })).then(resolve, reject);
    };
    return query;
  },
} }));

const now = new Date(2026, 9, 14, 12);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  fixture.owner = fixture.authOwner = 'user-a'; fixture.calls = []; fixture.fail = ''; fixture.delayed = null; fixture.rows = {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('stats drawer request lifecycle', () => {
  it('makes no activity request while closed, and scopes every read to its authenticated owner', async () => {
    const { result } = renderHook(useStatsDrilldown);
    expect(fixture.calls).toEqual([]);
    act(() => result.current.openDrawer('study-hours'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fixture.calls.map(call => call.table)).toEqual(['exam_submission_metadata', 'practice_set_progress', 'revision_tasks']);
    fixture.calls.forEach(call => {
      expect(call.steps).toContainEqual(['eq', call.table === 'exam_submission_metadata' ? 'student_id' : 'user_id', 'user-a']);
      expect(call.steps).toContainEqual(['range', 0, 499]);
      expect(call.signal).toBeInstanceOf(AbortSignal);
    });
    expect(fixture.calls.some(call => call.table === 'question_feedback_threads')).toBe(false);
  });
  it('uses protected metadata and never includes failed marking in score averages', async () => {
    const base = { id: 's', exam_id: 'e', submitted_at: '2026-10-14T09:00:00', status: 'graded', total_score: 50, total_marks: 100, exams: { title: 'Paper', subject_id: 'Biology', grade_released: true } };
    fixture.rows.exam_submission_metadata = [base, { ...base, id: 'failed', status: 'marking_failed', total_score: 0 }];
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('scores'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scoreBreakdown).toHaveLength(1);
    expect(result.current.scoreBreakdown[0].score).toBe(50);
    expect(result.current.excludedCount).toBe(1);
    expect(fixture.calls[0].table).toBe('exam_submission_metadata');
  });
  it('requeries the actual historical month, with full local boundaries and completed tasks only', async () => {
    const { result } = renderHook(useStatsDrilldown);
    act(() => { result.current.setStudyPeriod({ ...initialStudyPeriod(now), mode: 'month', anchor: '2025-12-01' }); result.current.openDrawer('study-hours'); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const tasks = fixture.calls.find(call => call.table === 'revision_tasks')!;
    expect(tasks.steps).toContainEqual(['eq', 'is_completed', true]);
    expect(tasks.steps).toContainEqual(['gte', 'date', new Date(2025, 11, 1).toISOString()]);
    expect(tasks.steps).toContainEqual(['lte', 'date', new Date(2025, 11, 31, 23, 59, 59, 999).toISOString()]);
    const exams = fixture.calls.find(call => call.table === 'exam_submission_metadata')!;
    const start = exams.steps.find(step => step[0] === 'gte')![2] as string;
    const end = exams.steps.find(step => step[0] === 'lte')![2] as string;
    expect(dateKey(new Date(start))).toBe('2025-12-01');
    expect(dateKey(new Date(end))).toBe('2025-12-31');
    expect(new Date(end).getHours()).toBe(23);
  });
  it('keeps the current week alongside a historical streak month, without downloading intervening months', async () => {
    fixture.rows.user_streaks = { current_streak: 3, longest_streak: 8, last_exam_submitted_at: '2026-10-14T10:00:00' };
    const { result } = renderHook(useStatsDrilldown);
    act(() => { result.current.setStreakMonth('2024-01-01'); result.current.openDrawer('streak'); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.streakData?.currentStreak).toBe(3);
    const reads = fixture.calls.filter(call => call.table === 'exam_submission_metadata');
    expect(reads).toHaveLength(2);
    expect(reads.map(call => dateKey(new Date(call.steps.find(step => step[0] === 'gte')![2] as string)))).toEqual(['2024-01-01', '2026-10-12']);
    const tasks = fixture.calls.filter(call => call.table === 'revision_tasks');
    expect(tasks[0].steps.some(step => step[0] === 'gte' && step[1] === 'updated_at')).toBe(true);
  });
  it('ignores an old response after switching sections even if the transport ignores abort', async () => {
    let finish: (value: unknown) => void = () => {};
    fixture.delayed = new Promise(resolve => { finish = resolve; });
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('scores'));
    await waitFor(() => expect(fixture.calls.length).toBe(4));
    const stale = fixture.calls[0];
    fixture.delayed = null;
    act(() => result.current.openDrawer('study-hours'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(stale.signal?.aborted).toBe(true);
    await act(async () => finish({ data: [{ id: 'old', exam_id: 'old', submitted_at: '2026-10-14T09:00:00', status: 'graded', total_score: 90, total_marks: 100, exams: { title: 'Stale', subject_id: 'Biology', grade_released: true } }], error: null }));
    expect(result.current.activeDrawer).toBe('study-hours');
    expect(result.current.completedExams).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
  it('cancels a pending request on close and clears the previous owner on account change', async () => {
    fixture.rows.exam_submission_metadata = [];
    const { result, rerender } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('exams'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const read = fixture.calls[0];
    act(() => result.current.closeDrawer());
    expect(read.signal?.aborted).toBe(true);
    fixture.owner = fixture.authOwner = 'user-b'; rerender();
    expect(result.current.activeDrawer).toBeNull();
    expect(result.current.completedExams).toEqual([]);
  });
  it('shows query errors and retries instead of claiming an empty result', async () => {
    fixture.fail = 'revision_tasks';
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('study-hours'));
    await waitFor(() => expect(result.current.error).toContain('Couldn’t load'));
    expect(result.current.loading).toBe(false);
    fixture.fail = '';
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeUndefined();
  });
  it('starts a fresh read when reopening the same section instead of flashing its previous totals', async () => {
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('study-hours'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.closeDrawer());
    fixture.delayed = new Promise(() => {});
    act(() => result.current.openDrawer('study-hours'));
    expect(result.current.loading).toBe(true);
    expect(result.current.studySessions).toEqual([]);
  });
  it('refuses a changed/mismatched authenticated session before querying activity', async () => {
    fixture.authOwner = 'user-b';
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('streak'));
    await waitFor(() => expect(result.current.error).toContain('Sign in again'));
    expect(fixture.calls).toEqual([]);
  });
  it('scopes score, quiz, profile and subject reads and never requests answer keys or answer text', async () => {
    fixture.rows.practice_set_progress = [{ id: 'p', set_id: 'set-a', completed_at: '2026-10-14T10:00:00', practice_question_sets: { id: 'set-a', set_name: 'Quiz', subject_id: 'Biology', profile_id: null, total_questions_generated: 1 } }];
    fixture.rows.practice_questions = [{ id: 'q', set_id: 'set-a', marks: 2 }];
    fixture.rows.practice_question_answers = [{ id: 'a', set_id: 'set-a', question_id: 'q', score: 1, submitted_at: '2026-10-14T09:00:00' }];
    fixture.rows.user_subjects = [{ subject_name: 'Biology' }];
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('scores'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scores.attempts).toHaveLength(1);
    expect(result.current.scores.attempts[0]).toMatchObject({ source: 'quiz', score: 50 });
    for (const call of fixture.calls) {
      if (call.table === 'practice_questions') expect(call.steps).toContainEqual(['in', 'set_id', ['set-a']]);
      else expect(call.steps).toContainEqual(['eq', call.table === 'exam_submission_metadata' ? 'student_id' : 'user_id', 'user-a']);
      expect(call.signal).toBeInstanceOf(AbortSignal);
      const fields = call.steps.find(step => step[0] === 'select')![1] as string;
      expect(fields).not.toMatch(/correct_answer|worked_solution|answer_text|feedback/);
    }
    const progress = fixture.calls.find(call => call.table === 'practice_set_progress')!;
    expect(progress.steps).toContainEqual(['eq', 'practice_question_sets.user_id', 'user-a']);
  });
  it('switches days/months locally and fetches a new year with inclusive local year bounds', async () => {
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('scores'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const count = fixture.calls.length;
    act(() => result.current.setScorePeriod({ view: 'month', anchor: '2026-09-01' }));
    expect(fixture.calls).toHaveLength(count);
    act(() => result.current.setScorePeriod({ view: 'day', anchor: '2026-09-02' }));
    expect(fixture.calls).toHaveLength(count);
    act(() => result.current.setScorePeriod({ view: 'year', anchor: '2025-01-01' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const read = fixture.calls.filter(call => call.table === 'exam_submission_metadata').at(-1)!;
    expect(read.steps).toContainEqual(['gte', 'submitted_at', new Date(2025, 0, 1).toISOString()]);
    expect(read.steps).toContainEqual(['lte', 'submitted_at', new Date(2025, 11, 31, 23, 59, 59, 999).toISOString()]);
  });
  it('surfaces quiz-grade read failures rather than silently showing an exam-only average', async () => {
    fixture.rows.practice_set_progress = [{ id: 'p', set_id: 'set-a', completed_at: '2026-10-14T10:00:00', practice_question_sets: { id: 'set-a', set_name: 'Quiz', subject_id: 'Biology', profile_id: null } }];
    fixture.fail = 'practice_question_answers';
    const { result } = renderHook(useStatsDrilldown);
    act(() => result.current.openDrawer('scores'));
    await waitFor(() => expect(result.current.error).toContain('Couldn’t load'));
    expect(result.current.scores.attempts).toEqual([]);
  });
});
