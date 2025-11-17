import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, subDays, isSameDay } from "date-fns";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Plus } from "lucide-react";
import { ViewContainer } from "@/components/revision/views/ViewContainer";
import { CalendarSidebar } from "@/components/revision/panels/CalendarSidebar";
import { SuggestionsPanel } from "@/components/revision/panels/SuggestionsPanel";
import { ExamInfoCard } from "@/components/revision/panels/ExamInfoCard";
import { StreakTracker } from "@/components/revision/features/StreakTracker";
import { SessionFeedbackModal } from "@/components/revision/features/SessionFeedbackModal";
import { AutoRescheduleModal } from "@/components/revision/features/AutoRescheduleModal";
import { FocusMode } from "@/components/revision/FocusMode";
import { QuickAddModal } from "@/components/revision/QuickAddModal";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { cn } from "@/lib/utils";

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
}

const RevisionPlan = () => {
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [userExams, setUserExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStreak, setUserStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Modals
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [focusTask, setFocusTask] = useState<RevisionTask | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<RevisionTask | null>(null);
  const [missedTasks, setMissedTasks] = useState<RevisionTask[]>([]);

  // Suggestions
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [unrevisedSubjects, setUnrevisedSubjects] = useState<any[]>([]);
  const [suggestedSlots] = useState<any[]>([]);

  const { subjects } = useUserSubjects();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      checkMissedTasks();
      loadSuggestions();
    }
  }, [tasks]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load exams with goals
      const { data: examsData } = await supabase
        .from("exams")
        .select("id, title, subject_id, created_at")
        .eq("user_id", user.id)
        .eq("status", "published");

      const { data: goalsData } = await supabase
        .from("revision_goals")
        .select("*")
        .eq("user_id", user.id);

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

  const checkMissedTasks = () => {
    const now = new Date();
    const missed = tasks.filter(task => {
      if (task.is_completed || task.status !== 'scheduled') return false;
      const taskDateTime = new Date(`${task.date} ${task.time}`);
      return taskDateTime < now && !isSameDay(taskDateTime, now);
    });
    if (missed.length > 0 && missedTasks.length === 0) {
      setMissedTasks(missed);
    }
  };

  const loadSuggestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Detect weak topics from practice performance
      const { data: answers } = await supabase
        .from("practice_question_answers")
        .select(`
          question:practice_questions(subtopic),
          score,
          is_correct
        `)
        .eq("user_id", user.id)
        .gte("created_at", subDays(new Date(), 30).toISOString())
        .limit(100);

      if (answers) {
        const topicScores: Record<string, any> = {};
        answers.forEach((ans: any) => {
          const topic = ans.question?.subtopic;
          if (!topic) return;
          if (!topicScores[topic]) {
            topicScores[topic] = { total: 0, count: 0, correct: 0 };
          }
          topicScores[topic].total += Number(ans.score) || 0;
          topicScores[topic].count++;
          if (ans.is_correct) topicScores[topic].correct++;
        });

        const weak = Object.entries(topicScores)
          .map(([name, stats]: [string, any]) => ({
            id: name,
            name,
            avgScore: Math.round((stats.total / stats.count) * 100) / 100,
            attemptsCount: stats.count
          }))
          .filter(topic => topic.avgScore < 70)
          .slice(0, 3);

        setWeakTopics(weak);
      }

      // Detect unrevised subjects
      const recentTasks = tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate >= subDays(new Date(), 7) && t.is_completed;
      });
      
      const revisedSubjects = new Set(recentTasks.map(t => t.subject));
      const unrevised = subjects
        .filter(s => !revisedSubjects.has(s.subject_name))
        .map(s => ({
          id: s.id,
          name: s.subject_name,
          color: s.subject_color,
          daysSince: 7
        }))
        .slice(0, 3);

      setUnrevisedSubjects(unrevised);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    }
  };

  // Get tasks filtered by view and date
  const getFilteredTasks = () => {
    if (viewMode === 'day') {
      return tasks.filter(t => 
        isSameDay(new Date(t.date), currentDate) && t.status === 'scheduled'
      );
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate >= weekStart && taskDate <= weekEnd && t.status === 'scheduled';
      });
    } else {
      // Month view - all tasks in current month
      return tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate.getMonth() === currentDate.getMonth() && 
               taskDate.getFullYear() === currentDate.getFullYear() &&
               t.status === 'scheduled';
      });
    }
  };

  const inboxTasks = tasks.filter(t => t.status === 'inbox');
  const archivedTasks = tasks.filter(t => t.archived_at !== null);
  const scheduledTasks = getFilteredTasks();

  // Get nearest exam
  const nearestExam = userExams
    .filter(exam => new Date(exam.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const handleAddTask = async (taskData: {
    subject: string;
    focusTopic: string;
    time: string;
    duration: number;
    dueDate?: string;
    reminderDaysBefore?: number;
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
        setQuickAddOpen(true);
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

      // Update task with confidence
      await supabase
        .from("revision_tasks")
        .update({
          confidence_after: feedback.confidence,
          progress_percentage: feedback.understood ? 100 : 75,
          updated_at: new Date().toISOString()
        })
        .eq("id", feedbackTask.id);

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

      toast.success("Feedback saved!");
      setFeedbackTask(null);
      await loadData();
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error("Failed to save feedback");
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
        <div className="flex items-center justify-between p-4">
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
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
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
            inboxTasks={inboxTasks}
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
                inboxTasks={inboxTasks}
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
          nearestExam={nearestExam}
          onTaskAction={handleTaskAction}
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
        />

        {/* Right Sidebar - Desktop */}
        <div className={cn(
          "hidden lg:block space-y-4 transition-all duration-300",
          isExpanded && "lg:hidden"
        )}>
          <StreakTracker currentStreak={userStreak} longestStreak={longestStreak} />
          <ExamInfoCard nearestExam={nearestExam} />
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
                <ExamInfoCard nearestExam={nearestExam} />
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
        onOpenChange={setQuickAddOpen}
        subjects={subjects}
        onAdd={handleAddTask}
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

      <AutoRescheduleModal
        missedTasks={missedTasks}
        onReschedule={handleReschedule}
        onDismiss={() => setMissedTasks([])}
      />
    </DashboardLayout>
  );
};

export default RevisionPlan;
