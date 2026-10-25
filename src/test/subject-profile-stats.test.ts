import { describe, expect, it } from 'vitest';
import { EMPTY_SUBJECT_PROFILE_STATS, selectSubjectProfileStats, summariseStatsTopics, type StatsTopicAnswer, type SubjectProfileStatsData } from '@/lib/subject-profile-stats';
const now = new Date('2026-10-24T12:00:00Z');
const date = '2026-10-23T10:00:00Z';
const topic = (patch: Partial<StatsTopicAnswer> = {}): StatsTopicAnswer => ({ source: 'exam', subject: 'Biology', profileId: 'full', topic: 'Cells', questionId: 'q1', parentId: 'e1', date, score: 0, marks: 4, ...patch });
const fixture = (): SubjectProfileStatsData => ({ ...EMPTY_SUBJECT_PROFILE_STATS,
  subjects: [{ id: 'biology', name: 'Biology', color: '#123456' }, { id: 'chemistry', name: 'Chemistry', color: '#654321' }],
  profiles: [{ id: 'full', name: 'Full mock', subject: 'Biology' }, { id: 'short', name: 'Short paper', subject: 'Biology' }, { id: 'chem', name: 'Chemistry', subject: 'Chemistry' }],
  attempts: [{ id: 'e1', source: 'exam', subject: 'Biology', profileId: 'full', profileName: 'Full mock', title: 'Paper', date, score: 0, earnedMarks: 0, totalMarks: 4 }, { id: 'e2', source: 'exam', subject: 'Biology', profileId: 'short', profileName: 'Short paper', title: 'Paper', date, score: 100, earnedMarks: 4, totalMarks: 4 }, { id: 'chem1', source: 'exam', subject: 'Chemistry', profileId: 'chem', profileName: 'Chemistry', title: 'Paper', date, score: 80, earnedMarks: 8, totalMarks: 10 }],
  topicAnswers: [topic(), topic({ profileId: 'short', questionId: 'q2', score: 4 }), topic({ subject: 'Chemistry', profileId: 'chem', topic: 'Cells', questionId: 'chemq', score: 4 })],
  study: [{ source: 'exam', subject: 'Biology', profileId: 'full', date, hours: .5 }, { source: 'quiz', subject: 'Biology', profileId: 'short', date, hours: 1 }, { source: 'revision', subject: 'Biology', profileId: null, date, hours: .75 }, { source: 'exam', subject: 'Chemistry', profileId: 'chem', date, hours: 4 }],
  wrongQuestions: [{ examId: 'e1', questionId: 'q1', subject: 'Biology', profileId: 'full', topic: 'Cells', questionNumber: '1(a)', score: 0, marks: 4, date, examTitle: 'Paper', profileName: 'Full mock' }],
  revisionGoals: [{ subject: 'Biology', targetPercentage: 80, deadline: null }],
});

describe('subject/profile statistics', () => {
  it('filters every aggregation by exact retained subject and profile identity before computing', () => {
    const data = fixture();
    const all = selectSubjectProfileStats(data, { subjectId: 'biology' }, now);
    expect(all.averageExamScore).toBe(50); expect(all.examCount).toBe(2);
    expect(all.topics[0].unifiedScore).toBe(50); expect(all.studyHours).toBe(1.5); expect(all.unassignedStudyHours).toBe(.75);
    const full = selectSubjectProfileStats(data, { subjectId: 'biology', profileId: 'full' }, now);
    expect(full.averageExamScore).toBe(0); expect(full.topics[0].unifiedScore).toBe(0); expect(full.studyHours).toBe(.5);
    expect(full.wrongQuestions).toHaveLength(1); expect(full.topicsByProfile).toHaveLength(1);
    const short = selectSubjectProfileStats(data, { subjectId: 'biology', profileId: 'short' }, now);
    expect(short.averageExamScore).toBe(100); expect(short.studyHours).toBe(1); expect(short.wrongQuestions).toEqual([]);
    expect(selectSubjectProfileStats(data, { subjectId: 'chemistry' }, now).targetPercentage).toBeNull();
  });
  it('keeps real zero, no result, pending, and missing periods distinct', () => {
    const data = fixture(); data.pending.push({ id: 'pending', source: 'exam', subject: 'Biology', profileId: 'full', date });
    data.topicAnswers.push(topic({ questionId: 'pendingq', topic: 'Unmarked', score: null }));
    const result = selectSubjectProfileStats(data, { subjectId: 'biology', profileId: 'full', timeRange: 'weekly' }, now);
    expect(result.trend).toHaveLength(7); expect(result.trend.find(row => row.key === '2026-10-23')?.full).toBe(0);
    expect(result.trend.find(row => row.key === '2026-10-22')?.full).toBeNull(); expect(result.pending).toHaveLength(1);
    expect(result.topics.some(row => row.topic === 'Unmarked')).toBe(false);
    expect(selectSubjectProfileStats(data, { subjectId: 'absent' }, now).averageExamScore).toBeNull();
  });
  it('retains the existing per-question exam mean, marks-weighted practice and60/40 blend', () => {
    const rows = [topic({ score: 2, marks: 4 }), topic({ score: 2, marks: 2, questionId: 'q2' }), topic({ source: 'quiz', score: 1, marks: 2, questionId: 'q3' }), topic({ source: 'quiz', score: 0, marks: 8, questionId: 'q4' }), topic({ score: null, questionId: 'pending' })];
    const out = summariseStatsTopics(rows, now)[0];
    expect(out).toMatchObject({ examScore: 75, practiceScore: 10, unifiedScore: 49, mastery: 'weak', examQuestionCount: 2, practiceQuestionCount: 2, pendingQuestionCount: 1 });
    expect(summariseStatsTopics([topic({ score: null })], now)).toEqual([]);
    expect(summariseStatsTopics([topic({ score: 0 })], now)[0].unifiedScore).toBe(0);
  });
  it('does not assign unprofiled or deleted-profile history to a newly saved profile with the same display name', () => {
    const data = fixture(); data.attempts.push({ ...data.attempts[0], id: 'old', profileId: 'deleted', profileName: 'Full mock' }, { ...data.attempts[0], id: 'loose', profileId: null, profileName: 'Full mock' });
    const all = selectSubjectProfileStats(data, { subjectId: 'biology' }, now);
    expect(all.profiles.find(p => p.id === 'deleted')?.name).toBe('Saved profile'); expect(all.profiles.find(p => p.id === 'unprofiled')?.name).toBe('No profile');
    expect(selectSubjectProfileStats(data, { subjectId: 'biology', profileId: 'full' }, now).examCount).toBe(1);
    expect(selectSubjectProfileStats(data, { subjectId: 'biology', profileId: 'unprofiled' }, now).examCount).toBe(1);
  });
  it('range changes affect only trend buckets and never mutate input or all-time totals', () => {
    const data = fixture(), before = JSON.stringify(data);
    for (const timeRange of ['weekly', 'monthly', 'yearly'] as const) {
      const result = selectSubjectProfileStats(data, { subjectId: 'biology', timeRange }, now);
      expect(result.averageExamScore).toBe(50); expect(result.studyHours).toBe(1.5);
      expect(result.trend.length).toBe(timeRange === 'weekly' ? 7 : timeRange === 'yearly' ? 12 : 5);
    }
    expect(JSON.stringify(data)).toBe(before);
  });
  it('does not count invalid/future marks or study time, and keeps all selected study profile keys for true zeros', () => {
    const data = fixture(); data.attempts.push({ ...data.attempts[0], id: 'future', date: '2027-01-01T12:00:00Z', score: 100, earnedMarks: 4 });
    data.topicAnswers.push(topic({ questionId: 'bad', score: 5, marks: 4, topic: 'Invalid' }), topic({ questionId: 'futureq', score: 4, date: '2027-01-01T12:00:00Z', topic: 'Future' }));
    data.study.push({ source: 'exam', subject: 'Biology', profileId: 'full', date: '2027-01-01T12:00:00Z', hours: 100 });
    const result = selectSubjectProfileStats(data, { subjectId: 'biology' }, now);
    expect(result.examCount).toBe(2); expect(result.studyHours).toBe(1.5); expect(result.topics).toHaveLength(1);
    expect(result.studyDays[0].hoursByProfile).toEqual({ full: 0, short: 0 });
  });
});
