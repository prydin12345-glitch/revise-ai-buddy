import { Card } from "@/components/ui/card";
import { CalendarTaskBlock } from "./CalendarTaskBlock";
import { getTimeSlots, formatTimeDisplay } from "@/lib/calendar-utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

interface CalendarGridProps {
  tasks: Array<{
    id: string;
    subject: string;
    subject_color: string;
    focus_topic?: string;
    exam_title?: string;
    time: string;
    duration?: number;
    day: string;
    date?: Date;
    is_completed: boolean;
  }>;
  onEditTask: (task: any) => void;
  onDeleteTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
  currentWeekStart: Date;
  viewMode: "week" | "day";
}

export function CalendarGrid({ tasks, onEditTask, onDeleteTask, onToggleComplete, currentWeekStart, viewMode }: CalendarGridProps) {
  const timeSlots = getTimeSlots();
  
  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.date) return false;
      return isSameDay(new Date(task.date), date);
    });
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] auto-rows-[90px]">
        {/* Header Row - Time column + Day/Date */}
        <div className="sticky top-0 z-20 bg-muted/50 border-b border-r flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">Time</span>
        </div>
        
        {weekDays.map((date) => (
          <div 
            key={date.toISOString()}
            className="sticky top-0 z-20 bg-muted/50 border-b border-r last:border-r-0 flex flex-col items-center justify-center px-2 py-1"
          >
            <span className="text-sm font-semibold">{format(date, 'EEE, d')}</span>
          </div>
        ))}

        {/* Time slots and grid cells */}
        {timeSlots.map((time, rowIndex) => (
          <>
            {/* Time label */}
            <div 
              key={`time-${time}`}
              className="border-b border-r bg-muted/30 flex items-start justify-center pt-1"
            >
              <span className="text-xs text-muted-foreground font-medium">
                {formatTimeDisplay(time)}
              </span>
            </div>
            
            {/* Grid cells for each day */}
            {weekDays.map((date, colIndex) => (
              <div
                key={`${date.toISOString()}-${time}`}
                className="relative border-b border-r last:border-r-0 bg-card hover:bg-muted/20 transition-colors p-1"
                style={{
                  gridRow: rowIndex + 2,
                  gridColumn: colIndex + 2,
                }}
              />
            ))}
          </>
        ))}

        {/* Task blocks positioned by date */}
        {weekDays.flatMap((date, dayIndex) => 
          getTasksForDate(date).map((task) => (
            <CalendarTaskBlock
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onToggleComplete={onToggleComplete}
              currentWeekStart={currentWeekStart}
            />
          ))
        )}
      </div>
    </Card>
  );
}
