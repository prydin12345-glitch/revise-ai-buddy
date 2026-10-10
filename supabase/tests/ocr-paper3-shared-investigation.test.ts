// @vitest-environment node
import {expect,it} from 'vitest';
import {ocrPaper3Fixture} from './ocr-alevel-paper3-fixtures';
import {ocrPaper2Fixture} from './ocr-alevel-paper2-fixtures';
import {extract,boundaryHandler} from './aqa-alevel-runtime';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {validateQuestionCandidates,describeDefects} from '../functions/_shared/question-contract-validator';
import {buildQuestionRepairPrompt,requestQuestionRepair} from '../functions/_shared/question-repair';
import {expandPaper3SharedTables,paper3SharedDataInstructions} from '../functions/_shared/ocr-paper3-shared-data';

// Original synthetic investigation, not the unavailable failed production data.
function fixture(){
  const f=ocrPaper3Fixture();
  for(const q of f.rows.filter(q=>['6(b)','6(c)'].includes(q.question_number))){
    q.diagram_config={type:'data_table',id:f.plan.parts.find(p=>p.questionNumber===q.question_number)!.resourceId,
      headers:['Distance from habitat boundary (m)','Number of plants'],rows:[[5,10],[10,20],[15,30],[20,40]],
      units:['m','plants'],caption:'Plants counted in equally sized quadrats at four sampling distances'};
    q.question_text='Researchers used equally sized quadrats to investigate a plant population at four sampling distances.\n\n'+
      (q.question_number==='6(b)'?'Describe the relationship between sampling distance and the number of plants. Support your answer with the supplied observations.':'Calculate the percentage increase in the number of plants between 5 m and 15 m. Show your working.');
    q.correct_answer=q.question_number==='6(b)'?'The number increases with distance; support with supplied counts, for example 10 at 5 m and 30 at 15 m. Two capped points.':'(30−10)/10 × 100 = 200%. Credit difference, division by initial count and percentage, capped at 3.';
  }
  return f;
}
const check=(f:ReturnType<typeof fixture>)=>validateQuestionCandidates(f.rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)});
function input(f:ReturnType<typeof fixture>){return {group:f.rows.filter(q=>q.question_number.startsWith('6(')),subject:'Biology',scope:biologyScopeFromContext(f.snapshot),plan:f.plan,mode:'full_group' as const,targetNumbers:new Set(['6(c)']),defects:describeDefects(check(f).defects)};}
function repaired(f:ReturnType<typeof fixture>,reference=true){return f.rows.filter(q=>q.question_number.startsWith('6(')).map(q=>{
  const [context,task]=q.question_text.split('\n\n');
  return {...q,context,task,diagram_config:q.question_number==='6(c)'&&reference
    ?{type:'data_table',id:q.diagram_config.id,shared_dataset_ref:'experiment_6',source_question_number:'6(b)'}:q.diagram_config};
});}
const reply=(parts:any[])=>async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({parts})}}]}));
function conflict(){const f=fixture();f.rows.find(q=>q.question_number==='6(c)')!.diagram_config.rows[2][1]=35;return f;}

it('reports which part of the shared table disagrees instead of a generic conflict',()=>{
  const f=conflict(),message=describeDefects(check(f).defects);
  expect(message).toContain('row 3, column 2');
  expect(check(f).ok).toBe(false);
});
it.each(['headers','units','caption','rows'] as const)('continues rejecting a mismatch in %s',field=>{
  const f=fixture(),table=f.rows.find(q=>q.question_number==='6(c)')!.diagram_config;
  if(field==='headers')table.headers[1]='Plants observed';
  if(field==='units')table.units[0]='cm';
  if(field==='caption')table.caption='A different sampling procedure';
  if(field==='rows')table.rows.pop();
  const message=describeDefects(check(f).defects);
  expect(message).toContain('conflicting_resource_data');
  expect(message).toContain(field==='headers'?'column headers':field==='rows'?'number of observations':field);
});
it('shows all four repair siblings and explicitly supplies or references both required tables',()=>{
  const prompt=buildQuestionRepairPrompt(input(conflict()));
  const example=JSON.parse(prompt.match(/Return JSON only: (.+)$/)![1]);
  expect(example.parts.map((p:any)=>p.question_number)).toEqual(['6(a)','6(b)','6(c)','6(d)']);
  expect(example.parts.find((p:any)=>p.question_number==='6(b)').diagram_config.type).toBe('data_table');
  expect(example.parts.find((p:any)=>p.question_number==='6(c)').diagram_config.shared_dataset_ref).toBe('experiment_6');
  expect(prompt).toContain('SHARED INVESTIGATION DATA');
  expect(prompt).toContain('Do not omit a required table');
});
it('preserves a consistent recoverable investigation in the complete repair example',()=>{
  const f=fixture();f.rows.find(q=>q.question_number==='6(a)')!.question_text='Researchers sampled plants.';
  const prompt=buildQuestionRepairPrompt(input(f));
  const example=JSON.parse(prompt.match(/Return JSON only: (.+)$/)![1]);
  const table=example.parts.find((p:any)=>p.question_number==='6(b)').diagram_config;
  expect(table.headers).toEqual(f.rows.find(q=>q.question_number==='6(b)')!.diagram_config.headers);
  expect(table.rows).toEqual([[5,10],[10,20],[15,30],[20,40]]);
  expect(prompt).toContain('recalculate every dependent private key');
});
it('expands a complete group repair reference into the exact supplied table before all existing gates',async()=>{
  const f=conflict(),good=fixture(),result=await requestQuestionRepair(input(f),'test-only',reply(repaired(good)));
  expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true);
  const a=result.replacements['6(b)'].diagram_config,b=result.replacements['6(c)'].diagram_config;
  expect({...a,id:b.id}).toEqual(b);
  expect(b.rows).toEqual([[5,10],[10,20],[15,30],[20,40]]);
  expect(b).not.toHaveProperty('shared_dataset_ref');
  expect(result.replacements['6(c)'].correct_answer).toContain('200%');
});
it.each(['chart_data','diagram_config','diagramConfig','table_data'])('losslessly expands the %s transport alias without changing the source or keys',field=>{
  const f=fixture(),rows=repaired(f).map(q=>({...q,diagram_config:null,[field]:q.diagram_config}));
  const original=structuredClone(rows),result=expandPaper3SharedTables(rows,f.plan);
  expect(result.diagnostics).toEqual([]);expect(rows).toEqual(original);
  const source=result.rows.find(q=>q.question_number==='6(b)')!,dependent=result.rows.find(q=>q.question_number==='6(c)')!;
  expect({...source[field],id:dependent[field].id}).toEqual(dependent[field]);
  expect(dependent.correct_answer).toContain('200%');
  expect(dependent[field].rows).not.toBe(source[field].rows);
});
it.each([
  ['wrong dataset',(parts:any[])=>{parts.find(p=>p.question_number==='6(c)').diagram_config.shared_dataset_ref='experiment_4';}],
  ['wrong destination ID',(parts:any[])=>{parts.find(p=>p.question_number==='6(c)').diagram_config.id='other_resource';}],
  ['another parent',(parts:any[])=>{parts.find(p=>p.question_number==='6(c)').diagram_config.source_question_number='4(b)';}],
  ['missing source',(parts:any[])=>{parts.find(p=>p.question_number==='6(b)').diagram_config=null;}],
  ['duplicate source',(parts:any[])=>{parts.push(structuredClone(parts.find(p=>p.question_number==='6(b)')));}],
  ['self-reference',(parts:any[])=>{parts.find(p=>p.question_number==='6(c)').diagram_config.source_question_number='6(c)';}],
  ['cycle',(parts:any[])=>{parts.find(p=>p.question_number==='6(b)').diagram_config={type:'data_table',shared_dataset_ref:'experiment_6',source_question_number:'6(c)'};}],
  ['reference with replacement rows',(parts:any[])=>{parts.find(p=>p.question_number==='6(c)').diagram_config.rows=[[1,2]];}],
  ['reference with private fields',(parts:any[])=>{parts.find(p=>p.question_number==='6(c)').diagram_config.correct_answer='PRIVATE';}],
  ['incomplete source rows',(parts:any[])=>{parts.find(p=>p.question_number==='6(b)').diagram_config.rows[0].pop();}],
  ['hidden conflicting target copy',(parts:any[])=>{const p=parts.find(p=>p.question_number==='6(c)');p.chart_data={type:'data_table',headers:['Distance from habitat boundary (m)','Number of plants'],rows:[[5,11],[10,20],[15,30],[20,40]]};}],
  ['hidden source caption disagreement',(parts:any[])=>{const p=parts.find(p=>p.question_number==='6(b)');p.chart_data={...structuredClone(p.diagram_config),caption:'Another sampling procedure'};}],
])('rejects %s instead of filling or hiding data',async(_name,mutate)=>{
  const f=fixture(),parts=repaired(f);mutate(parts);
  const original=structuredClone(parts),result=expandPaper3SharedTables(parts,f.plan);
  expect(result.diagnostics.length).toBeGreaterThan(0);expect(parts).toEqual(original);
  const repair=await requestQuestionRepair(input(f),'test-only',reply(parts));
  expect(repair.ok).toBe(false);expect(repair.replacements).toEqual({});
});
it('does not hide private marking fields in an otherwise complete source table',async()=>{
  const f=fixture(),parts=repaired(f);parts.find(p=>p.question_number==='6(b)')!.diagram_config.private_key='PRIVATE';
  const result=await requestQuestionRepair(input(f),'test-only',reply(parts));
  expect(result.ok).toBe(false);expect(result.diagnostics.some(d=>d.detail.includes('private marking'))).toBe(true);
});
it('does not enable shared references for Paper 2, Custom or a display-name-only identity',()=>{
  const f=fixture(),rows=repaired(f);
  const plans=[ocrPaper2Fixture().plan,null,{...f.plan,courseId:'unknown',displayName:'OCR H420/03 Unified biology'}];
  for(const plan of plans){
    expect(paper3SharedDataInstructions(plan as any,f.plan.parts,'chart_data')).toBe('');
    expect(expandPaper3SharedTables(rows,plan as any).rows).toBe(rows);
  }
  expect(paper3SharedDataInstructions(ocrPaper3Fixture('short_practice').plan,ocrPaper3Fixture('short_practice').plan.parts,'chart_data')).toBe('');
});
it('retains the task-only envelope and original shared data',()=>{
  const prompt=buildQuestionRepairPrompt({...input(fixture()),mode:'task_only',defects:'missing_task'});
  const example=JSON.parse(prompt.match(/Return JSON only: (.+)$/)![1]);
  expect(prompt).not.toContain('SHARED INVESTIGATION DATA');
  expect(example.parts).toHaveLength(1);
  expect(example.parts[0]).not.toHaveProperty('diagram_config');
});
it('does not choose one conflicting table or fill a missing repair resource automatically',async()=>{
  const f=conflict(),parts=repaired(f,false);
  const inconsistent=await requestQuestionRepair(input(f),'test-only',reply(parts));
  expect(inconsistent.ok).toBe(false);expect(inconsistent.diagnostics.some(d=>d.code==='conflicting_resource_data')).toBe(true);
  parts.find(p=>p.question_number==='6(c)')!.diagram_config=null;
  const missing=await requestQuestionRepair(input(f),'test-only',reply(parts));
  expect(missing.ok).toBe(false);expect(missing.diagnostics.some(d=>d.code==='missing_required_resource')).toBe(true);
  expect(f.rows.find(q=>q.question_number==='6(c)')!.diagram_config.rows[2][1]).toBe(35);
});
it('accepts one explicitly shared table in full-paper generation without any repair',async()=>{
  const f=fixture(),r=await extract({mutate(rows){rows.find(q=>q.question_number==='6(c)').chart_data=repaired(f).find(q=>q.question_number==='6(c)')!.diagram_config;}},'full_mock','paper_3',f);
  expect(r.error).toBeUndefined();expect(r.repairCalls).toHaveLength(0);
  expect(r.drafts.find(q=>q.question_number==='6(c)')?.diagram_config.rows).toEqual([[5,10],[10,20],[15,30],[20,40]]);
});
it('completes a truncated shared group from its accepted source without resubmitting or changing data',async()=>{
  const f=fixture();let truncated=false;
  const r=await extract({mutate(rows){rows.find(q=>q.question_number==='6(c)').chart_data=repaired(f).find(q=>q.question_number==='6(c)')!.diagram_config;},
    generationResponse(_request,questions){
      if(!truncated&&questions.some(q=>q.question_number==='6(c)')){
        truncated=true;
        const first=questions.filter(q=>['5(a)','5(b)','5(c)','5(d)','6(a)','6(b)'].includes(q.question_number));
        return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"questions":['+first.map(q=>JSON.stringify(q)).join(',')+',{"question_number":"6(c)"'}}]}));
      }
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions})}}]}));
    }},'full_mock','paper_3',f);
  expect(truncated).toBe(true);expect(r.error).toBeUndefined();expect(r.repairCalls).toHaveLength(0);
  expect(r.generationCalls).toHaveLength(4);expect(r.drafts).toHaveLength(24);
  expect(new Set(r.drafts.map(q=>q.question_number)).size).toBe(24);
  expect(r.drafts.find(q=>q.question_number==='6(c)')!.diagram_config.rows).toEqual([[5,10],[10,20],[15,30],[20,40]]);
});
it('rejects broken generation references before resource alias collapse or draft writes',async()=>{
  const f=fixture(),r=await extract({mutate(rows){
    rows.find(q=>q.question_number==='6(c)').diagram_config={type:'data_table',shared_dataset_ref:'experiment_4',source_question_number:'4(b)'};
  }},'full_mock','paper_3',f);
  expect(String(r.error)).toContain('invalid_shared_dataset_reference');
  expect(r.drafts).toHaveLength(0);expect(r.exam.extraction_status).not.toBe('completed');
});
it('repairs the reported group once, saves both tables and passes the publication boundary',async()=>{
  const f=fixture(),r=await extract({mutate(rows){rows.find(q=>q.question_number==='6(c)').chart_data.rows[2][1]=35;},repair(){return {parts:repaired(f)};}},'full_mock','paper_3',f);
  expect(r.error).toBeUndefined();expect(r.repairCalls).toHaveLength(1);expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts).toHaveLength(24);
  const a=r.drafts.find(q=>q.question_number==='6(b)')!.diagram_config,b=r.drafts.find(q=>q.question_number==='6(c)')!.diagram_config;
  expect({...a,id:b.id}).toEqual(b);expect(b).not.toHaveProperty('shared_dataset_ref');
  const publish=await boundaryHandler('publish-exam',r.drafts,'full_mock','paper_3',f.snapshot);
  expect((await publish.run({draftId:'exam'})).status).toBe(200);
});
it('stops after three resource-dropping repairs without publishing conflicting data',async()=>{
  const f=fixture(),r=await extract({mutate(rows){rows.find(q=>q.question_number==='6(c)').chart_data.caption='A different investigation';},repair(){const parts=repaired(f,false);parts.find(q=>q.question_number==='6(c)')!.diagram_config=null;return {parts};}},'full_mock','paper_3',f);
  expect(String(r.error)).toContain('Complete group repairs must return every required resource');
  expect(r.repairCalls).toHaveLength(3);expect(r.exam.extraction_status).toBe('failed');
  const publish=await boundaryHandler('publish-exam',r.drafts,'full_mock','paper_3',f.snapshot);
  expect((await publish.run({draftId:'exam'})).status).toBe(422);
  expect(publish.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('adds shared-investigation guidance only to the matching Paper 3 batches',async()=>{
  const f=fixture(),r=await extract(false,'full_mock','paper_3',f);
  expect(r.error).toBeUndefined();
  for(const call of r.generationCalls){
    const prompt=call.messages.map((m:any)=>m.content).join('\n');
    const identities=JSON.parse(prompt.split('\n').find((line:string)=>line.startsWith('[{"part_id":'))!);
    const hasShared=identities.some((p:any)=>['1(b)','4(b)','6(b)'].includes(p.question_number));
    expect(prompt.includes('SHARED INVESTIGATION DATA')).toBe(hasShared);
  }
  const p2=ocrPaper2Fixture('short_practice'),other=await extract(false,'short_practice','paper_2',p2);
  expect(other.error).toBeUndefined();expect(JSON.stringify(other.generationCalls)).not.toContain('SHARED INVESTIGATION DATA');
});
