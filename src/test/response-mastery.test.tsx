import {it,expect,vi} from 'vitest';
import {renderHook,waitFor,cleanup} from '@testing-library/react';
import {useUnifiedTopicPerformance} from '@/hooks/useUnifiedTopicPerformance';
import {markResponse} from '../../supabase/functions/_shared/response-marking';
import {responseFixture,responseQuestion as questionId} from '../../supabase/tests/response-foundation-fixtures';
const state=vi.hoisted(()=>({tables:{} as Record<string,any[]>}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from(table:string){const q:any={};for(const k of ['select','eq','in'])q[k]=()=>q;q.then=(resolve:any)=>Promise.resolve({data:state.tables[table]??[],error:null}).then(resolve);return q;}}}));
vi.mock('@/lib/normalise-topic',()=>({normaliseTopicTags:async(tags:string[])=>Object.fromEntries(tags.map(t=>[t,t]))}));
it('routes four format totals into existing topic accuracy once per question, excluding failed/pending work',async()=>{
 const rows=[];
 for(const kind of ['choice','grid','cloze','fields'] as const){const f=responseFixture(kind);const result=await markResponse({questionId,marks:2,definition:f.definition,key:f.key,response:f.envelope},vi.fn());rows.push({question_id:kind,score:result.score,is_correct:result.isCorrect,submitted_at:'2026-10-01T12:00:00Z'});}
 state.tables={
  exam_submissions:[{exam_id:'graded'}],student_answers:[{...rows[1],exam_id:'graded'},{question_id:'failed',exam_id:'failed',score:null}],
  exam_questions:[{id:'grid',topic_tag:'Biomolecules',marks:2,exam_id:'graded'},{id:'failed',topic_tag:'Biomolecules',marks:6,exam_id:'failed'}],exams:[{id:'graded',subject_id:'Biology'}],
  practice_question_answers:[...rows,{question_id:'pending',score:null,submitted_at:null}],
  practice_questions:[...rows.map(r=>({id:r.question_id,subtopic:'Biomolecules',marks:2,set_id:'p'})),{id:'pending',subtopic:'Biomolecules',marks:2,set_id:'p'}],
  practice_question_sets:[{id:'p',subject_id:'Biology'}],
 };
 const {result}=renderHook(()=>useUnifiedTopicPerformance('student'));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.topics).toEqual([expect.objectContaining({topic:'Biomolecules',unifiedScore:100,examScore:100,practiceScore:100,examQuestionCount:1,practiceQuestionCount:4,pendingQuestionCount:2,mastery:'strong'})]);cleanup();
});
