import { isValid, parseISO } from 'date-fns';
import { activityDescriptions, dateKey, type ActivityDay, type ExamItem, type StudySession } from './dashboard-stats';

export const SUBMITTED_STATUSES = ['submitted', 'completed', 'graded', 'marking', 'marking_failed'];
export interface SubmissionRow {
  id: string | null;
  exam_id?: string | null;
  submitted_at: string | null;
  time_taken_seconds?: number | null;
  total_score?: number | null;
  total_marks?: number | null;
  status?: string | null;
  exams?: { title: string; subject_id: string; grade_released: boolean | null } | null;
}
export interface PracticeRow { id: string; completed_at: string | null; time_spent_seconds?: number | null }
export interface TaskRow { id: string; date: string; duration?: number | null; updated_at?: string; is_completed?: boolean }
const validTimestamp = (value?: string | null): value is string => !!value && isValid(parseISO(value));

export function examItems(rows: SubmissionRow[]): ExamItem[] {
  return rows.filter(row => row.exam_id && row.exams && validTimestamp(row.submitted_at) && SUBMITTED_STATUSES.includes(row.status ?? '')).map(row => {
    const marks = row.total_marks;
    const score = row.total_score;
    const released = row.status === 'graded' && row.exams!.grade_released !== false &&
      typeof marks === 'number' && Number.isFinite(marks) && marks > 0 &&
      typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= marks;
    return {
      id: row.exam_id!, title: row.exams!.title, subject: row.exams!.subject_id,
      dateTaken: row.submitted_at!, status: row.status ?? undefined,
      // Unmarked, failed and unreleased work never becomes a zero in the average.
      isReleased: released, score: released ? (score! / marks!) * 100 : 0,
      totalMarks: released ? marks! : 0, earnedMarks: released ? score! : 0,
    };
  });
}

export function studySessionsFromRows(exams: SubmissionRow[], practice: PracticeRow[], tasks: TaskRow[]): StudySession[] {
  const sessions: StudySession[] = [];
  const seen = new Set<string>();
  const add = (id: string | null, date: string | null, duration: number | null | undefined, source: StudySession['source']) => {
    const key = `${source}:${id}`;
    if (!id || seen.has(key) || !validTimestamp(date) || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return;
    seen.add(key);
    sessions.push({ id, date, duration, source });
  };
  exams.forEach(row => add(row.id, row.submitted_at, (row.time_taken_seconds ?? 0) / 60, 'exam'));
  practice.forEach(row => add(row.id, row.completed_at, (row.time_spent_seconds ?? 0) / 60, 'practice'));
  tasks.filter(row => row.is_completed !== false).forEach(row => add(row.id, row.date, row.duration, 'revision'));
  // A tutor's responded_at is neither a student review event nor a measured duration.
  // Keep the feedback category in the UI, but do not fabricate review minutes.
  return sessions;
}

export function streakActivity(exams: SubmissionRow[], practice: PracticeRow[], tasks: TaskRow[], now = new Date()) {
  const activity = new Map<string, ActivityDay>();
  const seen = new Set<string>();
  const add = (id: string | null, timestamp: string | null | undefined, source: 'exams' | 'quizzes' | 'revision') => {
    if (!id || !validTimestamp(timestamp) || parseISO(timestamp) > now || seen.has(`${source}:${id}`)) return;
    seen.add(`${source}:${id}`);
    const date = dateKey(parseISO(timestamp));
    const day = activity.get(date) ?? { date, exams: 0, quizzes: 0, revision: 0 };
    day[source]++;
    activity.set(date, day);
  };
  exams.forEach(row => add(row.id, row.submitted_at, 'exams'));
  practice.forEach(row => add(row.id, row.completed_at, 'quizzes'));
  tasks.filter(row => row.is_completed !== false).forEach(row => add(row.id, row.updated_at, 'revision'));
  return { activity: [...activity.values()].sort((a, b) => a.date.localeCompare(b.date)), todayActivity: activityDescriptions(activity.get(dateKey(now))) };
}

/** PostgREST caps a response; page explicitly rather than silently losing a busy month. */
export async function readStatsPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; from < 20_000; from += size) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = await page(from, from + size - 1);
    if (result.error) throw new Error('Couldn’t load your activity. Please try again.');
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < size) return rows;
  }
  throw new Error('There’s too much activity to load at once. Choose a shorter date range.');
}
