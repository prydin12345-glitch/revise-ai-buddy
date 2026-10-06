import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { WorkspaceSession } from '@/components/WorkspaceSession';
import { WorkspaceStore, useRetainedState, useWorkspaceSession } from '@/hooks/use-workspace-session';
import MobileBottomNav from '@/components/dashboard/mobile/MobileBottomNav';
import { PageHeader } from '@/components/PageHeader';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { ResponsiveActionSheet } from '@/components/ui/responsive-action-sheet';
import { RefreshableList } from '@/components/shared/RefreshableList';
import { useOptimisticFavourites } from '@/hooks/use-optimistic-favourites';
import { useSetupDraft } from '@/hooks/use-setup-draft';
import { useKeyboardViewport } from '@/hooks/use-keyboard-viewport';
import { setupDraftKey, readSetupDraft, writeSetupDraft, practiceRecoveryKey } from '@/lib/setup-draft';
import { getSafeRedirectPath, getSafeRedirectFromParams } from '@/lib/safe-redirect';
import { activeWorkspaceTab, workspaceDestinations } from '@/lib/workspace-navigation';
import { JoinClassModal } from '@/components/tutor/JoinClassModal';

const auth = vi.hoisted(() => ({
  owner: 'alice',
  callbacks: new Set<(event: string, session: { user: { id: string } } | null) => void>(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getUser: auth.getUser, getSession: auth.getSession,
    onAuthStateChange: (callback: (event: string, session: { user: { id: string } } | null) => void) => {
      auth.callbacks.add(callback);
      return { data: { subscription: { unsubscribe: () => auth.callbacks.delete(callback) } } };
    },
  }, from: auth.from,
} }));
const ownerChanged = (id: string | null) => {
  auth.owner = id ?? '';
  auth.callbacks.forEach(callback => callback(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null));
};
const Wrapper = ({ children }: { children: ReactNode }) => <WorkspaceSession>{children}</WorkspaceSession>;
const Location = () => { const location = useLocation(); return <output aria-label="location">{location.pathname + location.search + location.hash}</output>; };

beforeEach(() => {
  auth.owner = 'alice';
  auth.getUser.mockReset().mockImplementation(async () => ({ data: { user: auth.owner ? { id: auth.owner } : null } }));
  auth.getSession.mockReset().mockImplementation(async () => ({ data: { session: auth.owner ? { user: { id: auth.owner } } : null } }));
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { subjects_completed: true, goals_completed: true }, error: null }) };
  auth.from.mockReset().mockReturnValue(chain);
  sessionStorage.clear();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('CSS', { supports: () => true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('five primary controls and browser navigation', () => {
  it.each([false, true])('keeps Home left, Create central and Profile right (tutor=%s)', tutor => {
    const tabs = workspaceDestinations(tutor);
    expect(tabs).toHaveLength(5);
    expect(tabs.map(tab => tab.key)).toEqual(['home', 'exams', 'create', 'practice', 'profile']);
    expect(tabs[2].path).toBeNull();
  });
  it('Create is an action, never a selected destination, and does not change history', () => {
    const create = vi.fn();
    render(<MemoryRouter initialEntries={['/my-exams']}><MobileBottomNav onCreate={create} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(create).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Create' })).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('location')).toHaveTextContent('/my-exams');
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it('reselecting a destination scrolls to top without pushing another entry', () => {
    render(<MemoryRouter initialEntries={['/my-exams']}><MobileBottomNav onCreate={() => {}} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Exams' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(screen.getByLabelText('location')).toHaveTextContent('/my-exams');
  });
  it('respects reduced motion for reselecting a destination', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    render(<MemoryRouter initialEntries={['/dashboard']}><MobileBottomNav onCreate={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
  it('does not label unrelated tools or setup as Home or Create', () => {
    expect(activeWorkspaceTab('/my-subjects')).toBeUndefined();
    expect(activeWorkspaceTab('/upload')).toBeUndefined();
    expect(activeWorkspaceTab('/tutor/students', true)).toBe('practice');
    expect(activeWorkspaceTab('/settings/account')).toBe('profile');
  });
  it('returns to the same Profile section when switching primary tabs', async () => {
    function Navigation() { const navigate = useNavigate(); return <><MobileBottomNav onCreate={() => {}} /><Location /><button onClick={() => navigate('/settings?tab=preferences')}>Open preferences</button></>; }
    render(<Wrapper><MemoryRouter initialEntries={['/dashboard']}><Navigation /></MemoryRouter></Wrapper>);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Open preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(screen.getByLabelText('location')).toHaveTextContent('/settings?tab=preferences');
  });
  it('direct page entry has a fallback even if an external browser history exists', () => {
    window.history.replaceState({ idx: 0 }, '');
    render(<MemoryRouter initialEntries={['/detail']}><PageHeader title="Detail" backTo="/my-exams" /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('location')).toHaveTextContent('/my-exams');
  });
  it('Back returns one actual app entry instead of always forcing a fallback', () => {
    window.history.replaceState({ idx: 1 }, '');
    render(<MemoryRouter initialEntries={['/quizzes', '/detail']} initialIndex={1}><PageHeader title="Detail" backTo="/dashboard" /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('location')).toHaveTextContent('/quizzes');
  });
});

describe('account-scoped retained data and setup drafts', () => {
  it('keeps each list snapshot while updating another tab', () => {
    const store = new WorkspaceStore();
    store.set('exams', { search: 'biology', ids: ['a', 'b'], top: 680 }, {});
    store.set('quizzes', { search: 'maths' }, {});
    expect(store.get('exams', {})).toEqual({ search: 'biology', ids: ['a', 'b'], top: 680 });
  });
  it('does not expose the previous account’s list or filters after switching users', async () => {
    const { result } = renderHook(() => ({ scope: useWorkspaceSession(), list: useRetainedState('list', '') }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.scope.ownerId).toBe('alice'));
    act(() => result.current.list[1]('private exam title'));
    act(() => ownerChanged('bob'));
    expect(result.current.list[0]).toBe('');
    act(() => ownerChanged(null));
    act(() => ownerChanged('alice'));
    expect(result.current.list[0]).toBe('');
  });
  it('clears retained content even when sign-out and sign-in are batched', async () => {
    const { result } = renderHook(() => ({ scope: useWorkspaceSession(), list: useRetainedState('list', '') }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.scope.ownerId).toBe('alice'));
    act(() => result.current.list[1]('old content'));
    act(() => { ownerChanged(null); ownerChanged('alice'); });
    expect(result.current.list[0]).toBe('');
  });
  it('does not reset active work for an empty token-refresh event', async () => {
    const { result } = renderHook(() => ({ scope: useWorkspaceSession(), list: useRetainedState('list', '') }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.scope.ownerId).toBe('alice'));
    act(() => result.current.list[1]('unfinished work'));
    act(() => auth.callbacks.forEach(callback => callback('TOKEN_REFRESHED', null)));
    expect(result.current.scope.ownerId).toBe('alice');
    expect(result.current.list[0]).toBe('unfinished work');
  });
  it('accepts a current setup, excludes extra keys and isolates the owner and item', () => {
    const template = { title: '', topics: [] as string[], timer: 60 };
    writeSetupDraft(sessionStorage, 'alice', 'exam', { ...template, title: 'Biology', secret: 'not-a-real-key' });
    expect(readSetupDraft(sessionStorage, 'alice', 'exam', template)).toEqual({ ...template, title: 'Biology' });
    expect(readSetupDraft(sessionStorage, 'bob', 'exam', template)).toBeNull();
    expect(readSetupDraft(sessionStorage, 'alice', 'quiz', template)).toBeNull();
  });
  it('rejects expired, corrupt and wrong-shape drafts', () => {
    sessionStorage.setItem(setupDraftKey('alice', 'exam'), '{broken');
    expect(readSetupDraft(sessionStorage, 'alice', 'exam', { title: '' })).toBeNull();
    writeSetupDraft(sessionStorage, 'alice', 'exam', { title: 8 });
    expect(readSetupDraft(sessionStorage, 'alice', 'exam', { title: '' })).toBeNull();
    sessionStorage.setItem(setupDraftKey('alice', 'exam'), JSON.stringify({ version: 1, owner: 'alice', item: 'exam', updatedAt: 0, values: { title: 'old' } }));
    expect(readSetupDraft(sessionStorage, 'alice', 'exam', { title: '' })).toBeNull();
  });
  it('debounces the latest edit, flushes on leaving and restores on return', async () => {
    const useDraftFixture = () => {
      const [title, setTitle] = useState('');
      const draft = useSetupDraft({ item: 'exam', values: { title }, restore: values => setTitle(values.title), dirty: !!title });
      return { title, setTitle, draft, owner: useWorkspaceSession().ownerId };
    };
    const first = renderHook(useDraftFixture, { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.owner).toBe('alice'));
    act(() => first.result.current.setTitle('earlier'));
    act(() => first.result.current.setTitle('latest'));
    first.unmount();
    expect(readSetupDraft(sessionStorage, 'alice', 'exam', { title: '' })).toEqual({ title: 'latest' });
    const second = renderHook(useDraftFixture, { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.title).toBe('latest'));
    expect(second.result.current.draft.restored).toBe(true);
    act(() => second.result.current.draft.discard());
    expect(second.result.current.title).toBe('');
    expect(sessionStorage.getItem(setupDraftKey('alice', 'exam'))).toBeNull();
    second.unmount();
    expect(sessionStorage.getItem(setupDraftKey('alice', 'exam'))).toBeNull();
  });
  it('surfaces storage failure and supports retry without claiming a save', async () => {
    const { result } = renderHook(() => {
      const [title, setTitle] = useState('');
      return { setTitle, draft: useSetupDraft({ item: 'exam', values: { title }, restore: value => setTitle(value.title), dirty: !!title }), owner: useWorkspaceSession().ownerId };
    }, { wrapper: Wrapper });
    await waitFor(() => expect(result.current.owner).toBe('alice'));
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    act(() => result.current.setTitle('keep this'));
    await waitFor(() => expect(result.current.draft.status).toBe('error'));
    failing.mockRestore();
    act(() => result.current.draft.retry());
    await waitFor(() => expect(result.current.draft.status).toBe('saved'));
  });
  it('a late initial authentication lookup never replaces text already typed', async () => {
    let resolve!: (value: { data: { session: { user: { id: string } } } }) => void;
    auth.getSession.mockReturnValue(new Promise(value => { resolve = value; }));
    writeSetupDraft(sessionStorage, 'alice', 'exam', { title: 'old draft' });
    const { result } = renderHook(() => {
      const [title, setTitle] = useState('');
      useSetupDraft({ item: 'exam', values: { title }, restore: value => setTitle(value.title), dirty: !!title });
      return { title, setTitle };
    }, { wrapper: Wrapper });
    act(() => result.current.setTitle('new input'));
    await act(async () => resolve({ data: { session: { user: { id: 'alice' } } } }));
    expect(result.current.title).toBe('new input');
  });
  it('restores only the new account’s setup and never writes it into the previous scope', async () => {
    writeSetupDraft(sessionStorage, 'bob', 'exam', { title: 'Bob setup' });
    const { result, unmount } = renderHook(() => {
      const [title, setTitle] = useState('');
      const draft = useSetupDraft({ item: 'exam', values: { title }, restore: value => setTitle(value.title), dirty: !!title });
      return { title, setTitle, draft, owner: useWorkspaceSession().ownerId };
    }, { wrapper: Wrapper });
    await waitFor(() => expect(result.current.owner).toBe('alice'));
    act(() => result.current.setTitle('Alice setup'));
    act(() => window.dispatchEvent(new Event('pagehide')));
    act(() => ownerChanged('bob'));
    await waitFor(() => expect(result.current.title).toBe('Bob setup'));
    unmount();
    expect(readSetupDraft(sessionStorage, 'alice', 'exam', { title: '' })).toEqual({ title: 'Alice setup' });
    expect(readSetupDraft(sessionStorage, 'bob', 'exam', { title: '' })).toEqual({ title: 'Bob setup' });
  });
  it('confirmed completion clears recovery without recreating the same setup on unmount', async () => {
    const { result, unmount } = renderHook(() => {
      const [title, setTitle] = useState('');
      return { setTitle, draft: useSetupDraft({ item: 'exam', values: { title }, restore: value => setTitle(value.title), dirty: !!title }), owner: useWorkspaceSession().ownerId };
    }, { wrapper: Wrapper });
    await waitFor(() => expect(result.current.owner).toBe('alice'));
    act(() => result.current.setTitle('completed setup'));
    act(() => window.dispatchEvent(new Event('pagehide')));
    act(() => result.current.draft.clear());
    unmount();
    expect(sessionStorage.getItem(setupDraftKey('alice', 'exam'))).toBeNull();
  });
  it('practice recovery keys never collide across users, sets or questions', () => {
    expect(new Set([practiceRecoveryKey('alice', 'set', 'q'), practiceRecoveryKey('bob', 'set', 'q'), practiceRecoveryKey('alice', 'other', 'q'), practiceRecoveryKey('alice', 'set', 'other')]).size).toBe(4);
  });
});

describe('reversible favourite feedback', () => {
  it('updates immediately, blocks repeat taps and merges unrelated server updates', async () => {
    let resolve!: () => void;
    const save = vi.fn(() => new Promise<void>(value => { resolve = value; }));
    const { result } = renderHook(() => {
      const [favourites, setFavourites] = useState(new Set<string>());
      return { favourites, action: useOptimisticFavourites(favourites, setFavourites, save) };
    });
    act(() => { void result.current.action.toggle('a'); });
    expect(result.current.favourites.has('a')).toBe(true);
    act(() => { void result.current.action.toggle('a'); });
    expect(save).toHaveBeenCalledOnce();
    expect(result.current.action.reconcile(new Set(['b']))).toEqual(new Set(['a', 'b']));
    const readStartedDuringWrite = result.current.action.version();
    await act(async () => resolve());
    expect(result.current.action.pending.size).toBe(0);
    expect(result.current.action.version()).not.toBe(readStartedDuringWrite);
    expect(result.current.favourites.has('a')).toBe(true);
  });
  it('rolls back only the failed item and offers a retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result } = renderHook(() => {
      const [favourites, setFavourites] = useState(new Set(['existing']));
      return { favourites, action: useOptimisticFavourites(favourites, setFavourites, save) };
    });
    await act(async () => result.current.action.toggle('new'));
    expect(result.current.favourites).toEqual(new Set(['existing']));
    expect(result.current.action.failed.has('new')).toBe(true);
    await act(async () => result.current.action.toggle('new'));
    expect(result.current.favourites).toEqual(new Set(['existing', 'new']));
    expect(result.current.action.failed.has('new')).toBe(false);
  });
});

describe('list refresh, keyboard and accessible sheets', () => {
  it('keeps content while refreshing and prevents duplicate refresh calls', async () => {
    let resolve!: () => void;
    const refresh = vi.fn(() => new Promise<void>(value => { resolve = value; }));
    render(<RefreshableList onRefresh={refresh}><p>Existing Biology paper</p></RefreshableList>);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByText('Existing Biology paper')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing');
    await act(async () => resolve());
    expect(screen.getByRole('button', { name: 'Refresh list' })).toBeEnabled();
  });
  it('reports a failed refresh while retaining the list and offers retry', async () => {
    render(<RefreshableList onRefresh={async () => { throw new Error('offline'); }}><p>Existing paper</p></RefreshableList>);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Couldn’t refresh'));
    expect(screen.getByText('Existing paper')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh list' })).toBeEnabled();
  });
  it('a downward pull only triggers at the top of a suitable list', async () => {
    const refresh = vi.fn(async () => {});
    render(<RefreshableList onRefresh={refresh}><p>List area</p></RefreshableList>);
    const area = screen.getByText('List area');
    fireEvent.touchStart(area, { touches: [{ clientX: 150, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 150, clientY: 280 }] });
    fireEvent.touchEnd(area);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 30 });
    fireEvent.touchStart(area, { touches: [{ clientX: 150, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 150, clientY: 280 }] });
    fireEvent.touchEnd(area);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('leaves horizontal gestures, browser edges and editable fields alone', () => {
    const refresh = vi.fn(async () => {});
    render(<RefreshableList onRefresh={refresh}><p>List area</p><input aria-label="search" /></RefreshableList>);
    for (const [target, start, end] of [[screen.getByText('List area'), [4, 100], [4, 300]], [screen.getByText('List area'), [100, 100], [300, 180]], [screen.getByLabelText('search'), [100, 100], [100, 300]]] as const) {
      fireEvent.touchStart(target, { touches: [{ clientX: start[0], clientY: start[1] }] });
      fireEvent.touchMove(target, { touches: [{ clientX: end[0], clientY: end[1] }] });
      fireEvent.touchEnd(target);
    }
    expect(refresh).not.toHaveBeenCalled();
  });
  it('uses visible Close and Escape controls and restores focus for a contained action', async () => {
    function Sheet() { const [open, setOpen] = useState(false); return <ResponsiveActionSheet open={open} onOpenChange={setOpen} title="Create activity" description="Choose a task" trigger={<button>Open actions</button>}><button>Mock exam</button></ResponsiveActionSheet>; }
    render(<Sheet />);
    const trigger = screen.getByRole('button', { name: 'Open actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Create activity');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('detects keyboard occlusion and leaves the navigation available with hardware keyboards', () => {
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    renderHook(useKeyboardViewport);
    const input = document.createElement('input'); document.body.append(input); input.focus();
    expect(document.documentElement.dataset.keyboardOpen).toBe('false');
    viewport.height = window.innerHeight - 280;
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(document.documentElement.dataset.keyboardOpen).toBe('true');
    input.blur(); input.remove();
    expect(document.documentElement.dataset.keyboardOpen).toBe('false');
  });
});

describe('safe exact-item links through login', () => {
  it('prefills an existing invitation without looking it up or joining automatically', () => {
    render(<JoinClassModal open initialInviteCode="EXM-ABC123" onOpenChange={() => {}} onSuccess={() => {}} />);
    expect(screen.getByLabelText('Invite Code')).toHaveValue('EXM-ABC123');
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.from).not.toHaveBeenCalled();
  });
  it('retains the exact path, question query and fragment when a protected link requires login', async () => {
    auth.owner = '';
    render(<MemoryRouter initialEntries={['/exam/paper/review?q=13#question']}><Routes><Route path="/exam/:id/review" element={<OnboardingGuard><p>private</p></OnboardingGuard>} /><Route path="/auth" element={<Location />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent('/auth?mode=login&next='));
    const params = new URLSearchParams(screen.getByLabelText('location').textContent!.split('?')[1]);
    expect(getSafeRedirectFromParams(params, 'next')).toBe('/exam/paper/review?q=13#question');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
  it.each(['https://evil.example', '//evil.example', '/%2f%2fevil.example', '/%5cevil.example', '/\\evil.example', '/%0aevil', 'javascript:alert(1)'])('rejects unsafe login or notification destination %s', value => {
    expect(getSafeRedirectPath(value, '/dashboard')).toBe('/dashboard');
  });
});
