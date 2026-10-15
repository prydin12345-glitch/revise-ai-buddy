import { describe, expect, it } from 'vitest';
import { dateKey, type ExamItem } from '@/lib/dashboard-stats';
import { buildScoreData, initialScorePeriod, scoreCalendarItems, scorePeriodRange, shiftScorePeriod, summariseScores, type QuizAnswerRow, type QuizProgressRow, type QuizQuestionRow, type ScorePeriod } from '@/lib/dashboard-scores';

const now = new Date(2026, 9, 14, 12);
const period: ScorePeriod = { view: 'month', anchor: '2026-10-01' };
const exam = (patch: Partial<ExamItem> = {}): ExamItem => ({ id: 'e', title: 'Paper 1', subject: 'Biology', dateTaken: '2026-10-14T09:00:00', score: 75, totalMarks: 100, earnedMarks: 75, isReleased: true, status: 'graded', profileId: 'p1', ...patch });
const progress: QuizProgressRow = { id: 'progress', set_id: 'set', completed_at: '2026-10-14T10:00:00', practice_question_sets: { id: 'set', set_name: 'Quiz', subject_id: 'Biology', profile_id: 'p1', total_questions_generated: 2 } };
const questions: QuizQuestionRow[] = [{ id: 'q1', set_id: 'set', marks: 1 }, { id: 'q2', set_id: 'set', marks: 3 }];
const answers: QuizAnswerRow[] = [{ id: 'a1', set_id: 'set', question_id: 'q1', score: 1, submitted_at: '2026-10-14T09:00:00' }, { id: 'a2', set_id: 'set', question_id: 'q2', score: 1, submitted_at: '2026-10-14T09:00:00' }];
const profiles = [{ id: 'p1', profile_name: 'Paper 1 Higher', subject_name: 'Biology' }];

describe('score calendar ranges', () => {
  it('starts on today with a real Monday-first seven-day strip and disabled future days', () => {
    const selected = initialScorePeriod(now);
    expect(selected).toEqual({ view: 'day', anchor: '2026-10-14' });
    const items = scoreCalendarItems(selected, now);
    expect(items.map(item => item.key)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(items.filter(item => item.selected)).toHaveLength(1);
    expect(items.slice(3).every(item => item.disabled)).toBe(true);
  });
  it('pages weeks across years and clamps the next week to today when its selected weekday is in the future', () => {
    expect(shiftScorePeriod({ view: 'day', anchor: '2026-01-02' }, -1, now)?.anchor).toBe('2025-12-26');
    expect(shiftScorePeriod({ view: 'day', anchor: '2026-10-09' }, 1, now)?.anchor).toBe('2026-10-14');
    expect(shiftScorePeriod(initialScorePeriod(now), 1, now)).toBeNull();
  });
  it('moves calendar months and years without retaining an impossible day', () => {
    expect(shiftScorePeriod({ view: 'month', anchor: '2025-12-31' }, 1, now)?.anchor).toBe('2026-01-01');
    expect(shiftScorePeriod({ view: 'year', anchor: '2024-02-29' }, 1, now)?.anchor).toBe('2025-01-01');
    expect(shiftScorePeriod({ view: 'year', anchor: '2026-01-01' }, 1, now)).toBeNull();
  });
  it('uses local inclusive day/month/year boundaries, including leap day and the final timestamp', () => {
    const leap = scorePeriodRange({ view: 'month', anchor: '2024-02-14' }, now);
    expect(dateKey(leap.start)).toBe('2024-02-01'); expect(dateKey(leap.end)).toBe('2024-02-29');
    expect(leap.end.getHours()).toBe(23);
    const year = scorePeriodRange({ view: 'year', anchor: '2025-01-01' }, now);
    expect(dateKey(year.start)).toBe('2025-01-01'); expect(dateKey(year.end)).toBe('2025-12-31');
    expect(scorePeriodRange(period, now).end).toEqual(now);
    expect(() => scorePeriodRange({ view: 'day', anchor: '2026-10-15' }, now)).toThrow('earlier');
  });
});

describe('real marked exam and quiz score data', () => {
  it('uses graded marks, weights quiz questions by marks and averages completed attempts equally', () => {
    const data = buildScoreData([exam()], [progress], questions, answers, profiles, ['Physics'], now);
    expect(data.attempts.find(row => row.source === 'quiz')?.score).toBe(50);
    const summary = summariseScores(data, 'Biology', period, now);
    expect(summary.average).toBe(62.5);
    expect(summary.profiles).toHaveLength(1);
    expect(summary.profiles[0]).toMatchObject({ name: 'Paper 1 Higher', exams: 75, quizzes: 50 });
    expect(data.subjects).toEqual(['Biology', 'Physics']);
  });
  it('retains a real zero exam or quiz but never turns pending or withheld marks into zero', () => {
    const data = buildScoreData([exam({ earnedMarks: 0, score: 0 }), exam({ id: 'hidden', isReleased: false, score: 93, earnedMarks: 93 })], [progress], questions, answers.map(answer => ({ ...answer, score: 0 })), profiles, [], now);
    expect(data.attempts.map(row => row.score)).toEqual([0, 0]);
    expect(data.pending).toHaveLength(1);
    expect(summariseScores(data, 'Biology', period, now).average).toBe(0);
  });
  it.each([null, -1, Infinity, NaN, 4])('excludes an entire completed quiz if one mark is missing or invalid (%s)', score => {
    const data = buildScoreData([], [progress], questions, [answers[0], { ...answers[1], score }], profiles, [], now);
    expect(data.attempts).toEqual([]); expect(data.pending).toHaveLength(1);
  });
  it('requires all current questions to be marked and submitted; binary completion counters are not grades', () => {
    expect(buildScoreData([], [progress], questions, answers.slice(0, 1), profiles, [], now).attempts).toEqual([]);
    expect(buildScoreData([], [progress], questions, [answers[0], { ...answers[1], submitted_at: null }], profiles, [], now).attempts).toEqual([]);
    expect(buildScoreData([], [{ ...progress, completed_at: null }], questions, answers, profiles, [], now).attempts).toEqual([]);
    expect(buildScoreData([], [progress], questions.slice(0, 1), answers, profiles, [], now).attempts).toEqual([]);
  });
  it('deduplicates repeated records and uses the latest saved quiz answer without mixing question/set identities', () => {
    const old = { ...answers[1], id: 'old', score: 3, submitted_at: '2026-10-13T09:00:00' };
    const data = buildScoreData([exam(), exam()], [progress, progress], [...questions, questions[0]], [old, ...answers, { ...answers[1], set_id: 'another', score: 3 }], profiles, [], now);
    expect(data.attempts).toHaveLength(2);
    expect(data.attempts.find(row => row.source === 'quiz')?.score).toBe(50);
  });
  it('does not invent profile names, use a different subject’s profile or merge same-named subjects/profiles', () => {
    const data = buildScoreData([exam(), exam({ id: 'e2', profileId: 'p2' }), exam({ id: 'e3', subject: 'Biology Higher', profileId: null })], [], [], [], [{ ...profiles[0], subject_name: 'Physics' }, { ...profiles[0], id: 'p2' }], [], now);
    expect(data.attempts.find(row => row.id === 'e')?.profileName).toBe('Saved profile');
    expect(summariseScores(data, 'Biology', period, now).profiles).toHaveLength(2);
    expect(summariseScores(data, 'Biology Higher', period, now).attempts).toHaveLength(1);
  });
  it('filters every displayed metric and pending count by the same subject and selected date interval', () => {
    const data = buildScoreData([exam(), exam({ id: 'prior', dateTaken: '2025-10-14T09:00:00' }), exam({ id: 'other', subject: 'Physics', earnedMarks: 10 }), exam({ id: 'hidden', subject: 'Physics', isReleased: false }), exam({ id: 'late', dateTaken: '2026-10-13T23:59:59' })], [], [], [], profiles, [], now);
    const selected = summariseScores(data, 'Biology', { view: 'day', anchor: '2026-10-13' }, now);
    expect(selected.attempts.map(row => row.id)).toEqual(['late']); expect(selected.average).toBe(75); expect(selected.pending).toEqual([]);
    expect(summariseScores(data, 'Biology', { view: 'day', anchor: '2026-10-12' }, now).average).toBeNull();
  });
});
