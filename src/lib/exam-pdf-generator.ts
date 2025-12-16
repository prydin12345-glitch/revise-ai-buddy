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
  table_data?: string | null;
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
  answerStyle?: 'blank' | 'lined' | 'grid' | 'minimal' | 'dotted_lines';
}

interface QuestionGroup {
  mainNumber: number;
  questions: ExamQuestion[];
  totalMarks: number;
}

// ============= Constants =============
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const FOOTER_HEIGHT = 20;

// Answer box heights based on marks - COMPACT sizing
const ANSWER_HEIGHT_1_2_MARKS = 25;
const ANSWER_HEIGHT_3_4_MARKS = 40;
const ANSWER_HEIGHT_5_PLUS_MARKS = 55;
const ANSWER_HEIGHT_EXTENDED = 70; // For 8+ marks

// Spacing constants - INCREASED for Biology-style layout
const QUESTION_SPACING = 15; // Increased from 8
const MIN_SPACE_FOR_QUESTION = 60; // Increased from 40

// Grid settings
const GRID_CELL_SIZE = 5;
const GRID_WIDTH = 100;
const GRID_HEIGHT = 80;

// Colors (RGB values)
const COLORS = {
  primary: [30, 30, 30] as const,
  secondary: [80, 80, 80] as const,
  muted: [120, 120, 120] as const,
  border: [180, 180, 180] as const,
  answerBoxBg: [248, 248, 250] as const,
  answerBoxBorder: [200, 200, 200] as const,
  separator: [180, 180, 180] as const,
  linedBg: [254, 254, 255] as const,
};

// ============= Parse Embedded MCQ Options from Question Text =============
function parseEmbeddedMCQOptions(questionText: string): { 
  cleanText: string; 
  options: { label: string; text: string }[] 
} {
  if (!questionText) return { cleanText: '', options: [] };
  
  // Pattern to match: A) text  or  A. text  or  A: text
  // Handles options that span multiple patterns
  const optionPattern = /([A-E])[).:]\s*([^A-E]*?)(?=\s*[A-E])[).:]|\s|$)/gi;
  const matches = [...questionText.matchAll(optionPattern)];
  
  if (matches.length >= 3) {
    // Find where options start - look for first option pattern
    const firstOptionMatch = questionText.match(/[A-E])[..:]\s/i);
    const firstOptionIndex = firstOptionMatch ? questionText.indexOf(firstOptionMatch[0]) : -1;
    
    // Extract clean question (everything before first option)
    const cleanText = firstOptionIndex > 0 
      ? questionText.substring(0, firstOptionIndex).trim() 
      : questionText;
    
    const options = matches.map(match => ({
      label: match[1].toUpperCase(),
      text: match[2].trim()
    })).filter(opt => opt.text.length > 0);
    
    if (options.length >= 3) {
      return { cleanText, options };
    }
  }
  
  return { cleanText: questionText, options: [] };
}

// ============= Question Sorting & Grouping =============
function parseQuestionNumber(num: string): { main: number; sub: string; subOrder: number } {
  const cleaned = num.trim();
  const match = cleaned.match(/^(\d+)([a-z]?)(?:\s*[.)]\s*([ivxlcdm]+)?)?$/i);
  
  if (!match) {
    const numOnly = parseInt(cleaned);
    return { main: isNaN(numOnly) ? 0 : numOnly, sub: '', subOrder: 0 };
  }
  
  const main = parseInt(match[1]);
  const sub = (match[2] || '').toLowerCase();
  const subOrder = sub ? sub.charCodeAt(0) - 96 : 0;
  
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

function groupQuestionsByMain(questions: ExamQuestion[]): QuestionGroup[] {
  const sorted = sortQuestions(questions);
  const groups: QuestionGroup[] = [];
  let currentGroup: QuestionGroup | null = null;
  
  for (const question of sorted) {
    const parsed = parseQuestionNumber(question.question_number);
    
    if (!currentGroup || currentGroup.mainNumber !== parsed.main) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        mainNumber: parsed.main,
        questions: [question],
        totalMarks: question.marks,
      };
    } else {
      currentGroup.questions.push(question);
      currentGroup.totalMarks += question.marks;
    }
  }
  
  if (currentGroup) {
    groups.push(currentGroup);
  }
  
  return groups;
}

// ============= Subject Detection =============
function getSubjectType(subject?: string): 'math' | 'science' | 'biology' | 'essay' | 'general' {
  if (!subject) return 'general';
  const s = subject.toLowerCase();
  
  if (['maths', 'mathematics', 'math', 'algebra', 'calculus', 'geometry', 'statistics'].some(k => s.includes(k))) {
    return 'math';
  }
  // Biology gets its own type - dotted lines like real OCR exams
  if (['biology', 'human biology'].some(k => s.includes(k))) {
    return 'biology';
  }
  if (['physics', 'chemistry'].some(k => s.includes(k))) {
    return 'science';
  }
  // True essay subjects get lined paper
  if (['english', 'history', 'literature', 'essay', 'geography', 'sociology', 'psychology', 'religious'].some(k => s.includes(k))) {
    return 'essay';
  }
  return 'general';
}

function getAnswerAreaType(subject?: string, marks?: number, questionType?: string): 'blank' | 'lined' | 'grid' | 'none' | 'mcq_box' | 'dotted_lines' {
  // Case-insensitive MCQ check - MCQs get a small answer checkbox
  if (questionType?.toLowerCase() === 'mcq') return 'mcq_box';
  
  const subjectType = getSubjectType(subject);
  
  switch (subjectType) {
    case 'math':
      return 'blank';
    case 'biology':
      return 'dotted_lines'; // Biology uses dotted lines like real OCR papers
    case 'essay':
      return 'lined';
    case 'science':
      return (marks && marks > 4) ? 'grid' : 'blank';
    default:
      return 'blank';
  }
}

function getAnswerBoxHeight(marks: number): number {
  if (marks <= 1) return 15; // MCQ or 1-mark - minimal
  if (marks <= 2) return ANSWER_HEIGHT_1_2_MARKS;
  if (marks <= 4) return ANSWER_HEIGHT_3_4_MARKS;
  if (marks <= 7) return ANSWER_HEIGHT_5_PLUS_MARKS;
  return ANSWER_HEIGHT_EXTENDED;
}

// ============= Calculate dotted line count based on marks =============
function getDottedLineCount(marks: number): number {
  if (marks <= 1) return 3;   // MCQ - minimal lines
  if (marks <= 2) return 5;   // Short answer
  if (marks <= 3) return 8;   // Medium 
  if (marks <= 4) return 10;  // Extended
  if (marks <= 6) return 14;  // Long answer
  return Math.min(marks * 2 + 4, 24); // 8+ marks, cap at 24 lines
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

  const questionGroups = groupQuestionsByMain(examData.questions);
  const totalMarks = examData.total_marks || questionGroups.reduce((sum, g) => sum + g.totalMarks, 0);

  // ============= Helper Functions =============
  const setColor = (color: readonly number[], type: "text" | "draw" | "fill" = "text") => {
    if (type === "text") doc.setTextColor(color[0], color[1], color[2]);
    else if (type === "draw") doc.setDrawColor(color[0], color[1], color[2]);
    else doc.setFillColor(color[0], color[1], color[2]);
  };

  const addNewPage = () => {
    doc.addPage();
    currentPage++;
    yPosition = MARGIN;
  };

  const getRemainingSpace = (): number => {
    return A4_HEIGHT - yPosition - FOOTER_HEIGHT;
  };

  const addPageNumbers = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      setColor(COLORS.muted);
      doc.setFont("helvetica", "normal");
      
      // Footer line
      setColor(COLORS.separator, "draw");
      doc.setLineWidth(0.3);
      doc.line(MARGIN, A4_HEIGHT - 15, A4_WIDTH - MARGIN, A4_HEIGHT - 15);
      
      // Page number (skip page 1 - instructions page)
      if (i > 1) {
        doc.text(`${i - 1}`, A4_WIDTH / 2, A4_HEIGHT - 10, { align: "center" });
      }
    }
  };

  // ============= Instructions Page (Page 1) =============
  const drawInstructionsPage = () => {
    // Title - Large and bold
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    const titleLines = doc.splitTextToSize(examData.title.toUpperCase(), CONTENT_WIDTH);
    titleLines.forEach((line: string, idx: number) => {
      doc.text(line, A4_WIDTH / 2, yPosition + (idx * 10), { align: "center" });
    });
    yPosition += titleLines.length * 10 + 8;

    // Subject and Board
    if (examData.subject || examData.exam_board) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      setColor(COLORS.secondary);
      const subtitleParts: string[] = [];
      if (examData.subject) subtitleParts.push(examData.subject);
      if (examData.exam_board) subtitleParts.push(examData.exam_board);
      if (examData.qualification_level) subtitleParts.push(examData.qualification_level);
      doc.text(subtitleParts.join("  ·  "), A4_WIDTH / 2, yPosition, { align: "center" });
      yPosition += 12;
    }

    // Separator
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(1);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 15;

    // Student info boxes
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    setColor(COLORS.primary);

    // Name field
    doc.text("Candidate Name:", MARGIN, yPosition);
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN + 35, yPosition + 1, A4_WIDTH / 2 - 5, yPosition + 1);

    // Centre/ID field
    setColor(COLORS.primary);
    doc.text("Candidate Number:", A4_WIDTH / 2 + 5, yPosition);
    setColor(COLORS.border, "draw");
    doc.line(A4_WIDTH / 2 + 45, yPosition + 1, A4_WIDTH - MARGIN, yPosition + 1);
    yPosition += 15;

    // Time and marks info
    const infoY = yPosition;
    setColor(COLORS.primary);
    doc.setFont("helvetica", "bold");
    
    if (examData.time_allowed) {
      doc.text(`Time: ${examData.time_allowed} minutes`, MARGIN, infoY);
    }
    doc.text(`Total Marks: ${totalMarks}`, A4_WIDTH - MARGIN, infoY, { align: "right" });
    yPosition += 20;

    // Separator
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 12;

    // Instructions section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text("Instructions", MARGIN, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const instructions = [
      "Use black ink or ball-point pen.",
      "Answer all questions.",
      "Answer the questions in the spaces provided – there may be more space than you need.",
      "Show all stages of your working clearly.",
      "Diagrams are NOT accurately drawn, unless otherwise indicated.",
      "You must NOT use a calculator for this paper.",
    ];

    instructions.forEach((instruction) => {
      doc.text("•", MARGIN + 3, yPosition);
      const lines = doc.splitTextToSize(instruction, CONTENT_WIDTH - 12);
      lines.forEach((line: string, idx: number) => {
        doc.text(line, MARGIN + 8, yPosition + (idx * LINE_HEIGHT));
      });
      yPosition += lines.length * LINE_HEIGHT + 2;
    });

    yPosition += 8;

    // Information section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text("Information", MARGIN, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const questionCount = questionGroups.length;
    const information = [
      `This paper has ${questionCount} questions.`,
      `The total mark for this paper is ${totalMarks}.`,
      "The marks for each question are shown in brackets – use this as a guide as to how much time to spend on each question.",
    ];

    information.forEach((info) => {
      doc.text("•", MARGIN + 3, yPosition);
      const lines = doc.splitTextToSize(info, CONTENT_WIDTH - 12);
      lines.forEach((line: string, idx: number) => {
        doc.text(line, MARGIN + 8, yPosition + (idx * LINE_HEIGHT));
      });
      yPosition += lines.length * LINE_HEIGHT + 2;
    });

    yPosition += 8;

    // Advice section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text("Advice", MARGIN, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const advice = [
      "Read each question carefully before you start to answer it.",
      "Try to answer every question.",
      "Check your answers if you have time at the end.",
    ];

    advice.forEach((item) => {
      doc.text("•", MARGIN + 3, yPosition);
      const lines = doc.splitTextToSize(item, CONTENT_WIDTH - 12);
      lines.forEach((line: string, idx: number) => {
        doc.text(line, MARGIN + 8, yPosition + (idx * LINE_HEIGHT));
      });
      yPosition += lines.length * LINE_HEIGHT + 2;
    });
  };

  // ============= Helper: Format marks in brackets =============
  const formatMarks = (marks: number | undefined | null): string => {
    if (!marks && marks !== 0) return '';
    return `[${marks}]`;
  };

  // ============= Draw Dotted Lines (Biology Style) =============
  const drawDottedLines = (x: number, y: number, width: number, numLines: number, marks?: number): number => {
    const lineSpacing = 8; // Space between dotted lines
    
    for (let i = 0; i < numLines; i++) {
      const lineY = y + (i * lineSpacing);
      
      // Check if we need a new page
      if (lineY > A4_HEIGHT - FOOTER_HEIGHT - 5) {
        addNewPage();
        // Continue drawing on new page
        return drawDottedLines(x, yPosition, width, numLines - i, i === numLines - 1 ? marks : undefined);
      }
      
      // Draw dotted line
      doc.setLineDashPattern([1, 2], 0);
      setColor(COLORS.border, "draw");
      doc.setLineWidth(0.3);
      doc.line(x, lineY, x + width - 15, lineY);
      
      // On the LAST line, add marks at the end
      if (i === numLines - 1 && marks) {
        doc.setLineDashPattern([], 0); // Reset to solid
        setColor(COLORS.primary);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(formatMarks(marks), x + width, lineY, { align: "right" });
      }
    }
    
    doc.setLineDashPattern([], 0); // Reset dash pattern
    return y + (numLines * lineSpacing) + 5;
  };

  // ============= Render Table Data =============
  const renderTable = (tableData: string, x: number, y: number): number => {
    if (!tableData) return y;
    
    // Try to parse as JSON first
    let rows: string[][] = [];
    try {
      const parsed = JSON.parse(tableData);
      if (Array.isArray(parsed)) {
        rows = parsed.map(row => 
          Array.isArray(row) ? row.map(cell => String(cell || '')) : [String(row || '')]
        );
      }
    } catch {
      // Parse as simple pipe-delimited or newline-delimited format
      const lines = tableData.split('\n').filter(line => line.trim());
      rows = lines.map(line => 
        line.includes('|') 
          ? line.split('|').map(cell => cell.trim()).filter(Boolean)
          : [line.trim()]
      );
    }
    
    if (rows.length === 0) return y;
    
    const maxCols = Math.max(...rows.map(row => row.length));
    const colWidth = Math.min((CONTENT_WIDTH - 10) / maxCols, 45);
    const rowHeight = 8;
    let currentY = y;
    
    // Calculate table width
    const tableWidth = colWidth * maxCols;
    const tableX = x;
    
    // Draw table
    for (let i = 0; i < rows.length; i++) {
      const isHeader = i === 0;
      
      // Check if we need a new page
      if (currentY + rowHeight > A4_HEIGHT - FOOTER_HEIGHT - 10) {
        addNewPage();
        currentY = yPosition;
      }
      
      for (let j = 0; j < maxCols; j++) {
        const cellX = tableX + (j * colWidth);
        const cellText = rows[i][j] || '';
        
        // Draw cell background for header
        if (isHeader) {
          setColor([240, 240, 245], "fill");
          doc.rect(cellX, currentY, colWidth, rowHeight, "F");
        }
        
        // Draw cell border
        setColor(COLORS.border, "draw");
        doc.setLineWidth(0.3);
        doc.rect(cellX, currentY, colWidth, rowHeight, "D");
        
        // Cell text
        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        doc.setFontSize(9);
        setColor(COLORS.primary);
        
        // Truncate text if too long
        const maxTextWidth = colWidth - 4;
        let displayText = cellText;
        while (doc.getTextWidth(displayText) > maxTextWidth && displayText.length > 0) {
          displayText = displayText.slice(0, -1);
        }
        
        doc.text(displayText, cellX + 2, currentY + 5.5);
      }
      currentY += rowHeight;
    }
    
    return currentY + 8;
  };

  // ============= Answer Box Drawing =============
  const drawAnswerBox = (x: number, y: number, width: number, height: number, areaType: 'blank' | 'lined' | 'grid' | 'none' | 'minimal' | 'mcq_box' | 'dotted_lines', marks?: number) => {
    if (areaType === 'none' || areaType === 'minimal') return y;

    // MCQ answer box - clean "Your answer [marks]" with checkbox
    if (areaType === 'mcq_box') {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      setColor(COLORS.primary);
      doc.text("Your answer", x, y + 5);
      
      // Draw answer box
      setColor(COLORS.border, "draw");
      doc.setLineWidth(0.5);
      doc.rect(x + 26, y, 12, 8, "D");
      
      // Marks in brackets after the box
      if (marks) {
        doc.setFontSize(10);
        setColor(COLORS.primary);
        doc.text(formatMarks(marks), x + 42, y + 5);
      }
      
      return y + 14;
    }

    // Dotted lines for Biology-style answers
    if (areaType === 'dotted_lines') {
      const lineCount = getDottedLineCount(marks || 3);
      return drawDottedLines(x, y, width, lineCount, marks);
    }

    // Shaded background
    setColor(COLORS.answerBoxBg, "fill");
    doc.rect(x, y, width, height, "F");

    // Border
    setColor(COLORS.answerBoxBorder, "draw");
    doc.setLineWidth(0.4);
    doc.rect(x, y, width, height, "D");

    // "Working space / Answer:" label with marks
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    setColor(COLORS.muted);
    const answerLabel = marks ? `Working space / Answer ${formatMarks(marks)}` : "Working space / Answer:";
    doc.text(answerLabel, x + 3, y + 5);

    // Draw internal lines/grid if needed
    if (areaType === 'lined') {
      const lineSpacing = 8;
      const startY = y + 12;
      const lineCount = Math.floor((height - 15) / lineSpacing);
      
      setColor([220, 220, 225], "draw");
      doc.setLineWidth(0.15);
      
      for (let i = 0; i < lineCount; i++) {
        doc.line(x + 3, startY + (i * lineSpacing), x + width - 3, startY + (i * lineSpacing));
      }
    } else if (areaType === 'grid') {
      const cellSize = 5;
      const startX = x + 3;
      const startY = y + 12;
      const gridWidth = width - 6;
      const gridHeight = height - 15;
      
      setColor([230, 230, 235], "draw");
      doc.setLineWidth(0.1);
      
      for (let i = 0; i <= Math.floor(gridWidth / cellSize); i++) {
        doc.line(startX + (i * cellSize), startY, startX + (i * cellSize), startY + gridHeight);
      }
      for (let i = 0; i <= Math.floor(gridHeight / cellSize); i++) {
        doc.line(startX, startY + (i * cellSize), startX + gridWidth, startY + (i * cellSize));
      }
    }

    return y + height;
  };

  // ============= Coordinate Grid Drawing =============
  const drawCoordinateGrid = (x: number, y: number, width: number, height: number) => {
    const cellSize = GRID_CELL_SIZE;
    
    // Background
    setColor([255, 255, 255], "fill");
    doc.rect(x, y, width, height, "F");
    
    // Light grid lines
    setColor([220, 220, 220], "draw");
    doc.setLineWidth(0.1);

    for (let i = 0; i <= Math.floor(width / cellSize); i++) {
      doc.line(x + i * cellSize, y, x + i * cellSize, y + height);
    }
    for (let i = 0; i <= Math.floor(height / cellSize); i++) {
      doc.line(x, y + i * cellSize, x + width, y + i * cellSize);
    }

    // Axes
    doc.setLineWidth(0.5);
    setColor([60, 60, 60], "draw");
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    doc.line(x, centerY, x + width, centerY);
    doc.line(centerX, y, centerX, y + height);

    // Axis labels
    doc.setFontSize(8);
    setColor(COLORS.secondary);
    doc.text("x", x + width - 3, centerY - 2);
    doc.text("y", centerX + 2, y + 4);

    doc.setLineWidth(0.2);
    
    // Border
    setColor(COLORS.answerBoxBorder, "draw");
    doc.rect(x, y, width, height, "D");
  };

  // ============= Helper: Get safe text width =============
  const getSafeTextWidth = (baseWidth: number): number => {
    // Apply consistent safety margin for all text (now using ASCII-safe notation)
    return baseWidth - 5;
  };

  // ============= Draw Question Group =============
  const drawQuestionGroup = (group: QuestionGroup) => {
    const hasSubQuestions = group.questions.length > 1 || 
      group.questions[0].sub_questions?.length || 
      parseQuestionNumber(group.questions[0].question_number).sub !== '';
    
    // Main question header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    doc.text(`${group.mainNumber}.`, MARGIN, yPosition);
    
    // Total marks for this question on the right - use [marks] format
    if (showMarks && group.totalMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      doc.text(formatMarks(group.totalMarks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
    }
    
    yPosition += 3;
    
    // Separator line
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 8;

    // Track total marks for unified answer box
    let totalSubMarks = 0;
    let hasDrawnAnyQuestions = false;

    // ============= PHASE 1: Draw ALL question text first (NO answer boxes) =============
    for (let i = 0; i < group.questions.length; i++) {
      const question = group.questions[i];
      const parsed = parseQuestionNumber(question.question_number);
      const isSubQuestion = parsed.sub !== '';
      let cleanedText = cleanLatexForPDF(question.question_text);
      
      // Check if we need a new page for text only
      const estimatedTextHeight = 30; // Rough estimate for question text
      if (i > 0 && getRemainingSpace() < estimatedTextHeight) {
        addNewPage();
        // Re-draw question number header on continuation
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        setColor(COLORS.muted);
        doc.text(`Question ${group.mainNumber} continued`, MARGIN, yPosition);
        yPosition += 10;
      }

      // Sub-question label and marks
      if (isSubQuestion) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        setColor(COLORS.primary);
        doc.text(`(${parsed.sub})`, MARGIN + 5, yPosition);
        
        if (showMarks && question.marks) {
          doc.setFont("helvetica", "normal");
          setColor(COLORS.secondary);
          doc.text(formatMarks(question.marks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
        }
        yPosition += 6;
        totalSubMarks += question.marks;
      } else {
        totalSubMarks += question.marks;
      }

      // Parse embedded MCQ options from question text if needed
      let mcqOptions = question.options;
      if (question.question_type?.toLowerCase() === 'mcq' && (!mcqOptions || mcqOptions.length === 0)) {
        const parsed = parseEmbeddedMCQOptions(cleanedText);
        if (parsed.options.length >= 3) {
          cleanedText = parsed.cleanText;
          mcqOptions = parsed.options;
        }
      }

      // Render table data if present (before question text)
      if (question.table_data) {
        const textIndent = isSubQuestion ? MARGIN + 10 : MARGIN + 8;
        yPosition = renderTable(question.table_data, textIndent, yPosition);
      }

      // Question text - with consistent font and safe width, null-safe
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.primary);
      
      const textIndent = isSubQuestion ? MARGIN + 10 : MARGIN + 8;
      const baseTextWidth = CONTENT_WIDTH - (isSubQuestion ? 20 : 15);
      const textWidth = getSafeTextWidth(baseTextWidth);
      const safeCleanedText = cleanedText || '';
      const textLines = doc.splitTextToSize(safeCleanedText, textWidth);
      
      textLines.forEach((line: string) => {
        if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 15) {
          addNewPage();
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        setColor(COLORS.primary);
        doc.text(line || '', textIndent, yPosition);
        yPosition += LINE_HEIGHT;
      });
      
      yPosition += 3;
      hasDrawnAnyQuestions = true;

      // Handle MCQ options - clean format matching real exam papers (case-insensitive check)
      if (question.question_type?.toLowerCase() === "mcq" && mcqOptions && Array.isArray(mcqOptions) && mcqOptions.length > 0) {
        yPosition += 4;
        
        for (const option of mcqOptions) {
          if (!option) continue; // Skip null/undefined options
          
          if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 10) {
            addNewPage();
          }
          
          // Option letter (A, B, C, D) - clean format without bullets
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          const optionLabel = option.label || '';
          doc.text(optionLabel, textIndent + 3, yPosition);
          
          // Option text - on same line after letter with proper spacing
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const optionText = cleanLatexForPDF(option.text || '');
          const optionWidth = getSafeTextWidth(baseTextWidth - 18);
          const optionLines = doc.splitTextToSize(optionText, optionWidth);
          
          optionLines.forEach((line: string, idx: number) => {
            doc.text(line || '', textIndent + 12, yPosition + (idx * LINE_HEIGHT));
          });
          
          yPosition += Math.max(optionLines.length, 1) * LINE_HEIGHT + 2;
        }
        
        // Draw MCQ answer box with marks after options
        yPosition += 3;
        drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 10, 0, 'mcq_box', question.marks);
        yPosition += 8;
      }
      // Handle embedded sub_questions - draw ALL text first, NO individual answer boxes
      else if (question.sub_questions && question.sub_questions.length > 0) {
        for (const sub of question.sub_questions) {
          if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 25) {
            addNewPage();
          }
          
          // Sub label - consistent font
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          setColor(COLORS.primary);
          doc.text(`(${sub.label})`, textIndent, yPosition);
          
          if (showMarks && sub.marks) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            setColor(COLORS.secondary);
            doc.text(formatMarks(sub.marks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
          }
          yPosition += 6;
          
          // Sub question text - consistent font and safe width, null-safe
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          const subText = cleanLatexForPDF(sub.text || '');
          const subTextWidth = getSafeTextWidth(baseTextWidth - 10);
          const subLines = doc.splitTextToSize(subText, subTextWidth);
          subLines.forEach((line: string) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(line || '', textIndent + 10, yPosition);
            yPosition += LINE_HEIGHT;
          });
          yPosition += 4;
          
          totalSubMarks += sub.marks;
        }
      }
      // Handle graph requirement - draw immediately as it's specific to this question
      else if (question.requires_graph && includeWorkingSpace) {
        if (getRemainingSpace() < GRID_HEIGHT + 15) {
          addNewPage();
        }
        const graphX = MARGIN + (CONTENT_WIDTH - GRID_WIDTH) / 2;
        drawCoordinateGrid(graphX, yPosition, GRID_WIDTH, GRID_HEIGHT);
        yPosition += GRID_HEIGHT + 10;
      }
      // Handle diagram requirement - draw immediately
      else if (question.requires_diagram && includeWorkingSpace) {
        const diagramHeight = 60;
        if (getRemainingSpace() < diagramHeight + 15) {
          addNewPage();
        }
        setColor(COLORS.answerBoxBg, "fill");
        doc.rect(MARGIN, yPosition, CONTENT_WIDTH, diagramHeight, "F");
        setColor(COLORS.answerBoxBorder, "draw");
        doc.setLineWidth(0.3);
        doc.rect(MARGIN, yPosition, CONTENT_WIDTH, diagramHeight, "D");
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        setColor(COLORS.muted);
        doc.text("Space for diagram", MARGIN + CONTENT_WIDTH / 2, yPosition + diagramHeight / 2, { align: "center" });
        yPosition += diagramHeight + 8;
      }
    }

    // ============= PHASE 2: Draw answer space after questions =============
    if (includeWorkingSpace && hasDrawnAnyQuestions) {
      // Skip if all questions were MCQ (case-insensitive check)
      const allMCQ = group.questions.every(q => q.question_type?.toLowerCase() === "mcq");
      // Skip if questions had graphs/diagrams (already drawn)
      const hadSpecialElements = group.questions.some(q => q.requires_graph || q.requires_diagram);
      
      if (!allMCQ && !hadSpecialElements) {
        const subjectType = getSubjectType(examData.subject);
        const areaType = answerStyle || getAnswerAreaType(examData.subject, totalSubMarks, 'written');
        
        if (areaType !== 'none' && areaType !== 'mcq_box') {
          const remainingSpace = getRemainingSpace();
          
          // MATH: Fill remaining page with answer space (one question per page style)
          if (subjectType === 'math') {
            const mathBoxHeight = Math.max(remainingSpace - 15, 60);
            if (mathBoxHeight > 30) {
              drawAnswerBox(MARGIN, yPosition, CONTENT_WIDTH, mathBoxHeight, areaType, totalSubMarks);
              yPosition += mathBoxHeight + 5;
            }
          } 
          // BIOLOGY: Use dotted lines
          else if (subjectType === 'biology') {
            yPosition = drawAnswerBox(MARGIN, yPosition, CONTENT_WIDTH, 0, 'dotted_lines', totalSubMarks);
          }
          else {
            // OTHER SUBJECTS: Compact answer boxes based on marks
            const baseHeight = getAnswerBoxHeight(totalSubMarks);
            const actualHeight = Math.min(baseHeight, remainingSpace - 15);
            
            if (actualHeight > 20) {
              drawAnswerBox(MARGIN, yPosition, CONTENT_WIDTH, actualHeight, areaType, totalSubMarks);
              yPosition += actualHeight + 5;
            }
          }
        }
      }
    }

    // Total for question X is Y marks (at the end of the group if it has multiple parts)
    if (hasSubQuestions && group.questions.length > 1) {
      if (getRemainingSpace() < 15) {
        addNewPage();
      }
      yPosition += 3;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      setColor(COLORS.secondary);
      doc.text(`(Total for Question ${group.mainNumber} = ${formatMarks(group.totalMarks)})`, A4_WIDTH / 2, yPosition, { align: "center" });
      yPosition += 8;
    }
  };

  // ============= Answer Key Section =============
  const drawAnswerKey = () => {
    addNewPage();

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text("ANSWER KEY", A4_WIDTH / 2, yPosition, { align: "center" });
    yPosition += 8;
    
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const sortedQuestions = sortQuestions(examData.questions);
    for (const question of sortedQuestions) {
      if (!question.correct_answer) continue;

      if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 20) {
        addNewPage();
      }

      doc.setFont("helvetica", "bold");
      setColor(COLORS.primary);
      doc.text(`Q${question.question_number}:`, MARGIN, yPosition);

      doc.setFont("helvetica", "normal");
      setColor(COLORS.secondary);
      const answerText = cleanLatexForPDF(question.correct_answer);
      const answerLines = doc.splitTextToSize(answerText, CONTENT_WIDTH - 25);
      answerLines.forEach((line: string, idx: number) => {
        doc.text(line, MARGIN + 18, yPosition + (idx * LINE_HEIGHT));
      });

      yPosition += Math.max(answerLines.length * LINE_HEIGHT, 6) + 6;
    }
  };

  // ============= Generate PDF =============
  
  // Page 1: Instructions only
  drawInstructionsPage();
  
  // Questions start on page 2
  addNewPage();
  
  const subjectType = getSubjectType(examData.subject);
  
  for (let i = 0; i < questionGroups.length; i++) {
    // MATH: Each question group gets its own page (one question per page)
    if (subjectType === 'math') {
      if (i > 0) {
        addNewPage();
      }
    } else {
      // OTHER SUBJECTS: Multiple questions per page (compact layout)
      if (i > 0 && getRemainingSpace() < MIN_SPACE_FOR_QUESTION) {
        addNewPage();
      }
    }
    
    drawQuestionGroup(questionGroups[i]);
    
    // Add spacing between question groups (only for non-math, since math gets new pages)
    if (subjectType !== 'math') {
      yPosition += QUESTION_SPACING;
    }
  }

  // Add answer key if requested
  if (includeAnswerKey) {
    drawAnswerKey();
  }

  // Add page numbers to all pages
  addPageNumbers();

  return doc;
}

// ============= Text Sanitization for PDF Compatibility =============
function sanitizeForPDF(text: string): string {
  let safe = text;
  
  // Remove zero-width characters that cause spacing issues in jsPDF
  safe = safe.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  
  // Remove other invisible/control characters
  safe = safe.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Replace problematic quote characters with standard ASCII
  safe = safe.replace(/[""„‟]/g, '"');
  safe = safe.replace(/[''‚‛]/g, "'");
  
  // Replace em/en dashes with regular hyphen
  safe = safe.replace(/[–—―]/g, '-');
  
  // Replace ellipsis with dots
  safe = safe.replace(/…/g, '...');
  
  // Replace non-breaking spaces with regular spaces
  safe = safe.replace(/[\u00A0\u2007\u202F]/g, ' ');
  
  // Normalize multiple spaces to single space
  safe = safe.replace(/\s+/g, ' ');
  
  return safe.trim();
}

// ============= ASCII-Safe LaTeX Conversion (No Unicode Symbols) =============
function cleanLatexForPDF(text: string): string {
  if (!text) return "";

  let cleaned = text;
  
  // Remove math mode delimiters
  cleaned = cleaned.replace(/\$\$(.*?)\$\$/g, "$1");
  cleaned = cleaned.replace(/\$(.*?)\$/g, "$1");
  
  // Fractions - use ASCII notation
  cleaned = cleaned.replace(/\\frac\{(\d)\}\{(\d+)\}/g, "$1/$2");
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
  
  // Roots - use ASCII notation
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  cleaned = cleaned.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, "$1-root($2)");
  
  // Exponents - use caret notation (ASCII-safe)
  cleaned = cleaned.replace(/\^{([^}]+)}/g, "^($1)");
  cleaned = cleaned.replace(/\^(\d+)/g, "^$1");
  cleaned = cleaned.replace(/\^([a-z])/gi, "^$1");
  
  // Subscripts - use underscore notation (ASCII-safe)
  cleaned = cleaned.replace(/_{([^}]+)}/g, "_($1)");
  cleaned = cleaned.replace(/_(\d+)/g, "_$1");
  cleaned = cleaned.replace(/_([a-z])/gi, "_$1");
  
  // Operators - use ASCII equivalents
  cleaned = cleaned.replace(/\\times/g, " x ");
  cleaned = cleaned.replace(/\\div/g, " / ");
  cleaned = cleaned.replace(/\\pm/g, "+/-");
  cleaned = cleaned.replace(/\\mp/g, "-/+");
  cleaned = cleaned.replace(/\\cdot/g, " . ");
  
  // Comparisons - use ASCII equivalents
  cleaned = cleaned.replace(/\\leq/g, "<=");
  cleaned = cleaned.replace(/\\geq/g, ">=");
  cleaned = cleaned.replace(/\\neq/g, "!=");
  cleaned = cleaned.replace(/\\approx/g, "~=");
  cleaned = cleaned.replace(/\\equiv/g, "===");
  cleaned = cleaned.replace(/\\lt/g, "<");
  cleaned = cleaned.replace(/\\gt/g, ">");
  
  // Greek letters - spell out for maximum compatibility
  cleaned = cleaned.replace(/\\pi/g, "pi");
  cleaned = cleaned.replace(/\\alpha/g, "alpha");
  cleaned = cleaned.replace(/\\beta/g, "beta");
  cleaned = cleaned.replace(/\\gamma/g, "gamma");
  cleaned = cleaned.replace(/\\delta/g, "delta");
  cleaned = cleaned.replace(/\\epsilon/g, "epsilon");
  cleaned = cleaned.replace(/\\theta/g, "theta");
  cleaned = cleaned.replace(/\\lambda/g, "lambda");
  cleaned = cleaned.replace(/\\mu/g, "mu");
  cleaned = cleaned.replace(/\\sigma/g, "sigma");
  cleaned = cleaned.replace(/\\omega/g, "omega");
  cleaned = cleaned.replace(/\\phi/g, "phi");
  cleaned = cleaned.replace(/\\psi/g, "psi");
  cleaned = cleaned.replace(/\\rho/g, "rho");
  cleaned = cleaned.replace(/\\tau/g, "tau");
  cleaned = cleaned.replace(/\\chi/g, "chi");
  cleaned = cleaned.replace(/\\Delta/g, "Delta");
  cleaned = cleaned.replace(/\\Sigma/g, "Sigma");
  cleaned = cleaned.replace(/\\Omega/g, "Omega");
  cleaned = cleaned.replace(/\\Pi/g, "Pi");
  cleaned = cleaned.replace(/\\Gamma/g, "Gamma");
  cleaned = cleaned.replace(/\\Theta/g, "Theta");
  cleaned = cleaned.replace(/\\Lambda/g, "Lambda");
  
  // Math symbols - use ASCII equivalents
  cleaned = cleaned.replace(/\\sum/g, "Sum");
  cleaned = cleaned.replace(/\\prod/g, "Product");
  cleaned = cleaned.replace(/\\infty/g, "infinity");
  cleaned = cleaned.replace(/\\partial/g, "d");
  cleaned = cleaned.replace(/\\nabla/g, "nabla");
  cleaned = cleaned.replace(/\\int/g, "integral");
  cleaned = cleaned.replace(/\\forall/g, "for all");
  cleaned = cleaned.replace(/\\exists/g, "exists");
  cleaned = cleaned.replace(/\\in/g, " in ");
  cleaned = cleaned.replace(/\\notin/g, " not in ");
  cleaned = cleaned.replace(/\\subset/g, " subset ");
  cleaned = cleaned.replace(/\\supset/g, " superset ");
  cleaned = cleaned.replace(/\\cup/g, " union ");
  cleaned = cleaned.replace(/\\cap/g, " intersect ");
  cleaned = cleaned.replace(/\\emptyset/g, "empty set");
  cleaned = cleaned.replace(/\\angle/g, "angle ");
  cleaned = cleaned.replace(/\\triangle/g, "triangle ");
  cleaned = cleaned.replace(/\\perp/g, " perpendicular ");
  cleaned = cleaned.replace(/\\parallel/g, " parallel ");
  cleaned = cleaned.replace(/\\rightarrow/g, " -> ");
  cleaned = cleaned.replace(/\\leftarrow/g, " <- ");
  cleaned = cleaned.replace(/\\Rightarrow/g, " => ");
  cleaned = cleaned.replace(/\\Leftarrow/g, " <= ");
  cleaned = cleaned.replace(/\\leftrightarrow/g, " <-> ");
  cleaned = cleaned.replace(/\\therefore/g, "therefore");
  cleaned = cleaned.replace(/\\because/g, "because");
  
  // Functions
  cleaned = cleaned.replace(/\\sin/g, "sin");
  cleaned = cleaned.replace(/\\cos/g, "cos");
  cleaned = cleaned.replace(/\\tan/g, "tan");
  cleaned = cleaned.replace(/\\log/g, "log");
  cleaned = cleaned.replace(/\\ln/g, "ln");
  cleaned = cleaned.replace(/\\exp/g, "exp");
  cleaned = cleaned.replace(/\\lim/g, "lim");
  
  // Text in math mode
  cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\textit\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\mathrm\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  
  // Spacing
  cleaned = cleaned.replace(/\\quad/g, "  ");
  cleaned = cleaned.replace(/\\qquad/g, "    ");
  cleaned = cleaned.replace(/\\,/g, " ");
  cleaned = cleaned.replace(/\\;/g, " ");
  cleaned = cleaned.replace(/\\!/g, "");
  cleaned = cleaned.replace(/\\ /g, " ");
  
  // Remove remaining LaTeX commands
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, "");
  
  // Clean up curly braces
  cleaned = cleaned.replace(/[{}]/g, "");
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ");
  
  // Final sanitization for PDF compatibility
  cleaned = sanitizeForPDF(cleaned);
  
  return cleaned.trim();
}

// ============= Preview PDF Helper =============
export async function generateExamPDFPreview(
  examData: ExamData,
  options: PDFOptions = {}
): Promise<string> {
  const doc = await generateExamPDF(examData, options);
  return doc.output('datauristring');
}

// ============= Download Helper =============
export async function downloadExamPDF(
  examData: ExamData,
  filename: string,
  options: PDFOptions = {}
): Promise<void> {
  const doc = await generateExamPDF(examData, options);
  doc.save(filename);
}

// ============= Legacy Export Aliases =============
export const downloadPDF = downloadExamPDF;

export async function openPDFInNewTab(
  examData: ExamData,
  options: PDFOptions = {}
): Promise<void> {
  const doc = await generateExamPDF(examData, options);
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}
