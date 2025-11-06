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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SubjectColorChangeConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  oldColor: string;
  newColor: string;
  affectedCounts: {
    exams: number;
    goals: number;
    tasks: number;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

const STORAGE_KEY = "hideSubjectColorChangeWarning";

export const SubjectColorChangeConfirmation = ({
  open,
  onOpenChange,
  subjectName,
  oldColor,
  newColor,
  affectedCounts,
  onConfirm,
  onCancel,
}: SubjectColorChangeConfirmationProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const totalAffected = affectedCounts.exams + affectedCounts.goals + affectedCounts.tasks;

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-background border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <span className="text-2xl">⚠️</span>
            Change Subject Color?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-muted-foreground">
            <p>
              Are you sure you want to change the color for{" "}
              <span className="font-semibold text-foreground">{subjectName}</span>?
            </p>

            {totalAffected > 0 && (
              <div className="space-y-2">
                <p className="text-foreground">This will update the color across:</p>
                <div className="space-y-1 pl-4">
                  {affectedCounts.exams > 0 && (
                    <div className="flex items-center gap-2 text-foreground">
                      <span>📄</span>
                      <span>{affectedCounts.exams} Exam{affectedCounts.exams !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {affectedCounts.goals > 0 && (
                    <div className="flex items-center gap-2 text-foreground">
                      <span>🎯</span>
                      <span>{affectedCounts.goals} Goal{affectedCounts.goals !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {affectedCounts.tasks > 0 && (
                    <div className="flex items-center gap-2 text-foreground">
                      <span>📅</span>
                      <span>{affectedCounts.tasks} Revision Task{affectedCounts.tasks !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <span className="text-sm text-foreground">Color Preview:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-border"
                  style={{ backgroundColor: oldColor }}
                />
                <span className="text-muted-foreground">→</span>
                <div
                  className="w-8 h-8 rounded-lg border-2 border-primary"
                  style={{ backgroundColor: newColor }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="dontShowAgain"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label
                htmlFor="dontShowAgain"
                className="text-sm cursor-pointer text-foreground"
              >
                Don't show this message again
              </Label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Yes, Change Color
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const shouldShowColorChangeWarning = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) !== "true";
};
