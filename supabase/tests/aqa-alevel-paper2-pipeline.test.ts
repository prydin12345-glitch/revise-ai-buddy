// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {alevelPaper2Fixture,alevelPaper2Snapshot} from './aqa-alevel-paper2-fixtures';
import {biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {buildCacheKey} from '../functions/_shared/cache-utils';

it.each(['short_practice','full_mock'] as const)('generates and finalises Paper 2 %s with one consistent saved reading',async mode=>{
  const {plan}=alevelPaper2Fixture(mode),r=await extract(false,mode,'paper_2');
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(plan.parts.map(p=>p.questionNumber));
  expect(r.drafts.reduce((s,q)=>s+q.marks,0)).toBe(plan.totalMarks);expect(r.repairCalls).toHaveLength(0);
  const reading=r.drafts.filter(q=>q.diagram_config?.type==='biology_comprehension');
  expect(reading).toHaveLength(mode==='full_mock'?5:3);expect(new Set(reading.map(q=>JSON.stringify(q.diagram_config))).size).toBe(1);
  for(const request of r.generationCalls){const prompt=request.messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('7402/2');expect(prompt).not.toContain('SAVED 7402/1');}
  const h=await boundaryHandler('publish-exam',r.drafts,mode,'paper_2');
  expect((await h.run({draftId:'exam'})).status).toBe(200);expect(h.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(plan.partCount);
});
it('completes a truncated first batch within the existing shared call budget',async()=>{
  const r=await extract({truncateFirstBatch:true},'full_mock','paper_2');
  expect(String(r.error??'')).toBe('');expect(r.drafts).toHaveLength(35);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('completes a truncated reading group using the saved source rather than inventing another',async()=>{
  const r=await extract({truncateReadingBatch:true},'full_mock','paper_2');
  expect(String(r.error??'')).toBe('');expect(r.drafts).toHaveLength(35);expect(r.repairCalls).toHaveLength(0);
  const prompt=r.generationCalls.at(-1).messages.map((m:any)=>m.content).join('\n');
  expect(prompt).toContain('ALREADY WRITTEN');expect(prompt).toContain('Researchers investigated');
  expect(new Set(r.drafts.filter(q=>q.diagram_config?.type==='biology_comprehension').map(q=>JSON.stringify(q.diagram_config))).size).toBe(1);
});
it('repairs a missing reading as a complete group with fresh task keys',async()=>{
  const r=await extract({mutate(q){q.find(r=>r.question_number==='4(a)').chart_data=null;},repair(){
    return {parts:alevelPaper2Fixture('short_practice').rows.slice(-3).map((q,i)=>({question_number:q.question_number,task:q.question_text,correct_answer:q.correct_answer,
      diagram_config:i?{type:'biology_comprehension_ref',resourceId:'q4_reading'}:q.diagram_config}))};
  }},'short_practice','paper_2');
  expect(String(r.error??'')).toBe('');expect(r.repairCalls).toHaveLength(1);expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.slice(-3).every(q=>q.diagram_config?.type==='biology_comprehension')).toBe(true);
});
it('blocks unresolved comprehension at generation and publication',async()=>{
  const r=await extract({mutate(q){q.find(r=>r.question_number==='4(a)').chart_data=null;}},'short_practice','paper_2');
  expect(String(r.error)).toMatch(/comprehension/i);expect(r.exam.extraction_status).not.toBe('completed');
  const {rows}=alevelPaper2Fixture('short_practice');rows.at(-1).diagram_config=null;
  const h=await boundaryHandler('publish-exam',rows,'short_practice','paper_2');
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('uses the server Paper 2 identity when browser format metadata claims Paper 1',async()=>{
  const h=await boundaryHandler('save-exam-format',[],'full_mock','paper_2');
  expect((await h.run({draftId:'exam',format:{mcq:{count:15},shortAnswer:{count:8},profileMetadata:{paperBlueprint:{paperContract:{courseId:'aqa_alevel_biology_7402',paperId:'paper_1'}}}}})).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exam_format')?.value;
  expect(saved.mcq_count).toBe(0);expect(saved.short_answer_count+saved.long_form_count).toBe(35);
  expect(saved.profile_metadata.paperBlueprint.paperContract).toEqual(alevelPaper2Snapshot().paper_contract);
});
describe.each(['generate-practice-questions','get-practice-questions'])('%s Paper 2 quizzes',name=>{
  it('preserves the requested quiz count and MCQs with legitimate Paper 2 content',async()=>{
    const r=await practice(name,false,false,'paper_2');
    expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(1);
    const prompt=r.calls[0].messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('7402/2');expect(prompt).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');
    const rows=r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
    expect(rows).toHaveLength(2);expect(rows[0].options).toHaveLength(4);expect(rows[1].question_text).toContain('Calvin cycle');
  });
  it('reads only the Paper 2 cache without a model call',async()=>{
    const r=await practice(name,true,false,'paper_2'),c=alevelPaper2Snapshot('short_practice');
    expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(0);
    const key=await buildCacheKey({subject:'Biology',examBoard:'AQA',educationalLevel:'level3',assessmentTier:'not_tiered',courseId:c.course_id,paperId:'paper_2',presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),topics:['Photosynthesis'],difficulty:'mixed',questionFormat:'mixed',questionCount:2});
    expect(r.reads[0].cache_key).toBe(key);
  });
});
