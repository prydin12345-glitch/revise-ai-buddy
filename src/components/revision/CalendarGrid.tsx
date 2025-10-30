import { Card } from "@/components/ui/card";
import { CalendarTaskBlock } from "./CalendarTaskBlock";
import { getTimeSlots, formatTimeDisplay } from "@/lib/calendar-utils";

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
    is_completed: boolean;
  }>;
  onEditTask: (task: any) => void;
  onDeleteTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function CalendarGrid({ tasks, onEditTask, onDeleteTask, onToggleComplete }: CalendarGridProps) {
  const timeSlots = getTimeSlots();

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] auto-rows-[60px]">
        {/* Header Row - Time column + Day names */}
        <div className="sticky top-0 z-20 bg-muted/50 border-b border-r flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">Time</span>
        </div>
        
        {DAYS.map((day) => (
          <div 
            key={day}
            className="sticky top-0 z-20 bg-muted/50 border-b border-r last:border-r-0 flex items-center justify-center px-2"
          >
            <span className="text-sm font-semibold">{day}</span>
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
            {DAYS.map((day, colIndex) => (
              <div
                key={`${day}-${time}`}
                className="relative border-b border-r last:border-r-0 bg-card hover:bg-muted/20 transition-colors"
                style={{
                  gridRow: rowIndex + 2,
                  gridColumn: colIndex + 2,
                }}
              />
            ))}
          </>
        ))}

        {/* Task blocks positioned absolutely within the grid */}
        {tasks.map((task) => (
          <CalendarTaskBlock
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
    </Card>
  );
}
