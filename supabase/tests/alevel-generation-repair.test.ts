// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {hasAssessedTask,validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {coerceChart,resolveQuestionResources} from '../functions/_shared/question-resources';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {alevelFixture,alevelSnapshot} from './aqa-alevel-fixtures';
import {extract,boundaryHandler} from './aqa-alevel-runtime';

const scope=biologyScopeFromContext(alevelSnapshot());
const instruction='Distinguish between magnification and resolution in microscopy.';
const key='Magnification is image size divided by object size (1); resolution is the ability to distinguish two close points (1).';
const table={type:'data_table',headers:['Sample','Count'],rows:[[1,2],[2,4],[3,6]]};
const keyedTable={...table,rows:[{Count:2,Sample:1},{Sample:2,Count:4},{Count:6,Sample:3}]};
const groupFrom=(request:any):any[]=>JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
const repaired=(row:any)=>({question_number:row.question_number,task:row.question_text,correct_answer:row.correct_answer,diagram_config:row.diagram_config});

describe('reported A-level task failure',()=>{
  it.each([instruction,'Briefly '+instruction.toLowerCase(),'Using your knowledge, '+instruction.toLowerCase()])('accepts a real instruction: %s',task=>{
    expect(hasAssessedTask(task)).toBe(true);
    expect(validateQuestionCandidates([{question_number:'2(a)',marks:2,task,correct_answer:key}],{scope}).ok).toBe(true);
  });
  it.each(['The student distinguished the cells.','Magnification and resolution differ.','The table shows measurements.'])('still blocks context alone: %s',task=>{
    expect(hasAssessedTask(task)).toBe(false);
  });
  it('accepts and saves the exact rejected rewrite without three wasted attempts',async()=>{
    const r=await extract({mutate(q){q.find(p=>p.question_number==='2(a)').question_text='A student investigated microscopy.';},
      repair(){return {parts:[{question_number:'2(a)',task:instruction,correct_answer:key}]};}});
    expect(String(r.error??'')).toBe('');expect(r.repairCalls).toHaveLength(1);
    expect(r.drafts.find(q=>q.question_number==='2(a)').question_text).toContain(instruction);
    expect(r.exam.extraction_status).toBe('completed');
  });
});

describe('table representation versus genuinely missing data',()=>{
  it('maps exact header-keyed records in header order without changing measurements',()=>{
    const original=structuredClone(keyedTable);
    expect(coerceChart(keyedTable)).toEqual({chart:table,changed:true});
    expect(keyedTable).toEqual(original);
    const r=resolveQuestionResources({diagram_config:keyedTable});
    expect(r.issues).toEqual([]);expect(r.chart).toEqual(table);expect(r.table).toEqual(table);
  });
  it.each([
    {rows:[[1],[2,4],[3,6]]},
    {rows:[{Sample:1},{Sample:2,Count:4}]},
    {rows:[{Sample:1,Count:2,Unexplained:9}]},
    {rows:[[1,null]]},
    {rows:[[1,Infinity]]},
    {headers:['Count','Count'],rows:[{Count:2}]},
  ])('never pads, drops, fabricates or guesses ambiguous data: %j',patch=>{
    const bad={...table,...patch};
    expect(coerceChart(bad).changed).toBe(false);
    expect(resolveQuestionResources({diagram_config:bad}).issues.some(i=>i.code==='invalid_resource')).toBe(true);
  });
  it('reports the exact bad row and widths, once',()=>{
    const r=resolveQuestionResources({diagram_config:{...table,rows:[[1,2],[2],[3,6]]}});
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].detail).toContain('row 2');expect(r.issues[0].detail).toContain('expected 2 cells');
    expect(r.issues[0].detail).toContain('received 1');
  });
  it('keeps disagreeing alias tables blocked after lossless normalisation',()=>{
    const r=resolveQuestionResources({chart_data:keyedTable,diagram_config:{...table,rows:[[1,99],[2,4],[3,6]]}});
    expect(r.issues.some(i=>i.code==='conflicting_resource_data')).toBe(true);
  });
  it.each(['chart_data','diagramConfig','table_data'])('saves a valid full-group resource alias %s as canonical diagram_config',field=>{
    const original=alevelFixture().rows.find(q=>q.question_number==='2(c)');
    const r=analyseGroupRepair([original],[{question_number:'2(c)',task:'Calculate the mean Count.',correct_answer:'(2 + 4 + 6) / 3 = 4.',[field]:keyedTable}],scope,new Set(['2(c)']));
    expect(r.diagnostics).toEqual([]);expect(r.replacements['2(c)'].diagram_config).toEqual(table);
    expect(r.replacements['2(c)'].table_data).toBeNull();
  });
});

describe('question-local resources in initial generation and group repair',()=>{
  it('gives the model actionable Q5(d) resource instructions and a rectangular schema',()=>{
    const {plan,rows}=alevelFixture();
    const group=rows.filter(q=>q.root_question_number==='5');
    group[3]={...group[3],question_text:'Use Figure 5 to explain oxygen unloading.'};
    const prompt=buildQuestionRepairPrompt({group,plan,scope,subject:'Biology',mode:'full_group',defects:'Q5(d): missing_required_resource',targetNumbers:new Set(['5(d)'])});
    expect(prompt).toContain('RESOURCE CHECKLIST');expect(prompt).toContain('Q5(d)');
    expect(prompt).toContain('another part');expect(prompt).toContain('exactly headers.length');
    expect(prompt).toContain('diagram_config');expect(prompt).not.toContain('For any 6-mark extended-response part');
  });
  it('does not let an unreturned sibling graph satisfy a local reference',()=>{
    const rows=alevelFixture().rows.filter(q=>q.root_question_number==='5');
    rows[3].question_text='Use Figure 5 to explain oxygen unloading.';
    const r=analyseGroupRepair(rows,rows.map(repaired),scope,new Set(['5(c)']));
    expect(r.ok).toBe(false);expect(r.replacements).toEqual({});
    expect(r.diagnostics.some(d=>d.partNumber==='5(d)'&&d.code==='missing_required_resource')).toBe(true);
  });
  it('recovers all three reported failure classes, persists the data and passes finalisation',async()=>{
    const r=await extract({mutate(q){
      q.find(p=>p.question_number==='2(a)').question_text=instruction;
      q.find(p=>p.question_number==='5(d)').question_text='Use Figure 5 to explain oxygen unloading.';
      q.find(p=>p.question_number==='6(c)').chart_data={...table,rows:[[1,2],[2],[3,6]]};
    },repair(request){return {parts:groupFrom(request).map(row=>{
      if(row.question_number==='5(d)')return {...repaired(row),task:'Explain how a low oxygen partial pressure in respiring tissues promotes oxygen unloading from haemoglobin.',correct_answer:'Oxygen dissociates from haemoglobin (1); oxygen diffuses into tissues (1); respiration maintains a low oxygen concentration (1).'};
      if(row.question_number==='6(c)')return {question_number:row.question_number,task:'Calculate the mean Count from the table.',correct_answer:'(2 + 4 + 6) / 3 = 4.',table_data:keyedTable};
      return repaired(row);
    })};}});
    expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');expect(r.repairCalls).toHaveLength(2);
    expect(r.drafts.find(q=>q.question_number==='6(c)').diagram_config).toEqual(table);
    expect(r.drafts.find(q=>q.question_number==='5(d)').question_text).not.toContain('Figure 5');
    expect(r.drafts.reduce((sum,q)=>sum+q.marks,0)).toBe(91);
    const h=await boundaryHandler('publish-exam',r.drafts);expect((await h.run({draftId:'exam'})).status).toBe(200);
  });
  it.each(['chart_data','diagramConfig','table_data'])('normalises %s on first generation and persists it without a repair call',async field=>{
    const r=await extract({mutate(q){const row=q.find(p=>p.question_number==='2(c)');delete row.chart_data;row[field]=structuredClone(keyedTable);}});
    expect(String(r.error??'')).toBe('');expect(r.repairCalls).toHaveLength(0);
    expect(r.drafts.find(q=>q.question_number==='2(c)').diagram_config).toEqual(table);
  });
  it('tries later failed groups before retrying early ones and retains all call ceilings',async()=>{
    const r=await extract({mutate(q){for(const n of ['2(a)','3(a)','5(a)','6(a)'])q.find(p=>p.question_number===n).question_text='A student collected observations.';},
      repair(){return {parts:[]};}});
    const order=r.repairCalls.map(call=>groupFrom(call)[0].question_number.match(/^\d+/)[0]);
    expect(order).toEqual(['2','3','5','6','2','3','5','6']);
    expect(r.repairCalls).toHaveLength(8);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
    expect(r.exam.extraction_status).toBe('failed');expect(String(r.error)).toContain('Q2(a) [draft-4]');
    expect(String(r.error)).toContain('Repair rejections');
  });
  it('rejects an unrepaired missing figure at finalisation even when a sibling has a graph',async()=>{
    const {rows}=alevelFixture();rows.find(q=>q.question_number==='5(d)').question_text='Use Figure 5 to explain oxygen unloading.';
    const h=await boundaryHandler('publish-exam',rows),response=await h.run({draftId:'exam'});
    expect(response.status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
  });
  it('never marks a permanently ragged table ready or inserts invented cells',async()=>{
    const bad={...table,rows:[[1,2],[2],[3,6]]};
    const r=await extract({mutate(q){q.find(p=>p.question_number==='6(c)').chart_data=bad;},repair(request){return {parts:groupFrom(request).map(repaired)};}});
    expect(r.exam.extraction_status).toBe('failed');expect(r.repairCalls).toHaveLength(3);
    expect(r.drafts.find(q=>q.question_number==='6(c)').diagram_config).toEqual(bad);
    expect(String(r.error)).toContain('Q6(c)');expect(String(r.error)).toContain('row 2');
    expect(String(r.error)).toContain('expected 2 cells');
  });
});
