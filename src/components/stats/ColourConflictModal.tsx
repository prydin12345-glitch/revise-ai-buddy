import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ColourConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colour: string;
  conflictingSubjectName: string;
  replacementColour: string;
  onConfirm: () => void;
}

export const ColourConflictModal = ({
  open,
  onOpenChange,
  colour,
  conflictingSubjectName,
  replacementColour,
  onConfirm,
}: ColourConflictModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Colour already in use</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              <strong className="text-foreground">{conflictingSubjectName}</strong> is
              already using this colour. If you continue, that subject will be
              automatically assigned a new unused colour.
            </p>

            <div className="flex justify-center gap-6 py-2">
              <div className="text-center">
                <div className="w-10 h-10 rounded-lg mx-auto mb-1" style={{ backgroundColor: colour }} />
                <span className="text-[11px] text-muted-foreground">Your subject</span>
              </div>
              <div className="text-center opacity-50">
                <div
                  className="w-10 h-10 rounded-lg mx-auto mb-1 border-2 border-dashed border-border"
                  style={{ backgroundColor: replacementColour }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {conflictingSubjectName}
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(); onOpenChange(false); }}>
            Yes, continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
