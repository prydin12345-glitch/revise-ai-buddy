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
const LINE_HEIGHT = 6;
const FOOTER_HEIGHT = 25;

// Minimum answer area heights
const MIN_ANSWER_SHORT = 30;
const MIN_ANSWER_MEDIUM = 50;
const MIN_ANSWER_LONG = 80;

// Grid settings for graph questions
const GRID_CELL_SIZE = 5;
const GRID_WIDTH = 100;
const GRID_HEIGHT = 80;

// Colors (RGB values)
const COLORS = {
  primary: [30, 30, 30] as const,
  secondary: [80, 80, 80] as const,
  muted: [140, 140, 140] as const,
  border: [180, 180, 180] as const,
  lightBg: [250, 250, 250] as const,
  answerBox: [252, 252, 252] as const,
  linedBg: [254, 254, 255] as const,
  separator: [200, 200, 200] as const,
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

// ============= Subject Detection =============
function getSubjectType(subject?: string): 'math' | 'science' | 'essay' | 'general' {
  if (!subject) return 'general';
  const s = subject.toLowerCase();
  
  if (['maths', 'mathematics', 'math', 'algebra', 'calculus', 'geometry', 'statistics'].some(k => s.includes(k))) {
    return 'math';
  }
  if (['physics', 'chemistry'].some(k => s.includes(k))) {
    return 'science';
  }
  if (['biology', 'english', 'history', 'literature', 'essay', 'geography', 'sociology', 'psychology', 'religious'].some(k => s.includes(k))) {
    return 'essay';
  }
  return 'general';
}

function getAnswerAreaType(subject?: string, marks?: number, questionType?: string): 'blank' | 'lined' | 'grid' | 'none' {
  if (questionType === 'MCQ') return 'none';
  
  const subjectType = getSubjectType(subject);
  
  switch (subjectType) {
    case 'math':
      return 'blank';
    case 'essay':
      return 'lined';
    case 'science':
      return (marks && marks > 4) ? 'grid' : 'blank';
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

  // Sort questions by number before processing
  const sortedQuestions = sortQuestions(examData.questions);

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

  const getMinAnswerHeight = (marks: number): number => {
    if (marks <= 2) return MIN_ANSWER_SHORT;
    if (marks <= 5) return MIN_ANSWER_MEDIUM;
    return MIN_ANSWER_LONG;
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
      doc.line(MARGIN, A4_HEIGHT - 18, A4_WIDTH - MARGIN, A4_HEIGHT - 18);
      
      // Page number
      doc.text(`Page ${i} of ${pageCount}`, A4_WIDTH / 2, A4_HEIGHT - 12, { align: "center" });
    }
  };

  // ============= Header Section =============
  const drawHeader = () => {
    // Exam title - bold and prominent
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    const titleLines = doc.splitTextToSize(examData.title.toUpperCase(), CONTENT_WIDTH - 20);
    titleLines.forEach((line: string, idx: number) => {
      doc.text(line, A4_WIDTH / 2, yPosition + (idx * 7), { align: "center" });
    });
    yPosition += titleLines.length * 7 + 4;

    // Subject, Board, Level info
    if (examData.subject || examData.exam_board || examData.qualification_level) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      setColor(COLORS.secondary);
      const infoItems: string[] = [];
      if (examData.subject) infoItems.push(examData.subject);
      if (examData.exam_board) infoItems.push(examData.exam_board);
      if (examData.qualification_level) infoItems.push(examData.qualification_level);
      
      doc.text(infoItems.join("  •  "), A4_WIDTH / 2, yPosition, { align: "center" });
      yPosition += 8;
    }

    // Separator line
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 8;

    // Student info and marks row
    doc.setFontSize(9);
    setColor(COLORS.primary);
    doc.setFont("helvetica", "normal");
    
    // Name field
    doc.text("Name:", MARGIN, yPosition);
    setColor(COLORS.border, "draw");
    doc.line(MARGIN + 12, yPosition + 1, MARGIN + 60, yPosition + 1);
    
    // Date field
    doc.text("Date:", MARGIN + 70, yPosition);
    doc.line(MARGIN + 82, yPosition + 1, MARGIN + 115, yPosition + 1);

    // Total marks
    const totalMarks = examData.total_marks || sortedQuestions.reduce((sum, q) => sum + q.marks, 0);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    let footerText = `Total: ${totalMarks} marks`;
    if (examData.time_allowed) {
      footerText += `  •  Time: ${examData.time_allowed} minutes`;
    }
    doc.text(footerText, A4_WIDTH - MARGIN, yPosition, { align: "right" });
    
    yPosition += 12;

    // Separator line
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 10;
  };

  // ============= Lined Answer Area Drawing =============
  const drawLinedArea = (x: number, y: number, width: number, height: number): number => {
    const lineSpacing = 8;
    const lineCount = Math.floor(height / lineSpacing);
    const actualHeight = lineCount * lineSpacing;
    
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.15);
    
    for (let i = 1; i <= lineCount; i++) {
      doc.line(x, y + (i * lineSpacing), x + width, y + (i * lineSpacing));
    }
    
    return actualHeight;
  };

  // ============= Grid Answer Area Drawing =============
  const drawGridArea = (x: number, y: number, width: number, height: number) => {
    const cellSize = 5;
    
    setColor([230, 230, 230], "draw");
    doc.setLineWidth(0.1);
    
    // Vertical grid lines
    for (let i = 0; i <= Math.floor(width / cellSize); i++) {
      doc.line(x + (i * cellSize), y, x + (i * cellSize), y + height);
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= Math.floor(height / cellSize); i++) {
      doc.line(x, y + (i * cellSize), x + width, y + (i * cellSize));
    }
  };

  // ============= Blank Answer Area Drawing =============
  const drawBlankArea = (x: number, y: number, width: number, height: number) => {
    // Very light background to indicate answer area
    setColor([254, 254, 254], "fill");
    doc.rect(x, y, width, height, "F");
    
    // Light border
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.2);
    doc.rect(x, y, width, height, "D");
  };

  // ============= Coordinate Grid Drawing =============
  const drawCoordinateGrid = (x: number, y: number, width: number, height: number) => {
    const cellSize = GRID_CELL_SIZE;
    
    // Light grid lines
    setColor([220, 220, 220], "draw");
    doc.setLineWidth(0.1);

    for (let i = 0; i <= Math.floor(width / cellSize); i++) {
      doc.line(x + i * cellSize, y, x + i * cellSize, y + height);
    }
    for (let i = 0; i <= Math.floor(height / cellSize); i++) {
      doc.line(x, y + i * cellSize, x + width, y + i * cellSize);
    }

    // Draw axes (thicker)
    doc.setLineWidth(0.5);
    setColor([80, 80, 80], "draw");
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
  };

  // ============= Draw Answer Area =============
  const drawAnswerArea = (areaType: 'blank' | 'lined' | 'grid' | 'none' | 'minimal', x: number, y: number, width: number, height: number) => {
    if (areaType === 'none') return;
    
    if (areaType === 'minimal') {
      // Just white space, no visual indicators
      return;
    }
    
    if (areaType === 'lined') {
      drawLinedArea(x, y, width, height);
    } else if (areaType === 'grid') {
      drawGridArea(x, y, width, height);
    } else {
      drawBlankArea(x, y, width, height);
    }
  };

  // ============= Draw Question in Free-Flow Style =============
  const drawQuestionFreeFlow = (question: ExamQuestion, isFirstOnPage: boolean) => {
    const questionNumber = question.question_number;
    const cleanedText = cleanLatexForPDF(question.question_text);
    const parsed = parseQuestionNumber(questionNumber);
    const isSubQuestion = parsed.sub !== '';
    
    // Question header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    
    // Format: "1." or "1a." with marks on right
    const questionLabel = isSubQuestion ? `(${parsed.sub})` : `${parsed.main}.`;
    const labelIndent = isSubQuestion ? MARGIN + 8 : MARGIN;
    
    doc.text(questionLabel, labelIndent, yPosition);
    
    if (showMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      doc.text(`(${question.marks})`, A4_WIDTH - MARGIN, yPosition, { align: "right" });
    }
    
    yPosition += 2;
    
    // Separator line under question number (only for main questions)
    if (!isSubQuestion) {
      setColor(COLORS.separator, "draw");
      doc.setLineWidth(0.3);
      doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
      yPosition += 6;
    } else {
      yPosition += 4;
    }
    
    // Question text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(COLORS.primary);
    
    const textIndent = isSubQuestion ? MARGIN + 12 : MARGIN;
    const textWidth = CONTENT_WIDTH - (isSubQuestion ? 12 : 0) - 15;
    const textLines = doc.splitTextToSize(cleanedText, textWidth);
    
    textLines.forEach((line: string) => {
      if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 20) {
        addNewPage();
      }
      doc.text(line, textIndent, yPosition);
      yPosition += LINE_HEIGHT;
    });
    
    yPosition += 4;
    
    // Handle MCQ options
    if (question.question_type === "MCQ" && question.options && Array.isArray(question.options)) {
      for (const option of question.options) {
        if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 15) {
          addNewPage();
        }
        
        // Draw empty circle for selection
        doc.setLineWidth(0.3);
        setColor(COLORS.secondary, "draw");
        doc.circle(textIndent + 4, yPosition - 1.5, 2.5);
        
        // Option text
        doc.setFontSize(10);
        setColor(COLORS.primary);
        const optionText = `${option.label})  ${cleanLatexForPDF(option.text)}`;
        const optionLines = doc.splitTextToSize(optionText, textWidth - 15);
        optionLines.forEach((line: string, idx: number) => {
          doc.text(line, textIndent + 12, yPosition + (idx * LINE_HEIGHT));
        });
        yPosition += Math.max(optionLines.length, 1) * LINE_HEIGHT + 2;
      }
      doc.setLineWidth(0.2);
    }
    // Handle sub-questions
    else if (question.sub_questions && question.sub_questions.length > 0) {
      for (const sub of question.sub_questions) {
        if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 30) {
          addNewPage();
        }
        
        // Sub-question label
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        setColor(COLORS.primary);
        doc.text(`(${sub.label})`, textIndent + 4, yPosition);
        
        if (showMarks) {
          doc.setFont("helvetica", "normal");
          setColor(COLORS.secondary);
          doc.text(`(${sub.marks})`, A4_WIDTH - MARGIN, yPosition, { align: "right" });
        }
        
        doc.setFont("helvetica", "normal");
        setColor(COLORS.primary);
        const subLines = doc.splitTextToSize(cleanLatexForPDF(sub.text), textWidth - 20);
        subLines.forEach((line: string, idx: number) => {
          doc.text(line, textIndent + 16, yPosition + (idx * LINE_HEIGHT));
        });
        yPosition += subLines.length * LINE_HEIGHT + 4;
        
        // Answer area for sub-question
        if (includeWorkingSpace) {
          const areaType = answerStyle || getAnswerAreaType(examData.subject, sub.marks, 'written');
          const minHeight = getMinAnswerHeight(sub.marks);
          const remainingSpace = getRemainingSpace();
          const areaHeight = Math.min(Math.max(minHeight, remainingSpace * 0.4), remainingSpace - 20);
          
          if (areaHeight > 15) {
            drawAnswerArea(areaType, textIndent + 4, yPosition, CONTENT_WIDTH - 12, areaHeight);
            yPosition += areaHeight + 8;
          }
        }
      }
    }
    // Handle graph/diagram/standard answer area
    else if (includeWorkingSpace && question.question_type !== "MCQ") {
      const areaType = answerStyle || getAnswerAreaType(examData.subject, question.marks, question.question_type);
      
      if (question.requires_graph) {
        const graphY = yPosition;
        const graphX = MARGIN + (CONTENT_WIDTH - GRID_WIDTH) / 2;
        drawCoordinateGrid(graphX, graphY, GRID_WIDTH, GRID_HEIGHT);
        yPosition += GRID_HEIGHT + 10;
      } else if (question.requires_diagram) {
        const diagramHeight = 60;
        setColor(COLORS.border, "draw");
        doc.setLineWidth(0.2);
        doc.rect(MARGIN, yPosition, CONTENT_WIDTH, diagramHeight, "D");
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        setColor(COLORS.muted);
        doc.text("Space for diagram", MARGIN + CONTENT_WIDTH / 2, yPosition + diagramHeight / 2, { align: "center" });
        yPosition += diagramHeight + 8;
      } else if (areaType !== 'none') {
        // Calculate dynamic height based on remaining space
        const minHeight = getMinAnswerHeight(question.marks);
        const remainingSpace = getRemainingSpace();
        // Fill most of remaining space, but cap at reasonable max
        const maxHeight = Math.min(remainingSpace - 10, 150);
        const areaHeight = Math.max(minHeight, maxHeight);
        
        if (areaHeight > 15) {
          drawAnswerArea(areaType, textIndent, yPosition, CONTENT_WIDTH - (isSubQuestion ? 8 : 0), areaHeight);
          yPosition += areaHeight + 8;
        }
      }
    }
  };

  // ============= Answer Key Section =============
  const drawAnswerKey = () => {
    addNewPage();

    // Header
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

    for (const question of sortedQuestions) {
      if (!question.correct_answer) continue;

      if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 20) {
        addNewPage();
      }

      const questionNum = question.question_number;
      doc.setFont("helvetica", "bold");
      setColor(COLORS.primary);
      doc.text(`Q${questionNum}:`, MARGIN, yPosition);

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
  drawHeader();

  // Track which main question we're on for page breaks
  let lastMainQuestion = -1;
  
  for (let i = 0; i < sortedQuestions.length; i++) {
    const question = sortedQuestions[i];
    const parsed = parseQuestionNumber(question.question_number);
    
    // Start new page for each new MAIN question (not sub-questions)
    const isNewMainQuestion = parsed.main !== lastMainQuestion;
    const isSubQuestion = parsed.sub !== '';
    
    if (isNewMainQuestion && !isSubQuestion && i > 0) {
      // New main question = new page
      addNewPage();
    }
    
    drawQuestionFreeFlow(question, i === 0 || isNewMainQuestion);
    
    if (!isSubQuestion) {
      lastMainQuestion = parsed.main;
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
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, "");
  cleaned = cleaned.replace(/[{}]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ");

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
