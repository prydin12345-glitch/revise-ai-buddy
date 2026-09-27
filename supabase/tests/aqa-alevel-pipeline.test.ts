// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {alevelFixture,alevelSnapshot} from './aqa-alevel-fixtures';
import {biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {buildCacheKey} from '../functions/_shared/cache-utils';

it.each(['short_practice','full_mock'] as const)('generates, saves and finalises the A-level %s in whole-parent batches',async mode=>{
  const {plan}=alevelFixture(mode),r=await extract(false,mode);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(plan.parts.map(p=>p.questionNumber));
  expect(r.drafts.reduce((s,q)=>s+q.marks,0)).toBe(plan.totalMarks);expect(r.drafts.some(q=>q.question_type==='mcq')).toBe(false);
  expect(r.repairCalls).toHaveLength(0);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  for(const call of r.generationCalls){
    const prompt=call.messages.map((m:any)=>m.content).join('\n');
    expect(prompt).toContain('7402/1');expect(prompt).toContain('BIOLOGY ASSESSMENT RESOURCES');
    expect(prompt).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');expect(prompt).not.toContain('Grade range 4-9');
    const numbers=/PARTS IN THIS RESPONSE: (.+)/.exec(prompt)?.[1].split(', ')??(mode==='short_practice'?plan.parts.map(p=>p.questionNumber):[]);
    expect(numbers.length).toBeGreaterThan(0);expect(numbers.length).toBeLessThanOrEqual(10);
    for(const n of numbers)expect(plan.parts.filter(p=>p.parentId===`q${parseInt(n)}`).every(p=>numbers.includes(p.questionNumber))).toBe(true);
  }
  const h=await boundaryHandler('publish-exam',r.drafts,mode);
  expect((await h.run({draftId:'exam'})).status).toBe(200);
  expect(h.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(plan.partCount);
});
it('uses the server A-level plan when browser format metadata claims GCSE Higher',async()=>{
  const h=await boundaryHandler('save-exam-format',[]);
  expect((await h.run({draftId:'exam',format:{assessmentTier:'higher',mcq:{count:15},shortAnswer:{count:8},
    profileMetadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_2'}},includeTables:false,includeGraphs:false}}})).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exam_format')?.value;
  expect(saved.mcq_count).toBe(0);expect(saved.short_answer_count+saved.long_form_count).toBe(34);
  expect(saved.profile_metadata.assessmentTier).toBe('not_tiered');expect(saved.profile_metadata.paperBlueprint.paperContract).toEqual(alevelSnapshot().paper_contract);
});
it('repairs incomplete/later-paper tasks with point keys and unchanged numerical resources',async()=>{
  const r=await extract({mutate(q){q[0].question_text='An enzyme was investigated.';q[1].question_text='Explain the Calvin cycle.';},
    repair(request){const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
      return {parts:group.map((row:any)=>({question_number:row.question_number,instruction:['1(a)','1(b)'].includes(row.question_number)?'Briefly explain how temperature affects enzyme activity.':row.question_text,
        expected_answer:['1(a)','1(b)'].includes(row.question_number)?'More kinetic energy increases collisions (1); more enzyme-substrate complexes form (1).':row.correct_answer,diagram_config:row.diagram_config}))};}});
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');expect(r.repairCalls.length).toBeGreaterThan(0);
  expect(r.drafts[0].correct_answer).toContain('enzyme-substrate');
  expect(r.drafts.find(q=>q.diagram_config?.type==='data_table').diagram_config.rows).toEqual([[1,2],[2,4],[3,6]]);
});
it('salvages a cut-off batch and supplies saved siblings during completion',async()=>{
  const r=await extract({truncateFirstBatch:true});
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');expect(r.drafts).toHaveLength(34);
  expect(r.generationCalls.some(c=>c.messages.some((m:any)=>m.content.includes('ALREADY WRITTEN in this paper')))).toBe(true);
  expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('blocks missing parts at generation and finalisation without bypassing budgets',async()=>{
  const r=await extract(true,'short_practice');expect(String(r.error)).toContain('Planned Q1(a) is missing');
  expect(r.exam.extraction_status).not.toBe('completed');expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  const h=await boundaryHandler('publish-exam',alevelFixture().rows.slice(1));
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('does not report readiness when a valid repair cannot be saved',async()=>{
  const r=await extract({rejectRepairSave:true,mutate(q){q[0].question_text='An enzyme was investigated.';},
    repair(request){const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);return {parts:group.map((row:any)=>({...row,task:row.question_number==='1(a)'?'Explain how to control temperature.':row.question_text}))};}});
  expect(String(r.error??'')).not.toBe('');expect(r.exam.extraction_status).not.toBe('completed');
});
it.each([{specification_version:null},{specification_version:'old'},{assessment_tier:'higher'},{paper_id:'paper_2'},{component_code:'8461/1H'}])('refuses invalid saved identity before spending: %j',async snapshotPatch=>{
  const r=await extract({snapshotPatch},'short_practice');expect(String(r.error??'')).not.toBe('');expect(r.aiCalls).toHaveLength(0);
});

describe.each(['generate-practice-questions','get-practice-questions'])('%s A-level quizzes',name=>{
  it('keeps requested MCQs and point-marked written practice',async()=>{
    const r=await practice(name);
    expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(1);
    const prompt=r.calls[0].messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('7402/1');expect(prompt).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');
    const rows=r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
    expect(rows).toHaveLength(2);expect(rows[0].options).toHaveLength(4);expect(rows[0].correct_answer).toBe('Random sampling');
    expect(rows[1].marks).toBe(6);expect(rows[1].correct_answer).toContain('Maximum 6 marks');expect(rows[1].correct_answer).not.toContain('Level 3');
  });
  it('uses the course/edition-isolated cache without an AI call',async()=>{
    const r=await practice(name,true),c=alevelSnapshot('short_practice');
    expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(0);
    const key=await buildCacheKey({subject:'Biology',examBoard:'AQA',educationalLevel:'level3',assessmentTier:'not_tiered',courseId:c.course_id,paperId:'paper_1',presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),topics:['Cells'],difficulty:'mixed',questionFormat:'mixed',questionCount:2});
    expect(r.reads[0].cache_key).toBe(key);
  });
  it('rejects a context-only quiz before inserting questions',async()=>{
    const r=await practice(name,false,true);expect(r.set.extraction_status).toBe('failed');expect(r.set.extraction_error).toContain('missing_task');
    expect(r.writes.some(w=>w.table==='practice_questions'&&w.op==='insert')).toBe(false);
  });
});
