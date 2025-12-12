import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { generateExamPDF, downloadPDF } from "@/lib/exam-pdf-generator";
import { toast } from "sonner";
import { ExamPDFPreviewModal } from "./ExamPDFPreviewModal";

interface PrintExamButtonProps {
  examId: string;
  examTitle: string;
  variant?: "ghost" | "default" | "outline";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
}

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
}

export function PrintExamButton({ 
  examId, 
  examTitle, 
  variant = "ghost",
  size = "sm",
  showLabel = false 
}: PrintExamButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [examData, setExamData] = useState<{
    title: string;
    subject?: string;
    exam_board?: string;
    qualification_level?: string;
    questions: ExamQuestion[];
  } | null>(null);

  const fetchExamData = async () => {
    setLoading(true);
    try {
      // Fetch exam details
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .select("title, exam_board, qualification_level, detected_subject")
        .eq("id", examId)
        .single();

      if (examError) throw examError;

      // Fetch exam questions
      const { data: questions, error: questionsError } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", examId)
        .order("question_number");

      if (questionsError) throw questionsError;

      const formattedQuestions: ExamQuestion[] = questions.map(q => ({
        id: q.id,
        question_number: q.question_number,
        question_text: q.question_text,
        question_type: q.question_type,
        marks: q.marks,
        options: q.options as { label: string; text: string }[] | null,
        figure_urls: q.figure_urls,
        correct_answer: q.correct_answer,
        topic_tag: q.topic_tag,
      }));

      setExamData({
        title: exam.title,
        subject: exam.detected_subject || undefined,
        exam_board: exam.exam_board || undefined,
        qualification_level: exam.qualification_level || undefined,
        questions: formattedQuestions,
      });

      setShowPreview(true);
    } catch (error) {
      console.error("Error fetching exam data:", error);
      toast.error("Failed to load exam data for PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDownload = async () => {
    if (!examData) {
      await fetchExamData();
    }
    
    if (examData) {
      try {
        const doc = await generateExamPDF(examData, {
          includeAnswerKey: false,
          includeWorkingSpace: true,
          showMarks: true,
        });
        const filename = `${examTitle.replace(/[^a-z0-9]/gi, "_")}_exam.pdf`;
        downloadPDF(doc, filename);
        toast.success("PDF downloaded successfully");
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast.error("Failed to generate PDF");
      }
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={fetchExamData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {showLabel && <span className="ml-2">Print PDF</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Download as printable PDF
        </TooltipContent>
      </Tooltip>

      {examData && (
        <ExamPDFPreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          examData={examData}
          examTitle={examTitle}
        />
      )}
    </>
  );
}
