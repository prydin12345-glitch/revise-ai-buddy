import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ExamProfileModal} from '@/components/stats/ExamProfileModal';
import {PaperModeSelector} from '@/components/exams/PaperModeSelector';
import {resolveProfileContext} from '@/lib/profile-context';
import {OCR_GATEWAY_BIOLOGY_ID as OCR} from '@/lib/assessment-tier';
import {gatewaySectionHeading} from '@/lib/biology-paper-display';
vi.mock('@/hooks/useUserPreferences', () => ({useUserPreferences: () => ({preferences: {preferred_educational_level: 'level2'}})}));
vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
afterEach(cleanup);
const blueprint = {courseSelection: {courseId: OCR, paperId: 'first_paper'}, paperContract: {courseId: OCR, paperId: 'first_paper', mode: 'full_mock', contractVersion: 1}};

describe('OCR profile setup', () => {
  it('requires a tier before applying a guided plan', () => {
    render(<PaperModeSelector courseId={OCR} mode="full_mock" tier={null} applied={false} onModeChange={() => {}} onApplyPlan={() => {}} />);
    expect(screen.queryByRole('button', {name:'Use these settings'})).toBeNull();
    expect(screen.getByText(/Choose Foundation or Higher/)).toBeInTheDocument();
  });
  it('converts a stale AQA-style profile to the full OCR Foundation plan and saves all fields', async () => {
    const save = vi.fn();
    render(<ExamProfileModal open onOpenChange={() => {}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="OCR" availableTopics={[]}
      onSave={save} initialData={{profile_name:'First paper', topics:['Infection and response'], question_count:8, written_question_count:8, educational_tier:'level2', assessment_tier:'higher'}} />);
    fireEvent.change(screen.getByLabelText('OCR Biology course'), {target:{value:OCR}});
    expect(screen.queryByRole('button',{name:'Use these settings'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Foundation'}));
    fireEvent.click(screen.getByRole('button',{name:/^Full mock/}));
    fireEvent.click(screen.getByRole('button',{name:'Use these settings'}));
    const saveButton = screen.getByRole('button',{name:'Update Profile'});
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    expect(save).toHaveBeenCalledOnce();
    const args=save.mock.calls[0];
    expect(args[1]).toEqual(['B1: Cell level systems','B2: Scaling up','B3: Organism level systems']);
    expect(args[2]).toBe(41); expect(args[4]).toBe(105); expect(args[6]).toBe(26);
    expect(args[5].assessmentTier).toBe('foundation'); expect(args[5].mcqCount).toBe(15);
    expect(args[5].paperBlueprint).toEqual(blueprint);
    expect(args[7].includeGraphs).toBe(true); expect(args[7].includeTables).toBe(true); expect(args[7].mcqOptionsCount).toBe(4);
  });
  it('reloads Higher and preserves 26 written parts rather than clamping to 20', async () => {
    const save=vi.fn();
    render(<ExamProfileModal open onOpenChange={() => {}} subjectName="Biology Higher" subjectColor="#3388cc" examBoard="OCR" availableTopics={[]} onSave={save}
      initialData={{profile_name:'Paper 3', topics:['B1: Cell level systems','B2: Scaling up','B3: Organism level systems'], question_count:41,
        written_question_count:26, mcq_count:15, question_structure:'sub_questions', parent_question_count:24, max_parts_per_question:3,
        educational_tier:'level2', assessment_tier:'higher', paper_blueprint:blueprint} as any} />);
    expect(screen.getByRole('button',{name:'Higher'})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button',{name:'Update Profile'}));
    expect(save.mock.calls[0][6]).toBe(26);
  });
  it('shows the same immutable component in the resolver and sections', () => {
    const ctx=resolveProfileContext({subjectName:'Biology Higher', profile:{id:'p', exam_board:'OCR', educational_tier:'level2', assessment_tier:'foundation', paper_blueprint:blueprint}});
    expect(ctx.componentCode).toBe('J247/01'); expect(ctx.configurationError).toBeNull();
    expect(resolveProfileContext({subjectName:'Biology', manualExamBoard:'OCR', manualEducationalTier:'GCSE'}).configurationError).toContain('course');
    const stored={resolved_by:'server',context_version:2,subject_name:'Biology',exam_board:'OCR',educational_tier:'GCSE',assessment_tier:'foundation',course_id:OCR,paper_id:'first_paper',component_code:'J247/01',paper_contract:blueprint.paperContract};
    expect(gatewaySectionHeading(stored,'1')).toContain('Section A');
    expect(gatewaySectionHeading(stored,'2','1')).toBeNull();
    expect(gatewaySectionHeading(stored,'16(a)','15')).toContain('75 marks');
    expect(gatewaySectionHeading(stored,'16(b)','16(a)')).toBeNull();
  });
});
