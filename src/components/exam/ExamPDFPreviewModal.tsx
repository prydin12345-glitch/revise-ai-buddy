import { useState } from "react";
import { Download, Eye, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { generateExamPDF, downloadPDF, openPDFInNewTab } from "@/lib/exam-pdf-generator";
import { toast } from "sonner";

interface ExamQuestion {
  id: string;
  question_number: string;
  question_text: string;
  question_type: string;
  marks: number;
  options?: { label: string; text: string }[] | null;
  figure_urls?: string[] | null;
  correct_answer?: string | null;
  topic_tag?: string | null;
  sub_questions?: { label: string; text: string; marks: number }[] | null;
  requires_graph?: boolean;
  requires_diagram?: boolean;
}

interface ExamData {
  title: string;
  subject?: string;
  exam_board?: string;
  qualification_level?: string;
  time_allowed?: number;
  questions: ExamQuestion[];
}

interface ExamPDFPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examData: ExamData;
  examTitle: string;
}

export function ExamPDFPreviewModal({
  open,
  onOpenChange,
  examData,
  examTitle,
}: ExamPDFPreviewModalProps) {
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [includeWorkingSpace, setIncludeWorkingSpace] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [generating, setGenerating] = useState(false);

  const totalMarks = examData.questions.reduce((sum, q) => sum + q.marks, 0);
  const mcqCount = examData.questions.filter(q => q.question_type === "MCQ").length;
  const writtenCount = examData.questions.length - mcqCount;

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const doc = await generateExamPDF(examData, {
        includeAnswerKey,
        includeWorkingSpace,
        showMarks,
      });
      const filename = `${examTitle.replace(/[^a-z0-9]/gi, "_")}_exam.pdf`;
      downloadPDF(doc, filename);
      toast.success("PDF downloaded successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const doc = await generateExamPDF(examData, {
        includeAnswerKey,
        includeWorkingSpace,
        showMarks,
      });
      openPDFInNewTab(doc);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate preview");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Exam as PDF
          </DialogTitle>
          <DialogDescription>
            Configure your print settings before downloading
          </DialogDescription>
        </DialogHeader>

        {/* Exam Summary */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <h4 className="font-medium text-sm">{examData.title}</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{examData.questions.length} questions</span>
            <span>{totalMarks} total marks</span>
            {mcqCount > 0 && <span>{mcqCount} MCQ</span>}
            {writtenCount > 0 && <span>{writtenCount} written</span>}
          </div>
          {(examData.subject || examData.exam_board) && (
            <div className="text-xs text-muted-foreground">
              {[examData.subject, examData.exam_board, examData.qualification_level]
                .filter(Boolean)
                .join(" • ")}
            </div>
          )}
        </div>

        <Separator />

        {/* PDF Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-marks">Show marks per question</Label>
              <p className="text-xs text-muted-foreground">
                Display mark allocation for each question
              </p>
            </div>
            <Switch
              id="show-marks"
              checked={showMarks}
              onCheckedChange={setShowMarks}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="working-space">Include answer lines</Label>
              <p className="text-xs text-muted-foreground">
                Add blank lines for written answers
              </p>
            </div>
            <Switch
              id="working-space"
              checked={includeWorkingSpace}
              onCheckedChange={setIncludeWorkingSpace}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="answer-key">Include answer key</Label>
              <p className="text-xs text-muted-foreground">
                Add answers on a separate page at the end
              </p>
            </div>
            <Switch
              id="answer-key"
              checked={includeAnswerKey}
              onCheckedChange={setIncludeAnswerKey}
            />
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePreview}
            disabled={generating}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            className="flex-1"
            onClick={handleDownload}
            disabled={generating}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
