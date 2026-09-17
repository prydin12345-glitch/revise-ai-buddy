// @vitest-environment node
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe, expect, it} from 'vitest';
import {gatewayFixture} from './ocr-fixtures';
import {OCR_GATEWAY_BIOLOGY_ID as OCR} from '../functions/_shared/assessment-tier';

async function extract(tier: 'foundation'|'higher', missing = false) {
  const {rows}=gatewayFixture(tier);
  const questions=(missing?rows.slice(1):rows).map(({id,diagram_config,...r}) => ({...r, chart_data:diagram_config}));
  const snapshot={resolved_by:'server',context_version:2,subject_name:'Biology Higher',exam_board:'OCR',educational_tier:'GCSE',assessment_tier:tier,course_id:OCR,paper_id:'first_paper',component_code:tier==='foundation'?'J247/01':'J247/03',paper_contract:{courseId:OCR,paperId:'first_paper',mode:'full_mock',contractVersion:1}};
  const exam:any={id:'exam',user_id:'owner',subject_id:'Biology Higher',exam_board:'OCR',qualification_level:'GCSE',generation_context:snapshot,
    exam_specifications:[{topic_name:'Infection and response'}],exam_format:[{use_original_structure:false,mcq_count:0,short_answer_count:8,profile_metadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1',mode:'full_mock'}}}}]};
  let drafts:any[]=[];
  const aiCalls:any[]=[];
  const client={from(table:string) {
    let op='select',value:any; const filters:Record<string,unknown>={};
    const q:any={};
    for(const method of ['select','update','insert','upsert','delete','order','eq','ilike','in','maybeSingle','single']) q[method]=(...args:any[])=>{
      if(['update','insert','upsert','delete'].includes(method)){op=method;value=args[0];}
      if(method==='eq') filters[args[0]]=args[1];
      return q;
    };
    q.then=(resolve:any,reject:any)=>{
      let data:any=[];
      if(table==='exams'){if(op==='update')Object.assign(exam,value);data=exam;}
      if(table==='user_preferences')data=null;
      if(table==='exam_question_drafts') {
        if(op==='insert') drafts=value.map((r:any,i:number)=>({...r,id:`draft-${i}`}));
        if(op==='update') drafts=drafts.map(r=>!filters.id||filters.id===r.id?{...r,...value}:r);
        data=drafts;
      }
      return Promise.resolve({data,error:null}).then(resolve,reject);
    };
    return q;
  }};
  const result=await build({entryPoints:['supabase/functions/extract-exam-questions/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'test-runtime',setup(b){
    b.onLoad({filter:/extract-exam-questions\/index\.ts$/},args=>({loader:'ts',contents:readFileSync(args.path,'utf8')+'\nexport {processExamExtraction};'}));
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
    b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>null;':args.path.includes('server.ts')?'export const serve=()=>{};':''}));
  }}]});
  const context:any={module:{exports:{}},exports:{},console:{log(){},warn(){},error(){}},Request,Response,Headers,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    fetch:async(_url:any,options:any)=>{aiCalls.push(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions})}}]}));},Deno:{env:{get:()=>undefined}},EdgeRuntime:{waitUntil(){}}};
  vm.runInNewContext(result.outputFiles[0].text,context);
  let error:unknown;
  try {await context.module.exports.processExamExtraction('exam','owner',client,'test-key',false,null);} catch(e){error=e;}
  return {drafts,exam,aiCalls,error};
}
describe('real OCR extraction pipeline with fixture model responses',()=>{
  it.each(['foundation','higher'] as const)('retains the complete %s paper and question-local figures',async tier=>{
    const result=await extract(tier);
    expect(String(result.error ?? '')).toBe('');
    expect(result.drafts).toHaveLength(41);
    expect(result.drafts.reduce((n,q)=>n+q.marks,0)).toBe(90);
    expect(result.drafts.filter(q=>q.question_type==='mcq')).toHaveLength(15);
    expect(result.drafts.some(q=>q.question_number==='19(b)' && q.diagram_config?.type==='line_chart')).toBe(true);
    expect(result.aiCalls).toHaveLength(1);
    const prompt=result.aiCalls[0].messages.map((m:any)=>m.content).join('\n');
    expect(prompt).toContain(tier==='foundation'?'J247/01':'J247/03');
    expect(prompt).not.toContain('AQA GCSE Biology Paper 1');
  });
  it('blocks a missing planned part without renumbering or spending text-repair calls',async()=>{
    const result=await extract('foundation',true);
    expect(String(result.error)).toContain('Planned Q1 is missing');
    expect(result.aiCalls).toHaveLength(1);
    expect(result.drafts.find(q=>q.question_number==='1')).toBeUndefined();
    expect(result.drafts.find(q=>q.question_number==='2')).toBeTruthy();
  });
});

async function boundaryHandler(name: string, rows: any[]) {
  const writes: Array<{table:string; value:any}>=[];
  const contextSnapshot={resolved_by:'server',context_version:2,subject_name:'Biology',exam_board:'OCR',educational_tier:'GCSE',assessment_tier:'foundation',course_id:OCR,paper_id:'first_paper',component_code:'J247/01',paper_contract:{courseId:OCR,paperId:'first_paper',mode:'full_mock',contractVersion:1}};
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table:string){
    const q:any={};
    for(const method of ['select','eq','order','single','maybeSingle','upsert','update','insert'])q[method]=(value:any)=>{
      if(['upsert','update','insert'].includes(method)) writes.push({table,value});return q;
    };
    q.then=(resolve:any,reject:any)=>Promise.resolve({data:table==='exams'?{id:'exam',subject_id:'Biology',exam_board:'OCR',qualification_level:'GCSE',generation_context:contextSnapshot}:rows,error:null}).then(resolve,reject);
    return q;
  }};
  const bundle=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'boundary-runtime',setup(b){
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
    b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>globalThis.client;':args.path.includes('server.ts')?'export const serve=h=>{globalThis.handler=h;};':''}));
  }}]});
  const runtime:any={client,Request,Response,Headers,console:{log(){},warn(){},error(){}},Deno:{env:{get:()=> 'test-only'}},fetch:()=>{throw new Error('No AI call is allowed at this boundary');}};
  vm.runInNewContext(bundle.outputFiles[0].text,runtime);
  return {writes,run:(body:any)=>runtime.handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
describe('OCR format and finalisation boundaries',()=>{
  it('ignores conflicting client counts, AQA preset and tier when saving the format',async()=>{
    const h=await boundaryHandler('save-exam-format',[]);
    const response=await h.run({draftId:'exam',format:{mcq:{count:0},shortAnswer:{count:8},assessmentTier:'higher',profileMetadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1'}},includeGraphs:false,includeTables:false}}});
    expect(response.status).toBe(200);
    const payload=h.writes.find(w=>w.table==='exam_format')?.value;
    expect(payload.mcq_count).toBe(15); expect(payload.short_answer_count+payload.long_form_count).toBe(26);
    expect(payload.include_graphs).toBe(true); expect(payload.include_tables).toBe(true);
    expect(payload.profile_metadata.assessmentTier).toBe('foundation');
    expect(payload.profile_metadata.paperBlueprint.paperContract.courseId).toBe(OCR);
    // These belong to profiles/the contract, not columns on exam_format.
    expect(payload).not.toHaveProperty('parent_question_count');
    expect(payload).not.toHaveProperty('max_parts_per_question');
  });
  it('refuses to finalise an incomplete paper before copying any question rows',async()=>{
    const h=await boundaryHandler('publish-exam',gatewayFixture().rows.slice(1));
    const response=await h.run({draftId:'exam'});
    expect(response.status).toBe(422);
    expect((await response.json()).defects.some((d:any)=>d.code==='plan_mismatch')).toBe(true);
    expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
  });
});
