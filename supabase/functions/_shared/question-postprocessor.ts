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
      // The sequence may start at (a) or (b) — the AI sometimes keeps part (a)
      // implicit in the stem and only marks later parts.
      let markers: Array<{ letter: string; index: number }> = [];
      for (const startLi of [0, 1]) {
        const found: Array<{ letter: string; index: number }> = [];
        let searchFrom = 0;
        for (let li = startLi; li < 8; li++) {
          const letter = String.fromCharCode(97 + li); // a, b, c...
          const idx = text.indexOf(`(${letter})`, searchFrom);
          if (idx === -1) break;
          found.push({ letter, index: idx });
          searchFrom = idx + 3;
        }
        if (found.length >= 2) { markers = found; break; }
      }
      if (markers.length < 2) { out.push(q); continue; }

      let stem = text.slice(0, markers[0].index).trim();
      // If the sequence starts at (b), the stem usually contains the implicit
      // part (a) task — emit it as its own sub-question.
      if (markers[0].letter !== 'a' && /\b(sketch|draw|plot|find|express|calculate|write|state|show|solve)\b/i.test(stem) && stem.length > 40) {
        markers.unshift({ letter: 'a', index: 0 });
        stem = '';
      }
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

/** Widen domains in a parsed graph wrapper: always include the origin with
 *  at least one negative unit per axis, and pad one unit beyond all data.
 *  Prevents AI-emitted domains like [0, 5] clipping the view to quadrant 1. */
function widenWrapperDomains(wrapper: any): boolean {
  if (!wrapper || typeof wrapper !== 'object') return false;
  const xs: number[] = [];
  const ys: number[] = [];
  const collect = (pts: any) => {
    if (!Array.isArray(pts)) return;
    for (const pt of pts) {
      const x = typeof pt?.x === 'number' ? pt.x : pt?.coordinates?.x;
      const y = typeof pt?.y === 'number' ? pt.y : pt?.coordinates?.y;
      if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
    }
  };
  const cfg = wrapper.graphConfig ?? wrapper.transformationConfig ?? wrapper;
  for (const s of cfg?.series ?? []) collect(s?.data);
  collect(wrapper.originalFunction?.keyPoints);
  collect(wrapper.originalFunction?.referenceCurve?.data);
  collect(wrapper.plottingAnswer?.expectedPoints);

  let changed = false;
  for (const holder of [cfg, wrapper.plottingAnswer]) {
    if (!holder || typeof holder !== 'object') continue;
    for (const [key, vals] of [['domainX', xs], ['domainY', ys]] as Array<[string, number[]]>) {
      const dom = holder[key];
      if (!Array.isArray(dom) || dom.length !== 2) continue;
      const dataLo = vals.length ? Math.min(...vals) - 1 : dom[0];
      const dataHi = vals.length ? Math.max(...vals) + 1 : dom[1];
      const lo = Math.floor(Math.min(dom[0], dataLo, -1));
      const hi = Math.ceil(Math.max(dom[1], dataHi, 1));
      if (lo !== dom[0] || hi !== dom[1]) { holder[key] = [lo, hi]; changed = true; }
    }
  }
  return changed;
}

export function ensureRenderableGraphConfigs(questions: any[]): void {
  for (const q of questions) {
    try {
      if (!GRAPH_TYPES_FOR_CANVAS.includes(q.question_type)) continue;

      // Widen domains in whichever fields carry a wrapper
      for (const field of ['correct_answer', 'diagram_config'] as const) {
        let val: any = q[field];
        if (!val) continue;
        const wasString = typeof val === 'string';
        if (wasString) { try { val = JSON.parse(val); } catch { continue; } }
        if (widenWrapperDomains(val)) {
          q[field] = wasString ? JSON.stringify(val) : val;
          console.log(`Q${q.question_number}: widened ${field} domains to include all quadrants`);
        }
      }

      if (hasRenderableGraphConfig(q)) continue;

      // Interpretation questions must have answerable fields — with zero
      // fields the page renders no inputs at all. Demote to short_answer
      // so the student can still respond in text.
      if (q.question_type === 'graph_interpretation') {
        let parsedCa: any = q.correct_answer;
        if (typeof parsedCa === 'string') { try { parsedCa = JSON.parse(parsedCa); } catch { parsedCa = null; } }
        const fieldCount = Array.isArray(parsedCa?.interpretationFields) ? parsedCa.interpretationFields.length : 0;
        if (fieldCount === 0) {
          console.warn(`Q${q.question_number}: graph_interpretation had no fields — demoting to short_answer`);
          q.question_type = 'short_answer';
          continue;
        }
      }

      // Transformation questions describing the curve in prose: rebuild the
      // reference curve from the described coordinates before giving up.
      if (q.question_type === 'graph_transformation') {
        const rebuilt = reconstructTransformationWrapper(q.question_text || '', Number(q.marks) || undefined);
        if (rebuilt) {
          console.log(`Q${q.question_number}: reconstructed transformation curve from question text (${rebuilt.originalFunction.keyPoints.length} key points)`);
          q.diagram_config = rebuilt;
          q.correct_answer = JSON.stringify({ ...rebuilt, modelAnswer: typeof q.correct_answer === 'string' ? q.correct_answer : '' });
          continue;
        }
      }

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

// ═══════════════════════════════════════════════════════════════════════════
// PROSE-TO-CURVE RECONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════
// When the AI emits a graph_transformation question as plain prose ("The
// graph has a minimum point at (2, -1) and crosses the y-axis at (0, 3)...")
// the coordinates are sitting right there in the text. Rather than shipping
// a blank canvas under a question that says "the graph is shown below",
// reconstruct the reference curve deterministically: parse the described
// key points, interpolate a smooth curve through them, and build the full
// canonical transformation wrapper.

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const PAIR = String.raw`\(\s*(${NUM})\s*,\s*(${NUM})\s*\)`;

export function reconstructTransformationWrapper(text: string, marks?: number): any | null {
  try {
    if (!text || typeof text !== 'string') return null;
    const pts: Array<{ x: number; y: number; type: string }> = [];
    const add = (x: number, y: number, type: string) => {
      if (isFinite(x) && isFinite(y) && !pts.some((pt) => pt.x === x && pt.y === y)) {
        pts.push({ x, y, type });
      }
    };

    for (const m of text.matchAll(new RegExp(`(minimum|maximum|turning)\\s+point[^.]{0,50}?${PAIR}`, 'gi'))) {
      add(parseFloat(m[2]), parseFloat(m[3]), m[1].toLowerCase() === 'maximum' ? 'maximum' : 'minimum');
    }
    for (const m of text.matchAll(new RegExp(`y[\\s-]?axis[^.]{0,40}?${PAIR}`, 'gi'))) {
      add(parseFloat(m[1]), parseFloat(m[2]), 'y-intercept');
    }
    // x-axis sentences may list several pairs: "(1, 0) and (3, 0)"
    for (const m of text.matchAll(/x[\s-]?axis[^.]*/gi)) {
      for (const pm of m[0].matchAll(new RegExp(PAIR, 'g'))) {
        add(parseFloat(pm[1]), parseFloat(pm[2]), 'x-intercept');
      }
    }
    for (const m of text.matchAll(new RegExp(`(?:passes?\\s+through|point\\s+at)[^.]{0,40}?${PAIR}`, 'gi'))) {
      add(parseFloat(m[1]), parseFloat(m[2]), 'point');
    }

    if (pts.length < 3) return null;

    // Lagrange interpolation through the described points, sampled densely
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    // Duplicate x values make Lagrange explode — bail out
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].x === sorted[i - 1].x) return null;
    }
    const xMin = sorted[0].x - 1;
    const xMax = sorted[sorted.length - 1].x + 1;
    const step = (xMax - xMin) / 40;
    const data: Array<{ x: number; y: number }> = [];
    for (let x = xMin; x <= xMax + 1e-9; x += step) {
      let y = 0;
      for (let i = 0; i < sorted.length; i++) {
        let term = sorted[i].y;
        for (let j = 0; j < sorted.length; j++) {
          if (i !== j) term *= (x - sorted[j].x) / (sorted[i].x - sorted[j].x);
        }
        y += term;
      }
      data.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    }

    // Sanity check: wild interpolation blow-ups mean the points don't
    // describe a sensible single curve — better no curve than a wrong one.
    const ys = data.map((pt) => pt.y);
    if (Math.max(...ys.map(Math.abs)) > 1000) return null;

    const yLo = Math.min(...ys, ...pts.map((pt) => pt.y)) - 1;
    const yHi = Math.max(...ys, ...pts.map((pt) => pt.y)) + 1;

    return {
      graphType: 'transformation',
      originalFunction: {
        description: 'y = f(x)',
        keyPoints: pts.map((pt, i) => ({
          id: `kp-${i}`,
          type: pt.type,
          coordinates: { x: pt.x, y: pt.y },
          label: `(${pt.x}, ${pt.y})`,
        })),
        referenceCurve: { id: 'f', label: 'y = f(x)', data },
      },
      domainX: [Math.floor(Math.min(xMin, -1)), Math.ceil(Math.max(xMax, 1))],
      domainY: [Math.floor(Math.min(yLo, -1)), Math.ceil(Math.max(yHi, 1))],
      parts: [{
        id: 'a',
        transformation: '',
        questionType: 'sketch',
        prompt: text,
        marks: marks ?? 3,
        correctAnswer: {},
      }],
    };
  } catch (err) {
    console.error('reconstructTransformationWrapper error:', err);
    return null;
  }
}
