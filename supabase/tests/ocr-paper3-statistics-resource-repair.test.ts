// @vitest-environment node
import {expect,it} from 'vitest';
import {ocrPaper3Fixture} from './ocr-alevel-paper3-fixtures';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';
import {extract,boundaryHandler} from './aqa-alevel-runtime';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {validateQuestionCandidates,describeDefects} from '../functions/_shared/question-contract-validator';
import {parseChiSquaredGivens,readChiSquaredTable} from '../functions/_shared/chi-squared-givens';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair';

// Reproduce only the supplied error's public wording/shape. These counts and
// private keys are original test fixtures, not recovered production content.
const hypothesis='Null hypothesis (H₀): There is no significant difference between the observed and expected frequencies of wing patterns in the insect population.';
const formula='Use χ² = Σ((O − E)²/E), where O = observed count and E = expected count.';
const decision='Significance level: α = 0.05 (5%). Degrees of freedom (df): df = 1 (number of categories - 1). Critical value (for df=1, α=0.05): 3.84.';
const task='Calculate the chi-squared statistic and explain whether to reject the null hypothesis. Show your working.';
const headers=['Hypothesis:',hypothesis,'Significance level:','α = 0.05 (5%)','Degrees of freedom (df):','df = 1 (number of categories - 1)','Critical value (for df=1, α=0.05):','3.84'];
function fixture() {
  const f=ocrPaper3Fixture('short_practice'),row=f.rows.find(q=>q.question_number==='2(b)')!;
  row.question_text=hypothesis+' '+formula+' '+decision+'\n\n'+task;
  return {...f,row};
}
const check=(f:ReturnType<typeof fixture>)=>validateQuestionCandidates(f.rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)});
const repairInput=(f:ReturnType<typeof fixture>)=>({group:f.rows.slice(3),subject:'Biology',scope:biologyScopeFromContext(f.snapshot),plan:f.plan,mode:'full_group' as const,targetNumbers:new Set(['2(b)']),defects:describeDefects(check(f).defects)});

it.each([
  ['reported qualifiers',decision],
  ['comma without for','df = 1; α = 0.05; critical value (df=1, α=0.05) = 3.841.'],
  ['semicolon','df = 1; p = 0.05; critical value (for df=1; p=0.05): 3.84.'],
  ['and','df = 1; p = 0.05; critical value (for 1 df and at 5% significance level) is 3.841.'],
  ['reversed qualifiers','df = 1; p = 0.05; critical value (at p=0.05, for 1 df) = 3.84.'],
  ['multiline qualifiers','df = 1; α = 0.05; critical value (for df=1,\nα=0.05):\n3.84.'],
])('accepts explicit parenthesised hypothesis and %s',(_name,decisions)=>{
  const f=fixture();f.row.question_text=hypothesis+' '+formula+' '+decisions+'\n\n'+task;
  const givens=parseChiSquaredGivens(f.row.question_text);
  expect(givens.missing).toEqual([]);expect(givens.degreesOfFreedom).toEqual([1]);
  expect(givens.significanceLevels).toEqual([0.05]);
  expect(check(f).defects).toEqual([]);
});
it.each([
  ['wrong df','df=1; α=0.05; critical value (for df=2, α=0.05): 3.84.'],
  ['wrong threshold','df=1; α=0.05; critical value (for df=1, α=0.01): 3.84.'],
  ['wrong critical value','df=1; α=0.05; critical value (for df=1, α=0.05): 5.99.'],
])('still rejects %s inside qualifiers',(_name,decisions)=>{
  const f=fixture();f.row.question_text=hypothesis+' '+formula+' '+decisions+'\n\n'+task;
  expect(check(f).defects.some(d=>d.code==='invalid_resource')).toBe(true);
});
it('does not turn an empty hypothesis label into a supplied null model',()=>{
  const f=fixture();f.row.question_text='Null hypothesis (H₀):\n\n'+formula+' '+decision+'\n\n'+task;
  expect(parseChiSquaredGivens(f.row.question_text).missing).toContain('null hypothesis');
});
it.each(['Null hypothesis:','Null hypothesis (H₀):','H₀:'])('rejects an empty %s followed by a formula',label=>{
  expect(parseChiSquaredGivens(label+' '+formula+' '+decision).missing).toContain('null hypothesis');
});
it('diagnoses the reported givens-only headers instead of accepting them as counts',()=>{
  const f=fixture();f.row.diagram_config={type:'data_table',headers,rows:[],caption:'Statistical information'};
  const result=check(f);expect(result.ok).toBe(false);
  expect(describeDefects(result.defects)).toContain('No category count rows');
  expect(describeDefects(result.defects)).toContain('context or caption');
});
it('never treats an observed/expected mention in a hypothesis as a count column',()=>{
  const t={headers:['Phenotype',hypothesis],rows:[['A',20],['B',20]]};
  const counts=readChiSquaredTable(t);
  expect(counts.observed).toEqual([]);expect(counts.expected).toEqual([]);
  expect(counts.issues.join(' ')).toContain('No column header names an observed count');
  expect(counts.issues.join(' ')).toContain('No column header names an expected count');
});
it('reports missing statistical givens in the same pass as missing count rows',()=>{
  const f=fixture();f.row.question_text=task;f.row.diagram_config={type:'data_table',headers,rows:[]};
  const result=check(f);
  expect(result.defects.some(d=>d.code==='invalid_resource')).toBe(true);
  expect(result.defects.find(d=>d.code==='missing_required_resource')?.detail).toContain('chi-squared formula');
  expect(result.defects.find(d=>d.code==='missing_required_resource')?.detail).toContain('null hypothesis');
});
it('ends a statistical full-group repair with all siblings and a real count-table shape',()=>{
  const f=fixture();f.row.diagram_config={type:'data_table',headers,rows:[]};
  const prompt=buildQuestionRepairPrompt(repairInput(f));
  expect(prompt).toContain('Do not put the hypothesis, formula, df, significance or critical value in headers');
  const example=JSON.parse(prompt.match(/Return JSON only: (.+)$/)![1]);
  expect(example.parts.map((p:any)=>p.question_number)).toEqual(['2(a)','2(b)','2(c)']);
  const part=example.parts.find((p:any)=>p.question_number==='2(b)');
  expect(part.diagram_config.headers).toEqual(['Category','Observed count (O)','Expected count (E)']);
  expect(part.diagram_config.rows).toHaveLength(2);
  expect(prompt).toContain('illustrates JSON shape only');
  expect(prompt).toContain('not recovered measurements');
});
it.each(['plain','ratio','symbols_total'])('preserves recoverable %s observations in the final repair example',kind=>{
  const f=fixture();f.row.question_text=task;
  if(kind==='ratio'){
    f.row.diagram_config.headers=['Category','Expected ratio','Observed count','Expected count'];
    f.row.diagram_config.rows=[['A',1,42,40],['B',1,38,40]];
  }
  if(kind==='symbols_total'){
    f.row.diagram_config.headers=['Category','O','E'];
    f.row.diagram_config.rows=[['A',42,40],['B',38,40],['Total',80,80]];
  }
  const prompt=buildQuestionRepairPrompt(repairInput(f));
  const example=JSON.parse(prompt.match(/Return JSON only: (.+)$/)![1]);
  const resource=example.parts.find((p:any)=>p.question_number==='2(b)').diagram_config;
  expect(resource.headers).toEqual(f.row.diagram_config.headers);
  expect(resource.rows).toEqual(f.row.diagram_config.rows);
  expect(resource.caption).toEqual(f.row.diagram_config.caption);
});
it('rejects malformed keyed rows with a diagnostic rather than throwing before repair',()=>{
  const f=fixture();f.row.diagram_config.rows=[{Category:'A','Observed count':42},{Category:'B','Observed count':38}];
  expect(()=>check(f)).not.toThrow();
  expect(describeDefects(check(f).defects)).toContain('Every category count row must be an array');
});
it('does not hide a broken statistical-info alias when another table contains valid counts',()=>{
  const f=fixture();(f.row as any).chart_data={type:'data_table',headers,rows:[]};
  expect(check(f).ok).toBe(false);
  expect(describeDefects(check(f).defects)).toContain('No category count rows');
});
it('does not offer table replacement in a task-only repair',()=>{
  const f=fixture();
  const prompt=buildQuestionRepairPrompt({...repairInput(f),mode:'task_only',defects:'missing_task'});
  expect(prompt).not.toContain('CHI-SQUARED COUNT-TABLE SHAPE');
  const example=JSON.parse(prompt.match(/Return JSON only: (.+)$/)![1]);
  expect(example.parts.every((p:any)=>!('context' in p)&&!('diagram_config' in p))).toBe(true);
});
it.each(['short_practice','full_mock'] as const)('includes explicit count-table guidance only in its %s statistical batch, without changing Paper 2',async mode=>{
  const f=ocrPaper3Fixture(mode),number=mode==='full_mock'?'3(c)':'2(b)';
  f.rows.find(q=>q.question_number===number)!.question_text=hypothesis+' '+formula+' '+decision+'\n\n'+task;
  const r=await extract(false,mode,'paper_3',f);
  expect(r.error).toBeUndefined();expect(r.repairCalls).toHaveLength(0);
  const prompts=r.generationCalls.map(c=>c.messages.map((m:any)=>m.content).join('\n'));
  for(const prompt of prompts){
    // Single-batch short papers use the whole-paper prompt, without the
    // multi-batch heading. Both paths supply the same immutable identity map.
    const identities=prompt.split('\n').find(line=>line.startsWith('[{"part_id":'));
    expect(identities).toBeDefined();
    const batch=JSON.parse(identities!).map((p:any)=>p.question_number);
    expect(prompt.includes('CHI-SQUARED COUNT-TABLE SHAPE')).toBe(batch.includes(number));
  }
  const p2=ocrPaper2Fixture('short_practice'),other=await extract(false,'short_practice','paper_2',p2);
  expect(other.error).toBeUndefined();
  expect(other.generationCalls.some(c=>JSON.stringify(c).includes('CHI-SQUARED COUNT-TABLE SHAPE'))).toBe(false);
});
it('rebuilds the reported malformed group in one bounded repair and passes publication',async()=>{
  const f=fixture();
  const r=await extract({mutate(rows){const part=rows.find(q=>q.question_number==='2(b)');part.chart_data={type:'data_table',headers,rows:[]};part.question_text=task;},repair(){return {parts:f.rows.slice(3).map(q=>({...q,context:q.question_number==='2(b)'?hypothesis+' '+formula+' '+decision:q.question_text,task:q.question_number==='2(b)'?task:q.question_text}))};}},'short_practice','paper_3',f);
  expect(r.error).toBeUndefined();expect(r.repairCalls).toHaveLength(1);
  expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.plan.parts.map(p=>p.questionNumber));
  expect(r.drafts.find(q=>q.question_number==='2(b)')?.diagram_config.rows).toEqual(f.row.diagram_config.rows);
  const publish=await boundaryHandler('publish-exam',r.drafts,'short_practice','paper_3',f.snapshot);
  expect((await publish.run({draftId:'exam'})).status).toBe(200);
});
it('keeps irrecoverable empty tables blocked after three repairs and cannot publish',async()=>{
  const f=fixture();f.row.diagram_config={type:'data_table',headers,rows:[]};
  const r=await extract({repair(){return {parts:f.rows.slice(3).map(q=>({...q,task:q.question_number==='2(b)'?task:q.question_text}))};}},'short_practice','paper_3',f);
  expect(String(r.error)).toContain('No category count rows');
  expect(r.repairCalls).toHaveLength(3);expect(r.exam.extraction_status).not.toBe('completed');
  const publish=await boundaryHandler('publish-exam',r.drafts,'short_practice','paper_3',f.snapshot);
  expect((await publish.run({draftId:'exam'})).status).toBe(422);
  expect(publish.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
