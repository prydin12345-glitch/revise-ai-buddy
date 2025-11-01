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
  
  // Show only the selected day (currentWeekStart is the selected date)
  const selectedDate = currentWeekStart;

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.date) return false;
      return isSameDay(new Date(task.date), date);
    });
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-[80px_1fr] auto-rows-[100px]">
        {/* Header Row - Time column + Selected Day */}
        <div className="sticky top-0 z-20 bg-muted/50 border-b border-r flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">Time</span>
        </div>
        
        <div 
          className="sticky top-0 z-20 bg-muted/50 border-b flex flex-col items-center justify-center px-2 py-2"
        >
          <span className="text-sm font-semibold">{format(selectedDate, 'EEEE')}</span>
          <span className="text-xs text-muted-foreground">{format(selectedDate, 'MMM d, yyyy')}</span>
        </div>

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
            
            {/* Grid cell for the selected day */}
            <div
              key={`${selectedDate.toISOString()}-${time}`}
              className="relative border-b bg-card hover:bg-muted/20 transition-colors p-1"
              style={{
                gridRow: rowIndex + 2,
                gridColumn: 2,
              }}
            />
          </>
        ))}

        {/* Task blocks for selected date */}
        {getTasksForDate(selectedDate).map((task) => (
          <CalendarTaskBlock
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onToggleComplete={onToggleComplete}
            currentWeekStart={currentWeekStart}
            columnIndex={2}
          />
        ))}
      </div>
    </Card>
  );
}
