import { eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, format, isValid, parseISO, startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import type { UnifiedMastery, UnifiedTopicScore } from '@/hooks/useUnifiedTopicPerformance';
import type { ScoreAttempt } from './dashboard-scores';

export const ALL_STATS_PROFILES = 'all';
export const UNPROFILED_STATS_ID = 'unprofiled';
export type StatsTimeRange = 'weekly' | 'monthly' | 'yearly';
export interface StatsSubject { id: string; name: string; color: string; educationLevel?: string | null; examBoard?: string | null }
export interface StatsProfile { id: string; name: string; subject: string; examBoard?: string | null; educationLevel?: string | null; assessmentTier?: string | null }
export interface StatsScope { subjectId: string; profileId?: string; timeRange?: StatsTimeRange }
export interface StatsPending { id: string; source: 'exam' | 'quiz'; subject: string; profileId: string | null; date: string }
export interface StatsTopicAnswer { source: 'exam' | 'quiz'; subject: string; profileId: string | null; topic: string; questionId: string; parentId: string; date: string | null; score: number | null; marks: number }
export interface StatsStudyRecord { source: 'exam' | 'quiz' | 'revision'; subject: string; profileId: string | null; date: string; hours: number }
export interface StatsWrongQuestion { examId: string; questionId: string; profileId: string | null; subject: string; topic: string; questionNumber: string; score: number; marks: number; date: string; examTitle: string; profileName: string }
export interface StatsTrendRow { key: string; period: string; [profileId: string]: string | number | null }
export interface StatsProfileTopics { profileId: string; profileName: string; topics: UnifiedTopicScore[] }
export interface StatsStudyDay { key: string; day: string; hoursByProfile: Record<string, number>; total: number }
export interface SubjectProfileStatsData {
  subjects: StatsSubject[]; profiles: StatsProfile[]; attempts: ScoreAttempt[]; pending: StatsPending[];
  topicAnswers: StatsTopicAnswer[]; study: StatsStudyRecord[]; wrongQuestions: StatsWrongQuestion[];
  /** Metadata exists but its related exam identity is not readable. Never infer its subject. */
  unavailableExamCount?: number;
  /** Released exams whose topic rows are not available through existing read policies. */
  topicUnavailableExams?: { examId: string; subject: string; profileId: string | null }[];
  revisionGoals: { subject: string; targetPercentage: number; deadline: string | null }[];
  currentStreak: number; longestStreak: number;
}
export const EMPTY_SUBJECT_PROFILE_STATS: SubjectProfileStatsData = { subjects: [], profiles: [], attempts: [], pending: [], topicAnswers: [], study: [], wrongQuestions: [], revisionGoals: [], currentStreak: 0, longestStreak: 0 };

export const statsSubjectKey = (value: string) => value.trim().toLowerCase();
export const statsProfileKey = (id: string | null | undefined) => id || UNPROFILED_STATS_ID;
export const validStatsDate = (value: string | null | undefined, now = new Date()): value is string => !!value && isValid(parseISO(value)) && parseISO(value) <= now;
export const validStatsMark = (score: unknown, marks: unknown): score is number => typeof score === 'number' && Number.isFinite(score) && typeof marks === 'number' && Number.isFinite(marks) && marks > 0 && score >= 0 && score <= marks;
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Preserve the existing exam question mean / marks-weighted practice / 60:40 blend. */
export function summariseStatsTopics(rows: StatsTopicAnswer[], now = new Date()): UnifiedTopicScore[] {
  const topics = new Map<string, StatsTopicAnswer[]>();
  for (const row of rows) {
    if (!row.topic.trim() || (row.date && !validStatsDate(row.date, now))) continue;
    const key = statsSubjectKey(row.topic);
    const group = topics.get(key) || [];
    group.push(row); topics.set(key, group);
  }
  const out: UnifiedTopicScore[] = [];
  for (const group of topics.values()) {
    const marked = group.filter(row => !!row.date && validStatsMark(row.score, row.marks));
    const exams = marked.filter(row => row.source === 'exam');
    const quizzes = marked.filter(row => row.source === 'quiz');
    const examScore = average(exams.map(row => row.score! / row.marks * 100));
    const practiceMarks = quizzes.reduce((sum, row) => sum + row.marks, 0);
    const practiceScore = practiceMarks > 0 ? quizzes.reduce((sum, row) => sum + row.score!, 0) / practiceMarks * 100 : null;
    // A pending-only topic must never become a scored zero or a weak topic.
    if (examScore === null && practiceScore === null) continue;
    const blended = examScore === null ? practiceScore! : practiceScore === null ? examScore : examScore * .6 + practiceScore * .4;
    const mastery: UnifiedMastery = blended >= 75 ? 'strong' : blended >= 50 ? 'developing' : 'weak';
    const examDate = exams.map(row => row.date!).sort().slice(-1)[0] || null;
    const practiceDate = quizzes.map(row => row.date!).sort().slice(-1)[0] || null;
    out.push({ topic: group[0].topic, subjectId: group[0].subject, unifiedScore: Math.round(blended), examScore: examScore === null ? null : Math.round(examScore), practiceScore: practiceScore === null ? null : Math.round(practiceScore), examQuestionCount: exams.length, practiceQuestionCount: quizzes.length, pendingQuestionCount: group.length - marked.length, mastery, lastAttempted: [examDate, practiceDate].filter((date): date is string => !!date).sort().slice(-1)[0] || null, practicedSinceLastExam: !!examDate && !!practiceDate && practiceDate > examDate });
  }
  const order: Record<UnifiedMastery, number> = { weak: 0, developing: 1, strong: 2, untested: 3 };
  return out.sort((a, b) => order[a.mastery] - order[b.mastery] || a.unifiedScore - b.unifiedScore || a.topic.localeCompare(b.topic));
}

function trendBuckets(range: StatsTimeRange, now: Date) {
  if (range === 'weekly') return eachDayOfInterval({ start: subDays(now, 6), end: now }).map(date => ({ key: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE') }));
  if (range === 'monthly') return eachWeekOfInterval({ start: subDays(now, 29), end: now }, { weekStartsOn: 1 }).map(date => ({ key: format(date, 'yyyy-MM-dd'), label: format(date, 'd MMM') }));
  return eachMonthOfInterval({ start: startOfMonth(subMonths(now, 11)), end: now }).map(date => ({ key: format(date, 'yyyy-MM'), label: format(date, 'MMM') }));
}

/** Filter retained identities BEFORE aggregating. No display-name inference or profile reassignment. */
export function selectSubjectProfileStats(data: SubjectProfileStatsData, scope: StatsScope, now = new Date()) {
  const subject = data.subjects.find(row => row.id === scope.subjectId) || null;
  const subjectKey = subject ? statsSubjectKey(subject.name) : '';
  const belongs = (name: string) => !!subjectKey && statsSubjectKey(name) === subjectKey;
  const profiles = data.profiles.filter(profile => belongs(profile.subject)).map(profile => ({ ...profile }));
  const known = new Set(profiles.map(profile => profile.id));
  const histories = [...data.attempts, ...data.pending, ...data.topicAnswers, ...data.study.filter(row => row.source !== 'revision')].filter(row => belongs(row.subject));
  for (const row of histories) {
    const id = statsProfileKey(row.profileId);
    if (!known.has(id)) { profiles.push({ id, name: id === UNPROFILED_STATS_ID ? 'No profile' : 'Saved profile', subject: subject!.name }); known.add(id); }
  }
  // Saved order is deterministic and stable when the active selection changes.
  profiles.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const unnamed = profiles.filter(profile => profile.name === 'Saved profile');
  if (unnamed.length > 1) unnamed.forEach((profile, index) => { profile.name = `Saved profile ${index + 1}`; });
  const selected = scope.profileId || ALL_STATS_PROFILES;
  const matches = (row: { subject: string; profileId?: string | null }) => belongs(row.subject) && (selected === ALL_STATS_PROFILES || statsProfileKey(row.profileId) === selected);
  const activeProfiles = profiles.filter(profile => selected === ALL_STATS_PROFILES || profile.id === selected);
  const attempts = data.attempts.filter(row => matches(row) && validStatsDate(row.date, now) && validStatsMark(row.earnedMarks, row.totalMarks) && Number.isFinite(row.score) && row.score >= 0 && row.score <= 100);
  const pending = data.pending.filter(row => matches(row) && validStatsDate(row.date, now));
  const topicRows = data.topicAnswers.filter(row => matches(row));
  const topicUnavailableCount = (data.topicUnavailableExams || []).filter(matches).length;
  const topics = summariseStatsTopics(topicRows, now);
  const topicsByProfile: StatsProfileTopics[] = activeProfiles.map(profile => ({ profileId: profile.id, profileName: profile.name, topics: summariseStatsTopics(topicRows.filter(row => statsProfileKey(row.profileId) === profile.id), now) }));
  const exams = attempts.filter(row => row.source === 'exam');
  const range = scope.timeRange || 'monthly';
  const trend = trendBuckets(range, now).map(({ key, label }) => {
    const row: StatsTrendRow = { key, period: label };
    for (const profile of activeProfiles) {
      const values = exams.filter(exam => {
        if (statsProfileKey(exam.profileId) !== profile.id) return false;
        const date = parseISO(exam.date);
        if (range === 'weekly') return format(date, 'yyyy-MM-dd') === key;
        if (range === 'monthly') return date >= startOfDay(subDays(now, 29)) && format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') === key;
        return format(date, 'yyyy-MM') === key;
      }).map(exam => exam.score);
      row[profile.id] = average(values);
    }
    return row;
  });
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const studyDays: StatsStudyDay[] = eachDayOfInterval({ start: weekStart, end: subDays(weekStart, -6) }).map(date => ({ key: format(date, 'yyyy-MM-dd'), day: format(date, 'EEE'), hoursByProfile: Object.fromEntries(activeProfiles.map(profile => [profile.id, 0])), total: 0 }));
  const dayMap = new Map(studyDays.map(day => [day.key, day]));
  let unassignedStudyHours = 0;
  for (const row of data.study) {
    if (!belongs(row.subject) || !validStatsDate(row.date, now) || !Number.isFinite(row.hours) || row.hours <= 0) continue;
    const day = dayMap.get(format(parseISO(row.date), 'yyyy-MM-dd'));
    if (!day) continue;
    if (row.source === 'revision') { unassignedStudyHours += row.hours; continue; }
    if (!matches(row)) continue;
    const key = statsProfileKey(row.profileId);
    if (!(key in day.hoursByProfile)) continue;
    day.hoursByProfile[key] += row.hours; day.total += row.hours;
  }
  const wrongQuestions = data.wrongQuestions.filter(row => matches(row) && validStatsDate(row.date, now) && validStatsMark(row.score, row.marks) && row.score < row.marks).sort((a, b) => b.date.localeCompare(a.date) || a.questionNumber.localeCompare(b.questionNumber));
  const targetPercentage = data.revisionGoals.find(goal => belongs(goal.subject))?.targetPercentage ?? null;
  return { subject, profiles, attempts, pending, averageExamScore: average(exams.map(row => row.score)), examCount: exams.length, topics, topicsByProfile, trend, studyDays, studyHours: studyDays.reduce((sum, day) => sum + day.total, 0), unassignedStudyHours, wrongQuestions, targetPercentage, topicUnavailableCount };
}
