import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Clock, FileText, Flame, Trophy } from 'lucide-react';
import { WorkspaceContext, WorkspaceStore } from '@/hooks/use-workspace-session';
import MobileDashboard from '@/components/dashboard/mobile/MobileDashboard';
import { MyWorkTabBar } from '@/components/shared/MyWorkTabBar';
import type { DashboardData } from '@/components/dashboard/types';
import { MemoryRouter, useLocation } from 'react-router-dom';

afterEach(cleanup);

function setup(overrides: Partial<DashboardData> = {}) {
  const handlers = { onCreateExam: vi.fn(), onCreateQuiz: vi.fn(), onViewSubjects: vi.fn(), onOpenSubject: vi.fn(), onViewClasses: vi.fn(), onViewPractice: vi.fn(), onOpenExam: vi.fn(), onStartQuiz: vi.fn(), onContinue: vi.fn() };
  const statClick = vi.fn();
  const data: DashboardData = {
    profile: { name: 'Prydin', initials: 'P', program: 'GCSE' },
    profileStats: [
      { key: 'exams', icon: FileText, value: '2', label: 'Exams Completed', iconClass: 'text-primary', onClick: statClick },
      { key: 'avg', icon: Trophy, value: '78%', label: 'Average Score', iconClass: 'text-warning' },
      { key: 'hours', icon: Clock, value: '0h', label: 'Total Study Hours', iconClass: 'text-info' },
      { key: 'streak', icon: Flame, value: '—', label: 'Day Streak', iconClass: 'text-danger' },
    ],
    homeSubjects: [{ key: 'bio', name: 'Biology Higher', color: '#4a9d84', board: 'AQA' }],
    subjects: [], averageScore: '78%', classes: [], announcements: [],
    mockExams: [{ id: 'unfinished', title: 'Cell biology', subject: 'Biology', color: '#4a9d84', score: 0, status: 'in-progress', when: 'today' }],
    quizzes: [{ id: 'quiz', title: 'Energy transfers', subject: 'Physics', color: '#679dd7', questions: 10, best: null, when: 'today' }],
    ...handlers, ...overrides,
  };
  render(<WorkspaceContext.Provider value={{ ownerId: 'fixture', ready: true, store: new WorkspaceStore('fixture') }}><MobileDashboard {...data} /></WorkspaceContext.Provider>);
  return { handlers, statClick };
}

describe('mobile Home', () => {
  it('retains readable names and real values behind a compact summary and opens its drill-down', () => {
    const { statClick } = setup();
    const summary = screen.getByLabelText('Your study summary');
    expect(within(summary).getByText('78%')).toBeVisible();
    expect(within(summary).getByText('Total Study Hours')).toHaveClass('sr-only');
    fireEvent.click(screen.getByRole('button', { name: 'Exams Completed: 2' }));
    expect(statClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Refresh/i })).not.toBeInTheDocument();
  });
  it('connects quick starts, saved subjects and the combined practice library to their actual actions', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Mock exam/ }));
    fireEvent.click(screen.getByRole('button', { name: /Quick quiz/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Biology Higher' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'My subjects' })).getByRole('button', { name: /View all/ }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Recent practice' })).getByRole('button', { name: /View all/ }));
    expect(handlers.onCreateExam).toHaveBeenCalledOnce();
    expect(handlers.onCreateQuiz).toHaveBeenCalledOnce();
    expect(handlers.onOpenSubject).toHaveBeenCalledWith('Biology Higher');
    expect(handlers.onViewSubjects).toHaveBeenCalledOnce();
    expect(handlers.onViewPractice).toHaveBeenCalledOnce();
    expect(handlers.onViewPractice).toHaveBeenCalledWith('exams');
  });
  it('shows an unfinished exam as in progress and still routes quiz and exam taps', () => {
    const { handlers } = setup();
    expect(screen.getByText('In progress')).toBeVisible();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cell biology/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Quizzes' }));
    fireEvent.click(screen.getByRole('button', { name: /Energy transfers/ }));
    expect(handlers.onOpenExam).toHaveBeenCalledWith('unfinished');
    expect(handlers.onStartQuiz).toHaveBeenCalledWith('quiz');
  });
  it('offers a real subjects destination and calm empty states without invented progress', () => {
    const { handlers } = setup({ homeSubjects: [], mockExams: [], quizzes: [] });
    expect(screen.getByText('Your recent papers will appear here.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add your subjects' }));
    expect(handlers.onViewSubjects).toHaveBeenCalledOnce();
    expect(screen.queryByText('My classes')).not.toBeInTheDocument();
  });
});

describe('Practice library switcher', () => {
  it.each([false, true])('opens both libraries under the shared destination (tutor=%s)', tutor => {
    function Path() { return <output aria-label="path">{useLocation().pathname}</output>; }
    render(<MemoryRouter initialEntries={[tutor ? '/tutor/exams' : '/my-exams']}><MyWorkTabBar tutor={tutor} /><Path /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Practice libraries' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Quizzes' }));
    expect(screen.getByLabelText('path')).toHaveTextContent(tutor ? '/tutor/practice' : '/quizzes');
    expect(within(nav).getByRole('button', { name: 'Quizzes' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(nav).getByRole('button', { name: 'Exams' }));
    expect(screen.getByLabelText('path')).toHaveTextContent(tutor ? '/tutor/exams' : '/my-exams');
  });
});
