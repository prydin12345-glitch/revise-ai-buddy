import { useState, useEffect } from "react";
import { format } from "date-fns";
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

      setUserExams(examsData || []);
      setTasks([]);
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

    await saveOrUpdateSubject(newTask.subject, newTask.subject_color || SUBJECT_COLORS[0]);

    const dayName = format(newTask.date, 'EEEE');

    setTasks([
      ...tasks,
      {
        id: Math.random().toString(),
        ...newTask,
        day: dayName,
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
  };

  const handleEditTask = async () => {
    if (!editingTask) return;

    await saveOrUpdateSubject(editingTask.subject, editingTask.subject_color);

    setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
    setEditDialogOpen(false);
    setEditingTask(null);
    toast.success("Task updated!");
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    toast.success("Task deleted");
  };

  const handleToggleComplete = (taskId: string) => {
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, is_completed: !t.is_completed } : t
    ));
  };

  const getTasksForDay = (day: string) => {
    return tasks
      .filter(t => t.day === day && !t.is_completed)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getTodoTasks = () => tasks.filter(t => !t.day && !t.is_completed);
  const getInProgressTasks = () => tasks.filter(t => t.day && !t.is_completed);
  const getDoneTasks = () => tasks.filter(t => t.is_completed);

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

  const getWeekDateRange = () => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    return `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <DashboardLayout>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="p-6 space-y-4">
          {/* Top Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <TabsList>
                  <TabsTrigger value="week">Week View</TabsTrigger>
                  <TabsTrigger value="day">Day View</TabsTrigger>
                  <TabsTrigger value="subject">Subject View</TabsTrigger>
                </TabsList>
              </Tabs>

              {viewMode === "week" && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      const newDate = new Date(currentWeekStart);
                      newDate.setDate(newDate.getDate() - 7);
                      setCurrentWeekStart(newDate);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{getWeekDateRange()}</span>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      const newDate = new Date(currentWeekStart);
                      newDate.setDate(newDate.getDate() + 7);
                      setCurrentWeekStart(newDate);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Revision
            </Button>
          </div>

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
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    {getTasksForDay(selectedDay).length > 0 ? (
                      getTasksForDay(selectedDay).map(renderTaskCard)
                    ) : (
                      <p className="text-center text-muted-foreground py-12">
                        No tasks scheduled for {selectedDay}
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
            <div className="flex gap-4">
              <div className="flex-1 space-y-4">
                {Array.from(new Set(tasks.map(t => t.subject))).map(subject => {
                  const subjectTasks = tasks.filter(t => t.subject === subject);
                  const subjectColor = subjectTasks[0]?.subject_color || SUBJECT_COLORS[0];

                  return (
                    <Card key={subject}>
                      <div
                        className="p-4 border-b"
                        style={{ borderLeftWidth: '4px', borderLeftColor: subjectColor }}
                      >
                        <h3 className="font-semibold text-lg">{subject}</h3>
                        <p className="text-sm text-muted-foreground">
                          {subjectTasks.length} task{subjectTasks.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        {subjectTasks.map(renderTaskCard)}
                      </CardContent>
                    </Card>
                  );
                })}
                {tasks.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No Tasks Yet</h3>
                      <p className="text-muted-foreground">
                        Add your first revision task to get started
                      </p>
                    </CardContent>
                  </Card>
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
