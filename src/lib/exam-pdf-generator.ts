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

// Spacing constants
const QUESTION_SPACING = 15;
const MIN_SPACE_FOR_QUESTION = 60;

// Biology-specific spacing
const BIOLOGY_LINE_SPACING = 8;     // Space between dotted answer lines
const BIOLOGY_QUESTION_GAP = 12;    // Gap after answer area before next sub-question
const BIOLOGY_SECTION_GAP = 18;     // Gap between main question groups

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
  tableHeader: [235, 235, 240] as const,
};

// ============= Extract Embedded Table from Question Text =============
function extractEmbeddedTable(questionText: string): { 
  cleanText: string; 
  tableData: string | null;
  tableCaption: string | null;
} {
  if (!questionText) return { cleanText: '', tableData: null, tableCaption: null };
  
  // First, try to detect a table caption (e.g., "Table 1: Experimental Results")
  let tableCaption: string | null = null;
  const captionPattern = /(?:^|\n|\s)(Table\s*\d*[:.]\s*[^\n|]+?)(?=\s*\||\s*$|\n)/i;
  const captionMatch = questionText.match(captionPattern);
  if (captionMatch) {
    tableCaption = captionMatch[1].trim();
  }
  
  // Enhanced table detection - look for lines containing pipe characters
  // This handles both standard markdown tables and tables with alignment markers
  const lines = questionText.split('\n');
  let tableStartIdx = -1;
  let tableEndIdx = -1;
  let pipeLineCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if line contains pipe characters (table row indicator)
    // Also handle separator rows that might start with : instead of |
    const hasPipes = line.includes('|') && (line.split('|').length >= 3);
    const isSeparatorRow = /^[|:\s-]+$/.test(line) && line.includes('-');
    
    if (hasPipes || isSeparatorRow) {
      if (tableStartIdx === -1) tableStartIdx = i;
      tableEndIdx = i;
      if (hasPipes && !isSeparatorRow) pipeLineCount++;
    } else if (tableStartIdx !== -1 && tableEndIdx !== -1) {
      // We've exited the table
      break;
    }
  }
  
  // Need at least 2 data rows (header + one content row) to be considered a table
  if (pipeLineCount < 2) {
    // Fallback: check for inline tables with || as row separator
    if (questionText.includes('||') && questionText.includes('|')) {
      const inlineTableMatch = questionText.match(/(\|[^|]+(?:\|[^|]+)+\|\|?(?:[^|]+\|)+)/);
      if (inlineTableMatch) {
        const tableStart = questionText.indexOf(inlineTableMatch[0]);
        const tableEnd = tableStart + inlineTableMatch[0].length;
        const tableData = inlineTableMatch[0];
        let cleanText = (
          questionText.substring(0, tableStart).trim() + ' ' +
          questionText.substring(tableEnd).trim()
        ).trim();
        
        if (tableCaption) {
          cleanText = cleanText.replace(tableCaption, '').trim();
        }
        
        const formattedTable = tableData.replace(/\|\|/g, '\n');
        return { cleanText, tableData: formattedTable, tableCaption };
      }
    }
    return { cleanText: questionText, tableData: null, tableCaption: null };
  }
  
  // Extract the table portion
  const tableLines = lines.slice(tableStartIdx, tableEndIdx + 1);
  const tableData = tableLines.join('\n');
  
  // Remove table from original text
  const beforeTable = lines.slice(0, tableStartIdx).join('\n').trim();
  const afterTable = lines.slice(tableEndIdx + 1).join('\n').trim();
  let cleanText = (beforeTable + ' ' + afterTable).trim();
  
  // Remove caption from clean text if found
  if (tableCaption) {
    cleanText = cleanText.replace(tableCaption, '').trim();
  }
  
  return { cleanText, tableData, tableCaption };
}

// ============= Parse Embedded MCQ Options from Question Text =============
function parseEmbeddedMCQOptions(questionText: string): { 
  cleanText: string; 
  options: { label: string; text: string }[] 
} {
  if (!questionText) return { cleanText: '', options: [] };
  
  // Find where options start - match A) / A. / A: after whitespace, punctuation, or start.
  // Handles inline options like "...? A) ... B) ..." and multi-line formats.
  const optionStartPattern = /(?:^|[\s?.!])\s*([A-E])\s*[\).:]\s*/i;
  const firstMatch = questionText.match(optionStartPattern);
  
  if (!firstMatch) {
    return { cleanText: questionText, options: [] };
  }
  
  // Find the actual position of the first option letter
  const matchIndex = questionText.indexOf(firstMatch[0]);
  const firstOptionIndex = matchIndex + firstMatch[0].toUpperCase().indexOf(firstMatch[1].toUpperCase());
  
  // Get clean question stem (everything before first option)
  const cleanText = questionText.substring(0, firstOptionIndex).trim();
  
  // Extract the options portion
  const optionsPortion = questionText.substring(firstOptionIndex).trim();
  
  // Split options reliably by detecting new option labels at the beginning of the remaining string.
  // We intentionally avoid excluding letters in the option text (previous regex did that and broke).
  const parts: string[] = [];
  let currentPart = '';
  let i = 0;
  
  while (i < optionsPortion.length) {
    const remaining = optionsPortion.substring(i);
    const newOptionMatch = remaining.match(/^([A-E])\s*[\).:]\s*/i);
    
    if (newOptionMatch && (i === 0 || /\s/.test(optionsPortion[i - 1]))) {
      if (currentPart.trim()) parts.push(currentPart.trim());
      currentPart = '';
    }
    
    currentPart += optionsPortion[i];
    i++;
  }
  
  if (currentPart.trim()) parts.push(currentPart.trim());
  
  const options: { label: string; text: string }[] = [];
  for (const part of parts) {
    const match = part.match(/^([A-E])\s*[\).:]\s*(.+)$/is);
    if (match) {
      options.push({ label: match[1].toUpperCase(), text: match[2].trim() });
    }
  }
  
  if (options.length >= 3) {
    return { cleanText, options };
  }
  
  return { cleanText: questionText, options: [] };
}

type NormalizedMCQOption = { label: string; text: string };

function normalizeMCQOptions(rawOptions: unknown): NormalizedMCQOption[] {
  if (!rawOptions) return [];

  const labels = ["A", "B", "C", "D", "E"];

  if (Array.isArray(rawOptions)) {
    // Common case from DB: string[] (no labels)
    if (rawOptions.every((o) => typeof o === "string")) {
      return (rawOptions as string[])
        .map((text, idx) => ({
          label: labels[idx] ?? String.fromCharCode(65 + idx),
          text: String(text ?? "").trim(),
        }))
        .filter((o) => o.text.length > 0);
    }

    // Already structured
    if (rawOptions.every((o) => typeof o === "object" && o !== null)) {
      return (rawOptions as any[])
        .map((o) => ({
          label: String(o?.label ?? o?.option ?? "").trim(),
          text: String(o?.text ?? o?.value ?? o?.statement ?? "").trim(),
        }))
        .filter((o) => o.label.length > 0 && o.text.length > 0);
    }

    return [];
  }

  // Object like {A: "...", B: "..."}
  if (typeof rawOptions === "object") {
    const obj = rawOptions as Record<string, unknown>;
    const out: NormalizedMCQOption[] = [];

    for (const label of labels) {
      const v = obj[label];
      if (typeof v === "string" && v.trim()) out.push({ label, text: v.trim() });
    }

    return out;
  }

  return [];
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
      "Answer the questions in the spaces provided - there may be more space than you need.",
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
      "The marks for each question are shown in brackets - use this as a guide as to how much time to spend on each question.",
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
    const lineSpacing = BIOLOGY_LINE_SPACING;
    
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

  // ============= Enhanced Table Rendering with Caption Support =============
  const renderTable = (tableData: string, x: number, y: number, caption?: string | null): number => {
    if (!tableData) return y;
    
    // Add pre-table spacing for visual separation
    let currentY = y + 10;
    
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
      let lines = tableData.split('\n').filter(line => line.trim());
      
      // If only one line but has multiple || patterns, split into rows
      if (lines.length === 1 && tableData.includes('||')) {
        const parts = tableData.split('||').map(p => p.trim());
        rows = parts.map(part => {
          const cells = part.split('|');
          // Remove empty strings from start/end only (from leading/trailing pipes)
          if (cells.length > 0 && cells[0] === '') cells.shift();
          if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
          return cells.map(cell => cell.trim());
        });
      } else {
        rows = lines.map(line => {
          if (line.includes('|')) {
            const cells = line.split('|');
            // Remove empty strings from start/end only (preserve empty cells in middle)
            if (cells.length > 0 && cells[0].trim() === '') cells.shift();
            if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
            return cells.map(cell => cell.trim());
          }
          return [line.trim()];
        });
      }
      
      // Filter out separator rows like |---|---| or rows with only dashes/colons
      rows = rows.filter(row => 
        row.length > 0 && !row.every(cell => /^[-:]*$/.test(cell))
      );
    }
    
    if (rows.length === 0) return y;
    
    // ============= HEADER SHORTENING ALIASES =============
    const HEADER_ALIASES: Record<string, string> = {
      "desired concentration of diluted sample": "Conc (mol/dm³)",
      "volume of stock solution required": "Stock Vol (cm³)",
      "volume of distilled water required": "Water Vol (cm³)",
      "section of quadrat": "Quadrat",
      "beetles count": "Count",
      "beetles counted": "Count",
      "number of beetles": "Count",
      "concentration": "Conc",
      "temperature": "Temp (°C)",
      "time / s": "Time (s)",
      "time (s)": "Time (s)",
      "velocity / m s⁻¹": "Vel (m/s)",
      "velocity": "Vel (m/s)",
      "distance / m": "Dist (m)",
      "mass / g": "Mass (g)",
      "volume / cm³": "Vol (cm³)",
      "volume / cm3": "Vol (cm³)",
      "titre / cm³": "Titre (cm³)",
      "titre / cm3": "Titre (cm³)",
    };
    
    const shortenHeader = (header: string): string => {
      const lower = header.toLowerCase().trim();
      for (const [long, short] of Object.entries(HEADER_ALIASES)) {
        if (lower.includes(long)) return short;
      }
      // If still too long (>16 chars), truncate intelligently
      if (header.length > 16) {
        // Try to find a natural break point
        const words = header.split(/\s+/);
        if (words.length > 2) {
          return words.slice(0, 2).join(' ');
        }
        return header.substring(0, 14) + '…';
      }
      return header;
    };
    
    // ============= CLEAN LaTeX FROM CELLS =============
    const cleanCellContent = (cellText: string): string => {
      // Clean LaTeX math delimiters and notation for PDF display
      let cleaned = cellText;
      
      // Remove $ delimiters but keep content
      cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');
      
      // Clean LaTeX spacing commands
      cleaned = cleaned.replace(/\\,/g, ' ');
      cleaned = cleaned.replace(/\\;/g, ' ');
      cleaned = cleaned.replace(/\\!/g, '');
      cleaned = cleaned.replace(/\\quad/g, '  ');
      cleaned = cleaned.replace(/\\qquad/g, '   ');
      
      // Convert LaTeX fractions to plain text
      cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
      
      // Convert superscripts: ^{-3} -> ⁻³, ^{2} -> ², etc.
      cleaned = cleaned.replace(/\^{?\-?(\d+)}?/g, (_, num) => {
        const superscripts: Record<string, string> = {
          '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
          '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'
        };
        return num.split('').map((c: string) => superscripts[c] || c).join('');
      });
      
      // Convert subscripts: _{2} -> ₂
      cleaned = cleaned.replace(/_{?\-?(\d+)}?/g, (_, num) => {
        const subscripts: Record<string, string> = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
          '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return num.split('').map((c: string) => subscripts[c] || c).join('');
      });
      
      // Clean remaining backslash commands
      cleaned = cleaned.replace(/\\[a-zA-Z]+/g, '');
      cleaned = cleaned.replace(/[{}]/g, '');
      
      // Normalize whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    };
    
    // Apply header shortening and content cleaning to all cells
    rows = rows.map((row, rowIndex) => 
      row.map(cell => {
        const cleaned = cleanCellContent(cell);
        // Apply header shortening only to first row
        return rowIndex === 0 ? shortenHeader(cleaned) : cleaned;
      })
    );
    
    // ============= TABLE ROTATION FOR NARROW/TALL TABLES =============
    const maxCols = Math.max(...rows.map(row => row.length));
    const shouldRotate = maxCols <= 3 && rows.length > 5;
    
    if (shouldRotate && rows.length > 1) {
      // Transpose the table (swap rows and columns)
      const transposed: string[][] = [];
      for (let j = 0; j < maxCols; j++) {
        const newRow: string[] = [];
        for (let i = 0; i < rows.length; i++) {
          newRow.push(rows[i][j] || '');
        }
        transposed.push(newRow);
      }
      rows = transposed;
    }
    
    // Recalculate maxCols after potential rotation
    const finalMaxCols = Math.max(...rows.map(row => row.length));
    
    const cellPadding = 4; // Increased padding for better readability
    const rowHeight = 12; // Taller rows for better visibility
    
    // Calculate dynamic column widths based on content
    const colWidths: number[] = [];
    const maxTableWidth = CONTENT_WIDTH - 20;
    const minColWidth = 25;
    
    for (let j = 0; j < finalMaxCols; j++) {
      let maxWidth = minColWidth;
      for (const row of rows) {
        const cellText = row[j] || '';
        doc.setFontSize(9);
        const textWidth = doc.getTextWidth(cellText) + cellPadding * 2;
        maxWidth = Math.max(maxWidth, textWidth);
      }
      colWidths.push(maxWidth);
    }
    
    // Scale columns if they exceed max width
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    if (totalWidth > maxTableWidth) {
      const scale = maxTableWidth / totalWidth;
      for (let j = 0; j < colWidths.length; j++) {
        colWidths[j] *= scale;
      }
    }
    
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableX = x;
    const totalTableHeight = (rows.length * rowHeight) + (caption ? 18 : 0) + 24; // Include caption and spacing
    
    // Page break prevention: if table won't fit, start new page
    if (currentY + totalTableHeight > A4_HEIGHT - FOOTER_HEIGHT - 20) {
      addNewPage();
      currentY = yPosition + 10;
    }
    
    // Render table caption if present
    if (caption) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor(COLORS.primary);
      doc.text(caption, tableX, currentY);
      currentY += LINE_HEIGHT + 4;
    }
    
    // Function to draw a single row with enhanced styling
    const drawRow = (rowData: string[], rowY: number, isHeader: boolean): number => {
      // Check page break BEFORE drawing row
      if (rowY + rowHeight > A4_HEIGHT - FOOTER_HEIGHT - 10) {
        addNewPage();
        rowY = yPosition + 5;
        
        // Re-draw header on new page if this isn't the header
        if (!isHeader && rows.length > 0) {
          drawRow(rows[0], rowY, true);
          rowY += rowHeight;
        }
      }
      
      let cellX = tableX;
      for (let j = 0; j < finalMaxCols; j++) {
        const cellText = rowData[j] || '';
        const colWidth = colWidths[j];
        
        // Draw cell background for header with shaded color
        if (isHeader) {
          setColor([230, 235, 245], "fill"); // Light blue-gray header
          doc.rect(cellX, rowY, colWidth, rowHeight, "F");
        } else {
          // Alternate row coloring for better readability
          setColor([255, 255, 255], "fill");
          doc.rect(cellX, rowY, colWidth, rowHeight, "F");
        }
        
        // Draw cell border with clear grid lines
        setColor(COLORS.border, "draw");
        doc.setLineWidth(isHeader ? 0.5 : 0.3); // Thicker border for header
        doc.rect(cellX, rowY, colWidth, rowHeight, "D");
        
        // Cell text with proper alignment
        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        doc.setFontSize(9);
        setColor(COLORS.primary);
        
        // Text already cleaned and shortened - just ensure it fits
        const maxTextWidth = colWidth - cellPadding * 2;
        let displayText = cellText;
        if (doc.getTextWidth(displayText) > maxTextWidth) {
          // Use ellipsis for overflow
          while (doc.getTextWidth(displayText + '…') > maxTextWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText = displayText + '…';
        }
        
        // Center text vertically in cell
        doc.text(displayText, cellX + cellPadding, rowY + rowHeight / 2 + 3);
        cellX += colWidth;
      }
      
      return rowY + rowHeight;
    };
    
    const tableStartY = currentY;
    
    // Draw all rows
    for (let i = 0; i < rows.length; i++) {
      const isHeader = i === 0;
      currentY = drawRow(rows[i], currentY, isHeader);
    }
    
    // Draw outer border (thicker) for the entire table
    doc.setLineWidth(0.6);
    setColor(COLORS.border, "draw");
    const tableHeight = currentY - tableStartY;
    doc.rect(tableX, tableStartY, tableWidth, tableHeight, "D");
    
    // Add post-table spacing for visual separation
    return currentY + 12;
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
    return baseWidth - 5;
  };

  // ============= Biology-Specific Question Rendering =============
  // Renders each sub-question IMMEDIATELY followed by its answer lines
  const drawBiologyQuestionGroup = (group: QuestionGroup) => {
    // Main question header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    doc.text(`${group.mainNumber}.`, MARGIN, yPosition);
    
    // Total marks for this question on the right
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

    // Process each question in the group
    for (let i = 0; i < group.questions.length; i++) {
      const question = group.questions[i];
      const parsed = parseQuestionNumber(question.question_number);
      const isSubQuestion = parsed.sub !== '';
      
      // Extract embedded tables FIRST from raw text (before LaTeX cleaning destroys newlines)
      const tableExtract = extractEmbeddedTable(question.question_text);
      const embeddedTableData = tableExtract.tableData;
      const embeddedTableCaption = tableExtract.tableCaption;
      
      // Now apply LaTeX cleaning to the text with tables removed
      let cleanedText = cleanLatexForPDF(tableExtract.cleanText);
      
      // Check if we need a new page
      const estimatedHeight = 50; // Estimate for text + answer lines
      if (getRemainingSpace() < estimatedHeight) {
        addNewPage();
        // Re-draw question number header on continuation
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        setColor(COLORS.muted);
        doc.text(`Question ${group.mainNumber} continued`, MARGIN, yPosition);
        yPosition += 10;
      }

      // Sub-question label (a), (b), etc.
      const textIndent = isSubQuestion ? MARGIN + 10 : MARGIN + 8;
      const baseTextWidth = CONTENT_WIDTH - (isSubQuestion ? 20 : 15);
      
      if (isSubQuestion) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        setColor(COLORS.primary);
        doc.text(`(${parsed.sub})`, MARGIN + 5, yPosition);
        yPosition += 6;
      }

      // ALWAYS attempt MCQ parsing regardless of question_type - if options are detected, use them
      let mcqOptions = normalizeMCQOptions(question.options);
      const parsedMCQ = parseEmbeddedMCQOptions(cleanedText);
      if (parsedMCQ.options.length >= 3) {
        cleanedText = parsedMCQ.cleanText;
        mcqOptions = parsedMCQ.options;
      }

      const isMCQ = mcqOptions.length >= 3;

      // Render embedded table (extracted from question text) with caption
      if (embeddedTableData) {
        yPosition = renderTable(embeddedTableData, textIndent, yPosition, embeddedTableCaption);
      }

      // Render table data if present in DB field
      if (question.table_data) {
        yPosition = renderTable(question.table_data, textIndent, yPosition);
      }

      // Question text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.primary);
      
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
      
      yPosition += 4;

      // Handle MCQ options - display on separate lines
      if (isMCQ) {
        yPosition += 2;

        for (const option of mcqOptions) {
          if (!option) continue;

          if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 10) {
            addNewPage();
          }

          const optionLetter = String((option as any).label ?? "")
            .trim()
            .replace(/[^A-E]/gi, "")
            .toUpperCase();
          const optionTextRaw = String((option as any).text ?? "");

          if (!optionLetter || !optionTextRaw.trim()) continue;

          // Option label (A) with bracket style "A)"
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          doc.text(`${optionLetter})`, textIndent + 5, yPosition);

          // Option text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const optionText = cleanLatexForPDF(optionTextRaw);
          const optionWidth = getSafeTextWidth(baseTextWidth - 20);
          const optionLines = doc.splitTextToSize(optionText, optionWidth);

          optionLines.forEach((line: string, idx: number) => {
            doc.text(line || "", textIndent + 15, yPosition + (idx * LINE_HEIGHT));
          });

          yPosition += Math.max(optionLines.length, 1) * LINE_HEIGHT + 4; // more spacing between options
        }

        // MCQ answer box IMMEDIATELY after options
        yPosition += 2;
        drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 10, 0, "mcq_box", question.marks);
        yPosition += 8;
      }
      // Handle embedded sub_questions - BIOLOGY STYLE: each gets answer lines immediately
      else if (question.sub_questions && question.sub_questions.length > 0) {
        for (const sub of question.sub_questions) {
          if (getRemainingSpace() < 40) {
            addNewPage();
          }
          
          // Sub label
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          setColor(COLORS.primary);
          doc.text(`(${sub.label})`, textIndent, yPosition);
          yPosition += 6;
          
          // Sub question text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          const subText = cleanLatexForPDF(sub.text || '');
          const subTextWidth = getSafeTextWidth(baseTextWidth - 10);
          const subLines = doc.splitTextToSize(subText, subTextWidth);
          subLines.forEach((line: string) => {
            if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 15) {
              addNewPage();
            }
            doc.text(line || '', textIndent + 10, yPosition);
            yPosition += LINE_HEIGHT;
          });
          yPosition += 4;
          
          // IMMEDIATELY draw answer lines for this sub-question
          if (includeWorkingSpace) {
            const lineCount = getDottedLineCount(sub.marks);
            yPosition = drawDottedLines(textIndent, yPosition, CONTENT_WIDTH - 15, lineCount, sub.marks);
            yPosition += BIOLOGY_QUESTION_GAP;
          }
        }
      }
      // Regular question - draw answer lines IMMEDIATELY after question text
      else if (includeWorkingSpace && question.question_type?.toLowerCase() !== 'mcq') {
        // Handle graph requirement
        if (question.requires_graph) {
          if (getRemainingSpace() < GRID_HEIGHT + 15) {
            addNewPage();
          }
          const graphX = MARGIN + (CONTENT_WIDTH - GRID_WIDTH) / 2;
          drawCoordinateGrid(graphX, yPosition, GRID_WIDTH, GRID_HEIGHT);
          yPosition += GRID_HEIGHT + 10;
        }
        // Handle diagram requirement
        else if (question.requires_diagram) {
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
        // Standard dotted lines answer area
        else {
          const lineCount = getDottedLineCount(question.marks);
          yPosition = drawDottedLines(textIndent, yPosition, CONTENT_WIDTH - 15, lineCount, question.marks);
        }
        
        yPosition += BIOLOGY_QUESTION_GAP;
      }
    }

    // Total for question X is Y marks (at the end of multi-part questions)
    if (group.questions.length > 1) {
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

  // ============= Draw Question Group (Math/Other subjects) =============
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
      
      // Extract embedded tables FIRST from raw text (before LaTeX cleaning destroys newlines)
      const tableExtract = extractEmbeddedTable(question.question_text);
      const embeddedTableData = tableExtract.tableData;
      const embeddedTableCaption = tableExtract.tableCaption;
      
      // Now apply LaTeX cleaning to the text with tables removed
      let cleanedText = cleanLatexForPDF(tableExtract.cleanText);
      
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

      // ALWAYS attempt MCQ parsing regardless of question_type - if options are detected, use them
      let mcqOptions = normalizeMCQOptions(question.options);
      const parsedMCQ = parseEmbeddedMCQOptions(cleanedText);
      if (parsedMCQ.options.length >= 3) {
        cleanedText = parsedMCQ.cleanText;
        mcqOptions = parsedMCQ.options;
      }

      const isMCQ = mcqOptions.length >= 3;

      const textIndent = isSubQuestion ? MARGIN + 10 : MARGIN + 8;
      const baseTextWidth = CONTENT_WIDTH - (isSubQuestion ? 20 : 15);

      // Render embedded table (extracted from question text) with caption
      if (embeddedTableData) {
        yPosition = renderTable(embeddedTableData, textIndent, yPosition, embeddedTableCaption);
      }

      // Render table data if present in DB field
      if (question.table_data) {
        yPosition = renderTable(question.table_data, textIndent, yPosition);
      }

      // Question text - with consistent font and safe width, null-safe
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.primary);
      
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

      // Handle MCQ options - clean format matching real exam papers
      if (isMCQ) {
        yPosition += 4;

        for (const option of mcqOptions) {
          if (!option) continue;

          if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 10) {
            addNewPage();
          }

          const optionLetter = String((option as any).label ?? "")
            .trim()
            .replace(/[^A-E]/gi, "")
            .toUpperCase();
          const optionTextRaw = String((option as any).text ?? "");

          if (!optionLetter || !optionTextRaw.trim()) continue;

          // Option label
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          doc.text(`${optionLetter})`, textIndent + 3, yPosition);

          // Option text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const optionText = cleanLatexForPDF(optionTextRaw);
          const optionWidth = getSafeTextWidth(baseTextWidth - 18);
          const optionLines = doc.splitTextToSize(optionText, optionWidth);

          optionLines.forEach((line: string, idx: number) => {
            doc.text(line || "", textIndent + 12, yPosition + (idx * LINE_HEIGHT));
          });

          yPosition += Math.max(optionLines.length, 1) * LINE_HEIGHT + 4;
        }

        // Draw MCQ answer box with marks after options
        yPosition += 2;
        drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 10, 0, "mcq_box", question.marks);
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
          // BIOLOGY: Use dotted lines (shouldn't get here with new logic, but fallback)
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

      if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 15) {
        addNewPage();
      }

      setColor(COLORS.primary);
      doc.setFont("helvetica", "bold");
      doc.text(`${question.question_number}.`, MARGIN, yPosition);
      
      doc.setFont("helvetica", "normal");
      const answerText = cleanLatexForPDF(question.correct_answer);
      const answerLines = doc.splitTextToSize(answerText, CONTENT_WIDTH - 20);
      answerLines.forEach((line: string, idx: number) => {
        doc.text(line || '', MARGIN + 15, yPosition + (idx * LINE_HEIGHT));
      });
      
      yPosition += Math.max(answerLines.length, 1) * LINE_HEIGHT + 4;
    }
  };

  // ============= Generate PDF =============
  
  // Instructions page (Page 1)
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
      drawQuestionGroup(questionGroups[i]);
    } 
    // BIOLOGY: Use Biology-specific rendering with immediate answer lines
    else if (subjectType === 'biology') {
      if (i > 0 && getRemainingSpace() < MIN_SPACE_FOR_QUESTION) {
        addNewPage();
      }
      drawBiologyQuestionGroup(questionGroups[i]);
      yPosition += BIOLOGY_SECTION_GAP;
    }
    else {
      // OTHER SUBJECTS: Multiple questions per page (compact layout)
      if (i > 0 && getRemainingSpace() < MIN_SPACE_FOR_QUESTION) {
        addNewPage();
      }
      drawQuestionGroup(questionGroups[i]);
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
  
  // Remove HTML entities
  safe = safe.replace(/&[A-Za-z0-9#]+;/g, (entity) => {
    const entityMap: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
      '&#x27;': "'",
      '&mdash;': '-',
      '&ndash;': '-',
      '&hellip;': '...',
      '&lsquo;': "'",
      '&rsquo;': "'",
      '&ldquo;': '"',
      '&rdquo;': '"',
      '&deg;': ' degrees',
      '&times;': 'x',
      '&divide;': '/',
      '&plusmn;': '+/-',
      '&frac12;': '1/2',
      '&frac14;': '1/4',
      '&frac34;': '3/4',
    };
    return entityMap[entity] || '';
  });
  
  // Map common Unicode characters to ASCII equivalents
  const unicodeMap: Record<string, string> = {
    'Ø': 'O', 'ø': 'o',
    'Ü': 'U', 'ü': 'u',
    'Ö': 'O', 'ö': 'o',
    'Ä': 'A', 'ä': 'a',
    '×': 'x', '÷': '/',
    '±': '+/-', '°': ' degrees',
    '²': '^2', '³': '^3',
    '¹': '^1', '⁴': '^4', '⁵': '^5',
    '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3',
    '→': '->', '←': '<-', '↔': '<->',
    '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~=',
    '∞': 'infinity', '√': 'sqrt',
    'µ': 'mu', 'π': 'pi', 'Σ': 'Sum', 'Δ': 'Delta',
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'θ': 'theta',
    '•': '*', '·': '.',
    '′': "'", '″': '"',
    '…': '...',
    '\u00A0': ' ', // Non-breaking space
  };
  
  safe = safe.replace(/[^\x00-\x7F]/g, (char) => {
    return unicodeMap[char] || '';
  });
  
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

// ============= Download Helper (accepts jsPDF doc directly) =============
export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

// ============= Open in New Tab (accepts jsPDF doc directly) =============
export function openPDFInNewTab(doc: jsPDF): void {
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

// ============= Alternative: Download from ExamData =============
export async function downloadExamPDF(
  examData: ExamData,
  filename: string,
  options: PDFOptions = {}
): Promise<void> {
  const doc = await generateExamPDF(examData, options);
  doc.save(filename);
}
