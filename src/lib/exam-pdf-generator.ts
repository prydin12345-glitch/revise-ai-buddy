import jsPDF from "jspdf";

// ============= Type Definitions =============
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
  graph_range?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

interface ExamData {
  title: string;
  subject?: string;
  exam_board?: string;
  qualification_level?: string;
  total_marks?: number;
  time_allowed?: number;
  questions: ExamQuestion[];
}

interface PDFOptions {
  includeAnswerKey?: boolean;
  includeWorkingSpace?: boolean;
  showMarks?: boolean;
  answerStyle?: 'blank' | 'lined' | 'grid' | 'minimal';
}

// ============= Constants =============
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5;
const QUESTION_PADDING = 6;
const BOX_RADIUS = 2;

// Larger answer box heights (increased from original)
const ANSWER_BOX_SHORT = 25;   // Was 18
const ANSWER_BOX_MEDIUM = 50;  // Was 35
const ANSWER_BOX_LONG = 80;    // Was 55

// Grid settings for graph questions
const GRID_CELL_SIZE = 5;
const GRID_WIDTH = 80;
const GRID_HEIGHT = 60;

// Colors (RGB values)
const COLORS = {
  primary: [41, 41, 41] as const,
  secondary: [100, 100, 100] as const,
  muted: [150, 150, 150] as const,
  border: [200, 200, 200] as const,
  lightBg: [250, 250, 250] as const,
  answerBox: [248, 248, 248] as const,
  linedBg: [252, 252, 255] as const,
};

// Unicode superscript and subscript maps
const SUPERSCRIPT_MAP: { [key: string]: string } = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
};

const SUBSCRIPT_MAP: { [key: string]: string } = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
  'i': 'ᵢ', 'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ',
};

// Common fractions as Unicode
const FRACTION_MAP: { [key: string]: string } = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
  '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚', '1/7': '⅐', '1/8': '⅛',
  '3/8': '⅜', '5/8': '⅝', '7/8': '⅞', '1/9': '⅑', '1/10': '⅒',
};

// ============= Question Sorting =============
function parseQuestionNumber(num: string): { main: number; sub: string; subOrder: number } {
  const cleaned = num.trim();
  const match = cleaned.match(/^(\d+)([a-z]?)(?:\s*[.)\]]?\s*([ivxlcdm]+)?)?$/i);
  
  if (!match) {
    const numOnly = parseInt(cleaned);
    return { main: isNaN(numOnly) ? 0 : numOnly, sub: '', subOrder: 0 };
  }
  
  const main = parseInt(match[1]);
  const sub = (match[2] || '').toLowerCase();
  const subOrder = sub ? sub.charCodeAt(0) - 96 : 0; // a=1, b=2, etc.
  
  return { main, sub, subOrder };
}

function sortQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  return [...questions].sort((a, b) => {
    const numA = parseQuestionNumber(a.question_number);
    const numB = parseQuestionNumber(b.question_number);
    
    if (numA.main !== numB.main) return numA.main - numB.main;
    return numA.subOrder - numB.subOrder;
  });
}

// ============= Subject Detection =============
function getSubjectType(subject?: string): 'math' | 'science' | 'essay' | 'general' {
  if (!subject) return 'general';
  const s = subject.toLowerCase();
  
  if (['maths', 'mathematics', 'math', 'algebra', 'calculus', 'geometry', 'statistics'].some(k => s.includes(k))) {
    return 'math';
  }
  if (['physics', 'chemistry', 'biology', 'science'].some(k => s.includes(k))) {
    return 'science';
  }
  if (['english', 'history', 'literature', 'essay', 'geography', 'sociology', 'psychology'].some(k => s.includes(k))) {
    return 'essay';
  }
  return 'general';
}

function getAnswerAreaType(subject?: string, marks?: number, questionType?: string): 'blank' | 'lined' | 'grid' | 'none' {
  if (questionType === 'MCQ') return 'none';
  
  const subjectType = getSubjectType(subject);
  
  switch (subjectType) {
    case 'math':
      return 'blank'; // Large blank boxes for working
    case 'essay':
      return 'lined'; // Lined areas for written responses
    case 'science':
      return (marks && marks > 4) ? 'grid' : 'blank'; // Grid for calculations
    default:
      return 'blank';
  }
}

// ============= Main PDF Generation Function =============
export async function generateExamPDF(
  examData: ExamData,
  options: PDFOptions = {}
): Promise<jsPDF> {
  const { 
    includeAnswerKey = false, 
    includeWorkingSpace = true, 
    showMarks = true,
    answerStyle 
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let yPosition = MARGIN;
  let currentPage = 1;
  let totalPages = 1;

  // Sort questions by number before processing
  const sortedQuestions = sortQuestions(examData.questions);

  // ============= Helper Functions =============
  const setColor = (color: readonly number[], type: "text" | "draw" | "fill" = "text") => {
    if (type === "text") doc.setTextColor(color[0], color[1], color[2]);
    else if (type === "draw") doc.setDrawColor(color[0], color[1], color[2]);
    else doc.setFillColor(color[0], color[1], color[2]);
  };

  const addNewPageIfNeeded = (requiredSpace: number): boolean => {
    if (yPosition + requiredSpace > A4_HEIGHT - MARGIN - 20) {
      doc.addPage();
      currentPage++;
      totalPages++;
      yPosition = MARGIN;
      return true;
    }
    return false;
  };

  const safeDrawText = (text: string, x: number, y: number, maxWidth: number): number => {
    const lines = doc.splitTextToSize(text, maxWidth);
    let currentY = y;
    
    for (const line of lines) {
      if (currentY > A4_HEIGHT - MARGIN - 20) {
        doc.addPage();
        currentPage++;
        totalPages++;
        currentY = MARGIN;
      }
      doc.text(line, x, currentY);
      currentY += LINE_HEIGHT;
    }
    
    return lines.length * LINE_HEIGHT;
  };

  const addPageNumbers = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      setColor(COLORS.muted);
      doc.setFont("helvetica", "normal");
      
      // Footer line
      setColor(COLORS.border, "draw");
      doc.line(MARGIN, A4_HEIGHT - 18, A4_WIDTH - MARGIN, A4_HEIGHT - 18);
      
      // Page number
      doc.text(`Page ${i} of ${pageCount}`, A4_WIDTH / 2, A4_HEIGHT - 12, { align: "center" });
    }
  };

  const drawRoundedRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    options: { fill?: boolean; stroke?: boolean } = { fill: false, stroke: true }
  ) => {
    const style = options.fill && options.stroke ? "FD" : options.fill ? "F" : "D";
    doc.roundedRect(x, y, width, height, BOX_RADIUS, BOX_RADIUS, style);
  };

  // ============= Header Section =============
  const drawHeader = () => {
    // Title box
    setColor(COLORS.border, "draw");
    setColor(COLORS.lightBg, "fill");
    drawRoundedRect(MARGIN, yPosition, CONTENT_WIDTH, 45, { fill: true, stroke: true });

    // Exam title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    const titleLines = doc.splitTextToSize(examData.title.toUpperCase(), CONTENT_WIDTH - 20);
    const titleY = yPosition + (titleLines.length > 1 ? 8 : 10);
    titleLines.forEach((line: string, idx: number) => {
      doc.text(line, A4_WIDTH / 2, titleY + (idx * 6), { align: "center" });
    });

    // Subject, Board, Level info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(COLORS.secondary);
    const infoItems: string[] = [];
    if (examData.subject) infoItems.push(`Subject: ${examData.subject}`);
    if (examData.exam_board) infoItems.push(`Board: ${examData.exam_board}`);
    if (examData.qualification_level) infoItems.push(`Level: ${examData.qualification_level}`);
    
    if (infoItems.length > 0) {
      doc.text(infoItems.join("  •  "), A4_WIDTH / 2, yPosition + 17, { align: "center" });
    }

    // Separator line
    setColor(COLORS.border, "draw");
    doc.line(MARGIN + 10, yPosition + 22, A4_WIDTH - MARGIN - 10, yPosition + 22);

    // Student info fields
    doc.setFontSize(9);
    setColor(COLORS.primary);
    doc.text("Name:", MARGIN + 8, yPosition + 30);
    doc.text("Student ID:", MARGIN + 80, yPosition + 30);
    doc.text("Date:", MARGIN + 135, yPosition + 30);

    // Underlines for student info
    setColor(COLORS.border, "draw");
    doc.line(MARGIN + 20, yPosition + 31, MARGIN + 70, yPosition + 31);
    doc.line(MARGIN + 98, yPosition + 31, MARGIN + 128, yPosition + 31);
    doc.line(MARGIN + 147, yPosition + 31, MARGIN + 165, yPosition + 31);

    // Total marks and time
    const totalMarks = examData.total_marks || sortedQuestions.reduce((sum, q) => sum + q.marks, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    let footerText = `Total Marks: ${totalMarks}`;
    if (examData.time_allowed) {
      footerText += `  •  Time Allowed: ${examData.time_allowed} minutes`;
    }
    doc.text(footerText, A4_WIDTH / 2, yPosition + 40, { align: "center" });

    yPosition += 52;
  };

  // ============= Instructions Section =============
  const drawInstructions = () => {
    const instructionHeight = 32;
    
    setColor(COLORS.border, "draw");
    setColor([252, 252, 252], "fill");
    drawRoundedRect(MARGIN, yPosition, CONTENT_WIDTH, instructionHeight, { fill: true, stroke: true });

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text("INSTRUCTIONS", MARGIN + 6, yPosition + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(COLORS.secondary);
    
    const instructions = [
      "•  Read each question carefully before answering.",
      "•  Write your answers clearly in blue or black ink.",
      "•  Show all working for calculation questions.",
      "•  The marks for each question are shown in brackets."
    ];
    
    instructions.forEach((instruction, index) => {
      doc.text(instruction, MARGIN + 6, yPosition + 14 + (index * 4.5));
    });

    yPosition += instructionHeight + 8;
  };

  // ============= Answer Box Drawing =============
  const drawAnswerBox = (x: number, y: number, width: number, height: number, label: string = "Answer:") => {
    setColor(COLORS.border, "draw");
    setColor(COLORS.answerBox, "fill");
    drawRoundedRect(x, y, width, height, { fill: true, stroke: true });

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    setColor(COLORS.muted);
    doc.text(label, x + 4, y + 5);
  };

  // ============= Lined Answer Area Drawing =============
  const drawLinedArea = (x: number, y: number, width: number, lineCount: number) => {
    const lineSpacing = 8; // 8mm between lines
    setColor(COLORS.linedBg, "fill");
    doc.rect(x, y, width, lineCount * lineSpacing, "F");
    
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.1);
    
    for (let i = 0; i <= lineCount; i++) {
      doc.line(x, y + (i * lineSpacing), x + width, y + (i * lineSpacing));
    }
    
    // Draw border
    doc.setLineWidth(0.2);
    doc.rect(x, y, width, lineCount * lineSpacing, "D");
    
    return lineCount * lineSpacing;
  };

  // ============= Grid Answer Area Drawing =============
  const drawGridArea = (x: number, y: number, width: number, height: number) => {
    const cellSize = 5; // 5mm grid cells
    
    setColor([254, 254, 254], "fill");
    doc.rect(x, y, width, height, "F");
    
    setColor([220, 220, 220], "draw");
    doc.setLineWidth(0.1);
    
    // Draw vertical grid lines
    for (let i = 0; i <= width / cellSize; i++) {
      doc.line(x + (i * cellSize), y, x + (i * cellSize), y + height);
    }
    
    // Draw horizontal grid lines
    for (let i = 0; i <= height / cellSize; i++) {
      doc.line(x, y + (i * cellSize), x + width, y + (i * cellSize));
    }
    
    // Draw border
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.2);
    doc.rect(x, y, width, height, "D");
  };

  // ============= Coordinate Grid Drawing =============
  const drawCoordinateGrid = (x: number, y: number, width: number, height: number) => {
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.1);

    const cellSize = GRID_CELL_SIZE;
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);

    // Vertical lines
    for (let i = 0; i <= cols; i++) {
      doc.line(x + i * cellSize, y, x + i * cellSize, y + height);
    }
    // Horizontal lines
    for (let i = 0; i <= rows; i++) {
      doc.line(x, y + i * cellSize, x + width, y + i * cellSize);
    }

    // Draw axes (thicker)
    doc.setLineWidth(0.5);
    setColor([80, 80, 80], "draw");
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    doc.line(x, centerY, x + width, centerY); // X-axis
    doc.line(centerX, y, centerX, y + height); // Y-axis

    // Axis labels
    doc.setFontSize(8);
    setColor(COLORS.secondary);
    doc.text("x", x + width - 3, centerY - 2);
    doc.text("y", centerX + 2, y + 4);

    doc.setLineWidth(0.2);
  };

  // ============= Diagram Placeholder Drawing =============
  const drawDiagramPlaceholder = (x: number, y: number, width: number, height: number) => {
    setColor(COLORS.border, "draw");
    setColor([254, 254, 254], "fill");
    drawRoundedRect(x, y, width, height, { fill: true, stroke: true });

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    setColor(COLORS.muted);
    doc.text("Draw your diagram here", x + width / 2, y + height / 2, { align: "center" });
  };

  // ============= Calculate Answer Box Height =============
  const getAnswerBoxHeight = (marks: number, questionType: string): number => {
    if (questionType === 'MCQ') return 0;
    
    if (marks <= 2) return ANSWER_BOX_SHORT;
    if (marks <= 5) return ANSWER_BOX_MEDIUM;
    return ANSWER_BOX_LONG;
  };

  // ============= Question Container Drawing =============
  const drawQuestionContainer = (question: ExamQuestion, questionIndex: number) => {
    const questionNumber = question.question_number || String(questionIndex + 1);
    const cleanedText = cleanLatexForPDF(question.question_text);
    const availableTextWidth = CONTENT_WIDTH - QUESTION_PADDING * 4;
    const textLines = doc.splitTextToSize(cleanedText, availableTextWidth);

    // Pre-calculate content height
    let contentHeight = 16 + (textLines.length * LINE_HEIGHT);

    // Add height for MCQ options
    if (question.question_type === "MCQ" && question.options && Array.isArray(question.options)) {
      contentHeight += question.options.length * 8 + 4;
    } 
    // Add height for sub-questions
    else if (question.sub_questions && question.sub_questions.length > 0) {
      question.sub_questions.forEach(sub => {
        const subLines = doc.splitTextToSize(cleanLatexForPDF(sub.text), CONTENT_WIDTH - QUESTION_PADDING * 6);
        contentHeight += 8 + (subLines.length * LINE_HEIGHT);
        if (includeWorkingSpace) {
          const boxHeight = getAnswerBoxHeight(sub.marks, 'written');
          contentHeight += boxHeight + 6;
        }
      });
    }
    // Add height for answer areas
    else if (includeWorkingSpace && question.question_type !== "MCQ") {
      if (question.requires_graph) {
        contentHeight += GRID_HEIGHT + 10;
      } else if (question.requires_diagram) {
        contentHeight += 55;
      } else {
        const boxHeight = getAnswerBoxHeight(question.marks, question.question_type);
        contentHeight += boxHeight + 8;
      }
    }

    // Check if we need a new page BEFORE starting the question
    if (yPosition + contentHeight + 10 > A4_HEIGHT - MARGIN - 20) {
      doc.addPage();
      currentPage++;
      totalPages++;
      yPosition = MARGIN;
    }

    const containerStartY = yPosition;

    // Draw question container border
    setColor(COLORS.border, "draw");
    setColor([255, 255, 255], "fill");
    drawRoundedRect(MARGIN, yPosition, CONTENT_WIDTH, contentHeight, { fill: true, stroke: true });

    // Question header background
    setColor([248, 249, 250], "fill");
    doc.rect(MARGIN + 0.5, yPosition + 0.5, CONTENT_WIDTH - 1, 10, "F");

    // Question number and marks
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text(`Question ${questionNumber}`, MARGIN + QUESTION_PADDING, yPosition + 7);

    if (showMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      const marksText = `[${question.marks} mark${question.marks > 1 ? "s" : ""}]`;
      doc.text(marksText, A4_WIDTH - MARGIN - QUESTION_PADDING, yPosition + 7, { align: "right" });
    }

    // Header separator line
    setColor(COLORS.border, "draw");
    doc.line(MARGIN + 4, yPosition + 11, A4_WIDTH - MARGIN - 4, yPosition + 11);

    let innerY = yPosition + 16;

    // Question text with proper wrapping
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(COLORS.primary);
    textLines.forEach((line: string) => {
      doc.text(line, MARGIN + QUESTION_PADDING, innerY);
      innerY += LINE_HEIGHT;
    });

    innerY += 4;

    // Handle MCQ options
    if (question.question_type === "MCQ" && question.options && Array.isArray(question.options)) {
      for (const option of question.options) {
        // Draw empty circle for selection
        doc.setLineWidth(0.3);
        setColor(COLORS.secondary, "draw");
        doc.circle(MARGIN + QUESTION_PADDING + 5, innerY - 1.5, 2.5);

        // Option text
        doc.setFontSize(10);
        setColor(COLORS.primary);
        const optionText = `${option.label})  ${cleanLatexForPDF(option.text)}`;
        const optionLines = doc.splitTextToSize(optionText, CONTENT_WIDTH - QUESTION_PADDING * 4);
        optionLines.forEach((line: string, idx: number) => {
          doc.text(line, MARGIN + QUESTION_PADDING + 12, innerY + (idx * LINE_HEIGHT));
        });
        innerY += Math.max(optionLines.length, 1) * LINE_HEIGHT + 3;
      }
      doc.setLineWidth(0.2);
    }
    // Handle sub-questions
    else if (question.sub_questions && question.sub_questions.length > 0) {
      for (const sub of question.sub_questions) {
        // Sub-question label and text
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        setColor(COLORS.primary);
        doc.text(`(${sub.label})`, MARGIN + QUESTION_PADDING + 8, innerY);

        if (showMarks) {
          doc.setFont("helvetica", "normal");
          setColor(COLORS.secondary);
          doc.text(`[${sub.marks} mark${sub.marks > 1 ? "s" : ""}]`, A4_WIDTH - MARGIN - QUESTION_PADDING - 10, innerY, { align: "right" });
        }

        doc.setFont("helvetica", "normal");
        setColor(COLORS.primary);
        const subLines = doc.splitTextToSize(cleanLatexForPDF(sub.text), CONTENT_WIDTH - QUESTION_PADDING * 6);
        subLines.forEach((line: string, idx: number) => {
          doc.text(line, MARGIN + QUESTION_PADDING + 18, innerY + (idx * LINE_HEIGHT));
        });
        innerY += subLines.length * LINE_HEIGHT + 4;

        // Answer area for sub-question based on subject type
        if (includeWorkingSpace) {
          const areaType = answerStyle || getAnswerAreaType(examData.subject, sub.marks, 'written');
          const boxHeight = getAnswerBoxHeight(sub.marks, 'written');
          
          if (areaType === 'lined') {
            const lineCount = Math.max(3, Math.floor(boxHeight / 8));
            drawLinedArea(MARGIN + QUESTION_PADDING + 8, innerY, CONTENT_WIDTH - QUESTION_PADDING * 4, lineCount);
            innerY += lineCount * 8 + 6;
          } else if (areaType === 'grid') {
            drawGridArea(MARGIN + QUESTION_PADDING + 8, innerY, CONTENT_WIDTH - QUESTION_PADDING * 4, boxHeight);
            innerY += boxHeight + 6;
          } else {
            drawAnswerBox(MARGIN + QUESTION_PADDING + 8, innerY, CONTENT_WIDTH - QUESTION_PADDING * 4, boxHeight);
            innerY += boxHeight + 6;
          }
        }
      }
    }
    // Handle graph/diagram/standard answer
    else if (includeWorkingSpace && question.question_type !== "MCQ") {
      const areaType = answerStyle || getAnswerAreaType(examData.subject, question.marks, question.question_type);
      
      if (question.requires_graph) {
        drawCoordinateGrid(MARGIN + QUESTION_PADDING, innerY, GRID_WIDTH, GRID_HEIGHT);
        innerY += GRID_HEIGHT + 8;
      } else if (question.requires_diagram) {
        drawDiagramPlaceholder(MARGIN + QUESTION_PADDING, innerY, CONTENT_WIDTH - QUESTION_PADDING * 2, 50);
        innerY += 55;
      } else {
        const boxHeight = getAnswerBoxHeight(question.marks, question.question_type);
        
        if (areaType === 'lined') {
          const lineCount = Math.max(3, Math.floor(boxHeight / 8));
          drawLinedArea(MARGIN + QUESTION_PADDING, innerY, CONTENT_WIDTH - QUESTION_PADDING * 2, lineCount);
          innerY += lineCount * 8 + 6;
        } else if (areaType === 'grid') {
          drawGridArea(MARGIN + QUESTION_PADDING, innerY, CONTENT_WIDTH - QUESTION_PADDING * 2, boxHeight);
          innerY += boxHeight + 6;
        } else if (areaType !== 'none') {
          drawAnswerBox(MARGIN + QUESTION_PADDING, innerY, CONTENT_WIDTH - QUESTION_PADDING * 2, boxHeight, "Working space / Answer:");
          innerY += boxHeight + 6;
        }
      }
    }

    yPosition = containerStartY + contentHeight + 8;
  };

  // ============= Answer Key Section =============
  const drawAnswerKey = () => {
    doc.addPage();
    yPosition = MARGIN;

    // Header
    setColor(COLORS.border, "draw");
    setColor(COLORS.lightBg, "fill");
    drawRoundedRect(MARGIN, yPosition, CONTENT_WIDTH, 15, { fill: true, stroke: true });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text("ANSWER KEY", A4_WIDTH / 2, yPosition + 10, { align: "center" });
    yPosition += 22;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    for (const question of sortedQuestions) {
      if (!question.correct_answer) continue;

      addNewPageIfNeeded(15);

      const questionNum = question.question_number;
      doc.setFont("helvetica", "bold");
      setColor(COLORS.primary);
      doc.text(`Q${questionNum}:`, MARGIN, yPosition);

      doc.setFont("helvetica", "normal");
      setColor(COLORS.secondary);
      const answerText = cleanLatexForPDF(question.correct_answer);
      const answerLines = doc.splitTextToSize(answerText, CONTENT_WIDTH - 20);
      answerLines.forEach((line: string, idx: number) => {
        doc.text(line, MARGIN + 15, yPosition + (idx * LINE_HEIGHT));
      });

      yPosition += Math.max(answerLines.length * LINE_HEIGHT, 6) + 4;
    }
  };

  // ============= Generate PDF =============
  drawHeader();
  drawInstructions();

  // Draw all questions in sorted order
  for (let i = 0; i < sortedQuestions.length; i++) {
    drawQuestionContainer(sortedQuestions[i], i);
  }

  // Add answer key if requested
  if (includeAnswerKey) {
    drawAnswerKey();
  }

  // Add page numbers to all pages
  addPageNumbers();

  return doc;
}

// ============= Enhanced LaTeX to Unicode Conversion =============
function toSuperscript(str: string): string {
  return str.split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
}

function toSubscript(str: string): string {
  return str.split('').map(c => SUBSCRIPT_MAP[c] || c).join('');
}

function cleanLatexForPDF(text: string): string {
  if (!text) return "";

  let cleaned = text;
  
  // Remove display math delimiters
  cleaned = cleaned.replace(/\$\$(.*?)\$\$/g, "$1");
  // Remove inline math delimiters
  cleaned = cleaned.replace(/\$(.*?)\$/g, "$1");
  
  // Handle fractions with Unicode when possible
  cleaned = cleaned.replace(/\\frac\{(\d)\}\{(\d+)\}/g, (_, num, den) => {
    const key = `${num}/${den}`;
    return FRACTION_MAP[key] || `${num}/${den}`;
  });
  
  // Fallback for complex fractions
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
  
  // Square roots
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  cleaned = cleaned.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (_, n, content) => `${toSuperscript(n)}√(${content})`);
  
  // Exponents with Unicode superscripts
  cleaned = cleaned.replace(/\^{([^}]+)}/g, (_, exp) => toSuperscript(exp));
  cleaned = cleaned.replace(/\^(\d+)/g, (_, exp) => toSuperscript(exp));
  cleaned = cleaned.replace(/\^([a-z])/gi, (_, exp) => toSuperscript(exp));
  
  // Subscripts with Unicode
  cleaned = cleaned.replace(/_{([^}]+)}/g, (_, sub) => toSubscript(sub));
  cleaned = cleaned.replace(/_(\d+)/g, (_, sub) => toSubscript(sub));
  cleaned = cleaned.replace(/_([a-z])/gi, (_, sub) => toSubscript(sub));
  
  // Math operators
  cleaned = cleaned.replace(/\\times/g, "×");
  cleaned = cleaned.replace(/\\div/g, "÷");
  cleaned = cleaned.replace(/\\pm/g, "±");
  cleaned = cleaned.replace(/\\mp/g, "∓");
  cleaned = cleaned.replace(/\\cdot/g, "·");
  
  // Comparisons
  cleaned = cleaned.replace(/\\leq/g, "≤");
  cleaned = cleaned.replace(/\\geq/g, "≥");
  cleaned = cleaned.replace(/\\neq/g, "≠");
  cleaned = cleaned.replace(/\\approx/g, "≈");
  cleaned = cleaned.replace(/\\equiv/g, "≡");
  cleaned = cleaned.replace(/\\lt/g, "<");
  cleaned = cleaned.replace(/\\gt/g, ">");
  
  // Greek letters
  cleaned = cleaned.replace(/\\pi/g, "π");
  cleaned = cleaned.replace(/\\alpha/g, "α");
  cleaned = cleaned.replace(/\\beta/g, "β");
  cleaned = cleaned.replace(/\\gamma/g, "γ");
  cleaned = cleaned.replace(/\\delta/g, "δ");
  cleaned = cleaned.replace(/\\epsilon/g, "ε");
  cleaned = cleaned.replace(/\\theta/g, "θ");
  cleaned = cleaned.replace(/\\lambda/g, "λ");
  cleaned = cleaned.replace(/\\mu/g, "μ");
  cleaned = cleaned.replace(/\\sigma/g, "σ");
  cleaned = cleaned.replace(/\\omega/g, "ω");
  cleaned = cleaned.replace(/\\phi/g, "φ");
  cleaned = cleaned.replace(/\\psi/g, "ψ");
  cleaned = cleaned.replace(/\\rho/g, "ρ");
  cleaned = cleaned.replace(/\\tau/g, "τ");
  cleaned = cleaned.replace(/\\chi/g, "χ");
  cleaned = cleaned.replace(/\\Delta/g, "Δ");
  cleaned = cleaned.replace(/\\Sigma/g, "Σ");
  cleaned = cleaned.replace(/\\Omega/g, "Ω");
  cleaned = cleaned.replace(/\\Pi/g, "Π");
  cleaned = cleaned.replace(/\\Gamma/g, "Γ");
  cleaned = cleaned.replace(/\\Theta/g, "Θ");
  cleaned = cleaned.replace(/\\Lambda/g, "Λ");
  
  // Math symbols
  cleaned = cleaned.replace(/\\sum/g, "Σ");
  cleaned = cleaned.replace(/\\prod/g, "∏");
  cleaned = cleaned.replace(/\\infty/g, "∞");
  cleaned = cleaned.replace(/\\partial/g, "∂");
  cleaned = cleaned.replace(/\\nabla/g, "∇");
  cleaned = cleaned.replace(/\\int/g, "∫");
  cleaned = cleaned.replace(/\\forall/g, "∀");
  cleaned = cleaned.replace(/\\exists/g, "∃");
  cleaned = cleaned.replace(/\\in/g, "∈");
  cleaned = cleaned.replace(/\\notin/g, "∉");
  cleaned = cleaned.replace(/\\subset/g, "⊂");
  cleaned = cleaned.replace(/\\supset/g, "⊃");
  cleaned = cleaned.replace(/\\cup/g, "∪");
  cleaned = cleaned.replace(/\\cap/g, "∩");
  cleaned = cleaned.replace(/\\emptyset/g, "∅");
  
  // Arrows
  cleaned = cleaned.replace(/\\rightarrow/g, "→");
  cleaned = cleaned.replace(/\\leftarrow/g, "←");
  cleaned = cleaned.replace(/\\Rightarrow/g, "⇒");
  cleaned = cleaned.replace(/\\Leftarrow/g, "⇐");
  cleaned = cleaned.replace(/\\leftrightarrow/g, "↔");
  cleaned = cleaned.replace(/\\Leftrightarrow/g, "⇔");
  cleaned = cleaned.replace(/\\to/g, "→");
  cleaned = cleaned.replace(/\\mapsto/g, "↦");
  
  // Logic
  cleaned = cleaned.replace(/\\therefore/g, "∴");
  cleaned = cleaned.replace(/\\because/g, "∵");
  cleaned = cleaned.replace(/\\land/g, "∧");
  cleaned = cleaned.replace(/\\lor/g, "∨");
  cleaned = cleaned.replace(/\\neg/g, "¬");
  
  // Geometry
  cleaned = cleaned.replace(/\\angle/g, "∠");
  cleaned = cleaned.replace(/\\degree/g, "°");
  cleaned = cleaned.replace(/\\circ/g, "°");
  cleaned = cleaned.replace(/\\perp/g, "⊥");
  cleaned = cleaned.replace(/\\parallel/g, "∥");
  cleaned = cleaned.replace(/\\triangle/g, "△");
  
  // Text commands
  cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\textit\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\mathrm\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\mathit\{([^}]+)\}/g, "$1");
  
  // Cleanup
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, ""); // Remove remaining commands
  cleaned = cleaned.replace(/[{}]/g, ""); // Remove braces
  cleaned = cleaned.replace(/\s+/g, " "); // Normalize whitespace

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
