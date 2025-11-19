import { format, addDays, isSameDay, setHours, startOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Maximize2, Minimize2 } from "lucide-react";
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
  exam_id?: string | null;
  linked_practice_set_id?: string | null;
  target_score?: number | null;
}

interface WeekViewProps {
  currentDate: Date;
  tasks: Task[];
  onTaskAction: (action: string, taskId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const WeekView = ({ 
  currentDate, 
  tasks, 
  onTaskAction,
  isExpanded,
  onToggleExpand
}: WeekViewProps) => {
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
    <Card className={cn(
      "transition-all duration-300 ease-in-out",
      isExpanded && "shadow-xl"
    )}>
      {/* Header with expand button */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">
          Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </h2>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggleExpand}
          className="transition-transform duration-300 hover:scale-110"
        >
          {isExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

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
      <ScrollArea className={cn(
        "h-[calc(100vh-250px)] transition-all duration-300",
        isExpanded && "h-[calc(100vh-220px)]"
      )}>
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
                      linkedExamId={task.exam_id}
                      linkedPracticeSetId={task.linked_practice_set_id}
                      targetScore={task.target_score}
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
