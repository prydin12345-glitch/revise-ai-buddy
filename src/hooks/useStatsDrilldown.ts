import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, subDays, startOfDay, endOfDay } from 'date-fns';
import { DrilldownType } from '@/components/dashboard/StatsDrilldownDrawer';

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
  source: string;
  subject?: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  recentActivity: { date: string; hasActivity: boolean }[];
  todayActivity: string[];
}

export const useStatsDrilldown = () => {
  const [activeDrawer, setActiveDrawer] = useState<DrilldownType>(null);
  const [loading, setLoading] = useState(false);
  
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

  const fetchStudyData = async (userId: string) => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Fetch revision tasks for study hours
    const { data: tasks } = await supabase
      .from('revision_tasks')
      .select('id, subject, duration, date, is_completed')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('date', weekStart.toISOString())
      .lte('date', weekEnd.toISOString());

    // Fetch exam time from submissions
    const { data: examSessions } = await supabase
      .from('exam_submissions')
      .select(`
        id,
        time_taken_seconds,
        submitted_at,
        exams!inner(subject_id)
      `)
      .eq('student_id', userId)
      .in('status', ['submitted', 'completed', 'graded'])
      .gte('submitted_at', weekStart.toISOString())
      .lte('submitted_at', weekEnd.toISOString());

    // Fetch practice quiz completions
    const { data: practiceProgress } = await supabase
      .from('practice_set_progress')
      .select(`
        id,
        time_spent_seconds,
        completed_at,
        practice_question_sets!inner(subject_id, set_name)
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekStart.toISOString())
      .lte('completed_at', weekEnd.toISOString());

    // Build sessions list
    const sessions: StudySession[] = [];
    
    if (tasks) {
      tasks.forEach(task => {
        sessions.push({
          id: task.id,
          date: format(new Date(task.date), 'MMM d'),
          duration: task.duration || 0,
          source: 'revision',
          subject: task.subject,
        });
      });
    }

    if (examSessions) {
      examSessions.forEach(sub => {
        sessions.push({
          id: sub.id,
          date: format(new Date(sub.submitted_at || ''), 'MMM d'),
          duration: Math.round((sub.time_taken_seconds || 0) / 60), // Convert to minutes
          source: 'exam',
          subject: (sub.exams as any).subject_id,
        });
      });
    }

    if (practiceProgress) {
      practiceProgress.forEach(progress => {
        sessions.push({
          id: progress.id,
          date: format(new Date(progress.completed_at || ''), 'MMM d'),
          duration: Math.round((progress.time_spent_seconds || 0) / 60), // Convert to minutes
          source: 'practice quiz',
          subject: (progress.practice_question_sets as any).subject_id,
        });
      });
    }

    setStudySessions(sessions);

    // Calculate weekly breakdown
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayHours: Record<string, number> = {};
    days.forEach(d => dayHours[d] = 0);

    if (tasks) {
      tasks.forEach(task => {
        const dayName = format(new Date(task.date), 'EEEE');
        dayHours[dayName] += (task.duration || 0) / 60; // Convert minutes to hours
      });
    }

    if (examSessions) {
      examSessions.forEach(sub => {
        const dayName = format(new Date(sub.submitted_at || ''), 'EEEE');
        dayHours[dayName] += (sub.time_taken_seconds || 0) / 3600; // Convert seconds to hours
      });
    }

    if (practiceProgress) {
      practiceProgress.forEach(progress => {
        const dayName = format(new Date(progress.completed_at || ''), 'EEEE');
        if (dayHours[dayName] !== undefined) {
          dayHours[dayName] += (progress.time_spent_seconds || 0) / 3600; // Convert seconds to hours
        }
      });
    }

    const breakdown = days.map(day => ({ day, hours: dayHours[day] }));
    setWeeklyBreakdown(breakdown);
    
    const total = Object.values(dayHours).reduce((a, b) => a + b, 0);
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
          await fetchStudyData(user.id);
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
  }, []);

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
  };
};
