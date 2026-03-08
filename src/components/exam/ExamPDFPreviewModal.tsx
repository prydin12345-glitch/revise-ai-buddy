import { useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  diagramConfig?: any;
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

type AnswerStyle = 'auto' | 'blank' | 'lined' | 'grid' | 'minimal';

export function ExamPDFPreviewModal({
  open,
  onOpenChange,
  examData,
  examTitle,
}: ExamPDFPreviewModalProps) {
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [includeWorkingSpace, setIncludeWorkingSpace] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [includeDiagrams, setIncludeDiagrams] = useState(true);
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>('auto');
  const [generating, setGenerating] = useState(false);

  const totalMarks = examData.questions.reduce((sum, q) => sum + q.marks, 0);
  const mcqCount = examData.questions.filter(q => q.question_type === "MCQ").length;
  const writtenCount = examData.questions.length - mcqCount;
  const diagramCount = examData.questions.filter(q => q.diagramConfig).length;

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const doc = await generateExamPDF(examData, {
        includeAnswerKey,
        includeWorkingSpace,
        showMarks,
        includeDiagrams,
        answerStyle: answerStyle === 'auto' ? undefined : answerStyle,
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
        includeDiagrams,
        answerStyle: answerStyle === 'auto' ? undefined : answerStyle,
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
            {diagramCount > 0 && <span>{diagramCount} with diagrams</span>}
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
            <Switch id="show-marks" checked={showMarks} onCheckedChange={setShowMarks} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="working-space">Include answer areas</Label>
              <p className="text-xs text-muted-foreground">
                Add space for written answers
              </p>
            </div>
            <Switch id="working-space" checked={includeWorkingSpace} onCheckedChange={setIncludeWorkingSpace} />
          </div>

          {includeWorkingSpace && (
            <div className="space-y-2">
              <Label>Answer area style</Label>
              <Select value={answerStyle} onValueChange={(v) => setAnswerStyle(v as AnswerStyle)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (based on subject)</SelectItem>
                  <SelectItem value="blank">Blank boxes</SelectItem>
                  <SelectItem value="lined">Lined paper</SelectItem>
                  <SelectItem value="grid">Grid boxes</SelectItem>
                  <SelectItem value="minimal">Minimal (white space)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {diagramCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-diagrams">Include diagrams</Label>
                <p className="text-xs text-muted-foreground">
                  Render {diagramCount} diagram{diagramCount !== 1 ? 's' : ''} in the PDF
                </p>
              </div>
              <Switch id="include-diagrams" checked={includeDiagrams} onCheckedChange={setIncludeDiagrams} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="answer-key">Include answer key</Label>
              <p className="text-xs text-muted-foreground">
                Add answers on a separate page at the end
              </p>
            </div>
            <Switch id="answer-key" checked={includeAnswerKey} onCheckedChange={setIncludeAnswerKey} />
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handlePreview} disabled={generating}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button className="flex-1" onClick={handleDownload} disabled={generating}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
