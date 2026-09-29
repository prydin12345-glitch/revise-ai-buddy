// @vitest-environment node
import {expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {alevelPaper3Fixture,essayKey} from './aqa-alevel-paper3-fixtures';
it.each(['short_practice','full_mock'] as const)('generates and finalises Paper 3 %s with one complete essay choice',async mode=>{
  const {plan}=alevelPaper3Fixture(mode),r=await extract(false,mode,'paper_3');
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');expect(r.drafts.map(q=>q.question_number)).toEqual(plan.parts.map(p=>p.questionNumber));
  expect(r.drafts.reduce((s,q)=>s+q.marks,0)).toBe(plan.totalMarks);expect(r.repairCalls).toHaveLength(0);
  const essay=r.drafts.at(-1);expect(essay.marks).toBe(25);expect(JSON.parse(essay.correct_answer)).toEqual(essayKey);expect(essay.diagram_config.titles).toHaveLength(2);
  const h=await boundaryHandler('publish-exam',r.drafts,mode,'paper_3');expect((await h.run({draftId:'exam'})).status).toBe(200);expect(h.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(plan.partCount);
});
it.each(['truncateFirstBatch','truncateEssayBatch'] as const)('completes %s within the shared budget without dropping titles or keys',async flag=>{
  const r=await extract({[flag]:true},'full_mock','paper_3');expect(String(r.error??'')).toBe('');expect(r.drafts).toHaveLength(18);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  expect(JSON.parse(r.drafts.at(-1).correct_answer)).toEqual(essayKey);
});
it('blocks a missing essay at generation and publication',async()=>{
  const r=await extract({mutate(q){q.at(-1).chart_data=null;}},'short_practice','paper_3');
  expect(String(r.error)).toMatch(/essay|titles/i);expect(r.exam.extraction_status).not.toBe('completed');
  const {rows}=alevelPaper3Fixture('short_practice');rows.at(-1).diagram_config=null;const h=await boundaryHandler('publish-exam',rows,'short_practice','paper_3');
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('refuses conflicting public resource aliases before collapsing them',async()=>{
  const r=await extract({mutate(q){const essay=q.at(-1);essay.diagram_config=structuredClone(essay.chart_data);essay.diagram_config.titles[0].title='A different sufficiently long essay title.';}},'short_practice','paper_3');
  expect(String(r.error)).toMatch(/disagree|conflict/i);expect(r.exam.extraction_status).not.toBe('completed');
});
it.each([false,true])('accepts a complete essay repair only if persistence succeeds: rejected save=%s',async rejectRepairSave=>{
  const r=await extract({rejectRepairSave,mutate(q){q.at(-1).chart_data=null;},repair(){const q=alevelPaper3Fixture('short_practice').rows.at(-1);return {parts:[{question_number:q.question_number,task:q.question_text,expected_answer:essayKey,diagram_config:q.diagram_config}]};}},'short_practice','paper_3');
  if(rejectRepairSave){expect(r.error).toBeTruthy();expect(r.exam.extraction_status).not.toBe('completed');}
  else {expect(String(r.error??'')).toBe('');expect(r.repairCalls).toHaveLength(1);expect(r.exam.extraction_status).toBe('completed');expect(JSON.parse(r.drafts.at(-1).correct_answer)).toEqual(essayKey);}
});
it.each(['generate-practice-questions','get-practice-questions'])('%s keeps an ordinary Paper 3 quiz at the requested count and format',async name=>{
  const r=await practice(name,false,false,'paper_3');expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(1);
  const prompt=r.calls[0].messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('7402/3');expect(prompt).toContain('ordinary quiz');
  const rows=r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;expect(rows).toHaveLength(2);expect(rows[0].options).toHaveLength(4);expect(rows.some((q:any)=>q.marks===25)).toBe(false);
});
