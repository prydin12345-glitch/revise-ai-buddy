// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {monohybridCross, savedBiologyDiagram, biologyDiagramIssues, biologyCalculationResult, readPercentageResult, statedFoodChain} from '../functions/_shared/biology-assessment-resources';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {prepareGroupRepair} from '../functions/_shared/prepare-group-repair';
import {studentQuestion} from '../functions/_shared/exam-access';
import {blankCross, mouseQuestion, mouseText, parentTable, lakeTable, lakeQuestion, lakeText, lakeOrganisms, relayQuestion} from './fixtures/biology-resource-cases';

const gcse = {scope:{subject:'Biology',educationalLevel:'GCSE'}};

describe('scientific resources use the actual saved inputs', () => {
  it.each([['Bb','bb',50,'1:1'],['Bb','Bb',75,'3:1'],['BB','bb',100,'1:0'],['bb','bb',0,'0:1'],['bB','bb',50,'1:1']])(
    'calculates %s × %s', (a,b,percent,ratio) => {
      expect(monohybridCross(a,b)).toMatchObject({dominantPercent:percent,ratio});
    });
  it.each([[undefined,'bb'],['Bb','Cc'],['AaBb','AaBb'],['A','a']])('never guesses incomplete or unsupported parents', (a,b) => {
    expect(monohybridCross(a,b)).toBeNull();
  });
  it('rejects the reported heterozygote/heterozygote substitution', () => {
    const q = {...mouseQuestion, diagram_config: {...blankCross, parent2:'Bb'}};
    expect(validateQuestionCandidates([q]).defects.some(d=>d.code==='conflicting_resource_data')).toBe(true);
    expect(savedBiologyDiagram(q)).toBeNull();
  });
  it('does not draw any figure just because prose mentions a cross, food chain or relay neurone', () => {
    for (const q of [mouseQuestion,lakeQuestion,relayQuestion]) expect(savedBiologyDiagram(q)).toBeNull();
    expect(savedBiologyDiagram({...mouseQuestion,diagram_config:blankCross})).toEqual(blankCross);
  });
  it('blocks a motor neurone given for a relay-neurone task', () => {
    expect(biologyDiagramIssues({type:'neuron',variant:'motor'},relayQuestion.question_text).length).toBeGreaterThan(0);
    expect(biologyDiagramIssues({type:'neuron',variant:'relay'},relayQuestion.question_text)).toEqual([]);
  });
  it('rejects conflicting Biology aliases before saving or printing', () => {
    const q={...relayQuestion,diagram_config:{type:'animal_cell'},diagramConfig:{type:'plant_cell'}};
    expect(validateQuestionCandidates([q]).defects.some(d=>d.code==='conflicting_resource_data')).toBe(true);
    expect(savedBiologyDiagram(q)).toBeNull();
  });
  it('requires food identities and explicit web links', () => {
    expect(biologyDiagramIssues({type:'food_chain'}).length).toBeGreaterThan(0);
    expect(biologyDiagramIssues({type:'food_chain',organisms:lakeOrganisms})).toEqual([]);
    expect(biologyDiagramIssues({type:'food_web',organisms:lakeOrganisms}).length).toBeGreaterThan(0);
    expect(biologyDiagramIssues({type:'food_web',organisms:lakeOrganisms,feedingLinks:[{from:'Algae',to:'Fox'}]}).length).toBeGreaterThan(0);
  });
});

describe('resources and private calculation keys agree', () => {
  it('accepts the reconstructed valid cases', () => {
    expect(validateQuestionCandidates([mouseQuestion,lakeQuestion,relayQuestion]).ok).toBe(true);
  });
  it.each(['50%','50% black and 50% white','Answer is 50%.','2/4 × 100 = 50%.','Final answer: $50\\%$'])('accepts normal answer format %s', key => {
    expect(readPercentageResult(key)).toBe(50);
    expect(validateQuestionCandidates([{...mouseQuestion,correct_answer:key}]).ok).toBe(true);
  });
  it('rejects the incorrect 3:1 ratio and 75% key', () => {
    const result=validateQuestionCandidates([{...mouseQuestion,correct_answer:'Phenotype ratio: 3:1. Final answer: 75%.'}]);
    expect(result.defects.some(d=>d.code==='answer_mismatch')).toBe(true);
  });
  it('requires numeric source data instead of substituting a picture', () => {
    const result=validateQuestionCandidates([{...lakeQuestion,diagram_config:{type:'food_chain',organisms:lakeOrganisms}}],gcse);
    expect(result.ok).toBe(false);
    expect(biologyCalculationResult({...lakeTable,rows:[['Algae',null],['Water fleas',180]]}).issue).toBeTruthy();
  });
  it('refuses zero denominators, wrong units, invented row names and swapped values', () => {
    for (const resource of [
      {...lakeTable,rows:[['Algae',0],['Water fleas',180]]},
      {...lakeTable,biology_calculation:{...lakeTable.biology_calculation,unit:'kg'}},
      {...lakeTable,biology_calculation:{...lakeTable.biology_calculation,to:'Rabbit'}},
      {...lakeTable,rows:[['Algae',100],['Water fleas',180]]},
    ]) expect(biologyCalculationResult(resource).issue).toBeTruthy();
  });
  it('recomputes from changed values instead of keeping a stale key', () => {
    const q={...lakeQuestion,diagram_config:{...lakeTable,rows:[['Algae',1200],['Water fleas',120]]}};
    expect(validateQuestionCandidates([q]).defects.some(d=>d.code==='answer_mismatch')).toBe(true);
    expect(validateQuestionCandidates([{...q,correct_answer:'120/1200 ×100 =10%.'}]).ok).toBe(true);
  });
  it('rejects completed offspring and revealing captions in the assessment stimulus', () => {
    for (const resource of [
      {...parentTable,rows:[...parentTable.rows,['Offspring','Bb']]},
      {...parentTable,caption:'Final answer: 50%'},
    ]) expect(validateQuestionCandidates([{...mouseQuestion,diagram_config:resource}]).ok).toBe(false);
  });
  it('validates a complete repaired resource and key together', () => {
    const broken={...mouseQuestion,correct_answer:'75%'};
    const repair={...mouseQuestion,task:'Calculate the expected percentage of black offspring.',context:mouseText.split(' Calculate')[0]};
    expect(prepareGroupRepair([broken],[repair],{})?.['4(c)'].diagram_config).toEqual(parentTable);
    expect(prepareGroupRepair([broken],[{...repair,correct_answer:'75%'}],{})).toBeNull();
  });
  it('projects public inputs without leaking a completed cross or calculation result', () => {
    const publicQ=studentQuestion({...mouseQuestion,diagram_config:{...blankCross,offspring:[['Bb','bb']],phenotypeRatio:'1:1',mode:'solution',
      biology_calculation:{...parentTable.biology_calculation,result:50,finalAnswer:'50%',worked_solution:'50%'}}});
    expect(publicQ.correct_answer).toBeUndefined();
    expect(publicQ.diagram_config).toEqual({...blankCross,biology_calculation:parentTable.biology_calculation});
  });
  it('keeps a biomass calculation tied to an explicit food chain elsewhere in the same group', () => {
    expect(statedFoodChain(lakeText)).toEqual(lakeOrganisms);
    const context = {...lakeQuestion, question_number:'9', marks:0, question_text:lakeText.split('. Use')[0]+'.', diagram_config:undefined};
    const calculation = {...lakeQuestion, question_text:'Use the table to calculate the percentage of biomass transferred from Grass to Rabbit.',
      diagram_config:{...lakeTable,rows:[['Grass',1200],['Rabbit',180]],
        biology_calculation:{...lakeTable.biology_calculation,from:'Grass',to:'Rabbit'}}};
    expect(validateQuestionCandidates([context,calculation],gcse).defects.some(d=>d.code==='conflicting_resource_data')).toBe(true);
    expect(validateQuestionCandidates([context,{...calculation,root_question_number:'10'}],gcse).ok).toBe(true);
    expect(biologyDiagramIssues({type:'food_chain',organisms:['Grass','Rabbit','Fox']},lakeText)[0].code).toBe('conflicting_resource_data');
  });
  it('does not impose the new GCSE input contract on unrelated qualifications', () => {
    const q = {...mouseQuestion, diagram_config:undefined};
    expect(validateQuestionCandidates([q],gcse).ok).toBe(false);
    expect(validateQuestionCandidates([q],{scope:{subject:'Biology',educationalLevel:'A-Level'}}).ok).toBe(true);
  });
});
