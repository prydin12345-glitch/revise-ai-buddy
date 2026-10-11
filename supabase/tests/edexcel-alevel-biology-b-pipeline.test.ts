// @vitest-environment node
import {expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {edexcelBFixture} from './edexcel-alevel-biology-b-fixtures';
import {hydrateGeneratedRows} from '../functions/_shared/response-generation';
it.each(['full_mock','short_practice'] as const)('batches complete Biology B %s parents and persists exact saved parts',async mode=>{
  const f=edexcelBFixture(mode),r=await extract(false,mode,'paper_1',f);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');expect(r.drafts).toHaveLength(f.plan.partCount);
  expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
  expect(r.generationCalls.length).toBeGreaterThan(mode==='full_mock'?1:0);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  for(const c of r.generationCalls){const prompt=c.messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('9BI0/01');expect(prompt).not.toContain('15 one-mark MCQs');}
});
it('rejects invented/out-of-batch numbering rather than silently matching by array position',async()=>{
  const f=edexcelBFixture('short_practice'),r=await extract({mutate(qs){qs.forEach(q=>q.question_number='99(a)');}},'short_practice','paper_1',f);
  expect(r.error).toBeTruthy();expect(r.exam.extraction_status).not.toBe('completed');
});
it('recovers a truncated batch without renumbering or losing private options/resources/schemes',async()=>{
  const f=edexcelBFixture(),r=await extract({truncateFirstBatch:true},'full_mock','paper_1',f);
  expect(String(r.error??'')).toBe('');expect(r.drafts.map(q=>q.question_number)).toEqual(f.rows.map(q=>q.question_number));
  const last=r.drafts.find(q=>q.question_number==='9(d)');expect(last.correct_answer).toContain('Level 3');expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('repairs an instruction as a complete group with original MCQs, resources and private schemes',async()=>{
  const f=edexcelBFixture('short_practice'),r=await extract({mutate(qs){qs[2].question_text='The researchers measured enzyme activity.';},repair(){return {parts:f.rows.slice(0,3).map(q=>({...q,task:q.question_text,chart_data:q.diagram_config}))};}},'short_practice','paper_1',f);
  expect(String(r.error??'')).toBe('');expect(r.repairCalls.length).toBeGreaterThan(0);
  const q=r.drafts.find(q=>q.question_number==='1(a)');expect(q.options).toEqual(f.rows[0].options);expect(q.correct_answer).toBe(f.rows[0].correct_answer);
  expect(r.drafts.find(q=>q.question_number==='1(b)').diagram_config.rows).toEqual(f.rows[1].diagram_config.rows);
});
it('reports rejected repairs and never completes a paper with absent required data',async()=>{
  const f=edexcelBFixture('short_practice'),r=await extract({mutate(qs){qs[1].chart_data=null;},repair(){return {parts:f.rows.slice(0,3).map(q=>({...q,task:q.question_text,chart_data:null,diagram_config:null}))};}},'short_practice','paper_1',f);
  expect(r.error).toBeTruthy();expect(String(r.error)).toMatch(/Repair rejections|resource/);expect(r.exam.extraction_status).not.toBe('completed');
});
it('protects format and timer from conflicting browser metadata',async()=>{
  const f=edexcelBFixture(),h=await boundaryHandler('save-exam-format',[],'full_mock','paper_1',f.snapshot);
  expect((await h.run({draftId:'exam',format:{assessmentTier:'higher',mcq:{count:15},shortAnswer:{count:2},profileMetadata:{paperBlueprint:{paperContract:{courseId:'ocr_alevel_biology_a_h420',paperId:'paper_1'}}}}})).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exam_format')!.value;expect(saved.mcq_count).toBe(10);expect(saved.profile_metadata.paperBlueprint.paperContract.paperId).toBe('9bi0_01');
  const timer=await boundaryHandler('save-exam-timer',[],'full_mock','paper_1',f.snapshot);expect((await timer.run({draftId:'exam',enabled:true,duration:20})).status).toBe(200);
  expect(JSON.stringify(timer.writes)).toContain('105');
});
it('publish boundary rejects incomplete resources without writing questions',async()=>{
  const f=edexcelBFixture('short_practice'),h=await boundaryHandler('publish-exam',f.rows.map(q=>({...q,diagram_config:null})),'short_practice','paper_1',f.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('interactive proposals preserve prose, method marks and plotting; skip leaves the original response path intact',async()=>{
  const f=edexcelBFixture('short_practice'),snapshot={...f.snapshot,response_formats:'interactive_v1'},r=await extract(false,'short_practice','paper_1',{...f,snapshot});
  expect(String(r.error??'')).toBe('');const rows=hydrateGeneratedRows(r.drafts,r.responseDrafts,snapshot);
  expect(rows.find(q=>q.question_number==='1(b)')!.diagram_config.type).toBe('data_table');expect(rows.at(-1)!.marks).toBe(6);
});
it.each(['generate-practice-questions','get-practice-questions'])('%s handles isolated Biology B fresh and cached quizzes without substituting a full mock',async name=>{
  const f=edexcelBFixture('short_practice'),custom={snapshot:f.snapshot,topics:[f.rows[0].topic_tag],questions:[f.rows[0],f.rows[2]].map((q,i)=>({...q,question_number:String(i+1),subtopic:q.topic_tag,difficulty_level:'medium'}))};
  const fresh=await practice(name,false,false,'paper_1',custom);expect(fresh.errors).toEqual([]);expect(fresh.set.extraction_status).toBe('completed');
  expect(fresh.calls[0].messages.map((m:any)=>m.content).join('\n')).toContain('Biology B');
  const cached=await practice(name,true,false,'paper_1',custom);expect(cached.errors).toEqual([]);expect(cached.calls).toHaveLength(0);expect(cached.set.extraction_status).toBe('completed');
});
