// @vitest-environment node
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { buildCacheKey } from '../functions/_shared/cache-utils';
import { PHYSICS_CACHE_VERSION } from '../functions/_shared/physics-generation-policy';

const sentinel = { type: 'physics_no_figure', physics_figure_version: 1, diagram_intent: 'none' };
const base = { question_number: '1', question_type: 'short_answer', marks: 3, subtopic: 'Physics', difficulty_level: 'medium' };
const numerical = () => ({ ...base,
  question_text: 'A lamp has potential difference 12.0 V and current 2.00 A. Calculate its power.',
  diagram_config: { ...sentinel },
  correct_answer: {
    answer: '24.0 W', worked_solution: 'Power = 12.0 V × 2.00 A = 24.0 W.',
    calculation_checks: [{ label: 'power', inputs: [
      { name: 'v', value: '12.0', unit: 'V', source: 'stem', quote: '12.0 V' },
      { name: 'i', value: '2.00', unit: 'A', source: 'stem', quote: '2.00 A' },
    ], expression: { op: 'multiply', args: [{ input: 'v' }, { input: 'i' }] },
    result: { value: '24.0', unit: 'W', significant_figures: 3 }, answer_quote: '24.0 W', working_quote: '24.0 W' }],
  },
});
const setup = () => ({ ...base,
  question_text: 'A block of mass 2 kg rests on a rough slope at 30 deg to the horizontal. Explain the direction of friction when the block tends to slide down.',
  correct_answer: 'Friction acts up the slope because it opposes the tendency to move down the slope.',
  diagram_config: { physics_figure_version: 1, diagram_intent: 'setup', type: 'slope', angle: 30, mass: 2, surface: 'rough', showNormal: false, showWeight: false, showFriction: false, showComponents: false, showLabels: true },
});
const graph = () => {
  const resource = { type: 'line_chart', xAxisLabel: 'Time / s', yAxisLabel: 'Potential difference / V', datasets: [{ label: 'Voltage', data: [{ x: 0, y: 12 }, { x: 2, y: 7.3 }] }] };
  return { ...base, question_text: 'Describe the trend in potential difference shown by the graph.', correct_answer: 'The potential difference decreases with time.',
    chart_data: resource, diagram_config: { ...resource, physics_figure_version: 1, diagram_intent: 'graph' } };
};
const cacheParams = {
  subject: 'Physics', examBoard: 'AQA', educationalLevel: 'A-level', assessmentTier: 'not_tiered', courseId: 'physics-fixture', paperId: 'paper_2', presetVersion: null,
  topics: ['Physics'], difficulty: 'mixed', questionFormat: 'written_only', questionCount: 1,
};
type Options = {
  answers?: Record<string, any>[][];
  legacy?: boolean;
  cached?: { key: string; questions: any[] };
  corruptAfterValidation?: 'figure' | 'answer';
};
async function practice(options: Options = {}) {
  const context = { context_version: 2, resolved_by: 'server', profile_id: 'profile', subject_name: 'Physics', exam_board: 'AQA', educational_tier: 'A-level', assessment_tier: 'not_tiered',
    course_id: 'physics-fixture', paper_id: 'paper_2', component_code: null, paper_contract: null,
    ...(options.legacy ? {} : { physics_generation_version: 1 }) };
  const set: any = { id: 'set', profile_id: 'profile', subject_id: 'Physics', exam_board: 'AQA', educational_tier: 'A-level', generation_context: context,
    question_count: 1, question_format: 'written_only', difficulty_level: 'mixed', subtopics: ['Physics'], notes: '' };
  const calls: any[] = [], writes: any[] = [], reads: any[] = [], errors: any[] = [];
  const client = { from(table: string) {
    let op = 'select', value: any; const filters: any = {}; const q: any = {};
    for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'ilike', 'gt', 'order', 'limit', 'single', 'maybeSingle']) q[method] = (...args: any[]) => {
      if (['insert', 'update', 'upsert', 'delete'].includes(method)) { op = method; value = args[0]; }
      if (method === 'eq') filters[args[0]] = args[1]; return q;
    };
    q.then = (resolve: any, reject: any) => {
      let data: any = [];
      if (op !== 'select') { writes.push({ table, op, value: structuredClone(value) }); if (table === 'practice_question_sets' && op === 'update') Object.assign(set, value); }
      if (table === 'user_preferences') data = { curriculum_region: 'england' };
      if (table === 'student_cache_slots') data = null;
      if (table === 'question_generation_cache' && op === 'select') {
        reads.push({ ...filters });
        data = options.cached?.key === filters.cache_key ? { questions: options.cached.questions, hit_count: 0, subject: 'Physics', exam_board: 'AQA', educational_level: 'A-level' } : null;
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    }; return q;
  } };
  const bundled = await build({ entryPoints: ['supabase/functions/generate-practice-questions/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'practice-runtime', setup(b) {
    b.onLoad({ filter: /generate-practice-questions\/index\.ts$/ }, args => ({ loader: 'ts', contents: readFileSync(args.path, 'utf8') + '\nexport {generateQuestionsInBackground};' }));
    if (options.corruptAfterValidation) b.onLoad({ filter: /question-postprocessor\.ts$/ }, args => ({ loader: 'ts', contents: readFileSync(args.path, 'utf8').replace(
      'export function ensureRenderableGraphConfigs(questions: any[]): void {',
      `export function ensureRenderableGraphConfigs(questions: any[]): void { ${options.corruptAfterValidation === 'figure' ? 'questions[0].diagram_config = null;' : 'questions[0].correct_answer = "30.0 W";'} `,
    ) }));
    b.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: 'runtime' }));
    b.onLoad({ filter: /.*/, namespace: 'runtime' }, args => ({ loader: 'js', contents: args.path.includes('supabase-js') ? 'export const createClient=()=>globalThis.client;'
      : args.path.includes('zod@') ? 'export const z=globalThis.z;' : args.path.includes('pdfjs') ? 'export const getDocument=()=>{throw Error("No PDF in fixture")};' : 'export const serve=()=>{};' }));
  } }] });
  const answers = options.answers ?? [[numerical()]];
  const runtime: any = { module: { exports: {} }, exports: {}, z, client, Request, Response, Headers, URL, TextEncoder, TextDecoder, crypto, setTimeout, clearTimeout, AbortController,
    console: { log() {}, info() {}, warn() {}, error(...args: any[]) { errors.push(args); } }, Deno: { env: { get: () => 'test-only' } }, EdgeRuntime: { waitUntil() {} },
    fetch: async (_url: any, request: any) => {
      const body = JSON.parse(request.body); calls.push(body);
      const questions = answers[Math.min(calls.length - 1, answers.length - 1)];
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { tool_calls: [{ function: { name: 'generate_practice_questions', arguments: JSON.stringify({ questions }) } }] } }] }));
    } };
  vm.runInNewContext(bundled.outputFiles[0].text, runtime);
  await runtime.module.exports.generateQuestionsInBackground('set', 'owner', set);
  return { set, calls, writes, reads, errors, rows: writes.find(write => write.table === 'practice_questions' && write.op === 'insert')?.value };
}

describe('actual new Physics practice background generation', () => {
  it('round-trips its explicit no-figure intent and private numerical envelope through the tool and saved row', async () => {
    const result = await practice();
    expect(result.set.extraction_error ?? '', JSON.stringify(result.errors)).toBe('');
    expect(result.set.extraction_status).toBe('completed'); expect(result.calls).toHaveLength(1);
    expect(result.rows[0].diagram_config).toEqual(sentinel);
    const privateKey = JSON.parse(result.rows[0].correct_answer);
    expect(privateKey.answer).toBe('24.0 W'); expect(privateKey.calculation_checks).toHaveLength(1);
    expect(JSON.stringify(result.rows[0].diagram_config)).not.toContain('calculation_checks');
    const prompt = result.calls[0].messages.map((message: any) => message.content).join('\n');
    expect(prompt).toContain('PHYSICS SAVED FIGURE CONTRACT'); expect(prompt).toContain('PHYSICS PRIVATE NUMERICAL INTEGRITY');
    expect(result.calls[0].tools[0].function.parameters.properties.questions.items.properties.diagram_config).toBeDefined();
  });
  it('keeps a faithful explicit slope setup and the original assessed task', async () => {
    const question = setup(), result = await practice({ answers: [[question]] });
    expect(result.set.extraction_error ?? '', JSON.stringify(result.errors)).toBe('');
    expect(result.rows[0].diagram_config).toEqual(question.diagram_config);
    expect(result.rows[0].question_text).toBe(question.question_text);
  });
  it('keeps graph intent/version when chart storage selects the unmarked chart alias', async () => {
    const question = graph(), result = await practice({ answers: [[question]] });
    expect(result.set.extraction_error ?? '', JSON.stringify(result.errors)).toBe('');
    expect(result.rows[0].diagram_config).toEqual(question.diagram_config);
    expect(result.rows[0].question_type).toBe('short_answer');
    expect(result.rows[0].correct_answer).toBe(question.correct_answer);
  });
  it('retries an invalid required figure within the existing allowance and saves the complete repaired task', async () => {
    const bad: any = setup(); delete bad.diagram_config;
    const healthy = setup(), result = await practice({ answers: [[bad], [healthy]] });
    expect(result.set.extraction_error ?? '', JSON.stringify(result.errors)).toBe(''); expect(result.calls).toHaveLength(2);
    expect(result.rows[0].question_text).toBe(healthy.question_text); expect(result.rows[0].diagram_config).toEqual(healthy.diagram_config);
  });
  it.each(['missing-figure', 'wrong-calculation'] as const)('never persists unresolved %s after three attempts', async kind => {
    const bad: any = kind === 'missing-figure' ? setup() : numerical();
    if (kind === 'missing-figure') delete bad.diagram_config;
    else bad.correct_answer.answer = '30.0 W';
    const result = await practice({ answers: [[bad]] });
    expect(result.calls).toHaveLength(3); expect(result.set.extraction_status).toBe('failed');
    expect(result.set.extraction_error).toMatch(/invalid_resource|invalid_calculation|unverified_calculation/); expect(result.rows).toBeUndefined();
    expect(result.calls[2].messages[0].content).toContain('PHYSICS SAVED FIGURE CONTRACT');
  });
  it.each(['figure', 'answer'] as const)('checks the actual post-processed %s before persistence', async corruptAfterValidation => {
    const result = await practice({ corruptAfterValidation });
    expect(result.calls).toHaveLength(1); expect(result.set.extraction_status).toBe('failed'); expect(result.rows).toBeUndefined();
    expect(result.set.extraction_error).toMatch(/invalid_resource|unverified_calculation/);
  });
  it('queries the Physics cache version so an old unmarked cache entry is excluded', async () => {
    const oldKey = await buildCacheKey(cacheParams), newKey = await buildCacheKey({ ...cacheParams, resourceVersion: PHYSICS_CACHE_VERSION });
    const legacyQuestion = { ...base, question_text: 'State the unit of force.', correct_answer: 'N' };
    const result = await practice({ cached: { key: oldKey!, questions: [legacyQuestion] } });
    expect(result.set.extraction_status).toBe('completed'); expect(result.calls).toHaveLength(1);
    expect(result.reads[0].cache_key).toBe(newKey); expect(newKey).not.toBe(oldKey);
    expect(result.rows[0].diagram_config).toEqual(sentinel);
  });
  it('validates a cache hit before accepting and persisting its stored contract', async () => {
    const newKey = await buildCacheKey({ ...cacheParams, resourceVersion: PHYSICS_CACHE_VERSION });
    const invalid: any = numerical(); delete invalid.diagram_config;
    const result = await practice({ cached: { key: newKey!, questions: [invalid] } });
    expect(result.calls).toHaveLength(1); expect(result.set.extraction_status).toBe('completed');
    expect(result.rows[0].diagram_config).toEqual(sentinel);
  });
  it('preserves the old attempt policy without requiring new figure or calculation metadata', async () => {
    const legacyQuestion = { ...base, question_text: 'State the unit of force.', correct_answer: 'N' };
    const result = await practice({ legacy: true, answers: [[legacyQuestion]] });
    expect(result.set.extraction_status).toBe('completed'); expect(result.calls).toHaveLength(1);
    expect(result.rows[0].correct_answer).toBe('N'); expect(result.rows[0].diagram_config).toBeNull();
    expect(result.calls[0].messages[0].content).not.toContain('PHYSICS SAVED FIGURE CONTRACT');
  });
});
