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
import { FileText, AlertCircle } from "lucide-react";

interface SpecUploadAdvisoryProps {
  open: boolean;
  onClose: () => void;
  onContinueAnyway: () => void;
  onUploadSpec: () => void;
}

export function SpecUploadAdvisory({
  open,
  onClose,
  onContinueAnyway,
  onUploadSpec,
}: SpecUploadAdvisoryProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>No Specification Uploaded</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p>
              You haven't uploaded a specification for your chosen subject.
              Including one helps us generate more accurate and exam-board-aligned
              questions.
            </p>
            <div className="bg-muted p-3 rounded-md space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Benefits of uploading a specification:
              </p>
              <ul className="text-sm space-y-1 ml-6 list-disc">
                <li>Questions aligned to exam board standards</li>
                <li>Accurate topic coverage</li>
                <li>Appropriate difficulty calibration</li>
                <li>Better assessment objectives matching</li>
              </ul>
            </div>
            <p>Would you like to continue without it?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onUploadSpec}>Upload Spec</AlertDialogCancel>
          <AlertDialogAction onClick={onContinueAnyway}>
            Continue Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
