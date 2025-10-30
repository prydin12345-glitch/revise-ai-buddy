import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";

interface Task {
  id: string;
  subject: string;
  subject_color: string;
  focus_topic?: string;
  exam_title?: string;
  duration?: number;
  time: string;
  day: string;
  is_completed: boolean;
}

interface RightSidebarPanelProps {
  todoTasks: Task[];
  inProgressTasks: Task[];
  doneTasks: Task[];
  onTaskClick: (task: Task) => void;
}

const TaskSection = ({
  title,
  icon: Icon,
  tasks,
  status,
  onTaskClick,
}: {
  title: string;
  icon: any;
  tasks: Task[];
  status: string;
  onTaskClick: (task: Task) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {tasks.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[100px] p-2 rounded-lg border-2 border-dashed transition-colors ${
          isOver ? "border-primary bg-primary/5" : "border-transparent"
        }`}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="p-2 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-all"
            style={{ borderLeftWidth: "3px", borderLeftColor: task.subject_color }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ backgroundColor: task.subject_color, color: "white" }}
              >
                {task.subject}
              </span>
            </div>
            <p className="text-xs font-medium truncate">
              {task.focus_topic || task.exam_title || "General revision"}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              <span>{task.time}</span>
              {task.duration && <span>• {task.duration}m</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RightSidebarPanel = ({
  todoTasks,
  inProgressTasks,
  doneTasks,
  onTaskClick,
}: RightSidebarPanelProps) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Task Tracker</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-6">
            <TaskSection
              title="To-Do"
              icon={Clock}
              tasks={todoTasks}
              status="todo"
              onTaskClick={onTaskClick}
            />
            <TaskSection
              title="In Progress"
              icon={PlayCircle}
              tasks={inProgressTasks}
              status="in-progress"
              onTaskClick={onTaskClick}
            />
            <TaskSection
              title="Done"
              icon={CheckCircle2}
              tasks={doneTasks}
              status="done"
              onTaskClick={onTaskClick}
            />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
