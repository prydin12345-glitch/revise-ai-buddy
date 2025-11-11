import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/revision/TopBar";
import { TimelineGrid } from "@/components/revision/TimelineGrid";
import { InboxPanel } from "@/components/revision/InboxPanel";
import { ArchivePanel } from "@/components/revision/ArchivePanel";
import { DailyGoalBar } from "@/components/revision/DailyGoalBar";
import { FocusMode } from "@/components/revision/FocusMode";
import { QuickAddModal } from "@/components/revision/QuickAddModal";
import { SubjectBalanceChart } from "@/components/revision/SubjectBalanceChart";
import { SpacedRepetitionPrompt } from "@/components/revision/SpacedRepetitionPrompt";
import { useUserSubjects } from "@/hooks/useUserSubjects";

interface RevisionTask {
  id: string;
  subject: string;
  subject_color: string;
  date: string;
  time: string;
  duration?: number;
  focus_topic?: string;
  exam_id?: string;
  exam_title?: string;
  is_completed: boolean;
  status: 'inbox' | 'scheduled' | 'archived';
  archived_at?: string;
  idle_since?: string;
  focus_session_started_at?: string;
  focus_session_duration?: number;
  next_review_date?: string;
  is_private?: boolean;
}

interface DailyGoal {
  target_minutes: number;
  completed_minutes: number;
  blocks_completed: number;
  longest_focus_block: number;
}

interface WeeklyStats {
  subject: string;
  subject_color: string;
  total_minutes: number;
  blocks_count: number;
}

const RevisionPlan = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [userExams, setUserExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [spacedRepOpen, setSpacedRepOpen] = useState(false);
  
  // Focus state
  const [focusTask, setFocusTask] = useState<RevisionTask | null>(null);
  const [completedTask, setCompletedTask] = useState<RevisionTask | null>(null);
  
  // Goals and stats
  const [dailyGoal, setDailyGoal] = useState<DailyGoal>({
    target_minutes: 180,
    completed_minutes: 0,
    blocks_completed: 0,
    longest_focus_block: 0,
  });
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [userStreak, setUserStreak] = useState(0);

  const { subjects, getSubjectColor, saveOrUpdateSubject } = useUserSubjects();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDailyGoal();
    loadWeeklyStats();
  }, [currentDate]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load exams
      const { data: examsData } = await supabase
        .from("exams")
        .select("id, title, subject_id, created_at")
        .eq("user_id", user.id)
        .eq("status", "published");

      setUserExams(examsData || []);

      // Load tasks
      await loadTasks();

      // Load streak
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle();

      if (streakData) {
        setUserStreak(streakData.current_streak);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load revision plan");
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tasksData, error } = await supabase
      .from("revision_tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } else {
      setTasks((tasksData || []).map(task => ({
        ...task,
        status: (task.status || 'scheduled') as 'inbox' | 'scheduled' | 'archived',
      })));
    }
  };

  const loadDailyGoal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dateStr = format(currentDate, "yyyy-MM-dd");

    // Get or create daily goal
    const { data: goalData, error } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", dateStr)
      .maybeSingle();

    if (error) {
      console.error("Error loading daily goal:", error);
      return;
    }

    if (goalData) {
      setDailyGoal({
        target_minutes: goalData.target_minutes,
        completed_minutes: goalData.completed_minutes,
        blocks_completed: goalData.blocks_completed,
        longest_focus_block: goalData.longest_focus_block,
      });
    } else {
      // Create default goal for today
      const { data: newGoal } = await supabase
        .from("daily_goals")
        .insert({
          user_id: user.id,
          date: dateStr,
          target_minutes: 180,
          completed_minutes: 0,
          blocks_completed: 0,
          longest_focus_block: 0,
        })
        .select()
        .single();

      if (newGoal) {
        setDailyGoal({
          target_minutes: newGoal.target_minutes,
          completed_minutes: newGoal.completed_minutes,
          blocks_completed: newGoal.blocks_completed,
          longest_focus_block: newGoal.longest_focus_block,
        });
      }
    }
  };

  const loadWeeklyStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    const { data: statsData, error } = await supabase
      .from("weekly_subject_stats")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStartStr);

    if (error) {
      console.error("Error loading weekly stats:", error);
    } else {
      setWeeklyStats(statsData || []);
    }
  };

  const updateDailyGoal = async (updates: Partial<DailyGoal>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dateStr = format(currentDate, "yyyy-MM-dd");
    const newGoal = { ...dailyGoal, ...updates };

    const { error } = await supabase
      .from("daily_goals")
      .update({
        completed_minutes: newGoal.completed_minutes,
        blocks_completed: newGoal.blocks_completed,
        longest_focus_block: newGoal.longest_focus_block,
      })
      .eq("user_id", user.id)
      .eq("date", dateStr);

    if (error) {
      console.error("Error updating daily goal:", error);
    } else {
      setDailyGoal(newGoal);
    }
  };

  const updateWeeklyStats = async (subject: string, subjectColor: string, minutes: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    const existingStat = weeklyStats.find(s => s.subject === subject);

    if (existingStat) {
      const { error } = await supabase
        .from("weekly_subject_stats")
        .update({
          total_minutes: existingStat.total_minutes + minutes,
          blocks_count: existingStat.blocks_count + 1,
        })
        .eq("user_id", user.id)
        .eq("week_start", weekStartStr)
        .eq("subject", subject);

      if (!error) {
        setWeeklyStats(weeklyStats.map(s =>
          s.subject === subject
            ? { ...s, total_minutes: s.total_minutes + minutes, blocks_count: s.blocks_count + 1 }
            : s
        ));
      }
    } else {
      const { data, error } = await supabase
        .from("weekly_subject_stats")
        .insert({
          user_id: user.id,
          week_start: weekStartStr,
          subject,
          subject_color: subjectColor,
          total_minutes: minutes,
          blocks_count: 1,
        })
        .select()
        .single();

      if (!error && data) {
        setWeeklyStats([...weeklyStats, data]);
      }
    }
  };

  const handleQuickAdd = async (taskData: {
    subject: string;
    focusTopic: string;
    time: string;
    duration: number;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subjectColor = getSubjectColor(taskData.subject);
    await saveOrUpdateSubject(taskData.subject, subjectColor);

    const { data, error } = await supabase
      .from("revision_tasks")
      .insert({
        user_id: user.id,
        subject: taskData.subject,
        subject_color: subjectColor,
        date: format(currentDate, "yyyy-MM-dd"),
        day: format(currentDate, "EEEE"),
        time: taskData.time,
        duration: taskData.duration,
        focus_topic: taskData.focusTopic,
        is_completed: false,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add task");
    } else {
      setTasks([...tasks, { ...data, status: data.status as 'inbox' | 'scheduled' | 'archived' }]);
      toast.success("Task added");
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompletedState = !task.is_completed;

    const { error } = await supabase
      .from("revision_tasks")
      .update({ is_completed: newCompletedState })
      .eq("id", taskId);

    if (error) {
      console.error("Error toggling complete:", error);
      toast.error("Failed to update task");
    } else {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: newCompletedState } : t));

      if (newCompletedState) {
        // Update daily goal
        const duration = task.duration || 0;
        await updateDailyGoal({
          completed_minutes: dailyGoal.completed_minutes + duration,
          blocks_completed: dailyGoal.blocks_completed + 1,
        });

        // Update weekly stats
        await updateWeeklyStats(task.subject, task.subject_color, duration);

        // Show spaced repetition prompt
        setCompletedTask(task);
        setSpacedRepOpen(true);

        toast.success(`Nice! ${duration}m ${task.subject} added to your progress`);
      } else {
        const duration = task.duration || 0;
        await updateDailyGoal({
          completed_minutes: Math.max(0, dailyGoal.completed_minutes - duration),
          blocks_completed: Math.max(0, dailyGoal.blocks_completed - 1),
        });
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("revision_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    } else {
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success("Task deleted");
    }
  };

  const handleArchiveTask = async (taskId: string) => {
    const { error } = await supabase
      .from("revision_tasks")
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      console.error("Error archiving task:", error);
      toast.error("Failed to archive task");
    } else {
      await loadTasks();
      toast.success("Task archived");
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    const { error } = await supabase
      .from("revision_tasks")
      .update({
        status: 'inbox',
        archived_at: null,
      })
      .eq("id", taskId);

    if (error) {
      console.error("Error restoring task:", error);
      toast.error("Failed to restore task");
    } else {
      await loadTasks();
      toast.success("Task restored to inbox");
    }
  };

  const handleStartFocus = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setFocusTask(task);
    setFocusModeOpen(true);
  };

  const handleEndFocus = async (actualDuration: number) => {
    if (!focusTask) return;

    const { error } = await supabase
      .from("revision_tasks")
      .update({
        focus_session_duration: (focusTask.focus_session_duration || 0) + actualDuration,
      })
      .eq("id", focusTask.id);

    if (error) {
      console.error("Error saving focus session:", error);
    } else {
      await loadTasks();
      
      // Update daily goal with longest focus block
      if (actualDuration > dailyGoal.longest_focus_block) {
        await updateDailyGoal({
          longest_focus_block: actualDuration,
        });
      }

      toast.success(`Focus session complete: ${actualDuration}m`);
    }

    setFocusTask(null);
  };

  const handleScheduleReview = async (daysFromNow: number) => {
    if (!completedTask) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const reviewDate = addDays(new Date(), daysFromNow);
    const subjectColor = getSubjectColor(completedTask.subject);

    const { error } = await supabase
      .from("revision_tasks")
      .insert({
        user_id: user.id,
        subject: completedTask.subject,
        subject_color: subjectColor,
        date: format(reviewDate, "yyyy-MM-dd"),
        day: format(reviewDate, "EEEE"),
        time: "09:00",
        duration: completedTask.duration,
        focus_topic: `Review: ${completedTask.focus_topic || completedTask.exam_title}`,
        is_completed: false,
        status: 'inbox',
      });

    if (error) {
      console.error("Error scheduling review:", error);
      toast.error("Failed to schedule review");
    } else {
      await loadTasks();
      toast.success(`Review scheduled for ${format(reviewDate, "MMM d")}`);
    }
  };

  // Filter tasks by status
  const scheduledTasks = tasks.filter(t => 
    t.status === 'scheduled' && 
    format(new Date(t.date), "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd")
  );
  const inboxTasks = tasks.filter(t => t.status === 'inbox');
  const archivedTasks = tasks.filter(t => t.status === 'archived');

  // Get nearest exam
  const nearestExam = userExams.length > 0 ? {
    title: userExams[0].title,
    date: new Date(userExams[0].created_at),
    subject: userExams[0].subject_id,
  } : undefined;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <TopBar
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          nearestExam={nearestExam}
          onQuickAdd={() => setQuickAddOpen(true)}
        />

        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Left Sidebar - Inbox */}
          <div className="w-80 flex-shrink-0">
            <InboxPanel
              tasks={inboxTasks}
              onTaskClick={(taskId) => {
                // TODO: Edit task
              }}
              onArchive={handleArchiveTask}
              onOpenArchive={() => setArchiveOpen(true)}
            />
          </div>

          {/* Main Content - Timeline */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <DailyGoalBar
              targetMinutes={dailyGoal.target_minutes}
              completedMinutes={dailyGoal.completed_minutes}
              blocksCompleted={dailyGoal.blocks_completed}
              longestFocusBlock={dailyGoal.longest_focus_block}
              streak={userStreak}
            />
            
            <TimelineGrid
              currentDate={currentDate}
              tasks={scheduledTasks}
              onEditTask={(taskId) => {
                // TODO: Edit task
              }}
              onDeleteTask={handleDeleteTask}
              onToggleComplete={handleToggleComplete}
              onStartFocus={handleStartFocus}
            />
          </div>

          {/* Right Sidebar - Subject Balance */}
          <div className="w-80 flex-shrink-0">
            <SubjectBalanceChart
              stats={weeklyStats}
              weekStart={startOfWeek(currentDate, { weekStartsOn: 1 })}
            />
          </div>
        </div>

        {/* Modals */}
        <QuickAddModal
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          subjects={subjects}
          onAdd={handleQuickAdd}
        />

        <ArchivePanel
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          tasks={archivedTasks}
          onRestore={handleRestoreTask}
          onDelete={handleDeleteTask}
        />

        <FocusMode
          open={focusModeOpen}
          onOpenChange={setFocusModeOpen}
          task={focusTask}
          onEndFocus={handleEndFocus}
        />

        <SpacedRepetitionPrompt
          open={spacedRepOpen}
          onOpenChange={setSpacedRepOpen}
          task={completedTask}
          onScheduleReview={handleScheduleReview}
        />
      </div>
    </DashboardLayout>
  );
};

export default RevisionPlan;