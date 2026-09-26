// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './ocr21c-pipeline-runtime';
import {ocr21cFixture,ocr21cSnapshot} from './ocr21c-fixtures';
import {fixtureScheme} from './aqa-paper2-fixtures';
import {biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {buildCacheKey} from '../functions/_shared/cache-utils';

describe.each(['breadth','depth'] as const)('real J257 %s extraction',paper=>{
  describe.each(['foundation','higher'] as const)('%s',tier=>{
    it.each(['short_practice','full_mock'] as const)('generates, persists and finalises %s with whole-group batches',async mode=>{
      const {plan}=ocr21cFixture(paper,tier,mode);
      const r=await extract(paper,tier,false,mode);
      expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
      expect(r.drafts.map(q=>q.question_number)).toEqual(plan.parts.map(p=>p.questionNumber));
      expect(r.drafts.reduce((n,q)=>n+q.marks,0)).toBe(plan.totalMarks);
      expect(r.drafts.filter(q=>q.question_type==='mcq')).toHaveLength(mode==='short_practice'?2:paper==='breadth'?6:3);
      expect(r.drafts.filter(q=>q.marks===6)).toHaveLength(paper==='breadth'?0:2);
      expect(r.repairCalls).toHaveLength(0);expect(r.generationCalls).toHaveLength(mode==='full_mock'?5:2);
      for(const call of r.generationCalls) {
        const prompt=call.messages.map((m:any)=>m.content).join('\n');
        expect(prompt).toContain(plan.componentCode);expect(prompt).toContain(paper.toUpperCase());
        expect(prompt).toContain('BIOLOGY ASSESSMENT RESOURCES');
        expect(prompt).not.toContain('Section A: questions 1–15');
        const numbers=/PARTS IN THIS RESPONSE: (.+)/.exec(prompt)?.[1].split(', ')??[];
        expect(numbers.length).toBeGreaterThan(0);expect(numbers.length).toBeLessThanOrEqual(10);
        for(const number of numbers)expect(plan.parts.filter(p=>p.parentId===`q${parseInt(number)}`).every(p=>numbers.includes(p.questionNumber))).toBe(true);
      }
      const boundary=await boundaryHandler(paper,'publish-exam',r.drafts,tier,mode);
      expect((await boundary.run({draftId:'exam'})).status).toBe(200);
      expect(boundary.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(plan.partCount);
    });
    it('ignores conflicting browser choices in favour of the protected saved component',async()=>{
      const plan=ocr21cFixture(paper,tier).plan;
      const h=await boundaryHandler(paper,'save-exam-format',[],tier);
      expect((await h.run({draftId:'exam',format:{mcq:{count:15},shortAnswer:{count:8},assessmentTier:tier==='foundation'?'higher':'foundation',
        profileMetadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1'}},includeTables:false,includeGraphs:false}}})).status).toBe(200);
      const saved=h.writes.find(w=>w.table==='exam_format')?.value;
      expect(saved.mcq_count).toBe(plan.parts.filter(p=>p.responseType==='mcq_single').length);
      expect(saved.short_answer_count+saved.long_form_count+saved.mcq_count).toBe(plan.partCount);
      expect(saved.profile_metadata.paperBlueprint.paperContract).toEqual(ocr21cSnapshot(paper,tier).paper_contract);
      expect(saved.profile_metadata.assessmentTier).toBe(tier);expect(saved.include_tables).toBe(true);expect(saved.include_graphs).toBe(true);
    });
  });
  it('repairs incomplete tasks and keeps options, keys and the same data',async()=>{
    const r=await extract(paper,'foundation',{
      mutate(q){q[0].question_text='A student made measurements.';if(paper==='depth')q.find(row=>row.question_number==='2(d)').correct_answer='Only an answer.';},
      repair(request){
        const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({question_number:row.question_number,instruction:row.question_number==='1(a)'?'Which method improves the sample?':row.question_text,
          expected_answer:row.correct_answer,...(paper==='depth'&&row.question_number==='2(d)'?{mark_scheme:fixtureScheme}:{}),diagram_config:row.diagram_config}))};
      },
    });
    expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
    expect(r.repairCalls).toHaveLength(paper==='depth'?2:1);expect(r.drafts[0].options).toHaveLength(4);
    expect(r.drafts.find(q=>q.diagram_config?.type==='data_table').diagram_config.rows).toEqual([[1,2],[2,4],[3,6]]);
    if(paper==='depth')expect(r.drafts.find(q=>q.question_number==='2(d)').correct_answer).toContain('Level 3');
  });
  it('completes a truncated batch without losing earlier values or exceeding the budget',async()=>{
    const r=await extract(paper,'higher',{truncateFirstBatch:true});
    expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
    expect(new Set(r.drafts.map(q=>q.question_number)).size).toBe(ocr21cFixture(paper).plan.partCount);
    expect(r.aiCalls.length).toBeLessThanOrEqual(26);
    expect(r.generationCalls.some(c=>c.messages.some((m:any)=>m.content.includes('ALREADY WRITTEN in this paper')))).toBe(true);
  });
  it('blocks missing parts at generation and finalisation',async()=>{
    const r=await extract(paper,'foundation',true,'short_practice');
    expect(String(r.error)).toContain('Planned Q1(a) is missing');expect(r.exam.extraction_status).not.toBe('completed');
    expect(r.aiCalls.length).toBeLessThanOrEqual(26);
    const h=await boundaryHandler(paper,'publish-exam',ocr21cFixture(paper).rows.slice(1));
    expect((await h.run({draftId:'exam'})).status).toBe(422);
    expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
  });
});

it('stops a rejected repair write rather than claiming the repaired Depth paper is ready',async()=>{
  const r=await extract('depth','foundation',{rejectRepairSave:true,mutate(q){q[0].question_text='The students measured results.';},
    repair(request){const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
      return {parts:group.map((row:any)=>({...row,task:row.question_number==='1(a)'?'Which method improves the sample?':row.question_text}))};}});
  expect(String(r.error)).not.toBe('');expect(r.exam.extraction_status).not.toBe('completed');
});

describe.each(['generate-practice-questions','get-practice-questions'])('%s J257 quiz path',name=>{
  describe.each(['breadth','depth'] as const)('%s',paper=>{
    it.each(['foundation','higher'] as const)('keeps %s quizzes small and saves canonical answers',async tier=>{
      const r=await practice(paper,name,tier);
      expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(1);
      expect(r.calls[0].messages.map((m:any)=>m.content).join('\n')).toContain(ocr21cSnapshot(paper,tier).component_code);
      const rows=r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
      expect(rows).toHaveLength(2);expect(rows[0].options).toHaveLength(4);expect(rows[0].correct_answer).toBe('Mitochondrion');
      expect(rows[1].marks).toBe(paper==='breadth'?3:6);
      if(paper==='depth')expect(rows[1].correct_answer).toContain('Level 3');
    });
    it('reuses only its isolated cache and retains option-to-answer mappings',async()=>{
      const r=await practice(paper,name,'foundation',true);
      expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(0);
      const c=ocr21cSnapshot(paper);
      const key=await buildCacheKey({subject:'Biology',examBoard:'OCR',educationalLevel:'GCSE',assessmentTier:'foundation',courseId:c.course_id,
        paperId:paper,presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),topics:['B4 Using food and controlling growth'],difficulty:'mixed',questionFormat:'mixed',questionCount:2});
      expect(r.reads[0].cache_key).toBe(key);
      const rows=r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
      expect(rows[0].correct_answer).toBe('A');expect(rows[0].options[0]).toBe('Mitochondrion');expect(rows[0]).not.toHaveProperty('id');
    });
    it('rejects a context-only quiz before saving it',async()=>{
      const r=await practice(paper,name,'foundation',false,true);
      expect(r.set.extraction_status).toBe('failed');expect(r.set.extraction_error).toContain('missing_task');
      expect(r.writes.some(w=>w.table==='practice_questions'&&w.op==='insert')).toBe(false);
    });
  });
});
