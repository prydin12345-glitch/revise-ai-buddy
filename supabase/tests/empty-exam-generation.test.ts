// @vitest-environment node
// Actual extraction handler, intercepted provider calls and fake storage only.
import {expect,it} from 'vitest';
import {extract,boundaryHandler} from './aqa-alevel-runtime';
import {ocrPaper3Fixture} from './ocr-alevel-paper3-fixtures';

const provider = (content:unknown,finishReason='stop') => new Response(JSON.stringify({
  choices:[{finish_reason:finishReason,message:{content:typeof content==='string'?content:JSON.stringify(content)}}],
  usage:{prompt_tokens:10,completion_tokens:20},
}));

it.each(['questions','parts','array'] as const)('retains a complete Paper 3 returned in the %s envelope without buying another response',async shape=>{
  const f=ocrPaper3Fixture('short_practice');
  const r=await extract({generationResponse(_request,rows){return provider(shape==='array'?rows:{[shape]:rows});}},'short_practice','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.generationCalls).toHaveLength(1);expect(r.repairCalls).toHaveLength(0);
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
  expect(r.drafts.reduce((n,q)=>n+q.marks,0)).toBe(20);
  const h=await boundaryHandler('publish-exam',r.drafts,'short_practice','paper_3',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
});

it.each([402,401,403,429])('reports provider HTTP %i instead of no questions and stops repeated batch/model calls',async status=>{
  const r=await extract({generationResponse(){return new Response(JSON.stringify({error:{message:'PRIVATE PROVIDER RESPONSE'}}),{status});}},'full_mock','paper_3',ocrPaper3Fixture());
  expect(String(r.error)).toContain(`HTTP ${status}`);expect(String(r.error)).not.toContain('PRIVATE PROVIDER RESPONSE');
  expect(r.generationCalls).toHaveLength(1);expect(r.drafts).toEqual([]);expect(r.exam.extraction_status).not.toBe('completed');
});

it('reports the precise empty-output failure and usage without persisting an empty paper',async()=>{
  const r=await extract({generationResponse(){return provider({questions:[]});}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error)).toContain('empty_question_array');expect(String(r.error)).toContain('google/gemini-2.5-pro');
  expect(String(r.error)).toContain('AI call(s)');expect(String(r.error)).toContain('prompt');
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);expect(r.drafts).toEqual([]);expect(r.exam.extraction_status).toBe('failed');
});

it('retains usable Flash/Pro fallback for a transient provider failure',async()=>{
  const r=await extract({generationResponse(_request,rows,call){return call===1?new Response('Unavailable',{status:503}):provider({questions:rows});}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error??'')).toBe('');expect(r.generationCalls).toHaveLength(2);expect(r.generationCalls[1].model).toBe('google/gemini-2.5-pro');
});

it('retains every full-mock part and mark when all batches use the parts envelope',async()=>{
  const f=ocrPaper3Fixture();
  const r=await extract({generationResponse(_request,rows){return provider({parts:rows});}},'full_mock','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
  expect(r.drafts.reduce((n,q)=>n+q.marks,0)).toBe(70);expect(r.repairCalls).toHaveLength(0);
  expect(r.generationCalls).toHaveLength(3);
});

it.each(['parts','array'] as const)('completes a truncated %s response using saved siblings without changing their resources',async shape=>{
  const f=ocrPaper3Fixture('short_practice');
  const r=await extract({generationResponse(_request,rows,call){
    if(call!==1)return provider({questions:rows});
    const prefix=shape==='parts'?' {"parts":[':'[';
    return provider(prefix+JSON.stringify(rows[0])+',{"question_number":"1(b)","chart_data":', 'length');
  }},'short_practice','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.generationCalls).toHaveLength(2);
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
  expect(r.drafts.find(q=>q.question_number==='1(b)')?.diagram_config).toEqual(f.rows[1].diagram_config);
  expect(r.generationCalls[1].messages.map((m:any)=>m.content).join('\n')).toContain('ALREADY WRITTEN');
});

it('still blocks invalid assessed tasks after lossless envelope adaptation',async()=>{
  const r=await extract({generationResponse(_request,rows){return provider({parts:rows.map((q,i)=>i===0?{...q,question_text:'Researchers studied plants.'}:q)});}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error)).toContain('missing_task');expect(r.exam.extraction_status).toBe('failed');expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});

it('never maps invented numbering into the requested Paper 3 parts',async()=>{
  const r=await extract({generationResponse(_request,rows){return provider({parts:rows.map(q=>({...q,question_number:'99(z)'}))});}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error)).toContain('unmatched_planned_parts');expect(String(r.error)).toContain('unplanned_part');
  expect(r.exam.extraction_status).toBe('failed');expect(r.drafts).toEqual([]);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});

it('does not replace a valid question array with conflicting aliases',async()=>{
  const r=await extract({generationResponse(_request,rows){return provider({questions:rows,parts:rows.map(q=>({...q,marks:99}))});}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error)).toContain('conflicting_question_arrays');expect(r.drafts).toEqual([]);expect(r.exam.extraction_status).toBe('failed');
});

it('reports provider refusal without publishing its private refusal message',async()=>{
  const r=await extract({generationResponse(){return new Response(JSON.stringify({choices:[{finish_reason:'content_filter',message:{refusal:'PRIVATE REFUSAL'}}]}));}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error)).toContain('provider_refusal');expect(String(r.error)).toContain('finish_reason=content_filter');
  expect(String(r.error)).not.toContain('PRIVATE REFUSAL');expect(r.drafts).toEqual([]);
});

it('identifies malformed gateway transport rather than calling it an empty paper',async()=>{
  const r=await extract({generationResponse(){return new Response('PRIVATE MALFORMED TRANSPORT');}},'short_practice','paper_3',ocrPaper3Fixture('short_practice'));
  expect(String(r.error)).toContain('invalid_gateway_response');expect(String(r.error)).not.toContain('PRIVATE MALFORMED TRANSPORT');
  expect(r.exam.extraction_status).toBe('failed');expect(r.drafts).toEqual([]);
});

it.each(['questions','parts','array'] as const)('supports the same %s envelope in Custom mode while retaining the saved H420/03 identity',async shape=>{
  const f=ocrPaper3Fixture('short_practice'),snapshot={...f.snapshot,paper_contract:{...f.snapshot.paper_contract,mode:'custom'}};
  const r=await extract({generationResponse(_request,rows){return provider(shape==='array'?rows:{[shape]:rows});}},'short_practice','paper_3',{...f,snapshot});
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');expect(r.generationCalls).toHaveLength(1);
  expect(r.exam.generation_context.component_code).toBe('H420/03');expect(r.exam.generation_context.paper_contract.mode).toBe('custom');
  expect(r.drafts).toHaveLength(f.rows.length);
});
