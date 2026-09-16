import { analyseGroupRepair, type RepairDiagnostic, type RepairMode, type RepairResult } from './prepare-group-repair.ts';
import { biologyScopeInstructions, type BiologyScope } from './gcse-biology-scope.ts';
import type { PaperPlan } from './biology-paper-contract.ts';

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
  `${item.partNumber ? `Q${item.partNumber}: ` : ''}${item.code} (${item.detail})`).join('; ');

export function buildQuestionRepairPrompt(input: RepairRequest): string {
  const taskOnly = input.mode === 'task_only';
  return [
    taskOnly ? 'Repair the missing assessed tasks for the named parts only. Original context, data and other siblings must remain unchanged.'
      : 'Repair the COMPLETE parent group, including every sibling, resource and private mark scheme.',
    `Subject: ${input.subject}. Board: ${input.scope.examBoard ?? 'unchanged'}. Qualification: ${input.scope.educationalLevel ?? 'unchanged'}.`,
    biologyScopeInstructions(input.scope),
    'Blocking defects: ' + input.defects,
    'Targets: ' + [...input.targetNumbers].join(', '),
    input.previousDiagnostics?.length ? 'Previous response was rejected: ' + describeRepairDiagnostics(input.previousDiagnostics) : '',
    'Keep each stored question number, topic, question type and mark allocation. Return an explicit task field for every scored part.',
    'The task must contain a complete instruction such as Calculate, Describe, Explain, State, Name or Which. Background information alone is not a task.',
    'Every scored repair needs a freshly checked correct_answer string derived from the supplied context and data. Never invent missing measurements.',
    taskOnly ? 'Return ONLY question_number, task and correct_answer for the targets. Do not emit a new context, table, graph, options or unrelated siblings.'
      : 'Return every sibling. For context-only unmarked parents, retain context and zero marks. For scored parts return context, task and correct_answer.',
    taskOnly ? '' : 'Keep all required resources. Store one coherent results table in diagram_config with type data_table, headers and rows; no Markdown/HTML copy. Rewrite keys to agree with the repaired data.',
    'Continuous observations need type line_chart with numeric datasets [{label,data:[{x,y}]}]. Never silently discard conflicting observations or invent point timestamps for interval summaries.',
    'Captions must be neutral; no [Graph showing ...] placeholders or answer-revealing descriptions.',
    'For MCQs preserve the planned choices/count and return an answer matching an option. Put mathematics inside $...$.',
    'Planned parts: ' + JSON.stringify(input.plan?.parts.filter(p => input.group.some(row => String(row.question_number) === p.questionNumber)) ?? []),
    'Current group: ' + JSON.stringify(input.group.map(row => ({ question_number: row.question_number,
      question_type: row.question_type, marks: row.marks, topic_tag: row.topic_tag, question_text: row.question_text,
      correct_answer: row.correct_answer, options: row.options, diagram_config: row.diagram_config, table_data: row.table_data }))),
    taskOnly ? 'Return JSON only: {"parts":[{"question_number":"1(a)","task":"...","correct_answer":"..."}]}'
      : 'Return JSON only: {"parts":[{"question_number":"1(a)","context":"...","task":"...","correct_answer":"...","options":null,"diagram_config":null}]}',
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
  const parts = Array.isArray(parsed) ? parsed : parsed?.parts ?? parsed?.questions;
  const requiredParts = new Set((input.plan?.parts ?? []).filter(p => p.resource !== 'none').map(p => p.questionNumber));
  const result = analyseGroupRepair(input.group, parts, input.scope, requiredParts, input.targetNumbers, input.mode);
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
    if (error || !data?.id) throw new Error(`Repair save failed for Q${row.question_number}: ${error ? 'database write rejected' : 'no matching draft row'}.`);
    saved += 1;
  }
  if (!saved) throw new Error('Repair save failed: no matching replacements.');
  return saved;
}
