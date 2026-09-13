// @vitest-environment node
import { build } from 'esbuild';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
const exam='10000000-0000-0000-0000-000000000001';
const user='00000000-0000-0000-0000-000000000002';
const question='20000000-0000-0000-0000-000000000001';
async function harness(name:string, options:{ai?:Response; access?:boolean; status?:string; released?:boolean; questionType?:string; answersError?:boolean}={}) {
  const calls:Array<{name:string;args:any}>=[];
  const mutations:Array<{table:string;operation:string;value:any}>=[];
  const access={hasAccess:options.access ?? true,isOwner:false,isManager:false,isAssigned:true,gradesReleased:options.released ?? false,deadline:null};
  const client={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    rpc:async(name:string,args:any)=>{
      calls.push({name,args});
      if(name==='exam_access_info')return {data:access};
      if(name==='claim_exam_marking')return {data:{state:'claimed',token:'token'}};
      if(name==='reserve_ai_request')return {data:{allowed:true,usedToday:1,usedInBurstWindow:1}};
      if(name==='finish_exam_marking')return {data:{totalScore:2,totalMarks:2}};
      return {data:null,error:null};
    },
    from:(table:string)=>{
      let operation='select';
      const query:any={};
      for(const key of ['select','update','insert','upsert','eq','maybeSingle','single','order']) {
        query[key]=(value:any)=>{
          if(['update','insert','upsert'].includes(key)){operation=key;mutations.push({table,operation,value});}
          return query;
        };
      }
      query.then=(resolve:any,reject:any)=>{
        let data:any=null;
        if(table==='exams')data={id:exam,user_id:'tutor',assigned_by:'tutor',subject_id:'Biology',title:'Test',paper_blueprint:{title:'Paper'}};
        if(table==='exam_questions')data=[{id:question,question_number:'1',question_text:'Explain respiration',question_type:options.questionType ?? 'short_answer',correct_answer:'SECRET',marks:2}];
        if(table==='student_answers')data=[{question_id:question,answer_text:'My answer',score:options.status==='graded' ? 2 : null,feedback:'SECRET feedback',is_correct:true}];
        if(table==='exam_submissions')data=operation==='update'?{id:'submission'}:
          (options.status?{status:options.status,total_score:2,total_marks:2}:null);
        return Promise.resolve({data,error:table==='student_answers' && options.answersError ? {message:'network failure'} : null}).then(resolve,reject);
      };
      return query;
    },
  };
  const result=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',
    plugins:[{name:'test-runtime',setup(build){
      build.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
      build.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')
        ? 'export const createClient = () => globalThis.__client;'
        : args.path.includes('server.ts') ? 'export const serve = h => {globalThis.__handler = h;};' : ''}));
    }}],logLevel:'silent'});
  const context:any={__client:client,console:{log(){},warn(){},error(){}},Request,Response,Headers,AbortSignal,
    Deno:{env:{get:()=> 'test-only'},serve:(h:any)=>context.__handler=h},
    fetch:async()=>options.ai?.clone() ?? new Response(JSON.stringify({choices:[{message:{tool_calls:[{function:{arguments:JSON.stringify({score:2,feedback:'Correct explanation',isCorrect:true})}}]}}],usage:{prompt_tokens:20,completion_tokens:5}})),
  };
  vm.runInNewContext(result.outputFiles[0].text,context);
  const request=(body:any)=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify(body)});
  return {run:(body:any)=>context.__handler(request(body)),calls,mutations};
}
describe('real Edge handler regressions with a mocked runtime',()=>{
  it('refuses unrelated preview requests before fetching questions',async()=>{
    const h=await harness('get-exam-questions',{access:false});
    expect((await h.run({examId:exam,isPreview:true})).status).toBe(403);
  });
  it('strips answer keys and feedback in preview and unreleased review',async()=>{
    for(const status of ['in_progress','graded']) {
      const h=await harness('get-exam-questions',{status,released:false});
      const response=await h.run({examId:exam,isPreview:true});
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain('SECRET');
      const review=await h.run({examId:exam});
      expect(await review.text()).not.toContain('SECRET');
    }
  });
  it('does not finalize or write zero marks on provider failure',async()=>{
    for(const ai of [new Response('unavailable',{status:429}),new Response('{}',{status:200}),new Response('bad json',{status:200})]) {
      const h=await harness('submit-exam',{ai});
      expect((await h.run({examId:exam})).status).toBe(503);
      expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
      expect(h.calls.some(c=>c.name==='fail_exam_marking')).toBe(true);
      expect(h.mutations.filter(m=>m.table==='student_answers')).toHaveLength(0);
    }
  });
  it('never turns a failed answer read into an unanswered zero',async()=>{
    const h=await harness('submit-exam',{answersError:true});
    expect((await h.run({examId:exam})).status).toBe(503);
    expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
  });
  it('commits successful marking through one transactional RPC',async()=>{
    const h=await harness('submit-exam');
    const response=await h.run({examId:exam});
    expect(response.status).toBe(200);
    expect((await response.json()).totalScore).toBeNull(); // tutor has not released results
    const finish=h.calls.filter(c=>c.name==='finish_exam_marking');
    expect(finish).toHaveLength(1);
    expect(finish[0].args.p_results).toEqual([{question_id:question,score:2,feedback:'Correct explanation',is_correct:true}]);
  });
  it('rejects self-awarded marks on a non-drawing question',async()=>{
    const h=await harness('submit-exam');
    expect((await h.run({examId:exam,selfMarkScores:{[question]:2}})).status).toBe(400);
    expect(h.calls.some(c=>c.name==='finish_exam_marking')).toBe(false);
  });
});
