import { Card } from "@/components/ui/card";
import { TimeBlock } from "./TimeBlock";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

interface Task {
  id: string;
  subject: string;
  subject_color: string;
  focus_topic?: string;
  exam_title?: string;
  time: string;
  duration?: number;
  is_completed: boolean;
  is_private?: boolean;
  focus_session_duration?: number;
}

interface TimelineGridProps {
  currentDate: Date;
  tasks: Task[];
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 to 22:00

export const TimelineGrid = ({
  currentDate,
  tasks,
  onEditTask,
  onDeleteTask,
  onToggleComplete,
  onStartFocus,
}: TimelineGridProps) => {
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimePercentage = (currentMinute / 60) * 100;

  useEffect(() => {
    // Scroll to current time on mount
    if (currentTimeRef.current) {
      currentTimeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const isToday = format(currentDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");

  return (
    <Card className="flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto">
        <div className="min-w-[600px]">
          {/* Timeline */}
          {HOURS.map((hour) => {
            const isCurrentHour = isToday && hour === currentHour;
            const tasksForHour = tasks.filter((task) => {
              const taskHour = parseInt(task.time.split(":")[0]);
              return taskHour === hour;
            });

            return (
              <div
                key={hour}
                ref={isCurrentHour ? currentTimeRef : null}
                className="relative border-b last:border-b-0 min-h-[80px] hover:bg-accent/5 transition-colors"
              >
                {/* Hour Label */}
                <div className="absolute left-0 top-2 w-16 text-sm text-muted-foreground font-medium">
                  {format(new Date().setHours(hour, 0), "HH:mm")}
                </div>

                {/* Current Time Marker */}
                {isCurrentHour && (
                  <div
                    className="absolute left-16 right-0 h-[2px] bg-primary z-10"
                    style={{ top: `${currentTimePercentage}%` }}
                  >
                    <div className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-primary" />
                  </div>
                )}

                {/* Tasks Container */}
                <div className="ml-20 mr-4 py-2 space-y-2">
                  {tasksForHour.map((task) => (
                    <TimeBlock
                      key={task.id}
                      id={task.id}
                      subject={task.subject}
                      subjectColor={task.subject_color}
                      focusTopic={task.focus_topic}
                      examTitle={task.exam_title}
                      time={task.time}
                      duration={task.duration}
                      isCompleted={task.is_completed}
                      isPrivate={task.is_private}
                      focusSessionDuration={task.focus_session_duration}
                      onEdit={() => onEditTask(task.id)}
                      onDelete={() => onDeleteTask(task.id)}
                      onToggleComplete={() => onToggleComplete(task.id)}
                      onStartFocus={() => onStartFocus(task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};