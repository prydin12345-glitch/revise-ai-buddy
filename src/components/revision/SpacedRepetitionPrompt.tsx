import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus } from "lucide-react";
import { addDays, format } from "date-fns";

interface SpacedRepetitionPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    subject: string;
    subject_color: string;
    focus_topic?: string;
    exam_title?: string;
    duration?: number;
  } | null;
  onScheduleReview: (daysFromNow: number) => void;
}

export const SpacedRepetitionPrompt = ({
  open,
  onOpenChange,
  task,
  onScheduleReview,
}: SpacedRepetitionPromptProps) => {
  if (!task) return null;

  const reviewIntervals = [
    { days: 2, label: "2 days" },
    { days: 7, label: "1 week" },
    { days: 21, label: "3 weeks" },
  ];

  const handleSchedule = (days: number) => {
    onScheduleReview(days);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Great work!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              className="text-sm font-medium"
              style={{ backgroundColor: task.subject_color }}
            >
              {task.subject}
            </Badge>
            <span className="text-sm text-foreground truncate">
              {task.focus_topic || task.exam_title}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Review again to strengthen your memory:
          </p>

          <div className="space-y-2">
            {reviewIntervals.map((interval) => {
              const date = addDays(new Date(), interval.days);
              return (
                <Button
                  key={interval.days}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => handleSchedule(interval.days)}
                >
                  <Plus className="w-4 h-4" />
                  <div className="text-left flex-1">
                    <div className="font-medium">{interval.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(date, "EEE, MMM d")}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};