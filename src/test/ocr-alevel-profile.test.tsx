import {afterEach,expect,it,vi} from 'vitest';
import {createContext,useContext,cloneElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,gatewaySectionHeading,biologyResponseNotice} from '@/lib/biology-paper-display';
import {OCR_ALEVEL_BIOLOGY_ID} from '@/lib/assessment-tier';
import {PaperSectionHeading} from '@/components/exams/PaperSectionHeading';
import {ocrAlevelFixture,ocrAlevelSnapshot} from '../../supabase/tests/ocr-alevel-fixtures';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level3'}})}));
vi.mock('@/components/ui/popover',()=>{
  const Context=createContext<any>({open:false,onOpenChange:()=>{}});
  return {Popover:({open,onOpenChange,children}:any)=><Context.Provider value={{open,onOpenChange}}>{children}</Context.Provider>,
    PopoverTrigger:({children}:any)=>{const ctx=useContext(Context);return cloneElement(children,{onClick:()=>ctx.onOpenChange(!ctx.open)});},
    PopoverContent:({children}:any)=>useContext(Context).open?<div>{children}</div>:null};
});
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My OCR paper',topics:['My practical notes'],question_count:8,written_question_count:8,educational_tier:'A-Level',assessment_tier:null};
function editor(initial:any=base){const save=vi.fn(),view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="OCR" availableTopics={base.topics} onSave={save} initialData={initial}/>);return {...view,save};}
function apply(mode:'full_mock'|'short_practice'){
  fireEvent.change(screen.getByLabelText('OCR Biology course'),{target:{value:OCR_ALEVEL_BIOLOGY_ID}});
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_1'}});
  fireEvent.click(screen.getByRole('button',{name:mode==='full_mock'?/^Full mock/:/^Short practice/}));
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
}
it.each(['full_mock','short_practice'] as const)('saves and reopens untiered OCR %s with MCQs at the start',mode=>{
  const {save,unmount}=editor({...base,topics:[]}),{plan,snapshot}=ocrAlevelFixture(mode);
  expect(screen.getByLabelText('OCR Biology course')).toHaveValue('');expect(screen.getByRole('option',{name:/Advancing Biology B/})).toBeDisabled();
  expect(screen.queryByRole('button',{name:'Higher'})).toBeNull();expect(screen.queryByRole('button',{name:'Foundation'})).toBeNull();
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  apply(mode);expect(screen.getByRole('option',{name:/Paper 2.*not available/})).toBeDisabled();expect(screen.getByRole('option',{name:/Paper 3.*not available/})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));const args=save.mock.calls[0];
  expect(args[2]).toBe(plan.partCount);expect(args[4]).toBe(plan.durationMinutes);expect(args[5].assessmentTier).toBe('not_tiered');
  expect(args[5].mcqCount).toBe(mode==='full_mock'?15:5);expect(args[5].mcqPosition).toBe('start');expect(args[7].parentQuestionCount).toBe(plan.parentCount);expect(args[6]).toBe(mode==='full_mock'?28:6);
  expect(args[5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);
  unmount();const next=editor({...base,topics:args[1],question_count:args[2],written_question_count:args[6],mcq_count:args[5].mcqCount,time_limit_minutes:args[4],assessment_tier:'not_tiered',paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure});
  expect(screen.getByLabelText('Biology paper')).toHaveValue('paper_1');expect(screen.queryByText('Use these settings')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(next.save.mock.calls[0][5].mcqCount).toBe(args[5].mcqCount);
  const ctx=resolveProfileContext({subjectName:'Biology Higher',profile:{id:'p',exam_board:'OCR',educational_tier:'level3',assessment_tier:'not_tiered',paper_blueprint:args[5].paperBlueprint}});
  expect(ctx.configurationError).toBeNull();expect(ctx.componentCode).toBe('H420/01');expect(ctx.assessmentTierSupported).toBe(false);
});
it('preserves manual topics when leaving a guided OCR mode',()=>{const {save}=editor();apply('full_mock');fireEvent.click(screen.getByRole('button',{name:/^Custom/}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(save.mock.calls[0][1]).toEqual(base.topics);});
it('requires reapplying an obsolete edition',()=>{
  const c=ocrAlevelSnapshot();editor({...base,assessment_tier:'not_tiered',paper_blueprint:{paperContract:{...c.paper_contract,specificationVersion:'old'}}});
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));expect(screen.getByRole('button',{name:'Update Profile'})).not.toBeDisabled();
});
it('displays Section A once, Section B at Q16 and OCR extended-response notices',()=>{
  const c=ocrAlevelSnapshot();expect(biologyPaperDisplay(c)?.label).toContain('H420/01');expect(biologyPaperDisplay(c)?.label).not.toMatch(/Higher|Foundation/);
  expect(gatewaySectionHeading(c,'1')).toBe('Section A — Multiple choice (15 marks)');expect(gatewaySectionHeading(c,'15','14')).toBeNull();
  expect(gatewaySectionHeading(c,'16(a)','15')).toBe('Section B — Structured questions (85 marks)');
  expect(biologyResponseNotice(c,'17(d)')).toContain('line of reasoning');expect(biologyResponseNotice(c,'1')).toBeNull();
  render(<><PaperSectionHeading context={c} number="1"/><PaperSectionHeading context={c} number="16(a)" previous="15"/></>);
  expect(screen.getAllByText(/Section A/)).toHaveLength(1);expect(screen.getAllByText(/Section B/)).toHaveLength(1);
});
it('exports saved A-D choices in order without leaking the private answer',async()=>{
  const {snapshot,rows}=ocrAlevelFixture();const questions=[...rows.slice(0,3),rows.find(q=>q.question_number==='16(a)')!].map(q=>({...q,correct_answer:'PRIVATE OCR KEY'}));
  const pdf=await generateExamPDF({title:'OCR synthetic export',subject:'Biology',generation_context:snapshot,questions:questions as any},{includeWorkingSpace:false});
  const content=pdf.output();expect(content).toContain('H420/01');expect(content).not.toContain('PRIVATE OCR KEY');
  expect(content.indexOf('150 times')).toBeLessThan(content.indexOf('1500 times'));expect(content.indexOf('1500 times')).toBeLessThan(content.indexOf('15000 times'));
});
it('blocks PDF export when inline choices disagree with the saved A-D options',async()=>{
  const {snapshot,rows}=ocrAlevelFixture();const q={...rows[0],question_text:rows[0].question_text+'\nA) New one\nB) New two\nC) New three\nD) New four'};
  await expect(generateExamPDF({title:'Conflicting choices',generation_context:snapshot,questions:[q] as any})).rejects.toThrow(/choices disagree/);
});

it('keeps OCR MCQ answer boxes above the footer after a data table',async()=>{
  const {snapshot,rows}=ocrAlevelFixture();
  const pdf=await generateExamPDF({title:'OCR pagination sample',subject:'Biology',generation_context:snapshot,questions:rows.slice(0,5) as any},{includeWorkingSpace:false});
  const positions=[...pdf.output().matchAll(/(-?[\d.]+) (-?[\d.]+) Td\n\(Your answer\)/g)].map(m=>Number(m[2])*25.4/72);
  expect(positions).toHaveLength(5);expect(positions.every(fromBottom=>fromBottom>=24)).toBe(true);
});
