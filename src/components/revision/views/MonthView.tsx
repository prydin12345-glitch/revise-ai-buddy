import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
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
  exam_id?: string | null;
  linked_practice_set_id?: string | null;
  target_score?: number | null;
}

interface MonthViewProps {
  currentDate: Date;
  tasks: Task[];
  onTaskAction: (action: string, taskId: string) => void;
  highlightedTaskId?: string | null;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const MonthView = ({ 
  currentDate, 
  tasks, 
  onTaskAction,
  highlightedTaskId,
  isExpanded,
  onToggleExpand
}: MonthViewProps) => {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
        {onToggleExpand && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="gap-2"
            aria-label={isExpanded ? "Collapse view" : "Expand view"}
            title={isExpanded ? "Collapse view" : "Expand view"}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                Expand
              </>
            )}
          </Button>
        )}
      </div>

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
            const isDayExpanded = expandedDays.has(dateKey);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                className={cn(
                  "min-h-[100px] border rounded-lg p-2 transition-all",
                  isCurrentMonth ? "bg-background" : "bg-muted/30",
                  isToday && "ring-2 ring-primary",
                  isDayExpanded && "row-span-2"
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
                    {isDayExpanded ? (
                      <>
                        {dayTasks.map(task => (
                          <EnhancedTaskBlock
                            key={task.id}
                            task={task}
                            onAction={onTaskAction}
                            compact
                        linkedExamId={task.exam_id}
                        linkedPracticeSetId={task.linked_practice_set_id}
                        targetScore={task.target_score}
                        isHighlighted={task.id === highlightedTaskId}
                      />
                        ))}
                        <button
                          onClick={() => toggleDayExpansion(day)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-full justify-center mt-1"
                        >
                          Show less <ChevronUp className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Task dots */}
                        {dayTasks.slice(0, 2).map(task => (
                          <div
                            key={task.id}
                            className="text-xs truncate p-1 rounded text-foreground"
                            style={{
                              backgroundColor: `${task.subject_color}20`,
                              borderLeft: `3px solid ${task.subject_color}`
                            }}
                          >
                            {task.time} {task.subject}
                          </div>
                        ))}
                        
                        {dayTasks.length > 2 && (
                          <button
                            onClick={() => toggleDayExpansion(day)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-full justify-center mt-1"
                          >
                            +{dayTasks.length - 2} more <ChevronDown className="h-3 w-3" />
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
