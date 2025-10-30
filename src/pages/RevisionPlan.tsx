import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { RevisionTaskCard } from "@/components/revision/RevisionTaskCard";
import { RightSidebarPanel } from "@/components/revision/RightSidebarPanel";

interface RevisionTask {
  id: string;
  subject: string;
  subject_color: string;
  exam_id?: string;
  exam_title?: string;
  day: string; // e.g., "Monday", "Tuesday"
  time: string;
  duration?: number; // in minutes
  focus_topic?: string;
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
    time: "09:00",
    duration: 60,
    focus_topic: "",
    is_completed: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user exams
      const { data: examsData } = await supabase
        .from("exams")
        .select("id, title, subject_id")
        .eq("user_id", user.id)
        .eq("status", "published");

      setUserExams(examsData || []);

      // Mock revision tasks (will be stored in Supabase table later)
      const mockTasks: RevisionTask[] = [
        {
          id: "1",
          subject: "Mathematics",
          subject_color: "#3B82F6",
          day: "Monday",
          time: "09:00",
          duration: 120,
          focus_topic: "Calculus - Integration",
          is_completed: false,
        },
        {
          id: "2",
          subject: "Biology",
          subject_color: "#10B981",
          day: "Monday",
          time: "14:00",
          duration: 90,
          focus_topic: "Genetics",
          is_completed: true,
        },
        {
          id: "3",
          subject: "Chemistry",
          subject_color: "#F59E0B",
          day: "Wednesday",
          time: "10:00",
          duration: 60,
          is_completed: false,
        },
      ];

      setTasks(mockTasks);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load revision plan");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = () => {
    if (!newTask.subject || !newTask.time) {
      toast.error("Please fill in all required fields");
      return;
    }

    const task: RevisionTask = {
      id: Date.now().toString(),
      subject: newTask.subject!,
      subject_color: newTask.subject_color || SUBJECT_COLORS[0],
      day: newTask.day || "Monday",
      time: newTask.time!,
      duration: newTask.duration,
      focus_topic: newTask.focus_topic,
      exam_id: newTask.exam_id,
      exam_title: newTask.exam_title,
      is_completed: false,
    };

    setTasks([...tasks, task]);
    setAddDialogOpen(false);
    setNewTask({
      subject: "",
      subject_color: SUBJECT_COLORS[0],
      day: "Monday",
      time: "09:00",
      duration: 60,
      focus_topic: "",
      is_completed: false,
    });
    toast.success("Revision task added!");
  };

  const handleEditTask = () => {
    if (!editingTask) return;

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
              <div className="flex-1 grid grid-cols-7 gap-3">
                {DAYS_OF_WEEK.map((day) => {
                  const dayTasks = getTasksForDay(day);
                  const totalHours = dayTasks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60;

                  return (
                    <Card key={day} className="overflow-hidden">
                      <div className="bg-primary/10 p-3 border-b">
                        <h3 className="font-semibold text-sm">{day.slice(0, 3)}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {totalHours.toFixed(1)}h
                        </p>
                      </div>
                      <CardContent className="p-2 space-y-2 min-h-[400px]">
                        <SortableContext
                          items={dayTasks.map(t => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {dayTasks.length > 0 ? (
                            dayTasks.map(renderTaskCard)
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-8">
                              No tasks
                            </p>
                          )}
                        </SortableContext>
                      </CardContent>
                    </Card>
                  );
                })}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Revision Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={newTask.subject}
                  onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="space-y-2">
                <Label>Subject Color</Label>
                <div className="flex gap-2">
                  {SUBJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newTask.subject_color === color ? 'border-primary scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTask({ ...newTask, subject_color: color })}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Day *</Label>
                  <Select
                    value={newTask.day}
                    onValueChange={(v) => setNewTask({ ...newTask, day: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={newTask.time}
                    onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Revision Task</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Input
                    value={editingTask.subject}
                    onChange={(e) => setEditingTask({ ...editingTask, subject: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subject Color</Label>
                  <div className="flex gap-2">
                    {SUBJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          editingTask.subject_color === color ? 'border-primary scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setEditingTask({ ...editingTask, subject_color: color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Day *</Label>
                    <Select
                      value={editingTask.day}
                      onValueChange={(v) => setEditingTask({ ...editingTask, day: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time *</Label>
                    <Input
                      type="time"
                      value={editingTask.time}
                      onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })}
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
