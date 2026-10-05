// @vitest-environment node
import {expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {ocrPaper2V2Fixture,fermentationContext,fermentationTask} from './ocr-alevel-paper2-v2-fixtures';
import {hydrateGeneratedRows,generatedResponse} from '../functions/_shared/response-generation';
it.each(['full_mock','short_practice'] as const)('generates/finalises v2 %s through real handlers with synthetic providers',async mode=>{
  const f=ocrPaper2V2Fixture(mode),r=await extract(false,mode,'paper_2',f);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.plan.parts.map(p=>p.questionNumber));
  expect(r.drafts.reduce((s,q)=>s+q.marks,0)).toBe(f.plan.totalMarks);expect(r.repairCalls).toHaveLength(0);
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  const boundary=await boundaryHandler('publish-exam',r.drafts,mode,'paper_2',f.snapshot);
  expect((await boundary.run({draftId:'exam'})).status).toBe(200);
});
it('repairs missing Q13 statements with a full rewrite and matching key inside existing budgets',async()=>{
  const f=ocrPaper2V2Fixture(),q=f.rows[12];
  const r=await extract({mutate(rows){rows[12].question_text='Consider the following statements about batch and continuous fermentation. Which of the statements are correct?';},repair(){return {parts:[{...q,context:fermentationContext,task:fermentationTask}]};}},'full_mock','paper_2',f);
  expect(String(r.error??'')).toBe('');expect(r.repairCalls).toHaveLength(1);
  expect(r.repairCalls[0].messages[0].content).toContain('FULL-GROUP OUTPUT');
  expect(r.repairCalls[0].messages[0].content).toContain('STATEMENT REPAIR');
  expect(r.drafts[12]).toMatchObject({question_text:q.question_text,options:q.options,correct_answer:q.correct_answer});
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('blocks publication, bounds repeated bad repairs and preserves required resources',async()=>{
  const f=ocrPaper2V2Fixture(),bad=f.rows.map((q,i)=>i===12?{...q,question_text:'Which statements are correct?'}:q);
  const h=await boundaryHandler('publish-exam',bad,'full_mock','paper_2',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
  const r=await extract({mutate(rows){rows[12].question_text=bad[12].question_text;},repair(){return {parts:[{...bad[12],task:bad[12].question_text}]};}},'full_mock','paper_2',f);
  expect(String(r.error)).toContain('invalid_statements');expect(r.repairCalls).toHaveLength(3);expect(r.exam.extraction_status).toBe('failed');
  const missing=f.rows.map((q,i)=>i===3?{...q,diagram_config:null}:q);
  const b=await boundaryHandler('publish-exam',missing,'full_mock','paper_2',f.snapshot);
  expect((await b.run({draftId:'exam'})).status).toBe(422);
});
it('preserves Q13 stimulus through tick-one adaptation and atomic publication without exposing its key',async()=>{
  const f=ocrPaper2V2Fixture(),snapshot={...f.snapshot,response_formats:'interactive_v1'};
  const r=await extract(false,'full_mock','paper_2',{...f,snapshot});expect(String(r.error??'')).toBe('');
  const rows=hydrateGeneratedRows(r.drafts,r.responseDrafts,snapshot),q=rows[12];
  expect(generatedResponse(q)?.definition.kind).toBe('choice');expect(q.question_text).toContain('3. A continuous culture');
  const h=await boundaryHandler('publish-exam',r.drafts,'full_mock','paper_2',snapshot,r.responseDrafts);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
  const entries=h.writes.find(w=>w.table==='commit_generated_responses')!.value.p_rows;
  expect(entries).toHaveLength(43);
  for(const entry of entries.filter((e:any)=>e.response)){expect(entry.question.correct_answer).toBeNull();expect(entry.response.key.maxMarks).toBe(entry.question.marks);}
});
it.each(['generate-practice-questions','get-practice-questions'])('%s validates statement completeness in ordinary v2 quizzes',async name=>{
  const f=ocrPaper2V2Fixture(),q={...f.rows[12],question_number:'1',subtopic:f.rows[12].topic_tag,difficulty_level:'medium'};
  const r=await practice(name,false,false,'paper_1',{snapshot:f.snapshot,questions:[q,{...f.rows[13],question_number:'2',subtopic:q.topic_tag,difficulty_level:'medium'}],topics:[q.topic_tag]});
  expect(r.errors).toEqual([]);expect(r.set.extraction_status).toBe('completed');
});
