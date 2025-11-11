import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Square } from "lucide-react";
import { useEffect, useState } from "react";

interface FocusModeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    subject: string;
    subject_color: string;
    focus_topic?: string;
    exam_title?: string;
    duration?: number;
  } | null;
  onEndFocus: (actualDuration: number) => void;
}

export const FocusMode = ({ open, onOpenChange, task, onEndFocus }: FocusModeProps) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndFocus = () => {
    const actualMinutes = Math.ceil(elapsedSeconds / 60);
    onEndFocus(actualMinutes);
    onOpenChange(false);
  };

  if (!task) return null;

  const plannedMinutes = task.duration || 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-sm">
        <div className="space-y-6 py-6">
          {/* Task Info */}
          <div className="text-center space-y-3">
            <Badge
              className="text-sm font-medium px-3 py-1"
              style={{ backgroundColor: task.subject_color }}
            >
              {task.subject}
            </Badge>
            <h2 className="text-2xl font-bold">
              {task.focus_topic || task.exam_title || "Focus Session"}
            </h2>
          </div>

          {/* Timer */}
          <div className="text-center space-y-2">
            <div className="text-6xl font-mono font-bold tabular-nums">
              {formatTime(elapsedSeconds)}
            </div>
            <div className="text-muted-foreground text-sm">
              {plannedMinutes > 0 && (
                <span>
                  {elapsedMinutes} / {plannedMinutes} min
                </span>
              )}
            </div>
          </div>

          {/* Progress Visual */}
          {plannedMinutes > 0 && (
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-primary transition-all duration-1000"
                style={{
                  width: `${Math.min((elapsedMinutes / plannedMinutes) * 100, 100)}%`,
                }}
              />
            </div>
          )}

          {/* End Focus Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            onClick={handleEndFocus}
          >
            <Square className="w-4 h-4" />
            End Focus Session
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Press ESC to end the session
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};