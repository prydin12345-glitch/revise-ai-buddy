// @vitest-environment node
import {expect,it} from 'vitest';
import {buildAqaAlevelPaper2Plan} from '../functions/_shared/aqa-alevel-biology-paper2-contract';
import {assertBiologyPlanIntegrity,getBiologyPaperPack,biologyBatchInstructions} from '../functions/_shared/biology-course-packs';
import {paperPlanForAttempt} from '../functions/_shared/course-selection';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext,biologyContentIssue} from '../functions/_shared/gcse-biology-scope';
import {expandComprehensionReferences,comprehensionInsertFigures,readComprehension,comprehensionTaskIssues} from '../functions/_shared/biology-comprehension';
import {biologyPracticeCacheVersion,biologyPracticeInstructions} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions,biologyQuestionResourceContext} from '../functions/_shared/biology-marking';
import {studentQuestion} from '../functions/_shared/exam-access';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair';
import {alevelPaper2Fixture,alevelPaper2Snapshot,readingParagraphs} from './aqa-alevel-paper2-fixtures';
import {alevelSnapshot} from './aqa-alevel-fixtures';

function validate(rows:any[],mode:'full_mock'|'short_practice'='full_mock'){
  const {plan,snapshot}=alevelPaper2Fixture(mode);
  return validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot),expectedTotalMarks:plan.totalMarks,expectedPartCount:plan.partCount});
}
it('builds 76 structured marks plus 15 comprehension marks at the published Paper 2 AO ranges',()=>{
  const {plan}=alevelPaper2Fixture();
  expect([plan.totalMarks,plan.durationMinutes,plan.parentCount,plan.partCount]).toEqual([91,120,9,35]);
  expect(plan.parts.filter(p=>p.assessmentRole==='structured').reduce((s,p)=>s+p.marks,0)).toBe(76);
  expect(plan.parts.filter(p=>p.assessmentRole==='comprehension').reduce((s,p)=>s+p.marks,0)).toBe(15);
  expect(['AO1','AO2','AO3'].map(ao=>plan.parts.filter(p=>p.demand===ao).reduce((s,p)=>s+p.marks,0))).toEqual([24,49,18]);
  expect(plan.parts.some(p=>p.marks===25||p.responseType==='mcq_single')).toBe(false);
  expect(()=>assertBiologyPlanIntegrity(plan)).not.toThrow();
  expect(getBiologyPaperPack(plan.courseId,'paper_3')).toBeNull();
  expect(()=>buildAqaAlevelPaper2Plan('full_mock','higher')).toThrow(/untiered/);
});
it.each(['full_mock','short_practice'] as const)('validates the complete %s and frozen identity',mode=>{
  const {plan,rows,snapshot}=alevelPaper2Fixture(mode);
  expect(validate(rows,mode).defects).toEqual([]);expect(paperPlanForAttempt(snapshot)).toEqual(plan);
  if(mode==='short_practice')expect([plan.totalMarks,plan.durationMinutes,plan.partCount]).toEqual([25,33,9]);
  expect(()=>paperPlanForAttempt({...snapshot,component_code:'7402/1'})).toThrow();
  expect(()=>paperPlanForAttempt({...snapshot,paper_contract:{...snapshot.paper_contract,paperId:'paper_1'}})).toThrow();
});
it('allows Paper 2 biological mechanisms while maintaining the Paper 1 boundary',()=>{
  for(const question_text of ['Explain the Calvin cycle.','Describe the Krebs cycle.','Explain chemiosmosis in respiration.','Explain how ADH controls water reabsorption.','Describe PCR.','Calculate the Hardy-Weinberg frequency.']){
    expect(biologyContentIssue({question_text},biologyScopeFromContext(alevelPaper2Snapshot()))).toBeNull();
  }
  expect(biologyContentIssue({question_text:'Explain the Calvin cycle.'},biologyScopeFromContext(alevelSnapshot()))).not.toBeNull();
  expect(biologyContentIssue({question_text:'Calculate the standard deviation of these values.'},biologyScopeFromContext(alevelPaper2Snapshot()))).not.toBeNull();
});
it('asks for one original source with numbered paragraphs and source-linked questions in the reading batch',()=>{
  const {plan}=alevelPaper2Fixture();const prompt=biologyBatchInstructions(plan,plan.parts.slice(-5));
  expect(prompt).toContain('7402/2');expect(prompt).toContain('biology_comprehension_ref');expect(prompt).toContain('350–650');
  expect(prompt).toContain('9(e)');expect(prompt).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');
});
it.each(['missing','conflicting','private_field','too_short','bad_paragraph','unprinted_line'])('blocks %s comprehension evidence',fault=>{
  const {rows}=alevelPaper2Fixture();const row=rows.find(q=>q.question_number==='9(b)');row.diagram_config=structuredClone(row.diagram_config);
  if(fault==='missing')row.diagram_config=null;
  if(fault==='conflicting')row.diagram_config.title='A different investigation';
  if(fault==='private_field')row.diagram_config.correct_answer='PRIVATE KEY';
  if(fault==='too_short')row.diagram_config.paragraphs=['One.','Two.','Three.','Four.'];
  if(fault==='bad_paragraph')row.question_text='Using paragraph 12, explain the conclusion.';
  if(fault==='unprinted_line')row.question_text='Using paragraph 1 and lines 2 to 4, explain the conclusion.';
  expect(validate(rows).defects.length).toBeGreaterThan(0);
});
it('resolves references only from an unambiguous same-parent source and inserts it once',()=>{
  const {rows}=alevelPaper2Fixture();const group=rows.slice(-5);
  const refs=group.map((q,i)=>({...q,diagram_config:i?{type:'biology_comprehension_ref',resourceId:'q9_reading'}:q.diagram_config}));
  const expanded=expandComprehensionReferences(refs);
  expect(expanded.every(q=>readComprehension(q).passage?.paragraphs.length===6)).toBe(true);
  expect(comprehensionInsertFigures(expanded)).toHaveLength(1);
  expect(readComprehension(expandComprehensionReferences([refs[0],{...refs[1],question_number:'8(b)'}])[1]).issues.length).toBeGreaterThan(0);
});
it('does not mistake numbered cell lines for printed passage line numbers',()=>{
  const row=alevelPaper2Fixture().rows.at(-1);
  expect(comprehensionTaskIssues({...row,question_text:'Using paragraph 1, compare cell lines 2 and 3.'},true)).toEqual([]);
});
it('never chooses silently between conflicting sources',()=>{
  const group=alevelPaper2Fixture().rows.slice(-5);
  group[1].diagram_config={...group[1].diagram_config,title:'Conflicting source'};
  group[2].diagram_config={type:'biology_comprehension_ref',resourceId:'q9_reading'};
  const result=expandComprehensionReferences(group);
  expect(result[2].diagram_config.type).toBe('biology_comprehension_ref');
  expect(()=>comprehensionInsertFigures(result)).toThrow();
});
it('accepts complete group repairs with source references, retains keys and avoids table-only repair instructions',()=>{
  const {rows,plan,snapshot}=alevelPaper2Fixture();const group=rows.slice(-5),scope=biologyScopeFromContext(snapshot);
  const parts=group.map((q,i)=>({question_number:q.question_number,task:q.question_text,correct_answer:q.correct_answer,
    diagram_config:i?{type:'biology_comprehension_ref',resourceId:'q9_reading'}:q.diagram_config}));
  const repaired=analyseGroupRepair(group,parts,scope);
  expect(repaired.diagnostics).toEqual([]);expect(repaired.ok).toBe(true);expect(Object.keys(repaired.replacements)).toHaveLength(5);
  const merged=rows.map(q=>({...q,...repaired.replacements[q.question_number]}));
  expect(validate(merged).defects).toEqual([]);
  const prompt=buildQuestionRepairPrompt({group,scope,plan,subject:'Biology',defects:'missing source',mode:'full_group',targetNumbers:new Set()});
  expect(prompt).toContain('ONE coherent original comprehension passage');expect(prompt).not.toContain('Store one coherent results table');
});
it('projects public reading content without private keys or extra payload fields',()=>{
  const q=alevelPaper2Fixture().rows.at(-1);q.diagram_config={...q.diagram_config,secret:'PRIVATE HIDDEN VALUE'};
  const student=studentQuestion(q);const json=JSON.stringify(student);
  expect(json).not.toContain('PRIVATE');expect(json).not.toContain('secret');expect(json).toContain(readingParagraphs[0]);
});
it('separates the practice cache and gives marking the actual saved reading',()=>{
  const snapshot=alevelPaper2Snapshot(),q=alevelPaper2Fixture().rows.at(-1);
  expect(biologyPracticeCacheVersion(snapshot)).not.toBe(biologyPracticeCacheVersion(alevelSnapshot()));
  expect(biologyPracticeInstructions(snapshot)).toContain('7402/2');
  expect(biologyMarkingInstructions(snapshot)).toContain('point-based');
  expect(biologyQuestionResourceContext(snapshot,q)).toContain(readingParagraphs[0]);
  expect(()=>biologyQuestionResourceContext(snapshot,{...q,diagram_config:null})).toThrow(/missing/);
});
