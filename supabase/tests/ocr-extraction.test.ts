// @vitest-environment node
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe, expect, it} from 'vitest';
import {gatewayFixture} from './ocr-fixtures';
import {OCR_GATEWAY_BIOLOGY_ID as OCR} from '../functions/_shared/assessment-tier';

interface ExtractionScenario {
  mutate?: (questions: any[]) => void;
  repair?: (request: any, questions: any[]) => any;
  rejectRepairSave?: boolean;
}
async function extract(tier: 'foundation'|'higher', scenario: boolean | ExtractionScenario = false) {
  const {rows}=gatewayFixture(tier);
  const questions=(scenario === true?rows.slice(1):rows).map(({id,diagram_config,...r}) => ({...r, chart_data:diagram_config}));
  const config = typeof scenario === 'object' ? scenario : {};
  config.mutate?.(questions);
  const snapshot={resolved_by:'server',context_version:2,subject_name:'Biology Higher',exam_board:'OCR',educational_tier:'GCSE',assessment_tier:tier,course_id:OCR,paper_id:'first_paper',component_code:tier==='foundation'?'J247/01':'J247/03',paper_contract:{courseId:OCR,paperId:'first_paper',mode:'full_mock',contractVersion:1}};
  const exam:any={id:'exam',user_id:'owner',subject_id:'Biology Higher',exam_board:'OCR',qualification_level:'GCSE',generation_context:snapshot,
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
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}));
    },Deno:{env:{get:()=>undefined}},EdgeRuntime:{waitUntil(){}}};
  vm.runInNewContext(result.outputFiles[0].text,context);
  let error:unknown;
  try {await context.module.exports.processExamExtraction('exam','owner',client,'test-key',false,null);} catch(e){error=e;}
  return {drafts,exam,aiCalls,generationCalls,repairCalls,error};
}
describe('real OCR extraction pipeline with fixture model responses',()=>{
  it.each(['foundation','higher'] as const)('retains the complete %s paper and question-local figures',async tier=>{
    const result=await extract(tier);
    expect(String(result.error ?? '')).toBe('');
    expect(result.drafts).toHaveLength(41);
    expect(result.drafts.reduce((n,q)=>n+q.marks,0)).toBe(90);
    expect(result.drafts.filter(q=>q.question_type==='mcq')).toHaveLength(15);
    expect(result.drafts.some(q=>q.question_number==='19(b)' && q.diagram_config?.type==='line_chart')).toBe(true);
    expect(result.repairCalls).toHaveLength(0);
    const prompt=result.aiCalls[0].messages.map((m:any)=>m.content).join('\n');
    expect(prompt).toContain(tier==='foundation'?'J247/01':'J247/03');
    expect(prompt).not.toContain('AQA GCSE Biology Paper 1');
  });
  it('blocks a missing planned part without renumbering or spending text-repair calls',async()=>{
    const result=await extract('foundation',true);
    expect(String(result.error)).toContain('Planned Q1 is missing');
    // Bounded completion attempts are allowed; no text-repair loop, no renumbering.
    expect(result.repairCalls.length).toBeLessThanOrEqual(3);
    expect(result.drafts.find(q=>q.question_number==='1')).toBeUndefined();
    expect(result.drafts.find(q=>q.question_number==='2')).toBeTruthy();
  });
  it('normalises answer aliases and a separate structured level scheme before spending repair calls',async()=>{
    const result=await extract('foundation',{mutate(questions){
      for(const q of questions){
        q.expected_answer=q.correct_answer; q.correct_answer='';
        if(q.question_type==='mcq'){q.choices=Object.fromEntries(q.options.map((text:string,i:number)=>['ABCD'[i],text]));delete q.options;}
        if(q.marks===6){q.expected_answer='A model explanation of temperature control.';q.mark_scheme=levelScheme;}
      }
    }});
    expect(String(result.error??'')).toBe('');
    expect(result.repairCalls).toHaveLength(0);
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.drafts.find(q=>q.question_number==='24(b)').correct_answer).toContain('Level 3');
    expect(result.drafts.find(q=>q.question_number==='24(b)').correct_answer).toContain('sweat evaporation');
    expect(result.drafts.filter(q=>q.question_type==='mcq').every(q=>q.options.length===4 && q.options.includes(q.correct_answer))).toBe(true);
  });
  it.each(['foundation','higher'] as const)('repairs the reported photosynthesis and six-mark failures, persists them and completes the %s paper',async tier=>{
    const result=await extract(tier,{
      mutate(questions){
        const photosynthesis=questions.find(q=>q.question_number==='19(a)');
        photosynthesis.question_text='Photosynthesis takes place in chloroplasts.';
        photosynthesis.correct_answer='The Calvin cycle produces sugars.';
        questions.find(q=>q.question_number==='24(b)').correct_answer='A model answer without any levels.';
      },
      repair(request){
        const prompt=request.messages[0].content;
        const group=JSON.parse(prompt.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({question_number:row.question_number,
          context:'', instruction:row.question_number==='19(a)'?'Briefly outline the two main stages of photosynthesis.':row.question_text,
          correct_answer:'', expected_answer:row.question_number==='19(a)'?'Light energy splits water. Hydrogen combines with carbon dioxide to make glucose.':row.correct_answer,
          ...(row.question_number==='24(b)'?{mark_scheme:levelScheme}:{}), diagram_config:row.diagram_config,
        }))};
      },
    });
    expect(String(result.error??'')).toBe('');
    expect(result.repairCalls).toHaveLength(2);
    expect(result.exam.extraction_status).toBe('completed');
    expect(result.drafts.find(q=>q.question_number==='19(a)').question_text).toContain('Briefly outline');
    expect(result.drafts.find(q=>q.question_number==='19(a)').correct_answer).not.toContain('Calvin');
    expect(result.drafts.find(q=>q.question_number==='24(b)').correct_answer).toContain('Level 3');
    expect(result.drafts.reduce((n,q)=>n+q.marks,0)).toBe(90);
    const boundary=await boundaryHandler('publish-exam',result.drafts,tier);
    expect((await boundary.run({draftId:'exam'})).status).toBe(200);
    expect(boundary.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(41);
  });
  it('accepts a task-only MCQ repair without replacing its four choices',async()=>{
    const result=await extract('foundation',{
      mutate(questions){questions[0].question_text='A plant cell has several structures.';},
      repair(){return {parts:[{question_number:'1',instruction:'Which structure contains the genetic material?',expected_answer:'Nucleus'}]};},
    });
    expect(String(result.error??'')).toBe('');
    expect(result.repairCalls).toHaveLength(1);
    expect(result.drafts.find(q=>q.question_number==='1').options).toEqual(['Nucleus','Membrane','Ribosome','Cytoplasm']);
  });
  it('stops on a failed repair save and never marks the paper complete',async()=>{
    const result=await extract('foundation',{
      mutate(questions){questions[0].question_text='A plant cell has several structures.';},
      repair(){return {parts:[{question_number:'1',task:'Which structure contains the genetic material?',correct_answer:'Nucleus'}]};},
      rejectRepairSave:true,
    });
    expect(String(result.error)).toContain('Repair save failed');
    expect(result.exam.extraction_status).not.toBe('completed');
  });
  it('still refuses genuinely out-of-level content and stops after the existing three group attempts',async()=>{
    const result=await extract('foundation',{
      mutate(questions){questions.find(q=>q.question_number==='19(a)').correct_answer='The Calvin cycle produces sugars.';},
      repair(request){
        const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({...row,task:row.question_text}))};
      },
    });
    expect(String(result.error)).toContain('after 3 repair attempt(s)');
    expect(String(result.error)).toContain('out_of_level');
    expect(result.repairCalls).toHaveLength(3);
    expect(result.exam.extraction_status).toBe('failed');
  });
});

const levelScheme=[
  {level:1,marks:'1-2',descriptor:'Simple relevant statements about temperature regulation.',indicative_content:['Sweating occurs.']},
  {level:2,marks:'3-4',descriptor:'Links an effector response to heat transfer.',indicative_content:['Energy is transferred by sweat evaporation.']},
  {level:3,marks:'5-6',descriptor:'Explains coordinated negative feedback with linked scientific reasoning.',indicative_content:['Temperature returns towards its normal value.']},
];

async function boundaryHandler(name: string, rows: any[], tier: 'foundation'|'higher' = 'foundation') {
  const writes: Array<{table:string; value:any}>=[];
  const contextSnapshot={resolved_by:'server',context_version:2,subject_name:'Biology',exam_board:'OCR',educational_tier:'GCSE',assessment_tier:tier,course_id:OCR,paper_id:'first_paper',component_code:tier==='foundation'?'J247/01':'J247/03',paper_contract:{courseId:OCR,paperId:'first_paper',mode:'full_mock',contractVersion:1}};
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table:string){
    const q:any={};
    for(const method of ['select','eq','order','single','maybeSingle','upsert','update','insert','delete'])q[method]=(value:any)=>{
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
