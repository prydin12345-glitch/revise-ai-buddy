import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, subDays, isSameDay } from "date-fns";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Menu, Plus } from "lucide-react";
import { ViewContainer } from "@/components/revision/views/ViewContainer";
import { CalendarSidebar } from "@/components/revision/panels/CalendarSidebar";
import { SuggestionsPanel } from "@/components/revision/panels/SuggestionsPanel";
import { GoalInfoCard } from "@/components/revision/panels/GoalInfoCard";
import { StreakTracker } from "@/components/revision/features/StreakTracker";
import { SessionFeedbackModal } from "@/components/revision/features/SessionFeedbackModal";
import { SpacedRepetitionPrompt } from "@/components/revision/SpacedRepetitionPrompt";
import { AutoRescheduleModal } from "@/components/revision/features/AutoRescheduleModal";
import { FocusMode } from "@/components/revision/FocusMode";
import { QuickAddModal } from "@/components/revision/QuickAddModal";
import { EditGoalModal } from "@/components/revision/modals/EditGoalModal";
import { FilterDropdown } from "@/components/revision/FilterDropdown";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

interface RevisionTask {
  id: string;
  subject: string;
  subject_color: string;
  date: string;
  time: string;
  duration: number | null;
  focus_topic: string | null;
  exam_id: string | null;
  exam_title: string | null;
  is_completed: boolean;
  status: string;
  priority: string;
  progress_percentage: number;
  confidence_before: number | null;
  confidence_after: number | null;
  archived_at: string | null;
  missed_count?: number;
  linked_practice_set_id?: string | null;
  target_score?: number | null;
  due_date?: string | null;
  reminder_days_before?: number | null;
}

const RevisionPlan = () => {
  const location = useLocation();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [userExams, setUserExams] = useState<any[]>([]);
  const [revisionGoals, setRevisionGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStreak, setUserStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [preFilledTaskData, setPreFilledTaskData] = useState<any>(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [linkedContentFilter, setLinkedContentFilter] = useState<'all' | 'exam' | 'practice' | 'none'>('all');
  
  // Modals
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editTaskMode, setEditTaskMode] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [focusTask, setFocusTask] = useState<RevisionTask | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<RevisionTask | null>(null);
  const [missedTasks, setMissedTasks] = useState<RevisionTask[]>([]);
  const [spacedRepTask, setSpacedRepTask] = useState<RevisionTask | null>(null);
  const [spacedRepPromptOpen, setSpacedRepPromptOpen] = useState(false);
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  // Suggestions
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [unrevisedSubjects, setUnrevisedSubjects] = useState<any[]>([]);
  const [suggestedSlots] = useState<any[]>([]);

  const { subjects } = useUserSubjects();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Handle navigation state from CreateExam or CreatePracticeQuestions
    if (location.state?.openQuickAdd) {
      setPreFilledTaskData(location.state.preFilledData);
      setQuickAddOpen(true);
      // Clear navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (searchQuery && highlightedTaskId) {
      const element = document.querySelector(`[data-task-id="${highlightedTaskId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedTaskId(null), 3000);
      }
    }
  }, [highlightedTaskId]);

  useEffect(() => {
    if (tasks.length > 0) {
      detectMissedTasks();
      loadSuggestions();
    }
  }, [tasks]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load goals
      const { data: goalsData } = await supabase
        .from("revision_goals")
        .select("*")
        .eq("user_id", user.id);

      setRevisionGoals(goalsData || []);

      // Load exams with goals
      const { data: examsData } = await supabase
        .from("exams")
        .select("id, title, subject_id, created_at")
        .eq("user_id", user.id)
        .eq("status", "published");

      // Combine exams with goals
      const examsWithGoals = (examsData || []).map(exam => {
        const goal = (goalsData || []).find(g => g.subject === exam.subject_id);
        return {
          ...exam,
          subject: exam.subject_id,
          subject_color: goal?.subject_color || '#3B82F6',
          date: goal?.deadline || new Date().toISOString(),
          target_percentage: goal?.target_percentage || 75,
          current_percentage: goal?.current_percentage || 0
        };
      });

      setUserExams(examsWithGoals);

      // Load tasks with new fields
      const { data: tasksData } = await supabase
        .from("revision_tasks")
        .select("*")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      setTasks(tasksData || []);

      // Load streak
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", user.id)
        .maybeSingle();

      if (streakData) {
        setUserStreak(streakData.current_streak);
        setLongestStreak(streakData.longest_streak);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load revision plan");
    } finally {
      setLoading(false);
    }
  };

  const detectMissedTasks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-missed-tasks');
      
      if (error) {
        console.error('Error detecting missed tasks:', error);
        return;
      }

      if (data?.missedTasks && data.missedTasks.length > 0 && missedTasks.length === 0) {
        setMissedTasks(data.missedTasks);
      }
    } catch (error) {
      console.error('Error calling detect-missed-tasks:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Detect weak topics from practice AND exam performance
      const { data: practiceAnswers } = await supabase
        .from("practice_question_answers")
        .select(`
          question:practice_questions(subtopic),
          score,
          is_correct
        `)
        .eq("user_id", user.id)
        .gte("created_at", subDays(new Date(), 30).toISOString())
        .limit(100);

      // Get exam performance data
      const { data: examAnswers } = await supabase
        .from("student_answers")
        .select(`
          question:exam_questions(topic_tag),
          score,
          is_correct
        `)
        .eq("student_id", user.id)
        .gte("submitted_at", subDays(new Date(), 30).toISOString())
        .limit(100);

      // Combine practice and exam data
      const topicScores: Record<string, any> = {};
      
      if (practiceAnswers) {
        practiceAnswers.forEach((ans: any) => {
          const topic = ans.question?.subtopic;
          if (!topic) return;
          if (!topicScores[topic]) {
            topicScores[topic] = { total: 0, count: 0, correct: 0 };
          }
          topicScores[topic].total += Number(ans.score) || 0;
          topicScores[topic].count++;
          if (ans.is_correct) topicScores[topic].correct++;
        });
      }

      if (examAnswers) {
        examAnswers.forEach((ans: any) => {
          const topic = ans.question?.topic_tag;
          if (!topic) return;
          if (!topicScores[topic]) {
            topicScores[topic] = { total: 0, count: 0, correct: 0 };
          }
          topicScores[topic].total += Number(ans.score) || 0;
          topicScores[topic].count++;
          if (ans.is_correct) topicScores[topic].correct++;
        });
      }

      const weak = Object.entries(topicScores)
        .map(([name, stats]: [string, any]) => ({
          id: name,
          name,
          avgScore: Math.round((stats.total / stats.count) * 100) / 100,
          attemptsCount: stats.count
        }))
        .filter(topic => topic.avgScore < 70)
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 5);

      setWeakTopics(weak);

      // Detect unrevised subjects (increased to 14 days)
      const recentTasks = tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate >= subDays(new Date(), 14) && t.is_completed;
      });
      
      const revisedSubjects = new Set(recentTasks.map(t => t.subject));
      const unrevised = subjects
        .filter(s => !revisedSubjects.has(s.subject_name))
        .map(s => {
          const lastTask = tasks
            .filter(t => t.subject === s.subject_name && t.is_completed)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          const daysSince = lastTask 
            ? Math.floor((new Date().getTime() - new Date(lastTask.date).getTime()) / (1000 * 60 * 60 * 24))
            : 30;

          return {
            id: s.id,
            name: s.subject_name,
            color: s.subject_color,
            daysSince
          };
        })
        .sort((a, b) => b.daysSince - a.daysSince)
        .slice(0, 5);

      setUnrevisedSubjects(unrevised);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedSubjects.length > 0) count++;
    if (dateRange.from || dateRange.to) count++;
    if (completionFilter !== 'all') count++;
    if (linkedContentFilter !== 'all') count++;
    return count;
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // View mode filter (date-based)
    if (viewMode === 'day') {
      filtered = filtered.filter(task => 
        isSameDay(new Date(task.date), currentDate)
      );
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.date);
        return taskDate >= weekStart && taskDate < addDays(weekStart, 7);
      });
    } else if (viewMode === 'month') {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.date);
        return taskDate >= monthStart && taskDate <= monthEnd;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.subject.toLowerCase().includes(query) ||
        task.focus_topic?.toLowerCase().includes(query) ||
        task.exam_title?.toLowerCase().includes(query)
      );
    }

    // Show completed toggle
    if (!showCompleted) {
      filtered = filtered.filter(task => !task.is_completed);
    }

    // Subject filter
    if (selectedSubjects.length > 0) {
      filtered = filtered.filter(task => selectedSubjects.includes(task.subject));
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.date);
        if (dateRange.from && dateRange.to) {
          return taskDate >= dateRange.from && taskDate <= dateRange.to;
        } else if (dateRange.from) {
          return taskDate >= dateRange.from;
        } else if (dateRange.to) {
          return taskDate <= dateRange.to;
        }
        return true;
      });
    }

    // Completion status filter
    if (completionFilter === 'completed') {
      filtered = filtered.filter(task => task.is_completed);
    } else if (completionFilter === 'pending') {
      filtered = filtered.filter(task => !task.is_completed);
    }

    // Linked content filter
    if (linkedContentFilter === 'exam') {
      filtered = filtered.filter(task => !!task.exam_id);
    } else if (linkedContentFilter === 'practice') {
      filtered = filtered.filter(task => !!task.linked_practice_set_id);
    } else if (linkedContentFilter === 'none') {
      filtered = filtered.filter(task => !task.exam_id && !task.linked_practice_set_id);
    }

    return filtered.filter(t => t.status === 'scheduled');
  };

  const archivedTasks = tasks.filter(t => t.archived_at !== null);
  const scheduledTasks = getFilteredTasks();

  // Get nearest exam
  const nearestExam = userExams
    .filter(exam => new Date(exam.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const uniqueSubjects = Array.from(new Set(subjects.map(s => s.subject_name)));

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query) {
      const filtered = getFilteredTasks();
      if (filtered.length > 0) {
        setHighlightedTaskId(filtered[0].id);
      }
    } else {
      setHighlightedTaskId(null);
    }
  };

  const handleAddTask = async (taskData: {
    subject: string;
    focusTopic: string;
    time: string;
    duration: number;
    dueDate?: string;
    reminderDaysBefore?: number;
    linkedExamId?: string;
    linkedPracticeSetId?: string;
    targetScore?: number;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subjectData = subjects.find(s => s.subject_name === taskData.subject);

      await supabase
        .from("revision_tasks")
        .insert({
          user_id: user.id,
          subject: taskData.subject,
          subject_color: subjectData?.subject_color || '#3B82F6',
          focus_topic: taskData.focusTopic,
          date: format(currentDate, 'yyyy-MM-dd'),
          time: taskData.time,
          duration: taskData.duration,
          due_date: taskData.dueDate,
          reminder_days_before: taskData.reminderDaysBefore || 1,
          exam_id: taskData.linkedExamId || null,
          linked_practice_set_id: taskData.linkedPracticeSetId || null,
          target_score: taskData.targetScore || null,
          status: 'scheduled',
          priority: 'medium',
          progress_percentage: 0,
          is_completed: false,
          day: format(currentDate, 'EEEE')
        });

      toast.success("Task added!");
      setQuickAddOpen(false);
      await loadData();
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add task");
    }
  };

  const handleUpdateTask = async (taskId: string, taskData: {
    subject: string;
    focusTopic: string;
    time: string;
    duration: number;
    dueDate?: string;
    reminderDaysBefore?: number;
    linkedExamId?: string;
    linkedPracticeSetId?: string;
    targetScore?: number;
  }) => {
    try {
      const subjectData = subjects.find(s => s.subject_name === taskData.subject);

      await supabase
        .from("revision_tasks")
        .update({
          subject: taskData.subject,
          subject_color: subjectData?.subject_color || '#3B82F6',
          focus_topic: taskData.focusTopic,
          time: taskData.time,
          duration: taskData.duration,
          due_date: taskData.dueDate,
          reminder_days_before: taskData.reminderDaysBefore || 1,
          exam_id: taskData.linkedExamId || null,
          linked_practice_set_id: taskData.linkedPracticeSetId || null,
          target_score: taskData.targetScore || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId);

      toast.success("Task updated!");
      setQuickAddOpen(false);
      setEditTaskMode(false);
      setEditingTaskId(null);
      await loadData();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(prev => !prev);
  };

  const handleTaskAction = async (action: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      if (action === 'complete') {
        await supabase
          .from("revision_tasks")
          .update({ 
            is_completed: true,
            progress_percentage: 100,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);
        
        // Update study streak
        try {
          await supabase.functions.invoke('update-study-streak');
        } catch (streakError) {
          console.error("Error updating streak:", streakError);
        }
        
        setFeedbackTask(task);
        await loadData();
      } else if (action === 'uncomplete') {
        await supabase
          .from("revision_tasks")
          .update({ 
            is_completed: false,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);
        await loadData();
      } else if (action === 'focus') {
        setFocusTask(task);
        setFocusModeOpen(true);
      } else if (action === 'edit') {
        setEditTaskMode(true);
        setEditingTaskId(taskId);
        setPreFilledTaskData({
          subject: task.subject,
          focusTopic: task.focus_topic || '',
          linkedExamId: task.exam_id || undefined,
          linkedPracticeSetId: task.linked_practice_set_id || undefined,
          time: task.time,
          duration: task.duration || 60,
          dueDate: task.due_date || undefined,
          reminderDaysBefore: task.reminder_days_before || 1,
          targetScore: task.target_score || undefined,
        });
        setQuickAddOpen(true);
      } else if (action === 'delete') {
        setDeleteTaskId(taskId);
      }
    } catch (error) {
      console.error("Error handling task action:", error);
      toast.error("Failed to update task");
    }
  };

  const handleEndFocus = async (actualDuration: number) => {
    if (!focusTask) return;

    try {
      await supabase
        .from("revision_tasks")
        .update({
          focus_session_duration: actualDuration,
          progress_percentage: 100,
          is_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", focusTask.id);

      toast.success("Focus session completed!");
      setFocusModeOpen(false);
      setFeedbackTask(focusTask);
      await loadData();
    } catch (error) {
      console.error("Error ending focus session:", error);
      toast.error("Failed to save focus session");
    }
  };

  const handleSessionFeedback = async (feedback: any) => {
    if (!feedbackTask) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert session feedback
      await supabase
        .from("session_feedback")
        .insert({
          user_id: user.id,
          task_id: feedbackTask.id,
          confidence_rating: feedback.confidence,
          understood: feedback.understood,
          notes: feedback.notes
        });

      // Calculate spaced repetition date
      const { data: spacedRepData, error: spacedRepError } = await supabase.functions.invoke(
        'calculate-spaced-repetition',
        {
          body: {
            taskId: feedbackTask.id,
            confidence: feedback.confidence
          }
        }
      );

      if (spacedRepError) {
        console.error('Error calculating spaced repetition:', spacedRepError);
      }

      toast.success("Feedback saved!");
      
      // Show spaced repetition prompt if confidence is moderate or below
      if (feedback.confidence <= 4) {
        setSpacedRepTask(feedbackTask);
        setSpacedRepPromptOpen(true);
      }
      
      setFeedbackTask(null);
      await loadData();
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error("Failed to save feedback");
    }
  };

  const handleScheduleReview = async (daysFromNow: number) => {
    if (!spacedRepTask) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const reviewDate = addDays(new Date(), daysFromNow);

      // Create a new review task linked to the original
      await supabase
        .from("revision_tasks")
        .insert({
          user_id: user.id,
          subject: spacedRepTask.subject,
          subject_color: spacedRepTask.subject_color,
          focus_topic: `Review: ${spacedRepTask.focus_topic || spacedRepTask.exam_title || 'Previous session'}`,
          date: format(reviewDate, 'yyyy-MM-dd'),
          time: spacedRepTask.time,
          duration: Math.ceil((spacedRepTask.duration || 60) * 0.75), // 75% of original duration
          exam_id: spacedRepTask.exam_id,
          linked_practice_set_id: spacedRepTask.linked_practice_set_id,
          target_score: spacedRepTask.target_score,
          parent_task_id: spacedRepTask.id,
          status: 'scheduled',
          priority: 'medium',
          progress_percentage: 0,
          is_completed: false,
          day: format(reviewDate, 'EEEE')
        });

      toast.success(`Review scheduled for ${format(reviewDate, 'MMM d')}`);
      setSpacedRepTask(null);
      setSpacedRepPromptOpen(false);
      await loadData();
    } catch (error) {
      console.error("Error scheduling review:", error);
      toast.error("Failed to schedule review");
    }
  };

  const handleReschedule = async (reschedules: Record<string, { date: Date; time: string }>) => {
    try {
      for (const [taskId, { date, time }] of Object.entries(reschedules)) {
        const task = tasks.find(t => t.id === taskId);
        await supabase
          .from("revision_tasks")
          .update({
            date: format(date, 'yyyy-MM-dd'),
            time,
            auto_rescheduled: true,
            missed_count: (task?.missed_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);
      }

      toast.success(`Rescheduled ${Object.keys(reschedules).length} task(s)`);
      setMissedTasks([]);
      await loadData();
    } catch (error) {
      console.error("Error rescheduling:", error);
      toast.error("Failed to reschedule tasks");
    }
  };

  const handleEditGoal = (goalId: string) => {
    const goal = revisionGoals.find(g => g.id === goalId);
    if (goal) {
      setSelectedGoal(goal);
      setEditGoalOpen(true);
    }
  };

  const handleSaveGoal = async (goalId: string, updates: any) => {
    try {
      await supabase
        .from("revision_goals")
        .update(updates)
        .eq("id", goalId);

      toast.success("Goal updated successfully!");
      await loadData();
    } catch (error) {
      console.error("Error updating goal:", error);
      toast.error("Failed to update goal");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setDeleteGoalId(goalId);
  };

  const confirmDeleteGoal = async () => {
    if (!deleteGoalId) return;

    try {
      await supabase
        .from("revision_goals")
        .delete()
        .eq("id", deleteGoalId);

      toast.success("Goal deleted successfully!");
      setDeleteGoalId(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Failed to delete goal");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTaskId) return;

    try {
      // Clear highlight if we're deleting the highlighted task
      if (highlightedTaskId === deleteTaskId) {
        setHighlightedTaskId(null);
      }

      // Optimistic update: remove from UI immediately
      setTasks(prevTasks => prevTasks.filter(t => t.id !== deleteTaskId));

      await supabase
        .from("revision_tasks")
        .delete()
        .eq("id", deleteTaskId);

      toast.success("Task deleted successfully!");
      setDeleteTaskId(null);
      
      // Refetch to ensure consistency
      await loadData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
      // Rollback optimistic update on error
      await loadData();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between gap-4 p-4">
          {/* Left: Month/Year Display & View Mode */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {format(currentDate, 'MMMM')} <span className="text-muted-foreground">{format(currentDate, 'yyyy')}</span>
            </h1>
            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Right: Search, Filters & Actions */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
            />
            
            <div className="flex items-center gap-2">
              <Switch
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <span className="text-sm whitespace-nowrap">Show Completed</span>
            </div>

            <FilterDropdown
              subjects={uniqueSubjects}
              selectedSubjects={selectedSubjects}
              onSubjectsChange={setSelectedSubjects}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              completionStatus={completionFilter}
              onCompletionStatusChange={setCompletionFilter}
              linkedContent={linkedContentFilter}
              onLinkedContentChange={setLinkedContentFilter}
              activeFilterCount={getActiveFilterCount()}
            />
            
            <Button 
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className={cn(
        "grid gap-4 p-4 transition-all duration-300 ease-in-out",
        "grid-cols-1",
        isExpanded 
          ? "lg:grid-cols-1"
          : "lg:grid-cols-[320px_1fr_320px]"
      )}>
        {/* Left Sidebar - Desktop */}
        <div className={cn(
          "hidden lg:block transition-all duration-300",
          isExpanded && "lg:hidden"
        )}>
          <CalendarSidebar
            currentDate={currentDate}
            onDateChange={(date) => date && setCurrentDate(date)}
            inboxTasks={[]}
            archivedTasks={archivedTasks}
            allTasks={tasks}
          />
        </div>

        {/* Left Sidebar - Mobile */}
        {!isExpanded && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden mb-4">
                <Menu className="h-4 w-4 mr-2" />
                Calendar & Inbox
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px]">
              <CalendarSidebar
                currentDate={currentDate}
                onDateChange={(date) => date && setCurrentDate(date)}
                inboxTasks={[]}
                archivedTasks={archivedTasks}
                allTasks={tasks}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* Center: Dynamic View */}
        <ViewContainer
          viewMode={viewMode}
          currentDate={currentDate}
          tasks={scheduledTasks}
          onTaskAction={handleTaskAction}
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
          highlightedTaskId={highlightedTaskId}
        />

        {/* Right Sidebar - Desktop */}
        <div className={cn(
          "hidden lg:block space-y-4 transition-all duration-300",
          isExpanded && "lg:hidden"
        )}>
          <StreakTracker currentStreak={userStreak} longestStreak={longestStreak} />
          <GoalInfoCard 
            goal={revisionGoals[0]} 
            onEdit={handleEditGoal}
            onDelete={handleDeleteGoal}
          />
          <SuggestionsPanel
            weakTopics={weakTopics}
            unrevisedSubjects={unrevisedSubjects}
            suggestedSlots={suggestedSlots}
          />
        </div>

        {/* Right Sidebar - Mobile */}
        {!isExpanded && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                View Suggestions & Stats
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] overflow-y-auto">
              <div className="space-y-4">
                <StreakTracker currentStreak={userStreak} longestStreak={longestStreak} />
                <GoalInfoCard 
                  goal={revisionGoals[0]} 
                  onEdit={handleEditGoal}
                  onDelete={handleDeleteGoal}
                />
                <SuggestionsPanel
                  weakTopics={weakTopics}
                  unrevisedSubjects={unrevisedSubjects}
                  suggestedSlots={suggestedSlots}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Modals */}
      <QuickAddModal
        open={quickAddOpen}
        onOpenChange={(open) => {
          setQuickAddOpen(open);
          if (!open) {
            setEditTaskMode(false);
            setEditingTaskId(null);
            setPreFilledTaskData(null);
          }
        }}
        subjects={subjects}
        onAdd={handleAddTask}
        onUpdate={handleUpdateTask}
        editMode={editTaskMode}
        editTaskId={editingTaskId || undefined}
        onSaveSubject={async (name, color) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          await supabase.from("user_subjects").insert({
            user_id: user.id,
            subject_name: name,
            subject_color: color,
          });
          
          await loadData();
          toast.success(`Subject "${name}" added!`);
        }}
        suggestedTime={format(currentDate, 'HH:mm')}
        preFilledData={preFilledTaskData}
      />

      <FocusMode
        open={focusModeOpen}
        onOpenChange={setFocusModeOpen}
        task={focusTask}
        onEndFocus={handleEndFocus}
      />

      <SessionFeedbackModal
        task={feedbackTask}
        onSubmit={handleSessionFeedback}
        onSkip={() => setFeedbackTask(null)}
      />

      <SpacedRepetitionPrompt
        open={spacedRepPromptOpen}
        onOpenChange={setSpacedRepPromptOpen}
        task={spacedRepTask}
        onScheduleReview={handleScheduleReview}
      />

      <AutoRescheduleModal
        missedTasks={missedTasks}
        onReschedule={handleReschedule}
        onDismiss={() => setMissedTasks([])}
      />

      <EditGoalModal
        open={editGoalOpen}
        onOpenChange={setEditGoalOpen}
        goal={selectedGoal}
        subjects={subjects}
        onSave={handleSaveGoal}
      />

      <AlertDialog open={!!deleteGoalId} onOpenChange={(open) => !open && setDeleteGoalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revision Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this revision goal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGoal}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revision Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this task from your revision plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default RevisionPlan;
