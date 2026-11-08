// @vitest-environment node
import {build} from 'esbuild';
import vm from 'node:vm';
import {describe,expect,it} from 'vitest';
import {prepareProfileSave} from '../functions/_shared/profile-builder-service';
import {snapshotTemplate} from '../functions/_shared/profile-template-context';
import {templateFixture} from './profile-builder-fixtures';
const exam='80000000-0000-4000-8000-000000000001',user='80000000-0000-4000-8000-000000000002';
function snapshot(){
  const t=templateFixture();
  t.identity={country:'GB',educationSystem:'UK',stage:'Secondary',qualification:'A-level',subject:'Physics',organisation:'AQA',course:'7408',component:'7408/2',specificationVersion:'Not verified',tier:'not_tiered'};
  t.marks=1;t.durationMinutes=10;t.topics=['Capacitors'];t.calculator='allowed';
  t.sections=[{id:'practice',title:'Original software fixture',groups:[{id:'one',parts:[{id:'part',topic:'Capacitors',marks:1,response:'mcq_single',demand:'AO2',resource:'none'}]}]}];
  const proposal={proposalVersion:1 as const,promptVersion:1,origin:'model_knowledge_ai' as const,template:t,evidence:null,evidenceVersion:null,presetId:null,profileSettings:null};
  const saved=prepareProfileSave(proposal,t);
  return {context_version:2,resolved_by:'server',subject_name:'Physics',exam_board:'AQA',educational_tier:'level3',assessment_tier:'not_tiered',profile_template:snapshotTemplate({...saved.settings,profile_template:saved.context})};
}
async function handler(name:'submit-exam'|'grade-practice-question',options:{answer?:string;correct?:string;choices?:string[];foreign?:boolean;saveFailure?:boolean;forgedContext?:boolean}={}){
  const calls:any[]=[],writes:any[]=[],filters:any[]=[],fetches:any[]=[];
  const context=snapshot();if(options.forgedContext)(context as any).resolved_by='client';
  const row={id:'part',question_number:'1',question_type:'mcq',marks:1,question_text:'Which capacitance is correct?',options:options.choices??['$40\\,\\mu\\mathrm{F}$','$80\\,\\mu\\mathrm{F}$','$160\\,\\mu\\mathrm{F}$','$320\\,\\mu\\mathrm{F}$'],correct_answer:options.correct??'80\\,μF'};
  const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    rpc:async(name:string,args:any)=>{calls.push({name,args});if(name==='exam_access_info')return {data:{hasAccess:!options.foreign,isOwner:false,isManager:false,isAssigned:true,gradesReleased:false,deadline:null},error:null};if(name==='claim_exam_responses')return {data:{state:'claimed',token:'lease'}};if(name==='reserve_ai_request')return {data:{allowed:true,usedToday:1,usedInBurstWindow:1}};if(name==='finish_exam_responses')return {data:{totalScore:1,totalMarks:1}};return {data:null,error:null};},
    from(table:string){let op='select',value:any;const q:any={};for(const method of ['select','update','insert','upsert','eq','single','maybeSingle','order','in'])q[method]=(...args:any[])=>{if(['update','insert','upsert'].includes(method)){op=method;value=args[0];writes.push({table,op,value});}if(method==='eq')filters.push({table,column:args[0],value:args[1]});return q;};
      q.then=(resolve:any,reject:any)=>{let data:any=null;
        if(table==='exams')data={id:exam,user_id:'teacher',assigned_by:'teacher',subject_id:'Physics',title:'Original software marking fixture',generation_context:context};
        if(table==='exam_questions')data=[row];if(table==='student_answers')data=[{question_id:row.id,answer_text:options.answer??'B'}];
        if(table==='question_response_contracts')data=[];
        if(table==='practice_question_sets')data=options.foreign?null:{id:'set',subject_id:'Physics',generation_context:context};
        if(table==='practice_questions')data=row;if(table==='practice_question_answers')data=op==='select'?[{is_correct:true}]:null;
        const error=options.saveFailure&&table==='practice_question_answers'&&op==='upsert'?{message:'Original synthetic save failure'}:null;
        return Promise.resolve({data,error}).then(resolve,reject);};return q;}};
  const result=await build({entryPoints:['supabase/functions/'+name+'/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'synthetic-runtime',setup(b){
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
    b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>globalThis.client;':args.path.includes('server.ts')?'export const serve=h=>{globalThis.handler=h;};':''}));
  }}]});
  const runtime:any={client,console:{log(){},warn(){},error(){}},Request,Response,Headers,AbortSignal,crypto,Deno:{env:{get:(key:string)=>key==='LOVABLE_API_KEY'?undefined:'synthetic'}},fetch:async(...args:any[])=>{fetches.push(args);throw Error('Paid calls are blocked');}};
  vm.runInNewContext(result.outputFiles[0].text,runtime);
  return {calls,writes,filters,fetches,run:(extra:any={})=>runtime.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({examId:exam,questionId:row.id,setId:'set',answerText:options.answer??'B',...extra})}))};
}
describe('actual protected-profile MCQ handlers',()=>{
  it.each(['submit-exam','grade-practice-question'] as const)('%s marks the saved mathematical option without provider configuration',async(name)=>{
    const h=await handler(name),r=await h.run();expect(r.status).toBe(200);expect(h.fetches).toHaveLength(0);
    if(name==='submit-exam'){
      const finish=h.calls.find(c=>c.name==='finish_exam_responses');expect(JSON.stringify(finish.args)).toContain('"score":1');expect((await r.json()).totalScore).toBeNull();
    }else{expect(await r.json()).toMatchObject({score:1,isCorrect:true});expect(h.filters).toContainEqual({table:'practice_question_sets',column:'user_id',value:user});}
  });
  it.each(['submit-exam','grade-practice-question'] as const)('%s marks a wrong answer zero deterministically',async(name)=>{
    const h=await handler(name,{answer:'A'}),r=await h.run();expect(r.status).toBe(200);expect(h.fetches).toHaveLength(0);
    if(name==='submit-exam')expect(JSON.stringify(h.calls.find(c=>c.name==='finish_exam_responses').args)).toContain('"score":0');
    else expect(await r.json()).toMatchObject({score:0,isCorrect:false});
  });
  it.each(['submit-exam','grade-practice-question'] as const)('%s rejects an ambiguous duplicate key before marking or saving',async(name)=>{
    const h=await handler(name,{choices:['R','$R$','2R','4R'],correct:'R'}),r=await h.run();expect(r.status).toBeGreaterThanOrEqual(400);expect(h.fetches).toHaveLength(0);
    expect(h.calls.some(c=>c.name==='finish_exam_responses')).toBe(false);expect(h.writes.some(w=>w.table==='practice_question_answers')).toBe(false);
  });
  it.each(['submit-exam','grade-practice-question'] as const)('%s rejects a forged profile snapshot and preserves ownership',async(name)=>{
    const h=await handler(name,{forgedContext:true}),r=await h.run();expect(r.status).toBeGreaterThanOrEqual(400);expect(h.fetches).toHaveLength(0);
    const denied=await handler(name,{foreign:true});expect((await denied.run()).status).toBeGreaterThanOrEqual(400);
  });
  it('keeps a failed practice persistence attempt retryable instead of reporting a saved mark',async()=>{
    const h=await handler('grade-practice-question',{saveFailure:true});expect((await h.run()).status).toBeGreaterThanOrEqual(400);expect(h.fetches).toHaveLength(0);
  });
  it('rejects forged self marks on a protected-profile MCQ',async()=>{
    const h=await handler('submit-exam');expect((await h.run({selfMarkScores:{part:1}})).status).toBe(400);expect(h.fetches).toHaveLength(0);expect(h.calls.some(c=>c.name==='finish_exam_responses')).toBe(false);
  });
});
