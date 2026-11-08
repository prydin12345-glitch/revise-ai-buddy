// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {requestQuestionRepair,type RepairRequest} from '../functions/_shared/question-repair';
import {AiCallBudget} from '../functions/_shared/ai-call-budget';
const input:RepairRequest={group:[{question_number:'1',question_type:'short_answer',marks:1,question_text:'Define X.',correct_answer:'Meaning.'}],subject:'Physics',scope:{subject:'Physics'},defects:'repeated_concept',mode:'full_group',targetNumbers:new Set(['1']),timeoutMs:10000};
describe('bounded quality-repair transport',()=>{
 it('records paid transport usage even when the returned repair is rejected',async()=>{
   const request=vi.fn(async(_url:any,options:any)=>{
     const payload=JSON.parse(options.body);expect(payload.max_tokens).toBe(12000);expect(options.signal).toBeInstanceOf(AbortSignal);
     return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"parts":[]}'}}],usage:{prompt_tokens:31,completion_tokens:7}}));
   });
   const result=await requestQuestionRepair(input,'synthetic',request);
   expect(result.ok).toBe(false);expect(result.phase).toBe('parse');expect(request).toHaveBeenCalledOnce();
   expect(result.transportRecord).toMatchObject({ok:true,promptTokens:31,completionTokens:7});
 });
 it('counts an oversized HTTP200 body as a transport failure without retrying',async()=>{
   const request=vi.fn(async()=>new Response('x'.repeat(250001)));
   const result=await requestQuestionRepair(input,'synthetic',request);
   expect(result.phase).toBe('transport');expect(result.transportRecord?.ok).toBe(false);expect(request).toHaveBeenCalledOnce();
 });
 it('keeps repair accounting within the same active-time/call budget',()=>{
   let now=0;const budget=new AiCallBudget({maxCalls:2,maxMs:120000,now:()=>now});
   budget.reserve('batch');now=110000;expect(budget.remainingMs).toBe(10000);
   budget.reserve('quality repair');expect(budget.exhausted()).toMatch(/call budget/);
   now=125000;expect(budget.remainingMs).toBe(0);
 });
});
