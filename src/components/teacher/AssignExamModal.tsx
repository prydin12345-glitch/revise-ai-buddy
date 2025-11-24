import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AssignExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examTitle: string;
  onAssigned: () => void;
}

export const AssignExamModal = ({
  open,
  onOpenChange,
  examId,
  examTitle,
  onAssigned
}: AssignExamModalProps) => {
  const [assignmentType, setAssignmentType] = useState<"all_students" | "specific_class">("all_students");
  const [className, setClassName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Set default release date to now
      const now = new Date();
      setReleaseDate(now.toISOString().slice(0, 16));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (assignmentType === "specific_class" && !className.trim()) {
      toast.error("Please enter a class name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("exam_assignments")
        .insert([{
          exam_id: examId,
          assigned_by: user.id,
          assignment_type: assignmentType,
          class_name: assignmentType === "specific_class" ? className : null,
          deadline: deadline || null,
          release_date: releaseDate || null,
          is_active: true,
          is_grades_released: false
        }]);

      if (error) throw error;

      toast.success(`Exam assigned successfully!`);
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
            Assign "{examTitle}" to your students
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Assign To</Label>
            <RadioGroup value={assignmentType} onValueChange={(value: any) => setAssignmentType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all_students" id="all" />
                <Label htmlFor="all">All My Students</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specific_class" id="class" />
                <Label htmlFor="class">Specific Class</Label>
              </div>
            </RadioGroup>
          </div>

          {assignmentType === "specific_class" && (
            <div>
              <Label htmlFor="className">Class Name</Label>
              <Input
                id="className"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Grade 11 Physics A"
              />
            </div>
          )}

          <div>
            <Label htmlFor="releaseDate">Release Date & Time</Label>
            <Input
              id="releaseDate"
              type="datetime-local"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
            />
          </div>

          <div>
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
