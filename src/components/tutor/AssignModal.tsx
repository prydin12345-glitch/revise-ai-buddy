import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StudentGroupSelector } from "./StudentGroupSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examTitle: string;
  onAssigned: () => void;
}

export const AssignModal = ({ open, onOpenChange, examId, examTitle, onAssigned }: AssignModalProps) => {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [releaseDate, setReleaseDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!releaseDate) {
      toast.error("Please select a release date");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const assignmentData = {
        exam_id: examId,
        assigned_by: user.id,
        assignment_type: selectedGroup === "all" ? "all" : "group",
        target_id: selectedGroup === "all" ? null : selectedGroup,
        release_date: new Date(releaseDate).toISOString(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        is_active: true,
        is_grades_released: false
      };

      const { error } = await supabase
        .from("exam_assignments")
        .insert(assignmentData);

      if (error) throw error;

      toast.success(`Exam "${examTitle}" assigned successfully`);
      onAssigned();
      onOpenChange(false);
    } catch (error) {
      console.error("Error assigning exam:", error);
      toast.error("Failed to assign exam");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Exam</DialogTitle>
          <DialogDescription>
            Assign "{examTitle}" to students
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Assign To</Label>
            <StudentGroupSelector value={selectedGroup} onValueChange={setSelectedGroup} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseDate">Release Date *</Label>
            <Input
              id="releaseDate"
              type="datetime-local"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (Optional)</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
