// @vitest-environment node
import {build} from 'esbuild';
import vm from 'node:vm';
import {expect,it} from 'vitest';
import {ocrAlevelFixture,ocrAlevelSnapshot} from './ocr-alevel-fixtures';
import {singleChoiceKey} from '../functions/_shared/single-choice-marking';
const exam='10000000-0000-0000-0000-000000000001',user='00000000-0000-0000-0000-000000000002';
async function handler(name:string,options:{answers?:string[];badKey?:boolean;badEdition?:boolean;foreign?:boolean;failSave?:boolean;written?:boolean;quizNumber?:string}={}){
  const calls:any[]=[],writes:any[]=[],filters:any[]=[],requests:any[]=[];
  const snapshot={...ocrAlevelSnapshot(),...(options.badEdition?{specification_version:'old'}:{})};
  const profile={id:'profile',user_id:user,subject_name:'Biology Higher',exam_board:'OCR',educational_tier:'level3',assessment_tier:null,paper_blueprint:{paperContract:snapshot.paper_contract}};
  const rows=options.written?[ocrAlevelFixture().rows.find(q=>q.question_number==='17(d)')!]:ocrAlevelFixture().rows.slice(0,name==='submit-exam'?15:1);
  if(options.quizNumber)rows[0].question_number=options.quizNumber;
  const answers=rows.map((q,i)=>({question_id:q.id,answer_text:options.answers?.[i]??(options.written?'My written answer':singleChoiceKey(q).letter)}));
  if(options.badKey)rows[0].correct_answer='No matching option';
  const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    rpc:async(name:string,args:any)=>{calls.push({name,args});if(name==='exam_access_info')return {data:{hasAccess:true,isOwner:false,isManager:false,isAssigned:true,gradesReleased:false,deadline:null}};
      if(name==='claim_exam_marking')return {data:{state:'claimed',token:'token'}};
      if(name==='reserve_ai_request')return {data:{allowed:true,usedToday:1,usedInBurstWindow:1}};
      if(name==='finish_exam_marking')return {data:{totalScore:15,totalMarks:15}};return {data:null,error:null};},
    from(table:string){let op='select',value:any;const q:any={};
      for(const method of ['select','update','insert','upsert','eq','single','maybeSingle','order','in'])q[method]=(...args:any[])=>{if(['update','insert','upsert'].includes(method)){op=method;value=args[0];writes.push({table,op,value});}if(method==='eq')filters.push({table,column:args[0],value:args[1]});return q;};
      q.then=(resolve:any,reject:any)=>{let data:any=null;
        if(table==='subject_exam_profiles')data=options.foreign?null:profile;
        if(table==='exams')data=op==='insert'?{...value,id:exam}:{id:exam,user_id:'tutor',assigned_by:'tutor',subject_id:'Biology',title:'Synthetic OCR',generation_context:snapshot};
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
    Deno:{env:{get:(key:string)=>key==='LOVABLE_API_KEY'&&!options.written?undefined:'test-only'}},fetch:async(_url:any,init:any)=>{requests.push(JSON.parse(init.body));if(!options.written)throw new Error('MCQs must not use paid marking');return new Response(JSON.stringify({choices:[{message:{tool_calls:[{function:{arguments:JSON.stringify({score:4,feedback:'Relevant links with some omissions.',isCorrect:false,is_correct:false})}}]}}],usage:{prompt_tokens:20,completion_tokens:10}}));}};
  vm.runInNewContext(result.outputFiles[0].text,runtime);
  return {calls,writes,filters,requests,rows,run:(body:any)=>runtime.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic',...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)}))};
}
it('uploads with the owned OCR course and ignores conflicting client AQA/tier metadata',async()=>{
  const h=await handler('upload-exam'),form=new FormData();
  for(const [k,v] of Object.entries({subjectId:'Biology Higher',fileName:'Synthetic',profileId:'profile',assessmentTier:'higher',examBoard:'AQA',qualificationLevel:'GCSE'}))form.set(k,v);
  expect((await h.run(form)).status).toBe(200);const saved=h.writes.find(w=>w.table==='exams'&&w.op==='insert').value;
  expect(saved.exam_board).toBe('OCR');expect(saved.generation_context.component_code).toBe('H420/01');expect(saved.generation_context.assessment_tier).toBe('not_tiered');
  expect(h.filters).toContainEqual({table:'subject_exam_profiles',column:'user_id',value:user});expect(h.requests).toHaveLength(0);
});
it('marks all fifteen correct MCQs without an AI key/call and keeps unreleased scores hidden',async()=>{
  const h=await handler('submit-exam'),r=await h.run({examId:exam});expect(r.status).toBe(200);expect(h.requests).toHaveLength(0);
  const finish=h.calls.find(c=>c.name==='finish_exam_marking');expect(finish).toBeTruthy();
  expect(JSON.stringify(finish.args).match(/"score":1/g)).toHaveLength(15);expect((await r.json()).totalScore).toBeNull();
  expect(h.calls.some(c=>c.name==='reserve_ai_request')).toBe(true);
});
it('marks incorrect, blank and multiple selections as zero while preserving other marks',async()=>{
  const h=await handler('submit-exam',{answers:['A','','A and B']}),r=await h.run({examId:exam});expect(r.status).toBe(200);
  const finish=h.calls.find(c=>c.name==='finish_exam_marking');expect(JSON.stringify(finish.args).match(/"score":0/g)).toHaveLength(3);expect(h.requests).toHaveLength(0);
});
it.each(['submit-exam','grade-practice-question'])('%s refuses an invalid saved key without awarding zero',async name=>{
  const h=await handler(name,{badKey:true}),r=await h.run({examId:exam,questionId:h.rows[0].id,setId:'set',answerText:'B'});
  expect(r.status).toBeGreaterThanOrEqual(400);expect(h.requests).toHaveLength(0);expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
  expect(h.writes.some(w=>w.table==='practice_question_answers')).toBe(false);
});
it.each(['submit-exam','grade-practice-question'])('%s rejects an obsolete OCR snapshot before marking',async name=>{
  const h=await handler(name,{badEdition:true}),r=await h.run({examId:exam,questionId:h.rows[0].id,setId:'set',answerText:'B'});expect(r.status).toBeGreaterThanOrEqual(400);expect(h.requests).toHaveLength(0);
});
it('marks owned OCR practice deterministically and confirms persistence',async()=>{
  const h=await handler('grade-practice-question'),r=await h.run({questionId:h.rows[0].id,setId:'set',answerText:'B'});
  expect(r.status).toBe(200);expect(await r.json()).toMatchObject({score:1,isCorrect:true});expect(h.requests).toHaveLength(0);
  expect(h.filters).toContainEqual({table:'practice_question_sets',column:'user_id',value:user});
  expect(h.writes.find(w=>w.table==='practice_question_answers').value.score).toBe(1);
});
it.each([{foreign:true},{failSave:true}])('does not report a saved practice mark on %j',async options=>{
  const h=await handler('grade-practice-question',options),r=await h.run({questionId:h.rows[0].id,setId:'set',answerText:'B'});expect(r.status).toBeGreaterThanOrEqual(400);expect(h.requests).toHaveLength(0);
});
it.each(['submit-exam','grade-practice-question'])('%s sends OCR levels, not the AQA point-only examiner persona',async name=>{
  const h=await handler(name,{written:true}),r=await h.run({examId:exam,questionId:h.rows[0].id,setId:'set',answerText:'My explanation'});
  expect(r.status).toBe(200);expect(h.requests).toHaveLength(1);const prompt=h.requests[0].messages[0].content;
  expect(prompt).toContain('H420/01');expect(prompt).toContain('science');expect(prompt).toContain('communication');expect(prompt).not.toContain('You are an AQA A-level Biology examiner');expect(prompt).not.toContain('Do not invent level descriptors.');
});

it('does not require full-paper Q4 resources for an ordinary written quiz question numbered 4',async()=>{
  const h=await handler('grade-practice-question',{written:true,quizNumber:'4'}),r=await h.run({questionId:h.rows[0].id,setId:'set',answerText:'My explanation'});expect(r.status).toBe(200);expect(h.requests).toHaveLength(1);
});
