// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './edexcel-pipeline-runtime';
import {edexcelFixture,edexcelSnapshot} from './edexcel-biology-fixtures';
import {fixtureScheme} from './aqa-paper2-fixtures';
import {biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {buildCacheKey} from '../functions/_shared/cache-utils';

describe.each(['paper_1','paper_2'] as const)('real Edexcel %s extraction',paper=>{
  describe.each(['foundation','higher'] as const)('%s',tier=>{
    it.each(['short_practice','full_mock'] as const)('generates, saves and finalises %s without changing the plan',async mode=>{
      const {plan}=edexcelFixture(paper,tier,mode);
      const result=await extract(paper,tier,false,mode);
      expect(String(result.error??'')).toBe('');expect(result.exam.extraction_status).toBe('completed');
      expect(result.drafts).toHaveLength(plan.partCount);
      expect(result.drafts.reduce((n,q)=>n+q.marks,0)).toBe(plan.totalMarks);
      expect(result.drafts.map(q=>q.question_number)).toEqual(plan.parts.map(p=>p.questionNumber));
      expect(result.drafts.filter(q=>q.question_type==='mcq')).toHaveLength(mode==='full_mock'?8:5);
      expect(result.drafts.filter(q=>q.marks===6).every(q=>q.correct_answer.includes('Level 3'))).toBe(true);
      expect(result.repairCalls).toHaveLength(0);
      expect(result.generationCalls).toHaveLength(mode==='full_mock'?5:1);
      for(const call of result.generationCalls) {
        const prompt=call.messages.map((m:any)=>m.content).join('\n');
        expect(prompt).toContain(plan.componentCode);
        expect(prompt).not.toContain('AQA GCSE Biology Paper 1');
        expect(prompt).toContain('BIOLOGY ASSESSMENT RESOURCES');
        const numbers=/PARTS IN THIS RESPONSE: (.+)/.exec(prompt)?.[1].split(', ') ?? plan.parts.map(p=>p.questionNumber);
        expect(numbers.length).toBeLessThanOrEqual(10);
        for(const number of numbers) {
          const parent=number.split('(')[0];
          const siblings=plan.parts.filter(p=>p.questionNumber.split('(')[0]===parent).map(p=>p.questionNumber);
          expect(siblings.every(n=>numbers.includes(n))).toBe(true);
        }
      }
      const boundary=await boundaryHandler(paper,'publish-exam',result.drafts,tier,mode);
      const response=await boundary.run({draftId:'exam'});
      expect(response.status).toBe(200);
      expect(boundary.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(plan.partCount);
    });
    it('uses the saved paper/tier despite conflicting browser format fields',async()=>{
      const h=await boundaryHandler(paper,'save-exam-format',[],tier);
      const response=await h.run({draftId:'exam',format:{mcq:{count:0},shortAnswer:{count:8},assessmentTier:tier==='foundation'?'higher':'foundation',
        profileMetadata:{paperBlueprint:{paperContract:{courseId:'aqa_gcse_biology_8461',paperId:'paper_1'}},includeGraphs:false,includeTables:false}}});
      expect(response.status).toBe(200);
      const saved=h.writes.find(w=>w.table==='exam_format')?.value;
      expect(saved.mcq_count).toBe(8);expect(saved.short_answer_count+saved.long_form_count).toBe(32);
      expect(saved.profile_metadata.paperBlueprint.paperContract).toEqual(edexcelSnapshot(paper,tier).paper_contract);
      expect(saved.profile_metadata.assessmentTier).toBe(tier);expect(saved.include_tables).toBe(true);expect(saved.include_graphs).toBe(true);
    });
  });
  it('repairs tasks and three-level schemes without wiping MCQs or sibling data',async()=>{
    const result=await extract(paper,'foundation',{
      mutate(questions){questions[0].question_text='A student made measurements.';questions.find(q=>q.question_number==='4(d)').correct_answer='Only an answer.';},
      repair(request){
        const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({question_number:row.question_number,context:'',instruction:row.question_number==='1(a)'?'Which method improves the sample?':row.question_text,
          expected_answer:row.correct_answer,...(row.question_number==='4(d)'?{mark_scheme:fixtureScheme}:{}),diagram_config:row.diagram_config}))};
      },
    });
    expect(String(result.error??'')).toBe('');expect(result.exam.extraction_status).toBe('completed');
    expect(result.repairCalls).toHaveLength(2);expect(result.drafts[0].options).toHaveLength(4);
    expect(result.drafts.find(q=>q.question_number==='4(d)').correct_answer).toContain('Level 3');
    expect(result.drafts.find(q=>q.question_number==='1(c)').diagram_config.rows).toEqual([[1,2],[2,4],[3,6]]);
  });
  it('recovers a truncated batch and completes only missing parts within the existing budget',async()=>{
    const result=await extract(paper,'higher',{truncateFirstBatch:true});
    expect(String(result.error??'')).toBe('');expect(result.exam.extraction_status).toBe('completed');
    expect(new Set(result.drafts.map(q=>q.question_number)).size).toBe(40);
    expect(result.aiCalls.length).toBeLessThanOrEqual(26);
    expect(result.generationCalls.some(call=>call.messages.some((m:any)=>m.content.includes('ALREADY WRITTEN in this paper')))).toBe(true);
  });
  it('repairs Higher-only content from a Foundation key, without relaxing the level gate',async()=>{
    const result=await extract(paper,'foundation',{
      mutate(q){q.find(row=>row.question_number==='2(d)').correct_answer=paper==='paper_1'?'Protein production requires mRNA transcription.':'ADH controls water reabsorption.';},
      repair(request){
        const group=JSON.parse(request.messages[0].content.split('Current group: ')[1].split('\nReturn JSON')[0]);
        return {parts:group.map((row:any)=>({...row,task:row.question_text,correct_answer:row.question_number==='2(d)'?'Repeats reduce the influence of random error.':row.correct_answer}))};
      },
    });
    expect(String(result.error??'')).toBe('');expect(result.repairCalls).toHaveLength(1);
    expect(result.drafts.find(q=>q.question_number==='2(d)').correct_answer).not.toMatch(/mRNA|ADH/);
  });
  it('blocks missing parts at extraction and again at finalisation',async()=>{
    const result=await extract(paper,'foundation',true,'short_practice');
    expect(String(result.error)).toContain('Planned Q1(a) is missing');
    expect(result.exam.extraction_status).not.toBe('completed');expect(result.aiCalls.length).toBeLessThanOrEqual(26);
    const h=await boundaryHandler(paper,'publish-exam',edexcelFixture(paper).rows.slice(1));
    expect((await h.run({draftId:'exam'})).status).toBe(422);
    expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
  });
});

describe.each(['generate-practice-questions','get-practice-questions'])('%s Edexcel quiz pipeline',name=>{
  describe.each(['paper_1','paper_2'] as const)('%s',paper=>{
    it.each(['foundation','higher'] as const)('generates a %s quiz with retained choices and private level descriptors',async tier=>{
      const result=await practice(paper,name,tier);
      expect(result.set.extraction_error??'').toBe('');expect(result.set.extraction_status).toBe('completed');
      expect(result.calls).toHaveLength(1);
      const prompt=result.calls[0].messages.map((m:any)=>m.content).join('\n');
      expect(prompt).toContain(edexcelSnapshot(paper,tier).component_code);
      expect(prompt).toContain('retain the requested count');
      const rows=result.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
      expect(rows).toHaveLength(2);expect(rows[0].options).toHaveLength(4);expect(rows[0].correct_answer).toBe('Mitochondrion');
      expect(rows[1].correct_answer).toContain('Level 3');
    });
    it('uses the isolated cache without shuffling options or making a model call',async()=>{
      const result=await practice(paper,name,'foundation',true);
      expect(result.set.extraction_status).toBe('completed');expect(result.calls).toHaveLength(0);
      const context=edexcelSnapshot(paper);
      const key=await buildCacheKey({subject:'Biology',examBoard:'Edexcel',educationalLevel:'GCSE',assessmentTier:'foundation',courseId:context.course_id,
        paperId:paper,presetVersion:1,resourceVersion:biologyPracticeCacheVersion(context),topics:['Key concepts in biology'],difficulty:'mixed',questionFormat:'mixed',questionCount:2});
      expect(result.reads[0].cache_key).toBe(key);
      const rows=result.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;
      expect(rows[0].correct_answer).toBe('A');expect(rows[0].options[0]).toBe('Mitochondrion');expect(rows[0]).not.toHaveProperty('id');
    });
    it('stops an incomplete quiz before saving any question',async()=>{
      const result=await practice(paper,name,'foundation',false,true);
      expect(result.set.extraction_status).toBe('failed');expect(result.set.extraction_error).toContain('missing_task');
      expect(result.writes.some(w=>w.table==='practice_questions'&&w.op==='insert')).toBe(false);
    });
  });
});
