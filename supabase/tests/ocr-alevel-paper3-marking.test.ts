// @vitest-environment node
import {build} from 'esbuild';
import vm from 'node:vm';
import {expect,it} from 'vitest';
import {ocrPaper3Fixture,ocrPaper3Snapshot} from './ocr-alevel-paper3-fixtures';
import type {PaperMode} from '../functions/_shared/paper-contract-types';
const exam='10000000-0000-0000-0000-000000000001',user='00000000-0000-0000-0000-000000000002';
async function handler(name:string,options:{failAI?:boolean;overCap?:boolean;malformed?:boolean;answers?:string[];badKey?:boolean;badEdition?:boolean;foreign?:boolean;failSave?:boolean;written?:boolean;quizNumber?:string;mode?:PaperMode;paperId?:'paper_1'|'paper_2';badComponent?:boolean}={}){
  const calls:any[]=[],writes:any[]=[],filters:any[]=[],requests:any[]=[];
  const snapshot={...ocrPaper3Snapshot(options.mode),...(options.badEdition?{specification_version:'old'}:{})};
  if(options.paperId){snapshot.paper_id=options.paperId;snapshot.component_code=options.paperId==='paper_1'?'H420/01':'H420/02';snapshot.paper_contract.paperId=options.paperId;}
  if(options.badComponent)snapshot.component_code='H420/02';
  const profile={id:'profile',user_id:user,subject_name:'Biology Higher',exam_board:'OCR',educational_tier:'level3',assessment_tier:null,paper_blueprint:{paperContract:snapshot.paper_contract}};
  const fixture=ocrPaper3Fixture();
  const rows=name==='submit-exam'?fixture.rows:[fixture.rows.find(q=>q.question_number==='2(d)')!];
  if(options.quizNumber)rows[0].question_number=options.quizNumber;
  const answers=rows.map((q,i)=>({question_id:q.id,answer_text:options.answers?.[i]??'My written explanation'}));
  if(options.badKey)rows[0].correct_answer='';
  const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    rpc:async(name:string,args:any)=>{calls.push({name,args});if(name==='exam_access_info')return {data:{hasAccess:true,isOwner:false,isManager:false,isAssigned:true,gradesReleased:false,deadline:null}};
      if(name==='claim_exam_responses')return {data:{state:'claimed',token:'token'}};
      if(name==='reserve_ai_request')return {data:{allowed:true,usedToday:1,usedInBurstWindow:1}};
      if(name==='finish_exam_responses')return {data:{totalScore:args.p_results.reduce((s:any,r:any)=>s+r.score,0),totalMarks:70}};return {data:null,error:null};},
    from(table:string){let op='select',value:any;const q:any={};
      for(const method of ['select','update','insert','upsert','eq','single','maybeSingle','order','in'])q[method]=(...args:any[])=>{if(['update','insert','upsert'].includes(method)){op=method;value=args[0];writes.push({table,op,value});}if(method==='eq')filters.push({table,column:args[0],value:args[1]});return q;};
      q.then=(resolve:any,reject:any)=>{let data:any=null;
        if(table==='subject_exam_profiles')data=options.foreign?null:profile;
        if(table==='exams')data=options.foreign&&name==='save-exam-timer'?null:op==='insert'?{...value,id:exam}:{id:exam,user_id:'tutor',assigned_by:'tutor',subject_id:'Biology',title:'Synthetic OCR',generation_context:snapshot};
        if(table==='exam_questions')data=rows;if(table==='student_answers')data=answers;
        if(table==='exam_submissions'&&op==='update')data={id:'submission'};
        if(table==='practice_question_sets')data=options.foreign?null:{id:'set',subject_id:'Biology',generation_context:snapshot};
        if(table==='practice_questions')data=rows[0];if(table==='practice_question_answers')data=op==='select'?[{is_correct:true}]:null;
        if(table==='practice_set_progress')data={id:'progress'};
        const error=options.failSave&&table==='practice_question_answers'&&op==='upsert'?{message:'synthetic persistence error'}:null;
        return Promise.resolve({data,error}).then(resolve,reject);};return q;}};
  const result=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'local-runtime',setup(b){
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>globalThis.client;':args.path.includes('server.ts')?'export const serve=h=>{globalThis.handler=h;};':''}));}}]});
  const runtime:any={client,console:{log(){},warn(){},error(){}},Request,Response,Headers,File,FormData,AbortSignal,crypto,
    Deno:{env:{get:()=> 'test-only'}},fetch:async(_url:any,init:any)=>{requests.push(JSON.parse(init.body));if(options.failAI)return new Response('Synthetic provider failure',{status:503});return new Response(JSON.stringify({choices:[{message:{tool_calls:[{function:{arguments:JSON.stringify(options.malformed?{feedback:'Missing score'}:{score:options.overCap?999:1,feedback:'Relevant reasoning with omissions.',isCorrect:false,is_correct:false})}}]}}],usage:{prompt_tokens:20,completion_tokens:10}}));}};
  vm.runInNewContext(result.outputFiles[0].text,runtime);
  return {calls,writes,filters,requests,rows,run:(body:any)=>runtime.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic',...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)}))};
}
it('authors H420/03 from an owned profile and ignores conflicting browser claims',async()=>{
  const h=await handler('upload-exam'),form=new FormData();
  for(const [k,v] of Object.entries({subjectId:'Biology',fileName:'Synthetic',profileId:'profile',assessmentTier:'higher',examBoard:'AQA',qualificationLevel:'GCSE'}))form.set(k,v);
  expect((await h.run(form)).status).toBe(200);const saved=h.writes.find(w=>w.table==='exams'&&w.op==='insert')!.value;
  expect(saved.generation_context).toMatchObject({course_id:'ocr_alevel_biology_a_h420',paper_id:'paper_3',component_code:'H420/03',assessment_tier:'not_tiered',resolved_by:'server'});
  expect(h.filters).toContainEqual({table:'subject_exam_profiles',column:'user_id',value:user});expect(h.requests).toHaveLength(0);
});
it('routes all 24 scored parts to one bounded atomic result each without releasing tutor scores',async()=>{
  const h=await handler('submit-exam'),r=await h.run({examId:exam});expect(r.status).toBe(200);
  const commits=h.calls.filter(c=>c.name==='finish_exam_responses');expect(commits).toHaveLength(1);
  const results=commits[0].args.p_results;expect(results).toHaveLength(24);expect(new Set(results.map((r:any)=>r.question_id)).size).toBe(24);
  for(const result of results)expect(result.score).toBeLessThanOrEqual(h.rows.find(q=>q.id===result.question_id)!.marks);
  expect((await r.json()).totalScore).toBeNull();
  for(const request of h.requests)expect(request.messages[0].content).toContain('H420/03 Unified biology');
  expect(h.calls.some(c=>c.name==='reserve_ai_request')).toBe(true);
});
it.each(['submit-exam','grade-practice-question'])('%s preserves ungraded state on failed, malformed or over-cap marking',async name=>{
  for(const options of [{failAI:true},{malformed:true},{overCap:true}]){
    const h=await handler(name,options),r=await h.run({examId:exam,questionId:h.rows[0].id,setId:'set',answerText:'My explanation'});
    expect(r.status).toBeGreaterThanOrEqual(400);expect(h.calls.some(c=>c.name==='finish_exam_responses')).toBe(false);
    expect(h.writes.some(w=>w.table==='practice_question_answers')).toBe(false);
  }
});
it('marks owned six-mark Paper 3 practice using OCR levels and confirms the saved result',async()=>{
  const h=await handler('grade-practice-question'),r=await h.run({questionId:h.rows[0].id,setId:'set',answerText:'My explanation'});
  expect(r.status).toBe(200);expect(await r.json()).toMatchObject({score:1,isCorrect:false});
  expect(h.requests[0].messages[0].content).toContain('H420/03');expect(h.requests[0].messages[0].content).toContain('communication');
  expect(h.filters).toContainEqual({table:'practice_question_sets',column:'user_id',value:user});
  expect(h.writes.filter(w=>w.table==='practice_question_answers')).toHaveLength(1);
});
it.each([{foreign:true},{failSave:true},{badEdition:true},{badKey:true}])('blocks unsafe/unsaved Paper 3 practice on %j',async options=>{
  const h=await handler('grade-practice-question',options),r=await h.run({questionId:h.rows[0].id,setId:'set',answerText:'My explanation'});
  expect(r.status).toBeGreaterThanOrEqual(400);
  if(!options.failSave)expect(h.requests).toHaveLength(0);
});
it('does not confuse ordinary quiz numbering with a guided plotting part',async()=>{
  const h=await handler('grade-practice-question',{quizNumber:'1(b)'}),r=await h.run({questionId:h.rows[0].id,setId:'set',answerText:'My explanation'});
  expect(r.status).toBe(200);
});
it.each([
  {mode:'full_mock' as const,expected:90},
  {mode:'short_practice' as const,expected:26},
  {mode:'custom' as const,expected:45},
  {paperId:'paper_1' as const,expected:45},
  {paperId:'paper_2' as const,expected:45},
])('saves frozen guided Paper 3 timing while retaining Custom and older-paper timing: %j',async options=>{
  const h=await handler('save-exam-timer',options);
  expect((await h.run({draftId:exam,enabled:true,duration:45,profileMetadata:{paperId:'paper_1',duration:999}})).status).toBe(200);
  expect(h.writes).toEqual([{table:'exam_timer',op:'upsert',value:{exam_id:exam,enabled:true,duration_minutes:options.expected}}]);
  expect(h.filters).toContainEqual({table:'exams',column:'user_id',value:user});expect(h.requests).toHaveLength(0);
});
it('preserves a deliberately disabled Paper 3 timer',async()=>{
  const h=await handler('save-exam-timer');expect((await h.run({draftId:exam,enabled:false,duration:45})).status).toBe(200);
  expect(h.writes[0].value).toMatchObject({enabled:false,duration_minutes:null});
});
it('cannot save Paper 3 timing for a foreign exam or inconsistent frozen identity',async()=>{
  for(const options of [{foreign:true},{badEdition:true},{badComponent:true}]){
    const h=await handler('save-exam-timer',options);expect((await h.run({draftId:exam,enabled:true,duration:45})).status).toBeGreaterThanOrEqual(400);
    expect(h.writes).toHaveLength(0);expect(h.requests).toHaveLength(0);
  }
});
