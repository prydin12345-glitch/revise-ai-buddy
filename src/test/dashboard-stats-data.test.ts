import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { activityCount, activityDescriptions, adjacentStatsSection, calendarDays, dateKey, formatStudyMinutes, initialStudyPeriod, parseDay, resolveStudyPeriod, shiftStudyPeriod, studySummary, type StudyPeriod, type StudySession } from '@/lib/dashboard-stats';
import { examItems, readStatsPages, streakActivity, studySessionsFromRows, type SubmissionRow } from '@/lib/dashboard-stats-data';

const now = new Date(2026, 9, 14, 12);
const month: StudyPeriod = { mode: 'month', anchor: '2026-10-14', from: '2026-10-01', to: '2026-10-14' };
const session = (date: string, source: StudySession['source'], duration: number): StudySession => ({ id: `${date}-${source}`, date, duration, source });

describe('study date intervals', () => {
  it('uses a Monday week and preserves local date keys', () => {
    const range = resolveStudyPeriod(initialStudyPeriod(now));
    expect(dateKey(range.start)).toBe('2026-10-12');
    expect(dateKey(range.end)).toBe('2026-10-18');
    expect(range.end.getHours()).toBe(23);
  });
  it('navigates past months and crosses years without retaining an invalid day', () => {
    const december = { ...month, anchor: '2025-12-31' };
    expect(shiftStudyPeriod(december, 1).anchor).toBe('2026-01-01');
    expect(shiftStudyPeriod(month, -1).anchor).toBe('2026-09-01');
    expect(shiftStudyPeriod({ ...month, mode: 'week', anchor: '2026-01-02' }, -1).anchor).toBe('2025-12-26');
  });
  it('includes leap day and both ends of custom ranges', () => {
    const leap = resolveStudyPeriod({ ...month, anchor: '2024-02-01' });
    expect(dateKey(leap.end)).toBe('2024-02-29');
    const custom = resolveStudyPeriod({ ...month, mode: 'custom', from: '2025-12-31', to: '2026-01-01' }, now);
    const data = studySummary([session('2025-12-31', 'exam', 20), session('2026-01-01T23:59:59', 'practice', 10), session('2026-01-02', 'exam', 99)], custom);
    expect(data.totalMinutes).toBe(30);
    expect(data.buckets).toHaveLength(2);
  });
  it.each([
    [{ from: '2026-10-14', to: '2026-10-13' }, 'end date'],
    [{ from: '2026-10-01', to: '2026-10-15' }, 'today or earlier'],
    [{ from: '2025-01-01', to: '2026-10-01' }, '366 days'],
    [{ from: '2026-02-30', to: '2026-03-01' }, 'valid date'],
    [{ from: '', to: '' }, 'valid date'],
  ])('rejects invalid custom input %o', (values, message) => {
    expect(() => resolveStudyPeriod({ ...month, mode: 'custom', ...values }, now)).toThrow(message);
  });
  it('rejects a date that JavaScript could otherwise normalise', () => {
    expect(() => parseDay('2026-02-30')).toThrow();
    expect(() => parseDay('2026-1-2')).toThrow();
  });
});

describe('one stacked chart and its four source totals', () => {
  it('uses the selected month, not the current week, and never merges different years', () => {
    const data = studySummary([session('2025-10-01', 'exam', 999), session('2026-10-01', 'exam', 12), session('2026-10-31', 'practice', 5), session('2026-11-01', 'revision', 999)], resolveStudyPeriod(month));
    expect(data.totalMinutes).toBe(17);
    expect(data.buckets).toHaveLength(31);
    expect(data.buckets[0].minutes.exam).toBe(12);
    expect(data.buckets[30].minutes.practice).toBe(5);
    expect(data.totals).toEqual({ exam: 12, practice: 5, revision: 0, feedback: 0 });
  });
  it('aggregates every category once and retains sub-minute durations', () => {
    const data = studySummary([session('2026-10-14', 'exam', 0.25), session('2026-10-14', 'practice', 1.5), session('2026-10-14', 'revision', 20), session('2026-10-14', 'feedback', 2)], resolveStudyPeriod(month));
    expect(data.totalMinutes).toBe(23.75);
    expect(data.buckets.reduce((sum, day) => sum + day.total, 0)).toBe(23.75);
    expect(data.buckets.find(day => day.key === '2026-10-14')?.minutes).toEqual({ exam: .25, practice: 1.5, feedback: 2, revision: 20 });
  });
  it('excludes invalid, negative and nonfinite durations instead of poisoning totals', () => {
    const data = studySummary([session('not-a-date', 'exam', 30), session('2026-10-14', 'exam', -5), session('2026-10-14', 'practice', Infinity), session('2026-10-14', 'revision', NaN)], resolveStudyPeriod(month));
    expect(data.totalMinutes).toBe(0);
    expect(data.buckets.every(bucket => bucket.total === 0)).toBe(true);
  });
  it('bounds longer custom charts without losing the last day or changing the total', () => {
    const range = resolveStudyPeriod({ ...month, mode: 'custom', from: '2025-10-15', to: '2026-10-14' }, now);
    const sessions = Array.from({ length: 365 }, (_, index) => session(dateKey(addDays(range.start, index)), 'practice', 1));
    const data = studySummary(sessions, range);
    expect(data.buckets.length).toBeLessThanOrEqual(31);
    expect(data.bucketDays).toBe(12);
    expect(data.totalMinutes).toBe(365);
  });
  it.each([[0, '0h 0m'], [.1, '<1m'], [12, '12m'], [60, '1h 0m'], [145, '2h 25m'], [NaN, '0h 0m']])('formats %s minutes without claiming zero for short sessions', (minutes, label) => expect(formatStudyMinutes(minutes)).toBe(label));
  it('reads actual exam/quiz times and completed-task durations; deduplicates overlapping fetches', () => {
    const exam = { id: 'same', submitted_at: '2026-10-14T10:00:00', time_taken_seconds: 15 };
    const sessions = studySessionsFromRows([exam, exam], [{ id: 'same', completed_at: '2026-10-14T11:00:00', time_spent_seconds: 90 }], [{ id: 'task', date: '2026-10-14', duration: 20, is_completed: true }, { id: 'pending', date: '2026-10-14', duration: 100, is_completed: false }]);
    expect(sessions.map(row => [row.source, row.duration])).toEqual([['exam', .25], ['practice', 1.5], ['revision', 20]]);
    expect(sessions.some(row => row.source === 'feedback')).toBe(false);
    expect(sessions[0].date).toBe('2026-10-14T10:00:00');
  });
});

describe('score and streak integrity', () => {
  const submission: SubmissionRow = { id: 's', exam_id: 'e', submitted_at: '2026-10-14T10:00:00', status: 'graded', total_score: 0, total_marks: 100, exams: { title: 'Biology', subject_id: 'Biology', grade_released: true } };
  it('preserves genuine graded zeros but excludes marking failures, unmarked and withheld scores', () => {
    const rows = examItems([submission, { ...submission, status: 'marking_failed', total_score: 0 }, { ...submission, status: 'marking', total_score: null }, { ...submission, exams: { ...submission.exams!, grade_released: false } }, { ...submission, total_marks: 0 }, { ...submission, total_score: NaN }]);
    expect(rows[0].isReleased).toBe(true);
    expect(rows.slice(1).every(row => !row.isReleased)).toBe(true);
    expect(rows.filter(row => row.isReleased)).toHaveLength(1);
  });
  it('ignores drafts and invalid dates', () => {
    expect(examItems([{ ...submission, status: 'in_progress' }, { ...submission, submitted_at: 'bad' }])).toEqual([]);
  });
  it('counts completed activities on their real local day, once per record, not scheduled or future dates', () => {
    const exams = [{ id: 'e', submitted_at: '2026-10-14T10:00:00' }];
    const data = streakActivity([...exams, ...exams], [{ id: 'quiz', completed_at: '2026-10-14T11:00:00' }, { id: 'unfinished', completed_at: null }], [{ id: 'task', date: '2026-09-01', updated_at: '2026-10-14T09:00:00', is_completed: true }, { id: 'future', date: '2026-10-15', updated_at: '2026-10-15T09:00:00', is_completed: true }], now);
    expect(data.activity).toEqual([{ date: '2026-10-14', exams: 1, quizzes: 1, revision: 1 }]);
    expect(data.todayActivity).toEqual(['1 exam submitted', '1 quiz completed', '1 revision task completed']);
    expect(activityCount(data.activity[0])).toBe(3);
    expect(activityDescriptions()).toEqual([]);
  });
  it('builds a real Monday-first month, including edge weeks, instead of a rolling 14 days', () => {
    const days = calendarDays('2026-10-01');
    expect(dateKey(days[0])).toBe('2026-09-28');
    expect(dateKey(days.at(-1)!)).toBe('2026-11-01');
    expect(days).toHaveLength(35);
    expect(calendarDays('2026-02-01')).toHaveLength(35);
  });
});

describe('bounded paging and stats neighbours', () => {
  it('fetches beyond the PostgREST first page', async () => {
    const calls: number[][] = [];
    const rows = await readStatsPages(async (from, to) => { calls.push([from, to]); return { data: Array.from({ length: from ? 1 : 500 }, (_, index) => index + from), error: null }; }, new AbortController().signal);
    expect(rows).toHaveLength(501);
    expect(calls).toEqual([[0, 499], [500, 999]]);
  });
  it('surfaces query failures rather than presenting a plausible empty chart', async () => {
    await expect(readStatsPages(async () => ({ data: null, error: { message: 'private backend detail' } }), new AbortController().signal)).rejects.toThrow('Couldn’t load your activity');
  });
  it('stops an aborted request before another page', async () => {
    const abort = new AbortController(); abort.abort();
    await expect(readStatsPages(async () => ({ data: [], error: null }), abort.signal)).rejects.toThrow('Aborted');
  });
  it('honours left-to-previous from Scores and never wraps at the ends', () => {
    expect(adjacentStatsSection('scores', -120)).toBe('exams');
    expect(adjacentStatsSection('scores', 120)).toBe('study-hours');
    expect(adjacentStatsSection('exams', -120)).toBeNull();
    expect(adjacentStatsSection('streak', 120)).toBeNull();
  });
});
