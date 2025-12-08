import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ReleaseGradesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examTitle: string;
  onReleased: () => void;
}

export const ReleaseGradesModal = ({
  open,
  onOpenChange,
  examId,
  examTitle,
  onReleased,
}: ReleaseGradesModalProps) => {
  const [releasing, setReleasing] = useState(false);

  const handleRelease = async () => {
    setReleasing(true);

    try {
      // Update exam grade_released status
      const { error: examError } = await supabase
        .from("exams")
        .update({ grade_released: true })
        .eq("id", examId);

      if (examError) throw examError;

      // Update all assignments for this exam
      const { error: assignmentError } = await supabase
        .from("exam_assignments")
        .update({ is_grades_released: true })
        .eq("exam_id", examId);

      if (assignmentError) throw assignmentError;

      // Get all students who submitted this exam
      const { data: submissions } = await supabase
        .from("exam_submissions")
        .select("student_id")
        .eq("exam_id", examId)
        .in("status", ["submitted", "graded"]);

      // Create notifications for all students
      if (submissions && submissions.length > 0) {
        const notifications = submissions.map((s) => ({
          user_id: s.student_id,
          type: "grades_released",
          title: "Grades Released",
          body: `Your grades for "${examTitle}" have been released. View your results now.`,
          action_data: { exam_id: examId },
        }));

        await supabase.from("notifications").insert(notifications);
      }

      toast.success("Grades released successfully");
      onReleased();
      onOpenChange(false);
    } catch (error) {
      console.error("Error releasing grades:", error);
      toast.error("Failed to release grades");
    } finally {
      setReleasing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release Grades?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to release grades for <strong>"{examTitle}"</strong>?
            </p>
            <p>
              Students will be able to see their scores and feedback immediately.
            </p>
            <p className="text-destructive font-medium">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={releasing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRelease} disabled={releasing}>
            {releasing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Releasing...
              </>
            ) : (
              "Release Grades"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
