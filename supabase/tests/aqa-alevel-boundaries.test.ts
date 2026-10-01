import {alevelPaper3Snapshot,alevelPaper3Fixture} from './aqa-alevel-paper3-fixtures';
// @vitest-environment node
import {build} from 'esbuild';
import vm from 'node:vm';
import {expect,it} from 'vitest';
import {alevelSnapshot} from './aqa-alevel-fixtures';
import {alevelPaper2Snapshot,alevelPaper2Fixture} from './aqa-alevel-paper2-fixtures';

const exam='10000000-0000-0000-0000-000000000001',user='00000000-0000-0000-0000-000000000002',question='20000000-0000-0000-0000-000000000001';
async function handler(name:string,options:{foreign?:boolean;badEdition?:boolean;paper?:'paper_1'|'paper_2'|'paper_3';missingSource?:boolean;essayAnswer?:string;badBand?:boolean;badChoice?:boolean;providerFailure?:boolean}={}){
  const calls:any[]=[],writes:any[]=[],filters:any[]=[],requests:any[]=[];
  const snapshot={...(options.paper==='paper_3'?alevelPaper3Snapshot:options.paper==='paper_2'?alevelPaper2Snapshot:alevelSnapshot)(),...(options.badEdition?{specification_version:'unsupported'}:{})};
  const profile={id:'profile',user_id:user,subject_name:'Biology Higher',exam_board:'AQA',educational_tier:'level3',assessment_tier:null,paper_blueprint:{paperContract:snapshot.paper_contract}};
  const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    rpc:async(name:string,args:any)=>{
      calls.push({name,args});
      if(name==='exam_access_info')return {data:{hasAccess:true,isOwner:false,isManager:false,isAssigned:true,gradesReleased:false,deadline:null}};
      if(name==='claim_exam_marking')return {data:{state:'claimed',token:'token'}};
      if(name==='reserve_ai_request')return {data:{allowed:true,usedToday:1,usedInBurstWindow:1}};
      if(name==='finish_exam_marking')return {data:{totalScore:3,totalMarks:5}};
      return {data:null,error:null};
    },from(table:string){
      const q:any={};let op='select',value:any;
      for(const method of ['select','update','insert','upsert','eq','single','maybeSingle','order','in'])q[method]=(...args:any[])=>{
        if(['update','insert','upsert'].includes(method)){op=method;value=args[0];writes.push({table,op,value});}
        if(method==='eq')filters.push({table,column:args[0],value:args[1]});return q;
      };
      q.then=(resolve:any,reject:any)=>{
        let data:any=null;
        if(table==='subject_exam_profiles')data=options.foreign?null:profile;
        if(table==='exams')data=op==='insert'?{...value,id:exam}:{id:exam,user_id:'tutor',assigned_by:'tutor',subject_id:'Biology Higher',title:'Synthetic A-level',generation_context:snapshot};
        const questionRow={id:question,question_number:'9(a)',question_text:'Explain how the structure of a protein determines its function.',question_type:'written',correct_answer:'PRIVATE POINT-BASED KEY',marks:5};
        if(options.paper==='paper_2')Object.assign(questionRow,alevelPaper2Fixture().rows.at(-1),{id:question,correct_answer:'PRIVATE POINT-BASED KEY'},options.missingSource?{diagram_config:null}:{});
        if(options.paper==='paper_3')Object.assign(questionRow,alevelPaper3Fixture().rows.at(-1),{id:question},options.missingSource?{diagram_config:null}:{});
        if(table==='exam_questions')data=[questionRow];
        if(table==='student_answers')data=[{question_id:question,answer_text:options.essayAnswer??'My synthetic answer',score:null}];
        if(table==='exam_submissions'&&op==='update')data={id:'submission'};
        if(table==='practice_question_sets')data={id:'set',subject_id:'Biology',generation_context:snapshot};
        if(table==='practice_questions')data=questionRow;
        if(table==='practice_question_answers')data=op==='select'?[{score:3,is_correct:false}]:null;
        if(table==='practice_set_progress')data={id:'progress'};
        return Promise.resolve({data,error:null}).then(resolve,reject);
      };return q;
    }};
  const result=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'local-runtime',setup(b){
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
    b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>globalThis.client;':args.path.includes('server.ts')?'export const serve=h=>{globalThis.handler=h;};':''}));
  }}]});
  const runtime:any={client,console:{log(){},warn(){},error(){}},Request,Response,Headers,File,FormData,AbortSignal,crypto,
    Deno:{env:{get:()=> 'test-only'}},fetch:async(_url:any,requestInit:any)=>{
      if(name==='upload-exam')throw new Error('Upload must not make an AI request');
      const body=JSON.parse(requestInit.body);requests.push(body);
      if(options.providerFailure)return new Response('synthetic provider failure',{status:503});
      if(options.paper==='paper_3')return new Response(JSON.stringify({choices:[{message:{tool_calls:[{function:{arguments:JSON.stringify({score:19,feedback:'Detailed accurate biology with uneven integration.',isCorrect:false,essay_band:options.badBand?5:4,essay_choice:options.badChoice?'C':options.essayAnswer?.startsWith('[Essay B]')?'B':'A'})}}]}}],usage:{prompt_tokens:20,completion_tokens:10}}));
      return new Response(JSON.stringify({choices:[{message:{tool_calls:[{function:{arguments:JSON.stringify({score:3,feedback:'Three valid points.',isCorrect:false,is_correct:false})}}]}}],usage:{prompt_tokens:20,completion_tokens:10}}));
    }};
  vm.runInNewContext(result.outputFiles[0].text,runtime);
  return {calls,writes,filters,requests,run:(body:any)=>runtime.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic',...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)}))};
}

it.each(['paper_1','paper_2','paper_3'] as const)('upload stores the owned untiered %s, overriding conflicting request metadata',async paper=>{
  const h=await handler('upload-exam',{paper}),form=new FormData();
  for(const [k,v] of Object.entries({subjectId:'Biology Higher',fileName:'Test',profileId:'profile',assessmentTier:'higher',examBoard:'OCR',qualificationLevel:'GCSE'}))form.set(k,v);
  expect((await h.run(form)).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exams'&&w.op==='insert').value;
  expect(saved.qualification_level).toBe('level3');expect(saved.exam_board).toBe('AQA');
  expect(saved.generation_context.assessment_tier).toBe('not_tiered');expect(saved.generation_context.component_code).toBe(paper==='paper_3'?'7402/3':paper==='paper_2'?'7402/2':'7402/1');
  expect(saved.generation_context.curriculum.qualification).toBe('A-level');
  expect(h.filters).toContainEqual({table:'subject_exam_profiles',column:'user_id',value:user});expect(h.requests).toHaveLength(0);
});
it('upload refuses a foreign profile before inserting an exam',async()=>{
  const h=await handler('upload-exam',{foreign:true}),form=new FormData();
  for(const [k,v] of Object.entries({subjectId:'Biology',fileName:'Test',profileId:'foreign',examBoard:'AQA',qualificationLevel:'level3'}))form.set(k,v);
  expect((await h.run(form)).status).toBe(404);expect(h.writes).toHaveLength(0);
});
it.each(['submit-exam','grade-practice-question'].flatMap(name=>(['paper_1','paper_2'] as const).map(paper=>({name,paper}))))('$name sends saved $paper context to the provider',async({name,paper})=>{
  const h=await handler(name,{paper}),response=await h.run({examId:exam,questionId:question,setId:'set',answerText:'My synthetic answer'});
  expect(response.status).toBe(200);expect(h.requests).toHaveLength(1);
  const system=h.requests[0].messages[0].content;expect(system).toContain(paper==='paper_3'?'7402/3':paper==='paper_2'?'7402/2':'7402/1');expect(system).toContain('point-based');
  expect(system).not.toContain('You are a supportive mathematics tutor');
  expect(h.requests[0].messages[1].content).toContain('PRIVATE POINT-BASED KEY');
  if(paper==='paper_2')expect(h.requests[0].messages[1].content).toContain('Researchers investigated');
  if(name==='submit-exam'){
    expect(h.calls.filter(c=>c.name==='finish_exam_marking')).toHaveLength(1);
    expect((await response.json()).totalScore).toBeNull();
  }else expect(h.writes.find(w=>w.table==='practice_question_answers')?.value.score).toBe(3);
});
it.each(['submit-exam','grade-practice-question'])('%s blocks a mismatched saved edition before any model call',async name=>{
  const h=await handler(name,{badEdition:true}),response=await h.run({examId:exam,questionId:question,setId:'set',answerText:'My synthetic answer'});
  expect(response.status).toBeGreaterThanOrEqual(400);expect(h.requests).toHaveLength(0);
  expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
});

it.each(['submit-exam','grade-practice-question'])('%s refuses marking without the saved comprehension source',async name=>{
  const h=await handler(name,{paper:'paper_2',missingSource:true}),r=await h.run({examId:exam,questionId:question,setId:'set',answerText:'My synthetic answer'});
  expect(r.status).toBeGreaterThanOrEqual(400);expect(h.requests).toHaveLength(0);expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
});

it.each(['A','B'] as const)('submits selected Paper 3 essay %s using only its private key and rubric',async choice=>{
  const h=await handler('submit-exam',{paper:'paper_3',essayAnswer:`[Essay ${choice}]\n\nMy detailed synthetic essay`}),r=await h.run({examId:exam});
  expect(r.status).toBe(200);expect(h.requests).toHaveLength(1);
  const request=h.requests[0];expect(request.messages[0].content).toContain('21–25');expect(request.messages[1].content).toContain(`PRIVATE ESSAY ${choice}`);expect(request.messages[1].content).not.toContain(`PRIVATE ESSAY ${choice==='A'?'B':'A'}`);
  expect(request.tools[0].function.parameters.required).toEqual(expect.arrayContaining(['essay_band','essay_choice']));
  const finish=h.calls.find(c=>c.name==='finish_exam_marking');expect(finish).toBeTruthy();expect(JSON.stringify(finish.args)).toContain('19');
});
it.each(['missing_choice','missing_source','bad_band','bad_choice','provider_failure'])('does not save a zero or final grade after %s',async fault=>{
  const h=await handler('submit-exam',{paper:'paper_3',essayAnswer:fault==='missing_choice'?'My unselected essay':'[Essay A]\nMy essay',missingSource:fault==='missing_source',badBand:fault==='bad_band',badChoice:fault==='bad_choice',providerFailure:fault==='provider_failure'});
  const r=await h.run({examId:exam});expect(r.status).toBeGreaterThanOrEqual(400);expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
  if(fault.startsWith('missing'))expect(h.requests).toHaveLength(0);
});
it('scores a genuinely blank essay as zero without calling the model',async()=>{
  const h=await handler('submit-exam',{paper:'paper_3',essayAnswer:'[Essay A]\n\n'}),r=await h.run({examId:exam});
  expect(r.status).toBe(200);expect(h.requests).toHaveLength(0);const finish=h.calls.find(c=>c.name==='finish_exam_marking');expect(finish).toBeTruthy();expect(JSON.stringify(finish.args)).toContain('No essay answer provided');
});
