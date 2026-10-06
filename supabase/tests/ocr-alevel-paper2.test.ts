// @vitest-environment node
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import baseline from './fixtures/biology-pre-ocr-paper2-baseline.json';
import {OCR_ALEVEL_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {buildOcrAlevelPaper2Plan} from '../functions/_shared/ocr-alevel-biology-paper2-contract';
import {OCR_ALEVEL_P2_OUTCOMES,ocrAlevelPaper2ContentIssue} from '../functions/_shared/ocr-alevel-biology-paper2-scope';
import {getBiologyPaperPack,biologyPlanInstructions,assertBiologyPlanIntegrity} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext,biologyScopeInstructions,biologyContentIssue} from '../functions/_shared/gcse-biology-scope';
import {biologyPracticeCacheVersion,biologyPracticeInstructions,assertBiologyPractice} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions,biologyQuestionResourceContext} from '../functions/_shared/biology-marking';
import {singleChoiceKey,markSingleChoice} from '../functions/_shared/single-choice-marking';
import {ocrPaper2Fixture,ocrPaper2Snapshot} from './ocr-alevel-paper2-fixtures';
import {ocrAlevelSnapshot} from './ocr-alevel-fixtures';

const lookup={subject:'Biology Higher',examBoard:'OCR',educationalTier:'level3',courseId:OCR_ALEVEL_BIOLOGY_ID};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
it('requires an explicit owned H420 Paper 2 selection and freezes it on retry',()=>{
  const snapshot=ocrPaper2Snapshot();
  expect(()=>resolvePaperSelection({...lookup,courseId:null},'not_tiered',{})).toThrow();
  const selection=resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:OCR_ALEVEL_BIOLOGY_ID,paperId:'paper_2'},paperContract:snapshot.paper_contract});
  expect(selection.componentCode).toBe('H420/02');expect(selection.paperContract).toEqual(snapshot.paper_contract);
  expect(paperPlanForAttempt(snapshot)?.componentCode).toBe('H420/02');
  expect(paperPlanForAttempt(snapshot,{paperContract:ocrAlevelSnapshot().paper_contract})?.paperId).toBe('paper_2');
  for(const patch of [{component_code:'H420/01'},{paper_id:'paper_1'},{assessment_tier:'higher'},{context_version:1},{specification_version:'old'}])expect(()=>paperPlanForAttempt({...snapshot,...patch})).toThrow();
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:OCR_ALEVEL_BIOLOGY_ID,paperId:'paper_1'},paperContract:snapshot.paper_contract})).toThrow();
  expect(()=>resolvePaperSelection({...lookup,examBoard:'AQA'},'not_tiered',{paperContract:snapshot.paper_contract})).toThrow();
  expect(getBiologyPaperPack(OCR_ALEVEL_BIOLOGY_ID,'paper_3')?.definition('not_tiered').componentCode).toBe('H420/03');
});
it.each(['full_mock','short_practice'] as const)('locks %s marks/time/sections before a provider call',mode=>{
  const {plan,rows,snapshot}=ocrPaper2Fixture(mode);assertBiologyPlanIntegrity(plan);
  expect(plan.totalMarks).toBe(mode==='full_mock'?100:25);expect(plan.durationMinutes).toBe(mode==='full_mock'?135:34);
  expect(plan.parts.reduce((n,p)=>n+p.marks,0)).toBe(plan.totalMarks);
  expect(plan.parts.filter(p=>p.section==='A')).toHaveLength(mode==='full_mock'?15:5);
  expect(plan.parts.filter(p=>p.section==='B').reduce((n,p)=>n+p.marks,0)).toBe(mode==='full_mock'?85:20);
  expect(validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot)}).defects).toEqual([]);
  expect(plan.parts.every(p=>p.specRefs!.every(r=>OCR_ALEVEL_P2_OUTCOMES[r]))).toBe(true);
  expect(biologyPlanInstructions(plan)).toContain('Modules 1, 2, 4 and 6');
  if(mode==='short_practice')expect(plan.label).toContain('Examly development template');
});
it.each(['foundation','higher',null] as const)('rejects the unsupported tier %s',tier=>expect(()=>buildOcrAlevelPaper2Plan('full_mock',tier)).toThrow(/untiered/));
it('leaves Custom outside the guided plan and preserves saved component selection',()=>{
  expect(buildOcrAlevelPaper2Plan('custom','not_tiered')).toBeNull();
  expect(resolvePaperSelection(lookup,'not_tiered',{paperContract:ocrPaper2Snapshot('custom').paper_contract}).componentCode).toBe('H420/02');
});
it.each(Array.from({length:15},(_,i)=>i))('validates every one-mark MCQ, including malformed private key/options: Q%i',i=>{
  const {rows,plan,snapshot}=ocrPaper2Fixture(),q=rows[i],k=singleChoiceKey(q);
  expect(q.marks).toBe(1);expect(k.options).toHaveLength(4);
  expect(markSingleChoice(q,k.letter).score).toBe(1);expect(markSingleChoice(q,'A and B').score).toBe(0);
  for(const patch of [{options:['One','One','Two','Three']},{options:['One','Two','Three']},{correct_answer:'Not one of the choices'}]){
    const changed=rows.map((r,j)=>j===i?{...r,...patch}:r);
    expect(validateQuestionCandidates(changed,{plan,scope:biologyScopeFromContext(snapshot)}).ok).toBe(false);
  }
});
it('requires matching resources and rejects private scaffold content',()=>{
  const {plan,rows,snapshot}=ocrPaper2Fixture();const index=rows.findIndex(q=>q.diagram_config);
  expect(validateQuestionCandidates(rows.map((q,i)=>i===index?{...q,diagram_config:null}:q),{plan}).ok).toBe(false);
  const leaked=rows.map((q,i)=>i===index?{...q,diagram_config:{...q.diagram_config,correct_answer:'PRIVATE'}}:q);
  expect(validateQuestionCandidates(leaked,{plan}).ok).toBe(false);
  const written=rows.find(q=>q.question_number==='20(c)')!;
  expect(biologyQuestionResourceContext(snapshot,written)).toContain('Observed activity');
  expect(()=>biologyQuestionResourceContext(snapshot,{...written,diagram_config:null})).toThrow(/missing/);
});
it.each(['Explain the Calvin cycle.','Describe the cardiac cycle.','Outline action potentials.','Explain selective reabsorption in the nephron.'])('rejects Paper 1-only recall: %s',task=>{
  expect(ocrAlevelPaper2ContentIssue(task)).not.toBeNull();
  expect(biologyContentIssue({question_text:task},biologyScopeFromContext(ocrPaper2Snapshot()))).not.toBeNull();
});
it.each(['Explain the lac operon.','Describe antibody production by B lymphocytes.','Calculate allele frequencies using the supplied Hardy-Weinberg equations.','Explain why ATP-dependent active transport is required.'])('permits Paper 2 and shared Module 2 content: %s',task=>{
  expect(ocrAlevelPaper2ContentIssue(task)).toBeNull();
});
it('isolates practice cache/scope and marking from Paper 1 without forcing a full paper onto a quiz',()=>{
  const c=ocrPaper2Snapshot('short_practice'),p1=ocrAlevelSnapshot('short_practice');
  expect(biologyPracticeCacheVersion(c)).not.toBe(biologyPracticeCacheVersion(p1));
  expect(biologyPracticeCacheVersion(p1)).toBe('ocr-h420-paper-1-ocr-h420-v4.1-2026-04-v1-resources-2');
  expect(biologyPracticeInstructions(c)).toContain('SAVED QUIZ: H420/02');
  expect(biologyPracticeInstructions(c)).toContain('preserve its requested count');
  expect(biologyScopeInstructions(biologyScopeFromContext(c))).toContain('H420/02');
  expect(biologyMarkingInstructions(c)).toContain('H420/02 Biological diversity');
  expect(biologyMarkingInstructions(c)).toContain('communication');
  expect(()=>biologyMarkingInstructions({...c,component_code:'H420/01'})).toThrow();
  expect(()=>assertBiologyPractice([{...ocrPaper2Fixture().rows[9],marks:1}],c)).not.toThrow();
  expect(()=>assertBiologyPractice([{...ocrPaper2Fixture().rows[9],question_text:'Explain action potentials.'}],c)).toThrow();
});
it('preserves all 44 existing plan/definition/prompt fingerprints without changing baseline hashes',()=>{
  expect(baseline.cases).toHaveLength(44);
  for(const row of baseline.cases){const pack=getBiologyPaperPack(row.courseId,row.paperId)!;
    const plan=pack.build(row.mode as 'full_mock'|'short_practice',row.tier as any)!;
    expect(hash(plan)).toBe(row.planHash);expect(hash(pack.definition(row.tier as any))).toBe(row.definitionHash);expect(hash(biologyPlanInstructions(plan))).toBe(row.promptHash);
  }
});
