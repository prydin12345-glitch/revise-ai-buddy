import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import ExamInProgress from '@/pages/ExamInProgress';
import TakePracticeQuiz from '@/pages/TakePracticeQuiz';
import {responseFixture,responseQuestion as qid,responseParent as parent,responseUser as user} from '../../supabase/tests/response-foundation-fixtures';
const state=vi.hoisted(()=>({question:null as any,snapshot:null as any,revision:0,calls:[] as any[],failSave:false,failMark:false,grade:false,answers:[] as any[]}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{
 auth:{getUser:async()=>({data:{user:{id:'33333333-3333-4333-8333-333333333333'}}}),getSession:async()=>({data:{session:{user:{id:'33333333-3333-4333-8333-333333333333'},access_token:'synthetic'}}})},
 from(table:string){const q:any={};for(const k of ['select','eq','ilike','single','maybeSingle','order','in','update','upsert','insert','delete','limit'])q[k]=()=>q;
 q.then=(resolve:any)=>Promise.resolve({data:table==='exams'?{title:'Response exam',subject_id:'Biology'}:table==='practice_question_sets'?{set_name:'Response quiz',subject_id:'Biology',question_count:1}:table==='practice_question_answers'?state.answers:null,error:null}).then(resolve);return q;},
 functions:{invoke:async(name:string,{body}:any={})=>{
  state.calls.push({name,body});const question=()=>({...state.question,response_snapshot:{response:state.snapshot,revision:state.revision},...(state.grade?{response_key:state.question.testKey}:{})});
  if(name==='get-exam-questions')return{data:{questions:[question()],existingAnswers:[],submission:{status:'in_progress'},isTeacher:false,timer:null},error:null};
  if(name==='question-response'){
   if(body.action==='questions')return{data:{questions:[question()]},error:null};
   if(body.action==='save'){
    if(state.failSave)return{data:null,error:new Error('network unavailable')};
    state.snapshot=body.response;state.revision++;return{data:{response:state.snapshot,revision:state.revision},error:null};
   }
  }
  if(name==='grade-practice-question'){
   if(state.failMark)return{data:null,error:new Error('marking unavailable')};
   state.grade=true;state.answers=[{question_id:state.question.id,answer_text:JSON.stringify(state.snapshot),score:2,submitted_at:'2026-10-01',is_correct:true}];return{data:{score:2,isCorrect:true,feedback:'2/2 marks.'},error:null};
  }
  return{data:{success:true},error:null};
 }}
}}));
vi.mock('@/hooks/use-toast',()=>({toast:vi.fn()}));
vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
const open=(practice=false)=>render(<MemoryRouter initialEntries={[`/test/${parent}`]}><Routes><Route path={practice?'/test/:setId':'/test/:examId'} element={practice?<TakePracticeQuiz/>:<ExamInProgress/>}/><Route path="/exam/:examId/review" element={<p>Review arrived</p>}/></Routes></MemoryRouter>);
function setup(kind:Parameters<typeof responseFixture>[0]='choice'){
 const f=responseFixture(kind);f.definition.resourceIds=[];state.question={id:qid,question_number:'1',question_number_int:1,question_type:'written',question_text:'Complete the response.',marks:2,response_definition:f.definition,testKey:f.key};return f;
}
afterEach(()=>{cleanup();Object.assign(state,{question:null,snapshot:null,revision:0,calls:[],failSave:false,failMark:false,grade:false,answers:[]});sessionStorage.clear();vi.clearAllMocks();});
it('the real exam page saves a multi-tick envelope before submitting, with no legacy write',async()=>{
 setup();open();fireEvent.click(await screen.findByLabelText('Glucose'));fireEvent.click(screen.getByLabelText('Starch'));
 fireEvent.click(screen.getAllByRole('button',{name:/Submit exam/i})[0]);fireEvent.click(await screen.findByRole('button',{name:/Yes, submit|Submit now|Submit exam/i}));
 await waitFor(()=>expect(state.calls.some(c=>c.name==='submit-exam')).toBe(true));
 expect(state.snapshot.value.selectedIds).toEqual(['a','b']);expect(state.calls.some(c=>c.name==='submit-student-answer')).toBe(false);
});
it('the real exam page blocks marking on failed grid save and restores its cells after remount',async()=>{
 setup('grid');state.failSave=true;const view=open();fireEvent.click(await screen.findByRole('checkbox',{name:'Is a polymer — DNA'}));
 await screen.findByRole('button',{name:'Retry saving'});
 fireEvent.click(screen.getAllByRole('button',{name:/Submit exam/i})[0]);fireEvent.click(await screen.findByRole('button',{name:/Yes, submit|Submit now|Submit exam/i}));
 await waitFor(()=>expect(state.calls.filter(c=>c.name==='question-response').length).toBeGreaterThan(0));expect(state.calls.some(c=>c.name==='submit-exam')).toBe(false);
 view.unmount();state.failSave=false;open();expect(await screen.findByRole('checkbox',{name:'Is a polymer — DNA'})).toBeChecked();
});
it('the real practice page reads saved questions and marks the saved revision, never client answer text',async()=>{
 setup('cloze');open(true);fireEvent.change(await screen.findByLabelText('Tube X'),{target:{value:'glucose'}});
 fireEvent.click(screen.getByRole('button',{name:/Submit answer/i}));
 await waitFor(()=>expect(state.calls.some(c=>c.name==='grade-practice-question')).toBe(true));
 const request=state.calls.find(c=>c.name==='grade-practice-question');expect(request.body).toEqual({setId:parent,questionId:qid,responseRevision:1});
 expect(state.calls.some(c=>['generate-practice-questions','get-practice-questions'].includes(c.name))).toBe(false);
 await waitFor(()=>expect(screen.getByLabelText('Tube X')).toBeDisabled());expect(screen.getByText('Mark scheme')).toBeVisible();
});
it('practice failure retains the entered zero and never presents a fabricated grade',async()=>{
 setup('fields');state.failMark=true;open(true);fireEvent.change(await screen.findByLabelText('Tube X'),{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:/Submit answer/i}));
 await waitFor(()=>expect(state.calls.some(c=>c.name==='grade-practice-question')).toBe(true));
 expect(screen.getByLabelText('Tube X')).toHaveValue('0');expect(screen.queryByText('Mark scheme')).toBeNull();expect(state.answers).toHaveLength(0);
});
it('practice does not attempt marking until an edited response has saved',async()=>{
 setup('cloze');state.failSave=true;open(true);fireEvent.change(await screen.findByLabelText('Tube X'),{target:{value:'glucose'}});await screen.findByRole('button',{name:'Retry saving'});
 fireEvent.click(screen.getByRole('button',{name:/Submit answer/i}));
 await waitFor(()=>expect(state.calls.some(c=>c.name==='question-response'&&c.body.action==='save')).toBe(true));expect(state.calls.some(c=>c.name==='grade-practice-question')).toBe(false);
 expect(sessionStorage.getItem(`response:v1:practice:${parent}:user:${user}:${qid}`)).toContain('glucose');
});
