// @vitest-environment node
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {z} from 'zod';
import {describe,expect,it} from 'vitest';
import {paper2Snapshot,fixtureScheme} from './aqa-paper2-fixtures';
import {biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {buildCacheKey} from '../functions/_shared/cache-utils';

async function practice(name:string,tier:'foundation'|'higher',cached=false,invalid=false) {
  const snapshot={...paper2Snapshot(tier,'short_practice'),profile_id:'profile'};
  const set:any={id:'set',profile_id:'profile',subject_id:'Biology',exam_board:'AQA',educational_tier:'GCSE',
    generation_context:snapshot,question_count:2,question_format:'mixed',difficulty_level:'mixed',subtopics:['Homeostasis and response'],notes:''};
  const questions=[{question_number:'1',question_text:'Which hormone lowers blood glucose?',question_type:'mcq',marks:1,
    subtopic:'Homeostasis and response',difficulty_level:'easy',choices:{A:'Insulin',B:'FSH',C:'LH',D:'Oestrogen'},expected_answer:'A'},
    {question_number:'2',question_text:invalid?'The investigator measured reaction times.':'Describe how to investigate reaction time fairly.',question_type:'extended',marks:6,
      subtopic:'Homeostasis and response',difficulty_level:'medium',expected_answer:'Repeat measurements.',mark_scheme:fixtureScheme}];
  const cachedRows=[{...questions[0],id:'old1',options:['Insulin','FSH','LH','Oestrogen'],correct_answer:'A'},
    {...questions[1],id:'old2',correct_answer:fixtureScheme}];
  const calls:any[]=[],writes:any[]=[],reads:any[]=[],errors:any[]=[];
  const client={from(table:string){
    let op='select',value:any;const filters:any={};const q:any={};
    for(const method of ['select','insert','update','upsert','delete','eq','in','ilike','gt','order','limit','single','maybeSingle']) q[method]=(...args:any[])=>{
      if(['insert','update','upsert','delete'].includes(method)){op=method;value=args[0];}
      if(method==='eq')filters[args[0]]=args[1];return q;
    };
    q.then=(resolve:any,reject:any)=>{
      let data:any=[];
      if(op!=='select'){writes.push({table,op,value});if(table==='practice_question_sets'&&op==='update')Object.assign(set,value);}
      if(table==='user_preferences')data={curriculum_region:'england'};
      if(table==='student_cache_slots')data=null;
      if(table==='question_generation_cache'){reads.push(filters);data=cached?{questions:cachedRows,hit_count:0,subject:'Biology',exam_board:'AQA',educational_level:'GCSE'}:null;}
      return Promise.resolve({data,error:null}).then(resolve,reject);
    };return q;
  }};
  const bundle=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'runtime',setup(b){
    b.onLoad({filter:new RegExp(`${name}/index\\.ts$`)},args=>({loader:'ts',contents:readFileSync(args.path,'utf8')+'\nexport {generateQuestionsInBackground};'}));
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
    b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>globalThis.client;'
      :args.path.includes('zod@')?'export const z=globalThis.z;':args.path.includes('pdfjs')?'export const getDocument=()=>{throw Error("No PDF in fixture")};':'export const serve=()=>{};'}));
  }}]});
  const runtime:any={module:{exports:{}},exports:{},z,client,Request,Response,Headers,URL,TextEncoder,TextDecoder,crypto,setTimeout,clearTimeout,AbortController,
    console:{log(){},warn(){},error(...args:any[]){errors.push(args);}},Deno:{env:{get:()=> 'test-only'}},EdgeRuntime:{waitUntil(){}},
    fetch:async(_url:any,options:any)=>{const body=JSON.parse(options.body);calls.push(body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{tool_calls:[{function:{name:'generate_practice_questions',arguments:JSON.stringify({questions})}}]}}]}));}};
  vm.runInNewContext(bundle.outputFiles[0].text,runtime);
  await runtime.module.exports.generateQuestionsInBackground('set','owner',set);
  return {set,calls,writes,reads,errors};
}

describe.each(['generate-practice-questions','get-practice-questions'])('%s real Paper 2 background pipeline',name=>{
  it.each(['foundation','higher'] as const)('generates a fresh %s quiz with its private scheme and saved component',async tier=>{
    const result=await practice(name,tier);
    expect(result.set.extraction_error??'').toBe(''); expect(result.set.extraction_status).toBe('completed');
    expect(result.calls).toHaveLength(1);
    const prompt=result.calls[0].messages.map((m:any)=>m.content).join('\n');
    expect(prompt).toContain(tier==='foundation'?'8461/2F':'8461/2H');
    const rows=result.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
    expect(rows).toHaveLength(2); expect(rows[0].options).toHaveLength(4);
    expect(rows[0].correct_answer).toBe('Insulin'); expect(rows[1].correct_answer).toContain('Level 3');
  });
  it('uses the Paper 2 cache namespace and preserves question/option order without an AI call',async()=>{
    const result=await practice(name,'foundation',true);
    expect(result.set.extraction_status).toBe('completed'); expect(result.calls).toHaveLength(0);
    const key=await buildCacheKey({subject:'Biology',examBoard:'AQA',educationalLevel:'GCSE',assessmentTier:'foundation',courseId:'aqa_gcse_biology',
      paperId:'paper_2',presetVersion:1,resourceVersion:biologyPracticeCacheVersion(paper2Snapshot()),topics:['Homeostasis and response'],difficulty:'mixed',questionFormat:'mixed',questionCount:2});
    expect(result.reads[0].cache_key).toBe(key);
    const rows=result.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
    expect(rows[0].correct_answer).toBe('A');expect(rows[0].options[0]).toBe('Insulin');expect(rows[0]).not.toHaveProperty('id');
  });
  it('refuses a context-only fresh quiz before inserting its questions',async()=>{
    const result=await practice(name,'foundation',false,true);
    expect(result.set.extraction_status).toBe('failed');expect(result.set.extraction_error).toContain('missing_task');
    expect(result.writes.some(w=>w.table==='practice_questions'&&w.op==='insert')).toBe(false);
  });
});
