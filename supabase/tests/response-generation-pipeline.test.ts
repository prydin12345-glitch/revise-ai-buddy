// @vitest-environment node
import {it,expect} from 'vitest';
import {extract,boundaryHandler,practice} from './aqa-alevel-runtime';
import {ocrAlevelFixture} from './ocr-alevel-fixtures';
import {generatedResponse,legacyResponseCandidate,hydrateGeneratedRows} from '../functions/_shared/response-generation';
import {responseFixture} from './response-foundation-fixtures';

it('runs the real OCR generator then atomically publishes the same fifteen MCQs and complete plan with private keys',async()=>{
 const fixture=ocrAlevelFixture('full_mock');fixture.snapshot={...fixture.snapshot,profile_id:'profile',response_formats:'interactive_v1'};
 const r=await extract(false,'full_mock','paper_1',fixture);expect(String(r.error??'')).toBe('');expect(r.exam.extraction_status).toBe('completed');
 const hydrated=hydrateGeneratedRows(r.drafts,r.responseDrafts,fixture.snapshot);
 expect(r.drafts.some(q=>q.correct_answer.includes('examly_response_v1'))).toBe(false);
 const choices=hydrated.filter(q=>q.question_type==='mcq');expect(choices).toHaveLength(15);const expectedStructured=fixture.plan.parts.filter(p=>p.responseType==='mcq_single'&&p.resource!=='graph').length;
 expect(choices.filter(q=>generatedResponse(q)?.definition.kind==='choice')).toHaveLength(expectedStructured);
 for(const q of choices.filter(q=>!generatedResponse(q)))expect(q.diagram_config.type).toBe('line_chart');
 expect(r.drafts.map(legacyResponseCandidate).reduce((s,q)=>s+q.marks,0)).toBe(fixture.plan.totalMarks);
 expect(r.aiCalls.length).toBeLessThanOrEqual(26);
 const h=await boundaryHandler('publish-exam',r.drafts,'full_mock','paper_1',fixture.snapshot,r.responseDrafts);const response=await h.run({draftId:'exam'});expect(response.status).toBe(200);
 const payload=h.writes.find(w=>w.table==='commit_generated_responses')!.value;
 expect(payload.p_rows).toHaveLength(fixture.plan.partCount);expect(payload.p_rows.filter((r:any)=>r.response)).toHaveLength(expectedStructured);
 for(const entry of payload.p_rows.filter((r:any)=>r.response)){expect(entry.question.correct_answer).toBeNull();expect(entry.question.options).toBeNull();expect(entry.response.key.units[0].rule.kind).toBe('exact_set');expect(entry.sourceDraft.correct_answer).not.toContain('examly_response_v1');}
 expect(h.writes.some(w=>w.table==='exam_questions')).toBe(false);
});
it('a zero-row response draft write prevents an exam being reported ready',async()=>{
 const fixture=ocrAlevelFixture('short_practice');fixture.snapshot={...fixture.snapshot,profile_id:'profile',response_formats:'interactive_v1'};
 const r=await extract({rejectResponseSave:true},'short_practice','paper_1',fixture);expect(String(r.error)).toContain('could not be saved');expect(r.exam.extraction_status).not.toBe('completed');
});
it.each(['generate-practice-questions','get-practice-questions'])('%s bypasses the legacy cache and atomically binds generated grid/choice inputs',async name=>{
 const fixture=ocrAlevelFixture('short_practice'),p=responseFixture('grid');p.definition.resourceIds=[];
 const custom={snapshot:{...fixture.snapshot,response_formats:'interactive_v1'},topics:['Foundations in biology'],responseProposal:{definition:p.definition,key:p.key},questions:[
  {question_number:'1',question_text:'Which molecule is a polymer?',question_type:'mcq',marks:1,subtopic:'Foundations in biology',difficulty_level:'easy',options:['Glucose','Glycogen','Sucrose','Ribose'],correct_answer:'Glycogen'},
  {question_number:'2',question_text:'State which of glycogen, sucrose and DNA are polymers.',question_type:'short_answer',marks:2,subtopic:'Foundations in biology',difficulty_level:'easy',correct_answer:'Glycogen and DNA.'},
 ]};
 const r=await practice(name,true,false,'paper_1',custom);expect(r.errors).toEqual([]);expect(r.set.extraction_status).toBe('completed');expect(r.reads).toEqual([]);expect(r.calls).toHaveLength(2);
 const commit=r.writes.find(w=>w.table==='commit_generated_responses')!.value;expect(commit.p_rows.map((r:any)=>r.response.definition.kind)).toEqual(['choice','grid']);
 expect(r.writes.some(w=>w.table==='question_generation_cache')).toBe(false);expect(r.writes.some(w=>w.table==='practice_questions')).toBe(false);
 const failed=await practice(name,false,false,'paper_1',{...custom,rejectCommit:true});expect(failed.set.extraction_status).toBe('failed');expect(failed.set.extraction_error).toContain('transaction refused');
});
