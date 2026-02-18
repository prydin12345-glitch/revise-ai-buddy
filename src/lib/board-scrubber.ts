/**
 * Board Scrubber Utility
 * 
 * Removes trademarked exam board names, session/year codes, and original
 * question references from AI-generated text. Used in both frontend (PDF
 * export) and backend (edge function post-processing).
 * 
 * IMPORTANT: This operates ONLY on text strings. It must NOT be applied to
 * graphConfig, expectedPath, plottingAnswer, table_data, content_json, or
 * any numeric/coordinate data.
 */

// Exam board name patterns (case-insensitive)
const BOARD_NAME_PATTERNS = [
  /\bAQA\b/gi,
  /\bEdexcel\b/gi,
  /\bOCR\b/gi,
  /\bWJEC\b/gi,
  /\bPearson\b/gi,
  /\bCambridge\s+International\b/gi,
  /\bCIE\b/gi,
  /\bCambridge\s+Assessment\b/gi,
  /\bSQA\b/gi,
  /\bCCEA\b/gi,
];

// Session/year code patterns
const SESSION_YEAR_PATTERNS = [
  // "June 2023", "Jan 2011", "November 2022", "May/June 2024"
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s*\/?\s*(January|February|March|April|May|June|July|August|September|October|November|December)?\s+\d{4}\b/gi,
  // "Paper 1 2022", "Paper 2 2023"
  /\bPaper\s+\d+\s+\d{4}\b/gi,
  // Standalone session identifiers like "(Jan 2011)" or "[June 2023]"
  /[\[(]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[\])]/gi,
];

// Original question reference patterns
const QUESTION_REF_PATTERNS = [
  // "Question 21a", "Q3(b)(ii)", "Q5a from Paper 2"
  /\bQ(?:uestion)?\s*\d+\s*[a-z]?\s*(?:\([a-z]+\)\s*)*(?:\([ivxlcdm]+\)\s*)*(?:from\s+Paper\s+\d+)?/gi,
  // "from Paper 2", "Paper 1 Q3"
  /\bfrom\s+Paper\s+\d+/gi,
  // "Adapted from AQA 2023" or "Source: Edexcel Paper 1"
  /\b(?:Adapted|Taken|Sourced?)\s+from\s+(?:AQA|Edexcel|OCR|WJEC|CIE|Pearson|Cambridge)[^.]*\./gi,
];

/**
 * Remove trademarked board references, session codes, and question references
 * from the given text. Safe to apply to question_text, feedback, and
 * correct_answer (when it is a plain string).
 */
export function scrubBoardReferences(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // Strip board names
  for (const pattern of BOARD_NAME_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Strip session/year codes
  for (const pattern of SESSION_YEAR_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Strip question references
  for (const pattern of QUESTION_REF_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Clean up artefacts: double spaces, leading/trailing commas, empty parens
  result = result
    .replace(/\(\s*\)/g, '')       // empty parentheses
    .replace(/\[\s*\]/g, '')       // empty brackets
    .replace(/\s{2,}/g, ' ')       // collapse whitespace
    .replace(/,\s*,/g, ',')        // double commas
    .replace(/^\s*[,;·]\s*/gm, '') // leading punctuation on line
    .trim();

  return result;
}

/**
 * Translate an internal exam board ID into a generic style description
 * for use in AI prompts. The AI never sees the actual trademarked name.
 */
export function translateBoardForPrompt(boardId: string): string {
  const map: Record<string, string> = {
    aqa: "UK exam board using command verbs like 'evaluate', 'explain', 'compare'; structured mark schemes with AO1/AO2/AO3 weighting",
    edexcel: "UK exam board (Pearson style) with data-response and multi-part questions; emphasis on application and analysis",
    ocr: "UK exam board with structured response format and synoptic assessment; clear command terms",
    cie: "International exam board (Cambridge style) with structured data response and essay-type questions",
    wjec: "Welsh exam board with structured mark schemes; emphasis on Welsh context where appropriate",
    ib: "International Baccalaureate programme with internal assessment style and extended response questions",
    college_board: "US standardized testing style (College Board) with multiple-choice and free-response sections",
  };

  return map[boardId?.toLowerCase()] || `Exam board style: ${boardId}`;
}

/**
 * The rebranded exam board labels for frontend dropdowns.
 * Internal IDs remain unchanged for database compatibility.
 */
export const EXAM_BOARD_OPTIONS = [
  { id: "aqa", name: "UK Board A (command-verb style)" },
  { id: "edexcel", name: "UK Board B (Pearson style)" },
  { id: "ocr", name: "UK Board C (structured response)" },
  { id: "cie", name: "International Board (Cambridge style)" },
  { id: "ib", name: "IB Programme" },
  { id: "wjec", name: "Welsh Board (WJEC style)" },
  { id: "college_board", name: "US Board (College Board style)" },
  { id: "other", name: "Other" },
];

/**
 * Tooltip text for the exam board selector.
 */
export const BOARD_SELECTOR_TOOLTIP =
  "Board selection determines question style, command verbs, and mark scheme format. We are not affiliated with any examination board.";

/**
 * Content authenticity disclaimer for quiz/exam footers and PDF exports.
 */
export const CONTENT_DISCLAIMER =
  "Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board.";

/**
 * Declaration checkbox text for upload forms.
 */
export const UPLOAD_DECLARATION =
  "I confirm I have lawful access to this material and am using it for private study and non-commercial educational purposes only.";

/**
 * Detect if a title contains board names + year codes that might imply
 * we are hosting official papers. Returns a warning message or null.
 */
export function checkTitleForBoardReferences(title: string): string | null {
  if (!title) return null;

  const hasBoardName = BOARD_NAME_PATTERNS.some((p) => p.test(title));
  // Reset lastIndex after test
  BOARD_NAME_PATTERNS.forEach((p) => (p.lastIndex = 0));

  const hasYearCode = /\b(20\d{2}|19\d{2})\b/.test(title);

  if (hasBoardName && hasYearCode) {
    return "Tip: Consider using a generic title (e.g. \"Physics Mock 1\") instead of referencing specific exam boards and years.";
  }
  if (hasBoardName) {
    return "Tip: Board names are used internally for style matching only. Consider a generic title.";
  }
  return null;
}
