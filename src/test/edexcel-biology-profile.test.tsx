import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay,gatewaySectionHeading} from '@/lib/biology-paper-display';
import {EDEXCEL_BIOLOGY_ID} from '@/lib/assessment-tier';
import {edexcelSnapshot} from '../../supabase/tests/edexcel-biology-fixtures';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level2'}})}));
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My Edexcel paper',topics:['My microscopy notes'],question_count:8,written_question_count:8,educational_tier:'level2',assessment_tier:null};
function editor(initial:any=base) {
  const save=vi.fn();
  const view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="Edexcel"
    availableTopics={['My microscopy notes']} onSave={save} initialData={initial}/>);
  return {save,...view};
}

describe.each(['paper_1','paper_2'] as const)('Edexcel %s profile',paper=>{
  it.each(['foundation','higher'] as const)('saves and reopens %s with the exact full-paper selection',tier=>{
    const {save,unmount}=editor({...base,topics:[]});
    expect(screen.getByLabelText('Biology paper')).toHaveValue('');
    expect(screen.getByRole('button',{name:'Higher'})).toHaveAttribute('aria-pressed','false');
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:paper}});
    fireEvent.click(screen.getByRole('button',{name:tier==='foundation'?'Foundation':'Higher'}));
    fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    const args=save.mock.calls[0];
    expect(args[1]).toHaveLength(5);expect(args[1]).toContain('Key concepts in biology');
    expect(args[2]).toBe(40);expect(args[4]).toBe(105);expect(args[6]).toBe(32);
    expect(args[5].mcqCount).toBe(8);expect(args[5].mcqPosition).toBe('mixed');
    expect(args[5].assessmentTier).toBe(tier);
    expect(args[5].paperBlueprint.paperContract).toEqual({courseId:EDEXCEL_BIOLOGY_ID,paperId:paper,mode:'full_mock',contractVersion:1});
    expect(args[7].includeGraphs).toBe(true);expect(args[7].includeTables).toBe(true);
    unmount();
    const reopened=editor({...base,assessment_tier:tier,topics:args[1],question_count:40,written_question_count:32,mcq_count:8,mcq_position:'mixed',
      paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure,parent_question_count:10,max_parts_per_question:4});
    expect(screen.getByLabelText('Biology paper')).toHaveValue(paper);
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(reopened.save.mock.calls[0][6]).toBe(32);
    const ctx=resolveProfileContext({subjectName:'Biology Higher',profile:{id:'p',exam_board:'Edexcel',educational_tier:'level2',assessment_tier:tier,paper_blueprint:args[5].paperBlueprint}});
    expect(ctx.configurationError).toBeNull();expect(ctx.componentCode).toBe(edexcelSnapshot(paper,tier).component_code);
    const display=biologyPaperDisplay(edexcelSnapshot(paper,tier));
    expect(display?.label).toContain(ctx.componentCode);expect(display?.label).toContain('Pearson Edexcel');
    expect(gatewaySectionHeading(edexcelSnapshot(paper,tier),'1(a)')).toBeNull();
  });
  it('saves short practice with its real ten-part, 25-mark plan',()=>{
    const {save}=editor({...base,assessment_tier:'foundation'});
    fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:paper}});
    fireEvent.click(screen.getByRole('button',{name:/^Short practice/}));
    expect(screen.getByText(/25 marks, 26 minutes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][2]).toBe(10);expect(save.mock.calls[0][4]).toBe(26);
    expect(save.mock.calls[0][5].mcqCount).toBe(5);expect(save.mock.calls[0][6]).toBe(5);
  });
});

it('invalidates applied settings on paper/tier changes and retains custom topics',()=>{
  const {save}=editor({...base,assessment_tier:'foundation'});
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_1'}});
  fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_2'}});
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
  fireEvent.click(screen.getByRole('button',{name:'Higher'}));
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/^Custom/}));
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  expect(save.mock.calls[0][1]).toEqual(base.topics);
  expect(save.mock.calls[0][5].paperBlueprint).toEqual({courseSelection:{courseId:EDEXCEL_BIOLOGY_ID,paperId:'paper_2'}});
});

it('requires old custom Edexcel profiles to select a paper and tier before resaving',()=>{
  const {save}=editor();
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_1'}});
  expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Foundation'}));
  fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
  expect(save.mock.calls[0][1]).toEqual(base.topics);
  expect(save.mock.calls[0][5].paperBlueprint.courseSelection.paperId).toBe('paper_1');
});
