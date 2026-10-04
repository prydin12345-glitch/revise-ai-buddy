// @vitest-environment node
import {expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {ocrPaper2Fixture,ocrPaper2Snapshot} from './ocr-alevel-paper2-fixtures';
import {generatedResponse,hydrateGeneratedRows,legacyResponseCandidate} from '../functions/_shared/response-generation';

it.each(['full_mock','short_practice'] as const)('generates/finalises H420/02 %s with a frozen plan and budgets',async mode=>{
  const f=ocrPaper2Fixture(mode),r=await extract(false,mode,'paper_2',f);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.plan.parts.map(p=>p.questionNumber));
  expect(r.drafts.filter(q=>q.question_type==='mcq')).toHaveLength(mode==='full_mock'?15:5);
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);expect(r.repairCalls).toHaveLength(0);
  for(const c of r.generationCalls){const prompt=c.messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('H420/02');expect(prompt).toContain('Modules 1, 2, 4 and 6');expect(prompt).not.toContain('H420/01 Biological processes');}
  const h=await boundaryHandler('publish-exam',r.drafts,mode,'paper_2',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
  expect(h.writes.find(w=>w.table==='exam_questions')!.value).toHaveLength(f.plan.partCount);
});
it('forces the server Paper 2 format despite conflicting browser metadata',async()=>{
  const h=await boundaryHandler('save-exam-format',[],'full_mock','paper_2',ocrPaper2Snapshot());
  expect((await h.run({draftId:'exam',format:{assessmentTier:'higher',mcq:{count:0},shortAnswer:{count:2},profileMetadata:{includeGraphs:false,includeTables:false}}})).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exam_format')!.value;
  expect(saved.mcq_count).toBe(15);expect(saved.profile_metadata.paperBlueprint.paperContract.paperId).toBe('paper_2');
});
it('recovers a truncated MCQ batch without dropping choices or changing numbering',async()=>{
  const f=ocrPaper2Fixture(),r=await extract({truncateFirstBatch:true},'full_mock','paper_2',f);
  expect(String(r.error??'')).toBe('');expect(r.drafts.slice(0,15).map(q=>q.question_number)).toEqual(Array.from({length:15},(_,i)=>String(i+1)));
  expect(r.drafts.slice(0,15).map(q=>q.options)).toEqual(f.rows.slice(0,15).map(q=>q.options));expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('repairs a lost task with the Paper 2 outcomes and original choices',async()=>{
  const f=ocrPaper2Fixture(),r=await extract({mutate(rows){rows[6].question_text='A humoral immune response is observed.';},repair(){return {parts:[{...f.rows[6],task:f.rows[6].question_text}]};}},'full_mock','paper_2',f);
  expect(String(r.error??'')).toBe('');expect(r.repairCalls.length).toBeGreaterThan(0);expect(r.drafts[6].options).toEqual(f.rows[6].options);
  expect(r.repairCalls.map(c=>c.messages.map((m:any)=>m.content).join('\n')).join('\n')).toContain('4.1.1');
});
it('does not complete when repair persistence fails or required data stays missing',async()=>{
  const f=ocrPaper2Fixture('short_practice');
  const r=await extract({rejectRepairSave:true,mutate(rows){rows[0].options=['One','Two','Three'];},repair(){return {parts:[{...f.rows[0],task:f.rows[0].question_text}]};}},'short_practice','paper_2',f);
  expect(r.error).toBeTruthy();expect(r.exam.extraction_status).not.toBe('completed');
  const missing=f.rows.map(q=>q.diagram_config?{...q,diagram_config:null}:q),h=await boundaryHandler('publish-exam',missing,'short_practice','paper_2',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('blocks Paper 1-only recall at finalisation',async()=>{
  const f=ocrPaper2Fixture(),rows=f.rows.map((q,i)=>i===16?{...q,question_text:'Explain the Calvin cycle.',correct_answer:'RuBP reacts with carbon dioxide.'}:q);
  const h=await boundaryHandler('publish-exam',rows,'full_mock','paper_2',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('uses shared tick-one contracts and atomic publication without exposing keys in draft resources',async()=>{
  const f=ocrPaper2Fixture();const snapshot={...f.snapshot,response_formats:'interactive_v1'};
  const r=await extract(false,'full_mock','paper_2',{...f,snapshot});expect(String(r.error??'')).toBe('');
  const rows=hydrateGeneratedRows(r.drafts,r.responseDrafts,snapshot),mcqs=rows.filter(q=>q.question_type==='mcq');expect(mcqs).toHaveLength(15);
  const expected=f.plan.parts.filter(p=>p.responseType==='mcq_single'&&p.resource!=='graph').length;
  expect(mcqs.filter(q=>generatedResponse(q)?.definition.kind==='choice')).toHaveLength(expected);
  expect(r.drafts.map(legacyResponseCandidate).reduce((n,q)=>n+q.marks,0)).toBe(100);
  const h=await boundaryHandler('publish-exam',r.drafts,'full_mock','paper_2',snapshot,r.responseDrafts);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
  const commit=h.writes.find(w=>w.table==='commit_generated_responses')!.value;
  for(const entry of commit.p_rows.filter((r:any)=>r.response)){expect(entry.question.correct_answer).toBeNull();expect(entry.response.key.maxMarks).toBe(entry.question.marks);}
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it.each(['generate-practice-questions','get-practice-questions'])('%s retains quiz count/format and Paper 2 scope',async name=>{
  const rows=ocrPaper2Fixture().rows;const custom={snapshot:ocrPaper2Snapshot('short_practice'),topics:['Biodiversity, evolution and disease'],questions:[rows[6],rows[8]].map((q,i)=>({...q,question_number:String(i+1),subtopic:q.topic_tag,difficulty_level:'medium'}))};
  const r=await practice(name,false,false,'paper_1',custom);
  expect(r.errors).toEqual([]);expect(r.set.extraction_status).toBe('completed');
  expect(r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert')!.value).toHaveLength(2);
  const prompt=r.calls[0].messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('H420/02');expect(prompt).toContain('preserve its requested count');
});
