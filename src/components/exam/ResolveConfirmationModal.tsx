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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ResolveConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dontShowAgain: boolean) => void;
}

export const ResolveConfirmationModal = ({
  open,
  onOpenChange,
  onConfirm,
}: ResolveConfirmationModalProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = () => {
    onConfirm(dontShowAgain);
    setDontShowAgain(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as resolved?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              This will let your tutor know this answer helped and the thread will be marked as resolved. You can still ask a follow-up question later if needed.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <Label htmlFor="dont-show-again" className="text-sm text-muted-foreground cursor-pointer">
            Don't show this confirmation again
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          You can re-enable confirmations in Settings.
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
            Yes, mark resolved
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
