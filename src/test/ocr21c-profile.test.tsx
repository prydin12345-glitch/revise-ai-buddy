import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,biologyResponseNotice,gatewaySectionHeading} from '@/lib/biology-paper-display';
import {PaperSectionHeading} from '@/components/exams/PaperSectionHeading';
import {OCR_21C_BIOLOGY_ID as COURSE,OCR_GATEWAY_BIOLOGY_ID} from '@/lib/assessment-tier';
import {ocr21cSnapshot,ocr21cFixture} from '../../supabase/tests/ocr21c-fixtures';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level2'}})}));
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My OCR Biology paper',topics:['My cell notes'],question_count:8,written_question_count:8,educational_tier:'level2',assessment_tier:null};
function editor(initial:any=base) {
  const save=vi.fn();const view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="OCR"
    availableTopics={['My cell notes']} onSave={save} initialData={initial}/>);
  return {save,...view};
}
function choose(paper:string,tier:string) {
  fireEvent.change(screen.getByLabelText('OCR Biology course'),{target:{value:COURSE}});
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:paper}});
  fireEvent.click(screen.getByRole('button',{name:tier==='foundation'?'Foundation':'Higher'}));
}
describe.each(['breadth','depth'] as const)('J257 %s editor',paper=>{
  it.each(['foundation','higher'] as const)('saves and reopens a %s full mock with exact counts and labels',tier=>{
    const {save,unmount}=editor({...base,topics:[]});
    expect(screen.getByRole('option',{name:'Twenty First Century Biology B'})).not.toBeDisabled();
    expect(screen.queryByLabelText('Biology paper')).toBeNull();
    choose(paper,tier);
    fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    const args=save.mock.calls[0],{plan,snapshot}=ocr21cFixture(paper,tier);
    expect(args[1]).toHaveLength(6);expect(args[2]).toBe(plan.partCount);expect(args[4]).toBe(105);
    expect(args[5].mcqCount).toBe(paper==='breadth'?6:3);expect(args[5].mcqPosition).toBe('mixed');
    expect(args[5].assessmentTier).toBe(tier);expect(args[5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);
    expect(args[6]).toBe(plan.partCount-args[5].mcqCount);expect(args[7].includeGraphs).toBe(true);expect(args[7].includeTables).toBe(true);
    unmount();
    const opened=editor({...base,assessment_tier:tier,topics:args[1],question_count:args[2],written_question_count:args[6],mcq_count:args[5].mcqCount,
      paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure,parent_question_count:plan.parentCount,max_parts_per_question:paper==='breadth'?3:4});
    expect(screen.getByLabelText('OCR Biology course')).toHaveValue(COURSE);expect(screen.getByLabelText('Biology paper')).toHaveValue(paper);
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(opened.save.mock.calls[0][6]).toBe(args[6]);
    const ctx=resolveProfileContext({subjectName:'Biology Higher',profile:{id:'p',exam_board:'OCR',educational_tier:'level2',assessment_tier:tier,paper_blueprint:args[5].paperBlueprint}});
    expect(ctx.configurationError).toBeNull();expect(ctx.componentCode).toBe(snapshot.component_code);
    expect(biologyPaperDisplay(snapshot)?.label).toContain(snapshot.component_code);expect(gatewaySectionHeading(snapshot,'1(a)')).toBeNull();
  });
  it('saves a short practice with its actual timing and count',()=>{
    const {save}=editor();choose(paper,'foundation');
    fireEvent.click(screen.getByRole('button',{name:/^Short practice/}));
    expect(screen.getByText(paper==='breadth'?/24 marks, 28 minutes/:/30 marks, 35 minutes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][2]).toBe(12);expect(save.mock.calls[0][5].mcqCount).toBe(2);expect(save.mock.calls[0][6]).toBe(10);
  });
});

it('requires explicit paper and tier choices, invalidates changed plans and preserves Custom topics',()=>{
  const {save}=editor();
  fireEvent.change(screen.getByLabelText('OCR Biology course'),{target:{value:COURSE}});
  expect(screen.getByLabelText('Biology paper')).toHaveValue('');expect(screen.getByRole('button',{name:'Higher'})).toHaveAttribute('aria-pressed','false');
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Foundation'}));expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'breadth'}});
  fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'depth'}});expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));fireEvent.click(screen.getByRole('button',{name:'Higher'}));
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/^Custom/}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  expect(save.mock.calls[0][1]).toEqual(base.topics);expect(save.mock.calls[0][5].paperBlueprint.courseSelection).toEqual({courseId:COURSE,paperId:'depth'});
  fireEvent.change(screen.getByLabelText('OCR Biology course'),{target:{value:OCR_GATEWAY_BIOLOGY_ID}});
  expect(screen.queryByLabelText('Biology paper')).toBeNull();expect(screen.getByText(/The second paper is coming later/)).toBeInTheDocument();
});

it('marks only planned Depth six-mark responses in the screen and PDF question booklet',async()=>{
  const {snapshot,rows}=ocr21cFixture('depth');
  expect(biologyResponseNotice(snapshot,'2(d)')).toContain('Extended response');
  expect(biologyResponseNotice(snapshot,'2(c)')).toBeNull();expect(biologyResponseNotice(ocr21cSnapshot('breadth'),'2(d)')).toBeNull();
  render(<PaperSectionHeading context={snapshot} number="2(d)"/>);
  expect(screen.getByText(/Extended response/)).toBeInTheDocument();expect(screen.queryByText(/Level 3/)).toBeNull();
  const q=rows.find(row=>row.question_number==='2(d)');
  const pdf=await generateExamPDF({title:'Synthetic J257 Depth',generation_context:snapshot,questions:[q]}, {includeWorkingSpace:false});
  const content=pdf.output();
  expect(content).toContain('Extended response: show a clear, logical line of reasoning.');
  expect(content).not.toContain('Level 3');
});
