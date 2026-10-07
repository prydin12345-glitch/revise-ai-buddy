// @vitest-environment node
import {expect,it} from 'vitest';
import {mergeBatchRows,plannedPartKey,batchIdentityInstructions} from '../functions/_shared/guided-batching';
import {extract,boundaryHandler} from './aqa-alevel-runtime';
import {ocrPaper3Fixture} from './ocr-alevel-paper3-fixtures';

const reply=(questions:any[])=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions})}}]}));
const f=ocrPaper3Fixture('short_practice');

it.each(['decimal','word_prefix','camel_case','part_id'] as const)('retains all six explicitly identified short-practice rows using %s without a paid retry',async shape=>{
  const r=await extract({generationResponse(_request,rows){return reply(rows.map(q=>{
    const p=f.plan.parts.find(p=>p.questionNumber===q.question_number)!;
    if(shape==='decimal')return {...q,question_number:q.question_number.replace(/\(([a-z])\)/,(_s:string,l:string)=>'.'+(l.charCodeAt(0)-96))};
    if(shape==='word_prefix')return {...q,question_number:'Question '+q.question_number};
    const {question_number,...rest}=q;
    return {...rest,...(shape==='camel_case'?{questionNumber:question_number}:{part_id:p.partId})};
  }));}},'short_practice','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.generationCalls).toHaveLength(1);expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
  expect(r.drafts.reduce((n,q)=>n+q.marks,0)).toBe(20);
  const h=await boundaryHandler('publish-exam',r.drafts,'short_practice','paper_3',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
});

it('rejects a conflicting number and stable part ID instead of guessing which is correct',()=>{
  const produced=new Map();
  const result=mergeBatchRows(produced,[{...f.rows[0],part_id:f.plan.parts[1].partId}],f.plan.parts,f.plan);
  expect(result.added).toBe(0);expect(result.rejections[0].code).toBe('conflicting_identity');expect(produced.size).toBe(0);
});

it('sends rejected numbering back with an explicit identity map during bounded completion',async()=>{
  const r=await extract({generationResponse(request,rows,call){
    if(call===1)return reply(rows.map((q,i)=>({...q,question_number:String(i+1)})));
    const prompt=request.messages.map((m:any)=>m.content).join('\n');
    expect(prompt).toContain('PREVIOUS IDENTITY REJECTIONS');expect(prompt).toContain('part_id');
    expect(prompt).toContain(f.plan.parts[0].partId);
    return reply(rows);
  }},'short_practice','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.generationCalls).toHaveLength(2);
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
});

it.each(['01(a)','Question 1 (a)','1.1','Q 01.1','1a','1-a','1.a'])('recognises an explicit equivalent part label %s',label=>{
  expect(plannedPartKey(label)).toBe('1(a)');
});

it('matches immutable IDs independently of array order, preserving every resource and private key',()=>{
  const produced=new Map(),rows=f.rows.map((q,i)=>{
    const {question_number,...rest}=q;return {...rest,partId:f.plan.parts[i].partId};
  }).reverse(),before=structuredClone(rows);
  const result=mergeBatchRows(produced,rows,f.plan.parts,f.plan);
  expect(result.added).toBe(6);expect(result.rejections).toEqual([]);expect(rows).toEqual(before);
  for(const q of f.rows){const stored=produced.get(q.question_number);expect(stored.question_text).toBe(q.question_text);
    expect(stored.correct_answer).toBe(q.correct_answer);expect(stored.diagram_config).toEqual(q.diagram_config);expect(stored.marks).toBe(q.marks);}
});

it('accepts an exact immutable ID placed in question_number without a positional fallback',()=>{
  const produced=new Map(),result=mergeBatchRows(produced,[{...f.rows[0],question_number:f.plan.parts[0].partId}],f.plan.parts,f.plan);
  expect(result.added).toBe(1);expect(produced.get('1(a)').correct_answer).toBe(f.rows[0].correct_answer);
});

it('ignores empty aliases but requires consistent populated identities',()=>{
  const produced=new Map(),{question_number,...rest}=f.rows[0];
  expect(mergeBatchRows(produced,[{...rest,question_number:null,questionNumber:question_number,part_id:f.plan.parts[0].partId}],f.plan.parts,f.plan).added).toBe(1);
});

it.each([
  [{question_number:'1(a)',questionNumber:'1(b)'},'conflicting_identity'],
  [{question_number:'1(a)',part_id:'invented-id'},'unplanned_part'],
  [{question_number:'99(a)',part_id:f.plan.parts[0].partId},'unplanned_part'],
  [{part_id:f.plan.parts[0].partId.toUpperCase()},'unplanned_part'],
  [{question_number:1.1},'invalid_identity'],
  [{question_number:{text:'1(a)'}},'invalid_identity'],
  [{root_question_number:'1',parent_question_number:'1'},'missing_identity'],
] as const)('rejects unknown, conflicting or ambiguous identity %#',(identity,code)=>{
  const produced=new Map(),{question_number,...rest}=f.rows[0];
  const result=mergeBatchRows(produced,[{...rest,...identity}],f.plan.parts,f.plan);
  expect(result.added).toBe(0);expect(result.rejections[0].code).toBe(code);expect(produced.size).toBe(0);
});

it('never maps six standalone numbers to six structured parts by position',()=>{
  const produced=new Map(),result=mergeBatchRows(produced,f.rows.map((q,i)=>({...q,question_number:String(i+1)})),f.plan.parts,f.plan);
  expect(result.added).toBe(0);expect(result.rejections).toHaveLength(6);expect(produced.size).toBe(0);
});

it('rejects an ID from another batch and a duplicate identity without overwriting an accepted part',()=>{
  const produced=new Map();
  expect(mergeBatchRows(produced,[f.rows[0]],f.plan.parts.slice(0,3),f.plan).added).toBe(1);
  const rows=[{...f.rows[0],question_number:undefined,part_id:f.plan.parts[0].partId,correct_answer:'WRONG KEY'},
    {...f.rows[3],question_number:undefined,part_id:f.plan.parts[3].partId}];
  expect(mergeBatchRows(produced,rows,f.plan.parts.slice(0,3),f.plan).rejections.map(r=>r.code)).toEqual(['duplicate_part','outside_batch']);
  expect(produced.get('1(a)').correct_answer).toBe(f.rows[0].correct_answer);
});

it('keeps identity feedback free of question text and private keys even for malformed labels',()=>{
  const produced=new Map(),result=mergeBatchRows(produced,[{...f.rows[0],question_number:'PRIVATE ANSWER AND CONTEXT'}],f.plan.parts,f.plan);
  const prompt=batchIdentityInstructions(f.plan.parts,result.rejections);
  expect(prompt).not.toContain('PRIVATE ANSWER AND CONTEXT');expect(prompt).not.toContain(f.rows[0].correct_answer);
  expect(prompt).not.toContain(f.rows[0].question_text);expect(prompt).toContain('<unrecognized identity>');
});

it('retains full H420/03 batching and totals when the model returns stable IDs',async()=>{
  const full=ocrPaper3Fixture();
  const r=await extract({generationResponse(_request,rows){return reply(rows.map(q=>{
    const {question_number,...rest}=q;return {...rest,part_id:full.plan.parts.find(p=>p.questionNumber===question_number)!.partId};
  }));}},'full_mock','paper_3',full);
  expect(String(r.error??'')).toBe('');expect(r.generationCalls).toHaveLength(3);expect(r.drafts.reduce((n,q)=>n+q.marks,0)).toBe(70);
  expect(r.drafts.map(q=>q.question_number)).toEqual(full.rows.map(q=>q.question_number));
});

it('still rejects wrong marks and missing resources after resolving an explicit identity',async()=>{
  const r=await extract({generationResponse(_request,rows){return reply(rows.map(q=>{
    const {question_number,...rest}=q;return {...rest,part_id:f.plan.parts.find(p=>p.questionNumber===question_number)!.partId,marks:99,chart_data:null};
  }));}},'short_practice','paper_3',f);
  expect(String(r.error)).toContain('plan_mismatch');expect(r.exam.extraction_status).not.toBe('completed');expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
