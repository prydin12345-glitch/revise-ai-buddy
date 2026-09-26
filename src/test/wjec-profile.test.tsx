import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,biologyResponseNotice,gatewaySectionHeading} from '@/lib/biology-paper-display';
import {PaperSectionHeading} from '@/components/exams/PaperSectionHeading';
import {WJEC_BIOLOGY_ID as COURSE} from '@/lib/assessment-tier';
import {wjecSnapshot,wjecFixture} from '../../supabase/tests/wjec-fixtures';
import {WJEC_BIOLOGY_SPECIFICATION} from '../../supabase/functions/_shared/wjec-biology-specification';
import {generateExamPDF} from '@/lib/exam-pdf-generator';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level2'}})}));
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My WJEC Biology paper',topics:['My cell notes'],question_count:8,written_question_count:8,educational_tier:'level2',assessment_tier:null};
function editor(initial:any=base) {
  const save=vi.fn();const view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="WJEC"
    availableTopics={['My cell notes']} onSave={save} initialData={initial}/>);
  return {save,...view};
}
function choose(paper:string,tier:string) {
  fireEvent.change(screen.getByLabelText('Biology unit'),{target:{value:paper}});
  fireEvent.click(screen.getByRole('button',{name:tier==='foundation'?'Foundation':'Higher'}));
}
describe.each(['unit_1','unit_2'] as const)('WJEC %s editor',paper=>{
  it.each(['foundation','higher'] as const)('saves and reopens a %s full mock with exact counts and labels',tier=>{
    const {save,unmount}=editor({...base,topics:[]});
    expect(screen.getByRole('option',{name:/Unit 3/})).toBeDisabled();
    expect(screen.getByLabelText('Biology unit')).toHaveValue('');
    choose(paper,tier);
    fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    const args=save.mock.calls[0],{plan,snapshot}=wjecFixture(paper,tier);
    expect(args[1]).toHaveLength(paper==='unit_1'?6:8);expect(args[2]).toBe(plan.partCount);expect(args[4]).toBe(105);
    expect(args[5].mcqCount).toBe(4);expect(args[5].mcqPosition).toBe('mixed');
    expect(args[5].assessmentTier).toBe(tier);expect(args[5].paperBlueprint.paperContract).toEqual(snapshot.paper_contract);
    expect(args[6]).toBe(plan.partCount-args[5].mcqCount);expect(args[7].includeGraphs).toBe(true);expect(args[7].includeTables).toBe(true);
    unmount();
    const opened=editor({...base,assessment_tier:tier,topics:args[1],question_count:args[2],written_question_count:args[6],mcq_count:args[5].mcqCount,
      paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure,parent_question_count:plan.parentCount,max_parts_per_question:4});
    expect(screen.getByLabelText('Biology unit')).toHaveValue(paper);
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(opened.save.mock.calls[0][6]).toBe(args[6]);
    const ctx=resolveProfileContext({subjectName:'Biology Higher',profile:{id:'p',exam_board:'WJEC',educational_tier:'level2',assessment_tier:tier,paper_blueprint:args[5].paperBlueprint}});
    expect(ctx.configurationError).toBeNull();expect(ctx.componentCode).toBe(snapshot.component_code);
    expect(biologyPaperDisplay(snapshot)?.label).toContain(snapshot.component_code);expect(gatewaySectionHeading(snapshot,'1(a)')).toBeNull();
  });
  it('saves a short practice with its actual timing and count',()=>{
    const {save}=editor();choose(paper,'foundation');
    fireEvent.click(screen.getByRole('button',{name:/^Short practice/}));
    expect(screen.getByText(/27 marks, 35 minutes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][2]).toBe(12);expect(save.mock.calls[0][5].mcqCount).toBe(2);expect(save.mock.calls[0][6]).toBe(10);
  });
});

it('requires explicit paper and tier choices, invalidates changed plans and preserves Custom topics',()=>{
  const {save}=editor();
  expect(screen.getByLabelText('Biology unit')).toHaveValue('');expect(screen.getByRole('button',{name:'Higher'})).toHaveAttribute('aria-pressed','false');
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Foundation'}));expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Biology unit'),{target:{value:'unit_1'}});
  fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  fireEvent.change(screen.getByLabelText('Biology unit'),{target:{value:'unit_2'}});expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));fireEvent.click(screen.getByRole('button',{name:'Higher'}));
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/^Custom/}));fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  expect(save.mock.calls[0][1]).toEqual(base.topics);expect(save.mock.calls[0][5].paperBlueprint.courseSelection).toEqual({courseId:COURSE,paperId:'unit_2',specificationVersion:WJEC_BIOLOGY_SPECIFICATION});

});

it('marks only planned six-mark QER responses in the screen and PDF question booklet',async()=>{
  const {snapshot,rows}=wjecFixture('unit_2');
  expect(biologyResponseNotice(snapshot,'3(d)')).toContain('QER');
  expect(biologyResponseNotice(snapshot,'3(c)')).toBeNull();expect(biologyResponseNotice({...snapshot,specification_version:null},'3(d)')).toBeNull();
  render(<PaperSectionHeading context={snapshot} number="3(d)"/>);
  expect(screen.getByText(/QER/)).toBeInTheDocument();expect(screen.queryByText(/Level 3/)).toBeNull();
  const q=rows.find(row=>row.question_number==='3(d)');
  const pdf=await generateExamPDF({title:'Synthetic WJEC Unit 2',generation_context:snapshot,questions:[q]}, {includeWorkingSpace:false});
  const content=pdf.output();
  expect(content).toContain('QER: use clear reasoning, scientific terms and accurate writing.');
  expect(content).not.toContain('Level 3');
});

it('shows both cohort editions and requires reapplying an unsupported saved edition',()=>{
  const snapshot=wjecSnapshot('unit_1');editor({...base,assessment_tier:'foundation',paper_blueprint:{paperContract:{...snapshot.paper_contract,specificationVersion:'old-edition'}}});
  expect(screen.getByText(/Before September 2026 entry: Practical Assessment, 30 marks/)).toBeInTheDocument();
  expect(screen.getByText(/From September 2026 entry: Scientific Enquiry, 28 marks, first award 2028/)).toBeInTheDocument();
  expect(screen.getByText(/Foundation grades C–G/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  expect(screen.getByRole('button',{name:'Update Profile'})).not.toBeDisabled();
});
