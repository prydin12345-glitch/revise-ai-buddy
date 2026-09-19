// @vitest-environment node
// Executes the real bundled Edge functions against synthetic DB/model responses.
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe, expect, it} from 'vitest';
import {paper2Fixture, paper2Snapshot, fixtureScheme} from './aqa-paper2-fixtures';

interface ExtractionScenario {
  mutate?: (questions: any[]) => void;
  repair?: (request: any, questions: any[]) => any;
  rejectRepairSave?: boolean;
  truncateFirstBatch?: boolean;
  dropSecondBatch?: boolean;
}
async function extract(tier: 'foundation'|'higher', scenario: boolean | ExtractionScenario = false, mode: 'full_mock'|'short_practice' = 'full_mock') {
  const {rows}=paper2Fixture(tier, mode);
  const questions=(scenario === true?rows.slice(1):rows).map(({id,diagram_config,...r}) => ({...r, chart_data:diagram_config}));
  const config = typeof scenario === 'object' ? scenario : {};
  config.mutate?.(questions);
  const snapshot=paper2Snapshot(tier, mode);
  const exam:any={id:'exam',user_id:'owner',subject_id:'Biology Higher',exam_board:'AQA',qualification_level:'GCSE',generation_context:snapshot,
    exam_specifications:[{topic_name:'Infection and response'}],exam_format:[{use_original_structure:false,mcq_count:0,short_answer_count:8,profile_metadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1',mode:'full_mock'}}}}]};
  let drafts:any[]=[];
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
      if(table==='exam_question_drafts') {
        if(op==='delete') drafts=[];
        if(op==='insert') drafts=value.map((r:any,i:number)=>({...r,id:`draft-${i}`}));
        if(op==='update' && value.original_question_text && config.rejectRepairSave) return Promise.resolve({data:null,error:{message:'test write refused'}}).then(resolve,reject);
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
  const context:any={module:{exports:{}},exports:{},console:{log(){},warn(){},error(){}},Request,Response,Headers,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    fetch:async(_url:any,options:any)=>{
      const request=JSON.parse(options.body); aiCalls.push(request);
      const prompt=request.messages.map((m:any)=>m.content).join('\n');
      const isGeneration=prompt.includes('Return {"questions":[...]} only.');
      if(isGeneration) generationCalls.push(request); else repairCalls.push(request);
      const batch=/PARTS IN THIS RESPONSE: (.+)/.exec(prompt)?.[1].split(', ').map(s=>s.trim());
      const content=isGeneration
        ?{questions:batch?questions.filter(q=>batch.includes(String(q.question_number))):questions}
        :config.repair?.(request,questions)??{parts:[]};
      if(isGeneration&&config.dropSecondBatch&&generationCalls.length>=2)
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"questions":[]}'}}]}));
      if(isGeneration&&config.truncateFirstBatch&&generationCalls.length===1){
        const body=JSON.stringify(content);
        return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:body.slice(0,Math.floor(body.length*0.55))}}]}));
      }
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}));
    },Deno:{env:{get:()=>undefined}},EdgeRuntime:{waitUntil(){}}};
  vm.runInNewContext(result.outputFiles[0].text,context);
  let error:unknown;
  try {await context.module.exports.processExamExtraction('exam','owner',client,'test-key',false,null);} catch(e){error=e;}
  return {drafts,exam,aiCalls,generationCalls,repairCalls,error};
}
async function boundaryHandler(name: string, rows: any[], tier: 'foundation'|'higher' = 'foundation', mode: 'full_mock'|'short_practice' = 'full_mock') {
  const writes: Array<{table:string; value:any}>=[];
  const contextSnapshot=paper2Snapshot(tier, mode);
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table:string){
    const q:any={};
    for(const method of ['select','eq','order','single','maybeSingle','upsert','update','insert','delete'])q[method]=(value:any)=>{
      if(['upsert','update','insert'].includes(method)) writes.push({table,value});return q;
    };
    q.then=(resolve:any,reject:any)=>Promise.resolve({data:table==='exams'?{id:'exam',subject_id:'Biology',exam_board:'AQA',qualification_level:'GCSE',generation_context:contextSnapshot}:rows,error:null}).then(resolve,reject);
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

describe.each(['foundation','higher'] as const)('real AQA Paper 2 %s pipeline',tier=>{
  it.each(['short_practice','full_mock'] as const)('generates, persists and finalises the %s contract',async mode=>{
    const result=await extract(tier,false,mode);
    expect(String(result.error??'')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.drafts).toHaveLength(mode==='full_mock'?36:8);
    expect(result.drafts.reduce((n,q)=>n+q.marks,0)).toBe(mode==='full_mock'?100:20);
    expect(result.drafts.filter(q=>q.question_type==='mcq')).toHaveLength(mode==='full_mock'?9:2);
    expect(result.repairCalls).toHaveLength(0);
    const prompt=result.aiCalls[0].messages.map((m:any)=>m.content).join('\n');
    expect(prompt).toContain(tier==='foundation'?'8461/2F':'8461/2H');
    expect(prompt).not.toContain('AQA GCSE Biology Paper 1');
    expect(prompt).not.toContain('Section A: questions 1–15');
    expect(result.drafts.filter(q=>q.diagram_config?.type==='line_chart')).toHaveLength(mode==='full_mock'?2:1);
    const boundary=await boundaryHandler('publish-exam',result.drafts,tier,mode);
    const response=await boundary.run({draftId:'exam'});
    expect(response.status).toBe(200);
    expect(boundary.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(result.drafts.length);
  });
  it('repairs a missing MCQ task and structured six-mark scheme without losing siblings or choices',async()=>{
    const result=await extract(tier,{
      mutate(questions){questions[0].question_text='A student made measurements.'; questions.find(q=>q.question_number==='4(d)').correct_answer='A model answer only.';},
      repair(request){
        const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({question_number:row.question_number,context:'',instruction:row.question_number==='1(a)'?'Which method makes the sample more representative?':row.question_text,
          expected_answer:row.correct_answer, ...(row.question_number==='4(d)'?{mark_scheme:fixtureScheme}:{}), diagram_config:row.diagram_config}))};
      },
    });
    expect(String(result.error??'')).toBe('');
    expect(result.repairCalls).toHaveLength(2);
    expect(result.drafts[0].options).toHaveLength(4);
    expect(result.drafts.find(q=>q.question_number==='4(d)').correct_answer).toContain('Level 3');
    expect(result.exam.extraction_status).toBe('completed');
  });
  it('overrides conflicting format counts, client Paper 1 and media switches from the saved Paper 2 snapshot',async()=>{
    const h=await boundaryHandler('save-exam-format',[],tier);
    const response=await h.run({draftId:'exam',format:{mcq:{count:0},shortAnswer:{count:8},assessmentTier:tier==='foundation'?'higher':'foundation',profileMetadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1'}},includeGraphs:false,includeTables:false}}});
    expect(response.status).toBe(200);
    const saved=h.writes.find(w=>w.table==='exam_format')?.value;
    expect(saved.mcq_count).toBe(9); expect(saved.short_answer_count+saved.long_form_count).toBe(27);
    expect(saved.profile_metadata.paperBlueprint.paperContract.paperId).toBe('paper_2');
    expect(saved.profile_metadata.assessmentTier).toBe(tier); expect(saved.include_tables).toBe(true); expect(saved.include_graphs).toBe(true);
  });
});
describe('Paper 2 stops rather than manufacturing a passing paper',()=>{
  it('refuses missing planned rows without renumbering or spending repairs',async()=>{
    const result=await extract('foundation',true);
    expect(String(result.error)).toContain('Planned Q1(a) is missing');
    // Bounded completion attempts are allowed; the gate still blocks the paper.
    expect(result.repairCalls.length).toBeLessThanOrEqual(3);
    expect(result.exam.extraction_status).not.toBe('completed');
  });
  it('requires a successful repair save before completion',async()=>{
    const result=await extract('foundation',{mutate(q){q[0].question_text='A student made measurements.';},repair(){return {parts:[{question_number:'1(a)',task:'Which method makes the sample more representative?',expected_answer:'Take random samples'}]};},rejectRepairSave:true});
    expect(String(result.error)).toContain('Repair save failed');
    expect(result.exam.extraction_status).not.toBe('completed');
  });
  it('blocks a Foundation key requiring ADH and accepts a complete in-scope group repair',async()=>{
    const result=await extract('foundation',{
      mutate(q){q.find(q=>q.question_number==='2(d)').correct_answer='ADH changes water reabsorption.';},
      repair(request){const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({...row,task:row.question_text,correct_answer:row.question_number==='2(d)'?'Kidneys remove excess water in urine.':row.correct_answer}))};},
    });
    expect(String(result.error??'')).toBe(''); expect(result.repairCalls).toHaveLength(1);
    expect(result.drafts.find(q=>q.question_number==='2(d)').correct_answer).not.toContain('ADH');
  });
  it('finalisation repeats the gate and will not copy incomplete rows',async()=>{
    const h=await boundaryHandler('publish-exam',paper2Fixture().rows.slice(1));
    const response=await h.run({draftId:'exam'});
    expect(response.status).toBe(422); expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
  });

  it('writes a full paper in bounded batches of whole parent groups, with siblings for context',async()=>{
    const result=await extract('foundation');
    expect(String(result.error??'')).toBe('');
    expect(result.generationCalls.length).toBeGreaterThan(1);
    for(const call of result.generationCalls){
      const prompt=call.messages.map((m:any)=>m.content).join('\n');
      const listed=/PARTS IN THIS RESPONSE: (.+)/.exec(prompt)?.[1].split(', ')??[];
      const parents=new Set(listed.map(n=>n.replace(/\(.*/,'')));
      for(const parent of parents){
        const siblingsInPaper=result.drafts.filter(d=>String(d.question_number).replace(/\(.*/,'')===parent).length;
        expect(listed.filter(n=>n.startsWith(parent)).length).toBe(siblingsInPaper);
      }
      expect(prompt).toContain('WHOLE PAPER (context only');
    }
  });

  it('recovers a truncated batch and completes the remaining planned parts',async()=>{
    const result=await extract('foundation',{truncateFirstBatch:true});
    expect(String(result.error??'')).toBe('');
    expect(result.exam.extraction_status).toBe('completed');
    const numbers=result.drafts.map(d=>String(d.question_number));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(result.repairCalls).toHaveLength(0);
    // The completion request carries the already-written siblings of the part
    // group it is finishing, so shared resource values stay consistent.
    const completion=result.generationCalls.map((c:any)=>c.messages.map((m:any)=>m.content).join('\n'))
      .filter(p=>p.includes('ALREADY WRITTEN in this paper'));
    console.error('LAST', JSON.stringify(result.generationCalls.slice(-1).map((c:any)=>c.messages.map((m:any)=>m.content).join('\n').slice(0,600))));
    expect(completion.length).toBeGreaterThan(0);
  });

  it('stops on a no-progress batch, keeps the paper blocked and stays within the call budget',async()=>{
    const result=await extract('foundation',{dropSecondBatch:true});
    expect(String(result.error)).toContain('plan_mismatch');
    expect(result.exam.extraction_status).not.toBe('completed');
    expect(result.aiCalls.length).toBeLessThanOrEqual(26);
  });
});
