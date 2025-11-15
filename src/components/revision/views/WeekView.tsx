import { format, addDays, isSameDay, setHours, startOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EnhancedTaskBlock } from "../task-cards/EnhancedTaskBlock";

interface Task {
  id: string;
  date: string;
  time: string;
  subject: string;
  subject_color: string;
  duration: number | null;
  focus_topic: string | null;
  exam_title: string | null;
  is_completed: boolean;
  priority: string;
  progress_percentage: number;
  confidence_before: number | null;
  confidence_after: number | null;
}

interface WeekViewProps {
  currentDate: Date;
  tasks: Task[];
  onTaskAction: (action: string, taskId: string) => void;
}

export const WeekView = ({ currentDate, tasks, onTaskAction }: WeekViewProps) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);

  const getTasksForDayAndHour = (day: Date, hour: number) => {
    return tasks.filter(task => {
      const taskDate = new Date(task.date);
      const taskHour = parseInt(task.time.split(':')[0]);
      return isSameDay(taskDate, day) && taskHour === hour;
    });
  };

  return (
    <Card>
      {/* Week Header */}
      <div className="grid grid-cols-8 border-b sticky top-16 bg-background z-40">
        <div className="p-2 border-r text-xs font-medium text-muted-foreground">Time</div>
        {weekDays.map(day => (
          <div key={day.toString()} className="p-2 text-center border-r last:border-r-0">
            <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
            <div className={cn(
              "text-lg font-bold",
              isSameDay(day, new Date()) && "text-primary"
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>
      
      {/* Grid Rows */}
      <ScrollArea className="h-[calc(100vh-250px)]">
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b min-h-[80px]">
            <div className="p-2 border-r text-xs font-medium text-muted-foreground flex items-start">
              {format(setHours(new Date(), hour), 'HH:mm')}
            </div>
            {weekDays.map(day => {
              const dayTasks = getTasksForDayAndHour(day, hour);
              return (
                <div
                  key={`${day}-${hour}`}
                  className={cn(
                    "p-2 border-r last:border-r-0 space-y-1",
                    isSameDay(day, new Date()) && "bg-primary/5"
                  )}
                >
                  {dayTasks.map(task => (
                    <EnhancedTaskBlock
                      key={task.id}
                      task={task}
                      onAction={onTaskAction}
                      compact
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </ScrollArea>
    </Card>
  );
};
