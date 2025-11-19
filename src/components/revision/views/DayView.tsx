import { format, setHours, isSameHour, isToday } from "date-fns";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Maximize2, Minimize2, Clock } from "lucide-react";
import { EnhancedTaskBlock } from "../task-cards/EnhancedTaskBlock";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  subject: string;
  subject_color: string;
  time: string;
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

interface DayViewProps {
  currentDate: Date;
  tasks: Task[];
  onTaskAction: (action: string, taskId: string) => void;
  highlightedTaskId?: string | null;
}

export const DayView = ({ currentDate, tasks, onTaskAction, highlightedTaskId }: DayViewProps) => {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00-22:00
  const now = new Date();

  const getTasksForHour = (hour: number) => {
    return tasks.filter(task => {
      const taskHour = parseInt(task.time.split(':')[0]);
      return taskHour === hour;
    });
  };

  const isCurrentHour = (hour: number) => {
    return isToday(currentDate) && isSameHour(setHours(now, hour), now);
  };

  return (
    <Card>
      <CardHeader className="sticky top-16 bg-background z-40 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {format(currentDate, 'EEEE')} <span className="text-2xl">{format(currentDate, 'd')}th</span>
            </h2>
          </div>
        </div>
      </CardHeader>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <CardContent className="p-0">
          <div className="relative">
            {hours.map(hour => {
              const hourTasks = getTasksForHour(hour);
              const isCurrent = isCurrentHour(hour);
              
              return (
                <div
                  key={hour}
                  className={cn(
                    "min-h-[80px] border-b border-border p-4 transition-colors",
                    isCurrent && "bg-primary/5"
                  )}
                >
                  <div className="flex gap-4">
                    {/* Time Label */}
                    <div className="w-16 flex-shrink-0">
                      <div className={cn(
                        "text-sm font-medium",
                        isCurrent && "text-primary"
                      )}>
                        {format(setHours(new Date(), hour), 'HH:mm')}
                      </div>
                    </div>
                    
                    {/* Tasks or Empty Slot */}
                    <div className="flex-1 space-y-2">
                      {hourTasks.length > 0 ? (
                        hourTasks.map(task => (
                          <EnhancedTaskBlock
                            key={task.id}
                            task={task}
                            onAction={onTaskAction}
                  linkedExamId={task.exam_id}
                  linkedPracticeSetId={task.linked_practice_set_id}
                  targetScore={task.target_score}
                  isHighlighted={task.id === highlightedTaskId}
                />
                        ))
                      ) : (
                        <div className="h-12 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer">
                          <Clock className="w-3 h-3 mr-1" />
                          Available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
