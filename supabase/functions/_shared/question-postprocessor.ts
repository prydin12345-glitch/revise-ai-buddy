/**
 * Post-processing utilities for generated practice questions.
 * Handles question type remapping, validation, and table grid fixes.
 * Extracted from generate-practice-questions/index.ts for maintainability.
 */

/** Remap invalid question types the AI sometimes invents */
export const questionTypeRemap: Record<string, string> = {
  'numeric': 'short_answer',
  'numeric_entry': 'short_answer',
  'numeric_response': 'short_answer',
  'fill_in_blank': 'short_answer',
  'calculation': 'short_answer',
  'standard': 'short_answer',
  'open_ended': 'extended',
  'long_answer': 'extended',
  'free_response': 'extended',
  'essay': 'extended',
  'extended_response': 'extended',
  'multiple_choice': 'mcq',
  'true_false': 'mcq',
};

export const validQuestionTypes = [
  'short_answer', 'extended', 'mcq', 'table_grid',
  'graph_interpretation', 'graph_plotting', 'graph_transformation'
];

/** Fix invalid question types in generated questions */
export function remapQuestionTypes(questions: any[]): void {
  for (const q of questions) {
    if (q.question_type && questionTypeRemap[q.question_type]) {
      console.warn(`Remapping invalid question_type "${q.question_type}" -> "${questionTypeRemap[q.question_type]}"`);
      q.question_type = questionTypeRemap[q.question_type];
    } else if (q.question_type && !validQuestionTypes.includes(q.question_type)) {
      const fallback = (q.marks && q.marks >= 6) ? 'extended' : 'short_answer';
      console.warn(`Unknown question_type "${q.question_type}" -> fallback "${fallback}"`);
      q.question_type = fallback;
    }
  }
}

/** Sanitize LaTeX in table headers - convert to plain text */
export function sanitizeTableHeaders(headers: string[]): string[] {
  return headers.map((h: string) => {
    return h
      .replace(/\$?\s*s\^?\{?-1\}?\s*\$?/g, 's⁻¹')
      .replace(/\$?\s*cm\^?\{?3\}?\s*\$?/g, 'cm³')
      .replace(/\$?\s*m\^?\{?2\}?\s*\$?/g, 'm²')
      .replace(/\$?\s*dm\^?\{?-3\}?\s*\$?/g, 'dm⁻³')
      .replace(/\$?\s*mol\s*[·.]\s*dm\^?\{?-3\}?\s*\$?/g, 'mol·dm⁻³')
      .replace(/\$([^$]+)\$/g, '$1');
  });
}

/** Extract base function from question text */
export function extractBaseFunctionFromText(text: string): string | null {
  const fxMatch = text.match(/[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*([^,.]+?)(?:[,.]|is\s+shown|\s+has|\s+where|$)/i);
  if (fxMatch) return fxMatch[1].trim();
  const yMatch = text.match(/y\s*=\s*([^,]+?)(?:[,.]|is\s+shown|\s+has|$)/i);
  if (yMatch && !/[a-zA-Z]\(x\)/.test(yMatch[1])) return yMatch[1].trim();
  return null;
}

/** Extract a polynomial formula from a textual algebraic answer */
export function extractFormulaFromAlgebraicAnswer(answer: string): string | null {
  if (!answer || typeof answer !== 'string') return null;
  const match = answer.match(/[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*(.+)/i);
  if (match) return match[1].trim();
  const yMatch = answer.match(/y\s*=\s*(.+)/i);
  if (yMatch) return yMatch[1].trim();
  return null;
}

/** Detect if tier needs high complexity */
export function parseTierFlags(tier: string) {
  const t = (tier || '').toLowerCase();
  return {
    isFoundation: t.includes('foundation') || t.includes('basic'),
    isGCSE: t === 'secondary_14_16' || t.includes('gcse') || t.includes('ks4') || t.includes('o-level') || t.includes('secondary'),
    isALevel: t === 'college_16_18' || t.includes('a-level') || t.includes('a level') || t.includes('ib') || t.includes('pre-u') || t.includes('advanced') || t.includes('college'),
    isUniversity: t === 'university_18plus' || t.includes('university') || t.includes('undergraduate') || t.includes('degree') || t.includes('postgraduate') || t.includes('masters'),
  };
}

/** Detect transformation topics for special handling */
export function hasTransformationTopic(subtopics: string[]): boolean {
  const subtopicsLower = subtopics.map(s => s.toLowerCase());
  return subtopicsLower.some(s =>
    s.includes('transform') ||
    s.includes('f(x)') ||
    s.includes('function') ||
    s.includes('sketch') ||
    s.includes('curve') ||
    s.includes('graph')
  );
}

/** Strip LaTeX wrappers and convert LaTeX math to evaluatable form */
export function stripLatex(s: string): string {
  let r = s;
  r = r.replace(/\$\$/g, '').replace(/\$/g, '');
  r = r.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  r = r.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  r = r.replace(/\\ln\b/g, 'ln');
  r = r.replace(/\\log\b/g, 'log');
  r = r.replace(/\\sin\b/g, 'sin');
  r = r.replace(/\\cos\b/g, 'cos');
  r = r.replace(/\\tan\b/g, 'tan');
  r = r.replace(/\\pi\b/g, 'pi');
  r = r.replace(/\\left\s*/g, '').replace(/\\right\s*/g, '');
  r = r.replace(/\\cdot/g, '*');
  r = r.replace(/\\times/g, '*');
  r = r.replace(/\\,/g, '');
  r = r.replace(/\{([^}]+)\}/g, '($1)');
  r = r.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');
  r = r.replace(/(\d)(x)/gi, '$1*$2');
  r = r.replace(/\)\(/g, ')*(');
  r = r.replace(/(\d)\(/g, '$1*(');
  r = r.replace(/\)(x)/gi, ')*$1');
  return r.trim().replace(/[.\s]+$/, '');
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-PART SPLITTER — deterministic enforcement
// ═══════════════════════════════════════════════════════════════════════════
// The prompt instructs the AI to emit sub-parts as separate questions
// (1a, 1b, 1c), but it sometimes flattens them into one blob:
//   "...(a) Express ... (b) Hence find ... (c) sketch the curve..."
// Prompt instructions are probabilistic; this splitter is not.

const PART_MARKER = /\(([a-h])\)\s*/g;

/** Detect a flattened multi-part question and split it into sub-questions. */
export function splitMultiPartQuestions(questions: any[]): any[] {
  const out: any[] = [];
  for (const q of questions) {
    try {
      const text: string = q.question_text || '';
      if (q.question_type === 'mcq' || q.question_type === 'table_grid') { out.push(q); continue; }

      // Find (a), then the first (b) AFTER it, then (c) after that, etc.
      // Sequential forward search means later references like "using your
      // answer to part (a)" inside part (c) don't break detection.
      const markers: Array<{ letter: string; index: number }> = [];
      let searchFrom = 0;
      for (let li = 0; li < 8; li++) {
        const letter = String.fromCharCode(97 + li); // a, b, c...
        const idx = text.indexOf(`(${letter})`, searchFrom);
        if (idx === -1) break;
        markers.push({ letter, index: idx });
        searchFrom = idx + 3;
      }
      if (markers.length < 2) { out.push(q); continue; }

      const stem = text.slice(0, markers[0].index).trim();
      const baseNumber = String(q.question_number ?? '').match(/\d+/)?.[0] ?? String(q.question_number ?? '1');
      const totalMarks = Number(q.marks) || markers.length;
      const baseMarks = Math.max(1, Math.floor(totalMarks / markers.length));
      let marksLeft = totalMarks;

      console.log(`Splitting flattened multi-part Q${q.question_number} into ${markers.length} sub-questions`);

      markers.forEach((mk, i) => {
        const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
        const partBody = text.slice(mk.index, end).replace(/^\(([a-h])\)\s*/, '').trim();
        const isLast = i === markers.length - 1;
        const partMarks = isLast ? marksLeft : baseMarks;
        marksLeft -= partMarks;

        const needsCanvas = /\b(sketch|plot|draw)\b/i.test(partBody);
        const child: any = {
          ...q,
          question_number: `${baseNumber}${mk.letter}`,
          question_text: i === 0 && stem ? `${stem}\n\n${partBody}` : partBody,
          marks: partMarks,
          question_type: needsCanvas ? 'graph_plotting'
            : (q.question_type === 'graph_plotting' || q.question_type === 'graph_transformation')
              ? 'short_answer'
              : q.question_type,
        };
        // Only the canvas part keeps the graph payload; text parts must not
        // carry it (it would render a stray canvas).
        if (!needsCanvas) {
          delete child.diagram_config;
          delete child.diagramConfig;
        }
        out.push(child);
      });
    } catch (err) {
      console.error('splitMultiPartQuestions error — keeping original question:', err);
      out.push(q);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS GUARANTEE — every graph question must render a grid
// ═══════════════════════════════════════════════════════════════════════════
// If a graph-type question reaches the database without a parsable
// graphConfig, the frontend shows the question with no canvas and no tools.
// This injects a minimal blank grid so the student can ALWAYS draw.

const GRAPH_TYPES_FOR_CANVAS = ['graph_plotting', 'graph_interpretation', 'graph_transformation'];

function hasRenderableGraphConfig(q: any): boolean {
  const candidates = [q.correct_answer, q.diagram_config, q.diagramConfig];
  for (let cand of candidates) {
    if (!cand) continue;
    if (typeof cand === 'string') { try { cand = JSON.parse(cand); } catch { continue; } }
    if (cand && typeof cand === 'object' && (cand.graphConfig || cand.transformationConfig || (cand.graphType && cand.series))) return true;
  }
  return false;
}

export function ensureRenderableGraphConfigs(questions: any[]): void {
  for (const q of questions) {
    try {
      if (!GRAPH_TYPES_FOR_CANVAS.includes(q.question_type)) continue;
      if (hasRenderableGraphConfig(q)) continue;
      console.warn(`Q${q.question_number}: graph question had no renderable config — injecting blank canvas`);
      const fallback = {
        graphType: 'plotting',
        graphConfig: {
          chartType: 'line', xLabel: 'x', yLabel: 'y',
          domainX: [-10, 10], domainY: [-10, 10],
          gridEnabled: true, series: [],
        },
        plottingAnswer: { expectedPoints: [], toleranceUnits: 0.5 },
      };
      q.question_type = 'graph_plotting'; // fallback canvas is a plotting grid
      q.diagram_config = fallback;
      // Preserve any model answer text for the AI grader, but ensure the
      // frontend parser finds the wrapper first.
      if (!q.correct_answer || typeof q.correct_answer !== 'string' || !q.correct_answer.includes('graphConfig')) {
        q.correct_answer = JSON.stringify({ ...fallback, modelAnswer: q.correct_answer ?? '' });
      }
    } catch (err) {
      console.error('ensureRenderableGraphConfigs error:', err);
    }
  }
}
