import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ExamCard } from '@/components/exam/ExamCard';
import { PracticeSetCard } from '@/components/practice/PracticeSetCard';
import { ExamPaperCoverStatic } from '@/components/exam/ExamPaperCoverStatic';
import { QuizPaperCoverStatic } from '@/components/practice/QuizPaperCoverStatic';
import { MyWorkTabBar } from '@/components/shared/MyWorkTabBar';
import { workspaceSidebarItems, isSidebarDestinationActive, sidebarDestinationPath } from '@/lib/workspace-sidebar-navigation';

const exam = { id: 'exam-1', title: 'Biological diversity', subject_id: 'Biology', created_at: '2026-10-01', status: 'published', type: 'generated', exam_board: 'ocr', qualification_level: 'level3_a_level', exam_topics: [{ topic_name: 'Biodiversity and conservation' }] };
const progress = { questionsCompleted: 4, totalQuestions: 20, percentComplete: 20, timeRemaining: '45min', lastAccessed: 'Never', examState: 'in-progress' as const };
const quiz = { id: 'quiz-1', set_name: 'Population genetics', subject_id: 'Biology', subtopics: ['Hardy–Weinberg'], difficulty_mode: 'fixed', difficulty_level: 'medium', question_count: 10, created_at: '2026-10-01', exam_board: 'ocr', educational_tier: 'level3_a_level' };
const quizProgress = { questions_attempted: 4, last_accessed_at: '2026-10-01', time_spent_seconds: 180 };
const favourite = { selected: false, pending: false, failed: false, onToggle: vi.fn() };
function Path() { return <output aria-label="path">{useLocation().pathname + useLocation().search}</output>; }
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function open(children: React.ReactNode, path = '/my-exams') {
  return render(<MemoryRouter initialEntries={[path]}>{children}<Path /></MemoryRouter>);
}

describe('shared Practice Library navigation', () => {
  it.each([false, true])('has one sidebar library entry and retains other role destinations (tutor=%s)', tutor => {
    const items = workspaceSidebarItems(tutor);
    expect(items.filter(item => item.label === 'Practice Library')).toHaveLength(1);
    expect(items.some(item => ['My Exams', 'Practice Quizzes', 'Manage Exams', 'Practice Sets'].includes(item.label))).toBe(false);
    expect(items.map(item => item.path)).toEqual(tutor ? ['/dashboard', '/tutor/exams', '/tutor/students', '/tutor/feedback', '/tutor/progress'] : ['/dashboard', '/my-exams', '/my-classes', '/my-subjects', '/stats']);
    expect(items.find(item => item.path === (tutor ? '/tutor/progress' : '/my-subjects'))?.section).toBe('learning');
    if (tutor) expect(items.find(item => item.path === '/tutor/feedback')?.section).toBe('learning');
    for (const path of tutor ? ['/tutor/exams', '/tutor/practice'] : ['/my-exams', '/quizzes']) {
      expect(isSidebarDestinationActive(path, items[1].path)).toBe(true);
    }
    expect(isSidebarDestinationActive(tutor ? '/quizzes' : '/tutor/practice', items[1].path)).toBe(false);
  });
  it('remembers only the correct role’s library and preserves its query and fragment', () => {
    expect(sidebarDestinationPath('/my-exams', '/quizzes?subject=Biology#saved')).toBe('/quizzes?subject=Biology#saved');
    expect(sidebarDestinationPath('/tutor/exams', '/tutor/practice')).toBe('/tutor/practice');
    expect(sidebarDestinationPath('/my-exams', '/tutor/practice')).toBe('/my-exams');
    expect(sidebarDestinationPath('/tutor/exams', '/quizzes')).toBe('/tutor/exams');
    expect(sidebarDestinationPath('/my-exams', 'https://example.invalid')).toBe('/my-exams');
    expect(sidebarDestinationPath('/my-exams', '/exam/live/in-progress')).toBe('/my-exams');
    expect(sidebarDestinationPath('/stats', '/quizzes')).toBe('/stats');
  });
  it.each([false, true])('keeps existing direct routes and selects the correct view (tutor=%s)', tutor => {
    open(<MyWorkTabBar tutor={tutor} />, tutor ? '/tutor/practice' : '/quizzes');
    const nav = screen.getByRole('navigation', { name: 'Practice libraries' });
    expect(within(nav).getByRole('button', { name: 'Quizzes' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(nav).getByRole('button', { name: 'Exams' }));
    expect(screen.getByLabelText('path')).toHaveTextContent(tutor ? '/tutor/exams' : '/my-exams');
  });
});

describe('compact paper covers', () => {
  it('keeps exam metadata, real progress and cover navigation without repeating the masthead or topics', () => {
    open(<ExamCard exam={exam} progress={progress} subjectColor="#246746" favourite={favourite} />);
    expect(screen.getByRole('heading', { name: exam.title })).toBeVisible();
    expect(screen.getByText('OCR · A-Level')).toBeVisible();
    expect(screen.getByText('45min')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
    expect(screen.queryByText('Biodiversity and conservation')).not.toBeInTheDocument();
    expect(screen.queryByText(/Modelled on|Practice paper|Examly/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Biological diversity' }));
    expect(screen.getByLabelText('path')).toHaveTextContent('/exam/exam-1/cover');
  });
  it('preserves the archived guard while still allowing the existing favourite action', () => {
    open(<ExamCard exam={exam} progress={progress} subjectColor="#246746" isArchived favourite={favourite} />);
    expect(screen.getByRole('button', { name: 'Open Biological diversity' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Open Biological diversity' }));
    expect(screen.getByLabelText('path')).toHaveTextContent('/my-exams');
    fireEvent.click(screen.getByRole('button', { name: 'Favourite' }));
    expect(favourite.onToggle).toHaveBeenCalledOnce();
  });
  it('retains quiz calculations, difficulty and its existing cover route', () => {
    open(<PracticeSetCard set={quiz} progress={quizProgress} subjectColor="#246746" favourite={favourite} />, '/quizzes');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('~20m')).toBeVisible();
    expect(screen.getByText('medium')).toBeVisible();
    expect(screen.queryByText('Hardy–Weinberg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Population genetics' }));
    expect(screen.getByLabelText('path')).toHaveTextContent('/quizzes/quiz-1/cover');
  });
  it('locks an in-flight favourite and exposes failed saving with its retry action', () => {
    const view = open(<ExamCard exam={exam} progress={progress} subjectColor="#246746" favourite={{ ...favourite, pending: true, selected: true }} />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    view.rerender(<MemoryRouter><ExamCard exam={exam} progress={progress} subjectColor="#246746" favourite={{ ...favourite, failed: true }} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save your favourite');
    fireEvent.click(screen.getByRole('button', { name: 'Favourite' }));
    expect(favourite.onToggle).toHaveBeenCalledOnce();
  });
  it('keeps the full title accessible even when its visual summary is clamped', () => {
    const title = 'An extended exam title covering unfamiliar biological contexts and experimental investigation';
    open(<ExamCard exam={{ ...exam, title }} progress={progress} subjectColor="#246746" />);
    expect(screen.getByRole('button', { name: `Open ${title}` })).toBeVisible();
    expect(screen.getByRole('heading', { name: title })).toHaveAttribute('title', title);
  });
  it('leaves topics and instructions on both detailed covers', () => {
    render(<><ExamPaperCoverStatic examName={exam.title} subjectId="Biology" subjectColor="#246746" boardLabel="OCR" levelLabel="A-Level" totalQuestions={20} timerEnabled durationMinutes={90} topics={['Biodiversity and conservation']} /><QuizPaperCoverStatic setName={quiz.set_name} subjectId="Biology" subjectColor="#246746" boardLabel="OCR" levelLabel="A-Level" totalQuestions={10} difficulty="medium" subtopics={['Hardy–Weinberg']} /></>);
    expect(screen.getByText('Biodiversity and conservation')).toBeVisible();
    expect(screen.getByText('Hardy–Weinberg')).toBeVisible();
    expect(screen.getAllByText('Information for candidates')).toHaveLength(2);
  });
});
