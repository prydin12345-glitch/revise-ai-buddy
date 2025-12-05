import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StudentGroupSelector } from "./StudentGroupSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CalendarIcon, AlertCircle } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface AssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examTitle: string;
  onAssigned: () => void;
}

export const AssignModal = ({ open, onOpenChange, examId, examTitle, onAssigned }: AssignModalProps) => {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [releaseDate, setReleaseDate] = useState<Date | undefined>();
  const [releaseTime, setReleaseTime] = useState("09:00");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ releaseDate?: string; deadline?: string }>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Track if form has changes
  useEffect(() => {
    setHasChanges(!!releaseDate || !!deadline || selectedGroup !== "all");
  }, [releaseDate, deadline, selectedGroup]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedGroup("all");
      setReleaseDate(undefined);
      setReleaseTime("09:00");
      setDeadline(undefined);
      setDeadlineTime("23:59");
      setErrors({});
      setHasChanges(false);
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: { releaseDate?: string; deadline?: string } = {};
    const now = new Date();

    if (!releaseDate) {
      newErrors.releaseDate = "Release date is required";
    } else {
      const releaseDatetime = combineDateAndTime(releaseDate, releaseTime);
      if (isBefore(releaseDatetime, now)) {
        newErrors.releaseDate = "Release date must be in the future";
      }
    }

    if (deadline && releaseDate) {
      const releaseDatetime = combineDateAndTime(releaseDate, releaseTime);
      const deadlineDatetime = combineDateAndTime(deadline, deadlineTime);
      if (isBefore(deadlineDatetime, releaseDatetime)) {
        newErrors.deadline = "Deadline must be after release date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const combineDateAndTime = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const releaseDatetime = combineDateAndTime(releaseDate!, releaseTime);
      const deadlineDatetime = deadline ? combineDateAndTime(deadline, deadlineTime) : null;

      if (selectedGroup === "all") {
        // Get all active groups for this tutor
        const { data: groups, error: groupsError } = await supabase
          .from("student_groups")
          .select("id, name")
          .eq("tutor_id", user.id)
          .eq("is_active", true);

        if (groupsError) throw groupsError;

        if (!groups || groups.length === 0) {
          throw new Error("No active groups found. Please create a group first.");
        }

        // Create an assignment for each group
        const assignments = groups.map(group => ({
          exam_id: examId,
          assigned_by: user.id,
          assignment_type: "group",
          target_id: group.id,
          release_date: releaseDatetime.toISOString(),
          deadline: deadlineDatetime?.toISOString() || null,
          is_active: true,
          is_grades_released: false
        }));

        const { error } = await supabase
          .from("exam_assignments")
          .insert(assignments);

        if (error) {
          console.error("Assignment error:", error);
          throw error;
        }

        // Get all student IDs from all groups for notifications
        const { data: members } = await supabase
          .from("group_members")
          .select("student_id")
          .in("group_id", groups.map(g => g.id))
          .eq("is_active", true);

        // Create notifications for all students
        if (members && members.length > 0) {
          const uniqueStudentIds = [...new Set(members.map(m => m.student_id))];
          const notifications = uniqueStudentIds.map(studentId => ({
            user_id: studentId,
            type: "exam_assigned",
            title: "New Exam Assigned",
            body: `You have been assigned: ${examTitle}`,
            action_data: { exam_id: examId }
          }));

          await supabase.from("notifications").insert(notifications);
        }

        toast.success(`Exam assigned to ${groups.length} group${groups.length > 1 ? 's' : ''}`);
      } else {
        // Single group assignment
        const { error } = await supabase
          .from("exam_assignments")
          .insert({
            exam_id: examId,
            assigned_by: user.id,
            assignment_type: "group",
            target_id: selectedGroup,
            release_date: releaseDatetime.toISOString(),
            deadline: deadlineDatetime?.toISOString() || null,
            is_active: true,
            is_grades_released: false
          });

        if (error) {
          console.error("Assignment error:", error);
          if (error.code === "42P17") {
            throw new Error("Permission denied. Please check you have the correct role.");
          }
          throw error;
        }

        // Create notifications for students in the group
        const { data: members } = await supabase
          .from("group_members")
          .select("student_id")
          .eq("group_id", selectedGroup)
          .eq("is_active", true);

        if (members && members.length > 0) {
          const notifications = members.map(m => ({
            user_id: m.student_id,
            type: "exam_assigned",
            title: "New Exam Assigned",
            body: `You have been assigned: ${examTitle}`,
            action_data: { exam_id: examId }
          }));

          await supabase.from("notifications").insert(notifications);
        }

        toast.success("Exam assigned successfully");
      }

      onAssigned();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error assigning exam:", error);
      toast.error(error.message || "Failed to assign exam");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm("Discard unsaved changes?")) {
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
    }
  };

  const isFormValid = releaseDate && !errors.releaseDate && !errors.deadline;

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Assign Exam</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Assign "<span className="font-medium text-foreground">{examTitle}</span>" to your students
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Assign To Field */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Assign To</Label>
            <StudentGroupSelector value={selectedGroup} onValueChange={setSelectedGroup} />
          </div>

          {/* Release Date Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Release Date</Label>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !releaseDate && "text-muted-foreground",
                      errors.releaseDate && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {releaseDate ? format(releaseDate, "PPP") : "Select date..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={releaseDate}
                    onSelect={setReleaseDate}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <input
                type="time"
                value={releaseTime}
                onChange={(e) => setReleaseTime(e.target.value)}
                className={cn(
                  "w-24 px-3 py-2 rounded-md border bg-background text-sm",
                  errors.releaseDate && "border-destructive"
                )}
              />
            </div>
            {errors.releaseDate && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.releaseDate}
              </p>
            )}
          </div>

          {/* Deadline Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Deadline</Label>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !deadline && "text-muted-foreground",
                      errors.deadline && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {deadline ? format(deadline, "PPP") : "Select deadline..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    disabled={(date) => {
                      const minDate = releaseDate || new Date();
                      return isBefore(date, startOfDay(minDate));
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className={cn(
                  "w-24 px-3 py-2 rounded-md border bg-background text-sm",
                  errors.deadline && "border-destructive"
                )}
              />
            </div>
            {errors.deadline && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.deadline}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !isFormValid}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Exam"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};