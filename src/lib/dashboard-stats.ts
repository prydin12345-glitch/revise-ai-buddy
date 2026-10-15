import {
  addDays, addMonths, differenceInCalendarDays, eachDayOfInterval, endOfDay,
  endOfMonth, endOfWeek, format, isValid, parseISO, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';

export const STATS_SECTIONS = ['exams', 'scores', 'study-hours', 'streak'] as const;
export type StatsSection = typeof STATS_SECTIONS[number];
export type DrilldownType = StatsSection | null;
export type StudySource = 'exam' | 'practice' | 'feedback' | 'revision';
export const STUDY_SOURCES: StudySource[] = ['exam', 'practice', 'feedback', 'revision'];
export interface StudySession {
  id: string;
  /** Full timestamp or local YYYY-MM-DD, never a formatted month/day label. */
  date: string;
  /** Minutes; retain fractions so short sessions are not rounded away. */
  duration: number;
  source: StudySource;
}
export interface ExamItem {
  id: string;
  title: string;
  subject: string;
  dateTaken: string;
  score: number;
  totalMarks: number;
  earnedMarks: number;
  isReleased: boolean;
  status?: string;
  profileId?: string | null;
}
export interface ActivityDay {
  date: string;
  exams: number;
  quizzes: number;
  revision: number;
}
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  activity: ActivityDay[];
  todayActivity: string[];
}
export type StudyRangeMode = 'week' | 'month' | 'custom';
export interface StudyPeriod {
  mode: StudyRangeMode;
  anchor: string;
  from: string;
  to: string;
}
export interface DateInterval { start: Date; end: Date }
export interface StudyBucket {
  key: string;
  label: string;
  fullLabel: string;
  minutes: Record<StudySource, number>;
  total: number;
}
export const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export function parseDay(value: string): Date {
  const day = parseISO(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(day) || dateKey(day) !== value) {
    throw new Error('Choose a valid date.');
  }
  return day;
}

export function initialStudyPeriod(now = new Date()): StudyPeriod {
  const today = dateKey(now);
  return { mode: 'week', anchor: today, from: dateKey(startOfWeek(now, { weekStartsOn: 1 })), to: today };
}

export function resolveStudyPeriod(period: StudyPeriod, now = new Date()): DateInterval {
  const anchor = parseDay(period.anchor);
  if (period.mode === 'week') return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (period.mode === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  const start = parseDay(period.from);
  const end = parseDay(period.to);
  if (end < start) throw new Error('The end date must be on or after the start date.');
  if (end > endOfDay(now)) throw new Error('Choose an end date of today or earlier.');
  if (differenceInCalendarDays(end, start) >= 366) throw new Error('Choose a range of up to 366 days.');
  return { start: startOfDay(start), end: endOfDay(end) };
}

export function shiftStudyPeriod(period: StudyPeriod, direction: -1 | 1): StudyPeriod {
  const anchor = parseDay(period.anchor);
  return { ...period, anchor: dateKey(period.mode === 'month' ? addMonths(startOfMonth(anchor), direction) : addDays(anchor, direction * 7)) };
}

export function formatStudyMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0h 0m';
  if (minutes < 1) return '<1m';
  const whole = Math.round(minutes);
  return whole >= 60 ? `${Math.floor(whole / 60)}h ${whole % 60}m` : `${whole}m`;
}

export const emptySourceTotals = (): Record<StudySource, number> => ({ exam: 0, practice: 0, feedback: 0, revision: 0 });

export function studySummary(sessions: StudySession[], interval: DateInterval) {
  const days = eachDayOfInterval(interval);
  // Month views retain every day. Longer custom ranges use at most 31 labelled buckets.
  const bucketDays = Math.max(1, Math.ceil(days.length / 31));
  const buckets: StudyBucket[] = [];
  const lookup = new Map<string, StudyBucket>();
  for (let index = 0; index < days.length; index += bucketDays) {
    const first = days[index];
    const last = days[Math.min(index + bucketDays - 1, days.length - 1)];
    const bucket = {
      key: dateKey(first),
      label: bucketDays === 1 ? (days.length === 7 ? format(first, 'EEEEE') : format(first, 'd')) : format(first, 'd MMM'),
      fullLabel: bucketDays === 1 ? format(first, 'EEEE d MMMM yyyy') : `${format(first, 'd MMM yyyy')} – ${format(last, 'd MMM yyyy')}`,
      minutes: emptySourceTotals(), total: 0,
    };
    buckets.push(bucket);
    for (let j = index; j < Math.min(index + bucketDays, days.length); j++) lookup.set(dateKey(days[j]), bucket);
  }
  const totals = emptySourceTotals();
  sessions.forEach(session => {
    const date = parseISO(session.date);
    if (!isValid(date) || date < interval.start || date > interval.end || !STUDY_SOURCES.includes(session.source) || !Number.isFinite(session.duration) || session.duration <= 0) return;
    const bucket = lookup.get(dateKey(date));
    if (!bucket) return;
    bucket.minutes[session.source] += session.duration;
    bucket.total += session.duration;
    totals[session.source] += session.duration;
  });
  return { buckets, totals, totalMinutes: STUDY_SOURCES.reduce((sum, source) => sum + totals[source], 0), bucketDays };
}

export function calendarDays(month: string) {
  const first = startOfMonth(parseDay(month));
  return eachDayOfInterval({ start: startOfWeek(first, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }) });
}

export function activityCount(day?: ActivityDay): number {
  return day ? day.exams + day.quizzes + day.revision : 0;
}

export function activityDescriptions(day?: ActivityDay): string[] {
  if (!day) return [];
  return [
    day.exams > 0 ? `${day.exams} exam${day.exams === 1 ? '' : 's'} submitted` : '',
    day.quizzes > 0 ? `${day.quizzes} quiz${day.quizzes === 1 ? '' : 'zes'} completed` : '',
    day.revision > 0 ? `${day.revision} revision task${day.revision === 1 ? '' : 's'} completed` : '',
  ].filter(Boolean);
}

/** Finger-left goes to the previous section, as requested (Scores → Exams). */
export function adjacentStatsSection(section: StatsSection, deltaX: number): StatsSection | null {
  const index = STATS_SECTIONS.indexOf(section) + (deltaX < 0 ? -1 : 1);
  return STATS_SECTIONS[index] ?? null;
}
