// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {assembledModelText, canonicalMcqAnswer, coerceMcqOptions, flattenAnswerKey, hasThreeLevelScheme, normalizeGeneratedQuestion, readAnswerKey} from '../functions/_shared/model-question-normalization.ts';
import {hasAssessedTask, validateQuestionCandidates} from '../functions/_shared/question-contract-validator.ts';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair.ts';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair.ts';
import {gatewayFixture} from './ocr-fixtures';
import {OCR_GATEWAY_BIOLOGY_ID} from '../functions/_shared/assessment-tier.ts';

const choices=['Nucleus','Membrane','Ribosome','Cytoplasm'];
const scope={subject:'Biology',examBoard:'OCR',educationalLevel:'GCSE',assessmentTier:'foundation' as const,courseId:OCR_GATEWAY_BIOLOGY_ID};
const mcq={id:'q1',question_number:'1',root_question_number:'1',question_type:'mcq',marks:1,
  question_text:'Which structure contains genetic material?',options:choices,correct_answer:'Nucleus'};

describe('lossless model-output normalisation',()=>{
  it.each([
    {options:choices},
    {choices:{D:'Cytoplasm',B:'Membrane',A:'Nucleus',C:'Ribosome'}},
    {answer_options:[{label:'B',text:'Membrane'},{label:'A',text:'Nucleus'},{label:'D',text:'Cytoplasm'},{label:'C',text:'Ribosome'}]},
    {choices:'A. Nucleus\nB. Membrane\nC. Ribosome\nD. Cytoplasm'},
  ])('preserves all four options and their letter mapping: %j',raw=>{
    expect(coerceMcqOptions(raw)).toEqual(choices);
    expect(canonicalMcqAnswer('C. Ribosome',coerceMcqOptions(raw))).toBe('Ribosome');
  });
  it('does not remove a blank option and shift the meaning of answer C',()=>{
    const options=['Nucleus','','Ribosome','Cytoplasm'];
    expect(coerceMcqOptions({options})).toEqual(options);
    expect(validateQuestionCandidates([{...mcq,options,correct_answer:'C'}]).defects.some(d=>d.code==='invalid_options')).toBe(true);
  });
  it('does not strip the genus initial from a scientific name',()=>{
    expect(coerceMcqOptions({options:['E. coli','Yeast','Mushroom','Alga']})).toEqual(['E. coli','Yeast','Mushroom','Alga']);
  });
  it('does not turn an empty labelled option into the letter itself',()=>{
    expect(coerceMcqOptions({choices:{A:'Nucleus',B:'',C:'Ribosome',D:'Cytoplasm'}})).toEqual(['Nucleus','','Ribosome','Cytoplasm']);
  });
  it('rejects conflicting aliases and noncontiguous labels rather than guessing',()=>{
    expect(coerceMcqOptions({options:choices,choices:['Other','Membrane','Ribosome','Cytoplasm']})).toBeNull();
    expect(coerceMcqOptions({choices:{A:'Nucleus',B:'Membrane',D:'Ribosome',E:'Cytoplasm'}})).toBeNull();
    expect(canonicalMcqAnswer('C. Nucleus',choices)).toBe('C. Nucleus');
  });
  it('rejects duplicate choices even outside the guided OCR plan',()=>{
    expect(validateQuestionCandidates([{...mcq,options:['Nucleus','Nucleus','Ribosome','Cytoplasm']}]).ok).toBe(false);
  });
  it('retains a complete question_text when a context-only alias accompanies it',()=>{
    const context='A plant cell has several structures.';
    expect(assembledModelText({context,question_text:context+' Which structure contains genetic material?'})).toContain('Which structure');
  });
  it('preserves task aliases and MCQ types from the model before draft storage',()=>{
    const result=normalizeGeneratedQuestion({...mcq,question_text:'A cell is shown.',context:'A cell is shown.',task:'',instruction:mcq.question_text,
      question_type:'multiple_choice',correct_answer:'',expected_answer:'A'});
    expect(result.question_type).toBe('mcq');
    expect(result.correct_answer).toBe('Nucleus');
    expect(result.question_text).toBe('A cell is shown.\n\n'+mcq.question_text);
  });
  it('retains the range and indicative content alongside a level descriptor',()=>{
    const key=flattenAnswerKey([{level:1,marks:'1-2',descriptor:'Some relevant science.',indicative_content:['Heat is lost by evaporation.']}]);
    expect(key).toContain('Level 1'); expect(key).toContain('1-2'); expect(key).toContain('Heat is lost by evaporation');
    expect(flattenAnswerKey({'Level 1 (1-2 marks)':'Some relevant science.'})).toContain('Level 1 (1-2 marks)');
  });
  it('combines the model answer with its separately returned private mark scheme',()=>{
    const key=readAnswerKey({correct_answer:'',expected_answer:'An explanation.',mark_scheme:{level_1:'Simple science.',level_2:'Linked science.',level_3:'Detailed science.'}});
    expect(key).toContain('An explanation.'); expect(hasThreeLevelScheme(key)).toBe(true);
    expect(readAnswerKey({correct_answer:{},expected_answer:'Usable answer.'})).toBe('Usable answer.');
  });
  it('rejects three empty level headings and accepts structured populated bands',()=>{
    expect(hasThreeLevelScheme('Level 1 (1-2); Level 2 (3-4); Level 3 (5-6)')).toBe(false);
    expect(hasThreeLevelScheme({level_1:'Simple statements.',level_2:'Links effects.',level_3:'Coherent explanation.'})).toBe(true);
  });
  it('recognises adverb chains but still rejects background-only prose',()=>{
    expect(hasAssessedTask('Now briefly outline the two main stages of photosynthesis.')).toBe(true);
    expect(hasAssessedTask('The scientist briefly outlined the procedure.')).toBe(false);
  });
});

describe('repair choices, tasks and prompts stay consistent',()=>{
  it('keeps existing choices in a full MCQ repair when they were not resupplied',()=>{
    const result=analyseGroupRepair([mcq],[{question_number:'1',instruction:mcq.question_text,expected_answer:'Nucleus'}],scope);
    expect(result.ok).toBe(true); expect(result.replacements['1'].options).toEqual(choices);
  });
  it('does not substitute old choices for explicitly conflicting rewritten choices',()=>{
    const result=analyseGroupRepair([mcq],[{question_number:'1',task:mcq.question_text,correct_answer:'Nucleus',options:choices,choices:['Other','Membrane','Ribosome','Cytoplasm']}],scope);
    expect(result.ok).toBe(false); expect(result.diagnostics[0].code).toBe('invalid_options');
  });
  it('rejects changed choices hidden under an alias during task-only repair',()=>{
    const result=analyseGroupRepair([mcq],[{question_number:'1',task:mcq.question_text,correct_answer:'Other',choices:['Other','Membrane','Ribosome','Cytoplasm']}],scope,new Set(),new Set(['1']),'task_only');
    expect(result.ok).toBe(false); expect(result.diagnostics[0].code).toBe('source_changed');
  });
  it('never asks for a new options array in a task-only MCQ repair',()=>{
    const prompt=buildQuestionRepairPrompt({group:[mcq],subject:'Biology',scope,defects:'missing_task',plan:gatewayFixture().plan,mode:'task_only',targetNumbers:new Set(['1'])});
    expect(prompt).toContain('do not emit or change the choices');
    expect(prompt).not.toContain('Return an "options" array');
    expect(JSON.parse(prompt.split('Return JSON only: ')[1]).parts[0]).not.toHaveProperty('options');
  });
  it('requires choices in a full rewrite and shows a non-null MCQ example',()=>{
    const prompt=buildQuestionRepairPrompt({group:[mcq],subject:'Biology',scope,defects:'invalid_options',plan:gatewayFixture().plan,mode:'full_group',targetNumbers:new Set(['1'])});
    expect(JSON.parse(prompt.split('Return JSON only: ')[1]).parts[0].options).toHaveLength(4);
  });
});
