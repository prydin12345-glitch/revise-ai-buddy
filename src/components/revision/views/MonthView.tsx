import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedTaskBlock } from "../task-cards/EnhancedTaskBlock";

interface Task {
  id: string;
  date: string;
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
}

interface MonthViewProps {
  currentDate: Date;
  tasks: Task[];
  onTaskAction: (action: string, taskId: string) => void;
}

export const MonthView = ({ currentDate, tasks, onTaskAction }: MonthViewProps) => {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => isSameDay(new Date(task.date), date));
  };

  const toggleDayExpansion = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  return (
    <Card className="p-4">
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {days.map(day => {
            const dayTasks = getTasksForDate(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            const isExpanded = expandedDays.has(dateKey);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                className={cn(
                  "min-h-[100px] border rounded-lg p-2 transition-all",
                  isCurrentMonth ? "bg-background" : "bg-muted/30",
                  isToday && "ring-2 ring-primary",
                  isExpanded && "row-span-2"
                )}
              >
                {/* Day Number & Task Count */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isToday && "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs",
                    !isCurrentMonth && "text-muted-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {dayTasks.length}
                    </Badge>
                  )}
                </div>
                
                {/* Task Indicators or Expanded Tasks */}
                {dayTasks.length > 0 && (
                  <div className="space-y-1">
                    {isExpanded ? (
                      <>
                        {dayTasks.map(task => (
                          <EnhancedTaskBlock
                            key={task.id}
                            task={task}
                            onAction={onTaskAction}
                            compact
                          />
                        ))}
                        <button
                          onClick={() => toggleDayExpansion(day)}
                          className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mt-1"
                        >
                          <ChevronUp className="w-3 h-3" />
                          Show less
                        </button>
                      </>
                    ) : (
                      <>
                        {dayTasks.slice(0, 2).map(task => (
                          <div
                            key={task.id}
                            className="text-xs p-1 rounded truncate"
                            style={{ 
                              backgroundColor: `${task.subject_color}20`,
                              borderLeft: `3px solid ${task.subject_color}`
                            }}
                          >
                            {task.time} • {task.focus_topic || task.exam_title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <button
                            onClick={() => toggleDayExpansion(day)}
                            className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                          >
                            <ChevronDown className="w-3 h-3" />
                            +{dayTasks.length - 2} more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
};
