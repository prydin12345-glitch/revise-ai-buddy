import {afterEach,expect,it,vi} from 'vitest';
import {createContext,useContext,cloneElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,biologyResponseNotice} from '@/lib/biology-paper-display';
import {PaperSectionHeading} from '@/components/exams/PaperSectionHeading';
import {alevelFixture,alevelSnapshot} from '../../supabase/tests/aqa-alevel-fixtures';
import {alevelPaper2Fixture} from '../../supabase/tests/aqa-alevel-paper2-fixtures';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level3'}})}));
// Preserve the controlled open/close behaviour without browser-only portal and
// focus-trap interactions. Real browser keyboard/focus checks remain required.
vi.mock('@/components/ui/popover',()=>{
  const Context=createContext<any>({open:false,onOpenChange:()=>{}});
  return {
    Popover:({open,onOpenChange,children}:any)=><Context.Provider value={{open,onOpenChange}}>{children}</Context.Provider>,
    PopoverTrigger:({children}:any)=>{const ctx=useContext(Context);return cloneElement(children,{onClick:()=>ctx.onOpenChange(!ctx.open)});},
    PopoverContent:({children}:any)=>useContext(Context).open?<div>{children}</div>:null,
  };
});
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My A-level paper',topics:['My enzyme notes'],question_count:8,written_question_count:8,educational_tier:'level3',assessment_tier:null};
function editor(initial:any=base){
  const save=vi.fn(),view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="AQA" availableTopics={['My enzyme notes']} onSave={save} initialData={initial}/>);
  return {...view,save};
}
function apply(mode:'full_mock'|'short_practice',paper:'paper_1'|'paper_2'='paper_1'){
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:paper}});
  fireEvent.click(screen.getByRole('button',{name:mode==='full_mock'?/^Full mock/:/^Short practice/}));
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
}
it.each((['full_mock','short_practice'] as const).flatMap(mode=>(['paper_1','paper_2'] as const).map(paper=>({mode,paper}))))('saves and reopens $paper $mode without tier controls',({mode,paper})=>{
  const {save,unmount}=editor({...base,topics:[]}),{plan,snapshot}=(paper==='paper_2'?alevelPaper2Fixture:alevelFixture)(mode);
  expect(screen.queryByRole('button',{name:'Foundation'})).toBeNull();expect(screen.queryByRole('button',{name:'Higher'})).toBeNull();
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();expect(screen.getByLabelText('Biology paper')).toHaveValue('');
  expect(screen.getByRole('option',{name:/AQA A-level Biology Paper 2/})).not.toBeDisabled();expect(screen.getByRole('option',{name:/Paper 3 — analysis/})).toBeDisabled();
  apply(mode,paper);fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  const args=save.mock.calls[0];expect(args[1]).toHaveLength(4);expect(args[2]).toBe(plan.partCount);expect(args[4]).toBe(plan.durationMinutes);
  expect(args[5].assessmentTier).toBe('not_tiered');expect(args[5].mcqCount).toBe(0);expect(args[6]).toBe(plan.partCount);
  expect(args[5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);
  unmount();const second=editor({...base,topics:args[1],question_count:args[2],written_question_count:args[6],assessment_tier:'not_tiered',paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure});
  expect(screen.getByLabelText('Biology paper')).toHaveValue(paper);expect(screen.queryByText('Use these settings')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(second.save.mock.calls[0][6]).toBe(plan.partCount);
  const ctx=resolveProfileContext({subjectName:'Biology Higher',profile:{id:'p',exam_board:'AQA',educational_tier:'level3',assessment_tier:'not_tiered',paper_blueprint:args[5].paperBlueprint}});
  expect(ctx.configurationError).toBeNull();expect(ctx.componentCode).toBe(paper==='paper_2'?'7402/2':'7402/1');expect(ctx.assessmentTierSupported).toBe(false);
});
it('restores Custom topics and recognises a saved A-Level qualification alias',()=>{
  const {save}=editor({...base,educational_tier:'A-Level'});apply('full_mock');
  fireEvent.click(screen.getByRole('button',{name:/^Custom/}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  expect(save.mock.calls[0][1]).toEqual(base.topics);expect(save.mock.calls[0][3]).toBe('level3');
});
it('requires reapplying an old edition and clears a stale GCSE paper on level change',()=>{
  const snapshot=alevelSnapshot();const view=editor({...base,paper_blueprint:{paperContract:{...snapshot.paper_contract,specificationVersion:'old'}}});
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  expect(screen.getByRole('button',{name:'Update Profile'})).not.toBeDisabled();view.unmount();
  editor({...base,educational_tier:'level2',assessment_tier:'higher',paper_blueprint:{courseSelection:{courseId:'aqa_gcse_biology',paperId:'paper_2'}}});
  expect(screen.getByLabelText('Biology paper')).toHaveValue('paper_2');
  fireEvent.click(screen.getByRole('combobox',{name:'Educational level'}));
  fireEvent.click(screen.getByRole('button',{name:/16–18|16-18/}));
  expect(screen.getByLabelText('Biology paper')).toHaveValue('');expect(screen.queryByRole('button',{name:'Higher'})).toBeNull();
});
it('uses A-level labels and extended-response notices in screen/PDF without the private key',async()=>{
  const {snapshot,rows}=alevelFixture();expect(biologyPaperDisplay(snapshot)?.label).toBe('AQA A-level Biology Paper 1 · 7402/1');
  expect(biologyResponseNotice(snapshot,'9(a)')).toContain('Extended response');expect(biologyResponseNotice(snapshot,'1(a)')).toBeNull();
  render(<PaperSectionHeading context={snapshot} number="9(a)"/>);expect(screen.getByText(/Extended response/)).toBeInTheDocument();
  const q=rows.find(row=>row.question_number==='9(a)');q.correct_answer='PRIVATE ALEVEL KEY';
  const pdf=await generateExamPDF({title:'Synthetic A-level Paper 1',generation_context:snapshot,questions:[q]},{includeWorkingSpace:false});
  const content=pdf.output();expect(content).toContain('Extended response');expect(content).not.toContain('PRIVATE ALEVEL KEY');expect(content).not.toContain('Higher Tier');
});

it('requires applying Paper 2 after changing the paper and preserves Custom topics',()=>{
  const {save}=editor();apply('full_mock');
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_2'}});
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  expect(screen.getByRole('button',{name:'Update Profile'})).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/^Custom/}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  expect(save.mock.calls[0][1]).toEqual(base.topics);
});
