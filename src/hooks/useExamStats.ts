import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfWeek, endOfWeek, startOfMonth, format,
  subDays, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
} from "date-fns";

interface SubjectData {
  name: string;
  color: string;
  avgScore: number;
  count: number;
  value: number;
}

interface TimeSeriesData {
  period: string;
  [key: string]: number | string;
}

interface RecentExam {
  id: string;
  subject: string;
  subjectColor: string;
  examTitle: string;
  score: number;
  dateTaken: string;
  timeSpent: string;
  totalMarks: number;
  earnedMarks: number;
}

interface BestSubject {
  name: string;
  color: string;
  avgScore: number;
  totalExams: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface StudyActivityData {
  day: string;
  [key: string]: number | string;
}

interface RevisionGoal {
  subject: string;
  targetPercentage: number;
  deadline: string;
  currentAverage: number;
  color: string;
}

type TimeRange = 'weekly' | 'monthly' | 'yearly';

/**
 * Safe percentage. Returns null rather than Infinity/NaN when a submission has
 * zero or missing total_marks — a single poisoned row used to propagate through
 * every average and silently blank the charts.
 */
const toPct = (score: unknown, marks: unknown): number | null => {
  const s = Number(score);
  const m = Number(marks);
  if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) return null;
  return Math.max(0, Math.min(100, (s / m) * 100));
};

interface Bucket {
  key: string;
  label: string;
}

/**
 * Buckets for a range, oldest first. `key` is a collision-proof date key —
 * bucketing by display label alone merged e.g. Jan 2025 with Jan 2026, and
 * merged every past Tuesday into this week's Tuesday.
 */
const buildBuckets = (range: TimeRange, now: Date): Bucket[] => {
  if (range === 'weekly') {
    // Genuinely the last 7 days, not "any submission that fell on a Tuesday".
    return eachDayOfInterval({ start: subDays(now, 6), end: now }).map(d => ({
      key: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE'),
    }));
  }
  if (range === 'monthly') {
    // Genuinely the last 30 days, grouped by week. Previously this was
    // month-to-date, so early in a month the chart was near-empty.
    return eachWeekOfInterval(
      { start: subDays(now, 29), end: now },
      { weekStartsOn: 1 }
    ).map(w => ({
      key: format(startOfWeek(w, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      label: format(startOfWeek(w, { weekStartsOn: 1 }), 'd MMM'),
    }));
  }
  // Rolling 12 months rather than the current calendar year, so January
  // isn't a one-point chart.
  return eachMonthOfInterval({
    start: startOfMonth(subMonths(now, 11)),
    end: now,
  }).map(m => ({
    key: format(m, 'yyyy-MM'),
    label: format(m, 'MMM'),
  }));
};

/** Which bucket a given date belongs to, in the same key space as buildBuckets. */
const bucketKeyFor = (date: Date, range: TimeRange): string => {
  if (range === 'weekly') return format(date, 'yyyy-MM-dd');
  if (range === 'monthly') return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return format(date, 'yyyy-MM');
};

export const useExamStats = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [totalExams, setTotalExams] = useState(0);
  const [completedExams, setCompletedExams] = useState(0);
  const [inProgressExams, setInProgressExams] = useState(0);

  // Raw rows are held in state; every range-dependent view is derived from
  // them below. Changing the range is now pure client-side maths — it used to
  // refire eight Supabase queries and blank the page behind a spinner.
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [subjectColors, setSubjectColors] = useState<Record<string, string>>({});

  const [studyActivityData, setStudyActivityData] = useState<StudyActivityData[]>([]);
  const [revisionGoalRows, setRevisionGoalRows] = useState<any[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [pieChartMode, setPieChartMode] = useState<'score' | 'count'>('score');

  const formatTimeSpent = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const colorFor = useCallback(
    (subject?: string) => (subject ? subjectColors[subject.toLowerCase()] : undefined) || '#3B82F6',
    [subjectColors]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: exams } = await supabase
        .from('exams')
        .select('id, subject_id, title, created_at, status')
        .eq('user_id', user.id);

      const publishedExams = exams?.filter(e => e.status === 'published') || [];
      setTotalExams(publishedExams.length);

      const { data: subs } = await supabase
        .from('exam_submissions')
        .select('*, exams!inner(subject_id, title)')
        .eq('student_id', user.id)
        .eq('status', 'graded')
        .order('submitted_at', { ascending: false });

      const rows = subs || [];
      setSubmissions(rows);
      setCompletedExams(rows.length);
      setInProgressExams(Math.max(0, publishedExams.length - rows.length));

      const { data: userSubjects } = await supabase
        .from('user_subjects')
        .select('subject_name, subject_color')
        .eq('user_id', user.id);

      const colorMap: Record<string, string> = {};
      (userSubjects || []).forEach(s => {
        colorMap[s.subject_name.toLowerCase()] = s.subject_color;
      });
      setSubjectColors(colorMap);

      // ── Study activity (current week) ─────────────────────────────────
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const [{ data: tasks }, { data: weekSubmissions }, { data: practiceProgress }] =
        await Promise.all([
          supabase
            .from('revision_tasks')
            .select('subject, duration, date')
            .eq('user_id', user.id)
            .gte('date', weekStart.toISOString())
            .lte('date', weekEnd.toISOString()),
          supabase
            .from('exam_submissions')
            .select('time_taken_seconds, submitted_at, exams!inner(subject_id)')
            .eq('student_id', user.id)
            .eq('status', 'graded')
            .gte('submitted_at', weekStart.toISOString())
            .lte('submitted_at', weekEnd.toISOString()),
          supabase
            .from('practice_set_progress')
            .select('time_spent_seconds, completed_at, practice_question_sets!inner(subject_id)')
            .eq('user_id', user.id)
            .not('completed_at', 'is', null)
            .gte('completed_at', weekStart.toISOString())
            .lte('completed_at', weekEnd.toISOString()),
        ]);

      const studyMap = new Map<string, Map<string, number>>();
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      days.forEach(day => studyMap.set(day, new Map()));

      const addStudy = (dayName: string, subject: string, hours: number) => {
        const bucket = studyMap.get(dayName);
        if (!bucket || !subject || !Number.isFinite(hours)) return;
        bucket.set(subject, (bucket.get(subject) || 0) + hours);
      };

      (tasks || []).forEach(task => {
        addStudy(format(new Date(task.date), 'EEEE'), task.subject, (task.duration || 0) / 60);
      });
      (weekSubmissions || []).forEach(sub => {
        addStudy(
          format(new Date(sub.submitted_at), 'EEEE'),
          (sub.exams as any).subject_id,
          (sub.time_taken_seconds || 0) / 3600
        );
      });
      (practiceProgress || []).forEach(p => {
        addStudy(
          format(new Date(p.completed_at!), 'EEEE'),
          (p.practice_question_sets as any).subject_id,
          (p.time_spent_seconds || 0) / 3600
        );
      });

      setStudyActivityData(days.map(day => {
        const data: StudyActivityData = { day };
        studyMap.get(day)!.forEach((hours, subject) => {
          data[subject] = Math.round(hours * 10) / 10;
        });
        return data;
      }));

      const { data: goals } = await supabase
        .from('revision_goals')
        .select('subject, target_percentage, deadline, subject_color')
        .eq('user_id', user.id);
      setRevisionGoalRows(goals || []);

      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak, longest_streak, last_exam_submitted_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (streakData?.last_exam_submitted_at) {
        const hoursSince =
          (Date.now() - new Date(streakData.last_exam_submitted_at).getTime()) / 3600000;
        setCurrentStreak(hoursSince <= 24 ? streakData.current_streak : 0);
        setLongestStreak(streakData.longest_streak);
      } else {
        setCurrentStreak(0);
        setLongestStreak(0);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching exam stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once. Range changes no longer touch the network.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived: subject performance ────────────────────────────────────
  const subjectPerformanceData = useMemo<SubjectData[]>(() => {
    const stats = new Map<string, { total: number; count: number }>();
    submissions.forEach(sub => {
      const subject = sub.exams?.subject_id;
      const pct = toPct(sub.total_score, sub.total_marks);
      if (!subject || pct === null) return;
      const entry = stats.get(subject) || { total: 0, count: 0 };
      entry.total += pct;
      entry.count += 1;
      stats.set(subject, entry);
    });
    return Array.from(stats.entries()).map(([name, s]) => ({
      name,
      color: colorFor(name),
      avgScore: s.total / s.count,
      count: s.count,
      value: s.total / s.count,
    }));
  }, [submissions, colorFor]);

  // ── Derived: best subject, with a like-for-like trend ────────────────
  const bestSubject = useMemo<BestSubject | null>(() => {
    if (subjectPerformanceData.length === 0) return null;
    const best = [...subjectPerformanceData].sort((a, b) => b.avgScore - a.avgScore)[0];

    const now = new Date();
    const windowStart = subDays(now, 30);
    const priorStart = subDays(now, 60);

    const avgIn = (from: Date, to: Date) => {
      const vals = submissions
        .filter(s => {
          if (s.exams?.subject_id !== best.name || !s.submitted_at) return false;
          const d = new Date(s.submitted_at);
          return d >= from && d < to;
        })
        .map(s => toPct(s.total_score, s.total_marks))
        .filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const recent = avgIn(windowStart, now);
    const prior = avgIn(priorStart, windowStart);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendValue = 0;
    if (recent !== null && prior !== null) {
      trendValue = recent - prior;
      if (trendValue > 2) trend = 'up';
      else if (trendValue < -2) trend = 'down';
    }

    return {
      name: best.name,
      color: best.color,
      avgScore: best.avgScore,
      totalExams: best.count,
      trend,
      trendValue: Math.abs(trendValue),
    };
  }, [subjectPerformanceData, submissions]);

  // ── Derived: time series. Pure recompute on range change. ────────────
  const examResultsData = useMemo<TimeSeriesData[]>(() => {
    const buckets = buildBuckets(timeRange, new Date());
    const valid = new Set(buckets.map(b => b.key));
    const grouped = new Map<string, Map<string, number[]>>();

    submissions.forEach(sub => {
      const subject = sub.exams?.subject_id;
      const pct = toPct(sub.total_score, sub.total_marks);
      if (!subject || pct === null || !sub.submitted_at) return;

      const key = bucketKeyFor(new Date(sub.submitted_at), timeRange);
      if (!valid.has(key)) return; // outside the window — previously unfiltered

      if (!grouped.has(key)) grouped.set(key, new Map());
      const bySubject = grouped.get(key)!;
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject)!.push(pct);
    });

    return buckets.map(({ key, label }) => {
      const row: TimeSeriesData = { period: label };
      grouped.get(key)?.forEach((scores, subject) => {
        row[subject] = scores.reduce((a, b) => a + b, 0) / scores.length;
      });
      return row;
    });
  }, [submissions, timeRange]);

  // ── Derived: recent exams ───────────────────────────────────────────
  const recentExams = useMemo<RecentExam[]>(
    () =>
      submissions.slice(0, 10).map(sub => ({
        id: sub.exam_id,
        subject: sub.exams?.subject_id,
        subjectColor: colorFor(sub.exams?.subject_id),
        examTitle: sub.exams?.title,
        score: toPct(sub.total_score, sub.total_marks) ?? 0,
        dateTaken: sub.submitted_at ? format(new Date(sub.submitted_at), 'MMM d, yyyy') : '—',
        timeSpent: formatTimeSpent(sub.time_taken_seconds || 0),
        totalMarks: sub.total_marks,
        earnedMarks: Math.round(sub.total_score),
      })),
    [submissions, colorFor]
  );

  // ── Derived: revision goals ─────────────────────────────────────────
  // Previously this read the subjectPerformanceData *state* from inside
  // fetchData's closure, which was always [] on first run — so goals never
  // appeared until some later refetch happened to fire.
  const revisionGoals = useMemo<RevisionGoal[]>(
    () =>
      revisionGoalRows
        .filter(g => g.target_percentage !== null)
        .map(goal => ({
          subject: goal.subject,
          targetPercentage: goal.target_percentage,
          deadline: goal.deadline || '',
          currentAverage:
            subjectPerformanceData.find(
              s => s.name.toLowerCase() === goal.subject.toLowerCase()
            )?.avgScore || 0,
          color: goal.subject_color || '#3B82F6',
        })),
    [revisionGoalRows, subjectPerformanceData]
  );

  return {
    loading,
    error,
    totalExams,
    completedExams,
    inProgressExams,
    subjectPerformanceData,
    examResultsData,
    studyActivityData,
    recentExams,
    bestSubject,
    revisionGoals,
    currentStreak,
    longestStreak,
    timeRange,
    setTimeRange,
    pieChartMode,
    setPieChartMode,
    refetch: fetchData,
  };
};
