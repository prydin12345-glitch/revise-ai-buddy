/**
 * Board Reference Utility
 * 
 * Manages exam board names, style instructions for AI prompts,
 * and legal disclaimers. Real board names are used throughout
 * under nominative fair use, with clear non-affiliation disclaimers.
 * 
 * IMPORTANT: This operates ONLY on text strings. It must NOT be applied to
 * graphConfig, expectedPath, plottingAnswer, table_data, content_json, or
 * any numeric/coordinate data.
 */

/**
 * The scrubBoardReferences function has been retired.
 * Board names are now displayed under nominative fair use with disclaimers.
 * This passthrough is kept for backward-compatibility with any callers.
 */
export function scrubBoardReferences(text: string): string {
  return text;
}

/**
 * Translate an internal exam board ID into a specific style instruction
 * for use in AI prompts. The AI now receives the actual board name
 * so it can generate board-accurate content.
 */
export function translateBoardForPrompt(boardId: string): string {
  const map: Record<string, string> = {
    aqa: "Generate content according to the AQA specification. Use AQA-specific command words (evaluate, explain, compare, give) and AO1/AO2/AO3 mark allocation structure.",
    edexcel: "Generate content according to the Pearson Edexcel specification. Use Edexcel-style data-response and multi-part questions with emphasis on application and analysis.",
    ocr: "Generate content according to the OCR specification. Use OCR command terms (show that, determine, describe) with structured response format and synoptic assessment.",
    cie: "Generate content according to the Cambridge International (CAIE/IGCSE) specification. Use Cambridge-style structured data response and essay-type questions.",
    wjec: "Generate content according to the WJEC specification. Use WJEC structured mark schemes with Welsh context where appropriate.",
    ib: "Generate content according to the International Baccalaureate (IB) programme specification. Use IB internal assessment style and extended response questions.",
    college_board: "Generate content according to the College Board (AP/SAT) specification. Use College Board-style multiple-choice and free-response sections.",
  };

  return map[boardId?.toLowerCase()] || `Generate content in the style of: ${boardId}`;
}

/**
 * The exam board options for frontend dropdowns.
 * Now showing real board names under nominative fair use.
 * Internal IDs remain unchanged for database compatibility.
 */
export const EXAM_BOARD_OPTIONS = [
  { id: "aqa", name: "AQA" },
  { id: "edexcel", name: "Pearson Edexcel" },
  { id: "ocr", name: "OCR" },
  { id: "cie", name: "Cambridge International (CAIE)" },
  { id: "ib", name: "International Baccalaureate (IB)" },
  { id: "wjec", name: "WJEC" },
  { id: "college_board", name: "College Board (AP/SAT)" },
  { id: "cbse", name: "CBSE (India)" },
  { id: "icse", name: "ICSE (India)" },
  { id: "ncea", name: "NCEA (New Zealand)" },
  { id: "vce", name: "VCE (Victoria, Australia)" },
  { id: "hsc", name: "HSC (NSW, Australia)" },
  { id: "leaving_cert", name: "Leaving Certificate (Ireland)" },
  { id: "other", name: "Other" },
];

/**
 * Get a human-readable board name from an ID.
 */
export function getBoardDisplayName(boardId: string | null | undefined): string {
  if (!boardId) return '';
  const found = EXAM_BOARD_OPTIONS.find(b => b.id === boardId);
  return found?.name || boardId;
}

/**
 * Tooltip text for the exam board selector.
 */
export const BOARD_SELECTOR_TOOLTIP =
  "Select the exam board whose question style and mark scheme format you'd like to follow. Examly is independently operated and not affiliated with any examination board.";

/**
 * Content authenticity disclaimer for quiz/exam footers and PDF exports.
 * Now includes specific board names for legal clarity.
 */
export const CONTENT_DISCLAIMER =
  "AI-generated practice content by Examly. Not affiliated with or endorsed by AQA, OCR, Pearson Edexcel, WJEC, Cambridge Assessment, the College Board, or the International Baccalaureate Organization.";

/**
 * Declaration checkbox text for upload forms.
 */
export const UPLOAD_DECLARATION =
  "I confirm I have lawful access to this material and am using it for private study and non-commercial educational purposes only.";

/**
 * Build a dynamic non-affiliation disclaimer based on the boards in context.
 */
export function buildDynamicDisclaimer(boardIds?: string[]): string {
  const allBoards = ["AQA", "OCR", "Pearson Edexcel", "WJEC", "Cambridge Assessment International Education", "the College Board", "the International Baccalaureate Organization"];
  
  if (boardIds && boardIds.length > 0) {
    const names = boardIds
      .map(id => getBoardDisplayName(id))
      .filter(Boolean);
    if (names.length > 0) {
      return `Examly is an independent study platform. We are not affiliated with, endorsed by, or connected to ${names.join(', ')}. All content is AI-generated original material for educational practice.`;
    }
  }
  
  return `Examly is an independent study platform. We are not affiliated with, endorsed by, or connected to ${allBoards.join(', ')}. All content is AI-generated original material for educational practice.`;
}

/**
 * Detect if a title contains board names + year codes that might imply
 * we are hosting official papers. Returns a warning message or null.
 */
export function checkTitleForBoardReferences(title: string): string | null {
  if (!title) return null;

  const boardPatterns = [/\bAQA\b/i, /\bEdexcel\b/i, /\bOCR\b/i, /\bWJEC\b/i, /\bCIE\b/i, /\bCambridge\b/i];
  const hasBoardName = boardPatterns.some(p => p.test(title));
  const hasYearCode = /\b(20\d{2}|19\d{2})\b/.test(title);

  if (hasBoardName && hasYearCode) {
    return "Tip: Titles referencing specific boards and years may imply official past papers. Consider adding 'Practice' or 'Mock' to clarify this is original content.";
  }
  return null;
}
