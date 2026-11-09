import {essayKeyObject} from './biology-essay-marking.ts';
import {physicsCalculationPrivateKey, readPhysicsCalculationKey} from './physics-calculation-integrity.ts';
import { declaredStatementText } from './numbered-statements.ts';
// Model-output adapters only. No AI calls, invented answers or relaxed gates.
// Generation and repair must preserve the same content before validating it.
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function readQuestionTask(raw: unknown): string {
  const part = record(raw);
  for (const key of ['task', 'instruction', 'command', 'assessed_task', 'question_task', 'question']) {
    const task = text(part[key]);
    if (task) return task;
  }
  return '';
}

export function assembledModelText(raw: unknown): string {
  const part = record(raw);
  const context = text(part.context), task = readQuestionTask(part), displayed = text(part.question_text);
  const statements = declaredStatementText(part.statements);
  const includeStatements = (stem: string): string => {
    if (!statements || stem.includes(statements)) return stem;
    if (task && stem.endsWith(task)) return `${stem.slice(0, -task.length).trim()}\n\n${statements}\n\n${task}`.trim();
    return `${stem}\n\n${statements}`.trim();
  };
  if (context && task) return includeStatements(context.endsWith(task) ? context : `${context}\n\n${task}`);
  // Some responses supply context and a complete question_text, but no task field.
  // Preserve that complete stem so the gate can inspect the actual instruction.
  if (displayed && ((task && displayed.includes(task)) || (context && displayed.startsWith(context)))) return includeStatements(displayed);
  return includeStatements(task || context || displayed);
}

const optionLabel = (value: unknown): string | null => {
  const match = text(value).match(/^([A-Z])(?:[.)])?$/i);
  return match ? match[1].toUpperCase() : null;
};
const optionText = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  const item = record(value);
  for (const key of ['text', 'value', 'answer', 'option', 'label']) {
    if (typeof item[key] === 'string' || typeof item[key] === 'number') return optionText(item[key]);
    if (item[key] != null) return null;
  }
  return null;
};

function optionList(value: unknown): string[] | null {
  if (typeof value === 'string') {
    const lines = value.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length || !lines.every(line => /^[A-Z][.)]\s+\S/i.test(line))) return null;
    return optionList(lines.map(line => ({label: line[0], text: line.slice(2).trim()})));
  }
  if (Array.isArray(value)) {
    if (!value.length) return null;
    // Labelled object lists may arrive out of order. Keep answer letters aligned.
    const labels = value.map(item => {
      if (typeof item === 'string') return item.match(/^\s*([A-Z])[.)]\s+/i)?.[1].toUpperCase() ?? null;
      const obj = record(item);
      return optionLabel(obj.label ?? obj.id ?? obj.key ?? obj.letter);
    });
    const allLabelled = labels.every(Boolean);
    const objectLabels = value.some((item, i) => typeof item === 'object' && !!labels[i]);
    if (objectLabels && !allLabelled) return null;
    if (allLabelled && new Set(labels).size !== value.length) return null;
    const ordered = allLabelled ? value.map((item, i) => ({item, label: labels[i]!})).sort((a,b) => a.label.localeCompare(b.label)) : value.map(item => ({item, label: ''}));
    if (allLabelled && ordered.some(({label}, i) => label !== String.fromCharCode(65+i))) return null;
    const result = ordered.map(({item, label}) => {
      const body = optionText(item);
      // A scientific name such as E. coli is content, not a label. Strip a
      // prefix only when the whole list has an explicit coherent A/B/C/... set.
      return body !== null && allLabelled ? body.replace(new RegExp('^'+label+'[.)]\\s*','i'),'').trim() : body;
    });
    // Never filter blanks: doing so silently changes which answer a letter means.
    return result.every(item => item !== null) ? result as string[] : null;
  }
  const obj = record(value), keys = Object.keys(obj);
  if (!keys.length || !keys.every(key => /^[A-Z]$/i.test(key))) return null;
  return optionList(keys.map(key => ({label:key, text:obj[key]})));
}

export function coerceMcqOptions(raw: unknown): string[] | null {
  const part = record(raw);
  const lists = ['options', 'choices', 'answer_options', 'mcq_options', 'answers']
    .map(field => optionList(part[field])).filter((list): list is string[] => !!list);
  if (!lists.length) return null;
  // Conflicting aliases require a repair; choosing one could change the key.
  if (lists.some(list => JSON.stringify(list) !== JSON.stringify(lists[0]))) return null;
  return lists[0];
}

/** Retain descriptors, mark ranges AND indicative content from each level. */
export function flattenAnswerKey(value: unknown): string {
  if (value == null) return '';
  const essay=essayKeyObject(value);if(essay)return JSON.stringify(essay);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[\[{]/.test(trimmed)) {
      try { return flattenAnswerKey(JSON.parse(trimmed)); } catch { /* ordinary marking text */ }
    }
    return trimmed;
  }
  if (Array.isArray(value)) return value.map(item => {
    const obj = record(item);
    const level = String(obj.level ?? obj.band ?? '').match(/^(?:level[\s_-]*)?(\d+)\b/i)?.[1];
    if (!level) return flattenAnswerKey(item);
    const body = flattenAnswerKey(Object.fromEntries(Object.entries(obj).filter(([key]) => key !== 'level' && key !== 'band')));
    return body ? `Level ${level}: ${body}` : '';
  }).filter(Boolean).join('\n');
  const calculation = record(value);
  if (Object.prototype.hasOwnProperty.call(calculation, 'calculation_checks')) {
    // Verification ASTs are private metadata, not student answers or prose.
    return [flattenAnswerKey(calculation.answer ?? calculation.final_answer),
      calculation.worked_solution ? 'Working:\n' + flattenAnswerKey(calculation.worked_solution) : '',
      calculation.mark_scheme ? 'Mark scheme:\n' + flattenAnswerKey(calculation.mark_scheme) : '']
      .filter(Boolean).join('\n');
  }
  return Object.entries(record(value)).map(([key, item]) => {
    const body = flattenAnswerKey(item);
    if (!body) return '';
    const label = key.replace(/^level[\s_-]*(\d+)/i, 'Level $1').replace(/[_]+/g, ' ');
    return /^\d+$/.test(label) ? body : `${label}: ${body}`;
  }).filter(Boolean).join('\n');
}

/** An answer and its rubric are complementary, not competing aliases. */
export function readAnswerKey(raw: unknown): string {
  const part = record(raw);
  const essayKeys=['correct_answer','expected_answer','answer','model_answer','mark_scheme','marking_scheme','rubric'].map(f=>essayKeyObject(part[f])).filter(Boolean);
  if(essayKeys.length){
    const key=JSON.stringify(essayKeys[0]);
    const stable=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
    if(essayKeys.some(k=>stable(k)!==stable(essayKeys[0])))throw new Error('Conflicting private essay schemes; regenerate the essay and both schemes.');
    return key;
  }
  const answer = ['correct_answer', 'expected_answer', 'answer', 'model_answer']
    .map(field => flattenAnswerKey(part[field])).find(Boolean) ?? '';
  const schemes = ['mark_scheme', 'marking_scheme', 'rubric'].map(field => flattenAnswerKey(part[field])).filter(Boolean);
  const seen = new Set<string>();
  return [answer, ...schemes].filter(value => {
    if (!value || seen.has(value)) return false;
    seen.add(value); return true;
  }).join('\n\n');
}

/** Check for three populated bands; this does not certify their scientific quality. */
export function hasThreeLevelScheme(value: unknown): boolean {
  const key = flattenAnswerKey(value);
  const bands = [...key.matchAll(/\blevel[\s_-]*([123])\b/gi)];
  return [1, 2, 3].every(level => bands.some((match, index) => {
    if (Number(match[1]) !== level) return false;
    const body = key.slice(match.index! + match[0].length, bands[index + 1]?.index ?? key.length)
      .replace(/\b(marks?|descriptor|description|level)\b/gi, '');
    return /[a-z]{2,}/i.test(body);
  }));
}

export function isMcqType(value: unknown): boolean {
  return /^(mcq|mcq_single|multiple[ _-]choice)$/i.test(String(value ?? '').trim());
}

/** Presentation equivalence only: preserve mathematical symbol and SI-unit case.
 * This deliberately does not simplify algebra or convert numerical units. */
export function mcqComparable(value: string): string {
  const superscripts: Record<string, string> = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+' };
  let result = value
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, run => '^' + [...run].map(char => superscripts[char]).join(''))
    .normalize('NFKC').replace(/µ/g, 'μ').replace(/[−–]/g, '-')
    .replace(/\\[()[\]]/g, '')
    .replace(/\\(mu|Omega|omega|Delta|delta|theta|lambda|pi|alpha|beta|gamma|rho|sigma|epsilon|Phi|phi)\b/g, (_m, g: string) =>
      ({mu:'μ',Omega:'Ω',omega:'ω',Delta:'Δ',delta:'δ',theta:'θ',lambda:'λ',pi:'π',alpha:'α',beta:'β',gamma:'γ',rho:'ρ',sigma:'σ',epsilon:'ε',Phi:'Φ',phi:'φ'} as Record<string,string>)[g])
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\\times/g, '*').replace(/×/g, '*').replace(/\\cdot/g, '·')
    .replace(/\\[,;! ]/g, ' ').replace(/\\(?:quad|qquad)\b/g, ' ');
  for (let pass=0;pass<4;pass++) result=result.replace(/\\(?:text|mathrm|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1');
  result=result.replace(/\bDelta\s+/g, 'Δ').replace(/[$]/g, '')
    .replace(/([_^])\s*\{([^{}]*)\}/g, '$1$2').replace(/[{}]/g, '').replace(/\s+/g,' ').trim();
  const mathematical = /[\d_^=<>+*/·μΩωΔδθλπαβγρσεΦφ]/.test(result) || /^[A-Za-z]$/.test(result);
  return mathematical ? result.replace(/\s+/g,'') : result.toLowerCase();
}

function resolveMcqKey(key: string, options: string[]): string | undefined {
  const k = mcqComparable(key);
  const exact = options.filter(option => mcqComparable(option) === k);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const match = key.match(/^(?:option\s+)?\(?([A-Z])\)?(?:\s*[.):\-–]?\s*(.*))?$/i);
  if (!match) return undefined;
  const selected = options[match[1].toUpperCase().charCodeAt(0)-65];
  if (selected === undefined) return undefined;
  const rest = mcqComparable((match[2] ?? '').replace(/^\((.*)\)\s*:?$/, '$1').replace(/:$/, ''));
  return !rest || rest === mcqComparable(selected) ? selected : undefined;
}

/** Resolve one uniquely identified option, retaining an explanation only when
 * it does not explicitly declare a different answer. Ambiguity needs repair. */
export function canonicalMcqAnswer(answer: string, options: string[] | null): string {
  if (!options?.length || new Set(options.map(mcqComparable)).size !== options.length) return answer;
  const key=answer.trim();
  const whole = resolveMcqKey(key, options);
  if (whole !== undefined) return whole;
  const first = key.split(/\n/)[0].trim();
  const head = first.split(/:\s/)[0].trim();
  const selected=resolveMcqKey(first, options) ?? resolveMcqKey(head, options);
  if (selected===undefined) return answer;
  const index=options.indexOf(selected);
  const explicit = [...key.matchAll(/\b(?:correct\s+(?:answer|option)|answer)\s*(?:(?:is|[:=])\s*)?(?:option\s*)?\(?([A-D])\)?(?=\s|[.):,]|$)/gi)];
  const positive = [...key.matchAll(/\b(?:option|choice)\s+\(?([A-D])\)?\s+(?:is|would be|must be)\s+(?:the\s+)?(?:correct(?:\s+answer)?|answer)\b/gi)];
  if([...explicit,...positive].some(match=>match[1].toUpperCase().charCodeAt(0)-65!==index))return answer;
  for(const line of key.split(/\n/).slice(1)) {
    const standalone=line.trim().match(/^(?:option\s+)?\(?([A-D])\)?[.)]?$/i);
    if(standalone && standalone[1].toUpperCase().charCodeAt(0)-65!==index)return answer;
    const sentence=line.trim().match(/^\(?([A-D])\)?\s+(?:is|would be|must be)\s+(?:the\s+)?(?:correct(?:\s+(?:answer|option))?|answer)\b/i);
    if(sentence && sentence[1].toUpperCase().charCodeAt(0)-65!==index)return answer;
    const declared=line.trim().match(/^\(?([A-D])\)?\s*[.):]\s*(.+)$/i);
    if(!declared)continue;
    // Explanations may explicitly reject a distractor. That is not a second
    // answer declaration; an unexplained second keyed option remains unsafe.
    const commentary=declared[2].split(/:\s/).slice(1).join(': ');
    if(/^(?:incorrect|wrong|not (?:correct|the (?:correct )?answer))\b/i.test(commentary))continue;
    const identified=resolveMcqKey(declared[1]+') '+declared[2].split(/:\s/)[0],options);
    if(identified!==undefined&&identified!==selected)return answer;
  }
  return selected;
}

/** OCR generated content uses text keys; interactive graph-answer JSON elsewhere is untouched. */
export function normalizeGeneratedQuestion(raw: Record<string, any>): Record<string, any> {
  const mcq = isMcqType(raw.question_type);
  const options = mcq ? coerceMcqOptions(raw) : null;
  const answer = readAnswerKey(raw);
  const calculation = readPhysicsCalculationKey(raw);
  const normalizedAnswer = calculation.checks !== undefined
    ? physicsCalculationPrivateKey(raw, mcq ? canonicalMcqAnswer(calculation.answer, options) : calculation.answer)
    : mcq ? canonicalMcqAnswer(answer, options) : answer;
  return {...raw, question_type: mcq ? 'mcq' : raw.question_type,
    question_text: assembledModelText(raw), context: null, task: null,
    ...(mcq && options ? {options} : {}),
    correct_answer: normalizedAnswer};
}
