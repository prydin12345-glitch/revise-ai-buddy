// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BIOLOGY_PAPER_PACKS} from '../functions/_shared/biology-course-packs';
import {getCourseOptions,getCourseCapability,resolveCourseAssessmentTier,OCR_ALEVEL_BIOLOGY_ID,OCR_ALEVEL_BIOLOGY_B_ID} from '../functions/_shared/assessment-tier';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {assertBiologyPlanIntegrity,getBiologyPaperPack,biologyBatchInstructions} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {biologyScopeFromContext,biologyScopeInstructions,biologyContentIssue} from '../functions/_shared/gcse-biology-scope';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {coerceMcqOptions,canonicalMcqAnswer} from '../functions/_shared/model-question-normalization';
import {singleChoiceKey,markSingleChoice} from '../functions/_shared/single-choice-marking';
import {biologyPracticeCacheVersion,checkBiologyPracticeCourse} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions,biologyQuestionResourceContext} from '../functions/_shared/biology-marking';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {ocrAlevelFixture,ocrAlevelSnapshot} from './ocr-alevel-fixtures';
const lookup={subject:'Biology Higher',examBoard:'OCR',educationalTier:'level3'};

it.each(['Biology','Biology Higher','OCR A-Level Biology H420','Biology A'])('recognises %s without inferring a course or tier from its name',subject=>{
  expect(getCourseOptions({...lookup,subject}).map(c=>c.id)).toEqual([OCR_ALEVEL_BIOLOGY_ID,OCR_ALEVEL_BIOLOGY_B_ID]);
  expect(getCourseCapability({...lookup,subject})).toBeNull();
  const selected={...lookup,subject,courseId:OCR_ALEVEL_BIOLOGY_ID};
  expect(resolveCourseAssessmentTier(null,selected)).toBe('not_tiered');
  expect(()=>resolveCourseAssessmentTier('higher',selected)).toThrow(/untiered/);
});
it.each(['AS','level2','gcse','university'])('does not apply H420 to %s',educationalTier=>{
  expect(getCourseOptions({...lookup,educationalTier}).some(c=>c.id===OCR_ALEVEL_BIOLOGY_ID)).toBe(false);
});
it.each(['Microbiology','Combined Science'])('does not match an unrelated course %s',subject=>expect(getCourseOptions({...lookup,subject})).toEqual([]));
it('requires explicit supported course, paper and edition',()=>{
  expect(()=>resolvePaperSelection(lookup,null,null)).toThrow(/Select/);
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:OCR_ALEVEL_BIOLOGY_B_ID,paperId:'paper_1'}})).toThrow(/not available/);
  expect(getBiologyPaperPack(OCR_ALEVEL_BIOLOGY_ID)).toBeNull();
  for(const paperId of ['paper_3','paper_4'])expect(()=>resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:OCR_ALEVEL_BIOLOGY_ID,paperId}})).toThrow(/not available/);
  const c=ocrAlevelSnapshot();expect(resolvePaperSelection(lookup,'not_tiered',{paperContract:c.paper_contract}).componentCode).toBe('H420/01');
  expect(()=>paperPlanForAttempt({...c,specification_version:'old'})).toThrow(/fresh/);
});
it.each(['full_mock','short_practice'] as const)('locks %s totals, ordering, scope and schemes before generation',mode=>{
  const {plan,snapshot}=ocrAlevelFixture(mode),count=mode==='full_mock'?15:5;
  expect(()=>assertBiologyPlanIntegrity(plan)).not.toThrow();expect(paperPlanForAttempt(snapshot)).toEqual(plan);
  expect(plan.parts.slice(0,count).map(p=>[p.questionNumber,p.marks,p.responseType,p.section])).toEqual(Array.from({length:count},(_,i)=>[String(i+1),1,'mcq_single','A']));
  expect(plan.parts[count].questionNumber).toBe(`${count+1}(a)`);expect(plan.parts.slice(count).some(p=>p.responseType==='mcq_single')).toBe(false);
  expect([plan.totalMarks,plan.durationMinutes,plan.partCount]).toEqual(mode==='full_mock'?[100,135,43]:[25,34,11]);
  const bad=structuredClone(plan);bad.parts[0].marks=2;expect(()=>assertBiologyPlanIntegrity(bad)).toThrow();
  const prompt=biologyBatchInstructions(plan,plan.parts.slice(0,count));
  expect(prompt).toContain('four distinct');expect(prompt).toContain('SINGLE-SELECT');expect(prompt).toContain('AO1/AO2');
  expect(prompt).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');
});
it('keeps all six MCQ styles and OCR AO proportions in the full template',()=>{
  const {plan}=ocrAlevelFixture();expect(new Set(plan.parts.slice(0,15).map(p=>p.mcqStyle)).size).toBe(6);
  const ao=['AO1','AO2','AO3'].map(a=>plan.parts.reduce((sum,p)=>sum+(p.aoMarks?p.aoMarks[a as 'AO1']??0:p.demand===a?p.marks:0),0));
  expect(ao).toEqual([36,42,22]);expect(plan.parts.filter(p=>p.marks===6).map(p=>p.questionNumber)).toEqual(['17(d)','21(d)']);
});
it.each(['Explain the Calvin cycle.','Describe oxidative phosphorylation.','Explain saltatory conduction.','Calculate the standard deviation from these measurements.','Explain how meiosis creates variation.','Describe how ADH affects a nephron.'])('accepts legitimate OCR content: %s',question_text=>{
  const scope=biologyScopeFromContext(ocrAlevelSnapshot());expect(biologyContentIssue({question_text},scope)).toBeNull();
  expect(biologyScopeInstructions(scope)).toContain('permits standard-deviation calculation');
});
it.each(['Explain the lac operon.','Describe the primary immune response.','Calculate the Hardy-Weinberg allele frequency.'])('blocks direct outside-paper recall: %s',question_text=>expect(biologyContentIssue({question_text},biologyScopeFromContext(ocrAlevelSnapshot()))).toMatch(/Module 4\/6/));
it('accepts the synthetic full draft and rejects structural MCQ defects',()=>{
  const {plan,rows,snapshot}=ocrAlevelFixture();const validate=(draft:any[])=>validateQuestionCandidates(draft,{plan,scope:biologyScopeFromContext(snapshot)});
  expect(validate(rows).defects).toEqual([]);
  for(const patch of [{options:null},{options:['one','two','three']},{options:['same',' SAME ','other','third']},{correct_answer:'not a choice'},{marks:2},{question_type:'written'}]){
    const draft=structuredClone(rows);Object.assign(draft[0],patch);expect(validate(draft).ok).toBe(false);
  }
  const noScheme=structuredClone(rows);noScheme.find(q=>q.marks===6)!.correct_answer='Just a model answer.';
  expect(validate(noScheme).defects.some(d=>d.code==='missing_answer')).toBe(true);
});
it.each(['options','choices','answer_options'])('keeps A-D option order and key using %s aliases',alias=>{
  const raw={[alias]:{D:'Fourth',B:'Second',A:'First',C:'Third'},expected_answer:'B'};
  expect(coerceMcqOptions(raw)).toEqual(['First','Second','Third','Fourth']);expect(singleChoiceKey(raw).index).toBe(1);
  expect(canonicalMcqAnswer('C',coerceMcqOptions(raw))).toBe('Third');
});
it.each(['B','b','  B  ','Second'])('marks the saved correct selection %s without a model',answer=>expect(markSingleChoice({options:['First','Second','Third','Fourth'],correct_answer:'Second'},answer).score).toBe(1));
it.each(['','A','A and B','B or C','Second and Third',null])('does not give partial credit for %s',answer=>expect(markSingleChoice({options:['First','Second','Third','Fourth'],correct_answer:'B'},answer).score).toBe(0));
it.each([{options:['A','B','C','D'],correct_answer:'B'},{options:['one','two','three','four'],correct_answer:''},{options:['one','two','three','four'],correct_answer:'Either one or two'}])('refuses an ambiguous/missing saved key before marking: %j',q=>expect(()=>singleChoiceKey(q)).toThrow());
it('isolates OCR practice cache by course/edition and validates marking context',async()=>{
  const c=ocrAlevelSnapshot('short_practice');expect(()=>checkBiologyPracticeCourse(c)).not.toThrow();
  const instructions=biologyMarkingInstructions(c);expect(instructions).toContain('H420/01');expect(instructions).toContain('communication');
  expect(()=>biologyMarkingInstructions({...c,component_code:'H420/02'})).toThrow();
  const key={subject:'Biology',examBoard:'OCR',educationalLevel:'level3',assessmentTier:'not_tiered' as const,courseId:c.course_id,paperId:c.paper_id,presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),topics:['Foundations in biology'],difficulty:'mixed',questionFormat:'mcq',questionCount:5};
  expect(await buildCacheKey(key)).not.toBe(await buildCacheKey({...key,courseId:'aqa_alevel_biology_7402'}));
  expect(await buildCacheKey(key)).not.toBe(await buildCacheKey({...key,paperId:'paper_2'}));
  const q=ocrAlevelFixture().rows.find(q=>q.question_number==='8')!;
  expect(biologyQuestionResourceContext(ocrAlevelSnapshot(),q)).toContain('Measurements');
  expect(()=>biologyQuestionResourceContext(ocrAlevelSnapshot(),{...q,diagram_config:null})).toThrow(/graph/);
});

it('preserves all 42 preceding plans, definitions and generation/batch prompts',()=>{
  const baseline=JSON.parse(readFileSync('supabase/tests/fixtures/biology-pre-ocr-alevel-baseline.json','utf8'));
  expect(baseline).toHaveLength(42);
  const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  for(const row of baseline){
    const [id,tier,mode]=row.id.split('/');const pack=BIOLOGY_PAPER_PACKS.find(p=>p.id===id)!;
    const plan=pack.build(mode,tier)!;
    expect({id:row.id,plan:hash(plan),definition:hash(pack.definition(tier)),instructions:hash(pack.instructions(plan)),batch:hash(biologyBatchInstructions(plan,plan.parts.filter(p=>p.parentId===plan.parts[0].parentId)))}).toEqual(row);
  }
});
