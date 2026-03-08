import ReactDOM from "react-dom/client";
import React from "react";

// jsPDF and html2canvas are dynamically imported only when needed
type jsPDFType = import("jspdf").default;

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
  diagram_type?: string | null;
  circuit_type?: string | null;
  circuit_description?: string | null;
  graph_description?: string | null;
  diagramConfig?: any;
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
  includeDiagrams?: boolean;
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
const HEADER_Y = 27;

const QUESTION_SPACING = 15;
const MIN_SPACE_FOR_QUESTION = 60;

const BIOLOGY_LINE_SPACING = 8;
const BIOLOGY_QUESTION_GAP = 12;
const BIOLOGY_SECTION_GAP = 18;

const GRID_CELL_SIZE = 5;
const GRID_WIDTH = 100;
const GRID_HEIGHT = 80;

const SUPERSCRIPT_SCALE = 0.7;
const SUBSCRIPT_SCALE = 0.7;
const SUPERSCRIPT_RISE = 2.0;
const SUBSCRIPT_DROP = 1.2;

const COLORS = {
  primary: [30, 30, 30] as const,
  secondary: [80, 80, 80] as const,
  muted: [120, 120, 120] as const,
  border: [180, 180, 180] as const,
  answerBoxBg: [248, 248, 250] as const,
  answerBoxBorder: [204, 204, 204] as const,
  separator: [180, 180, 180] as const,
  linedBg: [254, 254, 255] as const,
  tableHeader: [235, 235, 240] as const,
  answerKeyRed: [180, 30, 30] as const,
};

// ============= Strip Mark Scheme Codes =============
function stripMarkCodes(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s*\[(?:[MABC]\d+[, \s]*)+\]\s*/gi, ' ')
    .replace(/\[M\d+\]/g, '')
    .replace(/\[A\d+\]/g, '')
    .replace(/\[B\d+\]/g, '')
    .replace(/\[C\d+\]/g, '')
    .trim();
}

// ============= Format Units & Greek Letters =============
function formatUnits(text: string): string {
  if (!text) return '';
  let out = text;
  // Unit formatting — uses ^ notation for the baseline-shift renderer
  out = out.replace(/ms\^?-1\b/gi, 'ms^{-1}');
  out = out.replace(/ms\^?-2\b/gi, 'ms^{-2}');
  out = out.replace(/m\/s2?\b/g, 'ms^{-1}');
  out = out.replace(/kgm\^?-3\b/gi, 'kgm^{-3}');
  out = out.replace(/Nm\^?-2\b/gi, 'Nm^{-2}');
  // Greek letters to ASCII (rendered via the text engine)
  out = out.replace(/\balpha\b/gi, 'alpha');
  out = out.replace(/\bomega\b/gi, 'omega');
  out = out.replace(/\btheta\b/gi, 'theta');
  out = out.replace(/\bmu\b/gi, 'mu');
  out = out.replace(/\bsigma\b/gi, 'sigma');
  return out;
}

// ============= Answer Box Heights (marks-adaptive, in mm) =============
function getAnswerBoxHeight(marks: number): number {
  if (marks <= 1) return 15;
  if (marks <= 2) return 25;
  if (marks <= 3) return 35;
  if (marks <= 4) return 45;
  if (marks <= 6) return 60;
  return 80;
}

// ============= Dotted line count for biology-style answers =============
function getDottedLineCount(marks: number): number {
  if (marks <= 1) return 3;
  if (marks <= 2) return 5;
  if (marks <= 3) return 8;
  if (marks <= 4) return 10;
  if (marks <= 6) return 14;
  return Math.min(marks * 2 + 4, 24);
}

// ============= Parse Math Text into Segments =============
function parseMathSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  let currentNormal = '';

  while (i < text.length) {
    const char = text[i];

    if (char === '^' && i + 1 < text.length) {
      if (currentNormal) { segments.push({ type: 'normal', text: currentNormal }); currentNormal = ''; }
      i++;
      let content = '';
      if (text[i] === '{') { i++; let d = 1; while (i < text.length && d > 0) { if (text[i] === '{') d++; else if (text[i] === '}') d--; if (d > 0) content += text[i]; i++; } }
      else if (text[i] === '(') { i++; let d = 1; while (i < text.length && d > 0) { if (text[i] === '(') d++; else if (text[i] === ')') d--; if (d > 0) content += text[i]; i++; } }
      else { while (i < text.length && /[0-9a-zA-Z\-+]/.test(text[i])) { content += text[i]; i++; } }
      if (content) segments.push({ type: 'superscript', text: content });
      continue;
    }

    if (char === '_' && i + 1 < text.length) {
      const before = text.substring(Math.max(0, i - 10), i);
      const after = text.substring(i, Math.min(text.length, i + 10));
      if (before.includes('[') && after.includes('BLANK')) { currentNormal += char; i++; continue; }
      if (currentNormal) { segments.push({ type: 'normal', text: currentNormal }); currentNormal = ''; }
      i++;
      let content = '';
      if (text[i] === '{') { i++; let d = 1; while (i < text.length && d > 0) { if (text[i] === '{') d++; else if (text[i] === '}') d--; if (d > 0) content += text[i]; i++; } }
      else if (text[i] === '(') { i++; let d = 1; while (i < text.length && d > 0) { if (text[i] === '(') d++; else if (text[i] === ')') d--; if (d > 0) content += text[i]; i++; } }
      else if (/[0-9a-zA-Z]/.test(text[i])) { content = text[i]; i++; }
      if (content) segments.push({ type: 'subscript', text: content });
      continue;
    }

    currentNormal += char;
    i++;
  }

  if (currentNormal) segments.push({ type: 'normal', text: currentNormal });
  return segments;
}

// ============= Measure Math Text Width =============
function measureMathText(doc: jsPDF, text: string, baseFontSize: number): number {
  const segments = parseMathSegments(text);
  let totalWidth = 0;
  for (const seg of segments) {
    const scale = seg.type === 'normal' ? 1 : (seg.type === 'superscript' ? SUPERSCRIPT_SCALE : SUBSCRIPT_SCALE);
    doc.setFontSize(baseFontSize * scale);
    totalWidth += doc.getTextWidth(seg.text);
  }
  doc.setFontSize(baseFontSize);
  return totalWidth;
}

// ============= Render Math Text with Baseline Shifting =============
function renderMathText(doc: jsPDF, text: string, x: number, y: number, baseFontSize: number, color: readonly number[]): number {
  const segments = parseMathSegments(text);
  let currentX = x;
  doc.setCharSpace(0);

  for (const seg of segments) {
    doc.setTextColor(color[0], color[1], color[2]);
    if (seg.type === 'normal') {
      doc.setFontSize(baseFontSize);
      doc.text(seg.text, currentX, y);
      currentX += doc.getTextWidth(seg.text);
    } else if (seg.type === 'superscript') {
      doc.setFontSize(baseFontSize * SUPERSCRIPT_SCALE);
      doc.text(seg.text, currentX, y - SUPERSCRIPT_RISE);
      currentX += doc.getTextWidth(seg.text);
    } else {
      doc.setFontSize(baseFontSize * SUBSCRIPT_SCALE);
      doc.text(seg.text, currentX, y + SUBSCRIPT_DROP);
      currentX += doc.getTextWidth(seg.text);
    }
  }
  doc.setFontSize(baseFontSize);
  return currentX;
}

// ============= Word-Wrap Math Text =============
function wrapMathText(doc: jsPDF, text: string, maxWidth: number, baseFontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (measureMathText(doc, testLine, baseFontSize) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============= Extract Embedded Table =============
function extractEmbeddedTable(questionText: string): { cleanText: string; tableData: string | null; tableCaption: string | null } {
  if (!questionText) return { cleanText: '', tableData: null, tableCaption: null };

  let tableCaption: string | null = null;
  const captionMatch = questionText.match(/(?:^|\n|\s)(Table\s*\d*[:.]\s*[^\n|]+?)(?=\s*\||\s*$|\n)/i);
  if (captionMatch) tableCaption = captionMatch[1].trim();

  const lines = questionText.split('\n');
  let tableStartIdx = -1, tableEndIdx = -1, pipeLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const hasPipes = line.includes('|') && (line.split('|').length >= 3);
    const isSep = /^[|:\s-]+$/.test(line) && line.includes('-');
    if (hasPipes || isSep) {
      if (tableStartIdx === -1) tableStartIdx = i;
      tableEndIdx = i;
      if (hasPipes && !isSep) pipeLineCount++;
    } else if (tableStartIdx !== -1 && tableEndIdx !== -1) break;
  }

  if (pipeLineCount < 2) {
    if (questionText.includes('||') && questionText.includes('|')) {
      const m = questionText.match(/(\|[^|]+(?:\|[^|]+)+\|\|?(?:[^|]+\|)+)/);
      if (m) {
        const ts = questionText.indexOf(m[0]);
        let cleanText = (questionText.substring(0, ts).trim() + ' ' + questionText.substring(ts + m[0].length).trim()).trim();
        if (tableCaption) cleanText = cleanText.replace(tableCaption, '').trim();
        return { cleanText, tableData: m[0].replace(/\|\|/g, '\n'), tableCaption };
      }
    }
    return { cleanText: questionText, tableData: null, tableCaption: null };
  }

  const tableLines = lines.slice(tableStartIdx, tableEndIdx + 1);
  const beforeTable = lines.slice(0, tableStartIdx).join('\n').trim();
  const afterTable = lines.slice(tableEndIdx + 1).join('\n').trim();
  let cleanText = (beforeTable + ' ' + afterTable).trim();
  if (tableCaption) cleanText = cleanText.replace(tableCaption, '').trim();

  return { cleanText, tableData: tableLines.join('\n'), tableCaption };
}

// ============= Parse Embedded MCQ Options =============
function parseEmbeddedMCQOptions(questionText: string): { cleanText: string; options: { label: string; text: string }[] } {
  if (!questionText) return { cleanText: '', options: [] };
  const firstMatch = questionText.match(/(?:^|[\s?.!])\s*([A-E])\s*[\).:]\s*/i);
  if (!firstMatch) return { cleanText: questionText, options: [] };

  const matchIndex = questionText.indexOf(firstMatch[0]);
  const firstOptionIndex = matchIndex + firstMatch[0].toUpperCase().indexOf(firstMatch[1].toUpperCase());
  const cleanText = questionText.substring(0, firstOptionIndex).trim();
  const optionsPortion = questionText.substring(firstOptionIndex).trim();

  const parts: string[] = [];
  let currentPart = '';
  let i = 0;
  while (i < optionsPortion.length) {
    const remaining = optionsPortion.substring(i);
    const newOpt = remaining.match(/^([A-E])\s*[\).:]\s*/i);
    if (newOpt && (i === 0 || /\s/.test(optionsPortion[i - 1]))) {
      if (currentPart.trim()) parts.push(currentPart.trim());
      currentPart = '';
    }
    currentPart += optionsPortion[i];
    i++;
  }
  if (currentPart.trim()) parts.push(currentPart.trim());

  const options: { label: string; text: string }[] = [];
  for (const part of parts) {
    const m = part.match(/^([A-E])\s*[\).:]\s*(.+)$/is);
    if (m) options.push({ label: m[1].toUpperCase(), text: m[2].trim() });
  }

  return options.length >= 3 ? { cleanText, options } : { cleanText: questionText, options: [] };
}

// ============= Normalize MCQ options =============
type NormalizedMCQOption = { label: string; text: string };
function normalizeMCQOptions(rawOptions: unknown): NormalizedMCQOption[] {
  if (!rawOptions) return [];
  const labels = ["A", "B", "C", "D", "E"];
  if (Array.isArray(rawOptions)) {
    if (rawOptions.every(o => typeof o === "string")) {
      return (rawOptions as string[]).map((text, idx) => ({ label: labels[idx] ?? String.fromCharCode(65 + idx), text: String(text ?? "").trim() })).filter(o => o.text.length > 0);
    }
    if (rawOptions.every(o => typeof o === "object" && o !== null)) {
      return (rawOptions as any[]).map(o => ({ label: String(o?.label ?? o?.option ?? "").trim(), text: String(o?.text ?? o?.value ?? o?.statement ?? "").trim() })).filter(o => o.label.length > 0 && o.text.length > 0);
    }
    return [];
  }
  if (typeof rawOptions === "object") {
    const obj = rawOptions as Record<string, unknown>;
    const out: NormalizedMCQOption[] = [];
    for (const label of labels) { const v = obj[label]; if (typeof v === "string" && v.trim()) out.push({ label, text: v.trim() }); }
    return out;
  }
  return [];
}

// ============= Question Sorting & Grouping =============
function parseQuestionNumber(num: string): { main: number; sub: string; subOrder: number } {
  const match = num.trim().match(/^(\d+)([a-z]?)(?:\s*[.)]\s*([ivxlcdm]+)?)?$/i);
  if (!match) { const n = parseInt(num.trim()); return { main: isNaN(n) ? 0 : n, sub: '', subOrder: 0 }; }
  const main = parseInt(match[1]);
  const sub = (match[2] || '').toLowerCase();
  return { main, sub, subOrder: sub ? sub.charCodeAt(0) - 96 : 0 };
}

function sortQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  return [...questions].sort((a, b) => {
    const na = parseQuestionNumber(a.question_number), nb = parseQuestionNumber(b.question_number);
    return na.main !== nb.main ? na.main - nb.main : na.subOrder - nb.subOrder;
  });
}

function groupQuestionsByMain(questions: ExamQuestion[]): QuestionGroup[] {
  const sorted = sortQuestions(questions);
  const groups: QuestionGroup[] = [];
  let cur: QuestionGroup | null = null;
  for (const q of sorted) {
    const p = parseQuestionNumber(q.question_number);
    if (!cur || cur.mainNumber !== p.main) { if (cur) groups.push(cur); cur = { mainNumber: p.main, questions: [q], totalMarks: q.marks }; }
    else { cur.questions.push(q); cur.totalMarks += q.marks; }
  }
  if (cur) groups.push(cur);
  return groups;
}

// ============= Subject Detection =============
function getSubjectType(subject?: string): 'math' | 'science' | 'biology' | 'essay' | 'general' {
  if (!subject) return 'general';
  const s = subject.toLowerCase();
  if (['maths', 'mathematics', 'math', 'algebra', 'calculus', 'geometry', 'statistics'].some(k => s.includes(k))) return 'math';
  if (['biology', 'human biology'].some(k => s.includes(k))) return 'biology';
  if (['physics', 'chemistry'].some(k => s.includes(k))) return 'science';
  if (['english', 'history', 'literature', 'essay', 'geography', 'sociology', 'psychology', 'religious'].some(k => s.includes(k))) return 'essay';
  return 'general';
}

function getAnswerAreaType(subject?: string, _marks?: number, questionType?: string): 'blank' | 'lined' | 'grid' | 'none' | 'mcq_box' | 'dotted_lines' {
  if (questionType?.toLowerCase() === 'mcq') return 'mcq_box';
  const st = getSubjectType(subject);
  switch (st) {
    case 'math': return 'blank';
    case 'biology': return 'dotted_lines';
    case 'essay': return 'lined';
    case 'science': return 'blank';
    default: return 'blank';
  }
}

// ============= Diagram Rendering =============
async function renderDiagramToPDF(
  doc: jsPDF,
  diagramConfig: any,
  x: number,
  y: number,
  maxWidth: number,
): Promise<number> {
  try {
    const container = document.createElement('div');
    container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${maxWidth * 3.78}px;background:white;`;
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);

    // Dynamically import the correct diagram component
    let DiagramComponent: any = null;
    const type = diagramConfig.type || '';

    const mechanicsTypes = ['slope', 'free_body', 'projectile', 'beam', 'pulley', 'conical_pendulum', 'vertical_motion', 'rod', 'vertical_lift'];
    const circuitTypes = ['circuit', 'dual'];
    const biologyTypes = ['animal_cell', 'plant_cell', 'neuron', 'heart', 'dna_helix', 'mitosis'];
    const chemistryTypes = ['titration', 'reflux', 'electrolysis', 'dot_cross', 'chromatography'];

    if (mechanicsTypes.includes(type)) {
      const mod = await import('@/components/mechanics');
      DiagramComponent = mod.MechanicsDraw;
    } else if (circuitTypes.includes(type)) {
      const mod = await import('@/components/circuit');
      DiagramComponent = mod.CircuitDraw;
    } else if (biologyTypes.includes(type)) {
      const mod = await import('@/components/biology');
      DiagramComponent = mod.BiologyDiagramDraw;
    } else if (chemistryTypes.includes(type)) {
      const mod = await import('@/components/biology');
      DiagramComponent = mod.ChemistryDiagramDraw;
    }

    if (!DiagramComponent) {
      document.body.removeChild(container);
      return 0;
    }

    root.render(
      React.createElement(DiagramComponent, {
        config: diagramConfig,
        showLabels: true,
        labelMode: 'visible',
        scale: 1,
      })
    );

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 200));

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const aspectRatio = canvas.height / canvas.width;
    const imgHeight = maxWidth * aspectRatio;

    doc.addImage(imgData, 'PNG', x, y, maxWidth, imgHeight);

    root.unmount();
    document.body.removeChild(container);

    return imgHeight;
  } catch (error) {
    console.error('Diagram render failed:', error);
    return 0;
  }
}

// ============= Draw Empty Axes for Graph Questions =============
function drawEmptyAxes(doc: jsPDF, x: number, y: number, width: number, height: number, config?: any) {
  // Outer border
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);

  // Grid lines
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.1);
  const cols = 10, rows = 8;
  for (let i = 1; i < cols; i++) { const gx = x + (width / cols) * i; doc.line(gx, y, gx, y + height); }
  for (let i = 1; i < rows; i++) { const gy = y + (height / rows) * i; doc.line(x, gy, x + width, gy); }

  // Axes
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.4);
  const midX = x + width / 2, midY = y + height / 2;
  doc.line(midX, y + 2, midX, y + height - 2);
  doc.line(x + 2, midY, x + width - 2, midY);

  // Labels
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(config?.xLabel || 'x', x + width - 4, midY - 2);
  doc.text(config?.yLabel || 'y', midX + 2, y + 5);
}

// ============= Fill-in-Blank detection =============
function hasFillInBlanks(text: string): boolean {
  if (/\[\s*BLANK\s*\]/i.test(text)) return true;
  if (/_{5,}/.test(text)) return true;
  if (/\\underline\{[^}]*\}/.test(text)) return true;
  return false;
}

// ============= Text Sanitization =============
function sanitizeForPDF(text: string): string {
  let safe = text;
  safe = safe.replace(/&[A-Za-z0-9#]+;/g, entity => {
    const map: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&mdash;': '-', '&ndash;': '-', '&hellip;': '...', '&deg;': ' degrees', '&times;': 'x', '&divide;': '/', '&plusmn;': '+/-' };
    return map[entity] || '';
  });
  safe = safe.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  safe = safe.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  safe = safe.replace(/[""„‟]/g, '"');
  safe = safe.replace(/[''‚‛]/g, "'");
  safe = safe.replace(/\s+/g, ' ');
  return safe.trim();
}

// ============= Central LaTeX Cleaning =============
function cleanLatexForPDF(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // Step 1: Strip mark scheme codes
  cleaned = stripMarkCodes(cleaned);

  // Step 2: Format units
  cleaned = formatUnits(cleaned);

  // Step 3: Handle aligned/equation blocks
  cleaned = cleaned.replace(/\$\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}\$/g, (_, c) => c.replace(/\\\\/g, '  ').replace(/&/g, ' ').trim());
  cleaned = cleaned.replace(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/g, (_, c) => c.replace(/\\\\/g, '  ').replace(/&/g, ' ').trim());
  cleaned = cleaned.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, "$1");
  cleaned = cleaned.replace(/\\begin\{array\}(\{[^}]*\})?([\s\S]*?)\\end\{array\}/g, (_, _c, content) => (content || '').replace(/\\\\/g, '  ').replace(/&/g, ' ').trim());
  cleaned = cleaned.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, c) => c.replace(/\\\\/g, '  ').replace(/&/g, ' ').trim());
  cleaned = cleaned.replace(/\\begin\{[^}]+\}([\s\S]*?)\\end\{[^}]+\}/g, "$1");

  // Step 4: Strip math wrappers
  cleaned = cleaned.replace(/\$\$(.*?)\$\$/gs, "$1");
  cleaned = cleaned.replace(/\$(.*?)\$/g, "$1");
  cleaned = cleaned.replace(/\\\((.*?)\\\)/g, "$1");
  cleaned = cleaned.replace(/\\\[(.*?)\\\]/g, "$1");

  // Step 5: Handle fractions
  let prev = '';
  while (prev !== cleaned) { prev = cleaned; cleaned = cleaned.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)"); }

  // Step 6: sqrt
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  cleaned = cleaned.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, "$1-root($2)");

  // Step 7: Greek letters → ASCII
  const greeks: [RegExp, string][] = [
    [/\\pi\b/g, "pi"], [/\\alpha\b/g, "alpha"], [/\\beta\b/g, "beta"], [/\\gamma\b/g, "gamma"],
    [/\\delta\b/g, "delta"], [/\\epsilon\b/g, "epsilon"], [/\\theta\b/g, "theta"],
    [/\\lambda\b/g, "lambda"], [/\\mu\b/g, "mu"], [/\\sigma\b/g, "sigma"],
    [/\\omega\b/g, "omega"], [/\\phi\b/g, "phi"], [/\\psi\b/g, "psi"],
    [/\\rho\b/g, "rho"], [/\\tau\b/g, "tau"],
  ];
  for (const [rx, rep] of greeks) cleaned = cleaned.replace(rx, rep);

  // Also Unicode Greek → ASCII
  cleaned = cleaned.replace(/π/g, "pi").replace(/α/g, "alpha").replace(/β/g, "beta");
  cleaned = cleaned.replace(/γ/g, "gamma").replace(/δ/g, "delta").replace(/ε/g, "epsilon");
  cleaned = cleaned.replace(/θ/g, "theta").replace(/λ/g, "lambda").replace(/μ/g, "mu");
  cleaned = cleaned.replace(/σ/g, "sigma").replace(/ω/g, "omega").replace(/φ/g, "phi");

  // Step 8: Math operators
  cleaned = cleaned.replace(/\\times\b/g, "x").replace(/×/g, "x");
  cleaned = cleaned.replace(/\\div\b/g, "/").replace(/÷/g, "/");
  cleaned = cleaned.replace(/\\pm\b/g, "+/-").replace(/±/g, "+/-");
  cleaned = cleaned.replace(/\\cdot\b/g, ".").replace(/·/g, ".");
  cleaned = cleaned.replace(/\\leq\b/g, "<=").replace(/≤/g, "<=");
  cleaned = cleaned.replace(/\\geq\b/g, ">=").replace(/≥/g, ">=");
  cleaned = cleaned.replace(/\\neq\b/g, "!=").replace(/≠/g, "!=");
  cleaned = cleaned.replace(/\\approx\b/g, "~").replace(/≈/g, "~");
  cleaned = cleaned.replace(/\\rightarrow\b/g, "->").replace(/→/g, "->");
  cleaned = cleaned.replace(/°/g, " degrees");

  // Step 9: Functions
  cleaned = cleaned.replace(/\\sin\b/g, "sin").replace(/\\cos\b/g, "cos").replace(/\\tan\b/g, "tan");
  cleaned = cleaned.replace(/\\log\b/g, "log").replace(/\\ln\b/g, "ln").replace(/\\lim\b/g, "lim");

  // Step 10: Text commands
  cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, "$1").replace(/\\mathrm\{([^}]+)\}/g, "$1");
  cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, "$1").replace(/\\mathbf\{([^}]+)\}/g, "$1");

  // Step 11: Spacing
  cleaned = cleaned.replace(/\\quad/g, "  ").replace(/\\qquad/g, "    ");
  cleaned = cleaned.replace(/\\[,;!]/g, " ").replace(/\\ /g, " ");

  // Step 12: Remove remaining LaTeX
  cleaned = cleaned.replace(/\$/g, "");
  cleaned = cleaned.replace(/\\[a-zA-Z]+\{[^}]*\}/g, "");
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, "");

  // Step 13: Clean braces (but preserve ^{} and _{})
  cleaned = cleaned.replace(/(?<![_^])\{([^{}]*)\}/g, "$1");

  // Step 14: Unicode super/sub → ^{}/_{} notation
  const superMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n' };
  const subMap: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₋': '-', '₊': '+', 'ₙ': 'n' };

  const superRx = new RegExp(`[${Object.keys(superMap).join('')}]+`, 'g');
  cleaned = cleaned.replace(superRx, m => `^{${m.split('').map(c => superMap[c] || c).join('')}}`);
  const subRx = new RegExp(`[${Object.keys(subMap).join('')}]+`, 'g');
  cleaned = cleaned.replace(subRx, m => `_{${m.split('').map(c => subMap[c] || c).join('')}}`);

  cleaned = cleaned.replace(/\s+/g, " ");
  return sanitizeForPDF(cleaned);
}

// ============= MAIN PDF GENERATION =============
export async function generateExamPDF(
  examData: ExamData,
  options: PDFOptions = {}
): Promise<jsPDF> {
  const {
    includeAnswerKey = false,
    includeWorkingSpace = true,
    showMarks = true,
    answerStyle,
    includeDiagrams = true,
  } = options;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setCharSpace(0);

  let yPosition = MARGIN;
  let currentPage = 1;
  let figureCount = 1;

  const questionGroups = groupQuestionsByMain(examData.questions);
  const totalMarks = examData.questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  // ============= Helpers =============
  const setColor = (color: readonly number[], type: "text" | "draw" | "fill" = "text") => {
    if (type === "text") doc.setTextColor(color[0], color[1], color[2]);
    else if (type === "draw") doc.setDrawColor(color[0], color[1], color[2]);
    else doc.setFillColor(color[0], color[1], color[2]);
  };

  const addNewPage = () => { doc.addPage(); currentPage++; yPosition = MARGIN; doc.setCharSpace(0); };

  const getRemainingSpace = (): number => A4_HEIGHT - yPosition - FOOTER_HEIGHT;

  const ensureSpace = (needed: number) => { if (getRemainingSpace() < needed) addNewPage(); };

  // ============= Page Header (every page except cover) =============
  const drawPageHeader = () => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text(examData.title, MARGIN, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(COLORS.secondary);
    const rightText = [examData.subject, examData.qualification_level].filter(Boolean).join(' | ');
    if (rightText) doc.text(rightText, A4_WIDTH - MARGIN, 15, { align: "right" });

    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, HEADER_Y, A4_WIDTH - MARGIN, HEADER_Y);

    yPosition = HEADER_Y + 8;
  };

  // ============= Page Numbers & Footer =============
  const addPageNumbers = () => {
    const pageCount = doc.getNumberOfPages();
    const disclaimer = "Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board.";
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setCharSpace(0);

      setColor(COLORS.separator, "draw");
      doc.setLineWidth(0.3);
      doc.line(MARGIN, A4_HEIGHT - 18, A4_WIDTH - MARGIN, A4_HEIGHT - 18);

      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      setColor(COLORS.muted);
      doc.text(disclaimer, A4_WIDTH / 2, A4_HEIGHT - 14, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      if (i > 1) {
        doc.text(`Page ${i - 1} of ${pageCount - 1}`, A4_WIDTH / 2, A4_HEIGHT - 8, { align: "center" });
      }
    }
  };

  // ============= Format marks display =============
  const formatParentMarks = (marks: number): string => `[${marks} mark${marks !== 1 ? 's' : ''}]`;
  const formatSubMarks = (marks: number): string => `(${marks} mark${marks !== 1 ? 's' : ''})`;

  // ============= Cover Page =============
  const drawCoverPage = () => {
    yPosition = 50;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    const titleLines = doc.splitTextToSize(examData.title.toUpperCase(), CONTENT_WIDTH);
    titleLines.forEach((line: string, idx: number) => {
      doc.text(line, A4_WIDTH / 2, yPosition + idx * 9, { align: "center" });
    });
    yPosition += titleLines.length * 9 + 6;

    // Subject line
    if (examData.subject || examData.qualification_level) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "normal");
      setColor(COLORS.secondary);
      const parts = [examData.subject, examData.qualification_level].filter(Boolean);
      doc.text(parts.join('  ·  '), A4_WIDTH / 2, yPosition, { align: "center" });
      yPosition += 12;
    }

    // Separator
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(1);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 15;

    // Candidate info
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    setColor(COLORS.primary);

    doc.text("Candidate Name:", MARGIN, yPosition);
    setColor(COLORS.border, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN + 38, yPosition + 1, A4_WIDTH / 2 - 5, yPosition + 1);

    setColor(COLORS.primary);
    doc.text("Candidate Number:", A4_WIDTH / 2 + 5, yPosition);
    setColor(COLORS.border, "draw");
    doc.line(A4_WIDTH / 2 + 48, yPosition + 1, A4_WIDTH - MARGIN, yPosition + 1);
    yPosition += 15;

    // Separator
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 12;

    // Total marks & time
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.setFontSize(11);
    doc.text(`Total Marks: ${totalMarks}`, MARGIN, yPosition);
    if (examData.time_allowed) {
      doc.text(`Time: ${examData.time_allowed} minutes`, A4_WIDTH - MARGIN, yPosition, { align: "right" });
    }
    yPosition += 18;

    // Instructions
    const drawSection = (title: string, items: string[]) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      setColor(COLORS.primary);
      doc.text(title, MARGIN, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      for (const item of items) {
        doc.text("•", MARGIN + 3, yPosition);
        const lines = doc.splitTextToSize(item, CONTENT_WIDTH - 12);
        lines.forEach((line: string, idx: number) => { doc.text(line, MARGIN + 8, yPosition + idx * LINE_HEIGHT); });
        yPosition += lines.length * LINE_HEIGHT + 2;
      }
      yPosition += 6;
    };

    drawSection("Instructions", [
      "Use black ink or ball-point pen.",
      "Answer all questions.",
      "Answer the questions in the spaces provided — there may be more space than you need.",
      "Show all stages of your working clearly.",
      "Diagrams are NOT accurately drawn, unless otherwise indicated.",
    ]);

    drawSection("Information", [
      `This paper has ${questionGroups.length} questions.`,
      `The total mark for this paper is ${totalMarks}.`,
      "The marks for each question are shown in brackets — use this as a guide as to how much time to spend on each question.",
    ]);

    drawSection("Advice", [
      "Read each question carefully before you start to answer it.",
      "Try to answer every question.",
      "Check your answers if you have time at the end.",
    ]);

    // Generated date
    yPosition += 5;
    setColor(COLORS.separator, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 6;
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    setColor(COLORS.muted);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, MARGIN, yPosition);
    doc.text("Not affiliated with any exam board", A4_WIDTH - MARGIN, yPosition, { align: "right" });
  };

  // ============= Render Table =============
  const renderTable = (tableData: string, x: number, y: number, caption?: string | null): number => {
    if (!tableData) return y;
    let currentY = y + 10;

    let rows: string[][] = [];
    try {
      const parsed = JSON.parse(tableData);
      if (Array.isArray(parsed)) rows = parsed.map(r => Array.isArray(r) ? r.map(c => String(c || '')) : [String(r || '')]);
    } catch {
      let lines = tableData.split('\n').filter(l => l.trim());
      rows = lines.map(line => {
        if (line.includes('|')) { const cells = line.split('|'); if (cells[0]?.trim() === '') cells.shift(); if (cells[cells.length - 1]?.trim() === '') cells.pop(); return cells.map(c => c.trim()); }
        return [line.trim()];
      }).filter(r => r.length > 0 && !r.every(c => /^[-:]*$/.test(c)));
    }
    if (rows.length === 0) return y;

    rows = rows.map((row, ri) => row.map(cell => {
      let c = cleanLatexForPDF(cell);
      if (ri === 0 && c.length > 16) { const w = c.split(/\s+/); c = w.length > 2 ? w.slice(0, 2).join(' ') : c.substring(0, 14) + '...'; }
      return c;
    }));

    const maxCols = Math.max(...rows.map(r => r.length));
    const cellPadding = 4, rowHeight = 12;
    const colWidths: number[] = [];
    for (let j = 0; j < maxCols; j++) {
      let maxW = 25;
      for (const row of rows) { doc.setFontSize(9); maxW = Math.max(maxW, measureMathText(doc, row[j] || '', 9) + cellPadding * 2); }
      colWidths.push(maxW);
    }
    const total = colWidths.reduce((a, b) => a + b, 0);
    const maxTW = CONTENT_WIDTH - 20;
    if (total > maxTW) { const s = maxTW / total; for (let j = 0; j < colWidths.length; j++) colWidths[j] *= s; }

    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const totalH = (rows.length * rowHeight) + (caption ? 18 : 0) + 24;
    if (currentY + totalH > A4_HEIGHT - FOOTER_HEIGHT - 20) { addNewPage(); currentY = yPosition + 10; }

    if (caption) { doc.setFont("helvetica", "bold"); doc.setFontSize(10); setColor(COLORS.primary); doc.text(caption, x, currentY); currentY += LINE_HEIGHT + 4; }

    for (let i = 0; i < rows.length; i++) {
      const isH = i === 0, rowY = currentY;
      let cellX = x;
      for (let j = 0; j < maxCols; j++) {
        const cw = colWidths[j], ct = rows[i][j] || '';
        setColor(isH ? [230, 235, 245] : [255, 255, 255], "fill");
        doc.rect(cellX, rowY, cw, rowHeight, "F");
        setColor(COLORS.border, "draw");
        doc.setLineWidth(isH ? 0.5 : 0.3);
        doc.rect(cellX, rowY, cw, rowHeight, "D");
        doc.setFont("helvetica", isH ? "bold" : "normal");
        doc.setFontSize(9);
        renderMathText(doc, ct, cellX + cellPadding, rowY + rowHeight / 2 + 3, 9, COLORS.primary);
        cellX += cw;
      }
      currentY += rowHeight;
    }

    doc.setLineWidth(0.6); setColor(COLORS.border, "draw");
    doc.rect(x, currentY - rows.length * rowHeight, tableWidth, rows.length * rowHeight, "D");
    return currentY + 12;
  };

  // ============= Draw Dotted Lines =============
  const drawDottedLines = (x: number, y: number, width: number, numLines: number, marks?: number): number => {
    for (let i = 0; i < numLines; i++) {
      const lineY = y + (i * BIOLOGY_LINE_SPACING);
      if (lineY > A4_HEIGHT - FOOTER_HEIGHT - 5) { addNewPage(); return drawDottedLines(x, yPosition, width, numLines - i, i === numLines - 1 ? marks : undefined); }
      doc.setLineDashPattern([1, 2], 0);
      setColor(COLORS.border, "draw");
      doc.setLineWidth(0.3);
      doc.line(x, lineY, x + width - 15, lineY);
      if (i === numLines - 1 && marks) {
        doc.setLineDashPattern([], 0);
        setColor(COLORS.primary);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(formatSubMarks(marks), x + width, lineY, { align: "right" });
      }
    }
    doc.setLineDashPattern([], 0);
    return y + (numLines * BIOLOGY_LINE_SPACING) + 5;
  };

  // ============= Draw Answer Box =============
  const drawAnswerBox = (x: number, y: number, width: number, height: number, areaType: string, marks?: number): number => {
    if (areaType === 'none' || areaType === 'minimal') return y;

    if (areaType === 'mcq_box') {
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); setColor(COLORS.primary);
      doc.text("Your answer", x, y + 5);
      setColor(COLORS.answerBoxBorder, "draw"); doc.setLineWidth(0.5);
      doc.rect(x + 26, y, 12, 8, "D");
      if (marks) { doc.setFontSize(10); setColor(COLORS.primary); doc.text(formatSubMarks(marks), x + 42, y + 5); }
      return y + 14;
    }

    if (areaType === 'dotted_lines') {
      return drawDottedLines(x, y, width, getDottedLineCount(marks || 3), marks);
    }

    // Box answer area
    setColor(COLORS.answerBoxBg, "fill");
    doc.rect(x, y, width, height, "F");
    setColor(COLORS.answerBoxBorder, "draw");
    doc.setLineWidth(0.4);
    doc.rect(x, y, width, height, "D");

    doc.setFontSize(8); doc.setFont("helvetica", "italic"); setColor(COLORS.muted);
    const label = marks ? `Working space / Answer ${formatSubMarks(marks)}` : "Working space / Answer:";
    doc.text(label, x + 3, y + 5);

    if (areaType === 'lined') {
      const startY = y + 12, lineCount = Math.floor((height - 15) / 8);
      setColor([220, 220, 225], "draw"); doc.setLineWidth(0.15);
      for (let i = 0; i < lineCount; i++) doc.line(x + 3, startY + i * 8, x + width - 3, startY + i * 8);
    } else if (areaType === 'grid') {
      const startX = x + 3, startY = y + 12, gw = width - 6, gh = height - 15;
      setColor([230, 230, 235], "draw"); doc.setLineWidth(0.1);
      for (let i = 0; i <= Math.floor(gw / 5); i++) doc.line(startX + i * 5, startY, startX + i * 5, startY + gh);
      for (let i = 0; i <= Math.floor(gh / 5); i++) doc.line(startX, startY + i * 5, startX + gw, startY + i * 5);
    }

    return y + height;
  };

  // ============= Render question text lines =============
  const renderQuestionLines = (text: string, x: number, startY: number, maxWidth: number): number => {
    const lines = wrapMathText(doc, text, maxWidth, 10);
    let curY = startY;
    for (const line of lines) {
      if (curY > A4_HEIGHT - FOOTER_HEIGHT - 15) { addNewPage(); drawPageHeader(); curY = yPosition; }
      doc.setFont("helvetica", "normal");
      renderMathText(doc, line || '', x, curY, 10, COLORS.primary);
      curY += LINE_HEIGHT;
    }
    return curY;
  };

  // ============= Fill-in-blank rendering =============
  const renderTextWithBlanks = (text: string, startX: number, startY: number, maxWidth: number, marks?: number): number => {
    if (!text || !hasFillInBlanks(text)) {
      const lines = wrapMathText(doc, text || '', maxWidth, 10);
      let y = startY;
      for (const line of lines) {
        if (y > A4_HEIGHT - FOOTER_HEIGHT - 15) { addNewPage(); drawPageHeader(); y = yPosition; }
        doc.setFont("helvetica", "normal");
        renderMathText(doc, line || '', startX, y, 10, COLORS.primary);
        y += LINE_HEIGHT;
      }
      return y;
    }

    const BLANK_W = 30, BLANK_H = 6;
    const BLANK_REGEX = /\[\s*BLANK\s*\]/gi;
    const parts = text.split(BLANK_REGEX);
    const blankCount = (text.match(BLANK_REGEX) || []).length;
    let curX = startX, curY = startY;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);

    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        for (const word of parts[i].split(/\s+/).filter(w => w)) {
          const ww = measureMathText(doc, word + ' ', 10);
          if (curX + ww > startX + maxWidth) { curX = startX; curY += LINE_HEIGHT; if (curY > A4_HEIGHT - FOOTER_HEIGHT - 15) { addNewPage(); drawPageHeader(); curY = yPosition; } }
          curX = renderMathText(doc, word + ' ', curX, curY, 10, COLORS.primary);
        }
      }
      if (i < blankCount) {
        if (curX + BLANK_W + 5 > startX + maxWidth) { curX = startX; curY += LINE_HEIGHT; }
        setColor(COLORS.answerBoxBorder, "draw"); doc.setLineWidth(0.4);
        doc.rect(curX, curY - BLANK_H + 1.5, BLANK_W, BLANK_H, "D");
        setColor([250, 250, 252], "fill");
        doc.rect(curX + 0.2, curY - BLANK_H + 1.7, BLANK_W - 0.4, BLANK_H - 0.4, "F");
        curX += BLANK_W + 3;
      }
    }

    if (marks) { doc.setFontSize(10); setColor(COLORS.secondary); doc.text(formatSubMarks(marks), startX + maxWidth + 5, curY); }
    return curY + LINE_HEIGHT + 2;
  };

  // ============= Draw a single question group =============
  const drawQuestionGroup = async (group: QuestionGroup) => {
    // Question number header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(COLORS.primary);
    doc.text(`Question ${group.mainNumber}`, MARGIN, yPosition);

    if (showMarks) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setColor(COLORS.secondary);
      doc.text(formatParentMarks(group.totalMarks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
    }

    yPosition += 3;
    setColor(COLORS.separator, "draw"); doc.setLineWidth(0.3);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 8;

    for (let i = 0; i < group.questions.length; i++) {
      const question = group.questions[i];
      const parsed = parseQuestionNumber(question.question_number);
      const isSubQ = parsed.sub !== '';

      const tableExtract = extractEmbeddedTable(question.question_text);
      let cleanedText = cleanLatexForPDF(tableExtract.cleanText);

      if (i > 0) ensureSpace(40);
      if (getRemainingSpace() < 40) {
        addNewPage(); drawPageHeader();
        doc.setFontSize(10); doc.setFont("helvetica", "italic"); setColor(COLORS.muted);
        doc.text(`Question ${group.mainNumber} continued`, MARGIN, yPosition);
        yPosition += 10;
      }

      const textIndent = isSubQ ? MARGIN + 10 : MARGIN + 8;
      const baseTextWidth = CONTENT_WIDTH - (isSubQ ? 20 : 15);

      // Sub-question label
      if (isSubQ) {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); setColor(COLORS.primary);
        doc.text(`(${parsed.sub})`, MARGIN + 5, yPosition);
        if (showMarks && question.marks) {
          doc.setFont("helvetica", "normal"); setColor(COLORS.secondary);
          doc.text(formatSubMarks(question.marks), A4_WIDTH - MARGIN, yPosition, { align: "right" });
        }
        yPosition += 6;
      }

      // MCQ options
      let mcqOptions = normalizeMCQOptions(question.options);
      const parsedMCQ = parseEmbeddedMCQOptions(cleanedText);
      if (parsedMCQ.options.length >= 3) { cleanedText = parsedMCQ.cleanText; mcqOptions = parsedMCQ.options; }
      const isMCQ = mcqOptions.length >= 3;

      // Table data
      if (tableExtract.tableData) yPosition = renderTable(tableExtract.tableData, textIndent, yPosition, tableExtract.tableCaption);
      if (question.table_data) yPosition = renderTable(question.table_data, textIndent, yPosition);

      // Question text
      const isFillInBlank = hasFillInBlanks(cleanedText);
      const textWidth = baseTextWidth - 5;

      if (isFillInBlank) {
        yPosition = renderTextWithBlanks(cleanedText, textIndent, yPosition, textWidth, question.marks);
      } else {
        yPosition = renderQuestionLines(cleanedText, textIndent, yPosition, textWidth);
        yPosition += 3;
      }

      // ============= DIAGRAM RENDERING =============
      if (includeDiagrams && question.diagramConfig) {
        ensureSpace(80);
        const diagramWidth = CONTENT_WIDTH * 0.6;
        const diagramX = MARGIN + (CONTENT_WIDTH - diagramWidth) / 2;
        const diagramHeight = await renderDiagramToPDF(doc, question.diagramConfig, diagramX, yPosition, diagramWidth);

        if (diagramHeight > 0) {
          // Figure caption
          doc.setFontSize(8); doc.setFont("helvetica", "italic"); setColor(COLORS.muted);
          doc.text(`Figure ${figureCount}`, MARGIN + CONTENT_WIDTH / 2, yPosition + diagramHeight + 3, { align: "center" });
          figureCount++;
          yPosition += diagramHeight + 8;
        }
      }

      // Graph axes for graph questions
      if (question.requires_graph || ['graph_sketch', 'graph_plotting'].includes(question.question_type)) {
        ensureSpace(GRID_HEIGHT + 15);
        const graphX = MARGIN + (CONTENT_WIDTH - GRID_WIDTH) / 2;
        drawEmptyAxes(doc, graphX, yPosition, GRID_WIDTH, GRID_HEIGHT, question.graph_range ? {
          xLabel: 'x', yLabel: 'y'
        } : undefined);
        yPosition += GRID_HEIGHT + 10;
      }

      // MCQ answer box
      if (isMCQ) {
        yPosition += 2;
        for (const opt of mcqOptions) {
          if (!opt) continue;
          if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 10) { addNewPage(); drawPageHeader(); }
          const letter = String(opt.label).trim().replace(/[^A-E]/gi, '').toUpperCase();
          const optText = cleanLatexForPDF(String(opt.text));
          if (!letter || !optText.trim()) continue;

          doc.setFont("helvetica", "bold"); doc.setFontSize(10); setColor(COLORS.primary);
          doc.text(`${letter})`, textIndent + 3, yPosition);

          doc.setFont("helvetica", "normal");
          const optLines = wrapMathText(doc, optText, baseTextWidth - 18, 10);
          optLines.forEach((line: string, idx: number) => { renderMathText(doc, line || '', textIndent + 12, yPosition + idx * LINE_HEIGHT, 10, COLORS.primary); });
          yPosition += Math.max(optLines.length, 1) * LINE_HEIGHT + 4;
        }
        yPosition += 2;
        drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 10, 0, 'mcq_box', question.marks);
        yPosition += 8;
      }
      // Sub questions
      else if (question.sub_questions && question.sub_questions.length > 0) {
        for (const sub of question.sub_questions) {
          ensureSpace(40);
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); setColor(COLORS.primary);
          doc.text(`(${sub.label})`, textIndent, yPosition);
          if (showMarks && sub.marks) { doc.setFont("helvetica", "normal"); setColor(COLORS.secondary); doc.text(formatSubMarks(sub.marks), A4_WIDTH - MARGIN, yPosition, { align: "right" }); }
          yPosition += 6;

          doc.setFont("helvetica", "normal");
          yPosition = renderQuestionLines(cleanLatexForPDF(sub.text || ''), textIndent + 10, yPosition, baseTextWidth - 15);
          yPosition += 4;

          if (includeWorkingSpace) {
            const aType = answerStyle || getAnswerAreaType(examData.subject, sub.marks, 'written');
            if (aType === 'dotted_lines') { yPosition = drawDottedLines(textIndent, yPosition, CONTENT_WIDTH - 15, getDottedLineCount(sub.marks), sub.marks); }
            else { const h = getAnswerBoxHeight(sub.marks); yPosition = drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 15, h, aType, sub.marks); }
            yPosition += BIOLOGY_QUESTION_GAP;
          }
        }
      }
      // Standard answer space
      else if (includeWorkingSpace && !isMCQ && !isFillInBlank) {
        const aType = answerStyle || getAnswerAreaType(examData.subject, question.marks, question.question_type);
        if (aType !== 'none' && aType !== 'mcq_box') {
          if (aType === 'dotted_lines') {
            yPosition = drawDottedLines(textIndent, yPosition, CONTENT_WIDTH - 15, getDottedLineCount(question.marks), question.marks);
          } else {
            const h = getAnswerBoxHeight(question.marks);
            yPosition = drawAnswerBox(textIndent, yPosition, CONTENT_WIDTH - 15, h, aType, question.marks);
          }
          yPosition += BIOLOGY_QUESTION_GAP;
        }
      }
    }

    // Total for question
    if (group.questions.length > 1) {
      ensureSpace(15);
      yPosition += 3;
      doc.setFontSize(9); doc.setFont("helvetica", "italic"); setColor(COLORS.secondary);
      doc.text(`(Total for Question ${group.mainNumber} = ${formatParentMarks(group.totalMarks)})`, A4_WIDTH / 2, yPosition, { align: "center" });
      yPosition += 8;
    }
  };

  // ============= Answer Key =============
  const drawAnswerKey = () => {
    addNewPage(); drawPageHeader();

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.answerKeyRed[0], COLORS.answerKeyRed[1], COLORS.answerKeyRed[2]);
    doc.text("ANSWER KEY", A4_WIDTH / 2, yPosition, { align: "center" });
    yPosition += 8;

    setColor(COLORS.separator, "draw"); doc.setLineWidth(0.5);
    doc.line(MARGIN, yPosition, A4_WIDTH - MARGIN, yPosition);
    yPosition += 10;

    doc.setFontSize(10); doc.setFont("helvetica", "normal");

    for (const question of sortQuestions(examData.questions)) {
      if (!question.correct_answer) continue;
      if (yPosition > A4_HEIGHT - FOOTER_HEIGHT - 15) { addNewPage(); drawPageHeader(); }

      setColor(COLORS.primary);
      doc.setFont("helvetica", "bold");
      doc.text(`${question.question_number}.`, MARGIN, yPosition);

      doc.setFont("helvetica", "normal");
      // In answer key, preserve mark codes
      const answerText = cleanLatexForPDF(question.correct_answer);
      const answerLines = wrapMathText(doc, answerText, CONTENT_WIDTH - 20, 10);
      answerLines.forEach((line: string, idx: number) => {
        renderMathText(doc, line || '', MARGIN + 15, yPosition + idx * LINE_HEIGHT, 10, COLORS.primary);
      });

      yPosition += Math.max(answerLines.length, 1) * LINE_HEIGHT + 4;
    }
  };

  // ============= GENERATE PDF =============
  // Page 1: Cover
  drawCoverPage();

  // Question pages
  const subjectType = getSubjectType(examData.subject);

  for (let i = 0; i < questionGroups.length; i++) {
    if (subjectType === 'math') {
      addNewPage(); drawPageHeader();
      await drawQuestionGroup(questionGroups[i]);
    } else {
      if (i === 0 || getRemainingSpace() < MIN_SPACE_FOR_QUESTION) {
        addNewPage(); drawPageHeader();
      }
      await drawQuestionGroup(questionGroups[i]);
      yPosition += subjectType === 'biology' ? BIOLOGY_SECTION_GAP : QUESTION_SPACING;
    }
  }

  if (includeAnswerKey) drawAnswerKey();

  addPageNumbers();

  return doc;
}

// ============= Preview Helper =============
export async function generateExamPDFPreview(examData: ExamData, options: PDFOptions = {}): Promise<string> {
  const doc = await generateExamPDF(examData, options);
  return doc.output('datauristring');
}

// ============= Download Helper =============
export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

// ============= Open in New Tab =============
export function openPDFInNewTab(doc: jsPDF): void {
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

// ============= Direct download from ExamData =============
export async function downloadExamPDF(examData: ExamData, filename: string, options: PDFOptions = {}): Promise<void> {
  const doc = await generateExamPDF(examData, options);
  doc.save(filename);
}
