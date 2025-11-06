import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, subDays, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";

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

export const useExamStats = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [totalExams, setTotalExams] = useState(0);
  const [completedExams, setCompletedExams] = useState(0);
  const [inProgressExams, setInProgressExams] = useState(0);
  
  const [subjectPerformanceData, setSubjectPerformanceData] = useState<SubjectData[]>([]);
  const [examResultsData, setExamResultsData] = useState<TimeSeriesData[]>([]);
  const [studyActivityData, setStudyActivityData] = useState<StudyActivityData[]>([]);
  const [recentExams, setRecentExams] = useState<RecentExam[]>([]);
  const [bestSubject, setBestSubject] = useState<BestSubject | null>(null);
  const [revisionGoals, setRevisionGoals] = useState<RevisionGoal[]>([]);
  
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [pieChartMode, setPieChartMode] = useState<'score' | 'count'>('score');

  const formatTimeSpent = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all exams
      const { data: exams } = await supabase
        .from('exams')
        .select('id, subject_id, title, created_at, status')
        .eq('user_id', user.id);

      const publishedExams = exams?.filter(e => e.status === 'published') || [];
      setTotalExams(publishedExams.length);

      // Fetch all exam submissions
      const { data: submissions } = await supabase
        .from('exam_submissions')
        .select('*, exams!inner(subject_id, title)')
        .eq('student_id', user.id)
        .order('submitted_at', { ascending: false });

      setCompletedExams(submissions?.length || 0);
      setInProgressExams(Math.max(0, publishedExams.length - (submissions?.length || 0)));

      // Fetch user subjects with colors
      const { data: userSubjects } = await supabase
        .from('user_subjects')
        .select('subject_name, subject_color')
        .eq('user_id', user.id);

      const subjectColorMap = new Map(
        userSubjects?.map(s => [s.subject_name.toLowerCase(), s.subject_color]) || []
      );

      // Process subject performance
      if (submissions && submissions.length > 0) {
        const subjectStats = new Map<string, { totalScore: number; count: number; color: string }>();
        
        submissions.forEach(sub => {
          const subject = sub.exams.subject_id;
          const score = (sub.total_score / sub.total_marks) * 100;
          const color = subjectColorMap.get(subject.toLowerCase()) || '#3B82F6';
          
          if (!subjectStats.has(subject)) {
            subjectStats.set(subject, { totalScore: 0, count: 0, color });
          }
          const stats = subjectStats.get(subject)!;
          stats.totalScore += score;
          stats.count += 1;
        });

        const perfData: SubjectData[] = Array.from(subjectStats.entries()).map(([name, stats]) => ({
          name,
          color: stats.color,
          avgScore: stats.totalScore / stats.count,
          count: stats.count,
          value: stats.totalScore / stats.count,
        }));

        setSubjectPerformanceData(perfData);

        // Calculate best subject
        const sorted = [...perfData].sort((a, b) => b.avgScore - a.avgScore);
        if (sorted.length > 0) {
          const best = sorted[0];
          const now = new Date();
          const lastMonth = subMonths(now, 1);
          
          const lastMonthSubmissions = submissions.filter(s => 
            new Date(s.submitted_at) >= lastMonth && 
            new Date(s.submitted_at) < startOfMonth(now) &&
            s.exams.subject_id === best.name
          );
          
          let trend: 'up' | 'down' | 'stable' = 'stable';
          let trendValue = 0;
          
          if (lastMonthSubmissions.length > 0) {
            const lastMonthAvg = lastMonthSubmissions.reduce((sum, s) => 
              sum + (s.total_score / s.total_marks) * 100, 0
            ) / lastMonthSubmissions.length;
            
            trendValue = best.avgScore - lastMonthAvg;
            if (trendValue > 2) trend = 'up';
            else if (trendValue < -2) trend = 'down';
          }
          
          setBestSubject({
            name: best.name,
            color: best.color,
            avgScore: best.avgScore,
            totalExams: best.count,
            trend,
            trendValue: Math.abs(trendValue),
          });
        }
      }

      // Process time series data
      if (submissions && submissions.length > 0) {
        const timeSeriesMap = new Map<string, Map<string, number[]>>();
        let periods: string[] = [];

        if (timeRange === 'weekly') {
          const now = new Date();
          const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
          periods = days.map(d => format(d, 'EEE'));
          
          submissions.forEach(sub => {
            const subDate = new Date(sub.submitted_at);
            const dayName = format(subDate, 'EEE');
            const subject = sub.exams.subject_id;
            const score = (sub.total_score / sub.total_marks) * 100;
            
            if (!timeSeriesMap.has(dayName)) {
              timeSeriesMap.set(dayName, new Map());
            }
            if (!timeSeriesMap.get(dayName)!.has(subject)) {
              timeSeriesMap.get(dayName)!.set(subject, []);
            }
            timeSeriesMap.get(dayName)!.get(subject)!.push(score);
          });
        } else if (timeRange === 'monthly') {
          const now = new Date();
          const weeks = eachWeekOfInterval({ 
            start: startOfMonth(now), 
            end: endOfMonth(now) 
          }, { weekStartsOn: 1 });
          periods = weeks.map((_, i) => `W${i + 1}`);
          
          submissions.forEach(sub => {
            const subDate = new Date(sub.submitted_at);
            if (subDate >= startOfMonth(new Date()) && subDate <= endOfMonth(new Date())) {
              const weekNum = Math.floor((subDate.getDate() - 1) / 7);
              const period = `W${weekNum + 1}`;
              const subject = sub.exams.subject_id;
              const score = (sub.total_score / sub.total_marks) * 100;
              
              if (!timeSeriesMap.has(period)) {
                timeSeriesMap.set(period, new Map());
              }
              if (!timeSeriesMap.get(period)!.has(subject)) {
                timeSeriesMap.get(period)!.set(subject, []);
              }
              timeSeriesMap.get(period)!.get(subject)!.push(score);
            }
          });
        } else {
          const now = new Date();
          const months = eachMonthOfInterval({ 
            start: startOfYear(now), 
            end: endOfYear(now) 
          });
          periods = months.map(m => format(m, 'MMM'));
          
          submissions.forEach(sub => {
            const subDate = new Date(sub.submitted_at);
            if (subDate >= startOfYear(new Date()) && subDate <= endOfYear(new Date())) {
              const monthName = format(subDate, 'MMM');
              const subject = sub.exams.subject_id;
              const score = (sub.total_score / sub.total_marks) * 100;
              
              if (!timeSeriesMap.has(monthName)) {
                timeSeriesMap.set(monthName, new Map());
              }
              if (!timeSeriesMap.get(monthName)!.has(subject)) {
                timeSeriesMap.get(monthName)!.set(subject, []);
              }
              timeSeriesMap.get(monthName)!.get(subject)!.push(score);
            }
          });
        }

        const chartData: TimeSeriesData[] = periods.map(period => {
          const data: TimeSeriesData = { period };
          const periodData = timeSeriesMap.get(period);
          if (periodData) {
            periodData.forEach((scores, subject) => {
              data[subject] = scores.reduce((a, b) => a + b, 0) / scores.length;
            });
          }
          return data;
        });

        setExamResultsData(chartData);
      }

      // Process recent exams
      if (submissions && submissions.length > 0) {
        const recent: RecentExam[] = submissions.slice(0, 10).map(sub => ({
          id: sub.exam_id,
          subject: sub.exams.subject_id,
          subjectColor: subjectColorMap.get(sub.exams.subject_id.toLowerCase()) || '#3B82F6',
          examTitle: sub.exams.title,
          score: (sub.total_score / sub.total_marks) * 100,
          dateTaken: format(new Date(sub.submitted_at), 'MMM d, yyyy'),
          timeSpent: formatTimeSpent(sub.time_taken_seconds || 0),
          totalMarks: sub.total_marks,
          earnedMarks: Math.round(sub.total_score),
        }));
        setRecentExams(recent);
      }

      // Fetch study activity (revision tasks)
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      
      const { data: tasks } = await supabase
        .from('revision_tasks')
        .select('subject, duration, date')
        .eq('user_id', user.id)
        .gte('date', weekStart.toISOString())
        .lte('date', weekEnd.toISOString());

      if (tasks && tasks.length > 0) {
        const studyMap = new Map<string, Map<string, number>>();
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        days.forEach(day => studyMap.set(day, new Map()));
        
        tasks.forEach(task => {
          const taskDate = new Date(task.date);
          const dayName = format(taskDate, 'EEEE');
          const hours = (task.duration || 0) / 60;
          
          if (!studyMap.get(dayName)!.has(task.subject)) {
            studyMap.get(dayName)!.set(task.subject, 0);
          }
          studyMap.get(dayName)!.set(
            task.subject, 
            studyMap.get(dayName)!.get(task.subject)! + hours
          );
        });

        const studyData: StudyActivityData[] = days.map(day => {
          const data: StudyActivityData = { day };
          studyMap.get(day)!.forEach((hours, subject) => {
            data[subject] = Math.round(hours * 10) / 10;
          });
          return data;
        });

        setStudyActivityData(studyData);
      }

      // Fetch revision goals
      const { data: goals } = await supabase
        .from('revision_goals')
        .select('subject, target_percentage, deadline, subject_color')
        .eq('user_id', user.id);

      if (goals && subjectPerformanceData.length > 0) {
        const goalsWithProgress: RevisionGoal[] = goals
          .filter(g => g.target_percentage !== null)
          .map(goal => {
            const subjectPerfData = subjectPerformanceData.find(
              s => s.name.toLowerCase() === goal.subject.toLowerCase()
            );
            return {
              subject: goal.subject,
              targetPercentage: goal.target_percentage!,
              deadline: goal.deadline || '',
              currentAverage: subjectPerfData?.avgScore || 0,
              color: goal.subject_color || '#3B82F6',
            };
          });
        setRevisionGoals(goalsWithProgress);
      }

    } catch (err) {
      setError(err as Error);
      console.error('Error fetching exam stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

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
    timeRange,
    setTimeRange,
    pieChartMode,
    setPieChartMode,
    refetch: fetchData,
  };
};
