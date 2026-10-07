// @vitest-environment node
import {expect,it} from 'vitest';
import {ocrPaper3Fixture} from './ocr-alevel-paper3-fixtures';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {extract,boundaryHandler} from './aqa-alevel-runtime';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair';
import {CHI_SQUARED_5_PERCENT} from '../functions/_shared/chi-squared-givens';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';

const formula='Use χ² = Σ((O − E)²/E), where O is observed count and E is expected count.';
const decision='Significance level 5%, degrees of freedom 1, critical value 3.84.';
const hypothesis='The null hypothesis is that the observed frequencies agree with the fixed equal-frequency model.';
const task='Calculate the chi-squared statistic and explain whether to reject the null hypothesis. Show your working.';
function fixture(givens=formula+' '+decision,key:unknown='Final statistic: 0.2. Working: (42−40)²/40 + (38−40)²/40 = 0.2. Do not reject the null hypothesis: 0.2 < 3.84 at 5%.') {
  const f=ocrPaper3Fixture('short_practice');
  const row=f.rows.find(q=>q.question_number==='2(b)')!;
  row.question_text=hypothesis+' '+givens+'\n\n'+task;
  (row as any).correct_answer=key;
  return {...f,row};
}
const check=(f:ReturnType<typeof fixture>)=>validateQuestionCandidates(f.rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)});

it.each([
  ['critical value at p',formula+' There is 1 degree of freedom. The critical value at p = 0.05 is 3.84.'],
  ['critical value for df',formula+' Use a 5% significance level; the critical value for 1 df is 3.841.'],
  ['parenthesised significance',formula+' df (n − 1) = 1. χ² critical value (5%) = 3.84.'],
  ['number before degrees',formula+' There is 1 degree of freedom; 5% significance level; critical value is 3.841.'],
  ['symbolic then numeric df',formula+' Degrees of freedom = k − 1 = 1; significance level of p = 0.05; critical value = 3.84.'],
  ['probability only',formula+' df = 1; p = 0.05; critical value: 3.84.'],
  ['alpha',formula+' df: 1; α = 0.05; critical value = 3.841.'],
  ['separate-line formula','Use χ²\n=\nΣ((O − E)²/E). O = observed count; E = expected count. '+decision],
  ['LaTeX formula',String.raw`Use $\chi^{2} = \sum \frac{(O - E)^{2}}{E}$. O = observed count; E = expected count. `+decision],
  ['X-squared formula','Use X² = Σ((O − E)²/E). O = observed count; E = expected count. '+decision],
  ['standalone formula','Use Σ(O−E)²/E. O = observed count; E = expected count. '+decision],
  ['multiline definitions','Use χ² = Σ((O − E)²/E).\nO:\nobserved count\nE:\nexpected count\n'+decision],
  ['definitions reversed','Use χ² = Σ((O − E)²/E). Observed frequency (O); expected frequency (E). '+decision],
  ['paired definitions','Use χ² = Σ((O − E)²/E), where O and E are the observed and expected frequencies respectively. '+decision],
  ['critical value with both qualifiers',formula+' The critical value for 1 degree of freedom at 5% significance level is 3.841.'],
  ['HTML mathematical markup','Use &chi;<sup>2</sup> = &Sigma;((O &minus; E)<sup>2</sup>/E).<br>O:<br>observed count<br>E:<br>expected count<br>'+decision],
])('accepts equivalent visible wording: %s',(_name,givens)=>{
  expect(check(fixture(givens)).defects).toEqual([]);
});
it.each([
  'Final statistic = 0.2. Working and comparison: (42−40)²/40 + (38−40)²/40 = 0.2 < 3.84; do not reject H0.',
  'χ² = 0.2. Working and comparison: (42−40)²/40 + (38−40)²/40 = 0.2 < 3.84; do not reject H0.',
  'χ² = (42−40)²/40 + (38−40)²/40 = 0.2. Do not reject H0: 0.2 < 3.84.',
  String.raw`$\chi^2 = 0.2$. Working: (42−40)²/40 + (38−40)²/40. Do not reject H0: 0.2 < 3.84.`,
  {final_statistic:0.2,working:'(42−40)²/40 + (38−40)²/40',conclusion:'0.2 < 3.84, do not reject H0.'},
  {working:['(42−40)²/40','(38−40)²/40'],answer:'χ² = 0.2',conclusion:'Do not reject H0: 0.2 < 3.84.'},
  {working:'(42−40)²/40 + (38−40)²/40',answer:0.2,conclusion:'Do not reject H0: 0.2 < 3.84.'},
  ['Working: (42−40)²/40 + (38−40)²/40','Final statistic = 0.2','Do not reject H0: 0.2 < 3.84.'],
  JSON.stringify({answer:{chi_squared:0.2},working:'(42−40)²/40 + (38−40)²/40',conclusion:'Do not reject H0: 0.2 < 3.84.'}),
].map(key=>[key]))('normalizes an equivalent private key without losing numerical checking: %j',key=>{
  expect(check(fixture(undefined,key)).defects).toEqual([]);
});
it.each([
  ['wrong critical value',formula+' df = 1; p = 0.05; critical value = 5.99.','invalid_resource'],
  ['wrong significance',formula+' df = 1; significance level 1%; critical value = 3.84.','invalid_resource'],
  ['wrong df',formula+' df = 2; p = 0.05; critical value = 5.99.','invalid_resource'],
  ['missing critical',formula+' df = 1; p = 0.05.','missing_required_resource'],
  ['unrelated number',formula+' df = 1; p = 0.05; critical value unavailable; an unrelated number is 3.84.','missing_required_resource'],
  ['missing significance',formula+' df = 1; critical value = 3.84.','missing_required_resource'],
  ['missing df',formula+' p = 0.05; critical value = 3.84.','missing_required_resource'],
  ['missing formula','O = observed; E = expected. '+decision,'missing_required_resource'],
  ['missing O definition','Use χ² = Σ((O − E)²/E). E = expected. '+decision,'missing_required_resource'],
  ['missing E definition','Use χ² = Σ((O − E)²/E). O = observed. '+decision,'missing_required_resource'],
  ['conflicting df',formula+' df = 1; there are 2 degrees of freedom; p = 0.05; critical value = 3.84.','invalid_resource'],
  ['conflicting critical',formula+' df = 1; p = 0.05; critical value = 3.84; critical value = 5.99.','invalid_resource'],
  ['conflicting significance',formula+' df = 1; significance level = 5%; alpha = 0.01; critical value = 3.84.','invalid_resource'],
  ['wrong qualified df',formula+' The critical value for 2 df at p = 0.05 is 3.841.','invalid_resource'],
  ['wrong parenthesised significance',formula+' df = 1; χ² critical value (1%) = 3.84.','invalid_resource'],
  ['critical integer is not df',formula+' critical value for 1 df at p = 0.05 is 1.','invalid_resource'],
  ['critical percentage is not value',formula+' df = 1; p = 0.05; critical value 3.84%.','missing_required_resource'],
  ['wrong formula denominator','Use χ² = Σ((O − E)²/O), where O = observed and E = expected. '+decision,'missing_required_resource'],
  ['wrong formula grouping','Use χ² = Σ(O − E²/E), where O = observed and E = expected. '+decision,'missing_required_resource'],
  ['conflicting number-first df',formula+' 1 degree of freedom = 2; p = 0.05; critical value = 3.84.','invalid_resource'],
  ['conflicting number-first significance',formula+' df = 1; 5% significance level = 1%; critical value = 3.84.','invalid_resource'],
])('still blocks %s',(_name,givens,code)=>{
  expect(check(fixture(givens)).defects.some(d=>d.code===code)).toBe(true);
});
it('requires a supplied null hypothesis, not just a task referring to it',()=>{
  const f=fixture();f.row.question_text=f.row.question_text.replace(hypothesis,'Researchers sampled 80 organisms.');
  expect(check(f).defects.some(d=>d.code==='missing_required_resource')).toBe(true);
});
it.each([
  'Final statistic = 2.0. Working: (42−40)²/40 + (38−40)²/40. Do not reject H0.',
  {answer:'χ² = 2.0',working:'(42−40)²/40 + (38−40)²/40',conclusion:'Do not reject H0.'},
  'Final statistic: 0.2. χ² = 2.0. Conflicting answers must not be accepted.',
  'Final statistic = 0.2 = 2.0. Conflicting answers must not be accepted.',
  {working:'(42−40)²/40 + (38−40)²/40',critical_value:3.84},
  'χ² = 0.2 * 10. Do not treat a partial term as the result.',
  'χ² = 0.1 + 0.1. Require a final numeric result, not a partial term.',
  'Critical value of χ² = 3.84. This is not a calculated statistic.',
])('still rejects missing or inconsistent private statistics: %j',key=>{
  expect(check(fixture(undefined,key)).defects.some(d=>d.code==='answer_mismatch')).toBe(true);
});
it.each(Array.from({length:10},(_,i)=>i+1))('retains the fixed-model calculation rules for %i df',df=>{
  const f=fixture(formula+` There are ${df} degrees of freedom. The critical value at p = 0.05 is ${CHI_SQUARED_5_PERCENT[df]}.`);
  f.row.diagram_config.rows=Array.from({length:df+1},(_,i)=>['Category '+(i+1),i===0?22:i===1?18:20,20]);
  f.row.correct_answer='Final statistic = 0.4. Working: (22−20)²/20 + (18−20)²/20 = 0.4. Do not reject H0: 0.4 is below the critical value.';
  expect(check(f).defects).toEqual([]);
});
it('rejects more than eleven categories rather than silently extending the model',()=>{
  const f=fixture();f.row.diagram_config.rows=Array.from({length:12},(_,i)=>['Category '+i,20,20]);
  f.row.question_text=hypothesis+' '+formula+' df = 11; significance level 5%; critical value = 19.675. '+task;
  f.row.correct_answer='Final statistic: 0. Working: every category matches; do not reject H0.';
  expect(check(f).defects.some(d=>d.code==='invalid_resource')).toBe(true);
});
it('accepts the parenthesised 5% critical value for a three-category table',()=>{
  const f=fixture(formula+' df (n − 1) = 2. χ² critical value (5%) = 5.99.');
  f.row.diagram_config.rows=[['Category 1',22,20],['Category 2',18,20],['Category 3',20,20]];
  f.row.correct_answer='χ² = 0.4. Working: (22−20)²/20 + (18−20)²/20 = 0.4. Do not reject H0: 0.4 < 5.99.';
  expect(check(f).defects).toEqual([]);
});
it.each(['diagram_config','table_data'] as const)('accepts visible givens in the rendered %s caption',alias=>{
  const f=fixture();f.row.question_text=task;
  const table={...f.row.diagram_config,caption:hypothesis+' '+formula+' '+decision};
  f.row.diagram_config=alias==='diagram_config'?table:null;
  if(alias==='table_data')(f.row as any).table_data=table;
  expect(check(f).defects).toEqual([]);
});
it('does not count hidden or sibling-only givens as visible supplied evidence',()=>{
  const f=fixture();const publicText=f.row.question_text;f.row.question_text=task;
  f.row.diagram_config.hidden_givens=publicText;f.rows[3].question_text+='\n'+publicText;
  const result=check(f);expect(result.defects.some(d=>d.code==='missing_required_resource')).toBe(true);
  expect(result.defects.find(d=>d.code==='missing_required_resource')!.detail).toContain('numeric critical value');
});
it('does not leak the private calculated statistic into public repair diagnostics',()=>{
  const f=fixture(undefined,{answer:'χ² = 2.0',working:'PRIVATE_METHOD_SENTINEL',conclusion:'PRIVATE_CONCLUSION_SENTINEL'});
  const diagnostics=JSON.stringify(check(f).defects);
  expect(diagnostics).not.toContain('PRIVATE_');expect(diagnostics).not.toContain('0.2');
});
it('provides a concrete repair template only for a failed H420/03 statistical group',()=>{
  const f=fixture(),input={group:f.rows.slice(3),subject:'Biology',scope:biologyScopeFromContext(f.snapshot),plan:f.plan,mode:'full_group' as const,targetNumbers:new Set(['2(b)']),defects:'Q2(b): missing_required_resource; invalid_resource; answer_mismatch'};
  const prompt=buildQuestionRepairPrompt(input);
  expect(prompt).toContain('CHI-SQUARED REPAIR Q2(b)');expect(prompt).toContain('Degrees of freedom = k − 1 = 1. Critical value = 3.841.');
  expect(prompt).toContain('Final statistic: [calculated numeric value]');expect(prompt).toContain('rendered table caption');
  expect(buildQuestionRepairPrompt({...input,defects:'missing_task'})).not.toContain('CHI-SQUARED REPAIR');
  const p2=ocrPaper2Fixture('short_practice');
  expect(buildQuestionRepairPrompt({...input,plan:p2.plan,group:p2.rows})).not.toContain('CHI-SQUARED REPAIR');
});
it('accepts an explicitly supplied H0 null hypothesis',()=>{
  const f=fixture();f.row.question_text=f.row.question_text.replace(hypothesis,'H₀: observed frequencies agree with the fixed equal-frequency model.');
  expect(check(f).defects).toEqual([]);
});
it.each(['small_expected','fractional_observed','negative_observed','blank_expected','overflow'] as const)('retains count and finite-arithmetic protections: %s',fault=>{
  const f=fixture(),rows=f.row.diagram_config.rows;
  if(fault==='small_expected'){rows[0][2]=4;rows[1][2]=76;}
  if(fault==='fractional_observed'){rows[0][1]=42.5;rows[1][1]=37.5;}
  if(fault==='negative_observed'){rows[0][1]=-1;rows[1][1]=81;}
  if(fault==='blank_expected')rows[0][2]='';
  if(fault==='overflow'){rows[0][1]=1e308;rows[0][2]=1e308;rows[1][1]=1e308;rows[1][2]=1e308;}
  expect(check(f).ok).toBe(false);
});
it.each(['full_mock','short_practice'] as const)('extracts and publishes equivalent wording and structured private keys in %s without repairs',async mode=>{
  const f=ocrPaper3Fixture(mode),s=f.rows.find(q=>q.question_number===(mode==='full_mock'?'3(c)':'2(b)'))!;
  s.question_text=hypothesis+' '+formula+' There is 1 degree of freedom. The critical value at p = 0.05 is 3.841.\n\n'+task;
  (s as any).correct_answer={answer:'χ² = 0.2',working:'(42−40)²/40 + (38−40)²/40',conclusion:'0.2 < 3.841; do not reject H0.'};
  const r=await extract(false,mode,'paper_3',f);
  expect(r.error).toBeUndefined();expect(r.exam.extraction_status).toBe('completed');expect(r.repairCalls).toHaveLength(0);
  const saved=r.drafts.find(q=>q.question_number===s.question_number)!;
  expect(saved.correct_answer).toContain('χ² = 0.2');expect(saved.correct_answer).toContain('working:');
  const h=await boundaryHandler('publish-exam',r.drafts,mode,'paper_3',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
});
it('repairs invalid statistical givens once using equivalent wording and preserves the complete parent group',async()=>{
  const f=fixture(formula+' df (n − 1) = 1. Critical value at p = 0.05 is 3.841.');
  const r=await extract({mutate(rows){rows.find(q=>q.question_number==='2(b)').question_text='Researchers sampled organisms. '+task;},repair(){return {parts:f.rows.slice(3).map(q=>({...q,task:q.question_number==='2(b)'?task:q.question_text}))};}},'short_practice','paper_3',f);
  expect(r.error).toBeUndefined();expect(r.exam.extraction_status).toBe('completed');expect(r.repairCalls).toHaveLength(1);
  const prompt=r.repairCalls[0].messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('CHI-SQUARED REPAIR Q2(b)');expect(prompt).toContain('Missing visible chi-squared givens:');
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.plan.parts.map(p=>p.questionNumber));
});
it('keeps wrong repaired statistics blocked and prevents publication after bounded repair failure',async()=>{
  const f=fixture(undefined,{answer:'χ² = 2.0',working:'(42−40)²/40 + (38−40)²/40',conclusion:'Do not reject H0.'});
  const r=await extract({repair(){return {parts:f.rows.slice(3).map(q=>({...q,task:q.question_number==='2(b)'?task:q.question_text}))};}},'short_practice','paper_3',f);
  expect(String(r.error)).toContain('answer_mismatch');expect(r.exam.extraction_status).not.toBe('completed');expect(r.repairCalls).toHaveLength(3);
  const h=await boundaryHandler('publish-exam',r.drafts,'short_practice','paper_3',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
