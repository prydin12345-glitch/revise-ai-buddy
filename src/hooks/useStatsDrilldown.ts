import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subDays, startOfDay, endOfDay } from 'date-fns';
import { DrilldownType } from '@/components/dashboard/StatsDrilldownDrawer';

export type TimeRangeOption = 'week' | 'month' | '3months' | 'all';

interface ExamItem {
  id: string;
  title: string;
  subject: string;
  dateTaken: string;
  score: number;
  totalMarks: number;
  earnedMarks: number;
  isReleased: boolean;
}

interface StudySession {
  id: string;
  date: string;
  duration: number;
  source: 'exam' | 'practice' | 'feedback' | 'revision';
  subject?: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  recentActivity: { date: string; hasActivity: boolean }[];
  todayActivity: string[];
}

// Utility to get date range based on filter
export const getTimeRange = (filter: TimeRangeOption): { start?: Date; end?: Date } => {
  const now = new Date();
  
  switch (filter) {
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case '3months':
      return {
        start: startOfMonth(subMonths(now, 2)),
        end: endOfMonth(now),
      };
    case 'all':
      return {
        start: undefined,
        end: undefined,
      };
    default:
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
  }
};

export const useStatsDrilldown = () => {
  const [activeDrawer, setActiveDrawer] = useState<DrilldownType>(null);
  const [loading, setLoading] = useState(false);
  const [studyTimeRange, setStudyTimeRange] = useState<TimeRangeOption>('week');
  
  // Exams data
  const [completedExams, setCompletedExams] = useState<ExamItem[]>([]);
  
  // Scores data
  const [averageScore, setAverageScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<ExamItem[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  
  // Study hours data
  const [totalHours, setTotalHours] = useState(0);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<{ day: string; hours: number }[]>([]);
  
  // Streak data
  const [streakData, setStreakData] = useState<StreakData | undefined>();

  const fetchExamsData = async (userId: string) => {
    // Fetch completed exam submissions
    const { data: submissions } = await supabase
      .from('exam_submissions')
      .select(`
        id,
        exam_id,
        total_score,
        total_marks,
        submitted_at,
        status,
        exams!inner(title, subject_id, grade_released)
      `)
      .eq('student_id', userId)
      .in('status', ['submitted', 'completed', 'graded'])
      .order('submitted_at', { ascending: false });

    if (submissions) {
      const exams: ExamItem[] = submissions.map(sub => ({
        id: sub.exam_id,
        title: (sub.exams as any).title,
        subject: (sub.exams as any).subject_id,
        dateTaken: format(new Date(sub.submitted_at || ''), 'MMM d, yyyy'),
        score: sub.total_marks > 0 ? (sub.total_score / sub.total_marks) * 100 : 0,
        totalMarks: sub.total_marks || 0,
        earnedMarks: Math.round(sub.total_score || 0),
        isReleased: (sub.exams as any).grade_released !== false,
      }));
      
      setCompletedExams(exams);
      
      // Calculate scores (only released exams)
      const releasedExams = exams.filter(e => e.isReleased && e.totalMarks > 0);
      const excluded = exams.filter(e => !e.isReleased).length;
      
      if (releasedExams.length > 0) {
        const avg = releasedExams.reduce((sum, e) => sum + e.score, 0) / releasedExams.length;
        setAverageScore(Math.round(avg));
        setScoreBreakdown(releasedExams);
      }
      setExcludedCount(excluded);
    }
  };

  const fetchStudyData = async (userId: string, timeRange: TimeRangeOption) => {
    const { start, end } = getTimeRange(timeRange);
    
    // Build base queries with optional date filters
    let tasksQuery = supabase
      .from('revision_tasks')
      .select('id, subject, duration, date, is_completed')
      .eq('user_id', userId)
      .eq('is_completed', true);
    
    let examSessionsQuery = supabase
      .from('exam_submissions')
      .select(`
        id,
        time_taken_seconds,
        submitted_at,
        exams!inner(subject_id)
      `)
      .eq('student_id', userId)
      .in('status', ['submitted', 'completed', 'graded']);
    
    let practiceProgressQuery = supabase
      .from('practice_set_progress')
      .select(`
        id,
        time_spent_seconds,
        completed_at,
        practice_question_sets!inner(subject_id, set_name)
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null);

    // Fetch feedback threads reviewed by the user (time spent reviewing feedback)
    let feedbackQuery = supabase
      .from('question_feedback_threads')
      .select('id, created_at, responded_at')
      .eq('student_id', userId)
      .not('responded_at', 'is', null);

    // Apply date filters if not "all time"
    if (start && end) {
      tasksQuery = tasksQuery.gte('date', start.toISOString()).lte('date', end.toISOString());
      examSessionsQuery = examSessionsQuery.gte('submitted_at', start.toISOString()).lte('submitted_at', end.toISOString());
      practiceProgressQuery = practiceProgressQuery.gte('completed_at', start.toISOString()).lte('completed_at', end.toISOString());
      feedbackQuery = feedbackQuery.gte('responded_at', start.toISOString()).lte('responded_at', end.toISOString());
    }

    const [
      { data: tasks },
      { data: examSessions },
      { data: practiceProgress },
      { data: feedbackThreads },
    ] = await Promise.all([
      tasksQuery,
      examSessionsQuery,
      practiceProgressQuery,
      feedbackQuery,
    ]);

    // Build sessions list with correct source types
    const sessions: StudySession[] = [];
    
    // Revision tasks
    if (tasks) {
      tasks.forEach(task => {
        if (task.duration && task.duration > 0) {
          sessions.push({
            id: task.id,
            date: format(new Date(task.date), 'MMM d'),
            duration: task.duration, // Already in minutes
            source: 'revision',
            subject: task.subject,
          });
        }
      });
    }

    // Exam sessions
    if (examSessions) {
      examSessions.forEach(sub => {
        if (sub.time_taken_seconds && sub.time_taken_seconds > 0) {
          sessions.push({
            id: sub.id,
            date: format(new Date(sub.submitted_at || ''), 'MMM d'),
            duration: Math.round(sub.time_taken_seconds / 60), // Convert to minutes
            source: 'exam',
            subject: (sub.exams as any).subject_id,
          });
        }
      });
    }

    // Practice quiz sessions
    if (practiceProgress) {
      practiceProgress.forEach(progress => {
        if (progress.time_spent_seconds && progress.time_spent_seconds > 0) {
          sessions.push({
            id: progress.id,
            date: format(new Date(progress.completed_at || ''), 'MMM d'),
            duration: Math.round(progress.time_spent_seconds / 60), // Convert to minutes
            source: 'practice',
            subject: (progress.practice_question_sets as any).subject_id,
          });
        }
      });
    }

    // Feedback review sessions (estimate ~5 minutes per feedback reviewed)
    if (feedbackThreads) {
      feedbackThreads.forEach(thread => {
        sessions.push({
          id: thread.id,
          date: format(new Date(thread.responded_at || ''), 'MMM d'),
          duration: 5, // Estimate 5 minutes per feedback review
          source: 'feedback',
        });
      });
    }

    setStudySessions(sessions);

    // Calculate daily breakdown for the current week (always show current week bars)
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayHours: Record<string, number> = {};
    days.forEach(d => dayHours[d] = 0);

    // Only include sessions from the current week in the daily breakdown
    sessions.forEach(session => {
      // Parse session date back to full date for comparison
      const sessionDateStr = session.date;
      // Find matching sessions by checking if they're in the current week
      // We need to be more precise here - sessions already have duration in minutes
    });

    // For the daily breakdown, we need to re-fetch with week filter specifically
    // or filter the existing sessions by week
    const weekSessions = sessions.filter(session => {
      // We need the original date, but we only have formatted "MMM d"
      // This is a limitation - let's recalculate from the raw data
      return true; // Include all for now, but we'll calculate properly below
    });

    // Recalculate from raw data for week breakdown
    if (tasks) {
      tasks.forEach(task => {
        const taskDate = new Date(task.date);
        if (taskDate >= weekStart && taskDate <= weekEnd) {
          const dayName = format(taskDate, 'EEEE');
          dayHours[dayName] += (task.duration || 0) / 60;
        }
      });
    }

    if (examSessions) {
      examSessions.forEach(sub => {
        const subDate = new Date(sub.submitted_at || '');
        if (subDate >= weekStart && subDate <= weekEnd) {
          const dayName = format(subDate, 'EEEE');
          dayHours[dayName] += (sub.time_taken_seconds || 0) / 3600;
        }
      });
    }

    if (practiceProgress) {
      practiceProgress.forEach(progress => {
        const progressDate = new Date(progress.completed_at || '');
        if (progressDate >= weekStart && progressDate <= weekEnd) {
          const dayName = format(progressDate, 'EEEE');
          if (dayHours[dayName] !== undefined) {
            dayHours[dayName] += (progress.time_spent_seconds || 0) / 3600;
          }
        }
      });
    }

    if (feedbackThreads) {
      feedbackThreads.forEach(thread => {
        const threadDate = new Date(thread.responded_at || '');
        if (threadDate >= weekStart && threadDate <= weekEnd) {
          const dayName = format(threadDate, 'EEEE');
          if (dayHours[dayName] !== undefined) {
            dayHours[dayName] += 5 / 60; // 5 minutes in hours
          }
        }
      });
    }

    const breakdown = days.map(day => ({ day, hours: dayHours[day] }));
    setWeeklyBreakdown(breakdown);
    
    // Total hours is sum of all sessions (not just this week)
    const total = sessions.reduce((sum, s) => sum + s.duration, 0) / 60; // Convert minutes to hours
    setTotalHours(total);
  };

  const fetchStreakData = async (userId: string) => {
    // Fetch user streak record
    const { data: streakRecord } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Get activity for last 14 days
    const recentActivity: { date: string; hasActivity: boolean }[] = [];
    const todayActivity: string[] = [];
    
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Check submissions for last 14 days
    const { data: recentSubmissions } = await supabase
      .from('exam_submissions')
      .select('submitted_at')
      .eq('student_id', userId)
      .in('status', ['submitted', 'completed', 'graded'])
      .gte('submitted_at', subDays(today, 14).toISOString());

    // Check practice answers for last 14 days
    const { data: practiceAnswers } = await supabase
      .from('practice_question_answers')
      .select('submitted_at')
      .eq('user_id', userId)
      .not('submitted_at', 'is', null)
      .gte('submitted_at', subDays(today, 14).toISOString());

    // Build activity map
    const activityDates = new Set<string>();
    
    recentSubmissions?.forEach(sub => {
      if (sub.submitted_at) {
        const dateStr = format(new Date(sub.submitted_at), 'yyyy-MM-dd');
        activityDates.add(dateStr);
        if (dateStr === todayStr) {
          todayActivity.push('Completed an exam');
        }
      }
    });

    practiceAnswers?.forEach(ans => {
      if (ans.submitted_at) {
        const dateStr = format(new Date(ans.submitted_at), 'yyyy-MM-dd');
        activityDates.add(dateStr);
        if (dateStr === todayStr && !todayActivity.includes('Answered practice questions')) {
          todayActivity.push('Answered practice questions');
        }
      }
    });

    // Build 14-day activity array
    for (let i = 13; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      recentActivity.push({
        date: dateStr,
        hasActivity: activityDates.has(dateStr),
      });
    }

    // Calculate current streak properly
    let currentStreak = 0;
    const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
    
    if (streakRecord) {
      const lastActive = streakRecord.last_exam_submitted_at 
        ? format(new Date(streakRecord.last_exam_submitted_at), 'yyyy-MM-dd')
        : null;
      
      // Streak is valid if last activity was today or yesterday
      if (lastActive === todayStr || lastActive === yesterday) {
        currentStreak = streakRecord.current_streak;
      }
    }

    setStreakData({
      currentStreak,
      longestStreak: streakRecord?.longest_streak || 0,
      lastActiveDate: streakRecord?.last_exam_submitted_at || undefined,
      recentActivity,
      todayActivity,
    });
  };

  const openDrawer = useCallback(async (type: DrilldownType) => {
    if (!type) return;
    
    setActiveDrawer(type);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      switch (type) {
        case 'exams':
        case 'scores':
          await fetchExamsData(user.id);
          break;
        case 'study-hours':
          await fetchStudyData(user.id, studyTimeRange);
          break;
        case 'streak':
          await fetchStreakData(user.id);
          break;
      }
    } catch (error) {
      console.error('Error fetching drilldown data:', error);
    } finally {
      setLoading(false);
    }
  }, [studyTimeRange]);

  // Refetch study data when time range changes and drawer is open
  const refetchStudyData = useCallback(async (newRange: TimeRangeOption) => {
    if (activeDrawer !== 'study-hours') return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await fetchStudyData(user.id, newRange);
    } catch (error) {
      console.error('Error refetching study data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeDrawer]);

  const handleStudyTimeRangeChange = useCallback((range: TimeRangeOption) => {
    setStudyTimeRange(range);
    refetchStudyData(range);
  }, [refetchStudyData]);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  return {
    activeDrawer,
    openDrawer,
    closeDrawer,
    loading,
    // Data
    completedExams,
    averageScore,
    scoreBreakdown,
    excludedCount,
    totalHours,
    studySessions,
    weeklyBreakdown,
    streakData,
    // Time range
    studyTimeRange,
    handleStudyTimeRangeChange,
  };
};
