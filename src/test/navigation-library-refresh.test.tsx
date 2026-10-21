import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { WorkspaceContext, WorkspaceStore } from '@/hooks/use-workspace-session';
import { workspaceQueryClient } from '@/lib/workspace-query-client';
import { LIBRARY_REVISION, refreshLibraryItemCaches } from '@/lib/library-item-cache';
import MyExams from '@/pages/MyExams';
import MyQuizzes from '@/pages/MyQuizzes';

const fake = vi.hoisted(() => ({
  readExam: vi.fn(), readQuiz: vi.fn(), toast: vi.fn(),
  recover: false, publication: null as Promise<unknown> | null,
  updates: [] as Array<{ table: string; payload: unknown; filters: Record<string, unknown> }>,
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'alice' } }, error: null }) },
  functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
  from: (table: string) => {
    let payload: unknown;
    const filters: Record<string, unknown> = {};
    const chain = {
      select: () => chain,
      update: (value: unknown) => { payload = value; return chain; },
      eq: (key: string, value: unknown) => { filters[key] = value; return chain; },
      gte: () => chain,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        if (payload) {
          fake.updates.push({ table, payload, filters });
          return (fake.publication || Promise.resolve({ data: null, error: null })).then(resolve, reject);
        }
        const data = table === 'practice_question_sets' && fake.recover ? [{ id: 'paper' }] : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return chain;
  },
} }));
vi.mock('@/lib/library-navigation-data', () => ({
  examLibraryQuery: (store: WorkspaceStore) => ({ queryKey: ['workspace-library', 'exam', store.get('library:revision', 0)], queryFn: fake.readExam }),
  quizLibraryQuery: (store: WorkspaceStore) => ({ queryKey: ['workspace-library', 'quiz', store.get('library:revision', 0)], queryFn: fake.readQuiz }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: fake.toast }));
vi.mock('@/hooks/useUserSubjects', () => ({ useUserSubjects: () => ({ subjects: [], getSubjectColor: () => '#246746' }) }));
vi.mock('@/hooks/useStudentPDF', () => ({ useStudentPDF: () => ({ generateStudentPDF: vi.fn() }) }));
vi.mock('@/components/student/StudentPDFDownloadModal', () => ({ StudentPDFDownloadModal: () => null }));
vi.mock('@/components/dashboard/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/shared/RefreshableList', () => ({ RefreshableList: ({ children, onRefresh }: { children: ReactNode; onRefresh: () => Promise<unknown> }) => <><button aria-label="Refresh library" onClick={() => void onRefresh()}>Refresh</button>{children}</> }));
vi.mock('@/components/exam/ExamCard', () => ({ ExamCard: ({ exam }: { exam: { id: string; title: string; status: string } }) => <article aria-label={exam.title} data-status={exam.status}>{exam.title}</article> }));
vi.mock('@/components/practice/PracticeSetCard', () => ({ PracticeSetCard: ({ set }: { set: { id: string; set_name: string; status: string } }) => <article aria-label={set.set_name} data-status={set.status}>{set.set_name}</article> }));

const exam = { id: 'paper', title: 'Cell biology', subject_id: 'Biology', created_at: '2026-10-01', status: 'published', user_id: 'alice', type: 'generated', exam_topics: [] };
const quiz = { id: 'paper', set_name: 'Cell biology', subject_id: 'Biology', created_at: '2026-10-01', status: 'published', user_id: 'alice', question_count: 3, subtopics: [], difficulty_mode: 'fixed', difficulty_level: 'medium' };
const progress = { questionsCompleted: 0, totalQuestions: 3, percentComplete: 0, timeRemaining: 'No timer', lastAccessed: 'Never', examState: 'not-started' as const };
const examSnapshot = (rows = [exam]) => ({ exams: rows, favouriteIds: [], favouritesError: null, completedExamIds: [], statesMap: new Map(), progressMap: new Map(rows.map(row => [row.id, progress])) });
const quizSnapshot = (rows = [quiz]) => ({ sets: rows, progressMap: {}, totalMarks: {}, marksError: null });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let store: WorkspaceStore, client: QueryClient;

function open(kind: 'exam' | 'quiz') {
  return render(<QueryClientProvider client={client}><WorkspaceContext.Provider value={{ ownerId: 'alice', ready: true, store }}><MemoryRouter initialEntries={[kind === 'exam' ? '/my-exams' : '/quizzes']}>{kind === 'exam' ? <MyExams /> : <MyQuizzes />}</MemoryRouter></WorkspaceContext.Provider></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('practice_sets_recovered', 'true');
  fake.recover = false; fake.publication = null; fake.updates = [];
  store = new WorkspaceStore('alice', 1); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  store.set('exams:loaded', true, false); store.set('exams:exams', [exam], []); store.set('exams:examProgress', new Map([['paper', progress]]), new Map());
  store.set('quizzes:loaded', true, false); store.set('quizzes:practiceSets', [quiz], []);
});
afterEach(() => { cleanup(); client.clear(); workspaceQueryClient(store).clear(); localStorage.clear(); });

describe('opened library refresh and prepared navigation data', () => {
  it('replaces a prepared draft snapshot after confirmed quiz recovery', async () => {
    localStorage.removeItem('practice_sets_recovered'); fake.recover = true;
    const publication = deferred<unknown>(); fake.publication = publication.promise;
    const draft = { ...quiz, status: 'draft' };
    store.set('quizzes:practiceSets', [draft], []);
    store.set('navigation:quiz-library', quizSnapshot([draft]), null);
    fake.readQuiz.mockResolvedValue(quizSnapshot());
    open('quiz');
    await waitFor(() => expect(fake.updates).toHaveLength(1));
    expect(screen.getByRole('article', { name: 'Cell biology' })).toHaveAttribute('data-status', 'draft');
    expect(fake.readQuiz).not.toHaveBeenCalled();
    await act(async () => { fake.recover = false; publication.resolve({ data: null, error: null }); });
    await waitFor(() => expect(screen.getByRole('article', { name: 'Cell biology' })).toHaveAttribute('data-status', 'published'));
    expect(fake.updates[0]).toEqual({ table: 'practice_question_sets', payload: { status: 'published' }, filters: { extraction_status: 'completed', status: 'draft' } });
    expect(fake.readQuiz).toHaveBeenCalledOnce();
    expect(store.get('navigation:quiz-library', null)).toBeNull();
    expect(store.get(LIBRARY_REVISION, 0)).toBe(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['exam', 'delete'], ['exam', 'archive'], ['quiz', 'delete'], ['quiz', 'archive'],
  ] as const)('refreshes %s after confirmed %s cancels a stale read without showing a false error', async (kind, operation) => {
    const late = deferred<unknown>();
    const read = kind === 'exam' ? fake.readExam : fake.readQuiz;
    const rows = operation === 'delete' ? [] : [{ ...(kind === 'exam' ? exam : quiz), status: 'archived' }];
    const fresh = kind === 'exam' ? examSnapshot(rows as typeof exam[]) : quizSnapshot(rows as typeof quiz[]);
    read.mockReturnValueOnce(late.promise).mockResolvedValue(fresh);
    open(kind);
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect(screen.getByRole('article', { name: 'Cell biology' })).toBeVisible();
    await act(async () => { await refreshLibraryItemCaches(store, client, kind, 'paper', operation === 'archive' ? 'archived' : undefined); });
    await waitFor(() => expect(read, JSON.stringify(read.mock.calls.map(([context]) => context.queryKey))).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Cell biology' })).not.toBeInTheDocument());
    await act(async () => { late.resolve(kind === 'exam' ? examSnapshot() : quizSnapshot()); });
    expect(screen.queryByRole('article', { name: 'Cell biology' })).not.toBeInTheDocument();
    expect(store.get(kind === 'exam' ? 'exams:exams' : 'quizzes:practiceSets', [])).toEqual(rows);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fake.toast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh library' }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
