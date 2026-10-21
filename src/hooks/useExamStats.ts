import { useQuery } from "@tanstack/react-query";
import { useWorkspaceQueryScope } from "./use-workspace-query-client";
import { examStatsQuery } from "@/lib/exam-stats-query";
import { useState, useMemo, useCallback } from "react";
import {
  startOfWeek, startOfMonth, format,
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
  const { store, client } = useWorkspaceQueryScope();
  const query = useQuery({ ...examStatsQuery(store), refetchOnMount: "always", retryOnMount: false }, client);
  const loading = query.isPending;
  const error = query.error;
  const totalExams = query.data?.totalExams || 0;
  const completedExams = query.data?.completedExams || 0;
  const inProgressExams = query.data?.inProgressExams || 0;
  const submissions = query.data?.submissions || [];
  const subjectColors = query.data?.subjectColors || {};
  const studyActivityData = query.data?.studyActivityData || [];
  const revisionGoalRows = query.data?.revisionGoalRows || [];
  const currentStreak = query.data?.currentStreak || 0;
  const longestStreak = query.data?.longestStreak || 0;

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

  const fetchData = () => query.refetch({ cancelRefetch: false });

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
    refreshing: query.isFetching && !!query.data,
    hasData: !!query.data,
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
