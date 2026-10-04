import {alevelPaper3Fixture,alevelPaper3Snapshot} from './aqa-alevel-paper3-fixtures';
// Test-only runtime: actual Edge Function code, fake database and model.
// Every fetch is intercepted; no credentials, network calls or paid generation.
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {z} from 'zod';
import {alevelFixture,alevelSnapshot,pointScheme} from './aqa-alevel-fixtures';
import {alevelPaper2Fixture,alevelPaper2Snapshot} from './aqa-alevel-paper2-fixtures';

export interface RuntimeFixture { rows:any[]; snapshot:any; }
interface ExtractionScenario {
  snapshotPatch?: Record<string,unknown>;
  mutate?: (questions: any[]) => void;
  repair?: (request: any, questions: any[]) => any;
  rejectRepairSave?: boolean;
  responseProposal?: (request:any) => any;
  rejectResponseSave?: boolean;
  truncateFirstBatch?: boolean;
  truncateReadingBatch?: boolean;
  truncateEssayBatch?: boolean;
  dropSecondBatch?: boolean;
}
export async function extract(scenario: boolean | ExtractionScenario = false, mode: 'full_mock'|'short_practice' = 'full_mock', paper: 'paper_1'|'paper_2'|'paper_3' = 'paper_1', fixture?:RuntimeFixture) {
  const {rows}=fixture??(paper==='paper_3'?alevelPaper3Fixture:paper==='paper_2'?alevelPaper2Fixture:alevelFixture)(mode);
  const questions=(scenario === true?rows.slice(1):rows).map(({id,diagram_config,...r}) => ({...r, chart_data:diagram_config}));
  const config = typeof scenario === 'object' ? scenario : {};
  if(paper==='paper_2')for(const q of questions)if(q.chart_data?.type==='biology_comprehension'&&!q.question_number.endsWith('(a)'))q.chart_data={type:'biology_comprehension_ref',resourceId:q.chart_data.resourceId};
  config.mutate?.(questions);
  const snapshot={...(fixture?.snapshot??(paper==='paper_3'?alevelPaper3Snapshot:paper==='paper_2'?alevelPaper2Snapshot:alevelSnapshot)(mode)),...config.snapshotPatch};
  const exam:any={id:'exam',user_id:'owner',subject_id:'Biology Higher',exam_board:snapshot.exam_board,qualification_level:'level3',generation_context:snapshot,
    exam_specifications:[{topic_name:'Infection and response'}],exam_format:[{use_original_structure:false,mcq_count:0,short_answer_count:8,profile_metadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1',mode:'full_mock'}}}}]};
  let drafts:any[]=[];
  let responseDrafts:any[]=[];
  let readingTruncated=false;
  let essayTruncated=false;
  const aiCalls:any[]=[];
  const generationCalls:any[]=[];
  const repairCalls:any[]=[];
  const client={from(table:string) {
    let op='select',value:any,single=false; const filters:Record<string,unknown>={};
    const q:any={};
    for(const method of ['select','update','insert','upsert','delete','order','eq','ilike','in','maybeSingle','single']) q[method]=(...args:any[])=>{
      if(['update','insert','upsert','delete'].includes(method)){op=method;value=args[0];}
      if(method==='eq') filters[args[0]]=args[1];
      if(method==='single'||method==='maybeSingle') single=true;
      return q;
    };
    q.then=(resolve:any,reject:any)=>{
      let data:any=[];
      if(table==='exams'){if(op==='update')Object.assign(exam,value);data=exam;}
      if(table==='user_preferences')data=null;
      if(table==='question_response_generation_drafts') {
        if(op==='insert') {if(config.rejectResponseSave)return Promise.resolve({data:[],error:null}).then(resolve,reject);responseDrafts=value;}
        data=responseDrafts;
      }
      if(table==='exam_question_drafts') {
        if(op==='delete') drafts=[];
        if(op==='insert') drafts=value.map((r:any,i:number)=>({...r,id:`draft-${i}`}));
        if(op==='update' && value.original_question_text && config.rejectRepairSave) return Promise.resolve({data:null,error:{message:'test write refused'}}).then(resolve,reject);
        if(op==='update' && value.correct_answer?.includes('examly_response_v1') && config.rejectResponseSave) return Promise.resolve({data:[],error:null}).then(resolve,reject);
        if(op==='update') drafts=drafts.map(r=>!filters.id||filters.id===r.id?{...r,...value}:r);
        const selected=drafts.filter(r=>!filters.id||filters.id===r.id);
        data=single?selected[0]??null:selected;
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
  const context:any={module:{exports:{}},exports:{},console:{log(){},warn(){},error(){}},Request,Response,Headers,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,AbortSignal,
    fetch:async(_url:any,options:any)=>{
      const request=JSON.parse(options.body); aiCalls.push(request);
      const prompt=request.messages.map((m:any)=>m.content).join('\n');
      if(prompt.includes('Design validated answer inputs'))return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(config.responseProposal?.(request)??{skip:'Not suitable for structured response.'})}}]}));
      const isGeneration=prompt.includes('Return {"questions":[...]} only.');
      if(isGeneration) generationCalls.push(request); else repairCalls.push(request);
      const batch=/PARTS IN THIS RESPONSE: (.+)/.exec(prompt)?.[1].split(', ').map(s=>s.trim());
      const content=isGeneration
        ?{questions:batch?questions.filter(q=>batch.includes(String(q.question_number))):questions}
        :config.repair?.(request,questions)??{parts:[]};
      if(isGeneration&&config.truncateEssayBatch&&!essayTruncated&&content.questions.some((q:any)=>q.chart_data?.type==='biology_essay_choice')){
        essayTruncated=true;
        const body=JSON.stringify(content);
        const cutoff=body.indexOf('PRIVATE ESSAY');
        return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:body.slice(0,cutoff+15)}}]}));
      }
      if(isGeneration&&config.truncateReadingBatch&&!readingTruncated&&content.questions.some((q:any)=>q.chart_data?.type==='biology_comprehension')){
        readingTruncated=true;
        const end=content.questions.findIndex((q:any)=>q.chart_data?.type==='biology_comprehension')+2;
        const body='{"questions":['+content.questions.slice(0,end).map((q:any)=>JSON.stringify(q)).join(',')+',{"question_number":';
        return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:body}}]}));
      }
      if(isGeneration&&config.dropSecondBatch&&generationCalls.length>=2)
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"questions":[]}'}}]}));
      if(isGeneration&&config.truncateFirstBatch&&generationCalls.length===1){
        // Cut inside the third part; preserve complete sibling data.
        const body='{' + '"questions":[' + content.questions.slice(0,2).map((q:any)=>JSON.stringify(q)).join(',') + ',' + JSON.stringify(content.questions[2]).slice(0,80);
        return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:body}}]}));
      }
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}));
    },Deno:{env:{get:()=>undefined}},EdgeRuntime:{waitUntil(){}}};
  vm.runInNewContext(result.outputFiles[0].text,context);
  let error:unknown;
  try {await context.module.exports.processExamExtraction('exam','owner',client,'test-key',false,null);} catch(e){error=e;}
  return {drafts,responseDrafts,exam,aiCalls,generationCalls,repairCalls,error};
}
export async function boundaryHandler(name: string, rows: any[], mode: 'full_mock'|'short_practice' = 'full_mock', paper: 'paper_1'|'paper_2'|'paper_3' = 'paper_1', savedContext?:any, responseDrafts:any[] = []) {
  const writes: Array<{table:string; value:any}>=[];
  const contextSnapshot=savedContext??(paper==='paper_3'?alevelPaper3Snapshot:paper==='paper_2'?alevelPaper2Snapshot:alevelSnapshot)(mode);
  const client={rpc:async(name:string,args:any)=>{if(name!=='commit_generated_responses')throw new Error('Unexpected RPC');writes.push({table:'commit_generated_responses',value:args});return {data:{count:args.p_rows.length,replayed:false},error:null};},auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table:string){
    const q:any={};
    for(const method of ['select','eq','in','order','single','maybeSingle','upsert','update','insert','delete'])q[method]=(value:any)=>{
      if(['upsert','update','insert'].includes(method)) writes.push({table,value});return q;
    };
    q.then=(resolve:any,reject:any)=>Promise.resolve({data:table==='exams'?{id:'exam',subject_id:'Biology',exam_board:contextSnapshot.exam_board,qualification_level:'level3',extraction_status:'completed',generation_context:contextSnapshot}:table==='question_response_generation_drafts'?responseDrafts:rows,error:null}).then(resolve,reject);
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

export async function practice(name:string,cached=false,invalid=false,paper:'paper_1'|'paper_2'|'paper_3'='paper_1',custom?:{snapshot:any;questions:any[];topics:string[];responseProposal?:any;rejectCommit?:boolean}) {
  const snapshot={...(custom?.snapshot??(paper==='paper_3'?alevelPaper3Snapshot:paper==='paper_2'?alevelPaper2Snapshot:alevelSnapshot)('short_practice')),profile_id:'profile'};
  const set:any={id:'set',profile_id:'profile',subject_id:'Biology',exam_board:snapshot.exam_board,educational_tier:'level3',
    generation_context:snapshot,question_count:2,question_format:'mixed',difficulty_level:'mixed',subtopics:['Cells'],notes:''};
  const questions=custom?.questions??[{question_number:'1',question_text:'Which method makes a sample more representative?',question_type:'mcq',marks:1,
    subtopic:'Cells',difficulty_level:'easy',choices:{A:'Random sampling',B:'Largest only',C:'Nearest only',D:'One sample'},expected_answer:'A'},
    {question_number:'2',question_text:invalid?'The investigator measured reaction times.':'Explain how to investigate osmosis fairly.',question_type:'extended',marks:6,
      subtopic:'Cells',difficulty_level:'medium',expected_answer:'Repeat measurements to reduce random error.',mark_scheme:pointScheme}];
  if(paper==='paper_2'||paper==='paper_3'){set.subtopics=['Photosynthesis'];for(const q of questions)q.subtopic='Photosynthesis';if(!invalid)questions[1].question_text='Explain the role of reduced NADP in the Calvin cycle.';}
  if(custom)set.subtopics=custom.topics;
  const cachedRows=custom?custom.questions:[{...questions[0],id:'old1',options:['Random sampling','Largest only','Nearest only','One sample'],correct_answer:'A'},
    {...questions[1],id:'old2',correct_answer:pointScheme}];
  const calls:any[]=[],writes:any[]=[],reads:any[]=[],errors:any[]=[];
  const client={rpc:async(name:string,args:any)=>{
    if(name!=='commit_generated_responses')throw new Error('Unexpected RPC '+name);
    writes.push({table:name,op:'rpc',value:args});
    if(custom?.rejectCommit)return {data:null,error:{message:'transaction refused'}};
    set.extraction_status='completed';return {data:{count:args.p_rows.length,replayed:false},error:null};
  },from(table:string){
    let op='select',value:any;const filters:any={};const q:any={};
    for(const method of ['select','insert','update','upsert','delete','eq','in','ilike','gt','order','limit','single','maybeSingle']) q[method]=(...args:any[])=>{
      if(['insert','update','upsert','delete'].includes(method)){op=method;value=args[0];}
      if(method==='eq')filters[args[0]]=args[1];return q;
    };
    q.then=(resolve:any,reject:any)=>{
      let data:any=[];
      if(op!=='select'){writes.push({table,op,value});if(table==='practice_question_sets'&&op==='update')Object.assign(set,value);}
      if(table==='user_preferences')data={curriculum_region:'uk'};
      if(table==='student_cache_slots')data=null;
      if(table==='question_generation_cache'){reads.push(filters);data=cached?{questions:cachedRows,hit_count:0,subject:'Biology',exam_board:snapshot.exam_board,educational_level:'level3'}:null;}
      return Promise.resolve({data,error:null}).then(resolve,reject);
    };return q;
  }};
  const bundle=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'runtime',setup(b){
    b.onLoad({filter:new RegExp(`${name}/index\\.ts$`)},args=>({loader:'ts',contents:readFileSync(args.path,'utf8')+'\nexport {generateQuestionsInBackground};'}));
    b.onResolve({filter:/^https:\/\//},args=>({path:args.path,namespace:'runtime'}));
    b.onLoad({filter:/.*/,namespace:'runtime'},args=>({loader:'js',contents:args.path.includes('supabase-js')?'export const createClient=()=>globalThis.client;'
      :args.path.includes('zod@')?'export const z=globalThis.z;':args.path.includes('pdfjs')?'export const getDocument=()=>{throw Error("No PDF in fixture")};':'export const serve=()=>{};'}));
  }}]});
  const runtime:any={module:{exports:{}},exports:{},z,client,Request,Response,Headers,URL,TextEncoder,TextDecoder,crypto,setTimeout,clearTimeout,AbortController,AbortSignal,
    console:{log(){},warn(){},error(...args:any[]){errors.push(args);}},Deno:{env:{get:()=> 'test-only'}},EdgeRuntime:{waitUntil(){}},
    fetch:async(_url:any,options:any)=>{const body=JSON.parse(options.body);calls.push(body);if(!body.tools)return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(custom?.responseProposal??{skip:'Keep written task.'})}}]}));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{tool_calls:[{function:{name:'generate_practice_questions',arguments:JSON.stringify({questions})}}]}}]}));}};
  vm.runInNewContext(bundle.outputFiles[0].text,runtime);
  await runtime.module.exports.generateQuestionsInBackground('set','owner',set);
  return {set,calls,writes,reads,errors};
}
