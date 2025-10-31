import { useState, useEffect } from "react";
import { format, addDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { RevisionTaskCard } from "@/components/revision/RevisionTaskCard";
import { RightSidebarPanel } from "@/components/revision/RightSidebarPanel";
import { CalendarGrid } from "@/components/revision/CalendarGrid";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { DateNavigationBar } from "@/components/revision/DateNavigationBar";
import { SubjectViewFilters } from "@/components/revision/SubjectViewFilters";
import { SubjectViewSummary } from "@/components/revision/SubjectViewSummary";

interface RevisionTask {
  id: string;
  subject: string;
  subject_color: string;
  day: string;
  date?: Date;
  time: string;
  duration?: number;
  focus_topic?: string;
  exam_id?: string;
  exam_title?: string;
  is_completed: boolean;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SUBJECT_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Orange
  "#8B5CF6", // Purple
  "#EF4444", // Red
  "#EC4899", // Pink
  "#06B6D4", // Cyan
];

const RevisionPlan = () => {
  const [viewMode, setViewMode] = useState<"week" | "day" | "subject">("week");
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [userExams, setUserExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RevisionTask | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [dateState, setDateState] = useState("1-week");
  
  // Subject view filters
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [newTask, setNewTask] = useState<Partial<RevisionTask>>({
    subject: "",
    subject_color: SUBJECT_COLORS[0],
    day: "Monday",
    date: new Date(),
    time: "09:00",
    duration: 60,
  });

  const { subjects, getSubjectColor, saveOrUpdateSubject } = useUserSubjects();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: examsData } = await supabase
        .from("exams")
        .select("id, title, subject_id")
        .eq("user_id", user.id)
        .eq("status", "published");

      const { data: tasksData, error: tasksError } = await supabase
        .from("revision_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (tasksError) {
        console.error("Error loading tasks:", tasksError);
        toast.error("Failed to load revision tasks");
      } else {
        setTasks((tasksData || []).map(task => ({
          ...task,
          date: new Date(task.date),
        })));
      }

      setUserExams(examsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load revision plan");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.subject || !newTask.date || !newTask.time) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to add tasks");
        return;
      }

      await saveOrUpdateSubject(newTask.subject, newTask.subject_color || SUBJECT_COLORS[0]);

      const dayName = format(newTask.date, 'EEEE');

      const { data, error } = await supabase
        .from("revision_tasks")
        .insert({
          user_id: user.id,
          subject: newTask.subject!,
          subject_color: newTask.subject_color || SUBJECT_COLORS[0],
          day: dayName,
          date: newTask.date.toISOString(),
          time: newTask.time!,
          duration: newTask.duration,
          focus_topic: newTask.focus_topic,
          exam_id: newTask.exam_id,
          exam_title: newTask.exam_title,
          is_completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding task:", error);
        toast.error("Failed to add revision task");
        return;
      }

      setTasks([
        ...tasks,
        {
          ...data,
          date: new Date(data.date),
        } as RevisionTask,
      ]);

      setAddDialogOpen(false);
      setNewTask({
        subject: "",
        subject_color: SUBJECT_COLORS[0],
        day: "Monday",
        date: new Date(),
        time: "09:00",
        duration: 60,
      });
      toast.success("Revision task added!");
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add revision task");
    }
  };

  const handleEditTask = async () => {
    if (!editingTask) return;

    try {
      await saveOrUpdateSubject(editingTask.subject, editingTask.subject_color);

      const { error } = await supabase
        .from("revision_tasks")
        .update({
          subject: editingTask.subject,
          subject_color: editingTask.subject_color,
          day: editingTask.day,
          date: editingTask.date?.toISOString(),
          time: editingTask.time,
          duration: editingTask.duration,
          focus_topic: editingTask.focus_topic,
          exam_id: editingTask.exam_id,
          exam_title: editingTask.exam_title,
          is_completed: editingTask.is_completed,
        })
        .eq("id", editingTask.id);

      if (error) {
        console.error("Error updating task:", error);
        toast.error("Failed to update task");
        return;
      }

      setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
      setEditDialogOpen(false);
      setEditingTask(null);
      toast.success("Task updated!");
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("revision_tasks")
        .delete()
        .eq("id", taskId);

      if (error) {
        console.error("Error deleting task:", error);
        toast.error("Failed to delete task");
        return;
      }

      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success("Task deleted");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const newCompletedStatus = !task.is_completed;

      const { error } = await supabase
        .from("revision_tasks")
        .update({ is_completed: newCompletedStatus })
        .eq("id", taskId);

      if (error) {
        console.error("Error toggling task completion:", error);
        toast.error("Failed to update task status");
        return;
      }

      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, is_completed: newCompletedStatus } : t
      ));
    } catch (error) {
      console.error("Error toggling task completion:", error);
      toast.error("Failed to update task status");
    }
  };

  const getTasksForDay = (day: string) => {
    return tasks
      .filter(t => t.day === day && !t.is_completed)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getTasksForDate = (date: Date) => {
    return tasks
      .filter(t => {
        if (!t.date) return false;
        const taskDate = new Date(t.date);
        return taskDate.toDateString() === date.toDateString() && !t.is_completed;
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getTodoTasks = () => tasks.filter(t => !t.day && !t.is_completed);
  const getInProgressTasks = () => tasks.filter(t => t.day && !t.is_completed);
  const getDoneTasks = () => tasks.filter(t => t.is_completed);

  // Subject view filter and sort logic
  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    // Filter by month if not showing all time
    filtered = filtered.filter(task => {
      if (!task.date) return false;
      const taskDate = new Date(task.date);
      return isWithinInterval(taskDate, {
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth)
      });
    });

    // Filter by selected subjects
    if (selectedSubjects.length > 0) {
      filtered = filtered.filter(t => selectedSubjects.includes(t.subject));
    }

    // Filter by completion status
    if (!showCompleted) {
      filtered = filtered.filter(t => !t.is_completed);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.focus_topic?.toLowerCase().includes(query)) ||
        (t.exam_title?.toLowerCase().includes(query)) ||
        (t.subject.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        case "date-asc":
          return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
        case "duration-desc":
          return (b.duration || 0) - (a.duration || 0);
        case "duration-asc":
          return (a.duration || 0) - (b.duration || 0);
        case "status-todo":
          return a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1;
        case "status-done":
          return a.is_completed === b.is_completed ? 0 : a.is_completed ? -1 : 1;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (over.id === "todo" || over.id === "in-progress" || over.id === "done") {
      const updatedTask = { ...task };
      if (over.id === "done") {
        updatedTask.is_completed = true;
      } else {
        updatedTask.is_completed = false;
      }
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      toast.success("Task status updated");
    }
  };

  const renderTaskCard = (task: RevisionTask) => (
    <RevisionTaskCard
      key={task.id}
      id={task.id}
      subject={task.subject}
      subjectColor={task.subject_color}
      focusTopic={task.focus_topic}
      examTitle={task.exam_title}
      time={task.time}
      duration={task.duration}
      isCompleted={task.is_completed}
      onEdit={() => {
        setEditingTask(task);
        setEditDialogOpen(true);
      }}
      onDelete={() => handleDeleteTask(task.id)}
      onToggleComplete={() => handleToggleComplete(task.id)}
    />
  );

  const handleDateStateChange = (state: string) => {
    setDateState(state);
    if (state === "today") {
      setCurrentWeekStart(new Date());
    }
  };

  return (
    <DashboardLayout>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="p-6 space-y-4">
          {/* Date Navigation Bar - Hidden in Subject View */}
          {viewMode !== "subject" && (
            <div className="flex justify-between items-start gap-4">
              <DateNavigationBar
                viewMode={viewMode}
                onViewModeChange={(mode) => setViewMode(mode)}
                currentDate={currentWeekStart}
                onDateChange={setCurrentWeekStart}
                dateState={dateState}
                onDateStateChange={handleDateStateChange}
                onAddRevision={() => setAddDialogOpen(true)}
              />
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="shrink-0">
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="subject">Subject</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Subject View Header */}
          {viewMode === "subject" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedMonth, "MMM, yyyy")}
                      <ChevronRight className="ml-auto h-4 w-4 rotate-90" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                  <TabsList>
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="subject">Subject</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Revision
              </Button>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <CalendarGrid
                  tasks={tasks}
                  onEditTask={(task) => {
                    setEditingTask(task);
                    setEditDialogOpen(true);
                  }}
                  onDeleteTask={handleDeleteTask}
                  onToggleComplete={handleToggleComplete}
                  currentWeekStart={currentWeekStart}
                  viewMode={viewMode}
                />
                {tasks.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-muted-foreground">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No revision plans yet</p>
                      <p className="text-sm">Click "Add Revision" to get started</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-80">
                <RightSidebarPanel
                  todoTasks={getTodoTasks()}
                  inProgressTasks={getInProgressTasks()}
                  doneTasks={getDoneTasks()}
                  onTaskClick={(task) => {
                    setEditingTask(task);
                    setEditDialogOpen(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <div className="flex gap-4">
              <div className="flex-1 space-y-4">
                <Card>
                  <CardContent className="p-6 space-y-3">
                    {getTasksForDate(currentWeekStart).length > 0 ? (
                      getTasksForDate(currentWeekStart).map(renderTaskCard)
                    ) : (
                      <p className="text-center text-muted-foreground py-12">
                        No tasks scheduled for {format(currentWeekStart, 'EEEE, MMM d')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="w-80">
                <RightSidebarPanel
                  todoTasks={getTodoTasks()}
                  inProgressTasks={getInProgressTasks()}
                  doneTasks={getDoneTasks()}
                  onTaskClick={(task) => {
                    setEditingTask(task);
                    setEditDialogOpen(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Subject View */}
          {viewMode === "subject" && (
            <div className="space-y-4">
              {/* Filters */}
              <SubjectViewFilters
                subjects={Array.from(new Set(tasks.map(t => t.subject)))}
                selectedSubjects={selectedSubjects}
                onSubjectToggle={handleSubjectToggle}
                sortBy={sortBy}
                onSortChange={setSortBy}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showCompleted={showCompleted}
                onShowCompletedToggle={() => setShowCompleted(!showCompleted)}
              />

              {/* Summary */}
              <SubjectViewSummary tasks={getFilteredAndSortedTasks()} />

              {/* Task List Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Revision Tasks</h3>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Show Completed</Label>
                  <Button
                    variant={showCompleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCompleted(!showCompleted)}
                  >
                    {showCompleted ? "All" : "Active Only"}
                  </Button>
                </div>
              </div>

              {/* Task Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredAndSortedTasks().length > 0 ? (
                  getFilteredAndSortedTasks().map((task) => (
                    <Card key={task.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div
                          className="w-full h-1 rounded-t-lg mb-3"
                          style={{ backgroundColor: task.subject_color }}
                        />
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm line-clamp-2">
                              {task.focus_topic || task.exam_title || "General revision"}
                            </h4>
                            {task.is_completed && (
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium" style={{ color: task.subject_color }}>
                              {task.subject}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {task.date && format(new Date(task.date), "MMM d, yyyy")}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {task.time}
                            </div>
                          </div>

                          {task.duration && (
                            <div className="text-xs text-muted-foreground">
                              Duration: {task.duration}m
                            </div>
                          )}

                          <div className="flex gap-1 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTask(task);
                                setEditDialogOpen(true);
                              }}
                              className="flex-1"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleComplete(task.id)}
                              className="flex-1"
                            >
                              {task.is_completed ? "Undo" : "Complete"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full">
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No revision plans found</h3>
                        <p className="text-muted-foreground">
                          {selectedSubjects.length > 0 || searchQuery
                            ? "Try adjusting your filters"
                            : `No revision plans for ${format(selectedMonth, "MMMM yyyy")}`}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add Task Dialog */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Revision Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <SubjectSelector
                  value={newTask.subject || ""}
                  color={newTask.subject_color || SUBJECT_COLORS[0]}
                  onValueChange={(subject) => {
                    const existingColor = getSubjectColor(subject);
                    setNewTask({ 
                      ...newTask, 
                      subject,
                      subject_color: existingColor,
                    });
                  }}
                  onColorChange={(color) => setNewTask({ ...newTask, subject_color: color })}
                />

                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newTask.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTask.date ? (
                          format(newTask.date, "EEEE, MMM dd, yyyy")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={newTask.date}
                        onSelect={(date) => setNewTask({ ...newTask, date: date || new Date() })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                    <Input
                      type="time"
                      value={newTask.time}
                      onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                      className="pl-10 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={newTask.duration || ""}
                    onChange={(e) => setNewTask({ ...newTask, duration: parseInt(e.target.value) || undefined })}
                    placeholder="60"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Focus Topic (optional)</Label>
                  <Input
                    value={newTask.focus_topic}
                    onChange={(e) => setNewTask({ ...newTask, focus_topic: e.target.value })}
                    placeholder="e.g., Integration techniques"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Link to Exam (optional)</Label>
                  <Select
                    value={newTask.exam_id}
                    onValueChange={(v) => {
                      const exam = userExams.find(e => e.id === v);
                      setNewTask({ ...newTask, exam_id: v, exam_title: exam?.title });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {userExams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTask}>Add Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Task Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Revision Task</DialogTitle>
              </DialogHeader>
              {editingTask && (
                <div className="space-y-4 py-4">
                  <SubjectSelector
                    value={editingTask.subject}
                    color={editingTask.subject_color}
                    onValueChange={(subject) => {
                      const existingColor = getSubjectColor(subject);
                      setEditingTask({ 
                        ...editingTask, 
                        subject,
                        subject_color: existingColor,
                      });
                    }}
                    onColorChange={(color) => setEditingTask({ ...editingTask, subject_color: color })}
                  />

                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !editingTask.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editingTask.date ? (
                            format(editingTask.date, "EEEE, MMM dd, yyyy")
                          ) : editingTask.day ? (
                            <span>{editingTask.day}</span>
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={editingTask.date}
                          onSelect={(date) => {
                            const dayName = date ? format(date, 'EEEE') : editingTask.day;
                            setEditingTask({ ...editingTask, date: date || undefined, day: dayName });
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Time *</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                      <Input
                        type="time"
                        value={editingTask.time}
                        onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })}
                        className="pl-10 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={editingTask.duration || ""}
                      onChange={(e) => setEditingTask({ ...editingTask, duration: parseInt(e.target.value) || undefined })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Focus Topic</Label>
                    <Input
                      value={editingTask.focus_topic}
                      onChange={(e) => setEditingTask({ ...editingTask, focus_topic: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Link to Exam (optional)</Label>
                    <Select
                      value={editingTask.exam_id}
                      onValueChange={(v) => {
                        const exam = userExams.find(e => e.id === v);
                        setEditingTask({ ...editingTask, exam_id: v, exam_title: exam?.title });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {userExams.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id}>
                            {exam.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditTask}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DndContext>
    </DashboardLayout>
  );
};

export default RevisionPlan;
