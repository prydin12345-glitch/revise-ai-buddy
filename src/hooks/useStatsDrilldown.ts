import { useState, useEffect, useCallback } from 'react';
import { endOfDay, endOfMonth, isValid, parseISO, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSession } from '@/hooks/use-workspace-session';
import { EMPTY_SCORES, initialScorePeriod, type ScoreData } from '@/lib/dashboard-scores';
import { loadDashboardScores } from '@/lib/dashboard-score-loader';
import {
  dateKey, initialStudyPeriod, parseDay, resolveStudyPeriod, studySummary,
  type DateInterval, type DrilldownType, type ExamItem, type StreakData, type StudyPeriod, type StudySession,
} from '@/lib/dashboard-stats';
import {
  examItems, readStatsPages, streakActivity, studySessionsFromRows, SUBMITTED_STATUSES,
  type PracticeRow, type SubmissionRow, type TaskRow,
} from '@/lib/dashboard-stats-data';

interface StatsData {
  completedExams: ExamItem[];
  scoreBreakdown: ExamItem[];
  excludedCount: number;
  studySessions: StudySession[];
  totalHours: number;
  streakData?: StreakData;
  scores: ScoreData;
}
const EMPTY: StatsData = { completedExams: [], scoreBreakdown: [], excludedCount: 0, studySessions: [], totalHours: 0, scores: EMPTY_SCORES };

async function fetchExams(userId: string, signal: AbortSignal): Promise<StatsData> {
  const rows = await readStatsPages<SubmissionRow>((from, to) => supabase
    .from('exam_submission_metadata')
    .select('id, exam_id, total_score, total_marks, submitted_at, status, exams!inner(title, subject_id, grade_released)')
    .eq('student_id', userId).in('status', SUBMITTED_STATUSES)
    .order('submitted_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal);
  const exams = examItems(rows);
  return { ...EMPTY, completedExams: exams, scoreBreakdown: exams.filter(exam => exam.isReleased), excludedCount: exams.filter(exam => !exam.isReleased).length };
}

async function activityRows(userId: string, range: DateInterval, signal: AbortSignal, forStreak: boolean) {
  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const taskDate = forStreak ? 'updated_at' : 'date';
  const [exams, practice, tasks] = await Promise.all([
    readStatsPages<SubmissionRow>((from, to) => supabase.from('exam_submission_metadata')
      .select('id, submitted_at, time_taken_seconds').eq('student_id', userId).in('status', SUBMITTED_STATUSES)
      .gte('submitted_at', start).lte('submitted_at', end).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<PracticeRow>((from, to) => supabase.from('practice_set_progress')
      .select('id, completed_at, time_spent_seconds').eq('user_id', userId).not('completed_at', 'is', null)
      .gte('completed_at', start).lte('completed_at', end).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<TaskRow>((from, to) => supabase.from('revision_tasks')
      .select('id, date, duration, updated_at, is_completed').eq('user_id', userId).eq('is_completed', true)
      .gte(taskDate, start).lte(taskDate, end)
      .order('id').range(from, to).abortSignal(signal), signal),
  ]);
  return { exams, practice, tasks };
}

async function fetchStudy(userId: string, period: StudyPeriod, signal: AbortSignal): Promise<StatsData> {
  const range = resolveStudyPeriod(period);
  const { exams, practice, tasks } = await activityRows(userId, range, signal, false);
  const sessions = studySessionsFromRows(exams, practice, tasks);
  return { ...EMPTY, studySessions: sessions, totalHours: studySummary(sessions, range).totalMinutes / 60 };
}

async function fetchStreak(userId: string, month: string, signal: AbortSignal): Promise<StatsData> {
  const now = new Date();
  const selected = parseDay(month);
  const ranges = [{ start: startOfMonth(selected), end: endOfMonth(selected) }];
  const thisWeek = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
  // A historical calendar still shows this week's goal; don't download every intervening month.
  if (thisWeek.start < ranges[0].start || thisWeek.end > ranges[0].end) ranges.push(thisWeek);
  const [record, groups] = await Promise.all([
    supabase.from('user_streaks').select('current_streak, longest_streak, last_exam_submitted_at')
      .eq('user_id', userId).abortSignal(signal).maybeSingle().throwOnError(),
    Promise.all(ranges.map(range => activityRows(userId, range, signal, true))),
  ]);
  const streak = record.data;
  const activity = streakActivity(groups.flatMap(group => group.exams), groups.flatMap(group => group.practice), groups.flatMap(group => group.tasks), now);
  const last = streak?.last_exam_submitted_at;
  const lastDay = last && isValid(parseISO(last)) ? dateKey(parseISO(last)) : null;
  const current = lastDay === dateKey(now) || lastDay === dateKey(subDays(now, 1)) ? streak?.current_streak ?? 0 : 0;
  return { ...EMPTY, streakData: { currentStreak: current, longestStreak: streak?.longest_streak ?? 0, lastActiveDate: last ?? undefined, ...activity } };
}

export const useStatsDrilldown = () => {
  const { ownerId, ready } = useWorkspaceSession();
  const [activeDrawer, setActiveDrawer] = useState<DrilldownType>(null);
  const [studyPeriod, setStudyPeriod] = useState(initialStudyPeriod);
  const [streakMonth, setStreakMonth] = useState(() => dateKey(startOfMonth(new Date())));
  const [scorePeriod, setScorePeriod] = useState(initialScorePeriod);
  const [retryToken, setRetryToken] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: StatsData; error?: string }>({ key: '' });
  const scoreYear = scorePeriod.anchor.slice(0, 4);
  const rangeKey = activeDrawer === 'study-hours' ? JSON.stringify(studyPeriod) : activeDrawer === 'streak' ? streakMonth : activeDrawer === 'scores' ? scoreYear : '';
  const key = JSON.stringify([ownerId, activeDrawer, rangeKey, retryToken]);

  // Account switches cannot expose the previous owner's drawer or cached results.
  useEffect(() => { setActiveDrawer(null); setResult({ key: '' }); }, [ownerId]);

  useEffect(() => {
    if (!activeDrawer || !ready || !ownerId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || data.user?.id !== ownerId) throw new Error('Sign in again to view your activity.');
        if (controller.signal.aborted) return;
        const stats = activeDrawer === 'study-hours' ? await fetchStudy(ownerId, studyPeriod, controller.signal)
          : activeDrawer === 'streak' ? await fetchStreak(ownerId, streakMonth, controller.signal)
          : activeDrawer === 'scores' ? await (async (): Promise<StatsData> => {
            const { exams, scores } = await loadDashboardScores(ownerId, scoreYear, controller.signal);
            return { ...EMPTY, scores, completedExams: exams, scoreBreakdown: exams.filter(exam => exam.isReleased), excludedCount: exams.filter(exam => !exam.isReleased).length };
          })() : await fetchExams(ownerId, controller.signal);
        if (!controller.signal.aborted) setResult({ key, data: stats });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Couldn’t load your activity. Please try again.' });
      }
    };
    void load();
    return () => controller.abort();
  }, [activeDrawer, ready, ownerId, studyPeriod, streakMonth, scoreYear, key]);

  const openDrawer = useCallback((type: DrilldownType) => {
    if (type) { setRetryToken(value => value + 1); setActiveDrawer(type); }
  }, []);
  const closeDrawer = useCallback(() => { setActiveDrawer(null); setResult({ key: '' }); }, []);
  const retry = useCallback(() => setRetryToken(value => value + 1), []);
  const data = result.key === key ? result.data ?? EMPTY : EMPTY;
  const error = result.key === key ? result.error : undefined;
  return {
    activeDrawer, openDrawer, closeDrawer, retry,
    loading: !!activeDrawer && ready && !!ownerId && result.key !== key,
    error: activeDrawer && !ownerId ? 'Sign in to view your activity.' : error,
    ...data, studyPeriod, setStudyPeriod, streakMonth, setStreakMonth, scorePeriod, setScorePeriod,
  };
};
