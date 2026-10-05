import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import baseline from './fixtures/biology-pre-paper2-balance-baseline.json';
import {biologyBatchInstructions,biologyPlanInstructions,biologyPaperOptions,getBiologyPaperPack,assertBiologyPlanIntegrity} from '../functions/_shared/biology-course-packs';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {paperPlanForAttempt,resolvePaperSelection} from '../functions/_shared/course-selection';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {assertBiologyPractice,biologyPracticeCacheVersion,biologyPracticeInstructions} from '../functions/_shared/biology-practice';
import {markSingleChoice,singleChoiceKey} from '../functions/_shared/single-choice-marking';
import {biologyMarkingInstructions} from '../functions/_shared/biology-marking';
import {ocrPaper2Snapshot} from './ocr-alevel-paper2-fixtures';
import {ocrPaper2V2Fixture,ocrPaper2V2Snapshot} from './ocr-alevel-paper2-v2-fixtures';
const course='ocr_alevel_biology_a_h420',lookup={subject:'Biology',examBoard:'OCR',educationalTier:'level3',courseId:course};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
it('preserves all 46 pre-change plan, definition and prompt fingerprints',()=>{
  expect(baseline.cases).toHaveLength(46);
  for(const row of baseline.cases){const pack=getBiologyPaperPack(row.courseId,row.paperId,row.contractVersion)!;
    const plan=pack.build(row.mode as any,row.tier as any)!;
    expect(hash(plan)).toBe(row.planHash);expect(hash(pack.definition(row.tier as any))).toBe(row.definitionHash);expect(hash(biologyPlanInstructions(plan))).toBe(row.promptHash);
  }
});
it('selects v2 only for new explicit Paper 2 presets and retains exactly two visible paper choices',()=>{
  expect(getBiologyPaperPack(course,'paper_2')?.contractVersion).toBe(2);
  expect(getBiologyPaperPack(course,'paper_1')?.contractVersion).toBe(1);
  expect(getBiologyPaperPack(course)).toBeNull();expect(getBiologyPaperPack(course,'paper_2',999)).toBeNull();
  expect(biologyPaperOptions(course).map(p=>p.paperId)).toEqual(['paper_1','paper_2']);
});
it.each(['full_mock','short_practice'] as const)('validates the v2 %s total, resource identity, module allocation and scope',mode=>{
  const {plan,rows,snapshot}=ocrPaper2V2Fixture(mode);assertBiologyPlanIntegrity(plan);
  expect(buildPaperPlan(mode,'not_tiered',course,'paper_2')).toEqual(plan);
  expect(plan.parts.reduce((s,p)=>s+p.marks,0)).toBe(mode==='full_mock'?100:25);
  expect(plan.durationMinutes).toBe(mode==='full_mock'?135:34);
  expect(plan.parts.filter(p=>p.responseType==='mcq_single')).toHaveLength(mode==='full_mock'?15:5);
  expect([2,4,6].map(m=>plan.parts.reduce((s,p)=>s+(p.specRefs![0].startsWith(m+'.')?p.marks:0),0))).toEqual(mode==='full_mock'?[14,41,45]:[1,10,14]);
  expect(plan.parts.every(p=>p.specRefs!.every(r=>/^[246]\./.test(r)))).toBe(true);
  expect(validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot)}).defects).toEqual([]);
  expect(biologyPlanInstructions(plan)).toContain('not an official module weighting');
  if(mode==='short_practice')expect(biologyBatchInstructions(plan,plan.parts.filter(p=>p.parentId==='q6'))).toContain('Representative ecological sampling');
});
it.each([1,2])('resolves and freezes saved contract v%i rather than the new default',version=>{
  const snapshot=version===1?ocrPaper2Snapshot():ocrPaper2V2Snapshot();
  const selection=resolvePaperSelection(lookup,'not_tiered',{paperContract:snapshot.paper_contract});
  expect(selection.paperContract?.contractVersion).toBe(version);
  expect(paperPlanForAttempt(snapshot,{paperContract:{...snapshot.paper_contract,contractVersion:version===1?2:1}})?.contractVersion).toBe(version);
});
it('rejects unsupported/malformed versions and wrong planned topics without a fallback',()=>{
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{paperContract:{...ocrPaper2V2Snapshot().paper_contract,contractVersion:999}})).toThrow();
  const f=ocrPaper2V2Fixture();expect(validateQuestionCandidates(f.rows.map((q,i)=>i===1?{...q,topic_tag:'Foundations in biology'}:q),{plan:f.plan}).ok).toBe(false);
});
it.each(Array.from({length:15},(_,i)=>i))('keeps v2 MCQ %i separately capped with exactly four validated choices',i=>{
  const f=ocrPaper2V2Fixture(),q=f.rows[i],key=singleChoiceKey(q);
  expect(q.marks).toBe(1);expect(key.options).toHaveLength(4);expect(markSingleChoice(q,key.letter).score).toBe(1);
  for(const patch of [{options:['Same','Same','Third','Fourth']},{options:q.options!.slice(0,3)},{correct_answer:'Not a choice'}])expect(validateQuestionCandidates(f.rows.map((r,j)=>j===i?{...r,...patch}:r),{plan:f.plan}).ok).toBe(false);
});
it('keeps v2 practice scoped, cache-isolated and capped without forcing the full plan onto a quiz',()=>{
  const f=ocrPaper2V2Fixture(),old=ocrPaper2Snapshot();
  expect(biologyPracticeCacheVersion(f.snapshot)).not.toBe(biologyPracticeCacheVersion(old));
  expect(biologyPracticeInstructions(f.snapshot)).toContain('BIOLOGICAL DIVERSITY BALANCE');
  expect(biologyPracticeInstructions(f.snapshot)).toContain('preserve its requested count');
  expect(()=>assertBiologyPractice([f.rows[12]],f.snapshot)).not.toThrow();
  expect(()=>assertBiologyPractice([{...f.rows[12],question_text:'Which of the statements are correct?'}],f.snapshot)).toThrow(/invalid_statements/);
  expect(biologyMarkingInstructions(f.snapshot)).toContain('H420/02 Biological diversity');
  expect(buildPaperPlan('custom','not_tiered',course,'paper_2')).toBeNull();
});
