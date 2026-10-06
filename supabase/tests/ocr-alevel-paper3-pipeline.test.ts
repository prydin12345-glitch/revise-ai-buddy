// @vitest-environment node
import {expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {ocrPaper3Fixture,ocrPaper3Snapshot} from './ocr-alevel-paper3-fixtures';
import {generatedResponse,hydrateGeneratedRows} from '../functions/_shared/response-generation';
import {generateResponseFormats,responseWritePayload} from '../functions/_shared/response-generation';

it.each(['full_mock','short_practice'] as const)('generates and atomically publishes H420/03 %s from bounded parent batches',async mode=>{
  const f=ocrPaper3Fixture(mode),r=await extract(false,mode,'paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.plan.parts.map(p=>p.questionNumber));expect(r.drafts.reduce((s,q)=>s+q.marks,0)).toBe(f.plan.totalMarks);
  expect(r.drafts.some(q=>q.question_type==='mcq')).toBe(false);expect(r.aiCalls.length).toBeLessThanOrEqual(26);expect(r.repairCalls).toHaveLength(0);
  for(const c of r.generationCalls){const prompt=c.messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('H420/03');expect(prompt).toContain('ONE shared investigation');expect(prompt).not.toContain('H420/02 Biological diversity');}
  const h=await boundaryHandler('publish-exam',r.drafts,mode,'paper_3',f.snapshot);expect((await h.run({draftId:'exam'})).status).toBe(200);
  expect(h.writes.find(w=>w.table==='exam_questions')!.value).toHaveLength(f.plan.partCount);
});
it('uses the protected Paper 3 plan rather than conflicting browser format metadata',async()=>{
  const h=await boundaryHandler('save-exam-format',[],'full_mock','paper_3',ocrPaper3Snapshot());
  expect((await h.run({draftId:'exam',format:{assessmentTier:'higher',mcq:{count:15},shortAnswer:{count:2},profileMetadata:{includeGraphs:false,includeTables:false,paperBlueprint:{paperContract:{paperId:'paper_2'}}}}})).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exam_format')!.value;expect(saved.mcq_count).toBe(0);expect(saved.profile_metadata.paperBlueprint.paperContract.paperId).toBe('paper_3');
});
it('recovers truncation without losing Paper 3 data, parts or private keys',async()=>{
  const f=ocrPaper3Fixture(),r=await extract({truncateFirstBatch:true},'full_mock','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('repairs a missing instruction with the same saved synoptic context',async()=>{
  const f=ocrPaper3Fixture('short_practice'),r=await extract({mutate(rows){rows[0].question_text='A researcher studied plants.';},repair(){return {parts:f.rows.slice(0,3).map(q=>({...q,task:q.question_text,chart_data:q.diagram_config}))};}},'short_practice','paper_3',f);
  expect(String(r.error??'')).toBe('');expect(r.repairCalls.length).toBeGreaterThan(0);
  expect(r.repairCalls.map(c=>c.messages.map((m:any)=>m.content).join('\n')).join('\n')).toContain('H420/03');
});
it('does not complete or publish when repair persistence fails or required data is lost',async()=>{
  const f=ocrPaper3Fixture('short_practice'),r=await extract({rejectRepairSave:true,mutate(rows){rows[0].question_text='A researcher studied plants.';},repair(){return {parts:f.rows.slice(0,3).map(q=>({...q,task:q.question_text,chart_data:q.diagram_config}))};}},'short_practice','paper_3',f);
  expect(r.error).toBeTruthy();expect(r.exam.extraction_status).not.toBe('completed');
  const h=await boundaryHandler('publish-exam',f.rows.map(q=>({...q,diagram_config:null})),'short_practice','paper_3',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('retains written extended, plotting and calculation methods when interactive proposals are enabled',async()=>{
  const f=ocrPaper3Fixture('short_practice'),snapshot={...f.snapshot,response_formats:'interactive_v1'};
  const r=await extract(false,'short_practice','paper_3',{...f,snapshot});expect(String(r.error??'')).toBe('');
  const rows=hydrateGeneratedRows(r.drafts,r.responseDrafts,snapshot);
  expect(rows.filter(q=>generatedResponse(q))).toHaveLength(0); // Stub proposes skip; no unsuitable coercion.
  expect(rows.find(q=>q.question_number==='1(b)')!.diagram_config.type).toBe('data_table');
  expect(rows.find(q=>q.question_number==='2(c)')!.marks).toBe(6);
});
it.each(['generate-practice-questions','get-practice-questions'])('%s keeps ordinary Paper 3 quizzes outside the full mock plan',async name=>{
  const f=ocrPaper3Fixture('short_practice'),custom={snapshot:f.snapshot,topics:[f.rows[0].topic_tag],questions:[f.rows[0],f.rows[3]].map((q,i)=>({...q,question_number:String(i+1),subtopic:q.topic_tag,difficulty_level:'medium'}))};
  const r=await practice(name,false,false,'paper_1',custom);expect(r.errors).toEqual([]);expect(r.set.extraction_status).toBe('completed');
  expect(r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert')!.value).toHaveLength(2);
  expect(r.calls[0].messages.map((m:any)=>m.content).join('\n')).toContain('H420/03');
});
it('accepts suitable labelled written fields with private rubric credit and blocks recognition-only replacement',async()=>{
  const f=ocrPaper3Fixture('short_practice'),context={...f.snapshot,response_formats:'interactive_v1'};
  const proposal={definition:{version:1,revision:'r1',resourceIds:[],kind:'fields',fields:[{id:'explanation',label:'Explain your reasoning',input:'text',required:true}]},
    key:{version:1,definitionRevision:'r1',maxMarks:2,units:[{id:'reasoning',targetIds:['explanation'],marks:2,rule:{kind:'rubric',guidance:f.rows[0].correct_answer}}]}};
  const r=await generateResponseFormats([f.rows[0]],context,async()=>proposal),payload=responseWritePayload(r.rows[0]);
  expect(payload.question.correct_answer).toBeNull();expect(payload.response!.key.maxMarks).toBe(2);expect(JSON.stringify(payload.question)).not.toContain('guidance');
  const numeric={...proposal,definition:{...proposal.definition,fields:[{id:'explanation',label:'Final number',input:'number',required:true}]},key:{...proposal.key,units:[{id:'final',targetIds:['explanation'],marks:2,rule:{kind:'numeric',value:1,tolerance:0}}]}};
  await expect(generateResponseFormats([f.rows[0]],context,async()=>numeric)).rejects.toThrow();
});
it('reuses only its isolated Paper 3 cache without additional model calls',async()=>{
  const f=ocrPaper3Fixture('short_practice'),custom={snapshot:f.snapshot,topics:[f.rows[0].topic_tag],questions:[f.rows[0],f.rows[3]].map((q,i)=>({...q,question_number:String(i+1),subtopic:q.topic_tag,difficulty_level:'medium'}))};
  const r=await practice('get-practice-questions',true,false,'paper_1',custom);
  expect(r.errors).toEqual([]);expect(r.calls).toHaveLength(0);expect(r.set.extraction_status).toBe('completed');expect(r.reads.length).toBeGreaterThan(0);
});
