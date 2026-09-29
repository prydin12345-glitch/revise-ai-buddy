// @vitest-environment node
import {expect,it} from 'vitest';
import {buildAqaAlevelPaper3Plan} from '../functions/_shared/aqa-alevel-biology-paper3-contract';
import {assertBiologyPlanIntegrity,biologyBatchInstructions,getBiologyPaperPack} from '../functions/_shared/biology-course-packs';
import {paperPlanForAttempt} from '../functions/_shared/course-selection';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext,biologyContentIssue} from '../functions/_shared/gcse-biology-scope';
import {readBiologyEssay,serializeBiologyEssayAnswer,parseBiologyEssayAnswer,hasBiologyEssayText} from '../functions/_shared/biology-essay';
import {prepareBiologyEssayMarking,requireBiologyEssayKey,validateBiologyEssayGrade} from '../functions/_shared/biology-essay-marking';
import {readAnswerKey} from '../functions/_shared/model-question-normalization';
import {studentQuestion} from '../functions/_shared/exam-access';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair';
import {biologyPracticeInstructions,biologyPracticeCacheVersion,assertBiologyPractice} from '../functions/_shared/biology-practice';
import {biologyEssayForMarking,biologyQuestionResourceContext} from '../functions/_shared/biology-marking';
import {alevelPaper3Fixture,alevelPaper3Snapshot,essayKey,essayResource} from './aqa-alevel-paper3-fixtures';
import {alevelSnapshot} from './aqa-alevel-fixtures';
import {alevelPaper2Snapshot} from './aqa-alevel-paper2-fixtures';
function validate(rows:any[],mode:'full_mock'|'short_practice'='full_mock'){
  const {plan,snapshot}=alevelPaper3Fixture(mode);
  return validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot),expectedTotalMarks:plan.totalMarks,expectedPartCount:plan.partCount});
}
it('plans 38 structured + 15 analysis + one 25-mark essay with the intended AO totals',()=>{
  const {plan}=alevelPaper3Fixture();expect([plan.totalMarks,plan.durationMinutes,plan.parentCount,plan.partCount]).toEqual([78,120,6,18]);
  expect(['structured','critical_analysis','synoptic_essay'].map(role=>plan.parts.filter(p=>p.assessmentRole===role).reduce((s,p)=>s+p.marks,0))).toEqual([38,15,25]);
  expect(['AO1','AO2','AO3'].map(ao=>plan.parts.reduce((s,p)=>s+(p.aoMarks?.[ao as 'AO1']??(p.demand===ao?p.marks:0)),0))).toEqual([24,29,25]);
  expect(plan.parts.some(p=>p.responseType==='mcq_single')).toBe(false);expect(()=>assertBiologyPlanIntegrity(plan)).not.toThrow();
  expect(()=>buildAqaAlevelPaper3Plan('full_mock','higher')).toThrow(/untiered/);expect(buildAqaAlevelPaper3Plan('custom','not_tiered')).toBeNull();
});
it.each(['full_mock','short_practice'] as const)('validates the complete %s and protected component',mode=>{
  const {plan,rows,snapshot}=alevelPaper3Fixture(mode);expect(validate(rows,mode).defects).toEqual([]);expect(paperPlanForAttempt(snapshot)).toEqual(plan);
  expect(getBiologyPaperPack(plan.courseId,'paper_3')?.definition('not_tiered').topics).toHaveLength(8);
  if(mode==='short_practice')expect([plan.totalMarks,plan.durationMinutes,plan.partCount]).toEqual([40,70,5]);
  expect(()=>paperPlanForAttempt({...snapshot,component_code:'7402/2'})).toThrow();
});
it('permits synoptic whole-course content without removing earlier-paper boundaries',()=>{
  const p3=biologyScopeFromContext(alevelPaper3Snapshot());
  for(const question_text of ['Explain the Calvin cycle.','Describe the Krebs cycle.','Explain PCR.','Explain ATP synthase.'])expect(biologyContentIssue({question_text},p3)).toBeNull();
  expect(biologyContentIssue({question_text:'Explain the Calvin cycle.'},biologyScopeFromContext(alevelSnapshot()))).not.toBeNull();
  expect(biologyContentIssue({question_text:'Calculate the standard deviation of these values.'},p3)).not.toBeNull();
});
it('requests a single scored essay with two public titles and private title-specific guidance',()=>{
  const {plan}=alevelPaper3Fixture(),prompt=biologyBatchInstructions(plan,[plan.parts.at(-1)!]);
  expect(prompt).toContain('7402/3');expect(prompt).toContain('biology_essay_choice');expect(prompt).toContain('biology_essay_key');expect(prompt).toContain('4–10');
});
it.each(['missing_titles','duplicate_titles','extra_private_field','bad_version','mismatched_key','narrow_key','wrong_slot','conflicting_dataset'])('blocks %s before readiness',fault=>{
  const {rows}=alevelPaper3Fixture(),essay=rows.at(-1);
  if(fault==='missing_titles')essay.diagram_config=null;
  if(fault==='duplicate_titles')essay.diagram_config.titles[1].title=essay.diagram_config.titles[0].title;
  if(fault==='extra_private_field')essay.diagram_config.correct_answer='secret';
  if(fault==='bad_version')essay.diagram_config.version=99;
  if(fault==='mismatched_key'){const k=JSON.parse(essay.correct_answer);k.titles[0].title='A different title';essay.correct_answer=JSON.stringify(k);}
  if(fault==='narrow_key'){const k=JSON.parse(essay.correct_answer);for(const a of k.titles[0].areas)a.specRef='3.1.4.2';essay.correct_answer=JSON.stringify(k);}
  if(fault==='wrong_slot')rows[0].diagram_config=structuredClone(essayResource);
  if(fault==='conflicting_dataset')rows.find(q=>q.question_number==='5(b)').diagram_config.rows[0][1]=999;
  expect(validate(rows).defects.length).toBeGreaterThan(0);
});
it('compares experimental data semantically rather than by object property order',()=>{
  const {rows}=alevelPaper3Fixture(),q=rows.find(q=>q.question_number==='5(b)'),t=q.diagram_config;
  q.diagram_config={rows:t.rows,caption:t.caption,units:t.units,headers:t.headers,type:t.type};expect(validate(rows).defects).toEqual([]);
});
it('requires four distinct topic areas rather than four course chapters',()=>{
  const key=structuredClone(essayKey);
  for(const title of key.titles)title.areas.forEach((a,i)=>a.specRef=['3.1.1','3.1.2','3.1.3','3.1.4.2'][i]);
  expect(()=>requireBiologyEssayKey(key,essayResource as any)).not.toThrow();
});
it('preserves structured answer-key aliases and rejects conflicting private schemes',()=>{
  expect(JSON.parse(readAnswerKey({expected_answer:essayKey}))).toEqual(essayKey);
  expect(()=>readAnswerKey({correct_answer:essayKey,mark_scheme:{...essayKey,version:2}})).toThrow(/Conflicting/);
});
it('accepts equivalent private aliases with reordered JSON properties',()=>{
  const reorder=(v:any):any=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
  expect(JSON.parse(readAnswerKey({correct_answer:essayKey,mark_scheme:reorder(essayKey)}))).toEqual(essayKey);
});
it('repairs titles and keys together without a contradictory table-only instruction',()=>{
  const {rows,plan,snapshot}=alevelPaper3Fixture(),q=rows.at(-1),scope=biologyScopeFromContext(snapshot);
  const result=analyseGroupRepair([q],[{question_number:q.question_number,task:q.question_text,expected_answer:essayKey,diagram_config:q.diagram_config}],scope);
  expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true);
  const prompt=buildQuestionRepairPrompt({group:[q],scope,plan,subject:'Biology',defects:'missing titles',mode:'full_group',targetNumbers:new Set()});
  expect(prompt).toContain('biology_essay_key');expect(prompt).not.toContain('Store one coherent results table');
});
it('projects only the two public titles, never keys or nested private fields',()=>{
  const q=alevelPaper3Fixture().rows.at(-1);q.diagram_config.secret='PRIVATE HIDDEN';q.diagram_config.titles[0].answer='PRIVATE NESTED';
  const json=JSON.stringify(studentQuestion(q));expect(json).toContain(essayResource.titles[0].title);expect(json).not.toContain('PRIVATE');expect(json).not.toContain('secret');
});
it('serializes A/B alongside essay text and does not count a choice as an answer',()=>{
  const saved=serializeBiologyEssayAnswer('B','My written answer');expect(parseBiologyEssayAnswer(saved)).toEqual({choice:'B',text:'My written answer',invalidChoice:false});
  expect(hasBiologyEssayText(serializeBiologyEssayAnswer('A',''))).toBe(false);expect(parseBiologyEssayAnswer('[Essay C]\nWrong choice').invalidChoice).toBe(true);
});
it.each(['A','B'] as const)('marks only chosen title %s with the holistic rubric',choice=>{
  const {rows,snapshot}=alevelPaper3Fixture(),result=biologyEssayForMarking(snapshot,rows.at(-1),serializeBiologyEssayAnswer(choice,'My essay'))!;
  expect(result.system).toContain('21–25');expect(result.system).toContain('24–25');expect(result.user).toContain(`PRIVATE ESSAY ${choice}`);expect(result.user).not.toContain(`PRIVATE ESSAY ${choice==='A'?'B':'A'}`);
});
it('does not guess an unselected title or trust an essay payload in another slot',()=>{
  const {rows,snapshot}=alevelPaper3Fixture();expect(()=>prepareBiologyEssayMarking(rows.at(-1),'My essay without a title choice')).toThrow(/Choose/);
  expect(()=>biologyEssayForMarking(snapshot,{...rows.at(-1),question_number:'1(a)'},'[Essay A]\nText')).toThrow(/slot/);
  const q=rows.find(q=>q.question_number==='5(a)');expect(()=>biologyQuestionResourceContext(snapshot,{...q,diagram_config:null})).toThrow(/missing/);
});
it.each([{score:26,essay_band:5,essay_choice:'A'},{score:19.5,essay_band:4,essay_choice:'A'},{score:19,essay_band:5,essay_choice:'A'},{score:19,essay_band:4,essay_choice:'B'}])('refuses invalid essay grading %j',grade=>{
  expect(()=>validateBiologyEssayGrade(grade,'A')).toThrow();
});
it('separates ordinary quizzes and all three paper caches',()=>{
  const c=alevelPaper3Snapshot();expect(new Set([c,alevelSnapshot(),alevelPaper2Snapshot()].map(biologyPracticeCacheVersion)).size).toBe(3);
  expect(biologyPracticeInstructions(c)).toContain('ordinary quiz');expect(()=>assertBiologyPractice([alevelPaper3Fixture().rows.at(-1)],c)).toThrow(/essay/i);
});
