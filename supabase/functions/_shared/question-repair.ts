import { validateBiologyPlan } from './biology-plan-validator.ts';
import { biologyRepairInstructions, packForBiologyPlan } from './biology-course-packs.ts';
import { analyseGroupRepair, repairNumberKey, type RepairDiagnostic, type RepairMode, type RepairResult } from './prepare-group-repair.ts';
import { biologyScopeInstructions, type BiologyScope } from './gcse-biology-scope.ts';
import type { PaperPlan } from './biology-paper-contract.ts';
import { isMcqType } from './model-question-normalization.ts';
import { assembleQuestionText, referencesResource, questionLabel } from './question-contract-validator.ts';
import { questionResourceInstructions } from './question-resource-instructions.ts';
import { plannedResourceTypeNotes } from './planned-resource-types.ts';

export interface RepairRequest {
  group: any[];
  subject: string;
  scope: BiologyScope;
  defects: string;
  plan?: PaperPlan | null;
  mode: RepairMode;
  targetNumbers: Set<string>;
  previousDiagnostics?: RepairDiagnostic[];
}
export interface RepairOutcome extends RepairResult { phase: 'transport' | 'parse' | 'validation' | 'partial' | 'accepted'; }

export const describeRepairDiagnostics = (items: RepairDiagnostic[]): string => items.map(item =>
  `${item.partNumber ? `${questionLabel(item.partNumber)}: ` : ''}${item.code} (${item.detail})`).join('; ');

/** Match the same explicit identity formats accepted by the repair validator.
 * Existing draft labels/IDs stay intact; no missing part is assigned a number. */
const plannedRepairParts = (input: RepairRequest) => {
  const numbers = new Set(input.group.map(row => repairNumberKey(row.question_number)));
  return (input.plan?.parts ?? []).filter(part => numbers.has(repairNumberKey(part.questionNumber)));
};

export function buildQuestionRepairPrompt(input: RepairRequest): string {
  const taskOnly = input.mode === 'task_only';
  const targets = new Set([...input.targetNumbers].map(repairNumberKey));
  const sample = input.group.find(row => Number(row.marks) > 0 && (!taskOnly || targets.has(repairNumberKey(row.question_number))));
  const plannedParts = plannedRepairParts(input);
  const essay = plannedParts.some(p => p.resource === 'essay_choice');
  const comprehension = plannedParts.some(p => p.resource === 'passage');
  const levelScheme = input.plan ? packForBiologyPlan(input.plan).validation.levelSchemeAtMarks : 6;
  const resourceChecklist = input.group.map(row => {
    const planned = plannedParts.find(part => repairNumberKey(part.questionNumber) === repairNumberKey(row.question_number));
    const reference = referencesResource(assembleQuestionText(row));
    return `${questionLabel(row.question_number)}: planned resource=${planned?.resource ?? 'not specified'}; current reference=${reference ? 'yes' : 'no'}; saved payload=${row.diagram_config || row.table_data ? 'present (validate it)' : 'absent'}.`;
  });
  const example = {question_number: sample?.question_number ?? '1(a)',
    ...(taskOnly ? {} : {context: '...'}), task: '...', correct_answer: '...',
    ...(!taskOnly && isMcqType(sample?.question_type) ? {options: ['Choice A', 'Choice B', 'Choice C', 'Choice D']} : {}),
    ...(taskOnly ? {} : {diagram_config: null})};
  return [
    taskOnly ? 'Repair the missing assessed tasks for the named parts only. Original context, data and other siblings must remain unchanged.'
      : 'Repair the COMPLETE parent group, including every sibling, resource and private mark scheme.',
    'OUTPUT ENVELOPE: Return one JSON object with a non-empty "parts" array, even for one target. Each entry is one explicitly numbered repair. Do not return a bare part, a numbered dictionary or an empty array.',
    `Subject: ${input.subject}. Board: ${input.scope.examBoard ?? 'unchanged'}. Qualification: ${input.scope.educationalLevel ?? 'unchanged'}.`,
    biologyScopeInstructions(input.scope),
    'Blocking defects: ' + input.defects,
    'Targets: ' + [...input.targetNumbers].join(', '),
    input.previousDiagnostics?.length ? 'Previous response was rejected: ' + describeRepairDiagnostics(input.previousDiagnostics) : '',
    'Keep each stored question number, topic, question type and mark allocation. Return an explicit task field for every scored part.',
    'The task must contain a complete instruction such as Calculate, Describe, Explain, Distinguish, State, Name or Which. Background information alone is not a task.',
    essay ? 'The essay correct_answer must be a private biology_essay_key JSON object with both exact titles and 4–10 detailed indicative areas per title.' : 'Every scored repair needs a freshly checked correct_answer string derived from the supplied context and data.',
    taskOnly ? 'Never invent missing measurements; preserve all original source data.'
      : 'Use exact supplied measurements when recoverable. Never patch an unknown cell with a guessed value. If the source is irrecoverable, rewrite the COMPLETE group as a coherent new synthetic question with a complete dataset and new tasks/keys for EVERY sibling; never present invented values as recovered originals.',
    essay ? 'Keep the 25-mark essay holistic; do not replace its private structured scheme with point counts or GCSE bands.' : levelScheme === 6
      ? 'correct_answer must be a plain string. For any 6-mark extended-response part the string must contain "Level 1 (1-2 marks):", "Level 2 (3-4 marks):" and "Level 3 (5-6 marks):" descriptors plus indicative content.'
      : 'correct_answer must contain the task-specific marking points, numerical working where relevant, acceptable alternatives and caps for the saved mark allocation. Do not add a GCSE three-level scheme.',
    taskOnly ? 'Each entry in "parts" must contain only question_number, task and correct_answer for a target. Do not emit a new context, table, graph, options or unrelated siblings.'
      : 'Return every sibling. For context-only unmarked parents, retain context and zero marks. For scored parts return context, task and correct_answer.',
    taskOnly ? '' : essay ? 'Return the two public titles as biology_essay_choice in diagram_config, with no answer content. Rebuild both matching private schemes in correct_answer. Do not substitute a table or create two scored rows.' : comprehension
      ? 'Keep ONE coherent original comprehension passage for this group. Return its full biology_comprehension payload on (a) and matching biology_comprehension_ref payloads on siblings, using diagram_config. All tasks and rewritten keys must agree with that source. Do not substitute a table or lose its paragraph numbering.'
      : 'Keep all required resources. Store one coherent results table in diagram_config with type data_table, headers and rows; no Markdown/HTML copy. Rewrite keys to agree with the repaired data.',
    'Continuous observations need type line_chart with numeric datasets [{label,data:[{x,y}]}]. Never silently discard conflicting observations or invent point timestamps for interval summaries.',
    'Captions must be neutral; no [Graph showing ...] placeholders or answer-revealing descriptions.',
    taskOnly ? 'For an MCQ, use the ORIGINAL choices when checking correct_answer; do not emit or change the choices.'
      : 'For every MCQ row return an options array of exactly four distinct non-empty choices (plain text, no A./B. prefixes) plus a correct_answer that matches one of them exactly. Never omit or null the options.',
    'Put mathematics inside $...$.',
    biologyRepairInstructions(input.plan, new Set(plannedParts.map(part => part.questionNumber)), !taskOnly),
    taskOnly ? 'TASK-ONLY OUTPUT: the plan above is context, not an instruction to replace resources. Return {"parts":[...]} with question_number, task and correct_answer in each target entry.'
      : 'FULL-GROUP OUTPUT: use diagram_config for the repaired canonical resource, even where generation instructions above say chart_data. Return every sibling and every planned resource. A resource=none part may instead be rewritten to remove a dependency, but its task must remain answerable and its key must be rewritten too.',
    taskOnly ? '' : 'RESOURCE CHECKLIST:\n' + resourceChecklist.join('\n'),
    taskOnly ? '' : plannedResourceTypeNotes(plannedParts, 'diagram_config'),
    taskOnly ? '' : 'Every scored part MUST have a non-empty "task" field holding its assessed instruction (for example "Calculate ...", "Explain ..."), separate from "context". Do not leave task empty or put the instruction only inside question_text.',
    taskOnly ? '' : questionResourceInstructions('diagram_config'),
    'Planned parts: ' + JSON.stringify(plannedParts),
    'Current group: ' + JSON.stringify(input.group.map(row => ({ question_number: row.question_number,
      question_type: row.question_type, marks: row.marks, topic_tag: row.topic_tag, question_text: row.question_text,
      correct_answer: row.correct_answer, options: row.options, diagram_config: row.diagram_config, table_data: row.table_data }))),
    'Return JSON only: ' + JSON.stringify({parts: [example]}),
  ].filter(Boolean).join('\n');
}

/** Transport success is not repair acceptance. Each failure phase is explicit. */
export async function requestQuestionRepair(input: RepairRequest, apiKey: string, request: typeof fetch = fetch): Promise<RepairOutcome> {
  const failure = (phase: RepairOutcome['phase'], code: string, detail: string): RepairOutcome =>
    ({ ok: false, replacements: {}, phase, diagnostics: [{ code, detail }] });
  let response: Response;
  try {
    response = await request('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: buildQuestionRepairPrompt(input) }],
        temperature: 0.3, response_format: { type: 'json_object' } }),
    });
  } catch {
    return failure('transport', 'request_failed', 'The repair request did not return a response.');
  }
  if (!response.ok) return failure('transport', 'http_error', 'Repair service returned HTTP ' + response.status + '.');
  let data: any;
  try { data = await response.json(); }
  catch { return failure('parse', 'invalid_envelope', 'Repair service returned an unreadable response.'); }
  const choice = data?.choices?.[0];
  if (choice?.finish_reason && choice.finish_reason !== 'stop') return failure('parse', 'incomplete_response', 'Repair response did not finish normally.');
  const content = String(choice?.message?.content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: any;
  try { parsed = JSON.parse(content); }
  catch { return failure('parse', 'invalid_json', 'Repair content is not complete JSON.'); }
  const object = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  const containers = ['parts', 'questions'].filter(field => object?.[field] != null);
  if (containers.length > 1 || (containers.length && object?.question_number != null)) {
    return failure('parse', 'ambiguous_response_shape', 'Return one parts array, not competing repair containers or both an envelope and a numbered part.');
  }
  const candidate = containers.length ? object[containers[0]] : parsed;
  // A provider sometimes returns the requested entry without its array wrapper.
  // Wrap only an explicitly numbered object, losslessly; never infer a number
  // from the target, dictionary keys, array position or an unrelated wrapper.
  const numbered = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    && ((typeof candidate.question_number === 'string' && candidate.question_number.trim())
      || (typeof candidate.question_number === 'number' && Number.isFinite(candidate.question_number)));
  const parts = Array.isArray(candidate) ? candidate : numbered ? [candidate] : null;
  if (!parts?.length) {
    const shape = candidate === null ? 'null' : Array.isArray(candidate) ? 'empty array' : typeof candidate;
    return failure('parse', 'invalid_response_shape', `Expected a non-empty parts array of explicitly numbered repairs, even for one target. Received ${containers.length ? containers[0] + ': ' : ''}${shape}; no numbered repairs found.`);
  }
  const requiredParts = new Set((input.plan?.parts ?? []).filter(p => p.resource !== 'none').map(p => p.questionNumber));
  const result = analyseGroupRepair(input.group, parts, input.scope, requiredParts, input.targetNumbers, input.mode);
  if (result.ok && input.plan) {
    const groupPlan = {...input.plan, parts: plannedRepairParts(input)};
    const proposed = input.group.map(row => ({...row, ...result.replacements[String(row.question_number)]}));
    const defects = validateBiologyPlan(proposed, groupPlan);
    if (defects.length) return {ok: false, replacements: {}, phase: 'validation',
      diagnostics: defects.map(d => ({code: d.code, detail: d.detail,
        partNumber: proposed.find(row => String(row.id ?? row.question_number) === d.partId)?.question_number}))};
  }
  return { ...result, phase: result.ok ? (result.diagnostics.length ? 'partial' : 'accepted') : 'validation' };
}

/** Confirm that each accepted repair actually updated its owned draft row. */
export async function saveQuestionRepairs(supabase: any, examId: string, group: any[], replacements: Record<string, any>): Promise<number> {
  let saved = 0;
  for (const row of group) {
    const fix = replacements[String(row.question_number)];
    if (!fix) continue;
    const payload: any = {
      original_question_text: row.question_text, question_text: fix.question_text, correct_answer: fix.correct_answer,
      diagram_config: fix.diagram_config, table_data: fix.table_data, question_latex: null, generation_status: 'ai_generated',
    };
    if (fix.options !== undefined) payload.options = fix.options;
    const { data, error } = await supabase.from('exam_question_drafts').update(payload)
      .eq('id', row.id).eq('exam_id', examId).select('id').maybeSingle();
    if (error || !data?.id) throw new Error(`Repair save failed for ${questionLabel(row.question_number)}: ${error ? 'database write rejected' : 'no matching draft row'}.`);
    saved += 1;
  }
  if (!saved) throw new Error('Repair save failed: no matching replacements.');
  return saved;
}
