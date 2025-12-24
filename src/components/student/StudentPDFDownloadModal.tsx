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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, Loader2, FileText, FileCheck } from "lucide-react";

interface StudentPDFDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: "exam" | "practice";
  contentId: string;
  contentTitle: string;
  hasAnswers: boolean;
  onDownload: (includeAnswers: boolean) => Promise<void>;
}

export const StudentPDFDownloadModal = ({
  open,
  onOpenChange,
  contentType,
  contentId,
  contentTitle,
  hasAnswers,
  onDownload,
}: StudentPDFDownloadModalProps) => {
  const [format, setFormat] = useState<"questions_only" | "with_answers">(
    "questions_only"
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload(format === "with_answers");
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
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Content Type:</span>{" "}
            <span className="text-foreground">
              Student-Created {typeLabel}
            </span>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Choose format:</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) =>
                setFormat(value as "questions_only" | "with_answers")
              }
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                <RadioGroupItem value="questions_only" id="questions_only" className="mt-0.5" />
                <div className="flex-1">
                  <Label
                    htmlFor="questions_only"
                    className="flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Questions only
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Print blank answer spaces for practice
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                  hasAnswers
                    ? "bg-card hover:bg-accent/50 cursor-pointer"
                    : "bg-muted/30 opacity-60 cursor-not-allowed"
                }`}
              >
                <RadioGroupItem
                  value="with_answers"
                  id="with_answers"
                  disabled={!hasAnswers}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="with_answers"
                    className={`flex items-center gap-2 font-medium ${
                      hasAnswers ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                  >
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    Questions + my answers
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasAnswers
                      ? "Include your saved responses in the PDF"
                      : "You haven't answered any questions yet"}
                  </p>
                </div>
              </div>
            </RadioGroup>
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
