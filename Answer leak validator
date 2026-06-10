/**
 * Answer-leak validator — final programmatic safety net that runs on
 * generated questions JUST BEFORE they are inserted into the database.
 *
 * The generation prompts already tell the AI not to leak answers, but
 * prompt instructions are probabilistic. This module enforces the rules
 * in code so a slip by the model can never reach a student.
 *
 * Checks performed:
 *  1. GRAPH PLOTTING LEAK — if a curve in the DISPLAYED diagram/graph
 *     matches the expected answer curve, the matching series is removed
 *     from the displayed config (the student must draw it themselves).
 *  2. BLATANT TEXT LEAKS — strips patterns like "(Answer: ...)",
 *     "The answer is ...", "Correct answer: ..." from question text.
 *     "Show that…" / "Verify that…" questions are skipped because they
 *     legitimately state the result.
 *  3. MCQ MARKER LEAK — strips "(correct)" / "✓" style markers that the
 *     model occasionally writes into option text.
 *
 * Conservative by design: it only modifies questions when a leak is
 * detected with high confidence, and logs every action it takes.
 *
 * Usage (in generate-practice-questions/index.ts, before insert):
 *
 *   import { removeAnswerLeaks } from "../_shared/answer-leak-validator.ts";
 *   const leakReport = removeAnswerLeaks(questionsToInsert);
 *   if (leakReport.totalLeaksFixed > 0) {
 *     console.warn('Answer leaks fixed before insert:', JSON.stringify(leakReport.actions));
 *   }
 */
 
export interface LeakReport {
  totalLeaksFixed: number;
  actions: string[];
}
 
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
 
function safeParse(value: any): any {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}
 
type Point = { x: number; y: number };
 
function extractPoints(series: any): Point[] {
  if (!series) return [];
  const data = Array.isArray(series.data) ? series.data
    : Array.isArray(series.points) ? series.points
    : Array.isArray(series) ? series
    : [];
  return data
    .filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number')
    .map((p: any) => ({ x: p.x, y: p.y }));
}
 
/**
 * Fraction of `answer` points that also appear in `displayed`
 * (with a small numeric tolerance). 1.0 = every answer point is visible.
 */
function pointOverlap(answer: Point[], displayed: Point[]): number {
  if (answer.length === 0 || displayed.length === 0) return 0;
  const tol = 1e-6;
  let matched = 0;
  for (const a of answer) {
    if (displayed.some(d => Math.abs(d.x - a.x) < tol && Math.abs(d.y - a.y) < tol)) {
      matched++;
    }
  }
  return matched / answer.length;
}
 
/** Collect every candidate "answer curve" from a question's correct_answer. */
function collectAnswerCurves(correctAnswer: any): Point[][] {
  const parsed = safeParse(correctAnswer);
  if (!parsed) return [];
  const curves: Point[][] = [];
 
  const fromSeriesArray = (arr: any) => {
    if (Array.isArray(arr)) {
      for (const s of arr) {
        const pts = extractPoints(s);
        if (pts.length >= 2) curves.push(pts);
      }
    }
  };
 
  fromSeriesArray(parsed.series);
  fromSeriesArray(parsed.graphConfig?.series);
  if (parsed.expectedCurve) {
    const pts = extractPoints(parsed.expectedCurve);
    if (pts.length >= 2) curves.push(pts);
  }
  if (parsed.correct_chart_data) {
    fromSeriesArray(parsed.correct_chart_data.series);
    fromSeriesArray(parsed.correct_chart_data.graphConfig?.series);
  }
  return curves;
}
 
// ---------------------------------------------------------------------------
// Check 1 — graph plotting leak
// ---------------------------------------------------------------------------
 
const OVERLAP_THRESHOLD = 0.7; // 70%+ of answer points visible = leak
 
function fixGraphLeak(q: any, report: LeakReport): void {
  if (q.question_type !== 'graph_plotting') return;
 
  const answerCurves = collectAnswerCurves(q.correct_answer);
  if (answerCurves.length === 0) return;
 
  const diagram = safeParse(q.diagram_config);
  if (!diagram) return;
 
  // Displayed series can live at diagram.series or diagram.graphConfig.series
  const containers: Array<{ holder: any; key: string }> = [];
  if (Array.isArray(diagram.series)) containers.push({ holder: diagram, key: 'series' });
  if (Array.isArray(diagram.graphConfig?.series)) containers.push({ holder: diagram.graphConfig, key: 'series' });
 
  let removedAny = false;
  for (const { holder, key } of containers) {
    const kept: any[] = [];
    for (const displayedSeries of holder[key]) {
      const displayedPts = extractPoints(displayedSeries);
      const isLeak = answerCurves.some(ans => pointOverlap(ans, displayedPts) >= OVERLAP_THRESHOLD);
      if (isLeak) {
        removedAny = true;
        report.totalLeaksFixed++;
        report.actions.push(
          `Q${q.question_number}: removed displayed series "${displayedSeries?.label ?? displayedSeries?.id ?? 'unnamed'}" — matched answer curve (graph_plotting leak)`
        );
      } else {
        kept.push(displayedSeries);
      }
    }
    holder[key] = kept;
  }
 
  if (removedAny) {
    // Persist back in the same format it arrived in
    q.diagram_config = typeof q.diagram_config === 'string'
      ? JSON.stringify(diagram)
      : diagram;
  }
}
 
// ---------------------------------------------------------------------------
// Check 2 — blatant text leaks
// ---------------------------------------------------------------------------
 
// Questions that legitimately state the result
const SHOW_THAT_PATTERN = /\b(show|prove|verify|demonstrate|confirm)\s+that\b/i;
 
const TEXT_LEAK_PATTERNS: RegExp[] = [
  /\s*\((?:the\s+)?answer\s*[:=]?\s*[^)]*\)/gi,         // "(Answer: 42)"
  /\s*\[(?:the\s+)?answer\s*[:=]?\s*[^\]]*\]/gi,        // "[Answer: 42]"
  /\s*(?:the\s+)?correct\s+answer\s+is\s*[:=]?\s*\S[^.\n]*[.\n]?/gi, // "The correct answer is ..."
  /\s*answer\s*:\s*\S[^.\n]*[.\n]?$/gim,                // trailing "Answer: ..."
];
 
function fixTextLeak(q: any, report: LeakReport): void {
  const text = q.question_text;
  if (typeof text !== 'string' || text.length === 0) return;
  if (SHOW_THAT_PATTERN.test(text)) return; // legitimate
 
  let cleaned = text;
  for (const pattern of TEXT_LEAK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
 
  if (cleaned !== text) {
    report.totalLeaksFixed++;
    report.actions.push(`Q${q.question_number}: stripped answer reveal from question text`);
    q.question_text = cleaned.replace(/[ \t]{2,}/g, ' ').trim();
  }
}
 
// ---------------------------------------------------------------------------
// Check 3 — MCQ option markers
// ---------------------------------------------------------------------------
 
const MCQ_MARKER_PATTERN = /\s*[\(\[]\s*(?:correct|right answer|answer|✓|✔)\s*[\)\]]\s*$/i;
 
function fixMcqMarkers(q: any, report: LeakReport): void {
  if (q.question_type !== 'mcq') return;
  const options = safeParse(q.options);
  if (!Array.isArray(options)) return;
 
  let changed = false;
  const cleaned = options.map((opt: any) => {
    if (typeof opt === 'string' && MCQ_MARKER_PATTERN.test(opt)) {
      changed = true;
      return opt.replace(MCQ_MARKER_PATTERN, '').trim();
    }
    if (opt && typeof opt === 'object' && typeof opt.text === 'string' && MCQ_MARKER_PATTERN.test(opt.text)) {
      changed = true;
      return { ...opt, text: opt.text.replace(MCQ_MARKER_PATTERN, '').trim() };
    }
    return opt;
  });
 
  if (changed) {
    report.totalLeaksFixed++;
    report.actions.push(`Q${q.question_number}: stripped "(correct)" marker from MCQ option`);
    q.options = typeof q.options === 'string' ? JSON.stringify(cleaned) : cleaned;
  }
}
 
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
 
/**
 * Mutates the questions array in place, removing detected answer leaks.
 * Returns a report of every fix applied (for logging/monitoring).
 */
export function removeAnswerLeaks(questions: any[]): LeakReport {
  const report: LeakReport = { totalLeaksFixed: 0, actions: [] };
  if (!Array.isArray(questions)) return report;
 
  for (const q of questions) {
    try {
      fixGraphLeak(q, report);
      fixTextLeak(q, report);
      fixMcqMarkers(q, report);
    } catch (err) {
      // A validator bug must never break generation — log and continue.
      console.error(`Leak validator error on Q${q?.question_number}:`, err);
    }
  }
  return report;
}
 
