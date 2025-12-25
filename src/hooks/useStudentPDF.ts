import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateExamPDF, downloadPDF } from "@/lib/exam-pdf-generator";

interface StudentPDFOptions {
  contentType: "exam" | "practice";
  contentId: string;
}

interface PDFQuestion {
  id: string;
  question_number: string;
  question_text: string;
  question_type: string;
  marks: number;
  options?: any;
  correct_answer?: string | null;
  topic_tag?: string | null;
  table_data?: string | null;
}

interface PDFData {
  type: "student_exam" | "student_practice";
  title: string;
  subject: string;
  difficulty?: string;
  subtopics?: string[];
  totalQuestions: number;
  dateGenerated: string;
  questions: PDFQuestion[];
}

export const useStudentPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateStudentPDF = async (options: StudentPDFOptions) => {
    setIsGenerating(true);
    try {
      // Call edge function to get PDF data with ownership verification
      const { data, error } = await supabase.functions.invoke(
        "generate-student-pdf",
        {
          body: { ...options, includeAnswers: false },
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to generate PDF data");
      }

      if (!data?.success || !data?.pdfData) {
        throw new Error(data?.error || "Failed to generate PDF");
      }

      const pdfData: PDFData = data.pdfData;

      // Transform questions for PDF generator
      const examData = {
        title: pdfData.title,
        subject: pdfData.subject,
        total_marks: pdfData.questions.reduce((sum, q) => sum + (q.marks || 1), 0),
        questions: pdfData.questions.map((q) => ({
          id: q.id,
          question_number: q.question_number,
          question_text: q.question_text,
          question_type: q.question_type,
          marks: q.marks,
          options: q.options,
          topic_tag: q.topic_tag,
          table_data: q.table_data,
        })),
      };

      // Add header based on content type
      const isExam = pdfData.type === "student_exam";
      const headerLabel = isExam
        ? "Student-Created Practice Exam"
        : "Student-Created Practice Questions";

      // Generate PDF using existing generator
      const doc = await generateExamPDF(examData, {
        includeAnswerKey: false,
        includeWorkingSpace: true,
        showMarks: true,
        answerStyle: "lined",
      });

      // Add student-created label to first page
      doc.setPage(1);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(headerLabel, 20, 15);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 190, 15, {
        align: "right",
      });

      // Generate filename
      const sanitizedTitle = pdfData.title
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 50);
      const filename = `${sanitizedTitle}_questions.pdf`;

      // Download PDF
      downloadPDF(doc, filename);

      toast({
        title: "PDF Downloaded",
        description: `Your ${isExam ? "exam" : "practice set"} PDF has been downloaded.`,
      });

      return true;
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateStudentPDF,
    isGenerating,
  };
};
