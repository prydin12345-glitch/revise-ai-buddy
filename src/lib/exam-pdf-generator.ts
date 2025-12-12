import jsPDF from "jspdf";

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

interface ExamData {
  title: string;
  subject?: string;
  exam_board?: string;
  qualification_level?: string;
  total_marks?: number;
  questions: ExamQuestion[];
}

interface PDFOptions {
  includeAnswerKey?: boolean;
  includeWorkingSpace?: boolean;
  showMarks?: boolean;
}

const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 25;
const MARGIN_BOTTOM = 20;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 6;
const QUESTION_SPACING = 12;

export async function generateExamPDF(
  examData: ExamData,
  options: PDFOptions = {}
): Promise<jsPDF> {
  const { includeAnswerKey = false, includeWorkingSpace = true, showMarks = true } = options;
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let yPosition = MARGIN_TOP;
  let currentPage = 1;

  const addNewPageIfNeeded = (requiredSpace: number): void => {
    if (yPosition + requiredSpace > A4_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      currentPage++;
      yPosition = MARGIN_TOP;
      addPageNumber();
    }
  };

  const addPageNumber = (): void => {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${currentPage}`, A4_WIDTH / 2, A4_HEIGHT - 10, { align: "center" });
    doc.setTextColor(0, 0, 0);
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(examData.title, A4_WIDTH / 2, yPosition, { align: "center" });
  yPosition += 10;

  // Subject and exam info line
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const infoLines: string[] = [];
  if (examData.subject) infoLines.push(`Subject: ${examData.subject}`);
  if (examData.exam_board) infoLines.push(`Board: ${examData.exam_board}`);
  if (examData.qualification_level) infoLines.push(`Level: ${examData.qualification_level}`);
  
  if (infoLines.length > 0) {
    doc.text(infoLines.join("  •  "), A4_WIDTH / 2, yPosition, { align: "center" });
    yPosition += 8;
  }

  // Total marks and questions info
  const totalMarks = examData.total_marks || examData.questions.reduce((sum, q) => sum + q.marks, 0);
  doc.setFontSize(10);
  doc.text(
    `Total Questions: ${examData.questions.length}  •  Total Marks: ${totalMarks}`,
    A4_WIDTH / 2,
    yPosition,
    { align: "center" }
  );
  yPosition += 12;

  // Instructions box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(MARGIN_LEFT, yPosition, CONTENT_WIDTH, 28, 2, 2, "FD");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Instructions", MARGIN_LEFT + 5, yPosition + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const instructions = [
    "• Read each question carefully before answering.",
    "• Write your answers clearly in blue or black ink.",
    "• Show all working for calculation questions.",
    "• The marks for each question are shown in brackets."
  ];
  instructions.forEach((instruction, index) => {
    doc.text(instruction, MARGIN_LEFT + 5, yPosition + 12 + (index * 4));
  });
  yPosition += 35;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN_LEFT, yPosition, A4_WIDTH - MARGIN_RIGHT, yPosition);
  yPosition += 10;

  // Questions
  for (let i = 0; i < examData.questions.length; i++) {
    const question = examData.questions[i];
    const questionNumber = question.question_number || String(i + 1);
    
    // Calculate space needed for this question
    const questionTextLines = doc.splitTextToSize(question.question_text, CONTENT_WIDTH - 20);
    let spaceNeeded = 15 + (questionTextLines.length * LINE_HEIGHT);
    
    if (question.question_type === "MCQ" && question.options) {
      spaceNeeded += question.options.length * 7;
    } else if (includeWorkingSpace) {
      spaceNeeded += question.marks <= 2 ? 15 : question.marks <= 5 ? 30 : 45;
    }
    
    addNewPageIfNeeded(spaceNeeded);

    // Question number and marks
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const marksText = showMarks ? `[${question.marks} mark${question.marks > 1 ? "s" : ""}]` : "";
    doc.text(`Question ${questionNumber}`, MARGIN_LEFT, yPosition);
    
    if (showMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(marksText, A4_WIDTH - MARGIN_RIGHT, yPosition, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }
    yPosition += 7;

    // Question text - clean LaTeX for plain text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const cleanedText = cleanLatexForPDF(question.question_text);
    const textLines = doc.splitTextToSize(cleanedText, CONTENT_WIDTH - 10);
    textLines.forEach((line: string) => {
      addNewPageIfNeeded(LINE_HEIGHT);
      doc.text(line, MARGIN_LEFT + 5, yPosition);
      yPosition += LINE_HEIGHT;
    });
    yPosition += 3;

    // MCQ Options
    if (question.question_type === "MCQ" && question.options && Array.isArray(question.options)) {
      for (const option of question.options) {
        addNewPageIfNeeded(8);
        
        // Draw empty circle for answer
        doc.setDrawColor(100, 100, 100);
        doc.circle(MARGIN_LEFT + 8, yPosition - 1.5, 2);
        
        doc.setFontSize(10);
        const optionText = `${option.label}) ${option.text}`;
        const cleanedOption = cleanLatexForPDF(optionText);
        doc.text(cleanedOption, MARGIN_LEFT + 15, yPosition);
        yPosition += 7;
      }
    } else if (includeWorkingSpace) {
      // Answer lines for written questions
      const numLines = question.marks <= 2 ? 2 : question.marks <= 5 ? 4 : 6;
      doc.setDrawColor(220, 220, 220);
      
      for (let line = 0; line < numLines; line++) {
        addNewPageIfNeeded(8);
        doc.line(MARGIN_LEFT + 5, yPosition + 5, A4_WIDTH - MARGIN_RIGHT - 5, yPosition + 5);
        yPosition += 8;
      }
    }

    yPosition += QUESTION_SPACING;
  }

  addPageNumber();

  // Answer Key (if requested)
  if (includeAnswerKey) {
    doc.addPage();
    currentPage++;
    yPosition = MARGIN_TOP;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Answer Key", A4_WIDTH / 2, yPosition, { align: "center" });
    yPosition += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    for (const question of examData.questions) {
      if (question.correct_answer) {
        addNewPageIfNeeded(10);
        
        const answerText = `Q${question.question_number}: ${cleanLatexForPDF(question.correct_answer)}`;
        const answerLines = doc.splitTextToSize(answerText, CONTENT_WIDTH);
        answerLines.forEach((line: string) => {
          doc.text(line, MARGIN_LEFT, yPosition);
          yPosition += LINE_HEIGHT;
        });
        yPosition += 3;
      }
    }

    addPageNumber();
  }

  return doc;
}

function cleanLatexForPDF(text: string): string {
  if (!text) return "";
  
  // Remove display math delimiters
  let cleaned = text.replace(/\$\$(.*?)\$\$/g, "$1");
  // Remove inline math delimiters
  cleaned = cleaned.replace(/\$(.*?)\$/g, "$1");
  // Clean common LaTeX commands
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  cleaned = cleaned.replace(/\\times/g, "×");
  cleaned = cleaned.replace(/\\div/g, "÷");
  cleaned = cleaned.replace(/\\pm/g, "±");
  cleaned = cleaned.replace(/\\leq/g, "≤");
  cleaned = cleaned.replace(/\\geq/g, "≥");
  cleaned = cleaned.replace(/\\neq/g, "≠");
  cleaned = cleaned.replace(/\\approx/g, "≈");
  cleaned = cleaned.replace(/\\pi/g, "π");
  cleaned = cleaned.replace(/\\alpha/g, "α");
  cleaned = cleaned.replace(/\\beta/g, "β");
  cleaned = cleaned.replace(/\\gamma/g, "γ");
  cleaned = cleaned.replace(/\\theta/g, "θ");
  cleaned = cleaned.replace(/\\lambda/g, "λ");
  cleaned = cleaned.replace(/\\mu/g, "μ");
  cleaned = cleaned.replace(/\\sigma/g, "σ");
  cleaned = cleaned.replace(/\\omega/g, "ω");
  cleaned = cleaned.replace(/\\Delta/g, "Δ");
  cleaned = cleaned.replace(/\\sum/g, "Σ");
  cleaned = cleaned.replace(/\\infty/g, "∞");
  cleaned = cleaned.replace(/\\rightarrow/g, "→");
  cleaned = cleaned.replace(/\\leftarrow/g, "←");
  cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\^{([^}]+)}/g, "^$1");
  cleaned = cleaned.replace(/_{([^}]+)}/g, "_$1");
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, ""); // Remove remaining commands
  cleaned = cleaned.replace(/[{}]/g, ""); // Remove braces
  
  return cleaned.trim();
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

export function openPDFInNewTab(doc: jsPDF): void {
  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank");
}
