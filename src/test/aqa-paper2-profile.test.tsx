import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {resolveProfileContext} from '@/lib/profile-context';
import {biologyPaperDisplay, gatewaySectionHeading} from '@/lib/biology-paper-display';
import {paper2Snapshot} from '../../supabase/tests/aqa-paper2-fixtures';
vi.mock('@/hooks/useUserPreferences',()=>({useUserPreferences:()=>({preferences:{preferred_educational_level:'level2'}})}));
vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
afterEach(cleanup);
const base={profile_name:'My paper',topics:['My microscopy notes'],question_count:8,written_question_count:8,educational_tier:'level2',assessment_tier:'foundation'};
function editor(initial: any=base) {
  const save=vi.fn();
  const view=render(<ExamProfileModal open onOpenChange={()=>{}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="AQA"
    availableTopics={['My microscopy notes']} onSave={save} initialData={initial} />);
  return {save,...view};
}
describe('AQA paper selection',()=>{
  it.each(['foundation','higher'] as const)('explicitly converts to Paper 2 %s, saves and reopens unchanged',tier=>{
    const {save,unmount}=editor({...base,assessment_tier:tier,topics:[]});
    expect(screen.getByLabelText('Biology paper')).toHaveValue('paper_1');
    fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_2'}});
    fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    const args=save.mock.calls[0];
    expect(args[1]).toEqual(['Homeostasis and response','Inheritance, variation and evolution','Ecology']);
    expect(args[2]).toBe(36); expect(args[4]).toBe(105); expect(args[6]).toBe(27);
    expect(args[5].assessmentTier).toBe(tier); expect(args[5].mcqCount).toBe(9);
    expect(args[5].paperBlueprint.paperContract.paperId).toBe('paper_2');
    expect(args[7].includeGraphs).toBe(true); expect(args[7].includeTables).toBe(true);
    unmount();
    const reopened=editor({...base,assessment_tier:tier,topics:args[1],question_count:36,written_question_count:27,mcq_count:9,
      paper_blueprint:args[5].paperBlueprint,question_structure:args[7].questionStructure,parent_question_count:9,max_parts_per_question:4});
    expect(screen.getByLabelText('Biology paper')).toHaveValue('paper_2');
    expect(screen.getByRole('button',{name:tier==='higher'?'Higher':'Foundation'})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(reopened.save.mock.calls[0][6]).toBe(27);
    const ctx=resolveProfileContext({subjectName:'Biology Higher',profile:{id:'p',exam_board:'AQA',educational_tier:'level2',assessment_tier:tier,paper_blueprint:args[5].paperBlueprint}});
    expect(ctx.configurationError).toBeNull(); expect(ctx.paperId).toBe('paper_2');
    expect(ctx.componentCode).toBe(tier==='foundation'?'8461/2F':'8461/2H');
  });
  it('never changes a legacy custom profile into Paper 2 or guesses Higher from its subject name',()=>{
    const {save}=editor({...base,assessment_tier:null});
    expect(screen.getByLabelText('Biology paper')).toHaveValue('paper_1');
    expect(screen.getByRole('button',{name:'Higher'})).toHaveAttribute('aria-pressed','false');
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][5].paperBlueprint).toBeNull();
    expect(save.mock.calls[0][1]).toEqual(base.topics);
  });
  it('requires reapplication after changing paper or tier and restores manual topics in Custom',()=>{
    const {save}=editor({...base,paper_blueprint:{paperContract:{...paper2Snapshot().paper_contract,paperId:'paper_1'}}});
    fireEvent.change(screen.getByLabelText('Biology paper'),{target:{value:'paper_2'}});
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    fireEvent.click(screen.getByRole('button',{name:'Higher'}));
    expect(screen.getByRole('button',{name:'Update Profile'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:/^Custom/}));
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][1]).toEqual(base.topics);
    expect(save.mock.calls[0][5].paperBlueprint).toEqual({courseSelection:{courseId:'aqa_gcse_biology',paperId:'paper_2'}});
  });
  it('keeps Paper 1 guided profiles on Paper 1 when reopened',()=>{
    const {save}=editor({...base,paper_blueprint:{paperContract:{...paper2Snapshot().paper_contract,paperId:'paper_1'}}});
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][2]).toBe(32);
    expect(save.mock.calls[0][5].paperBlueprint.paperContract.paperId).toBe('paper_1');
  });
  it('labels Paper 2 in the screen/print helper without adding OCR sections',()=>{
    expect(biologyPaperDisplay(paper2Snapshot())?.label).toContain('8461/2F');
    expect(biologyPaperDisplay(paper2Snapshot('higher'))?.subject).toBe('Biology');
    expect(gatewaySectionHeading(paper2Snapshot(),'1(a)')).toBeNull();
  });
});
