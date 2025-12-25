import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText } from "lucide-react";

interface StudentPDFDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: "exam" | "practice";
  contentId: string;
  contentTitle: string;
  onDownload: () => Promise<void>;
}

export const StudentPDFDownloadModal = ({
  open,
  onOpenChange,
  contentType,
  contentTitle,
  onDownload,
}: StudentPDFDownloadModalProps) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
      onOpenChange(false);
    } catch (error) {
      console.error("PDF download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const typeLabel = contentType === "exam" ? "Exam" : "Practice Set";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download PDF
          </DialogTitle>
          <DialogDescription>
            Download "{contentTitle}" as a printable PDF
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-sm">Questions Only</p>
              <p className="text-xs text-muted-foreground">
                Student-Created {typeLabel} with blank answer spaces for practice
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDownloading}
          >
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
