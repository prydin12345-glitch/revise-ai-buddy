import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CalendarIcon } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface EditDeadlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examTitle: string;
  currentDeadline: string | null;
  onUpdated: () => void;
}

export const EditDeadlineModal = ({
  open,
  onOpenChange,
  examId,
  examTitle,
  currentDeadline,
  onUpdated,
}: EditDeadlineModalProps) => {
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (currentDeadline) {
      const date = new Date(currentDeadline);
      setDeadline(date);
      setDeadlineTime(format(date, "HH:mm"));
    } else {
      setDeadline(undefined);
      setDeadlineTime("23:59");
    }
  }, [currentDeadline, open]);

  const combineDateAndTime = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  };

  const handleUpdate = async () => {
    if (!deadline) {
      toast.error("Please select a deadline");
      return;
    }

    setUpdating(true);

    try {
      const newDeadline = combineDateAndTime(deadline, deadlineTime);

      // Update all assignments for this exam
      const { error: assignmentError } = await supabase
        .from("exam_assignments")
        .update({ deadline: newDeadline.toISOString() })
        .eq("exam_id", examId)
        .eq("is_active", true);

      if (assignmentError) throw assignmentError;

      // Create notifications for all assigned students using secure RPC
      await supabase.rpc("create_deadline_change_notifications", {
        p_exam_id: examId,
        p_exam_title: examTitle,
        p_new_deadline: newDeadline.toISOString(),
      });

      toast.success("Deadline updated successfully");
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating deadline:", error);
      toast.error("Failed to update deadline");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Deadline</DialogTitle>
          <DialogDescription>
            Update the deadline for "{examTitle}". All assigned students will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentDeadline && (
            <div className="text-sm">
              <span className="text-muted-foreground">Current deadline: </span>
              <span className="font-medium">{format(new Date(currentDeadline), "PPP 'at' p")}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>New Deadline</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {deadline ? format(deadline, "PPP") : "Select date..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-24 px-3 py-2 rounded-md border bg-background text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={updating || !deadline}>
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              "Update Deadline"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
