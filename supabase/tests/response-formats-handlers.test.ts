// @vitest-environment node
import {ocrPaper2Snapshot} from './ocr-alevel-paper2-fixtures';
import {build} from 'esbuild';
import vm from 'node:vm';
import {it,expect} from 'vitest';
import {responseFixture,responseParent as parent,responseQuestion as qid,responseContractId as cid,responseUser as user,responseOther as other} from './response-foundation-fixtures';
import {markResponse} from '../functions/_shared/response-marking';
async function harness(name:string,options:{snapshot?:any;kind?:Parameters<typeof responseFixture>[0];released?:boolean;graded?:boolean;manager?:boolean;access?:boolean;owner?:boolean;resourceMissing?:boolean;providerFails?:boolean;saveFails?:boolean;contractFails?:boolean}={}){
 const f=responseFixture(options.kind??'grid'),calls:any[]=[],reads:any[]=[],writes:any[]=[],modelCalls:any[]=[];
 const result=await markResponse({questionId:qid,marks:2,definition:f.definition,key:f.key,response:f.envelope},async()=>({units:[{unitId:'u1',score:1,feedback:'Partial credit.'}]}));
 const question={id:qid,exam_id:parent,set_id:parent,question_number:options.snapshot?'16(a)':'1',question_number_int:options.snapshot?16:1,question_text:'Complete the response.',question_type:'written',marks:2,correct_answer:'LEGACY_SECRET',subtopic:'Biomolecules',diagram_config: options.resourceMissing?null:{type:'response_context',resources:[{id:'experiment',kind:'table',title:'Incubation',columns:['Tube','Time (s)'],rows:[['X','20']]}]}};
 const access={hasAccess:options.access??true,isOwner:false,isManager:options.manager??false,isAssigned:true,gradesReleased:options.released??false,deadline:null};
 const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async(name:string,args:any)=>{
  calls.push({name,args});
  if(name==='exam_access_info')return{data:access};
  if(name==='reserve_ai_request')return{data:{allowed:true,usedToday:1,usedInBurstWindow:1}};
  if(name==='claim_exam_responses')return{data:{state:'claimed',token:'claim'}};
  if(name==='finish_exam_responses')return{data:{totalScore:2,totalMarks:2}};
  if(name==='claim_practice_response')return{data:{state:'claimed',token:'claim',response:f.envelope,revision:2}};
  if(name==='finish_practice_response')return options.saveFails?{error:{message:'storage unavailable'}}:{data:args.p_result};
  return{data:null,error:null};
 },from:(table:string)=>{
  const query:any={};let single=false,operation='select';const filters:any[]=[];
  for(const key of ['select','eq','in','single','maybeSingle','order','insert','upsert','update'])query[key]=(...args:any[])=>{
   if(['single','maybeSingle'].includes(key))single=true;if(['insert','upsert','update'].includes(key)){operation=key;writes.push({table,operation,value:args[0]});}if(['eq','in'].includes(key))filters.push(args);return query;
  };
  query.then=(resolve:any,reject:any)=>{
   reads.push({table,filters});let rows:any[]=[],error:any=null;
   if(table==='exams')rows=[{id:parent,user_id:user,title:'Response fixture',subject_id:'Biology',generation_context:options.snapshot}];
   if(table==='exam_questions'||table==='practice_questions')rows=[question];
   if(table==='exam_submissions')rows=operation==='update'?[{id:'s'}]:[{status:options.graded?'graded':'in_progress',total_score:2,total_marks:2}];
   if(table==='practice_question_sets'&&options.owner!==false)rows=[{id:parent,user_id:user,subject_id:'Biology',set_name:'Response fixture',generation_context:options.snapshot}];
   if(table==='student_answers')rows=[{question_id:qid,answer_text:JSON.stringify(f.envelope),score:options.graded?2:null,feedback:'PRIVATE FEEDBACK'}];
   if(table==='practice_question_answers'&&options.graded)rows=[{question_id:qid,score:2,submitted_at:'2026-10-01'}];
   if(table==='question_response_contracts'){rows=[{id:cid,exam_question_id:qid,practice_question_id:qid,definition:f.definition,marking_key:f.key}];if(options.contractFails)error={message:'cannot load contracts'};}
   if(table==='question_response_drafts')rows=[{contract_id:cid,response:f.envelope,revision:2}];
   if(table==='question_response_results'&&options.graded)rows=[{contract_id:cid,status:'graded',response:f.envelope,result}];
   return Promise.resolve({data:single?rows[0]??null:rows,error}).then(resolve,reject);
  };return query;
 }};
 const bundle=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^https:\/\//},a=>({path:a.path,namespace:'runtime'}));b.onLoad({filter:/.*/,namespace:'runtime'},a=>({loader:'js',contents:a.path.includes('supabase-js')?'export const createClient=()=>globalThis.__client;':a.path.includes('server.ts')?'export const serve=h=>{globalThis.__handler=h;};':''}));}}]});
 const runtime:any={__client:client,console:{log(){},warn(){},error(){}},Request,Response,Headers,AbortSignal,TextEncoder,Deno:{env:{get:()=> 'synthetic'},serve:(h:any)=>runtime.__handler=h},fetch:async(_url:any,init:any)=>{
  modelCalls.push(JSON.parse(init.body));return options.providerFails?new Response('{}') : new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{tool_calls:[{function:{name:'grade_response_units',arguments:JSON.stringify({units:[{unitId:'u1',score:1,feedback:'Partial credit.'}]})}}]}}],usage:{prompt_tokens:20,completion_tokens:10}}));
 }};
 vm.runInNewContext(bundle.outputFiles[0].text,runtime);
 return{f,result,calls,reads,writes,modelCalls,run:(body:any)=>runtime.__handler(new Request('https://test.local',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
it('exam and preview responses expose only public definitions until grades are released',async()=>{
 for(const isPreview of [true,false]){const h=await harness('get-exam-questions',{graded:true});const r=await h.run({examId:parent,isPreview});expect(r.status).toBe(200);const body=await r.json();expect(body.questions[0].response_definition.kind).toBe('grid');expect(JSON.stringify(body)).not.toMatch(/response_key|marking_key|response_result|LEGACY_SECRET|PRIVATE FEEDBACK/);}
 const h=await harness('get-exam-questions',{graded:true,released:true});const body=await(await h.run({examId:parent})).json();expect(body.questions[0].response_key).toEqual(h.f.key);expect(body.questions[0].response_result).toEqual(h.result);
});
it('only a manager can read a different student snapshot, with both viewer and target checked',async()=>{
 const denied=await harness('get-exam-questions');expect((await denied.run({examId:parent,studentId:other})).status).toBe(403);
 const h=await harness('get-exam-questions',{manager:true,graded:true});expect((await h.run({examId:parent,studentId:other})).status).toBe(200);
 expect(h.calls.filter(c=>c.name==='exam_access_info').map(c=>c.args.p_user_id)).toEqual([user,other]);
 expect(h.reads.find(r=>r.table==='question_response_drafts').filters).toContainEqual(['user_id',other]);
});
it('opening a practice set is read-only, private before grading and released after grading',async()=>{
 const h=await harness('question-response');const r=await h.run({action:'questions',source:'practice',parentId:parent});expect(r.status).toBe(200);const body=await r.json();expect(body.questions[0].response_snapshot.revision).toBe(2);expect(JSON.stringify(body)).not.toMatch(/response_key|LEGACY_SECRET/);expect(h.modelCalls).toHaveLength(0);expect(h.writes).toHaveLength(0);expect(h.calls).toHaveLength(0);
 const marked=await harness('question-response',{graded:true});expect((await(await marked.run({action:'questions',source:'practice',parentId:parent})).json()).questions[0].response_key).toEqual(marked.f.key);
});
it('denies practice data to a non-owner before loading questions',async()=>{
 const h=await harness('question-response',{owner:false});expect((await h.run({action:'questions',source:'practice',parentId:parent})).status).toBe(403);expect(h.reads.some(r=>r.table==='practice_questions')).toBe(false);
});
it('marks persisted practice cells, ignores forged browser scores/text, and makes no model call',async()=>{
 const h=await harness('grade-practice-question');const r=await h.run({setId:parent,questionId:qid,responseRevision:2,answerText:'fake',score:999});expect(r.status).toBe(200);expect((await r.json()).score).toBe(2);expect(h.modelCalls).toHaveLength(0);
 expect(h.calls.find(c=>c.name==='claim_practice_response').args.p_expected_revision).toBe(2);expect(h.calls.find(c=>c.name==='finish_practice_response').args.p_result).toEqual(h.result);
});
it('marks structured exam answers through the atomic wrapper with hidden scores still hidden',async()=>{
 const h=await harness('submit-exam');const r=await h.run({examId:parent});expect(r.status).toBe(200);expect((await r.json()).totalScore).toBeNull();expect(h.modelCalls).toHaveLength(0);expect(h.calls.find(c=>c.name==='finish_exam_responses').args.p_results[0].response_result).toEqual(h.result);
});
it('provider failures stop practice marking without saving a zero',async()=>{
 const h=await harness('grade-practice-question',{kind:'text',providerFails:true});expect((await h.run({setId:parent,questionId:qid,responseRevision:2})).status).toBeGreaterThanOrEqual(400);expect(h.modelCalls).toHaveLength(1);expect(h.calls.some(c=>c.name==='finish_practice_response')).toBe(false);expect(h.calls.some(c=>c.name==='fail_practice_response')).toBe(true);
});
it('reports failed practice persistence without returning a successful score',async()=>{
 const h=await harness('grade-practice-question',{saveFails:true});expect((await h.run({setId:parent,questionId:qid,responseRevision:2})).status).toBeGreaterThanOrEqual(400);expect(h.calls.some(c=>c.name==='fail_practice_response')).toBe(true);
});
it('refuses missing shared data and failed contract reads before marking',async()=>{
 for(const options of [{resourceMissing:true},{contractFails:true}]){const h=await harness('submit-exam',options);expect((await h.run({examId:parent})).status).toBeGreaterThanOrEqual(400);expect(h.modelCalls).toHaveLength(0);expect(h.calls.some(c=>c.name==='finish_exam_responses')).toBe(false);}
});
it('student PDF data carries blank input definitions and shared resources with no answers even after grading',async()=>{
 const h=await harness('generate-student-pdf',{graded:true});const r=await h.run({contentType:'practice',contentId:parent,includeAnswers:true});expect(r.status).toBe(200);const body=await r.json();expect(body.pdfData.questions[0].response_definition.kind).toBe('grid');expect(JSON.stringify(body)).not.toMatch(/response_key|marking_key|response_snapshot|response_result|LEGACY_SECRET|PRIVATE FEEDBACK/);
});

it.each(['grid','cloze','fields','choice'] as const)('H420/02 %s response retains one capped mastery result and release controls',async kind=>{
 const h=await harness('submit-exam',{kind,snapshot:ocrPaper2Snapshot()});
 const r=await h.run({examId:parent});expect(r.status).toBe(200);expect((await r.json()).totalScore).toBeNull();
 const results=h.calls.find(c=>c.name==='finish_exam_responses').args.p_results;
 expect(results).toHaveLength(1);expect(results[0].response_result.maxMarks).toBe(2);expect(results[0].response_result.score).toBeLessThanOrEqual(2);
 expect(h.modelCalls).toHaveLength(0);
});
it('H420/02 failed rubric marking leaves the response ungraded',async()=>{
 const h=await harness('grade-practice-question',{kind:'text',snapshot:ocrPaper2Snapshot(),providerFails:true});
 expect((await h.run({setId:parent,questionId:qid,responseRevision:2})).status).toBeGreaterThanOrEqual(400);
 expect(h.calls.some(c=>c.name==='finish_practice_response')).toBe(false);expect(h.calls.some(c=>c.name==='fail_practice_response')).toBe(true);
});
