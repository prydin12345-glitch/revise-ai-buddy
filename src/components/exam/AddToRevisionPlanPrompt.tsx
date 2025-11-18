import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Target } from "lucide-react";

interface AddToRevisionPlanPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subject: string;
  onSchedule: () => void;
  onDismiss: () => void;
}

export const AddToRevisionPlanPrompt = ({
  open,
  onOpenChange,
  title,
  subject,
  onSchedule,
  onDismiss
}: AddToRevisionPlanPromptProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <DialogTitle>Add to Revision Plan?</DialogTitle>
          </div>
          <DialogDescription>
            Your <span className="font-semibold">{subject}</span> content "<span className="font-semibold">{title}</span>" is ready. Would you like to schedule it in your revision plan?
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            We'll help you pick the best time and set a target score
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDismiss}
            className="w-full sm:w-auto"
          >
            No, Maybe Later
          </Button>
          <Button
            onClick={onSchedule}
            className="w-full sm:w-auto"
          >
            Yes, Schedule It
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
