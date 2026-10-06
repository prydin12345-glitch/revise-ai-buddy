import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { WorkspaceSession } from '@/components/WorkspaceSession';
import { useWorkspaceSession } from '@/hooks/use-workspace-session';
import ManageFeedback from '@/pages/tutor/ManageFeedback';

const backend = vi.hoisted(() => ({ failSend: false, requests: 0, threadCount: 12, refresh: null as (() => void) | null }));
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ markAsReadByMetadata: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => {
  const user = { id: 'tutor' };
  const rows = (table: string) => {
    if (table === 'question_feedback_threads') return Array.from({ length: backend.threadCount }, (_, index) => ({ id: `thread-${index}`, exam_id: 'exam', question_id: `question-${index}`, student_id: 'student', student_comment: `Clarify question ${index}`, tutor_response: null, status: 'pending', created_at: '2026-10-04T12:00:00Z', exam: { title: 'Biology', subject_id: 'Biology' } }));
    if (table === 'exams') return [{ id: 'exam', title: 'Biology', subject_id: 'Biology' }];
    if (table === 'exam_questions') return Array.from({ length: 12 }, (_, index) => ({ id: `question-${index}`, question_number: String(index), question_text: 'Explain natural selection.', has_math: false, correct_answer: null }));
    if (table === 'user_profiles') return [{ id: 'student', first_name: 'Alex', last_name: 'Student', student_code: 'A1' }];
    return [];
  };
  return { supabase: {
    auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: { user } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: (table: string) => {
      let writing = false;
      const query = {
        select: () => query, eq: () => query, in: () => query, or: () => query, order: () => query,
        update: () => { writing = true; return query; },
        then: (resolve: (value: { data: unknown; error: Error | null }) => void) => {
          backend.requests += 1;
          return Promise.resolve({ data: rows(table), error: writing && backend.failSend ? new Error('Reply failed') : null }).then(resolve);
        },
      };
      return query;
    },
    channel: () => ({ on(_event: string, _config: unknown, callback: () => void) { backend.refresh = callback; return this; }, subscribe() { return this; } }), removeChannel() {},
  } };
});

let navigate: ReturnType<typeof useNavigate>;
function ReadyRoutes() {
  const { ready } = useWorkspaceSession();
  navigate = useNavigate();
  if (!ready) return null;
  return <Routes><Route path="/feedback" element={<ManageFeedback />} /><Route path="/other" element={<p>Other tab</p>} /></Routes>;
}
const mount = (path: string) => render(<WorkspaceSession><MemoryRouter initialEntries={[path]}><ReadyRoutes /></MemoryRouter></WorkspaceSession>);
beforeEach(() => { backend.failSend = false; backend.requests = 0; backend.threadCount = 12; backend.refresh = null; sessionStorage.clear(); });
afterEach(cleanup);

describe('tutor reply recovery and local pagination', () => {
  it('keeps an unfinished reply across page navigation and a failed send, scoped to its thread', async () => {
    mount('/feedback?thread=thread-0');
    const reply = await screen.findByRole('textbox', { name: 'Your Response:' });
    fireEvent.change(reply, { target: { value: 'Selection changes allele frequencies.' } });
    expect(screen.getByRole('status')).toHaveTextContent('Reply draft kept for this session.');
    expect(sessionStorage.length).toBe(0);
    backend.failSend = true;
    fireEvent.click(screen.getByRole('button', { name: 'Send Response' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Response' })).not.toBeDisabled());
    expect(reply).toHaveValue('Selection changes allele frequencies.');
    act(() => navigate('/other'));
    expect(screen.getByText('Other tab')).toBeInTheDocument();
    act(() => navigate('/feedback?thread=thread-1'));
    expect(await screen.findByRole('textbox', { name: 'Your Response:' })).toHaveValue('');
    act(() => navigate('/other'));
    act(() => navigate('/feedback?thread=thread-0'));
    expect(await screen.findByRole('textbox', { name: 'Your Response:' })).toHaveValue('Selection changes allele frequencies.');
  });

  it('returns to the same local feedback page with its already loaded content', async () => {
    mount('/feedback');
    await screen.findByText('Clarify question 0');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Clarify question 10')).toBeInTheDocument();
    act(() => navigate('/other'));
    act(() => navigate('/feedback'));
    expect(screen.getByText('Clarify question 10')).toBeInTheDocument();
    expect(screen.queryByText('Clarify question 0')).not.toBeInTheDocument();
    await waitFor(() => expect(backend.requests).toBeGreaterThan(6));
    expect(screen.getByText('Clarify question 10')).toBeInTheDocument();
    backend.threadCount = 5;
    await act(async () => { await backend.refresh?.(); });
    await screen.findByText('Clarify question 0');
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  });
});
