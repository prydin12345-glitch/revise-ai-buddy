import {OCR_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {singleChoiceKey} from './single-choice-marking.ts';
import { statementCombinationIssue } from './numbered-statements.ts';
import { assembledModelText } from './model-question-normalization.ts';
import {requireBiologyEssayKey} from './biology-essay-marking.ts';
import { packForBiologyPlan } from './biology-course-packs.ts';
import type { PaperPlan } from './biology-paper-contract.ts';
import type { CandidatePart, QuestionDefect } from './question-contract-validator.ts';
import { resolveQuestionResources } from './question-resources.ts';
import { coerceMcqOptions, hasThreeLevelScheme, isMcqType } from './model-question-normalization.ts';
import { comprehensionTaskIssues } from './biology-comprehension.ts';
import {unifiedPartIssues} from './ocr-alevel-biology-paper3-validation.ts';
import type {UnifiedPart} from './ocr-alevel-biology-paper3-contract.ts';

export const canonicalPartNumber = (value: unknown): string => {
  const text = String(value ?? '').trim().replace(/^Q\s*/i, '');
  const match = text.match(/^(\d+)\s*(?:\(?([a-z])\)?)?$/i);
  return match ? `${Number(match[1])}${match[2] ? `(${match[2].toLowerCase()})` : ''}` : text;
};
/** Structural checks only: live scientific accuracy still needs a paper audit. */
export function validateBiologyPlan(rows: CandidatePart[], plan?: PaperPlan | null): QuestionDefect[] {
  if (!plan) return [];
  const pack = packForBiologyPlan(plan);
  // Preserve the AQA v1 acceptance rules while extracting shared machinery.
  // Its total, task, resource and level checks still run in the common gate.
  if (pack.validation.rows === 'legacy_totals') return [];
  const policy = pack.validation;
  const defects: QuestionDefect[] = [];
  const byNumber = new Map(plan.parts.map(p => [canonicalPartNumber(p.questionNumber), p]));
  const seen = new Set<string>();
  const passages = new Map<string,string>();
  const experiments = new Map<string,string>();
  const unifiedDatasets = new Map<string,string>();
  for (const row of rows) {
    const number = canonicalPartNumber(row.question_number);
    const expected = byNumber.get(number);
    const push = (detail: string, code: QuestionDefect['code'] = 'plan_mismatch') => defects.push({partId: String(row.id ?? row.question_number ?? 'paper'),
      parentId: row.root_question_number ?? row.parent_question_number ?? null, code, detail});
    if (!expected || seen.has(number)) { push(`Unexpected or duplicate scored row ${number}; do not silently renumber or discard it.`); continue; }
    seen.add(number);
    if(pack.id==='ocr-h420-paper-3-v1')for(const issue of unifiedPartIssues(row,expected as UnifiedPart,unifiedDatasets))push(`Q${number}: ${issue.detail}`,issue.code);
    if (Number(row.marks) !== expected.marks) push(`Q${number} requires ${expected.marks} marks and a matching scheme.`);
    if (pack.id === 'ocr-h420-paper-2-v2') {
      if ((row as any).topic_tag !== expected.topic) push(`Q${number} must retain its planned Paper 2 topic ${expected.topic}.`);
      if (expected.mcqStyle === 'statements') {
        const issue = statementCombinationIssue(assembledModelText(row), coerceMcqOptions(row), [1,2,3]);
        if (issue) push(issue, 'invalid_statements');
      }
    }
    const isMcq = isMcqType(row.question_type);
    if (isMcq !== (expected.responseType === 'mcq_single')) push(`Q${number} must be ${expected.responseType}.`);
    if (expected.responseType === 'mcq_single') {
      const options = coerceMcqOptions(row) ?? [];
      const values = options.map(o => o.trim().toLowerCase());
      if (options.length !== policy.mcqOptions || new Set(values).size !== policy.mcqOptions || values.some(v => !v)) push(`Q${number} requires ${policy.mcqOptions} distinct non-empty choices.`, 'invalid_options');
    }

    if(plan.courseId===OCR_ALEVEL_BIOLOGY_ID&&expected.responseType==='mcq_single'){
      try{singleChoiceKey(row);}catch(error){push(`Q${number}: ${(error as Error).message}`, 'invalid_options');}
    }
    const resources = resolveQuestionResources(row);
    if(plan.courseId===OCR_ALEVEL_BIOLOGY_ID && plan.paperId==='paper_2') {
      // Canonical projection is not permission to accept answer-bearing model
      // resources. Refuse private fields even when a renderer would ignore them.
      const privateResourceField=(value:unknown):boolean => {
        if(!value || typeof value!=='object')return false;
        return Object.entries(value).some(([key,v]) => /^(?:correct_answer|mark_scheme|solution|solutions|private_key|answer_key|completed_answers)$/i.test(key) || privateResourceField(v));
      };
      if(privateResourceField(row.diagram_config) || privateResourceField(row.chart_data))push(`Q${number} resource contains private marking or completed-answer fields.`, 'invalid_resource');
    }
    if(resources.essay && expected.resource!=='essay_choice')push(`Q${number} is not the planned essay.`, 'invalid_resource');
    if(expected.resource==='essay_choice'){
      if(!resources.essay)push(`Q${number} needs both saved essay titles.`, 'missing_required_resource');
      else try{requireBiologyEssayKey(row.correct_answer,resources.essay);}catch(error){push(String((error as Error).message),'missing_answer');}
    }
    if(expected.assessmentRole==='critical_analysis' && resources.table){
      const t=resources.table;
      const saved=JSON.stringify({headers:t.headers,rows:t.rows,units:t.units??[],caption:t.caption??''});
      if(experiments.has(expected.parentId)&&experiments.get(expected.parentId)!==saved)push(`Q${number}: experimental-analysis siblings must carry the same saved dataset, units and caption.`, 'conflicting_resource_data');
      experiments.set(expected.parentId,saved);
    }
    if (resources.passage && expected.resource !== 'passage') push(`Q${number} is not a planned comprehension part.`, 'invalid_resource');
    if (expected.resource === 'passage') {
      for (const issue of comprehensionTaskIssues(row, plan.mode === 'full_mock')) push(`Q${number}: ${issue.detail}`, issue.code);
      if (resources.passage) {
        const saved = JSON.stringify(resources.passage);
        if (passages.has(expected.parentId) && passages.get(expected.parentId) !== saved) push(`Q${number}: comprehension siblings must use the same passage.`, 'conflicting_resource_data');
        passages.set(expected.parentId, saved);
      }
    }
    if (expected.resource === 'data_table' && !resources.table) push(`Q${number} requires the planned data table.`, "missing_required_resource");
    if (expected.resource === 'graph' && (!resources.chart || resources.chart.type === 'data_table')) push(`Q${number} requires the planned graph.`, "missing_required_resource");
    if (policy.levelSchemeAtMarks !== null && expected.marks === policy.levelSchemeAtMarks) {
      if (!hasThreeLevelScheme(row.correct_answer)) push(`Q${number} requires a private three-level response scheme with a descriptor for each level, not only a model answer.`, "missing_answer");
    }
  }
  for (const [number] of byNumber) if (!seen.has(number)) defects.push({partId: 'paper', parentId: null,
    code: 'plan_mismatch', detail: `Planned Q${number} is missing. Generate a fresh draft; a different question cannot be relabelled to fill it.`});
  return defects;
}
