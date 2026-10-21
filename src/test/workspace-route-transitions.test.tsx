import { Suspense, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { WorkspaceRouteViewport } from '@/components/WorkspaceRouteViewport';
import { WorkspacePageReady } from '@/components/WorkspacePageReady';
import { WorkspaceSession } from '@/components/WorkspaceSession';
import { WorkspaceContext, WorkspaceStore, useWorkspaceSession } from '@/hooks/use-workspace-session';
import { workspaceQueryClient } from '@/lib/workspace-query-client';
import { studentDashboardQuery } from '@/lib/student-dashboard-query';
import MobileBottomNav from '@/components/dashboard/mobile/MobileBottomNav';

vi.mock('@/lib/prefetch-routes', () => ({ prefetchRoute: vi.fn() }));

const fixtures = vi.hoisted(() => ({
  readRoles: vi.fn(),
  readHome: vi.fn(),
  readAccuracy: vi.fn(),
  readSubjectAverage: vi.fn(),
  owner: 'alice' as string | null,
  callbacks: new Set<(event: string, session: { user: { id: string } } | null) => void>(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: fixtures.owner ? { user: { id: fixtures.owner } } : null } }),
  onAuthStateChange: (callback: (event: string, session: { user: { id: string } } | null) => void) => {
    fixtures.callbacks.add(callback);
    return { data: { subscription: { unsubscribe: () => fixtures.callbacks.delete(callback) } } };
  },
} } }));
vi.mock('@/lib/workspace-summary-queries', () => ({
  rolesQuery: () => ({ queryKey: ['workspace-roles'], queryFn: fixtures.readRoles }),
  subjectsQuery: () => ({ queryKey: ['workspace-subjects'], queryFn: async () => [{ subject_name: 'Biology' }] }),
  profilesQuery: () => ({ queryKey: ['test-profiles'], queryFn: async () => ({}) }),
}));
vi.mock('@/lib/exam-stats-query', () => ({
  examStatsQuery: () => ({ queryKey: ['test-stats'], queryFn: async () => ({}) }),
  accuracyTrendQuery: () => ({ queryKey: ['test-accuracy'], queryFn: fixtures.readAccuracy }),
}));
vi.mock('@/lib/student-dashboard-query', () => ({
  studentDashboardQuery: (ownerId: string | null, generation = 0) => ({ queryKey: ['student-dashboard', ownerId, generation], queryFn: fixtures.readHome, staleTime: 60_000 }),
}));
vi.mock('@/lib/subject-average-query', () => ({
  subjectAverageQuery: (_store: unknown, subjectName: string) => ({ queryKey: ['workspace-subject-average', subjectName], queryFn: fixtures.readSubjectAverage }),
}));
vi.mock('@/lib/unified-topic-query', () => ({ unifiedTopicQuery: () => ({ queryKey: ['test-topics'], queryFn: async () => [] }) }));
vi.mock('@/lib/classes-query', () => ({ classesQuery: () => ({ queryKey: ['test-classes'], queryFn: async () => ({}) }) }));
vi.mock('@/lib/workspace-account-query', () => ({ accountQuery: () => ({ queryKey: ['test-account'], queryFn: async () => ({}) }) }));
vi.mock('@/lib/library-navigation-data', () => ({
  examLibraryQuery: () => ({ queryKey: ['test-exams'], queryFn: async () => ({}) }),
  quizLibraryQuery: () => ({ queryKey: ['test-quizzes'], queryFn: async () => ({}) }),
}));

const stores: WorkspaceStore[] = [];
const applicationClients: QueryClient[] = [];
function applicationClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  applicationClients.push(client);
  return client;
}
function scope(ownerId = 'alice', generation = 1) {
  const store = new WorkspaceStore(ownerId, generation);
  stores.push(store);
  return { ownerId, ready: true, store };
}
function pendingResource() {
  let ready = false;
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = () => { ready = true; done(); }; });
  return { read() { if (!ready) throw promise; }, resolve };
}
function Controls() {
  const navigate = useNavigate();
  const location = useLocation();
  return <nav aria-label="Test navigation">
    <button onClick={() => navigate('/slow')}>Slow page</button>
    <button onClick={() => navigate('/fast')}>Fast page</button>
    <button onClick={() => navigate('/dashboard')}>Dashboard</button>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => navigate(1)}>Forward</button>
    <output aria-label="Browser location">{location.pathname}</output>
  </nav>;
}
function Page({ title, resource }: { title: string; resource?: ReturnType<typeof pendingResource> }) {
  resource?.read();
  const location = useLocation();
  return <main><h1>{title}</h1><output aria-label="Rendered location">{location.pathname}</output></main>;
}
function ViewportFixture({ resource, children }: { resource: ReturnType<typeof pendingResource>; children?: ReactNode }) {
  return <><Controls /><WorkspaceRouteViewport>
    <Route path="/home" element={children ?? <Page title="Saved home content" />} />
    <Route path="/slow" element={<Page title="Loaded slow page" resource={resource} />} />
    <Route path="/fast" element={<Page title="Loaded fast page" />} />
  </WorkspaceRouteViewport></>;
}

beforeEach(() => {
  fixtures.owner = 'alice';
  fixtures.readRoles.mockReset().mockResolvedValue([{ role: 'student' }]);
  fixtures.readHome.mockReset().mockResolvedValue({ userName: 'Alice Student' });
  fixtures.readAccuracy.mockReset().mockResolvedValue([]);
  fixtures.readSubjectAverage.mockReset().mockResolvedValue({ percentage: 75 });
});
afterEach(() => {
  cleanup();
  stores.splice(0).forEach(store => workspaceQueryClient(store).clear());
  applicationClients.splice(0).forEach(client => client.clear());
  fixtures.callbacks.clear();
});

describe('deferred workspace navigation', () => {
  it('lets a mobile Home tap cancel another pending tab instead of treating it as a scroll-only reselect', async () => {
    const resource = pendingResource();
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/dashboard']}>
      <Controls /><WorkspaceRouteViewport>
        <Route path="/dashboard" element={<><Page title="Saved Home" /><MobileBottomNav onCreate={() => {}} /></>} />
        <Route path="/my-subjects" element={<Page title="Loaded Subjects" resource={resource} />} />
      </WorkspaceRouteViewport>
    </MemoryRouter></WorkspaceContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Subjects' }));
    expect(screen.getByLabelText('Browser location')).toHaveTextContent('/my-subjects');
    expect(screen.getByText('Opening page…')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByLabelText('Browser location')).toHaveTextContent('/dashboard');
    await act(async () => resource.resolve());
    expect(screen.getByRole('heading', { name: 'Saved Home' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Loaded Subjects' })).not.toBeInTheDocument();
  });

  it('retains the committed screen while code/data suspend, with honest progress instead of empty cards', async () => {
    const resource = pendingResource();
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/home']}><ViewportFixture resource={resource} /></MemoryRouter></WorkspaceContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Slow page' }));
    expect(screen.getByLabelText('Browser location')).toHaveTextContent('/slow');
    expect(screen.getByRole('heading', { name: 'Saved home content' })).toBeVisible();
    expect(screen.getByLabelText('Rendered location')).toHaveTextContent('/home');
    expect(screen.getByText('Opening page…')).toBeVisible();
    expect(screen.queryByLabelText('Loading page')).not.toBeInTheDocument();
    await act(async () => resource.resolve());
    expect(screen.getByRole('heading', { name: 'Loaded slow page' })).toBeVisible();
    expect(screen.getByLabelText('Rendered location')).toHaveTextContent('/slow');
    expect(screen.queryByText('Opening page…')).not.toBeInTheDocument();
  });

  it('commits the latest destination when a slower earlier navigation finishes afterwards', async () => {
    const resource = pendingResource();
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/home']}><ViewportFixture resource={resource} /></MemoryRouter></WorkspaceContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Slow page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fast page' }));
    await screen.findByRole('heading', { name: 'Loaded fast page' });
    await act(async () => resource.resolve());
    expect(screen.getByRole('heading', { name: 'Loaded fast page' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Loaded slow page' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Browser location')).toHaveTextContent('/fast');
  });

  it('respects Back during a pending transition and Forward after it resolves', async () => {
    const resource = pendingResource();
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/home']}><ViewportFixture resource={resource} /></MemoryRouter></WorkspaceContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Slow page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Browser location')).toHaveTextContent('/home');
    await act(async () => resource.resolve());
    expect(screen.getByRole('heading', { name: 'Saved home content' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    await screen.findByRole('heading', { name: 'Loaded slow page' });
    expect(screen.getByLabelText('Browser location')).toHaveTextContent('/slow');
  });

  it('uses the initial skeleton for a direct cold entry rather than showing an unrelated screen', async () => {
    const resource = pendingResource();
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/slow']}><ViewportFixture resource={resource} /></MemoryRouter></WorkspaceContext.Provider>);
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Saved home content' })).not.toBeInTheDocument();
    await act(async () => resource.resolve());
    expect(screen.getByRole('heading', { name: 'Loaded slow page' })).toBeVisible();
  });

  it('prepares cold Home in the application cache before replacing a directly opened page', async () => {
    const current = scope();
    const client = applicationClient();
    let finishHome!: (data: { userName: string }) => void;
    fixtures.readHome.mockImplementation(() => new Promise(resolve => { finishHome = resolve; }));
    function Home() {
      const { ownerId, store } = useWorkspaceSession();
      const { data } = useQuery(studentDashboardQuery(ownerId, store.generation));
      return <h1>Dashboard for {data?.userName}</h1>;
    }
    render(<QueryClientProvider client={client}><WorkspaceContext.Provider value={current}><MemoryRouter initialEntries={['/fast']}><Controls /><WorkspaceRouteViewport>
      <Route path="/fast" element={<WorkspacePageReady><Page title="Directly opened saved page" /></WorkspacePageReady>} />
      <Route path="/dashboard" element={<WorkspacePageReady><Home /></WorkspacePageReady>} />
    </WorkspaceRouteViewport></MemoryRouter></WorkspaceContext.Provider></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Directly opened saved page' });
    expect(fixtures.readHome).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    await waitFor(() => expect(fixtures.readHome).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: 'Directly opened saved page' })).toBeVisible();
    expect(screen.getByText('Opening page…')).toBeVisible();
    expect(screen.queryByRole('heading', { name: /Dashboard for/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Loading page')).not.toBeInTheDocument();
    await act(async () => finishHome({ userName: 'Alice Student' }));
    await screen.findByRole('heading', { name: 'Dashboard for Alice Student' });
    expect(client.getQueryData(['student-dashboard', 'alice', current.store.generation])).toEqual({ userName: 'Alice Student' });
    expect(fixtures.readHome).toHaveBeenCalledOnce();
  });

  it('discards the previous account immediately when the new account route suspends', async () => {
    const resource = pendingResource();
    const alice = scope();
    const bob = scope('bob', 2);
    const fixture = (value: typeof alice) => <WorkspaceContext.Provider value={value}><MemoryRouter initialEntries={['/home']}><ViewportFixture resource={resource} /></MemoryRouter></WorkspaceContext.Provider>;
    const view = render(fixture(alice));
    fireEvent.click(screen.getByRole('button', { name: 'Slow page' }));
    expect(screen.getByRole('heading', { name: 'Saved home content' })).toBeVisible();
    view.rerender(fixture(bob));
    expect(screen.queryByRole('heading', { name: 'Saved home content' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeVisible();
    await act(async () => resource.resolve());
    expect(screen.getByRole('heading', { name: 'Loaded slow page' })).toBeVisible();
  });

  it('clears retained private UI on the actual sign-out auth event, even during a pending navigation', async () => {
    const resource = pendingResource();
    function PrivateContent() {
      const { ownerId } = useWorkspaceSession();
      return <h1>{ownerId ? `Private workspace for ${ownerId}` : 'Signed out'}</h1>;
    }
    render(<WorkspaceSession><MemoryRouter initialEntries={['/home']}><ViewportFixture resource={resource}><PrivateContent /></ViewportFixture></MemoryRouter></WorkspaceSession>);
    await screen.findByRole('heading', { name: 'Private workspace for alice' });
    fireEvent.click(screen.getByRole('button', { name: 'Slow page' }));
    expect(screen.getByRole('heading', { name: 'Private workspace for alice' })).toBeVisible();
    act(() => {
      fixtures.owner = null;
      fixtures.callbacks.forEach(callback => callback('SIGNED_OUT', null));
    });
    expect(screen.queryByRole('heading', { name: 'Private workspace for alice' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeVisible();
    await act(async () => resource.resolve());
  });
});

describe('read-only route readiness failures', () => {
  function OptionalMetric({ name, queryKey, queryFn }: { name: string; queryKey: string[]; queryFn: () => Promise<unknown> }) {
    const { store } = useWorkspaceSession();
    const query = useQuery({ queryKey, queryFn, retryOnMount: false }, workspaceQueryClient(store));
    return query.isError ? <section aria-label={`${name} unavailable`}><p>{name} could not load.</p><button onClick={() => { void query.refetch(); }}>Retry {name}</button></section> : query.isSuccess ? <p>{name} ready</p> : <p>Loading {name}</p>;
  }

  it('turns a failed initial read into a useful retry and can open the destination after recovery', async () => {
    const current = scope();
    fixtures.readRoles.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['student']);
    render(<WorkspaceContext.Provider value={current}><MemoryRouter initialEntries={['/private']}><Suspense fallback={<div role="status">Preparing page</div>}><WorkspacePageReady><h1>Ready private page</h1></WorkspacePageReady></Suspense></MemoryRouter></WorkspaceContext.Provider>);
    expect(screen.getByRole('status')).toHaveTextContent('Preparing page');
    await screen.findByRole('heading', { name: 'Couldn’t open this page' });
    expect(screen.getByRole('alert')).toHaveTextContent('Your saved work is unchanged');
    expect(fixtures.readRoles).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { name: 'Ready private page' });
    expect(fixtures.readRoles).toHaveBeenCalledTimes(2);
  });

  it('does not block on a failed refresh when a previously loaded snapshot is available', async () => {
    const current = scope();
    const client = workspaceQueryClient(current.store);
    client.setQueryData(['workspace-roles'], [{ role: 'student' }]);
    fixtures.readRoles.mockRejectedValueOnce(new Error('offline'));
    await client.fetchQuery({ queryKey: ['workspace-roles'], queryFn: fixtures.readRoles, staleTime: 0 }).catch(() => {});
    render(<WorkspaceContext.Provider value={current}><MemoryRouter initialEntries={['/private']}><Suspense fallback={<div>Preparing page</div>}><WorkspacePageReady><h1>Ready private page</h1></WorkspacePageReady></Suspense></MemoryRouter></WorkspaceContext.Provider>);
    expect(screen.getByRole('heading', { name: 'Ready private page' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(fixtures.readRoles).toHaveBeenCalledTimes(1));
  });

  it('opens Stats when only optional accuracy fails, leaving a stable local retry', async () => {
    fixtures.readAccuracy.mockRejectedValueOnce(new Error('Accuracy offline'));
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/stats']}><Suspense fallback={<div role="status">Preparing page</div>}><WorkspacePageReady>
      <h1>Student Stats</h1><OptionalMetric name="Accuracy" queryKey={['test-accuracy']} queryFn={fixtures.readAccuracy} />
    </WorkspacePageReady></Suspense></MemoryRouter></WorkspaceContext.Provider>);
    await screen.findByRole('heading', { name: 'Student Stats' });
    expect(screen.getByRole('region', { name: 'Accuracy unavailable' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Couldn’t open this page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fixtures.readAccuracy).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Accuracy' }));
    await screen.findByText('Accuracy ready');
    expect(fixtures.readAccuracy).toHaveBeenCalledTimes(2);
  });

  it('opens Subjects when its optional average fails and retries that metric without blocking profiles', async () => {
    fixtures.readSubjectAverage.mockRejectedValueOnce(new Error('Average offline'));
    render(<WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/my-subjects']}><Suspense fallback={<div role="status">Preparing page</div>}><WorkspacePageReady>
      <h1>Saved Biology profiles</h1><OptionalMetric name="Biology average" queryKey={['workspace-subject-average', 'Biology']} queryFn={fixtures.readSubjectAverage} />
    </WorkspacePageReady></Suspense></MemoryRouter></WorkspaceContext.Provider>);
    await screen.findByRole('heading', { name: 'Saved Biology profiles' });
    expect(screen.getByRole('region', { name: 'Biology average unavailable' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Couldn’t open this page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fixtures.readSubjectAverage).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Biology average' }));
    await screen.findByText('Biology average ready');
    expect(fixtures.readSubjectAverage).toHaveBeenCalledTimes(2);
  });

  it('uses strict primary-role metadata rather than treating a truthy string as a tutor selection', async () => {
    fixtures.readRoles.mockResolvedValue([{ role: 'student' }, { role: 'tutor', metadata: { is_primary: 'true' } }]);
    const client = applicationClient();
    render(<QueryClientProvider client={client}><WorkspaceContext.Provider value={scope()}><MemoryRouter initialEntries={['/dashboard']}><Suspense fallback={<div role="status">Preparing page</div>}><WorkspacePageReady><h1>Student Home</h1></WorkspacePageReady></Suspense></MemoryRouter></WorkspaceContext.Provider></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Student Home' });
    expect(fixtures.readHome).toHaveBeenCalledOnce();
  });
});

describe('application summary cache sign-in generations', () => {
  function Identity() {
    const { ownerId, store } = useWorkspaceSession();
    return <output aria-label="Account generation">{ownerId ?? 'signed-out'}:{store.generation}</output>;
  }
  function emit(event: string, owner: string | null) {
    fixtures.owner = owner;
    fixtures.callbacks.forEach(callback => callback(event, owner ? { user: { id: owner } } : null));
  }
  it('removes only the outgoing account’s Home/sidebar snapshots on sign-out', async () => {
    const client = applicationClient();
    render(<QueryClientProvider client={client}><WorkspaceSession><Identity /></WorkspaceSession></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText('Account generation')).toHaveTextContent('alice:1'));
    client.setQueryData(['student-dashboard', 'alice'], { title: 'Alice private activity' });
    client.setQueryData(['workspace-sidebar-account', 'alice'], { name: 'Alice' });
    client.setQueryData(['student-dashboard', 'bob'], { title: 'Bob separate activity' });
    act(() => emit('SIGNED_OUT', null));
    expect(client.getQueryData(['student-dashboard', 'alice'])).toBeUndefined();
    expect(client.getQueryData(['workspace-sidebar-account', 'alice'])).toBeUndefined();
    expect(client.getQueryData(['student-dashboard', 'bob'])).toEqual({ title: 'Bob separate activity' });
    expect(screen.getByLabelText('Account generation')).toHaveTextContent('signed-out:2');
  });
  it('drops old snapshots even when sign-out and same-account sign-in are batched', async () => {
    const client = applicationClient();
    render(<QueryClientProvider client={client}><WorkspaceSession><Identity /></WorkspaceSession></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText('Account generation')).toHaveTextContent('alice:1'));
    client.setQueryData(['student-dashboard', 'alice'], { title: 'Before sign-out' });
    client.setQueryData(['workspace-sidebar-account', 'alice'], { name: 'Before sign-out' });
    act(() => { emit('SIGNED_OUT', null); emit('SIGNED_IN', 'alice'); });
    expect(screen.getByLabelText('Account generation')).toHaveTextContent('alice:3');
    expect(client.getQueryData(['student-dashboard', 'alice'])).toBeUndefined();
    expect(client.getQueryData(['workspace-sidebar-account', 'alice'])).toBeUndefined();
  });
  it('does not repopulate the outgoing account’s summary when its old request finishes late', async () => {
    const client = applicationClient();
    render(<QueryClientProvider client={client}><WorkspaceSession><Identity /></WorkspaceSession></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText('Account generation')).toHaveTextContent('alice:1'));
    let finish!: (data: { title: string }) => void;
    const oldRead = client.fetchQuery({ queryKey: ['student-dashboard', 'alice'], queryFn: () => new Promise(resolve => { finish = resolve; }) }).catch(() => undefined);
    act(() => emit('SIGNED_OUT', null));
    await act(async () => { finish({ title: 'Late private activity' }); await oldRead; });
    expect(client.getQueryData(['student-dashboard', 'alice'])).toBeUndefined();
    expect(screen.getByLabelText('Account generation')).toHaveTextContent('signed-out:2');
  });
});
