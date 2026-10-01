// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {ocrAlevelFixture,ocrAlevelSnapshot,ocrLevelScheme} from './ocr-alevel-fixtures';

it.each(['full_mock','short_practice'] as const)('generates and finalises OCR %s with exact A-D choices and sections',async mode=>{
  const fixture=ocrAlevelFixture(mode),r=await extract(false,mode,'paper_1',fixture);
  expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
  expect(r.drafts.map(q=>q.question_number)).toEqual(fixture.plan.parts.map(p=>p.questionNumber));
  const mcqs=r.drafts.filter(q=>q.question_type==='mcq');expect(mcqs).toHaveLength(mode==='full_mock'?15:5);
  for(const q of mcqs){expect(q.options).toHaveLength(4);expect(q.options).toContain(q.correct_answer);}
  expect(r.repairCalls).toHaveLength(0);expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  for(const c of r.generationCalls){const prompt=c.messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('H420/01');expect(prompt).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');expect(prompt).toContain('PARTS IN THIS RESPONSE:');}
  const h=await boundaryHandler('publish-exam',r.drafts,mode,'paper_1',fixture.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(200);expect(h.writes.find(w=>w.table==='exam_questions')?.value).toHaveLength(fixture.plan.partCount);
});
it('uses the protected OCR plan instead of stale GCSE/AQA browser settings',async()=>{
  const h=await boundaryHandler('save-exam-format',[],'full_mock','paper_1',ocrAlevelSnapshot());
  expect((await h.run({draftId:'exam',format:{assessmentTier:'higher',mcq:{count:0},shortAnswer:{count:8},profileMetadata:{includeGraphs:false,includeTables:false}}})).status).toBe(200);
  const saved=h.writes.find(w=>w.table==='exam_format')!.value;
  expect(saved.mcq_count).toBe(15);expect(saved.short_answer_count+saved.long_form_count).toBe(28);
  expect(saved.profile_metadata.paperBlueprint.paperContract).toEqual(ocrAlevelSnapshot().paper_contract);
});
it('accepts common initial option/key aliases across all fifteen MCQs',async()=>{
  const r=await extract({mutate(rows){rows.filter(q=>q.question_type==='mcq').forEach((q,i)=>{const choices=q.options;q.expected_answer=String.fromCharCode(65+choices.indexOf(q.correct_answer));delete q.correct_answer;delete q.options;q[['choices','answer_options','options'][i%3]]=Object.fromEntries(choices.map((text:string,j:number)=>[String.fromCharCode(65+j),text]));});}},'full_mock','paper_1',ocrAlevelFixture());
  expect(String(r.error??'')).toBe('');expect(r.drafts.slice(0,15).every(q=>q.options?.length===4&&q.options.includes(q.correct_answer))).toBe(true);
});
it('repairs a missing MCQ task without wiping or reordering its original choices',async()=>{
  const fixture=ocrAlevelFixture();const r=await extract({mutate(rows){rows[0].question_text='A cell image measures 45 mm. The actual cell length is 30 micrometres.';},
    repair(){return {parts:[{question_number:'1',instruction:'Which magnification is correct?',expected_answer:fixture.rows[0].correct_answer}]};}},'full_mock','paper_1',fixture);
  expect(String(r.error??'')).toBe('');expect(r.repairCalls.length).toBeGreaterThan(0);expect(r.drafts[0].options).toEqual(fixture.rows[0].options);expect(r.drafts[0].correct_answer).toBe(fixture.rows[0].correct_answer);
});
it('repairs invalid choices as a complete row with a newly matching key',async()=>{
  const fixture=ocrAlevelFixture();const r=await extract({mutate(rows){rows[0].options=['one','two','three'];},repair(){const q=fixture.rows[0];return {parts:[{...q,task:q.question_text,expected_answer:q.correct_answer}]};}},'full_mock','paper_1',fixture);
  expect(String(r.error??'')).toBe('');expect(r.drafts[0].options).toEqual(fixture.rows[0].options);
});
it('completes a truncated MCQ batch without dropping or renumbering choices',async()=>{
  const r=await extract({truncateFirstBatch:true},'full_mock','paper_1',ocrAlevelFixture());
  expect(String(r.error??'')).toBe('');expect(r.drafts.slice(0,15).map(q=>q.question_number)).toEqual(Array.from({length:15},(_,i)=>String(i+1)));expect(r.aiCalls.length).toBeLessThanOrEqual(26);
});
it('blocks missing MCQs at generation and finalisation without paid unbounded retries',async()=>{
  const fixture=ocrAlevelFixture('short_practice');const r=await extract(true,'short_practice','paper_1',fixture);
  expect(r.error).toBeTruthy();expect(r.exam.extraction_status).not.toBe('completed');expect(r.aiCalls.length).toBeLessThanOrEqual(26);
  const h=await boundaryHandler('publish-exam',fixture.rows.slice(1),'short_practice','paper_1',fixture.snapshot);
  expect((await h.run({draftId:'exam'})).status).toBe(422);expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it.each([{assessment_tier:'higher'},{paper_id:'paper_2'},{component_code:'J247/03'},{specification_version:'old'}])('refuses bad OCR identity before generation: %j',async snapshotPatch=>{
  const r=await extract({snapshotPatch},'short_practice','paper_1',ocrAlevelFixture('short_practice'));expect(r.error).toBeTruthy();expect(r.aiCalls).toHaveLength(0);
});
describe.each(['generate-practice-questions','get-practice-questions'])('%s OCR quizzes',name=>{
  it.each([false,true])('retains requested count/format with isolated cache=%s',async cached=>{
    const custom={snapshot:ocrAlevelSnapshot('short_practice'),topics:['Foundations in biology'],questions:[
      {question_number:'1',question_text:'Which transport process requires ATP directly?',question_type:'mcq',marks:1,subtopic:'Foundations in biology',difficulty_level:'medium',options:['Osmosis','Active transport','Diffusion','Facilitated diffusion'],correct_answer:'Active transport'},
      {question_number:'2',question_text:'Explain how temperature affects enzyme activity.',question_type:'extended',marks:6,subtopic:'Foundations in biology',difficulty_level:'hard',correct_answer:ocrLevelScheme},
    ]};
    const r=await practice(name,cached,false,'paper_1',custom);expect(r.set.extraction_error??'').toBe('');expect(r.set.extraction_status).toBe('completed');expect(r.calls).toHaveLength(cached?0:1);
    const rows=r.writes.find(w=>w.table==='practice_questions'&&w.op==='insert').value;expect(rows).toHaveLength(2);expect(rows[0].options).toHaveLength(4);expect(rows[1].correct_answer).toContain('Level 3');
    if(!cached){const prompt=r.calls[0].messages.map((m:any)=>m.content).join('\n');expect(prompt).toContain('H420/01');expect(prompt).toContain('preserve its requested count');}
  });
});
