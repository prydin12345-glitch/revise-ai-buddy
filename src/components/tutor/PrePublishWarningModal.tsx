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

interface PrePublishWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isAssigning?: boolean;
}

export const PrePublishWarningModal = ({
  open,
  onOpenChange,
  onConfirm,
  isAssigning = false,
}: PrePublishWarningModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isAssigning ? "Assign & Publish Exam?" : "Publish Exam?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Once published, this exam <strong>cannot be edited</strong>.
            </p>
            <p>
              Students will receive the exam exactly as it is now. Make sure you've reviewed:
            </p>
            <ul className="list-disc list-inside text-sm mt-2 space-y-1">
              <li>All questions and answers are correct</li>
              <li>Mark allocations are accurate</li>
              <li>Timer settings (if enabled) are appropriate</li>
            </ul>
            <p className="mt-3 font-medium">
              Are you sure you want to continue?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isAssigning ? "Assign Exam" : "Publish Exam"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
