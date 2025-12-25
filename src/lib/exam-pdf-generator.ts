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

// ============= Math Text Segment Types =============
interface TextSegment {
  type: 'normal' | 'superscript' | 'subscript';
  text: string;
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

// Baseline shift constants for superscript/subscript rendering
const SUPERSCRIPT_SCALE = 0.7;  // 70% of base font size
const SUBSCRIPT_SCALE = 0.7;    // 70% of base font size
const SUPERSCRIPT_RISE = 2.0;   // mm above baseline
const SUBSCRIPT_DROP = 1.2;     // mm below baseline

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

// ============= Parse Math Text into Segments =============
// Parses text containing ^ and _ notation into segments for baseline-shift rendering
function parseMathSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  let currentNormal = '';
  
  while (i < text.length) {
    const char = text[i];
    
    // Check for superscript (^)
    if (char === '^' && i + 1 < text.length) {
      // Save any accumulated normal text
      if (currentNormal) {
        segments.push({ type: 'normal', text: currentNormal });
        currentNormal = '';
      }
      
      i++; // Move past ^
      let superContent = '';
      
      // Check for braced content: ^{...}
      if (text[i] === '{') {
        i++; // Move past {
        let braceDepth = 1;
        while (i < text.length && braceDepth > 0) {
          if (text[i] === '{') braceDepth++;
          else if (text[i] === '}') braceDepth--;
          if (braceDepth > 0) superContent += text[i];
          i++;
        }
      }
      // Check for parenthesized content: ^(...)
      else if (text[i] === '(') {
        i++; // Move past (
        let parenDepth = 1;
        while (i < text.length && parenDepth > 0) {
          if (text[i] === '(') parenDepth++;
          else if (text[i] === ')') parenDepth--;
          if (parenDepth > 0) superContent += text[i];
          i++;
        }
      }
      // Single character or sequence of digits/letters/minus
      else {
        // Capture contiguous alphanumeric and minus signs
        while (i < text.length && /[0-9a-zA-Z\-+]/.test(text[i])) {
          superContent += text[i];
          i++;
        }
      }
      
      if (superContent) {
        segments.push({ type: 'superscript', text: superContent });
      }
      continue;
    }
    
    // Check for subscript (_) - but not in BLANK patterns
    if (char === '_' && i + 1 < text.length) {
      // Check if this is part of [ BLANK ] pattern
      const before = text.substring(Math.max(0, i - 10), i);
      const after = text.substring(i, Math.min(text.length, i + 10));
      if (before.includes('[') && after.includes('BLANK')) {
        currentNormal += char;
        i++;
        continue;
      }
      
      // Save any accumulated normal text
      if (currentNormal) {
        segments.push({ type: 'normal', text: currentNormal });
        currentNormal = '';
      }
      
      i++; // Move past _
      let subContent = '';
      
      // Check for braced content: _{...}
      if (text[i] === '{') {
        i++; // Move past {
        let braceDepth = 1;
        while (i < text.length && braceDepth > 0) {
          if (text[i] === '{') braceDepth++;
          else if (text[i] === '}') braceDepth--;
          if (braceDepth > 0) subContent += text[i];
          i++;
        }
      }
      // Check for parenthesized content: _(...)
      else if (text[i] === '(') {
        i++; // Move past (
        let parenDepth = 1;
        while (i < text.length && parenDepth > 0) {
          if (text[i] === '(') parenDepth++;
          else if (text[i] === ')') parenDepth--;
          if (parenDepth > 0) subContent += text[i];
          i++;
        }
      }
      // Single character
      else if (/[0-9a-zA-Z]/.test(text[i])) {
        subContent = text[i];
        i++;
      }
      
      if (subContent) {
        segments.push({ type: 'subscript', text: subContent });
      }
      continue;
    }
    
    // Normal character
    currentNormal += char;
    i++;
  }
  
  // Add any remaining normal text
  if (currentNormal) {
    segments.push({ type: 'normal', text: currentNormal });
  }
  
  return segments;
}

// ============= Measure Math Text Width =============
// Calculates the width of text with superscripts/subscripts using baseline shifting
function measureMathText(doc: jsPDF, text: string, baseFontSize: number): number {
  const segments = parseMathSegments(text);
  let totalWidth = 0;
  
  for (const segment of segments) {
    if (segment.type === 'normal') {
      doc.setFontSize(baseFontSize);
      totalWidth += doc.getTextWidth(segment.text);
    } else {
      // Superscript and subscript use smaller font
      const scale = segment.type === 'superscript' ? SUPERSCRIPT_SCALE : SUBSCRIPT_SCALE;
      doc.setFontSize(baseFontSize * scale);
      totalWidth += doc.getTextWidth(segment.text);
    }
  }
  
  // Restore base font size
  doc.setFontSize(baseFontSize);
  return totalWidth;
}

// ============= Render Math Text with Baseline Shifting =============
// Renders text with proper visual superscripts and subscripts using Y-offset
function renderMathText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  baseFontSize: number,
  color: readonly number[]
): number {
  const segments = parseMathSegments(text);
  let currentX = x;
  
  // Ensure character spacing is reset to avoid corruption
  doc.setCharSpace(0);
  
  for (const segment of segments) {
    doc.setTextColor(color[0], color[1], color[2]);
    
    if (segment.type === 'normal') {
      doc.setFontSize(baseFontSize);
      doc.text(segment.text, currentX, y);
      currentX += doc.getTextWidth(segment.text);
    } else if (segment.type === 'superscript') {
      // Smaller font, raised position
      const fontSize = baseFontSize * SUPERSCRIPT_SCALE;
      doc.setFontSize(fontSize);
      doc.text(segment.text, currentX, y - SUPERSCRIPT_RISE);
      currentX += doc.getTextWidth(segment.text);
    } else if (segment.type === 'subscript') {
      // Smaller font, lowered position
      const fontSize = baseFontSize * SUBSCRIPT_SCALE;
      doc.setFontSize(fontSize);
      doc.text(segment.text, currentX, y + SUBSCRIPT_DROP);
      currentX += doc.getTextWidth(segment.text);
    }
  }
  
  // Restore base font size
  doc.setFontSize(baseFontSize);
  return currentX;
}

// ============= Word-Wrap Math Text =============
// Splits text into lines respecting max width, keeping math expressions together
function wrapMathText(doc: jsPDF, text: string, maxWidth: number, baseFontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const testWidth = measureMathText(doc, testLine, baseFontSize);
    
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

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
  const lines = questionText.split('\n');
  let tableStartIdx = -1;
  let tableEndIdx = -1;
  let pipeLineCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const hasPipes = line.includes('|') && (line.split('|').length >= 3);
    const isSeparatorRow = /^[|:\s-]+$/.test(line) && line.includes('-');
    
    if (hasPipes || isSeparatorRow) {
      if (tableStartIdx === -1) tableStartIdx = i;
      tableEndIdx = i;
      if (hasPipes && !isSeparatorRow) pipeLineCount++;
    } else if (tableStartIdx !== -1 && tableEndIdx !== -1) {
      break;
    }
  }
  
  // Need at least 2 data rows to be considered a table
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
  
  const optionStartPattern = /(?:^|[\s?.!])\s*([A-E])\s*[\).:]\s*/i;
  const firstMatch = questionText.match(optionStartPattern);
  
  if (!firstMatch) {
    return { cleanText: questionText, options: [] };
  }
  
  const matchIndex = questionText.indexOf(firstMatch[0]);
  const firstOptionIndex = matchIndex + firstMatch[0].toUpperCase().indexOf(firstMatch[1].toUpperCase());
  const cleanText = questionText.substring(0, firstOptionIndex).trim();
  const optionsPortion = questionText.substring(firstOptionIndex).trim();
  
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
    if (rawOptions.every((o) => typeof o === "string")) {
      return (rawOptions as string[])
        .map((text, idx) => ({
          label: labels[idx] ?? String.fromCharCode(65 + idx),
          text: String(text ?? "").trim(),
        }))
        .filter((o) => o.text.length > 0);
    }

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
  if (['biology', 'human biology'].some(k => s.includes(k))) {
    return 'biology';
  }
  if (['physics', 'chemistry'].some(k => s.includes(k))) {
    return 'science';
  }
  if (['english', 'history', 'literature', 'essay', 'geography', 'sociology', 'psychology', 'religious'].some(k => s.includes(k))) {
    return 'essay';
  }
  return 'general';
}

function getAnswerAreaType(subject?: string, marks?: number, questionType?: string): 'blank' | 'lined' | 'grid' | 'none' | 'mcq_box' | 'dotted_lines' {
  if (questionType?.toLowerCase() === 'mcq') return 'mcq_box';
  
  const subjectType = getSubjectType(subject);
  
  switch (subjectType) {
    case 'math':
      return 'blank';
    case 'biology':
      return 'dotted_lines';
    case 'essay':
      return 'lined';
    case 'science':
      return (marks && marks > 4) ? 'grid' : 'blank';
    default:
      return 'blank';
  }
}

function getAnswerBoxHeight(marks: number): number {
  if (marks <= 1) return 15;
  if (marks <= 2) return ANSWER_HEIGHT_1_2_MARKS;
  if (marks <= 4) return ANSWER_HEIGHT_3_4_MARKS;
  if (marks <= 7) return ANSWER_HEIGHT_5_PLUS_MARKS;
  return ANSWER_HEIGHT_EXTENDED;
}

// ============= Calculate dotted line count based on marks =============
function getDottedLineCount(marks: number): number {
  if (marks <= 1) return 3;
  if (marks <= 2) return 5;
  if (marks <= 3) return 8;
  if (marks <= 4) return 10;
  if (marks <= 6) return 14;
  return Math.min(marks * 2 + 4, 24);
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

  // Ensure character spacing is always 0 to prevent corruption
  doc.setCharSpace(0);

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
    doc.setCharSpace(0); // Reset on new page
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
      doc.setCharSpace(0);
      
      setColor(COLORS.separator, "draw");
      doc.setLineWidth(0.3);
      doc.line(MARGIN, A4_HEIGHT - 15, A4_WIDTH - MARGIN, A4_HEIGHT - 15);
      
      if (i > 1) {
        doc.text(`${i - 1}`, A4_WIDTH / 2, A4_HEIGHT - 10, { align: "center" });
      }
    }
  };

  // ============= Render Math Text Helper (uses baseline shifting) =============
  const drawMathText = (text: string, x: number, y: number, fontSize: number = 10): number => {
    doc.setFont("helvetica", "normal");
    return renderMathText(doc, text, x, y, fontSize, COLORS.primary);
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

    doc.text("Candidate Name:", MARGIN, yPosition);
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN + 35, yPosition + 1, A4_WIDTH / 2 - 5, yPosition + 1);

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
      
      if (lineY > A4_HEIGHT - FOOTER_HEIGHT - 5) {
        addNewPage();
        return drawDottedLines(x, yPosition, width, numLines - i, i === numLines - 1 ? marks : undefined);
      }
      
      doc.setLineDashPattern([1, 2], 0);
      setColor(COLORS.border, "draw");
      doc.setLineWidth(0.3);
      doc.line(x, lineY, x + width - 15, lineY);
      
      if (i === numLines - 1 && marks) {
        doc.setLineDashPattern([], 0);
        setColor(COLORS.primary);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(formatMarks(marks), x + width, lineY, { align: "right" });
      }
    }
    
    doc.setLineDashPattern([], 0);
    return y + (numLines * lineSpacing) + 5;
  };

  // ============= Enhanced Table Rendering with Caption Support =============
  const renderTable = (tableData: string, x: number, y: number, caption?: string | null): number => {
    if (!tableData) return y;
    
    let currentY = y + 10;
    
    let rows: string[][] = [];
    try {
      const parsed = JSON.parse(tableData);
      if (Array.isArray(parsed)) {
        rows = parsed.map(row => 
          Array.isArray(row) ? row.map(cell => String(cell || '')) : [String(row || '')]
        );
      }
    } catch {
      let lines = tableData.split('\n').filter(line => line.trim());
      
      if (lines.length === 1 && tableData.includes('||')) {
        const parts = tableData.split('||').map(p => p.trim());
        rows = parts.map(part => {
          const cells = part.split('|');
          if (cells.length > 0 && cells[0] === '') cells.shift();
          if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
          return cells.map(cell => cell.trim());
        });
      } else {
        rows = lines.map(line => {
          if (line.includes('|')) {
            const cells = line.split('|');
            if (cells.length > 0 && cells[0].trim() === '') cells.shift();
            if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
            return cells.map(cell => cell.trim());
          }
          return [line.trim()];
        });
      }
      
      rows = rows.filter(row => 
        row.length > 0 && !row.every(cell => /^[-:]*$/.test(cell))
      );
    }
    
    if (rows.length === 0) return y;
    
    // Header shortening aliases
    const HEADER_ALIASES: Record<string, string> = {
      "desired concentration of diluted sample": "Conc (mol/dm^3)",
      "volume of stock solution required": "Stock Vol (cm^3)",
      "volume of distilled water required": "Water Vol (cm^3)",
      "section of quadrat": "Quadrat",
      "beetles count": "Count",
      "beetles counted": "Count",
      "number of beetles": "Count",
      "concentration": "Conc",
      "temperature": "Temp (C)",
      "time / s": "Time (s)",
      "time (s)": "Time (s)",
      "velocity / m s^-1": "Vel (m/s)",
      "velocity": "Vel (m/s)",
      "distance / m": "Dist (m)",
      "mass / g": "Mass (g)",
      "volume / cm^3": "Vol (cm^3)",
      "volume / cm3": "Vol (cm^3)",
      "titre / cm^3": "Titre (cm^3)",
      "titre / cm3": "Titre (cm^3)",
    };
    
    const shortenHeader = (header: string): string => {
      const lower = header.toLowerCase().trim();
      for (const [long, short] of Object.entries(HEADER_ALIASES)) {
        if (lower.includes(long)) return short;
      }
      if (header.length > 16) {
        const words = header.split(/\s+/);
        if (words.length > 2) {
          return words.slice(0, 2).join(' ');
        }
        return header.substring(0, 14) + '...';
      }
      return header;
    };
    
    const cleanCellContent = (cellText: string): string => {
      return cleanLatexForPDF(cellText);
    };
    
    rows = rows.map((row, rowIndex) => 
      row.map(cell => {
        const cleaned = cleanCellContent(cell);
        return rowIndex === 0 ? shortenHeader(cleaned) : cleaned;
      })
    );
    
    const maxCols = Math.max(...rows.map(row => row.length));
    const shouldRotate = maxCols <= 3 && rows.length > 5;
    
    if (shouldRotate && rows.length > 1) {
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
    
    const finalMaxCols = Math.max(...rows.map(row => row.length));
    
    const cellPadding = 4;
    const rowHeight = 12;
    
    const colWidths: number[] = [];
    const maxTableWidth = CONTENT_WIDTH - 20;
    const minColWidth = 25;
    
    for (let j = 0; j < finalMaxCols; j++) {
      let maxWidth = minColWidth;
      for (const row of rows) {
        const cellText = row[j] || '';
        doc.setFontSize(9);
        const textWidth = measureMathText(doc, cellText, 9) + cellPadding * 2;
        maxWidth = Math.max(maxWidth, textWidth);
      }
      colWidths.push(maxWidth);
    }
    
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    if (totalWidth > maxTableWidth) {
      const scale = maxTableWidth / totalWidth;
      for (let j = 0; j < colWidths.length; j++) {
        colWidths[j] *= scale;
      }
    }
    
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableX = x;
    const totalTableHeight = (rows.length * rowHeight) + (caption ? 18 : 0) + 24;
    
    if (currentY + totalTableHeight > A4_HEIGHT - FOOTER_HEIGHT - 20) {
      addNewPage();
      currentY = yPosition + 10;
    }
    
    if (caption) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor(COLORS.primary);
      doc.text(caption, tableX, currentY);
      currentY += LINE_HEIGHT + 4;
    }
    
    const drawRow = (rowData: string[], rowY: number, isHeader: boolean): number => {
      if (rowY + rowHeight > A4_HEIGHT - FOOTER_HEIGHT - 10) {
        addNewPage();
        rowY = yPosition + 5;
        
        if (!isHeader && rows.length > 0) {
          drawRow(rows[0], rowY, true);
          rowY += rowHeight;
        }
      }
      
      let cellX = tableX;
      for (let j = 0; j < finalMaxCols; j++) {
        const cellText = rowData[j] || '';
        const colWidth = colWidths[j];
        
        if (isHeader) {
          setColor([230, 235, 245], "fill");
          doc.rect(cellX, rowY, colWidth, rowHeight, "F");
        } else {
          setColor([255, 255, 255], "fill");
          doc.rect(cellX, rowY, colWidth, rowHeight, "F");
        }
        
        setColor(COLORS.border, "draw");
        doc.setLineWidth(isHeader ? 0.5 : 0.3);
        doc.rect(cellX, rowY, colWidth, rowHeight, "D");
        
        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        doc.setFontSize(9);
        
        // Use baseline-shift rendering for table cells
        const textY = rowY + rowHeight / 2 + 3;
        renderMathText(doc, cellText, cellX + cellPadding, textY, 9, COLORS.primary);
        
        cellX += colWidth;
      }
      
      return rowY + rowHeight;
    };
    
    const tableStartY = currentY;
    
    for (let i = 0; i < rows.length; i++) {
      const isHeader = i === 0;
      currentY = drawRow(rows[i], currentY, isHeader);
    }
    
    doc.setLineWidth(0.6);
    setColor(COLORS.border, "draw");
    const tableHeight = currentY - tableStartY;
    doc.rect(tableX, tableStartY, tableWidth, tableHeight, "D");
    
    return currentY + 12;
  };

  // ============= Answer Box Drawing =============
  const drawAnswerBox = (x: number, y: number, width: number, height: number, areaType: 'blank' | 'lined' | 'grid' | 'none' | 'minimal' | 'mcq_box' | 'dotted_lines', marks?: number) => {
    if (areaType === 'none' || areaType === 'minimal') return y;

    if (areaType === 'mcq_box') {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      setColor(COLORS.primary);
      doc.text("Your answer", x, y + 5);
      
      setColor(COLORS.border, "draw");
      doc.setLineWidth(0.5);
      doc.rect(x + 26, y, 12, 8, "D");
      
      if (marks) {
        doc.setFontSize(10);
        setColor(COLORS.primary);
        doc.text(formatMarks(marks), x + 42, y + 5);
      }
      
      return y + 14;
    }

    if (areaType === 'dotted_lines') {
      const lineCount = getDottedLineCount(marks || 3);
      return drawDottedLines(x, y, width, lineCount, marks);
    }

    setColor(COLORS.answerBoxBg, "fill");
    doc.rect(x, y, width, height, "F");

    setColor(COLORS.answerBoxBorder, "draw");
    doc.setLineWidth(0.4);
    doc.rect(x, y, width, height, "D");

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    setColor(COLORS.muted);
    const answerLabel = marks ? `Working space / Answer ${formatMarks(marks)}` : "Working space / Answer:";
    doc.text(answerLabel, x + 3, y + 5);

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
    
    setColor([255, 255, 255], "fill");
    doc.rect(x, y, width, height, "F");
    
    setColor([220, 220, 220], "draw");
    doc.setLineWidth(0.1);

    for (let i = 0; i <= Math.floor(width / cellSize); i++) {
      doc.line(x + i * cellSize, y, x + i * cellSize, y + height);
    }
    for (let i = 0; i <= Math.floor(height / cellSize); i++) {
      doc.line(x, y + i * cellSize, x + width, y + i * cellSize);
    }

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    setColor(COLORS.primary, "draw");
    doc.setLineWidth(0.3);
    doc.line(x, centerY, x + width, centerY);
    doc.line(centerX, y, centerX, y + height);

    doc.setFontSize(8);
    setColor(COLORS.secondary);
    doc.text("x", x + width - 3, centerY - 2);
    doc.text("y", centerX + 2, y + 4);

    doc.setLineWidth(0.2);
    
    setColor(COLORS.answerBoxBorder, "draw");
    doc.rect(x, y, width, height, "D");
  };

  // ============= Helper: Get safe text width =============
  const getSafeTextWidth = (baseWidth: number): number => {
    return baseWidth - 5;
  };

  // ============= Fill-in-the-Blank Rendering =============
  const BLANK_BOX_WIDTH = 30;
  const BLANK_BOX_HEIGHT = 6;
  
  const renderTextWithBlanks = (
    text: string, 
    startX: number, 
    startY: number, 
    maxWidth: number, 
    marks?: number
  ): number => {
    if (!text || !hasFillInBlanks(text)) {
      // No blanks - render using math text
      const lines = wrapMathText(doc, text || '', maxWidth, 10);
      lines.forEach((line: string) => {
        if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 15) {
          addNewPage();
        }
        doc.setFont("helvetica", "normal");
        renderMathText(doc, line || '', startX, startY, 10, COLORS.primary);
        startY += LINE_HEIGHT;
      });
      return startY;
    }
    
    const BLANK_REGEX = /\[\s*BLANK\s*\]/gi;
    const parts = text.split(BLANK_REGEX);
    const blankCount = (text.match(BLANK_REGEX) || []).length;
    
    let currentX = startX;
    let currentY = startY;
    const lineStartX = startX;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part) {
        const words = part.split(/\s+/).filter(w => w);
        
        for (const word of words) {
          const wordWidth = measureMathText(doc, word + ' ', 10);
          
          if (currentX + wordWidth > lineStartX + maxWidth) {
            currentX = lineStartX;
            currentY += LINE_HEIGHT;
            
            if (currentY > A4_HEIGHT - FOOTER_HEIGHT - 15) {
              addNewPage();
              currentY = yPosition;
            }
          }
          
          currentX = renderMathText(doc, word + ' ', currentX, currentY, 10, COLORS.primary);
        }
      }
      
      if (i < blankCount) {
        if (currentX + BLANK_BOX_WIDTH + 5 > lineStartX + maxWidth) {
          currentX = lineStartX;
          currentY += LINE_HEIGHT;
          
          if (currentY > A4_HEIGHT - FOOTER_HEIGHT - 15) {
            addNewPage();
            currentY = yPosition;
          }
        }
        
        const boxY = currentY - BLANK_BOX_HEIGHT + 1.5;
        setColor(COLORS.answerBoxBorder, "draw");
        doc.setLineWidth(0.4);
        doc.rect(currentX, boxY, BLANK_BOX_WIDTH, BLANK_BOX_HEIGHT, "D");
        
        setColor([250, 250, 252], "fill");
        doc.rect(currentX + 0.2, boxY + 0.2, BLANK_BOX_WIDTH - 0.4, BLANK_BOX_HEIGHT - 0.4, "F");
        
        currentX += BLANK_BOX_WIDTH + 3;
      }
    }
    
    if (marks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      doc.text(formatMarks(marks), lineStartX + maxWidth + 5, currentY, { align: "left" });
    }
    
    return currentY + LINE_HEIGHT + 2;
  };
  
  const isFillInBlankQuestion = (questionText: string): boolean => {
    return hasFillInBlanks(questionText);
  };

  // ============= Render Question Lines with Math Support =============
  const renderQuestionLines = (text: string, x: number, startY: number, maxWidth: number): number => {
    const lines = wrapMathText(doc, text, maxWidth, 10);
    let currentY = startY;
    
    for (const line of lines) {
      if (currentY > A4_HEIGHT - FOOTER_HEIGHT - 15) {
        addNewPage();
        currentY = yPosition;
      }
      doc.setFont("helvetica", "normal");
      renderMathText(doc, line || '', x, currentY, 10, COLORS.primary);
      currentY += LINE_HEIGHT;
    }
    
    return currentY;
  };

  // ============= Biology-Specific Question Rendering =============
  const drawBiologyQuestionGroup = (group: QuestionGroup) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    doc.text(`${group.mainNumber}.`, MARGIN, yPosition);
    
    if (showMarks && group.totalMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      doc.text(formatMarks(group.totalMarks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
    }
    
    yPosition += 3;
    
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 8;

    for (let i = 0; i < group.questions.length; i++) {
      const question = group.questions[i];
      const parsed = parseQuestionNumber(question.question_number);
      const isSubQuestion = parsed.sub !== '';
      
      const tableExtract = extractEmbeddedTable(question.question_text);
      const embeddedTableData = tableExtract.tableData;
      const embeddedTableCaption = tableExtract.tableCaption;
      
      let cleanedText = cleanLatexForPDF(tableExtract.cleanText);
      
      const estimatedHeight = 50;
      if (getRemainingSpace() < estimatedHeight) {
        addNewPage();
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        setColor(COLORS.muted);
        doc.text(`Question ${group.mainNumber} continued`, MARGIN, yPosition);
        yPosition += 10;
      }

      const textIndent = isSubQuestion ? MARGIN + 10 : MARGIN + 8;
      const baseTextWidth = CONTENT_WIDTH - (isSubQuestion ? 20 : 15);
      
      if (isSubQuestion) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        setColor(COLORS.primary);
        doc.text(`(${parsed.sub})`, MARGIN + 5, yPosition);
        yPosition += 6;
      }

      let mcqOptions = normalizeMCQOptions(question.options);
      const parsedMCQ = parseEmbeddedMCQOptions(cleanedText);
      if (parsedMCQ.options.length >= 3) {
        cleanedText = parsedMCQ.cleanText;
        mcqOptions = parsedMCQ.options;
      }

      const isMCQ = mcqOptions.length >= 3;

      if (embeddedTableData) {
        yPosition = renderTable(embeddedTableData, textIndent, yPosition, embeddedTableCaption);
      }

      if (question.table_data) {
        yPosition = renderTable(question.table_data, textIndent, yPosition);
      }

      const isFillInBlank = isFillInBlankQuestion(cleanedText);
      const textWidth = getSafeTextWidth(baseTextWidth);
      const safeCleanedText = cleanedText || '';
      
      if (isFillInBlank) {
        yPosition = renderTextWithBlanks(safeCleanedText, textIndent, yPosition, textWidth, question.marks);
      } else {
        yPosition = renderQuestionLines(safeCleanedText, textIndent, yPosition, textWidth);
        yPosition += 4;
      }

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

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          doc.text(`${optionLetter})`, textIndent + 5, yPosition);

          doc.setFont("helvetica", "normal");
          const optionText = cleanLatexForPDF(optionTextRaw);
          const optionWidth = getSafeTextWidth(baseTextWidth - 20);
          const optionLines = wrapMathText(doc, optionText, optionWidth, 10);

          optionLines.forEach((line: string, idx: number) => {
            renderMathText(doc, line || "", textIndent + 15, yPosition + (idx * LINE_HEIGHT), 10, COLORS.primary);
          });

          yPosition += Math.max(optionLines.length, 1) * LINE_HEIGHT + 4;
        }

        yPosition += 2;
        drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 10, 0, "mcq_box", question.marks);
        yPosition += 8;
      }
      else if (question.sub_questions && question.sub_questions.length > 0) {
        for (const sub of question.sub_questions) {
          if (getRemainingSpace() < 40) {
            addNewPage();
          }
          
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          setColor(COLORS.primary);
          doc.text(`(${sub.label})`, textIndent, yPosition);
          yPosition += 6;
          
          doc.setFont("helvetica", "normal");
          const subText = cleanLatexForPDF(sub.text || '');
          const subTextWidth = getSafeTextWidth(baseTextWidth - 10);
          yPosition = renderQuestionLines(subText, textIndent + 10, yPosition, subTextWidth);
          yPosition += 4;
          
          if (includeWorkingSpace) {
            const lineCount = getDottedLineCount(sub.marks);
            yPosition = drawDottedLines(textIndent, yPosition, CONTENT_WIDTH - 15, lineCount, sub.marks);
            yPosition += BIOLOGY_QUESTION_GAP;
          }
        }
      }
      else if (includeWorkingSpace && question.question_type?.toLowerCase() !== 'mcq' && !isFillInBlank) {
        if (question.requires_graph) {
          if (getRemainingSpace() < GRID_HEIGHT + 15) {
            addNewPage();
          }
          const graphX = MARGIN + (CONTENT_WIDTH - GRID_WIDTH) / 2;
          drawCoordinateGrid(graphX, yPosition, GRID_WIDTH, GRID_HEIGHT);
          yPosition += GRID_HEIGHT + 10;
        }
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
        else {
          const lineCount = getDottedLineCount(question.marks);
          yPosition = drawDottedLines(textIndent, yPosition, CONTENT_WIDTH - 15, lineCount, question.marks);
        }
        
        yPosition += BIOLOGY_QUESTION_GAP;
      }
      else if (isFillInBlank) {
        yPosition += BIOLOGY_QUESTION_GAP;
      }
    }

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
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    doc.text(`${group.mainNumber}.`, MARGIN, yPosition);
    
    if (showMarks && group.totalMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      doc.text(formatMarks(group.totalMarks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
    }
    
    yPosition += 3;
    
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 8;

    let totalSubMarks = 0;
    let hasDrawnAnyQuestions = false;

    for (let i = 0; i < group.questions.length; i++) {
      const question = group.questions[i];
      const parsed = parseQuestionNumber(question.question_number);
      const isSubQuestion = parsed.sub !== '';
      
      const tableExtract = extractEmbeddedTable(question.question_text);
      const embeddedTableData = tableExtract.tableData;
      const embeddedTableCaption = tableExtract.tableCaption;
      
      let cleanedText = cleanLatexForPDF(tableExtract.cleanText);
      
      const estimatedTextHeight = 30;
      if (i > 0 && getRemainingSpace() < estimatedTextHeight) {
        addNewPage();
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        setColor(COLORS.muted);
        doc.text(`Question ${group.mainNumber} continued`, MARGIN, yPosition);
        yPosition += 10;
      }

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

      let mcqOptions = normalizeMCQOptions(question.options);
      const parsedMCQ = parseEmbeddedMCQOptions(cleanedText);
      if (parsedMCQ.options.length >= 3) {
        cleanedText = parsedMCQ.cleanText;
        mcqOptions = parsedMCQ.options;
      }

      const isMCQ = mcqOptions.length >= 3;
      const textIndent = isSubQuestion ? MARGIN + 10 : MARGIN + 8;
      const baseTextWidth = CONTENT_WIDTH - (isSubQuestion ? 20 : 15);

      if (embeddedTableData) {
        yPosition = renderTable(embeddedTableData, textIndent, yPosition, embeddedTableCaption);
      }

      if (question.table_data) {
        yPosition = renderTable(question.table_data, textIndent, yPosition);
      }

      const isFillInBlank = isFillInBlankQuestion(cleanedText);
      const textWidth = getSafeTextWidth(baseTextWidth);
      const safeCleanedText = cleanedText || '';

      if (isFillInBlank) {
        yPosition = renderTextWithBlanks(safeCleanedText, textIndent, yPosition, textWidth, question.marks);
      } else {
        yPosition = renderQuestionLines(safeCleanedText, textIndent, yPosition, textWidth);
        yPosition += 3;
      }
      hasDrawnAnyQuestions = true;
      
      if (isFillInBlank) {
        (question as any)._isFillInBlank = true;
      }

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

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          setColor(COLORS.primary);
          doc.text(`${optionLetter})`, textIndent + 3, yPosition);

          doc.setFont("helvetica", "normal");
          const optionText = cleanLatexForPDF(optionTextRaw);
          const optionWidth = getSafeTextWidth(baseTextWidth - 18);
          const optionLines = wrapMathText(doc, optionText, optionWidth, 10);

          optionLines.forEach((line: string, idx: number) => {
            renderMathText(doc, line || "", textIndent + 12, yPosition + (idx * LINE_HEIGHT), 10, COLORS.primary);
          });

          yPosition += Math.max(optionLines.length, 1) * LINE_HEIGHT + 4;
        }

        yPosition += 2;
        drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 10, 0, "mcq_box", question.marks);
        yPosition += 8;
      }
      else if (question.sub_questions && question.sub_questions.length > 0) {
        for (const sub of question.sub_questions) {
          if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 25) {
            addNewPage();
          }
          
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
          
          doc.setFont("helvetica", "normal");
          const subText = cleanLatexForPDF(sub.text || '');
          const subTextWidth = getSafeTextWidth(baseTextWidth - 10);
          yPosition = renderQuestionLines(subText, textIndent + 10, yPosition, subTextWidth);
          yPosition += 4;
          
          totalSubMarks += sub.marks;
        }
      }
      else if (question.requires_graph && includeWorkingSpace) {
        if (getRemainingSpace() < GRID_HEIGHT + 15) {
          addNewPage();
        }
        const graphX = MARGIN + (CONTENT_WIDTH - GRID_WIDTH) / 2;
        drawCoordinateGrid(graphX, yPosition, GRID_WIDTH, GRID_HEIGHT);
        yPosition += GRID_HEIGHT + 10;
      }
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

    if (includeWorkingSpace && hasDrawnAnyQuestions) {
      const allMCQ = group.questions.every(q => q.question_type?.toLowerCase() === "mcq");
      const hadSpecialElements = group.questions.some(q => q.requires_graph || q.requires_diagram);
      const allFillInBlank = group.questions.every(q => (q as any)._isFillInBlank === true);
      
      if (!allMCQ && !hadSpecialElements && !allFillInBlank) {
        const subjectType = getSubjectType(examData.subject);
        const areaType = answerStyle || getAnswerAreaType(examData.subject, totalSubMarks, 'written');
        
        if (areaType !== 'none' && areaType !== 'mcq_box') {
          const remainingSpace = getRemainingSpace();
          
          if (subjectType === 'math') {
            const mathBoxHeight = Math.max(remainingSpace - 15, 60);
            if (mathBoxHeight > 30) {
              drawAnswerBox(MARGIN, yPosition, CONTENT_WIDTH, mathBoxHeight, areaType, totalSubMarks);
              yPosition += mathBoxHeight + 5;
            }
          } 
          else if (subjectType === 'biology') {
            yPosition = drawAnswerBox(MARGIN, yPosition, CONTENT_WIDTH, 0, 'dotted_lines', totalSubMarks);
          }
          else {
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
      const answerLines = wrapMathText(doc, answerText, CONTENT_WIDTH - 20, 10);
      answerLines.forEach((line: string, idx: number) => {
        renderMathText(doc, line || '', MARGIN + 15, yPosition + (idx * LINE_HEIGHT), 10, COLORS.primary);
      });
      
      yPosition += Math.max(answerLines.length, 1) * LINE_HEIGHT + 4;
    }
  };

  // ============= Generate PDF =============
  
  drawInstructionsPage();
  addNewPage();
  
  const subjectType = getSubjectType(examData.subject);
  
  for (let i = 0; i < questionGroups.length; i++) {
    if (subjectType === 'math') {
      if (i > 0) {
        addNewPage();
      }
      drawQuestionGroup(questionGroups[i]);
    } 
    else if (subjectType === 'biology') {
      if (i > 0 && getRemainingSpace() < MIN_SPACE_FOR_QUESTION) {
        addNewPage();
      }
      drawBiologyQuestionGroup(questionGroups[i]);
      yPosition += BIOLOGY_SECTION_GAP;
    }
    else {
      if (i > 0 && getRemainingSpace() < MIN_SPACE_FOR_QUESTION) {
        addNewPage();
      }
      drawQuestionGroup(questionGroups[i]);
      yPosition += QUESTION_SPACING;
    }
  }

  if (includeAnswerKey) {
    drawAnswerKey();
  }

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
  
  // Remove zero-width characters that cause spacing issues in jsPDF
  safe = safe.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  
  // Remove other invisible/control characters
  safe = safe.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Replace problematic quote characters with standard ASCII
  safe = safe.replace(/[""„‟]/g, '"');
  safe = safe.replace(/[''‚‛]/g, "'");
  
  // Normalize multiple spaces to single space
  safe = safe.replace(/\s+/g, ' ');
  
  return safe.trim();
}

// ============= Check if question has fill-in-the-blank placeholders =============
function hasFillInBlanks(text: string): boolean {
  if (/\[\s*BLANK\s*\]/i.test(text)) return true;
  if (/_{5,}/.test(text)) return true;
  if (/(?:[\\\/L_]{5,})/.test(text)) return true;
  if (/\\underline\{[^}]*\}/.test(text)) return true;
  
  return false;
}

// ============= PDF_RENDER_GATE: Central Sanitization for ALL PDF Text =============
// This function MUST be called on ALL text before writing to jsPDF
// It strips raw LaTeX, converts math notation, and ensures clean output
function PDF_RENDER_GATE(text: string): string {
  if (!text) return "";

  let cleaned = text;
  
  // ============= DEBUG: Log forbidden tokens =============
  const forbiddenTokens = ['\\begin{', '\\end{', '$aligned', 'aligned$', '\\\\'];
  for (const token of forbiddenTokens) {
    if (cleaned.includes(token)) {
      console.warn(`[PDF_RENDER_GATE] Forbidden token detected: "${token}" in text`);
    }
  }
  
  // ============= STEP 1: Strip math wrappers =============
  // Remove leading/trailing $...$ (both inline and display)
  cleaned = cleaned.replace(/^\$\$(.+)\$\$$/s, "$1");
  cleaned = cleaned.replace(/^\$(.+)\$$/s, "$1");
  cleaned = cleaned.replace(/\$\$(.*?)\$\$/gs, "$1");
  cleaned = cleaned.replace(/\$(.*?)\$/g, "$1");
  
  // Remove \(...\) and \[...\] delimiters
  cleaned = cleaned.replace(/\\\((.*?)\\\)/g, "$1");
  cleaned = cleaned.replace(/\\\[(.*?)\\\]/g, "$1");
  
  // ============= STEP 2: Convert aligned/equation blocks to plain lines =============
  // Handle \begin{aligned} ... \end{aligned}
  cleaned = cleaned.replace(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/g, (_, content) => {
    // Replace \\ with newline, & with space
    return content
      .replace(/\\\\/g, '  ')
      .replace(/&/g, ' ')
      .trim();
  });
  
  // Handle \begin{equation} ... \end{equation}
  cleaned = cleaned.replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, "$1");
  
  // Handle \begin{array} ... \end{array}
  cleaned = cleaned.replace(/\\begin\{array\}(\{[^}]*\})?([\s\S]*?)\\end\{array\}/g, (_, cols, content) => {
    return content
      .replace(/\\\\/g, '  ')
      .replace(/&/g, ' ')
      .trim();
  });
  
  // Handle other \begin{...} \end{...} blocks
  cleaned = cleaned.replace(/\\begin\{[^}]+\}([\s\S]*?)\\end\{[^}]+\}/g, "$1");
  
  // ============= STEP 3: Handle fractions =============
  // Convert \frac{A}{B} to stacked notation (A)/(B)
  cleaned = cleaned.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, "($1)/($2)");
  // Simplified version for simple fractions
  cleaned = cleaned.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2");
  
  // ============= STEP 4: Normalize sqrt patterns =============
  // Convert \sqrt{X} → √(X)
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  // Convert \sqrt[n]{X} → n√(X)
  cleaned = cleaned.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, "$1√($2)");
  // Convert sqrt(X) → √(X)
  cleaned = cleaned.replace(/\bsqrt\(([^)]+)\)/g, "√($1)");
  // Convert 5sqrt(27) or ksqrt(m) patterns → 5√(27)
  cleaned = cleaned.replace(/(\d+)\s*sqrt\s*\(([^)]+)\)/gi, "$1√($2)");
  cleaned = cleaned.replace(/(\d+)\s*√\s*\(([^)]+)\)/g, "$1√($2)");
  
  // ============= STEP 5: Remove unsupported LaTeX commands =============
  // Remove \left and \right
  cleaned = cleaned.replace(/\\left\s*/g, "");
  cleaned = cleaned.replace(/\\right\s*/g, "");
  
  // Remove spacing commands
  cleaned = cleaned.replace(/\\,/g, " ");
  cleaned = cleaned.replace(/\\;/g, " ");
  cleaned = cleaned.replace(/\\:/g, " ");
  cleaned = cleaned.replace(/\\!/g, "");
  cleaned = cleaned.replace(/\\quad/g, "  ");
  cleaned = cleaned.replace(/\\qquad/g, "    ");
  cleaned = cleaned.replace(/\\ /g, " ");
  
  // Replace raw \\ with space (from line breaks in LaTeX)
  cleaned = cleaned.replace(/\\\\/g, "  ");
  
  // ============= STEP 6: Normalize fill-in-the-blank patterns =============
  const backslashBlankPattern = /(?:[\\\/L_]{5,}|(?:[\\\/L]+[_\\\/L]*){5,})/g;
  cleaned = cleaned.replace(backslashBlankPattern, '[ BLANK ]');
  cleaned = cleaned.replace(/_{5,}/g, '[ BLANK ]');
  cleaned = cleaned.replace(/\\underline\{[^}]*\}/g, '[ BLANK ]');
  cleaned = cleaned.replace(/\[\s*BLANK\s*\]\s*\[\s*BLANK\s*\]/g, '[ BLANK ]');
  
  // Now continue with existing cleanLatexForPDF logic
  return cleanLatexForPDFInternal(cleaned);
}

// ============= Clean LaTeX for PDF - Public API wrapper =============
// Routes all text through PDF_RENDER_GATE for proper sanitization
function cleanLatexForPDF(text: string): string {
  return PDF_RENDER_GATE(text);
}

// ============= Clean LaTeX for PDF - Internal implementation =============
// This function preserves ^ and _ notation for baseline-shift rendering
function cleanLatexForPDFInternal(text: string): string {
  if (!text) return "";

  let cleaned = text;
  
  // ============= PRESERVE ^ and _ NOTATION =============
  // DO NOT convert to Unicode - the baseline-shift renderer handles these
  // Just clean up LaTeX-specific formatting
  
  // Remove \^ and \_ escape sequences, replace with plain ^ and _
  cleaned = cleaned.replace(/\\\^/g, '^');
  cleaned = cleaned.replace(/\\_/g, '_');
  
  // ============= SYMBOL SAFETY - ASCII FALLBACKS =============
  // Greek letters - use ASCII fallbacks for jsPDF compatibility
  cleaned = cleaned.replace(/\\pi\b/g, "pi");
  cleaned = cleaned.replace(/\\alpha\b/g, "alpha");
  cleaned = cleaned.replace(/\\beta\b/g, "beta");
  cleaned = cleaned.replace(/\\gamma\b/g, "gamma");
  cleaned = cleaned.replace(/\\delta\b/g, "delta");
  cleaned = cleaned.replace(/\\epsilon\b/g, "epsilon");
  cleaned = cleaned.replace(/\\theta\b/g, "theta");
  cleaned = cleaned.replace(/\\lambda\b/g, "lambda");
  cleaned = cleaned.replace(/\\mu\b/g, "mu");
  cleaned = cleaned.replace(/\\sigma\b/g, "sigma");
  cleaned = cleaned.replace(/\\omega\b/g, "omega");
  cleaned = cleaned.replace(/\\phi\b/g, "phi");
  cleaned = cleaned.replace(/\\psi\b/g, "psi");
  cleaned = cleaned.replace(/\\rho\b/g, "rho");
  cleaned = cleaned.replace(/\\tau\b/g, "tau");
  cleaned = cleaned.replace(/\\chi\b/g, "chi");
  cleaned = cleaned.replace(/\\Delta\b/g, "Delta");
  cleaned = cleaned.replace(/\\Sigma\b/g, "Sigma");
  cleaned = cleaned.replace(/\\Omega\b/g, "Omega");
  cleaned = cleaned.replace(/\\Pi\b/g, "Pi");
  cleaned = cleaned.replace(/\\Gamma\b/g, "Gamma");
  cleaned = cleaned.replace(/\\Theta\b/g, "Theta");
  cleaned = cleaned.replace(/\\Lambda\b/g, "Lambda");
  
  // Also convert Unicode Greek to ASCII for consistency
  cleaned = cleaned.replace(/π/g, "pi");
  cleaned = cleaned.replace(/α/g, "alpha");
  cleaned = cleaned.replace(/β/g, "beta");
  cleaned = cleaned.replace(/γ/g, "gamma");
  cleaned = cleaned.replace(/δ/g, "delta");
  cleaned = cleaned.replace(/ε/g, "epsilon");
  cleaned = cleaned.replace(/θ/g, "theta");
  cleaned = cleaned.replace(/λ/g, "lambda");
  cleaned = cleaned.replace(/μ/g, "mu");
  cleaned = cleaned.replace(/σ/g, "sigma");
  cleaned = cleaned.replace(/ω/g, "omega");
  cleaned = cleaned.replace(/φ/g, "phi");
  cleaned = cleaned.replace(/ψ/g, "psi");
  cleaned = cleaned.replace(/ρ/g, "rho");
  cleaned = cleaned.replace(/τ/g, "tau");
  cleaned = cleaned.replace(/χ/g, "chi");
  
  // Math operators
  cleaned = cleaned.replace(/\\times\b/g, "x");
  cleaned = cleaned.replace(/×/g, "x");
  cleaned = cleaned.replace(/\\div\b/g, "/");
  cleaned = cleaned.replace(/÷/g, "/");
  cleaned = cleaned.replace(/\\pm\b/g, "+/-");
  cleaned = cleaned.replace(/±/g, "+/-");
  cleaned = cleaned.replace(/\\cdot\b/g, ".");
  cleaned = cleaned.replace(/·/g, ".");
  cleaned = cleaned.replace(/\\leq\b/g, "<=");
  cleaned = cleaned.replace(/≤/g, "<=");
  cleaned = cleaned.replace(/\\geq\b/g, ">=");
  cleaned = cleaned.replace(/≥/g, ">=");
  cleaned = cleaned.replace(/\\neq\b/g, "!=");
  cleaned = cleaned.replace(/≠/g, "!=");
  cleaned = cleaned.replace(/\\approx\b/g, "~");
  cleaned = cleaned.replace(/≈/g, "~");
  cleaned = cleaned.replace(/\\equiv\b/g, "===");
  cleaned = cleaned.replace(/≡/g, "===");
  cleaned = cleaned.replace(/\\lt\b/g, "<");
  cleaned = cleaned.replace(/\\gt\b/g, ">");
  
  // Degree symbol - use word
  cleaned = cleaned.replace(/°/g, " degrees");
  cleaned = cleaned.replace(/\\degree\b/g, " degrees");
  
  // Math symbols - use ASCII
  cleaned = cleaned.replace(/\\sum\b/g, "SUM");
  cleaned = cleaned.replace(/Σ/g, "SUM");
  cleaned = cleaned.replace(/\\prod\b/g, "PROD");
  cleaned = cleaned.replace(/Π/g, "PROD");
  cleaned = cleaned.replace(/\\infty\b/g, "infinity");
  cleaned = cleaned.replace(/∞/g, "infinity");
  cleaned = cleaned.replace(/\\partial\b/g, "d");
  cleaned = cleaned.replace(/∂/g, "d");
  cleaned = cleaned.replace(/\\nabla\b/g, "nabla");
  cleaned = cleaned.replace(/∇/g, "nabla");
  cleaned = cleaned.replace(/\\int\b/g, "integral");
  cleaned = cleaned.replace(/∫/g, "integral");
  cleaned = cleaned.replace(/\\forall\b/g, "for all");
  cleaned = cleaned.replace(/∀/g, "for all");
  cleaned = cleaned.replace(/\\exists\b/g, "exists");
  cleaned = cleaned.replace(/∃/g, "exists");
  cleaned = cleaned.replace(/\\in\b/g, "in");
  cleaned = cleaned.replace(/∈/g, "in");
  cleaned = cleaned.replace(/\\notin\b/g, "not in");
  cleaned = cleaned.replace(/∉/g, "not in");
  cleaned = cleaned.replace(/\\subset\b/g, "subset");
  cleaned = cleaned.replace(/⊂/g, "subset");
  cleaned = cleaned.replace(/\\supset\b/g, "superset");
  cleaned = cleaned.replace(/⊃/g, "superset");
  cleaned = cleaned.replace(/\\cup\b/g, "union");
  cleaned = cleaned.replace(/∪/g, "union");
  cleaned = cleaned.replace(/\\cap\b/g, "intersect");
  cleaned = cleaned.replace(/∩/g, "intersect");
  cleaned = cleaned.replace(/\\emptyset\b/g, "{}");
  cleaned = cleaned.replace(/∅/g, "{}");
  cleaned = cleaned.replace(/\\angle\b/g, "angle");
  cleaned = cleaned.replace(/∠/g, "angle");
  cleaned = cleaned.replace(/\\triangle\b/g, "triangle");
  cleaned = cleaned.replace(/△/g, "triangle");
  cleaned = cleaned.replace(/\\perp\b/g, "perpendicular");
  cleaned = cleaned.replace(/⊥/g, "perpendicular");
  cleaned = cleaned.replace(/\\parallel\b/g, "parallel");
  cleaned = cleaned.replace(/∥/g, "parallel");
  cleaned = cleaned.replace(/\\rightarrow\b/g, "->");
  cleaned = cleaned.replace(/→/g, "->");
  cleaned = cleaned.replace(/\\leftarrow\b/g, "<-");
  cleaned = cleaned.replace(/←/g, "<-");
  cleaned = cleaned.replace(/\\Rightarrow\b/g, "=>");
  cleaned = cleaned.replace(/⇒/g, "=>");
  cleaned = cleaned.replace(/\\Leftarrow\b/g, "<=");
  cleaned = cleaned.replace(/⇐/g, "<=");
  cleaned = cleaned.replace(/\\leftrightarrow\b/g, "<->");
  cleaned = cleaned.replace(/↔/g, "<->");
  cleaned = cleaned.replace(/\\therefore\b/g, "therefore");
  cleaned = cleaned.replace(/∴/g, "therefore");
  cleaned = cleaned.replace(/\\because\b/g, "because");
  cleaned = cleaned.replace(/∵/g, "because");
  
  // Functions - just remove backslash
  cleaned = cleaned.replace(/\\sin\b/g, "sin");
  cleaned = cleaned.replace(/\\cos\b/g, "cos");
  cleaned = cleaned.replace(/\\tan\b/g, "tan");
  cleaned = cleaned.replace(/\\log\b/g, "log");
  cleaned = cleaned.replace(/\\ln\b/g, "ln");
  cleaned = cleaned.replace(/\\exp\b/g, "exp");
  cleaned = cleaned.replace(/\\lim\b/g, "lim");
  
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
  
  // Clean up curly braces (but preserve ^ and _ with their braces for parsing)
  // Only remove standalone braces, not those part of ^{} or _{}
  cleaned = cleaned.replace(/(?<![_^])\{([^{}]*)\}/g, "$1");
  
  // ============= REMOVE UNICODE SUPERSCRIPTS/SUBSCRIPTS =============
  // These cause corruption in jsPDF - convert back to ^ and _ notation
  const unicodeSuperMap: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁻': '-', '⁺': '+', '⁼': '=', '⁽': '(', '⁾': ')',
    'ⁿ': 'n', 'ⁱ': 'i', 'ˣ': 'x', 'ʸ': 'y', 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c',
    'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ʲ': 'j', 'ᵏ': 'k',
    'ˡ': 'l', 'ᵐ': 'm', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't',
    'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ᶻ': 'z',
  };
  
  const unicodeSubMap: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₋': '-', '₊': '+', '₌': '=', '₍': '(', '₎': ')',
    'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k',
    'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r',
    'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x',
  };
  
  // Convert Unicode superscripts to ^{...} notation
  const superRegex = new RegExp(`[${Object.keys(unicodeSuperMap).join('')}]+`, 'g');
  cleaned = cleaned.replace(superRegex, (match) => {
    const converted = match.split('').map(c => unicodeSuperMap[c] || c).join('');
    return `^{${converted}}`;
  });
  
  // Convert Unicode subscripts to _{...} notation
  const subRegex = new RegExp(`[${Object.keys(unicodeSubMap).join('')}]+`, 'g');
  cleaned = cleaned.replace(subRegex, (match) => {
    const converted = match.split('').map(c => unicodeSubMap[c] || c).join('');
    return `_{${converted}}`;
  });
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ");
  
  // FINAL STEP: Apply sanitization to remove zero-width characters
  cleaned = sanitizeForPDF(cleaned);
  
  return cleaned;
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
