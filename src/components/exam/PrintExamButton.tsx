import { gatewayPaperDisplay } from "@/lib/biology-paper-display";
import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
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
  diagram_type?: string | null;
  circuit_type?: string | null;
  circuit_description?: string | null;
  graph_description?: string | null;
  requires_graph?: boolean;
  requires_diagram?: boolean;
  diagramConfig?: any;
  diagram_config?: any;
  table_data?: string | null;
}

// Build diagramConfig from question metadata
function buildDiagramConfig(q: any): any | undefined {
  if (q.diagram_config && typeof q.diagram_config === 'object') return q.diagram_config;
  // Explicit diagram_type field
  if (q.diagram_type) {
    return { type: q.diagram_type, ...(q.graph_description ? { description: q.graph_description } : {}) };
  }
  // Circuit diagrams
  if (q.circuit_type) {
    return { type: q.circuit_type, description: q.circuit_description || '' };
  }
  return undefined;
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
    generation_context?: unknown;
    time_allowed?: number;
    questions: ExamQuestion[];
  } | null>(null);

  const fetchExamData = async () => {
    setLoading(true);
    try {
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .select("title, exam_board, qualification_level, detected_subject, generation_context")
        .eq("id", examId)
        .single();

      if (examError) throw examError;

      const { data: payload, error: questionsError } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId, isPreview: true },
      });
      if (questionsError) throw questionsError;
      const questions = payload?.questions ?? [];

      const formattedQuestions: ExamQuestion[] = questions.map(q => {
        const diagramConfig = buildDiagramConfig(q);
        return {
          id: q.id,
          question_number: q.question_number,
          question_text: q.question_text,
          question_type: q.question_type,
          marks: q.marks,
          options: q.options as { label: string; text: string }[] | null,
          figure_urls: q.figure_urls,
          correct_answer: q.correct_answer,
          topic_tag: q.topic_tag,
          diagram_type: q.diagram_type,
          circuit_type: q.circuit_type,
          circuit_description: q.circuit_description,
          graph_description: q.graph_description,
          requires_graph: q.question_type === 'graph_sketch' || q.question_type === 'graph_plotting',
          requires_diagram: !!q.diagram_type || !!q.circuit_type,
          diagramConfig,
          diagram_config: q.diagram_config,
          table_data: q.table_data,
        };
      });

      const paper = gatewayPaperDisplay(exam.generation_context);
      setExamData({
        title: exam.title,
        subject: paper ? "Gateway Biology A" : exam.detected_subject || undefined,
        exam_board: exam.exam_board || undefined,
        qualification_level: paper ? `GCSE · ${paper.plan.tier} · ${paper.plan.componentCode}` : exam.qualification_level || undefined,
        generation_context: exam.generation_context,
        time_allowed: paper?.plan.durationMinutes,
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
