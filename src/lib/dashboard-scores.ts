import { addDays, addMonths, addYears, endOfDay, endOfMonth, endOfYear, format, isValid, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { dateKey, parseDay, type DateInterval, type ExamItem } from './dashboard-stats';

export type ScoreView = 'day' | 'month' | 'year';
export interface ScorePeriod { view: ScoreView; anchor: string }
export type ScoreSource = 'exam' | 'quiz';
export interface ScoreAttempt {
  id: string; source: ScoreSource; subject: string; title: string; date: string;
  profileId: string | null; profileName: string; score: number; earnedMarks: number; totalMarks: number;
}
export interface PendingScore { id: string; source: ScoreSource; subject: string; date: string }
export interface ScoreData { attempts: ScoreAttempt[]; pending: PendingScore[]; subjects: string[] }
export interface ScoreProfileRow { id: string; profile_name: string; subject_name: string }
export interface QuizProgressRow {
  id: string; set_id: string; completed_at: string | null;
  practice_question_sets: { id: string; set_name: string; subject_id: string; profile_id: string | null; total_questions_generated?: number | null } | null;
}
export interface QuizQuestionRow { id: string; set_id: string | null; marks: number }
export interface QuizAnswerRow { id: string; set_id: string; question_id: string; score: number | null; submitted_at: string | null; updated_at?: string | null }
export const EMPTY_SCORES: ScoreData = { attempts: [], pending: [], subjects: [] };
export const initialScorePeriod = (now = new Date()): ScorePeriod => ({ view: 'day', anchor: dateKey(now) });

export function scorePeriodRange(period: ScorePeriod, now = new Date()): DateInterval {
  const date = parseDay(period.anchor);
  const start = period.view === 'year' ? startOfYear(date) : period.view === 'month' ? startOfMonth(date) : startOfDay(date);
  if (start > now) throw new Error('Choose today or an earlier date.');
  const end = period.view === 'year' ? endOfYear(date) : period.view === 'month' ? endOfMonth(date) : endOfDay(date);
  return { start, end: end > now ? now : end };
}

/** The day strip pages by week; month/year strips move one selected period. */
export function shiftScorePeriod(period: ScorePeriod, direction: -1 | 1, now = new Date()): ScorePeriod | null {
  const anchor = parseDay(period.anchor);
  let next = period.view === 'day' ? addDays(anchor, direction * 7)
    : period.view === 'month' ? addMonths(startOfMonth(anchor), direction) : addYears(startOfYear(anchor), direction);
  if (next > now) {
    if (period.view !== 'day' || startOfWeek(anchor, { weekStartsOn: 1 }) >= startOfWeek(now, { weekStartsOn: 1 })) return null;
    next = now; // The next week exists, but the selected weekday has not happened yet.
  }
  return { ...period, anchor: dateKey(next) };
}

export function scoreCalendarItems(period: ScorePeriod, now = new Date()) {
  const anchor = parseDay(period.anchor);
  const start = period.view === 'day' ? startOfWeek(anchor, { weekStartsOn: 1 })
    : period.view === 'month' ? addMonths(startOfMonth(anchor), -3) : addYears(startOfYear(anchor), -3);
  return Array.from({ length: 7 }, (_, index) => {
    const date = period.view === 'day' ? addDays(start, index) : period.view === 'month' ? addMonths(start, index) : addYears(start, index);
    const pattern = period.view === 'day' ? 'yyyy-MM-dd' : period.view === 'month' ? 'yyyy-MM' : 'yyyy';
    return { date, key: dateKey(date), selected: format(date, pattern) === format(anchor, pattern), disabled: date > now,
      label: format(date, period.view === 'day' ? 'EEEE d MMMM yyyy' : period.view === 'month' ? 'MMMM yyyy' : 'yyyy'),
      top: format(date, period.view === 'day' ? 'EEE' : period.view === 'month' ? 'yyyy' : 'yy'),
      value: format(date, period.view === 'day' ? 'd' : period.view === 'month' ? 'MMM' : 'yyyy') };
  });
}

const validDate = (value: string | null | undefined): value is string => !!value && isValid(parseISO(value));
const validMark = (score: unknown, marks: unknown): score is number => typeof marks === 'number' && Number.isFinite(marks) && marks > 0 && typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= marks;

/** Read only grade metadata. Missing/failed marks never become zero-score attempts. */
export function buildScoreData(exams: (ExamItem & { profileId?: string | null })[], progress: QuizProgressRow[], questions: QuizQuestionRow[], answers: QuizAnswerRow[], profiles: ScoreProfileRow[], subjects: string[] = [], now = new Date()): ScoreData {
  const attempts: ScoreAttempt[] = [];
  const pending: PendingScore[] = [];
  const names = new Map(profiles.map(profile => [profile.id, profile]));
  const profileName = (id: string | null, subject: string) => !id ? 'No profile' : names.get(id)?.subject_name === subject ? names.get(id)!.profile_name : 'Saved profile';
  const seen = new Set<string>();
  for (const exam of exams) {
    if (!validDate(exam.dateTaken) || parseISO(exam.dateTaken) > now || seen.has(`exam:${exam.id}`)) continue;
    seen.add(`exam:${exam.id}`);
    if (!exam.isReleased || !validMark(exam.earnedMarks, exam.totalMarks)) { pending.push({ id: exam.id, source: 'exam', subject: exam.subject, date: exam.dateTaken }); continue; }
    attempts.push({ id: exam.id, source: 'exam', subject: exam.subject, title: exam.title, date: exam.dateTaken, profileId: exam.profileId ?? null, profileName: profileName(exam.profileId ?? null, exam.subject), score: exam.earnedMarks / exam.totalMarks * 100, earnedMarks: exam.earnedMarks, totalMarks: exam.totalMarks });
  }
  const quizQuestions = new Map<string, QuizQuestionRow[]>();
  for (const question of questions) {
    if (!question.set_id) continue;
    const group = quizQuestions.get(question.set_id) ?? [];
    if (!group.some(existing => existing.id === question.id)) group.push(question);
    quizQuestions.set(question.set_id, group);
  }
  const quizAnswers = new Map<string, QuizAnswerRow>();
  for (const answer of answers) {
    const key = `${answer.set_id}:${answer.question_id}`;
    const existing = quizAnswers.get(key);
    const time = (row: QuizAnswerRow) => validDate(row.updated_at) ? Date.parse(row.updated_at) : validDate(row.submitted_at) ? Date.parse(row.submitted_at) : Infinity;
    if (!existing || time(answer) >= time(existing)) quizAnswers.set(key, answer);
  }
  for (const row of [...progress].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))) {
    const set = row.practice_question_sets;
    if (!set || set.id !== row.set_id || !validDate(row.completed_at) || parseISO(row.completed_at) > now || seen.has(`quiz:${row.set_id}`)) continue;
    seen.add(`quiz:${row.set_id}`);
    const parts = quizQuestions.get(row.set_id) ?? [];
    let earned = 0; let total = 0;
    const complete = parts.length > 0 && (!set.total_questions_generated || parts.length === set.total_questions_generated) && parts.every(part => {
      const answer = quizAnswers.get(`${row.set_id}:${part.id}`);
      if (!answer || !validDate(answer.submitted_at) || parseISO(answer.submitted_at) > now || !validMark(answer.score, part.marks)) return false;
      earned += answer.score; total += part.marks; return true;
    });
    if (!complete) { pending.push({ id: row.set_id, source: 'quiz', subject: set.subject_id, date: row.completed_at }); continue; }
    attempts.push({ id: row.set_id, source: 'quiz', subject: set.subject_id, title: set.set_name, date: row.completed_at, profileId: set.profile_id, profileName: profileName(set.profile_id, set.subject_id), score: earned / total * 100, earnedMarks: earned, totalMarks: total });
  }
  return { attempts: attempts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), pending,
    subjects: [...new Set([...subjects, ...profiles.map(profile => profile.subject_name), ...attempts.map(attempt => attempt.subject), ...pending.map(attempt => attempt.subject)].filter(Boolean))].sort((a, b) => a.localeCompare(b)) };
}

export function summariseScores(data: ScoreData, subject: string, period: ScorePeriod, now = new Date()) {
  const range = scorePeriodRange(period, now);
  const inRange = (row: { subject: string; date: string }) => row.subject === subject && validDate(row.date) && parseISO(row.date) >= range.start && parseISO(row.date) <= range.end;
  const attempts = data.attempts.filter(row => inRange(row) && validMark(row.earnedMarks, row.totalMarks) && Number.isFinite(row.score) && row.score >= 0 && row.score <= 100);
  const average = (rows: ScoreAttempt[]) => rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : null;
  const groups = new Map<string, { id: string; name: string; attempts: ScoreAttempt[] }>();
  for (const attempt of attempts) {
    const key = attempt.profileId ?? 'unprofiled';
    const group = groups.get(key) ?? { id: key, name: attempt.profileName, attempts: [] };
    group.attempts.push(attempt); groups.set(key, group);
  }
  return { attempts, average: average(attempts), exams: average(attempts.filter(row => row.source === 'exam')), quizzes: average(attempts.filter(row => row.source === 'quiz')),
    pending: data.pending.filter(inRange), profiles: [...groups.values()].map(group => ({ ...group, exams: average(group.attempts.filter(row => row.source === 'exam')), quizzes: average(group.attempts.filter(row => row.source === 'quiz')) })) };
}
